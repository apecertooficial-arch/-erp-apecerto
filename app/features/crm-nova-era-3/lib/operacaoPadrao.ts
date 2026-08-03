/** Contrato operacional único do CRM 3.0 — usado pela tela e pela Sara. */
export const ACOES_PADRAO = Object.freeze({
  PRIMEIRA_ABORDAGEM: { tipo: "retornar_contato", rotulo: "Fazer a primeira abordagem", slaMin: 5 },
  ENVIAR_CADENCIA: { tipo: "tentativa_cadencia", rotulo: "Enviar a mensagem da cadência", slaMin: 360 },
  RESPONDER_E_QUALIFICAR: { tipo: "entender_necessidade", rotulo: "Responder e qualificar", slaMin: 1440 },
  BUSCAR_E_ENVIAR_IMOVEIS: { tipo: "enviar_opcoes", rotulo: "Buscar e enviar imóveis", slaMin: 1440 },
  PEDIR_RETORNO_PRODUTO: { tipo: "confirmar_recebimento", rotulo: "Pedir retorno sobre as opções", slaMin: 1440 },
  AGENDAR_VISITA: { tipo: "agendar_visita", rotulo: "Agendar uma visita", slaMin: 720 },
  CONFIRMAR_VISITA: { tipo: "agendar_visita", rotulo: "Confirmar a visita", slaMin: 1440 },
  RETOMAR_NO_COMBINADO: { tipo: "retornar_contato", rotulo: "Retomar no horário combinado", slaMin: 7200 },
  REGISTRAR_RESULTADO_VISITA: { tipo: "outro", rotulo: "Registrar o resultado da visita", slaMin: 120 },
  AVANCAR_POS_VISITA: { tipo: "outro", rotulo: "Definir o avanço pós-visita", slaMin: 1440 },
} as const);

export type CodigoAcaoPadrao = keyof typeof ACOES_PADRAO;

export function codigoAcaoValido(v: unknown): v is CodigoAcaoPadrao {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ACOES_PADRAO, v);
}

export function politicaSara(confiancaPct: number, evidenciaSuficiente: boolean, evidencias: string[]) {
  if (!evidenciaSuficiente || evidencias.length === 0 || confiancaPct < 70) {
    return { nivel: "revisao" as const, podeUsar: false, texto: "Revisão humana necessária" };
  }
  if (confiancaPct < 90) {
    return { nivel: "sugestao" as const, podeUsar: true, texto: "Sugestão da Sara — confirme antes de usar" };
  }
  return { nivel: "forte" as const, podeUsar: true, texto: "Orientação sustentada pela conversa" };
}
