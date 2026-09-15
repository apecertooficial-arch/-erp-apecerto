const DIRECOES_CLIENTE = new Set(["recebida", "entrada", "in", "inbound", "received"]);
const DIRECOES_CORRETOR = new Set(["enviada", "saida", "out", "outbound", "sent"]);

// Estes momentos representam fatos operacionais. A conversa pode indicar uma
// intencao, mas somente o evento correspondente do CRM confirma o fato.
export const MOMENTOS_FACTUAIS = new Set([
  "PRIMEIRA_ABORDAGEM",
  "CADENCIA_CONTATO",
  "CADENCIA_SEM_RESPOSTA",
  "CADENCIA_PESCADO",
  "VISITA_AGENDADA",
  "VISITA_REALIZADA",
  "VISITA_CANCELADA",
  "COLETAR_FEEDBACK",
  "REMARCAR_VISITA",
  "ACOMPANHAMENTO_POS_VISITA",
]);

const ETAPAS_PROTEGIDAS = new Set([
  "visita",
  "pos_visita",
  "pescado",
  "legado",
  "atualizar_manual",
]);

const INTENCOES_FORTES = new Set([
  "TENTANDO_AGENDAMENTO",
  "RETORNO_PROGRAMADO",
  "RETOMAR_NA_DATA",
]);

export function direcaoCliente(valor) {
  return DIRECOES_CLIENTE.has(String(valor ?? "").toLowerCase());
}

export function direcaoCorretor(valor) {
  return DIRECOES_CORRETOR.has(String(valor ?? "").toLowerCase());
}

export function fatosDaConversa(mensagens) {
  const recebidas = mensagens.filter((mensagem) => direcaoCliente(mensagem?.direcao));
  const enviadas = mensagens.filter((mensagem) => direcaoCorretor(mensagem?.direcao));
  const ultima = mensagens.at(-1) ?? null;
  return {
    clienteRespondeu: recebidas.length > 0,
    corretorEnviou: enviadas.length > 0,
    recebidas: recebidas.length,
    enviadas: enviadas.length,
    ultimaDirecao: direcaoCliente(ultima?.direcao)
      ? "cliente"
      : direcaoCorretor(ultima?.direcao) ? "corretor" : "desconhecida",
  };
}

export function saidaNovaSemRespostaDesdeAnalise(mensagens, eventType) {
  if (eventType !== "conversation.message_sent") return false;
  const fatos = fatosDaConversa(mensagens);
  return fatos.corretorEnviou && fatos.ultimaDirecao === "corretor";
}

export function normalizarPrazoSugerido(valor, agora = Date.now()) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const texto = valor.trim();
  const absoluto = Date.parse(texto);
  if (!Number.isNaN(absoluto)) return new Date(absoluto).toISOString();
  const relativo = texto.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/^em\s+/, "").match(
      /^(\d{1,4})\s*(min|minuto|minutos|h|hora|horas|d|dia|dias)$/,
    );
  if (!relativo) return null;
  const quantidade = Number(relativo[1]);
  const unidade = relativo[2];
  const multiplicador = unidade.startsWith("min") ? 60_000
    : unidade === "h" || unidade.startsWith("hora") ? 3_600_000
    : 86_400_000;
  const duracao = quantidade * multiplicador;
  if (!Number.isFinite(duracao) || duracao <= 0 || duracao > 30 * 86_400_000) return null;
  return new Date(agora + duracao).toISOString();
}

export function deveAplicarCadenciaSemResposta(candidato, fatos) {
  return !fatos.clienteRespondeu
    && fatos.corretorEnviou
    && ["novo", "tentando_contato"].includes(candidato.etapa);
}

export function filtrarCatalogoParaIa(candidato, catalogo, fatos) {
  if (!fatos.clienteRespondeu) {
    const codigo = deveAplicarCadenciaSemResposta(candidato, fatos)
      ? "CADENCIA_SEM_RESPOSTA"
      : candidato.momento_codigo;
    return catalogo.filter((momento) => momento.codigo === codigo);
  }
  if (ETAPAS_PROTEGIDAS.has(candidato.etapa)) {
    return catalogo.filter((momento) => momento.codigo === candidato.momento_codigo);
  }
  return catalogo.filter((momento) =>
    momento.etapa === "em_atendimento" && !MOMENTOS_FACTUAIS.has(momento.codigo)
  );
}

export function validarSugestaoAutomatica({
  candidato,
  momento,
  fatos,
  confianca,
  evidencias,
  prazoSugerido,
}) {
  if (!momento) return { ok: false, motivo: "momento_fora_do_catalogo" };
  if (!fatos.clienteRespondeu) {
    if (momento.codigo === candidato.momento_codigo) {
      return { ok: true, motivo: "estado_posterior_preservado" };
    }
    return deveAplicarCadenciaSemResposta(candidato, fatos)
      && momento.codigo === "CADENCIA_SEM_RESPOSTA"
      ? { ok: true, motivo: "fato_sem_resposta" }
      : { ok: false, motivo: "cliente_sem_resposta" };
  }
  if (!Array.isArray(evidencias) || evidencias.length === 0) {
    return { ok: false, motivo: "intencao_sem_evidencia_cliente" };
  }
  if (ETAPAS_PROTEGIDAS.has(candidato.etapa)) {
    return momento.codigo === candidato.momento_codigo
      ? { ok: true, motivo: "etapa_protegida_mantida" }
      : { ok: false, motivo: "etapa_operacional_protegida" };
  }
  if (MOMENTOS_FACTUAIS.has(momento.codigo)) {
    return { ok: false, motivo: "momento_exige_evento_operacional" };
  }
  if (momento.etapa !== "em_atendimento") {
    return { ok: false, motivo: "salto_de_etapa_nao_permitido" };
  }
  const minimo = INTENCOES_FORTES.has(momento.codigo)
    ? 0.9
    : candidato.etapa === "em_atendimento" ? 0.8 : 0.85;
  if (!Number.isFinite(confianca) || confianca < minimo) {
    return { ok: false, motivo: "confianca_insuficiente_para_transicao" };
  }
  if (["RETORNO_PROGRAMADO", "RETOMAR_NA_DATA"].includes(momento.codigo)
      && (!prazoSugerido || Number.isNaN(Date.parse(prazoSugerido)))) {
    return { ok: false, motivo: "retorno_sem_data_comprovada" };
  }
  return { ok: true, motivo: "intencao_semantica_permitida" };
}
