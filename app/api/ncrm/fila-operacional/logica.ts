/* Regras puras da fila operacional, sem dependencia de Supabase.
 *
 * Separadas da rota para poderem ser testadas direto no node: a rota importa o
 * cliente do banco, que nao resolve fora do bundler.
 */

export const POR_PAGINA = 20;

export type ItemFila = {
  negocio_id: number;
  respondeu?: boolean;
  lead_nome: string | null;
  etapa: string;
  motivo: string;
  espera_min: number;
  prioridade: number;
  proxima_acao_titulo: string | null;
  proxima_acao_em: string | null;
};

/** E.164 do Brasil. Telefone que nao normaliza vira null -- nunca meio numero. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const so = String(bruto).replace(/\D/g, "");
  const com55 = so.startsWith("55") ? so : `55${so}`;
  // 55 + DDD(2) + 8 ou 9 digitos
  if (com55.length !== 12 && com55.length !== 13) return null;
  const ddd = Number(com55.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return com55;
}

/** Corta a justificativa da Sara no tamanho de um card, sem cortar palavra. */
export function orientacaoCurta(texto: string | null | undefined, max = 120): string | null {
  if (!texto) return null;
  const limpo = String(texto).replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  const ultimo = corte.lastIndexOf(" ");
  return `${(ultimo > 40 ? corte.slice(0, ultimo) : corte).trimEnd()}…`;
}

/* Ordenacao canonica: a MESMA do banco (prioridade, depois quem espera ha mais
   tempo). negocio_id entra como desempate para o cursor ser estavel -- sem ele,
   dois itens iguais poderiam trocar de lugar entre paginas e um sumiria. */
export function ordemCanonica(a: ItemFila, b: ItemFila): number {
  return (a.prioridade - b.prioridade)
    || (Number(b.espera_min) - Number(a.espera_min))
    || (a.negocio_id - b.negocio_id);
}

export function decodificarCursor(bruto: string | null): { prioridade: number; espera: number; id: number } | null {
  if (!bruto) return null;
  const p = bruto.split(":").map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
  return { prioridade: p[0], espera: p[1], id: p[2] };
}
export const codificarCursor = (i: ItemFila) => `${i.prioridade}:${Math.round(Number(i.espera_min))}:${i.negocio_id}`;

/** Aplica o cursor sobre a lista JA ordenada. */
export function aplicarCursor(itens: ItemFila[], cursor: string | null): ItemFila[] {
  const c = decodificarCursor(cursor);
  if (!c) return itens;
  return itens.filter((i) => {
    if (i.prioridade !== c.prioridade) return i.prioridade > c.prioridade;
    const e = Math.round(Number(i.espera_min));
    if (e !== c.espera) return e < c.espera;
    return i.negocio_id > c.id;
  });
}
