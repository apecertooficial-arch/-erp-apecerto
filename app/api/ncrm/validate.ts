/**
 * Validação de payloads do CRM Nova Era (API). PURA e testável.
 * O banco continua sendo a autorização final (RLS + RPC fail-closed); isto é a
 * primeira barreira: rejeita entradas malformadas ANTES de chamar a RPC.
 */
export type ValOk<T> = { ok: true; value: T };
export type ValErr = { ok: false; erro: string };
export type Val<T> = ValOk<T> | ValErr;

const CANAIS = new Set(["ligacao", "whatsapp", "email", "presencial"]);
const RESULT_TENTATIVA = new Set(["nao_respondeu", "respondeu", "telefone_invalido", "pediu_retorno", "sem_interesse", "contato_inadequado"]);
const PROX_TIPOS = new Set([
  "tentativa_cadencia", "retornar_contato", "entender_necessidade", "enviar_opcoes", "confirmar_recebimento",
  "ligar_retorno", "solicitar_documentacao", "agendar_visita", "preparar_proposta", "corrigir_cadastro", "avaliar_descarte", "outro",
]);
const MOTIVOS_DESCARTE = new Set([
  "sem_interesse", "sem_perfil_financeiro", "numero_invalido", "ja_comprou_concorrente", "duplicado", "outro",
  // ampliados na migration 20260808110000 — mesma whitelist do banco
  "sem_resposta", "fora_da_regiao", "desistiu", "nao_quer_contato", "produto_incompativel",
]);
const RESULT_VISITA = new Set([
  "interessado", "quer_outra_opcao", "precisa_conversar", "nao_gostou",
  "nao_compareceu", "remarcar", "fara_proposta",
]);
const STATUS_PROPOSTA = new Set(["em_negociacao", "aceita", "recusada", "expirada", "cancelada"]);
const ETAPAS = new Set(["novo", "tentando_contato", "em_atendimento", "em_acompanhamento"]);
const MOMENTOS_OPERACIONAIS = new Set([
  "PRIMEIRA_ABORDAGEM", "CADENCIA_SEM_RESPOSTA", "CONVERSANDO_QUALIFICANDO",
  "BUSCANDO_PRODUTO", "PRODUTO_ENVIADO", "TENTANDO_AGENDAMENTO",
  "VISITA_AGENDADA", "RETORNO_PROGRAMADO", "FEEDBACK_POS_VISITA", "DECISAO_POS_VISITA",
]);
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function inteiroPositivo(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 && n <= MAX_SAFE ? n : null;
}
export function inteiroNaoNeg(v: unknown, max = MAX_SAFE): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}
export function textoLimitado(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length === 0 ? null : s.slice(0, max);
}
export function dataValidaISO(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
export function uuidValido(v: unknown): string | null {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

export function validarQuery(params: URLSearchParams): Val<{ scope: string; limit: number; offset: number }> {
  const scope = params.get("scope") ?? "board";
  if (!["board", "saidas", "all"].includes(scope)) return { ok: false, erro: "scope inválido" };
  const limRaw = Number(params.get("limit") ?? "60");
  const limit = Number.isFinite(limRaw) ? Math.min(200, Math.max(1, Math.trunc(limRaw))) : 60; // clampa (não rejeita)
  const offset = inteiroNaoNeg(params.get("offset") ?? "0", MAX_SAFE);
  if (offset === null) return { ok: false, erro: "offset inválido" };
  return { ok: true, value: { scope, limit, offset } };
}

/** Valida o corpo do PATCH conforme a ação. Rejeita campos incompatíveis com cada ação. */
export function validarAcao(body: Record<string, unknown>): Val<{ action: string; args: Record<string, unknown> }> {
  const action = String(body.action ?? "");
  const negocioId = inteiroPositivo(body.negocioId);
  const versao = inteiroNaoNeg(body.versao);
  const obs = body.obs === undefined || body.obs === null ? null : textoLimitado(body.obs, 2000);
  if (obs === null && body.obs !== undefined && body.obs !== null) return { ok: false, erro: "observação inválida ou muito longa" };

  const precisaAlvo = () => (negocioId === null ? "negócio inválido" : versao === null ? "versão inválida" : null);
  const proxOpcional = (): { erro: string } | { tipo: string | null; em: string | null; titulo: string | null } => {
    const tipo = body.proximaTipo == null ? null : String(body.proximaTipo);
    if (tipo !== null && !PROX_TIPOS.has(tipo)) return { erro: "próxima ação inválida" };
    const em = body.proximaEm == null ? null : dataValidaISO(body.proximaEm);
    if (body.proximaEm != null && em === null) return { erro: "prazo inválido" };
    const titulo = body.proximaTitulo == null ? null : textoLimitado(body.proximaTitulo, 200);
    return { tipo, em, titulo };
  };

  switch (action) {
    case "registrarTentativa": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      if (!CANAIS.has(String(body.canal))) return { ok: false, erro: "canal inválido" };
      if (!RESULT_TENTATIVA.has(String(body.resultado))) return { ok: false, erro: "resultado inválido" };
      const p = proxOpcional(); if ("erro" in p) return { ok: false, erro: p.erro };
      return { ok: true, value: { action, args: { negocioId, versao, canal: body.canal, resultado: body.resultado, obs, proximaTipo: p.tipo, proximaTitulo: p.titulo, proximaEm: p.em } } };
    }
    case "concluirAcao": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const resultado = textoLimitado(body.resultado, 60); if (!resultado) return { ok: false, erro: "resultado obrigatório" };
      const tipo = String(body.proximaTipo ?? "");
      if (!PROX_TIPOS.has(tipo) || tipo === "tentativa_cadencia") return { ok: false, erro: "próxima ação comercial inválida" };
      const em = dataValidaISO(body.proximaEm); if (!em) return { ok: false, erro: "prazo inválido" };
      const titulo = textoLimitado(body.proximaTitulo, 200) ?? tipo.replace(/_/g, " ");
      return { ok: true, value: { action, args: { negocioId, versao, resultado, obs, proximaTipo: tipo, proximaTitulo: titulo, proximaEm: em } } };
    }
    case "atualizarMomento": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const momentoCodigo = String(body.momentoCodigo ?? "");
      if (!MOMENTOS_OPERACIONAIS.has(momentoCodigo)) return { ok: false, erro: "momento inválido" };
      return { ok: true, value: { action, args: { negocioId, versao, momentoCodigo, obs } } };
    }
    case "saidaVisita": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const visitaId = uuidValido(body.visitaId); if (!visitaId) return { ok: false, erro: "id de visita inválido" };
      return { ok: true, value: { action, args: { negocioId, versao, visitaId } } };
    }
    case "registrarResultadoVisita": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const visitaId = uuidValido(body.visitaId); if (!visitaId) return { ok: false, erro: "id de visita inválido" };
      if (!RESULT_VISITA.has(String(body.resultado))) return { ok: false, erro: "resultado de visita inválido" };
      return { ok: true, value: { action, args: { negocioId, versao, visitaId, resultado: body.resultado, obs } } };
    }
    case "saidaProposta": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const valor = typeof body.valor === "number" ? body.valor : Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0 || valor > 1e12) return { ok: false, erro: "valor da proposta inválido" };
      const empreendimentoId = body.empreendimentoId == null ? null : uuidValido(body.empreendimentoId);
      if (body.empreendimentoId != null && empreendimentoId === null) return { ok: false, erro: "empreendimento inválido" };
      const unidadeId = body.unidadeId == null ? null : uuidValido(body.unidadeId);
      if (body.unidadeId != null && unidadeId === null) return { ok: false, erro: "unidade inválida" };
      const data = body.data == null ? new Date().toISOString() : dataValidaISO(body.data);
      if (data === null) return { ok: false, erro: "data da proposta inválida" };
      return { ok: true, value: { action, args: { negocioId, versao, valor, empreendimentoId, unidadeId, data, obs } } };
    }
    case "saidaDescarte": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      if (!MOTIVOS_DESCARTE.has(String(body.motivo))) return { ok: false, erro: "motivo de descarte inválido" };
      const detalhe = body.detalhe == null ? null : textoLimitado(body.detalhe, 500);
      if (String(body.motivo) === "outro" && !detalhe) return { ok: false, erro: "detalhe obrigatório para 'outro'" };
      return { ok: true, value: { action, args: { negocioId, versao, motivo: body.motivo, detalhe } } };
    }
    case "saidaNutricao": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      return { ok: true, value: { action, args: { negocioId, versao, motivo: textoLimitado(body.motivo, 300) } } };
    }
    case "reativar": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const motivo = textoLimitado(body.motivo, 300); if (!motivo) return { ok: false, erro: "motivo obrigatório" };
      if (!ETAPAS.has(String(body.etapa))) return { ok: false, erro: "etapa inválida" };
      const tipo = String(body.proximaTipo ?? ""); if (!PROX_TIPOS.has(tipo)) return { ok: false, erro: "próxima ação inválida" };
      const em = dataValidaISO(body.proximaEm); if (!em) return { ok: false, erro: "prazo inválido" };
      const titulo = textoLimitado(body.proximaTitulo, 200) ?? tipo.replace(/_/g, " ");
      return { ok: true, value: { action, args: { negocioId, versao, motivo, etapa: body.etapa, proximaTipo: tipo, proximaTitulo: titulo, proximaEm: em } } };
    }
    case "registrarPropostaEsteira": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const produtoId = uuidValido(body.produtoId); if (!produtoId) return { ok: false, erro: "produto inválido" };
      const valor = typeof body.valor === "number" ? body.valor : Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0 || valor > 1e12) return { ok: false, erro: "valor da proposta inválido" };
      const forma = body.forma == null ? null : textoLimitado(body.forma, 60);
      return { ok: true, value: { action, args: { negocioId, versao, produtoId, valor, forma, obs } } };
    }
    case "agendarVisita": {
      const e = precisaAlvo(); if (e) return { ok: false, erro: e };
      const leadId = inteiroPositivo(body.leadId); if (leadId === null) return { ok: false, erro: "lead inválido" };
      if (typeof body.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.data) || Number.isNaN(Date.parse(body.data))) return { ok: false, erro: "data inválida" };
      if (typeof body.horaInicio !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(body.horaInicio)) return { ok: false, erro: "hora inválida" };
      const empreendimentoId = body.empreendimentoId == null ? null : uuidValido(body.empreendimentoId);
      if (body.empreendimentoId != null && empreendimentoId === null) return { ok: false, erro: "empreendimento inválido" };
      const produto = body.produto == null ? null : textoLimitado(body.produto, 180);
      const comGerente = body.comGerente === true;
      const gerenteId = body.gerenteId == null ? null : inteiroPositivo(body.gerenteId);
      return { ok: true, value: { action, args: { negocioId, versao, leadId, data: body.data, horaInicio: body.horaInicio, empreendimentoId, produto, comGerente, gerenteId } } };
    }
    case "propostaTransicao": {
      const propostaId = uuidValido(body.propostaId); if (!propostaId) return { ok: false, erro: "proposta inválida" };
      const versaoProp = inteiroNaoNeg(body.versaoProp); if (versaoProp === null) return { ok: false, erro: "versão da proposta inválida" };
      if (!STATUS_PROPOSTA.has(String(body.novoStatus))) return { ok: false, erro: "status inválido" };
      const motivo = body.motivo == null ? null : textoLimitado(body.motivo, 300);
      return { ok: true, value: { action, args: { propostaId, versaoProp, novoStatus: body.novoStatus, motivo } } };
    }
    default:
      return { ok: false, erro: "ação desconhecida" };
  }
}
