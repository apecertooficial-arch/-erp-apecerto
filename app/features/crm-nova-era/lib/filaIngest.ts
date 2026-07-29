/**
 * Regras PURAS do ciclo de vida da fila de entrada de conversas (Fase 6.1).
 * Espelham exatamente a classificação feita no banco, para poderem ser testadas
 * isoladamente e para a tela nunca somar noop como erro.
 */

export type SituacaoFila =
  | "processavel"            // tem negócio e ainda precisa ser processado
  | "aguardando_negocio"     // o negócio ainda não existe; espera limitada
  | "falha_tecnica"          // erro de verdade, continua visível como erro
  | "fora_do_piloto"         // negócio existe, mas nunca entrou no CRM Nova Era
  | "sem_negocio_expirado"   // a janela acabou e o negócio nunca apareceu
  | "encerrado_outro"        // encerrado por outro motivo legítimo
  | "processado";

export type ItemFila = {
  status: string;
  temNegocio: boolean;
  finalizado: boolean;
  idadeMin: number;
  tentativas: number;
};

export type ConfigFila = {
  janelaSemNegocioMin: number;
  janelaForaEscopoMin: number;
  maxTentativas: number;
  backoffBaseSeg: number;
  backoffMaxSeg: number;
};

export const CONFIG_PADRAO: ConfigFila = {
  janelaSemNegocioMin: 30,
  janelaForaEscopoMin: 30,
  maxTentativas: 8,
  backoffBaseSeg: 60,
  backoffMaxSeg: 1800,
};

/** Situação de um item já gravado. Nunca mistura noop com erro. */
export function situacaoDoItem(item: ItemFila): SituacaoFila {
  if (item.status === "processado") return "processado";
  if (item.status === "erro") return "falha_tecnica";
  if (item.status === "noop_fora_do_escopo") return "fora_do_piloto";
  if (item.status === "noop_sem_negocio_expirado") return "sem_negocio_expirado";
  if (item.status === "noop") return "encerrado_outro";
  return item.temNegocio ? "processavel" : "aguardando_negocio";
}

/** true apenas para falha técnica. noop de qualquer tipo é excluído do indicador de erro. */
export function contaComoErro(status: string): boolean {
  return status === "erro";
}

/** true quando o item ainda exige processamento ou atenção operacional. */
export function exigeAtencao(item: ItemFila): boolean {
  if (item.finalizado) return false;
  return item.status === "pendente" || item.status === "erro";
}

/**
 * Decisão de classificação, idêntica à do banco.
 * Devolve o próximo status quando o item NÃO pode ser processado agora.
 */
export function classificarPendente(item: ItemFila, cfg: ConfigFila = CONFIG_PADRAO): SituacaoFila {
  const esgotou = item.tentativas + 1 >= cfg.maxTentativas;
  if (!item.temNegocio) {
    return item.idadeMin < cfg.janelaSemNegocioMin && !esgotou ? "aguardando_negocio" : "sem_negocio_expirado";
  }
  return item.idadeMin < cfg.janelaForaEscopoMin && !esgotou ? "processavel" : "fora_do_piloto";
}

/** Backoff exponencial com teto, em segundos. Determinístico. */
export function backoffSegundos(tentativas: number, cfg: ConfigFila = CONFIG_PADRAO): number {
  const expoente = Math.min(Math.max(tentativas, 0), 12);
  return Math.min(cfg.backoffBaseSeg * 2 ** expoente, cfg.backoffMaxSeg);
}

/** Total que realmente exige ação humana ou reprocessamento. */
export function totalEmAberto(resumo: Record<string, unknown>): number {
  const n = (k: string) => (typeof resumo[k] === "number" ? (resumo[k] as number) : 0);
  return n("processaveis") + n("aguardando_negocio") + n("falhas_tecnicas");
}
