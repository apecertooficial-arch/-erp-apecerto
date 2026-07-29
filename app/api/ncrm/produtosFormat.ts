/**
 * Formatação PURA das opções de produto/empreendimento para o select da proposta.
 * O usuário escolhe pelo NOME; o UUID é usado apenas internamente (value do option).
 * Sem I/O — testável isoladamente.
 */
export type ProdutoRow = {
  id: string;
  nome: string | null;
  bairro?: string | null;
  cidade?: string | null;
  preco?: number | null;
};

export type ProdutoOpcao = {
  id: string;        // uuid — uso interno (nunca digitado pelo usuário)
  nome: string;      // nome exibido
  local: string;     // "Bairro/Cidade" quando disponível
  preco: number | null;
  rotulo: string;    // texto pesquisável mostrado no select
};

function precoBR(v: number | null | undefined): string | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  // R$ 450.000 (sem centavos; separador de milhar por ponto)
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

export function formatProduto(row: ProdutoRow): ProdutoOpcao {
  const nome = (row.nome ?? "").trim() || "(sem nome)";
  const bairro = (row.bairro ?? "").trim();
  const cidade = (row.cidade ?? "").trim();
  const local = [bairro, cidade].filter(Boolean).join("/");
  const preco = typeof row.preco === "number" && Number.isFinite(row.preco) && row.preco > 0 ? row.preco : null;
  const partes = [nome];
  if (local) partes.push(local);
  const pf = precoBR(preco);
  if (pf) partes.push(pf);
  return { id: row.id, nome, local, preco, rotulo: partes.join(" · ") };
}

/** Filtro client-side simples por texto (nome/local), case-insensitive. */
export function filtrarProdutos(opcoes: ProdutoOpcao[], termo: string): ProdutoOpcao[] {
  const q = (termo ?? "").trim().toLowerCase();
  if (!q) return opcoes;
  return opcoes.filter((o) => o.nome.toLowerCase().includes(q) || o.local.toLowerCase().includes(q));
}
