/**
 * Regras da esteira de vendas — compartilhadas entre o servidor (/api/crm/sales)
 * e a interface (CrmWorkspace), para que a trava mostrada na tela seja
 * exatamente a mesma que o servidor aplica.
 *
 * Cascata: cada etapa declara em `esteira_etapas.libera` quais blocos ela abre
 * para preenchimento. Só se preenche o bloco na etapa dele, e só se avança da
 * etapa quando tudo que ela liberou está completo.
 */

export type BlocoEsteira =
  | "condicoes"
  | "comissao"
  | "partes_comprador"
  | "docs_comprador"
  | "partes_vendedor"
  | "docs_vendedor"
  | "docs_imovel";

export const BLOCO_LABEL: Record<BlocoEsteira, string> = {
  condicoes: "condições comerciais",
  comissao: "comissão",
  partes_comprador: "dados do comprador",
  docs_comprador: "documentos do comprador",
  partes_vendedor: "dados do vendedor",
  docs_vendedor: "documentos do vendedor",
  docs_imovel: "documentos do imóvel",
};

export const PAPEIS_COMPRA = ["comprador", "conjuge_comprador"] as const;
export const PAPEIS_VENDA = ["vendedor", "conjuge_vendedor"] as const;

export type EtapaRegra = { slug: string; nome: string; ordem: number; libera?: string[] | null; restrito_a?: string[] | null };

/** Etapa que abre determinado bloco (a primeira na ordem, se houver mais de uma). */
export function etapaDoBloco(etapas: EtapaRegra[], bloco: BlocoEsteira): EtapaRegra | null {
  return etapas.slice().sort((a, b) => a.ordem - b.ordem).find((e) => (e.libera ?? []).includes(bloco)) ?? null;
}

/** O bloco está aberto para edição na etapa atual? */
export function blocoAberto(etapaAtual: EtapaRegra | null | undefined, bloco: BlocoEsteira): boolean {
  return Boolean(etapaAtual && (etapaAtual.libera ?? []).includes(bloco));
}

/** O usuário tem papel para preencher os blocos desta etapa? Admin sempre passa. */
export function podeEditarEtapa(role: string | null | undefined, etapa: EtapaRegra | null | undefined): boolean {
  if (!etapa) return false;
  const restrito = etapa.restrito_a ?? null;
  if (!restrito || restrito.length === 0) return true;
  if (role === "admin") return true;
  return Boolean(role && restrito.includes(role));
}

/**
 * Documento condicional: só é cobrado quando a forma de pagamento o justifica.
 * À vista não pede carta de crédito nem aprovação de financiamento.
 */
export function docExigido(condicao: string | null | undefined, forma: string | null | undefined): boolean {
  if (!condicao) return true;
  if (!forma) return false;
  if (condicao === "financiamento") return forma === "financiamento" || forma === "misto";
  if (condicao === "consorcio") return forma === "consorcio" || forma === "misto";
  if (condicao === "nao_a_vista") return forma !== "a_vista";
  return true;
}

/** Documento visível na lista (mesmo que ainda não seja cobrado). */
export function docVisivel(condicao: string | null | undefined, forma: string | null | undefined): boolean {
  if (!condicao) return true;
  if (!forma) return true;
  return docExigido(condicao, forma);
}

export type DadosCompletude = {
  condicao?: { valor_total?: number | string | null; forma_pagamento?: string | null } | null;
  comissao?: { percentual_total?: number | string | null; valor_total?: number | string | null } | null;
  partes: Array<{ papel: string; nome?: string | null; telefone?: string | null; email?: string | null }>;
  modelo: Array<{ grupo: string; nome: string; obrigatorio: boolean; condicao?: string | null }>;
  anexos: Array<{ grupo?: string | null; doc_nome?: string | null; status?: string | null; obrigatorio?: boolean | null }>;
  temConjugeComprador: boolean;
  temConjugeVendedor: boolean;
};

const preenchido = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

function faltasDePartes(dados: DadosCompletude, papeis: readonly string[], comConjuge: boolean): string[] {
  const faltas: string[] = [];
  const alvo = comConjuge ? papeis : papeis.slice(0, 1);
  for (const papel of alvo) {
    const linhas = dados.partes.filter((p) => p.papel === papel);
    if (!linhas.length) { faltas.push(`cadastre o ${papel.startsWith("conjuge") ? "cônjuge" : papel}`); continue; }
    const incompleta = linhas.find((p) => !preenchido(p.nome) || !preenchido(p.telefone) || !preenchido(p.email));
    if (incompleta) faltas.push(`preencha nome, telefone e e-mail do ${papel.replace("conjuge_", "cônjuge do ")}`);
  }
  return faltas;
}

function faltasDeDocs(dados: DadosCompletude, grupos: string[]): string[] {
  const forma = dados.condicao?.forma_pagamento ?? null;
  const aprovados = new Set(
    dados.anexos.filter((a) => a.status === "aprovado").map((a) => `${a.grupo}::${a.doc_nome}`),
  );
  const faltas: string[] = [];
  for (const grupo of grupos) {
    const pendentes = dados.modelo
      .filter((m) => m.grupo === grupo && m.obrigatorio && docExigido(m.condicao, forma))
      .filter((m) => !aprovados.has(`${m.grupo}::${m.nome}`));
    if (pendentes.length) faltas.push(`${pendentes.length} documento(s) obrigatório(s) sem aprovação`);
    const emTriagem = dados.anexos.filter((a) => a.grupo === grupo && a.status === "triagem").length;
    if (emTriagem) faltas.push(`${emTriagem} arquivo(s) aguardando conferência da classificação`);
  }
  // Arquivos do lote que ainda não têm grupo definido travam qualquer bloco de documentos.
  const semDestino = dados.anexos.filter((a) => a.status === "triagem" && !a.grupo).length;
  if (semDestino && grupos.length) faltas.push(`${semDestino} arquivo(s) do lote sem destino definido`);
  return faltas;
}

/** O bloco está completo? Devolve as pendências em texto pronto para o usuário. */
export function completudeBloco(bloco: BlocoEsteira, dados: DadosCompletude): { completo: boolean; faltas: string[] } {
  let faltas: string[] = [];
  if (bloco === "condicoes") {
    if (!preenchido(dados.condicao?.valor_total)) faltas.push("informe o valor total da venda");
    if (!preenchido(dados.condicao?.forma_pagamento)) faltas.push("escolha a forma de pagamento");
  } else if (bloco === "comissao") {
    if (!preenchido(dados.comissao?.percentual_total) && !preenchido(dados.comissao?.valor_total)) {
      faltas.push("informe o percentual ou o valor da comissão");
    }
  } else if (bloco === "partes_comprador") {
    faltas = faltasDePartes(dados, PAPEIS_COMPRA, dados.temConjugeComprador);
  } else if (bloco === "partes_vendedor") {
    faltas = faltasDePartes(dados, PAPEIS_VENDA, dados.temConjugeVendedor);
  } else if (bloco === "docs_comprador") {
    faltas = faltasDeDocs(dados, ["comprador", ...(dados.temConjugeComprador ? ["conjuge_comprador"] : [])]);
  } else if (bloco === "docs_vendedor") {
    faltas = faltasDeDocs(dados, ["vendedor", ...(dados.temConjugeVendedor ? ["conjuge_vendedor"] : [])]);
  } else if (bloco === "docs_imovel") {
    faltas = faltasDeDocs(dados, ["imovel"]);
  }
  return { completo: faltas.length === 0, faltas };
}

/** Tudo que a etapa liberou precisa estar completo para poder avançar. */
export function pendenciasParaAvancar(etapa: EtapaRegra | null | undefined, dados: DadosCompletude): string[] {
  const blocos = (etapa?.libera ?? []) as BlocoEsteira[];
  const out: string[] = [];
  for (const bloco of blocos) {
    const { completo, faltas } = completudeBloco(bloco, dados);
    if (!completo) out.push(`${BLOCO_LABEL[bloco]}: ${faltas.join(", ")}`);
  }
  return out;
}
