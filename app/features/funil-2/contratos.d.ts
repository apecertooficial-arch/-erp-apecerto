export type AtividadeCombinada = {
  id: string;
  funil_lead_id: string;
  tipo: "tarefa" | "visita";
  titulo: string;
  data_em: string | null;
  status: string;
  prioridade?: string | null;
  responsavel?: string | null;
  prazo_em?: string | null;
  inicio_em?: string | null;
  imovel?: string | null;
};

export function statusHttpFunil(chave: unknown): number;
export function decisaoConflitoHumano(chave: unknown): {
  repetirAutomaticamente: false;
  recarregarAntesDeRepetir: boolean;
};
export function validarMovimentoSeguro(ids: string[]):
  | { ok: true; id: string }
  | { ok: false; motivo: "selecao_vazia" | "lote_sem_contrato_atomico" };
export function combinarAtividades(
  tarefas: Array<Record<string, unknown> & { id: string; funil_lead_id: string; titulo?: string; prazo_em?: string | null; status: string }>,
  visitas: Array<Record<string, unknown> & { id: string; funil_lead_id: string; imovel?: string | null; inicio_em?: string | null; status: string }>,
): AtividadeCombinada[];
