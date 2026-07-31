/* Regras do "Seu dia", separadas do componente para poderem ser testadas sem
   navegador. Nada aqui busca dado: recebe o que a fila e as tarefas devolveram
   e decide o que aparece. */

export type ItemFila = {
  negocio_id: number;
  lead_nome: string | null;
  motivo: string;
  espera_min: number;
  prioridade: number;
  respondeu: boolean;
  proxima_acao_titulo: string | null;
  proxima_acao_em: string | null;
};

export type Tarefa = { id: string | number; titulo?: string | null; vencimento?: string | null; concluida?: boolean | null };

/** Motivos exatos que o banco devolve. Se mudarem la, o grupo esvazia e
    aparece o estado vazio -- nunca um numero errado. */
const MOTIVO_RESPONDEU = "Cliente respondeu — aguardando você";
const MOTIVO_LEAD_NOVO = "Lead novo sem primeira atuação";

const MAX_VISIVEL = 3; // "no maximo tres itens urgentes de cada grupo"

export function tempoHumano(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 1) return "agora";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = minutos / 60;
  if (horas < 24) return `${Math.round(horas)}h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas % 24);
  return resto ? `${dias}d ${resto}h` : `${dias}d`;
}

const ehHoje = (iso: string | null | undefined) => {
  if (!iso) return false;
  const d = new Date(iso); const h = new Date();
  return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate();
};
const estaVencido = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() < Date.now();

export type Grupo = { chave: string; titulo: string; itens: Array<{ id: string; nome: string; motivo: string; tempo: string }>; total: number; verTodos: string };

/** Puro de proposito: da para testar a montagem dos grupos sem navegador. */
export function montarGrupos(fila: ItemFila[], hoje: ItemFila[], tarefas: Tarefa[]): Grupo[] {
  const card = (i: ItemFila) => ({
    id: String(i.negocio_id),
    nome: i.lead_nome?.trim() || "Lead sem nome",
    motivo: i.proxima_acao_titulo || i.motivo,
    tempo: tempoHumano(i.espera_min),
  });

  const responderam = fila.filter((i) => i.motivo === MOTIVO_RESPONDEU);
  const novos = fila.filter((i) => i.motivo === MOTIVO_LEAD_NOVO);
  const vencidas = fila.filter((i) => estaVencido(i.proxima_acao_em));
  const compromissos = hoje.filter((i) => ehHoje(i.proxima_acao_em));
  const tarefasVencidas = tarefas.filter((t) => !t.concluida && estaVencido(t.vencimento));

  return [
    { chave: "responderam", titulo: "Clientes que responderam", itens: responderam.slice(0, MAX_VISIVEL).map(card), total: responderam.length, verTodos: "/crm?vista=meu-dia&filtro=respondeu" },
    { chave: "novos", titulo: "Leads novos", itens: novos.slice(0, MAX_VISIVEL).map(card), total: novos.length, verTodos: "/crm?vista=meu-dia&filtro=agora" },
    { chave: "vencidas", titulo: "Ações vencidas", itens: vencidas.slice(0, MAX_VISIVEL).map(card), total: vencidas.length, verTodos: "/crm?vista=meu-dia&filtro=vencidos" },
    { chave: "compromissos", titulo: "Compromissos de hoje", itens: compromissos.slice(0, MAX_VISIVEL).map(card), total: compromissos.length, verTodos: "/agenda" },
    {
      chave: "tarefas", titulo: "Tarefas vencidas",
      itens: tarefasVencidas.slice(0, MAX_VISIVEL).map((t) => ({
        id: String(t.id), nome: (t.titulo || "Tarefa sem título").trim(),
        motivo: "venceu", tempo: t.vencimento ? tempoHumano((Date.now() - new Date(t.vencimento).getTime()) / 60000) : "",
      })),
      total: tarefasVencidas.length, verTodos: "/tarefas",
    },
  ];
}
