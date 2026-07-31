/**
 * NAVEGAÇÃO DO CRM NOVA ERA 3.0 — PURA e testável (sem React, sem rede).
 *
 * Oito abas, nesta ordem, e nenhuma a mais. "Gestão" é a única restrita:
 * quem atende lead não vê -- e nada do que vive lá (entrada de atendimentos,
 * análise automática, reconciliação, diagnósticos) aparece fora dela.
 *
 * A decisão de exibir é de INTERFACE. A autorização real continua sendo das
 * rotas /api/* e da RLS do banco, que esta branch não altera.
 */

export type Aba3 =
  | "meu_dia"
  | "funil"
  | "leads"
  | "visitas"
  | "esteira"
  | "agenda"
  | "avisos"
  | "gestao";

export type DefinicaoAba = {
  chave: Aba3;
  titulo: string;
  /** Símbolo do CRM atual — mesma família visual da barra de visões. */
  simbolo: string;
  subtitulo: string;
  /** true quando a aba só existe para quem administra a operação. */
  restrita?: boolean;
};

/** Ordem obrigatória da navegação 3.0. */
export const ABAS_3: readonly DefinicaoAba[] = Object.freeze([
  { chave: "meu_dia", titulo: "Meu Dia", simbolo: "◉", subtitulo: "O que precisa da sua atenção agora" },
  { chave: "funil", titulo: "Funil", simbolo: "▦", subtitulo: "Novo, tentando contato, em atendimento e em acompanhamento" },
  { chave: "leads", titulo: "Leads", simbolo: "☷", subtitulo: "Consulte, filtre e atualize os leads da operação" },
  { chave: "visitas", titulo: "Visitas", simbolo: "◇", subtitulo: "Pipe de visitas — entra só com visita agendada" },
  { chave: "esteira", titulo: "Esteira de Vendas", simbolo: "◆", subtitulo: "Entra só com proposta formal registrada" },
  { chave: "agenda", titulo: "Agenda", simbolo: "□", subtitulo: "Tarefas e compromissos dos seus clientes" },
  { chave: "avisos", titulo: "Avisos", simbolo: "△", subtitulo: "Clientes que responderam e prazos estourados" },
  { chave: "gestao", titulo: "Gestão", simbolo: "⚙", subtitulo: "Operação, adoção e saúde do CRM", restrita: true },
]);

/** Papéis que enxergam a aba Gestão. Corretor nunca entra nesta lista. */
export const PAPEIS_GESTAO: readonly string[] = Object.freeze(["admin", "executivo", "gestor", "gerente", "diretor"]);

export function podeVerGestao(papel: string | null | undefined): boolean {
  return PAPEIS_GESTAO.includes(String(papel ?? "").trim().toLowerCase());
}

/** Abas visíveis para o papel. Mantém a ordem canônica. */
export function abasVisiveis(papel: string | null | undefined): DefinicaoAba[] {
  const gestao = podeVerGestao(papel);
  return ABAS_3.filter((a) => !a.restrita || gestao);
}

/** Aba pedida por deep-link. Cai em "meu_dia" quando inválida ou proibida. */
export function abaDaUrl(valor: string | null | undefined, papel: string | null | undefined): Aba3 {
  const alvo = ABAS_3.find((a) => a.chave === String(valor ?? "").trim());
  if (!alvo) return "meu_dia";
  if (alvo.restrita && !podeVerGestao(papel)) return "meu_dia";
  return alvo.chave;
}

export function definicaoDaAba(chave: Aba3): DefinicaoAba {
  return ABAS_3.find((a) => a.chave === chave) ?? ABAS_3[0];
}

/**
 * Termos técnicos que NÃO podem aparecer na tela de quem atende. Espelha a
 * lista do briefing 3.0 e é usada pelos testes para prender a regra.
 */
export const TERMOS_FORA_DA_VISAO_DO_CORRETOR: readonly string[] = Object.freeze([
  "fase 4", "ingest", "runner", "lote", "observer",
  "reconcilia", "rpc", "kill-switch", "kill switch", "diagnóstico técnico", "diagnostico tecnico",
]);
