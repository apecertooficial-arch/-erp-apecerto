/**
 * CRM Nova Era — CONTEXTO da Sara (Fase 3 correção final; puro/testável).
 * ------------------------------------------------------------------
 * Monta o TEXTO contextual e um context_hash ESTÁVEL a partir de linhas REAIS já
 * carregadas (negócio/lead/corretor/etapa/próxima ação/últimas mensagens WhatsApp
 * com direção+datas+transcrição/avaliações). NÃO inclui raw sensível desnecessário
 * (sem telefone, sem ids crus no texto). O hash inclui o negocio_id, então o mesmo
 * texto em negócios diferentes NÃO colide.
 */

export interface EntradaMensagem {
  id?: string | null;
  direcao?: string | null;   // 'enviada' | 'recebida' | ...
  tipo?: string | null;      // 'texto' | 'audio' | 'imagem' | ...
  conteudo?: string | null;
  transcricao?: string | null;
  enviadoEm?: string | null; // ISO
}
export interface EntradaAvaliacao { nota?: number | null; resumo?: string | null; criadoEm?: string | null; }

export interface EntradaContexto {
  negocioId: number;
  leadNome?: string | null;
  corretorNome?: string | null;
  etapaAtual?: string | null;
  proximaAcao?: string | null;
  ultimaInteracaoEm?: string | null;
  mensagens: EntradaMensagem[];
  avaliacoes?: EntradaAvaliacao[];
}

export interface Contexto {
  negocioId: number;
  etapaAtual: string | null;
  texto: string;
  hash: string;
  ultimaMensagemEm: string | null;
  visitaMencionada: boolean;
  propostaMencionada: boolean;
  clienteAguardando: boolean;
  promessaRetorno: boolean;
  /** Erro sanitizado ao ler avaliações (opcional): NÃO confundir com "sem avaliações". */
  avaliacoesErro?: string;
}

const MAX_MENSAGENS = 20;

/** Hash estável (djb2) → base36. Determinístico; muda quando o conteúdo relevante muda. */
export function contextHashEstavel(canonical: string): string {
  let h = 5381;
  for (let i = 0; i < canonical.length; i++) h = ((h << 5) + h + canonical.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function inbound(dir: string | null | undefined): boolean {
  return ["recebida", "entrada", "in", "inbound", "received"].includes(String(dir ?? "").toLowerCase());
}
function contem(texto: string, termos: string[]): boolean {
  const t = texto.toLowerCase();
  return termos.some((k) => t.includes(k));
}

export function montarContexto(e: EntradaContexto): Contexto {
  const msgs = [...(e.mensagens ?? [])]
    .filter((m) => (m.conteudo && m.conteudo.trim()) || (m.transcricao && m.transcricao.trim()))
    .sort((a, b) => Date.parse(a.enviadoEm ?? "") - Date.parse(b.enviadoEm ?? ""))
    .slice(-MAX_MENSAGENS);

  const linhas = msgs.map((m) => {
    const quem = inbound(m.direcao) ? "Cliente" : "Corretor";
    const corpo = (m.transcricao?.trim() ? `[áudio] ${m.transcricao.trim()}` : (m.conteudo ?? "").trim()).slice(0, 400);
    const quando = m.enviadoEm ? new Date(m.enviadoEm).toISOString() : "";
    return `- ${quem} (${m.tipo ?? "texto"}, ${quando}): ${corpo}`;
  });

  const corpoTudo = msgs.map((m) => `${m.conteudo ?? ""} ${m.transcricao ?? ""}`).join(" ");
  const visitaMencionada = contem(corpoTudo, ["visita", "visitar"]);
  const propostaMencionada = contem(corpoTudo, ["proposta", "proposta registrada"]);
  const promessaRetorno = contem(corpoTudo, ["retorno", "te retorno", "retornar", "amanhã falo", "depois falo"]);
  const ultimaMsg = msgs.length ? msgs[msgs.length - 1] : null;
  const clienteAguardando = !!ultimaMsg && inbound(ultimaMsg.direcao);
  const ultimaMensagemEm = ultimaMsg?.enviadoEm ? new Date(ultimaMsg.enviadoEm).toISOString() : null;

  const avals = (e.avaliacoes ?? []).slice(-5).map((a) => `- Avaliação${a.nota != null ? ` (nota ${a.nota})` : ""}: ${(a.resumo ?? "").slice(0, 200)}`);

  const texto = [
    `Lead: ${e.leadNome ?? "—"} · Corretor: ${e.corretorNome ?? "—"}`,
    `Etapa atual: ${e.etapaAtual ?? "—"} · Próxima ação: ${e.proximaAcao ?? "—"} · Última interação: ${e.ultimaInteracaoEm ?? "—"}`,
    "Últimas mensagens:",
    ...(linhas.length ? linhas : ["- (sem mensagens)"]),
    ...(avals.length ? ["Avaliações:", ...avals] : []),
  ].join("\n");

  // canonical inclui negocio_id (evita colisão entre negócios) + itens estáveis do contexto.
  const canonical = [
    `neg:${e.negocioId}`,
    `etapa:${e.etapaAtual ?? ""}`,
    `prox:${e.proximaAcao ?? ""}`,
    ...msgs.map((m) => `${m.id ?? ""}:${m.enviadoEm ?? ""}:${(m.transcricao ?? m.conteudo ?? "").slice(0, 200)}`),
  ].join("|");

  return {
    negocioId: e.negocioId,
    etapaAtual: e.etapaAtual ?? null,
    texto,
    hash: contextHashEstavel(canonical),
    ultimaMensagemEm,
    visitaMencionada,
    propostaMencionada,
    clienteAguardando,
    promessaRetorno,
  };
}

/* ---- Mapa da sugestão validada (saraSchema) para os campos da análise automática ---- */
export interface SugestaoValidada {
  etapa_sugerida: string | null;
  proxima_acao: string;
  prazo_sugerido: string | null;
  justificativa: string | null;
  confianca: number;
  evidencias: string[];
  possibilidade_visita: string | null;
  possibilidade_proposta: string | null;
  risco_abandono: string | null;
}

export interface AnaliseParaRegistro {
  etapaSugerida: string | null;
  proximaAcaoSugerida: string;
  prazoSugerido: string | null;
  justificativa: string;
  evidencias: string[];
  confianca: number;
  visitaMencionada: boolean;
  propostaMencionada: boolean;
  clienteAguardando: boolean;
  promessaRetorno: boolean;
}

/** Converte a sugestão validada + sinais do contexto em análise. SEM valores artificiais:
 *  a validação (saraSchema) já garantiu proxima_acao e confiança; justificativa vem da IA. */
export function mapearSugestaoParaAnalise(s: SugestaoValidada, ctx: Contexto): AnaliseParaRegistro | null {
  if (!s.justificativa || !s.justificativa.trim()) return null; // sem justificativa real => inválida (não inventar)
  return {
    etapaSugerida: s.etapa_sugerida,
    proximaAcaoSugerida: s.proxima_acao,
    prazoSugerido: s.prazo_sugerido,
    justificativa: s.justificativa.trim(),
    evidencias: s.evidencias ?? [],
    confianca: s.confianca,
    visitaMencionada: ctx.visitaMencionada || s.possibilidade_visita === "alta",
    propostaMencionada: ctx.propostaMencionada || s.possibilidade_proposta === "alta",
    clienteAguardando: ctx.clienteAguardando,
    promessaRetorno: ctx.promessaRetorno,
  };
}

/* ============================ Resumo seguro de avaliação ============================ */

function limparSensivel(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")           // e-mails
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[fone]")                // telefones
    .replace(/[A-Za-z0-9_-]{24,}/g, "[token]")                  // tokens longos
    .replace(/\s+/g, " ")
    .trim();
}
function coletarStrings(v: unknown, acc: string[], max: number): void {
  if (acc.length >= max) return;
  if (typeof v === "string") { const t = v.trim(); if (t) acc.push(t.slice(0, 120)); return; }
  if (typeof v === "number" || typeof v === "boolean") { acc.push(String(v)); return; }
  if (Array.isArray(v)) { for (const x of v) { if (acc.length >= max) break; coletarStrings(x, acc, max); } return; }
  if (v && typeof v === "object") { for (const k of Object.keys(v as Record<string, unknown>)) { if (acc.length >= max) break; coletarStrings((v as Record<string, unknown>)[k], acc, max); } }
}

/**
 * Extrai um resumo textual SEGURO de contexto/feedbacks (Json). Limite de tamanho,
 * sem raw sensível (e-mail/telefone/token). Retorna null quando ambos estão realmente
 * vazios (fallback só nesse caso; nunca inventa conteúdo).
 */
export function resumoAvaliacaoSeguro(contexto: unknown, feedbacks: unknown): string | null {
  const partes: string[] = [];
  coletarStrings(feedbacks, partes, 8);
  coletarStrings(contexto, partes, 8);
  const txt = limparSensivel(partes.join(" · ")).slice(0, 240);
  return txt || null;
}

/* ============================ Adaptador de contexto (Edge, testável) ============================ */

export interface RespostaQuery<T> { data: T | null; error: unknown | null; }
export interface LinhaEstado { etapa?: string | null; proxima_acao_titulo?: string | null; ultima_interacao_em?: string | null; lead_id?: number | null; lead_nome?: string | null; corretor_nome?: string | null; }
export interface LinhaAvaliacao { nota?: number | null; contexto?: unknown; feedbacks?: unknown; criado_em?: string | null; }

/** Consultas concretas injetadas (mapeiam as tabelas REAIS; cada uma devolve {data,error}). */
export interface CtxQueries {
  estado(negocioId: number): Promise<RespostaQuery<LinhaEstado>>;
  contatos(leadId: number): Promise<RespostaQuery<{ id: string }[]>>;
  conversas(contatoIds: string[]): Promise<RespostaQuery<{ id: string }[]>>;
  mensagens(conversaIds: string[]): Promise<RespostaQuery<EntradaMensagem[]>>;
  avaliacoes(leadId: number): Promise<RespostaQuery<LinhaAvaliacao[]>>;
}

/**
 * Carrega o contexto FAIL-CLOSED a partir das consultas reais:
 *  - erro em consulta ESSENCIAL (estado/contatos/conversas/mensagens) => LANÇA (runner => "erro");
 *    nunca chama IA com "sem mensagens" quando houve erro de banco.
 *  - "sem mensagens" só quando a consulta teve sucesso e retornou zero.
 *  - sem estado (query ok, ausente) => retorna null (runner => "sem_contexto").
 *  - avaliações são OPCIONAIS: erro é registrado sanitizado (avaliacoesErro), NÃO confundido com vazio.
 */
export async function carregarContextoAdaptador(negocioId: number, q: CtxQueries): Promise<Contexto | null> {
  const est = await q.estado(negocioId);
  if (est.error) throw new Error("erro_estado");
  if (!est.data) return null; // sem_contexto (query ok, sem estado)

  const leadId = est.data.lead_id ?? null;
  let mensagens: EntradaMensagem[] = [];
  if (leadId != null) {
    const ct = await q.contatos(leadId);
    if (ct.error) throw new Error("erro_contatos");
    const cids = (ct.data ?? []).map((c) => c.id);
    if (cids.length) {
      const cv = await q.conversas(cids);
      if (cv.error) throw new Error("erro_conversas");
      const convIds = (cv.data ?? []).map((c) => c.id);
      if (convIds.length) {
        const ms = await q.mensagens(convIds);
        if (ms.error) throw new Error("erro_mensagens");
        mensagens = ms.data ?? []; // zero legítimo permanece []
      }
    }
  }

  let avaliacoes: EntradaAvaliacao[] = [];
  let avaliacoesErro: string | undefined;
  if (leadId != null) {
    const av = await q.avaliacoes(leadId);
    if (av.error) { avaliacoesErro = "erro_avaliacoes"; }                 // sanitizado, não é "vazio"
    else avaliacoes = (av.data ?? []).map((a) => ({ nota: a.nota ?? null, resumo: resumoAvaliacaoSeguro(a.contexto, a.feedbacks), criadoEm: a.criado_em ?? null }));
  }

  const ctx = montarContexto({
    negocioId, leadNome: est.data.lead_nome ?? null, corretorNome: est.data.corretor_nome ?? null,
    etapaAtual: est.data.etapa ?? null, proximaAcao: est.data.proxima_acao_titulo ?? null,
    ultimaInteracaoEm: est.data.ultima_interacao_em ?? null, mensagens, avaliacoes,
  });
  if (avaliacoesErro) ctx.avaliacoesErro = avaliacoesErro;
  return ctx;
}
