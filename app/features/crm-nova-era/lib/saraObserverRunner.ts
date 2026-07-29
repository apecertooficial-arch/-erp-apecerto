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
  lerContexto(negocioId: number): Promise<Contexto>;
  jaAnalisado(hash: string): Promise<boolean>;
  chamarIaRouter(input: { negocioId: number; texto: string }): Promise<unknown>;
  validar(raw: unknown, ctx: Contexto): { ok: boolean; analise?: Record<string, unknown> };
  registrar(negocioId: number, hash: string, analise: Record<string, unknown>): Promise<{ ok: boolean; ja?: boolean }>;
  log?: (msg: string) => void;
}

export interface RunnerOpts { lote: number; timeoutMs: number; maxRetries: number; }

export type ItemStatus = "analisado" | "pulado" | "invalido" | "erro";

export interface RunnerResultado {
  executou: boolean;
  modo: SaraModoRunner;
  processados: number;
  analisados: number;
  pulados_ja_analisado: number;
  invalidos: number;
  erros: number;
  detalhes: Array<{ negocioId: number; status: ItemStatus; erro?: string }>;
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
  const modo = await deps.getModo();
  const base: RunnerResultado = { executou: false, modo, processados: 0, analisados: 0, pulados_ja_analisado: 0, invalidos: 0, erros: 0, detalhes: [] };

  // KILL-SWITCH / gate: processa SOMENTE em observer. off/suggest/execute não rodam o runner.
  if (modo !== "observer") { deps.log?.(`runner ignorado: modo=${modo}`); return base; }
  base.executou = true;

  const lote = Math.max(0, Math.min(opts.lote, 500));
  const elegiveis = await deps.listarElegiveis(lote);

  for (const el of elegiveis) {
    base.processados++;
    try {
      const ctx = await deps.lerContexto(el.negocioId);
      if (await deps.jaAnalisado(ctx.hash)) { base.pulados_ja_analisado++; base.detalhes.push({ negocioId: el.negocioId, status: "pulado" }); continue; }
      const raw = await comTimeoutRetry(() => deps.chamarIaRouter({ negocioId: el.negocioId, texto: ctx.texto }), opts.timeoutMs, opts.maxRetries);
      const v = deps.validar(raw, ctx);
      if (!v.ok || !v.analise) { base.invalidos++; base.detalhes.push({ negocioId: el.negocioId, status: "invalido", erro: "resposta_invalida" }); continue; }
      const r = await deps.registrar(el.negocioId, ctx.hash, v.analise);
      if (r.ja) { base.pulados_ja_analisado++; base.detalhes.push({ negocioId: el.negocioId, status: "pulado" }); }
      else if (r.ok) { base.analisados++; base.detalhes.push({ negocioId: el.negocioId, status: "analisado" }); }
      else { base.erros++; base.detalhes.push({ negocioId: el.negocioId, status: "erro", erro: "registro_recusado" }); }
    } catch (e) {
      // FALHA ISOLADA POR NEGÓCIO: nunca interrompe o lote; erro sanitizado.
      base.erros++;
      base.detalhes.push({ negocioId: el.negocioId, status: "erro", erro: sanitizarErro(e) });
    }
  }
  return base;
}
