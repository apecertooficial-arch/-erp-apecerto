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
