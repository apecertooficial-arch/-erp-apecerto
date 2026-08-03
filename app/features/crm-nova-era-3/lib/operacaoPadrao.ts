/** Contrato operacional único do CRM 3.0 — usado pela tela e pela Sara. */
export const ACOES_PADRAO = Object.freeze({
  RESPONDER_CLIENTE: { tipo: "retornar_contato", rotulo: "Responder o cliente", slaMin: 15 },
  QUALIFICAR_NECESSIDADE: { tipo: "entender_necessidade", rotulo: "Entender a necessidade", slaMin: 120 },
  QUALIFICAR_REGIAO: { tipo: "entender_necessidade", rotulo: "Confirmar região desejada", slaMin: 120 },
  QUALIFICAR_IMOVEL: { tipo: "entender_necessidade", rotulo: "Confirmar tipo de imóvel", slaMin: 120 },
  QUALIFICAR_ORCAMENTO: { tipo: "entender_necessidade", rotulo: "Confirmar faixa de valor", slaMin: 120 },
  QUALIFICAR_PRAZO: { tipo: "entender_necessidade", rotulo: "Confirmar prazo de compra", slaMin: 120 },
  ENVIAR_OPCOES: { tipo: "enviar_opcoes", rotulo: "Enviar opções de imóveis", slaMin: 240 },
  VALIDAR_OPCOES: { tipo: "confirmar_recebimento", rotulo: "Validar as opções enviadas", slaMin: 1440 },
  CONTORNAR_OBJECAO: { tipo: "retornar_contato", rotulo: "Tratar a objeção do cliente", slaMin: 240 },
  CONVIDAR_VISITA: { tipo: "agendar_visita", rotulo: "Convidar para uma visita", slaMin: 240 },
  CONFIRMAR_VISITA: { tipo: "agendar_visita", rotulo: "Confirmar a visita", slaMin: 120 },
  RETOMAR_COMBINADO: { tipo: "retornar_contato", rotulo: "Retomar no horário combinado", slaMin: 60 },
  LIGAR_CLIENTE: { tipo: "ligar_retorno", rotulo: "Ligar para o cliente", slaMin: 360 },
  ENCERRAR_SEM_RESPOSTA: { tipo: "avaliar_descarte", rotulo: "Encerrar a cadência sem resposta", slaMin: 360 },
  REVISAR_MANUALMENTE: { tipo: "outro", rotulo: "Revisar este atendimento", slaMin: 120 },
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

