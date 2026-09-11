export const STATUS_RESULTADO_VISITA = ["realizada", "cancelada", "nao_compareceu"] as const;

export type StatusResultadoVisita = (typeof STATUS_RESULTADO_VISITA)[number];

export const ROTULO_STATUS_RESULTADO: Record<StatusResultadoVisita, string> = {
  realizada: "Visita realizada",
  cancelada: "Visita cancelada",
  nao_compareceu: "Cliente não compareceu",
};

export const RESULTADOS_VISITA: Record<StatusResultadoVisita, ReadonlyArray<{ codigo: string; rotulo: string }>> = {
  realizada: [
    { codigo: "fara_proposta", rotulo: "Vai receber proposta" },
    { codigo: "interessado", rotulo: "Gostou e seguirá em atendimento" },
    { codigo: "quer_outra_opcao", rotulo: "Quer conhecer outra opção" },
    { codigo: "precisa_conversar", rotulo: "Precisa conversar ou pensar" },
    { codigo: "nao_gostou", rotulo: "Não gostou do imóvel" },
  ],
  cancelada: [
    { codigo: "remarcar", rotulo: "Será remarcada" },
    { codigo: "cliente_cancelou", rotulo: "Cliente cancelou" },
    { codigo: "corretor_cancelou", rotulo: "Corretor cancelou" },
    { codigo: "produto_indisponivel", rotulo: "Imóvel ficou indisponível" },
    { codigo: "conflito_agenda", rotulo: "Conflito de agenda" },
    { codigo: "sem_confirmacao", rotulo: "Cliente não confirmou" },
    { codigo: "outro", rotulo: "Outro motivo" },
  ],
  nao_compareceu: [
    { codigo: "nao_compareceu", rotulo: "Cliente não compareceu" },
  ],
};

export const MIN_JUSTIFICATIVA_VISITA = 10;

export function resultadoPermitido(status: string, codigo: string) {
  if (!STATUS_RESULTADO_VISITA.includes(status as StatusResultadoVisita)) return false;
  return RESULTADOS_VISITA[status as StatusResultadoVisita].some((item) => item.codigo === codigo);
}

export function validarResultadoVisita(status: string, codigo: string, justificativa: string) {
  if (!resultadoPermitido(status, codigo)) return "Escolha o resultado da visita.";
  if (justificativa.trim().length < MIN_JUSTIFICATIVA_VISITA) {
    return `Explique o que aconteceu em pelo menos ${MIN_JUSTIFICATIVA_VISITA} caracteres.`;
  }
  return null;
}
