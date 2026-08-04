/**
 * Regra única de "estoque ofertável".
 *
 * Uma unidade só conta como disponível para o corretor quando está marcada como
 * disponível E já passou pela aprovação. Antes desta regra, o catálogo filtrava
 * apenas por `disponivel`, então uma indicação recém-cadastrada já entrava na
 * contagem de estoque e podia virar o "a partir de" do produto — sem que ninguém
 * tivesse validado o preço pedido.
 *
 * `aprovacao` hoje nunca é nulo no banco (unidades de construtora nascem
 * 'aprovado'), mas o coalesce mantém a regra segura para linhas antigas.
 */
export type UnidadeOfertavel = {
  disponivel?: boolean | null;
  aprovacao?: string | null;
};

export function ehOfertavel(unidade: UnidadeOfertavel): boolean {
  return unidade.disponivel === true && (unidade.aprovacao ?? "aprovado") === "aprovado";
}

/** Unidade aguardando validação — não é ofertável, mas precisa ser contada para o aprovador. */
export function estaPendente(unidade: UnidadeOfertavel): boolean {
  return (unidade.aprovacao ?? "aprovado") === "pendente";
}
