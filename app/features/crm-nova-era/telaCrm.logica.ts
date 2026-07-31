/* Regras puras da tela de CRM do celular.
 *
 * Em .ts e não dentro do .tsx porque o runner de teste usa o strip-types do
 * node, que não entende JSX. Mesmo padrão de telaCorretor.logica.ts.
 */

import type { ItemTela } from "../home/telaCorretor.logica";

export type Aba = "meu_dia" | "funil" | "leads" | "visitas";

/** Só dígitos: o corretor digita "(11) 9 8888" e o banco guarda E.164. */
const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Sem acento e em minúscula: "aragao" tem que achar "Aragão". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Busca por nome OU telefone.
 *
 * Termo com dígito procura no telefone; sem dígito, no nome. Buscar os dois
 * sempre faria "11" casar com todo lead cujo nome tem "11" em algum lugar do
 * telefone — ruído que atrapalha justamente quem está com pressa.
 */
export function buscar(itens: ItemTela[], termo: string): ItemTela[] {
  const t = termo.trim();
  if (!t) return itens;

  const digitos = soDigitos(t);
  if (digitos.length >= 3) {
    return itens.filter((i) => soDigitos(i.telefone_normalizado ?? "").includes(digitos));
  }

  const n = normalizar(t);
  return itens.filter((i) =>
    normalizar(i.nome ?? "").includes(n) || normalizar(i.interesse_resumo ?? "").includes(n));
}

export type Briefing = { texto: string; primeiroId: number; tarefas: number };

/**
 * Texto do cartão roxo: por onde começar e o que vem depois.
 *
 * Monta a frase a partir da fila real — não é um texto fixo nem uma segunda
 * chamada de IA. A Sara já disse o que fazer em cada lead; aqui ela só diz a
 * ORDEM, que é a decisão que o corretor mais erra sozinho.
 *
 * Devolve null com a fila vazia: cartão de briefing sem fila é enfeite.
 */
export function briefingDaSara(fila: ItemTela[]): Briefing | null {
  if (fila.length === 0) return null;

  const nomeCurto = (i: ItemTela) => (i.nome ?? "").trim().split(/\s+/)[0] || "o primeiro da fila";
  const primeiro = fila[0];
  const segundo = fila[1];

  const tempo = (min: number) => {
    const m = Math.max(0, Math.round(min || 0));
    return m < 60 ? `${m} min` : `${Math.round(m / 60)}h`;
  };

  let texto = `Comece pela ${nomeCurto(primeiro)}: ${tempo(primeiro.tempo_espera)} esperando`;
  texto += fila.length > 1 ? " e é a mais quente da fila." : ".";
  if (segundo) {
    texto += ` Depois, ${nomeCurto(segundo)} — ${segundo.motivo_prioridade.toLowerCase()} de ${tempo(segundo.tempo_espera)}.`;
  }

  return { texto, primeiroId: primeiro.negocio_id, tarefas: fila.length };
}
