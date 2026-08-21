export type TagDoLead = {
  nome: string;
  cor: string | null;
};

const PREFIXOS_CONTEXTO = /^(origem|automa[cç][aã]o|campanha|conjunto|an[uú]ncio|abordagem)\s*:/i;
const TAGS_OPERACIONAIS = /^(aqu[aá]rio|respondeu primeira|visita (agendada|realizada)|👉|sem resposta|clicou\b)/i;

function textoDaTag(valor: unknown) {
  if (typeof valor === "string") return valor.trim();
  if (!valor || typeof valor !== "object") return "";
  const objeto = valor as Record<string, unknown>;
  const nome = typeof objeto.name === "string" ? objeto.name : typeof objeto.nome === "string" ? objeto.nome : "";
  return nome.trim();
}

function corDaTag(valor: unknown) {
  if (!valor || typeof valor !== "object") return null;
  const cor = (valor as Record<string, unknown>).color;
  return typeof cor === "string" && /^#[0-9a-f]{6}$/i.test(cor) ? cor.toUpperCase() : null;
}

function prioridade(tag: TagDoLead) {
  if (!PREFIXOS_CONTEXTO.test(tag.nome) && !TAGS_OPERACIONAIS.test(tag.nome)) return 0;
  if (/^automa[cç][aã]o\s*:/i.test(tag.nome)) return 1;
  if (/^an[uú]ncio\s*:/i.test(tag.nome)) return 2;
  if (/^campanha\s*:/i.test(tag.nome)) return 3;
  if (/^origem\s*:/i.test(tag.nome)) return 4;
  return 5;
}

/**
 * A origem entrega tags em dois formatos históricos: texto simples e objeto
 * { name, color }. A API do Funil devolve um formato único, curto e seguro
 * para que app e computador contem a mesma história.
 */
export function normalizarTagsDoLead(valor: unknown): TagDoLead[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  return valor
    .map((item) => ({ nome: textoDaTag(item).slice(0, 180), cor: corDaTag(item) }))
    .filter((tag) => {
      if (!tag.nome) return false;
      const chave = tag.nome.toLocaleLowerCase("pt-BR");
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => prioridade(a) - prioridade(b));
}

function tirarPrefixoAutomacao(nome: string) {
  return nome
    .replace(/^automa[cç][aã]o\s*:\s*/i, "")
    .replace(/^entrada\s+/i, "")
    .trim();
}

/**
 * O corretor precisa do produto antes da primeira mensagem. Quando não há
 * empreendimento vinculado ao negócio, usamos apenas evidência explícita das
 * tags: primeiro a etiqueta curta de produto; depois a automação de entrada;
 * por último o produto declarado no nome da campanha.
 */
export function interesseDasTags(tags: TagDoLead[]): string | null {
  const direta = tags.find((tag) =>
    tag.nome.length <= 80
    && !PREFIXOS_CONTEXTO.test(tag.nome)
    && !TAGS_OPERACIONAIS.test(tag.nome),
  );
  if (direta) return direta.nome;

  const automacao = tags.find((tag) => /^automa[cç][aã]o\s*:/i.test(tag.nome));
  if (automacao) {
    const produto = tirarPrefixoAutomacao(automacao.nome);
    if (produto && !/^(lead|novo lead|entrada)$/i.test(produto)) return produto;
  }

  const campanha = tags.find((tag) => /^campanha\s*:/i.test(tag.nome));
  if (campanha) {
    const partes = campanha.nome.replace(/^campanha\s*:\s*/i, "").split("|").map((parte) => parte.trim()).filter(Boolean);
    const depoisDaMarca = partes.find((parte, indice) => indice > 0 && !/^(form lead|\d+[\s/.-]*\d*)$/i.test(parte));
    if (depoisDaMarca) return depoisDaMarca.slice(0, 80);
  }
  return null;
}
