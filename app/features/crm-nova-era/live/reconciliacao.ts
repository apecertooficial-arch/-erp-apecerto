/**
 * Reconciliação da SAÍDA por visita (fluxo de 2 passos). PURO e testável.
 * Cenário crítico: a visita REAL foi criada, mas ncrm_saida_visita falhou depois.
 * Regra: NUNCA apagar a visita válida; manter "encaminhamento pendente" com retry
 * idempotente (mesmo visita_id). Se a CRIAÇÃO falhou, o lead permanece no funil.
 */
export type EstadoVisita =
  | { status: "falha_criacao"; mensagem: string } // visita não criada → lead permanece
  | { status: "encaminhado" }                      // criada + encaminhada com sucesso
  | { status: "pendente"; visitaId: string; mensagem: string }; // criada, encaminhamento pendente (retry)

export function proximoEstadoVisita(
  criacao: { ok: boolean; visitaId: string | null; erro?: string | null },
  encaminhamentoOk: boolean | null, // null = ainda não tentou
): EstadoVisita {
  if (!criacao.ok || !criacao.visitaId) {
    return { status: "falha_criacao", mensagem: criacao.erro || "Falha ao criar a visita — o lead foi mantido no funil." };
  }
  if (encaminhamentoOk === true) return { status: "encaminhado" };
  // criada, mas encaminhamento falhou ou ainda não confirmado → pendente reconciliável
  return {
    status: "pendente",
    visitaId: criacao.visitaId,
    mensagem: "Visita criada, mas o encaminhamento ao Pipe de Visitas ficou pendente. Repita com segurança.",
  };
}
