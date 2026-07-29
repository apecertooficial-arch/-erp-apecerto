/**
 * CRM Nova Era — RUNNER da Sara em modo OBSERVADOR (Fase 3 correção, P0-B).
 * ------------------------------------------------------------------
 * Núcleo de orquestração PURO e testável por injeção de dependências. NÃO faz I/O
 * direto: recebe deps (banco/ia-router) e apenas ORQUESTRA. Garantias:
 *  - processa SOMENTE quando modo=observer (kill-switch: off/suggest/execute não rodam);
 *  - jamais muta operacional (o único "write" é deps.registrar → RPC service insert-only);
 *  - idempotente por context_hash (não reanalisa o mesmo contexto);
 *  - lote limitado, timeout e retry limitado por item;
 *  - falha isolada por negócio (um erro não interrompe o lote);
 *  - registra versão de prompt/modelo (na dep.registrar) e erro SANITIZADO;
 *  - reutiliza o contrato do ia-router (deps.chamarIaRouter);
 *  - identidade é do SERVIÇO (deps.registrar usa service_role) — nunca um corretor.
 * A execução automática real depende de Edge Function + cron (preparados, não aplicados).
 */

export type SaraModoRunner = "off" | "observer" | "suggest" | "execute";

export interface Elegivel { negocioId: number; }
export interface Contexto { hash: string; texto: string; etapaAtual: string | null; }

export interface RunnerDeps {
  getModo(): Promise<SaraModoRunner>;
  listarElegiveis(lote: number): Promise<Elegivel[]>;
  /** null => SEM CONTEXTO (legítimo). LANÇAR => erro de banco (fail-closed). */
  lerContexto(negocioId: number): Promise<Contexto | null>;
  /** Idempotência por (negócio, contexto): mesmo texto em negócios diferentes NÃO colide. */
  jaAnalisado(negocioId: number, hash: string): Promise<boolean>;
  chamarIaRouter(input: { negocioId: number; texto: string }): Promise<unknown>;
  validar(raw: unknown, ctx: Contexto): { ok: boolean; analise?: Record<string, unknown> };
  registrar(negocioId: number, hash: string, analise: Record<string, unknown>): Promise<{ ok: boolean; ja?: boolean }>;
  /** Marca o RESULTADO de CADA negócio processado (fila justa / backoff). Opcional. */
  marcarResultado?: (negocioId: number, status: ItemStatus, erro?: string) => Promise<void>;
  log?: (msg: string) => void;
}

export interface RunnerOpts { lote: number; timeoutMs: number; maxRetries: number; }

export type ItemStatus = "analisado" | "ja_analisado" | "invalido" | "erro" | "sem_contexto";

export interface RunnerResultado {
  executou: boolean;
  modo: SaraModoRunner;
  processados: number;
  analisados: number;
  pulados_ja_analisado: number;
  invalidos: number;
  erros: number;
  sem_contexto: number;
  /** Falhas ao marcar item na fila justa (ncrm_sara_runner_marcar_item). Best-effort mas
   *  NUNCA silencioso: cada falha é logada sanitizada e contada aqui — >0 = rotação em risco. */
  marcacoes_falhas: number;
  ultimoNegocioId: number | null;
  detalhes: Array<{ negocioId: number; status: ItemStatus; erro?: string; marcacaoFalhou?: boolean }>;
}

/** Remove segredos/tokens prováveis e trunca — nunca vaza detalhe cru. */
export function sanitizarErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/[A-Za-z0-9_-]{20,}/g, "***").replace(/\s+/g, " ").trim().slice(0, 200) || "erro";
}

function comTimeout<T>(p: Promise<T> | T, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let feito = false;
    const to = setTimeout(() => { if (!feito) { feito = true; reject(new Error("timeout")); } }, ms);
    Promise.resolve(p).then(
      (v) => { if (!feito) { feito = true; clearTimeout(to); resolve(v); } },
      (e) => { if (!feito) { feito = true; clearTimeout(to); reject(e); } },
    );
  });
}

async function comTimeoutRetry<T>(fn: () => Promise<T> | T, timeoutMs: number, maxRetries: number): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i <= Math.max(0, maxRetries); i++) {
    try { return await comTimeout(fn(), timeoutMs); }
    catch (e) { ultimo = e; }
  }
  throw ultimo instanceof Error ? ultimo : new Error("falha_apos_retries");
}

export async function saraObserverRunner(deps: RunnerDeps, opts: RunnerOpts): Promise<RunnerResultado> {
  // ERRO ao consultar modo NÃO deve virar "observer": deps.getModo() LANÇA em falha de banco.
  const modo = await deps.getModo();
  const base: RunnerResultado = { executou: false, modo, processados: 0, analisados: 0, pulados_ja_analisado: 0, invalidos: 0, erros: 0, sem_contexto: 0, marcacoes_falhas: 0, ultimoNegocioId: null, detalhes: [] };

  // KILL-SWITCH / gate: processa SOMENTE em observer. off/suggest/execute não rodam o runner.
  if (modo !== "observer") { deps.log?.(`runner ignorado: modo=${modo}`); return base; }
  base.executou = true;

  const lote = Math.max(0, Math.min(opts.lote, 500));
  const elegiveis = await deps.listarElegiveis(lote);

  // Marca o RESULTADO de TODO negócio processado (não só quando registra) — participa da fila justa.
  const finalizar = async (negocioId: number, status: ItemStatus, erro?: string) => {
    base.processados++;
    base.ultimoNegocioId = negocioId;
    if (status === "analisado") base.analisados++;
    else if (status === "ja_analisado") base.pulados_ja_analisado++;
    else if (status === "invalido") base.invalidos++;
    else if (status === "sem_contexto") base.sem_contexto++;
    else base.erros++;
    const detalhe: { negocioId: number; status: ItemStatus; erro?: string; marcacaoFalhou?: boolean } = { negocioId, status, ...(erro ? { erro } : {}) };
    if (deps.marcarResultado) {
      try { await deps.marcarResultado(negocioId, status, erro); }
      catch (e) {
        // Best-effort ≠ silencioso: não derruba o lote, mas aparece no log E no resultado.
        base.marcacoes_falhas++;
        detalhe.marcacaoFalhou = true;
        deps.log?.(`marcar_item falhou negocio=${negocioId}: ${sanitizarErro(e)}`);
      }
    }
    base.detalhes.push(detalhe);
  };

  for (const el of elegiveis) {
    try {
      const ctx = await deps.lerContexto(el.negocioId);
      if (ctx === null) { await finalizar(el.negocioId, "sem_contexto"); continue; } // sem contexto legítimo
      // NÃO chama IA para contexto já analisado (economia + idempotência por negócio+hash).
      if (await deps.jaAnalisado(el.negocioId, ctx.hash)) { await finalizar(el.negocioId, "ja_analisado"); continue; }
      const raw = await comTimeoutRetry(() => deps.chamarIaRouter({ negocioId: el.negocioId, texto: ctx.texto }), opts.timeoutMs, opts.maxRetries);
      const v = deps.validar(raw, ctx);
      if (!v.ok || !v.analise) { await finalizar(el.negocioId, "invalido", "resposta_invalida"); continue; }
      const r = await deps.registrar(el.negocioId, ctx.hash, v.analise);
      if (r.ja) await finalizar(el.negocioId, "ja_analisado");
      else if (r.ok) await finalizar(el.negocioId, "analisado");
      else await finalizar(el.negocioId, "erro", "registro_recusado");
    } catch (e) {
      // FALHA ISOLADA POR NEGÓCIO: nunca interrompe o lote; erro sanitizado.
      await finalizar(el.negocioId, "erro", sanitizarErro(e));
    }
  }
  return base;
}

/* ============================ Autenticação cron → Edge ============================ */

/** Comparação de segredo em tempo ~constante, SEM logar o valor. */
export function compararSegredo(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  const a = String(recebido ?? "");
  const b = String(esperado ?? "");
  if (!b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface HandlerResultado { status: number; body: Record<string, unknown>; }

/**
 * Handler concreto da Edge (testável em node): valida o SEGREDO antes de QUALQUER leitura;
 * ausente/incorreto => 401. Só então roda o runner (que respeita o kill-switch observer).
 * Nunca loga o segredo. Não recebe service_role como Bearer — a autorização é o x-cron-secret.
 */
export async function tratarRequisicaoObserver(
  entrada: { segredoRecebido: string | null | undefined; segredoEsperado: string | null | undefined },
  deps: RunnerDeps,
  opts: RunnerOpts,
): Promise<HandlerResultado> {
  if (!compararSegredo(entrada.segredoRecebido, entrada.segredoEsperado)) {
    return { status: 401, body: { ok: false, erro: "nao_autorizado" } };
  }
  const res = await saraObserverRunner(deps, opts);
  return { status: 200, body: res as unknown as Record<string, unknown> };
}
