/**
 * CHECKLIST DE QUALIFICAÇÃO — o que precisamos saber do cliente. PURO.
 *
 * Onze perguntas. Enquanto faltar resposta, o atendimento não está entendido —
 * e a Sara usa exatamente esta lista para dizer o que perguntar em seguida.
 *
 * DECISÃO IMPORTANTE: isto NÃO é uma tabela nova. O checklist é DERIVADO da
 * conversa real pela Sara, a cada análise. Guardar em banco criaria uma segunda
 * verdade que envelhece: o cliente diz "mudei de ideia, quero 3 quartos" e o
 * campo salvo continua dizendo 2. Aqui a conversa é sempre a fonte.
 */

export type CampoQualificacao =
  | "regiao"
  | "tipo_imovel"
  | "metragem"
  | "dormitorios"
  | "vagas"
  | "faixa_valor"
  | "forma_pagamento"
  | "prazo_compra"
  | "motivo_compra"
  | "quem_decide"
  | "disponibilidade_visita";

export type DefinicaoCampo = {
  chave: CampoQualificacao;
  rotulo: string;
  /** Pergunta pronta, do jeito que o corretor faria. */
  pergunta: string;
  /** Peso na hora de decidir o que perguntar primeiro (1 = mais importante). */
  peso: number;
};

/** Ordem de importância comercial, não alfabética. */
export const CAMPOS_QUALIFICACAO: readonly DefinicaoCampo[] = Object.freeze([
  { chave: "regiao", rotulo: "Região", pergunta: "Em qual região você quer morar?", peso: 1 },
  { chave: "tipo_imovel", rotulo: "Tipo de imóvel", pergunta: "Está procurando apartamento, casa ou terreno?", peso: 1 },
  { chave: "dormitorios", rotulo: "Dormitórios", pergunta: "Quantos dormitórios você precisa?", peso: 1 },
  { chave: "faixa_valor", rotulo: "Faixa de valor", pergunta: "Qual faixa de investimento você tem em mente?", peso: 1 },
  { chave: "forma_pagamento", rotulo: "Forma de pagamento", pergunta: "Pretende financiar ou pagar à vista?", peso: 1 },
  { chave: "prazo_compra", rotulo: "Prazo de compra", pergunta: "Para quando você pretende comprar?", peso: 1 },
  { chave: "metragem", rotulo: "Metragem", pergunta: "Tem uma metragem mínima em mente?", peso: 2 },
  { chave: "vagas", rotulo: "Vagas", pergunta: "Quantas vagas de garagem você precisa?", peso: 2 },
  { chave: "motivo_compra", rotulo: "Motivo da compra", pergunta: "É para morar ou para investir?", peso: 2 },
  { chave: "quem_decide", rotulo: "Quem decide", pergunta: "A decisão é só sua ou tem mais alguém junto?", peso: 2 },
  { chave: "disponibilidade_visita", rotulo: "Disponibilidade para visita", pergunta: "Qual o melhor dia e horário para visitar?", peso: 1 },
]);

export const TOTAL_CAMPOS = CAMPOS_QUALIFICACAO.length;

const CHAVES = new Set<string>(CAMPOS_QUALIFICACAO.map((c) => c.chave));

export type ItemChecklist = {
  chave: CampoQualificacao;
  rotulo: string;
  pergunta: string;
  peso: number;
  /** Resposta que a Sara encontrou na conversa. null = ainda não sabemos. */
  valor: string | null;
};

export type Checklist = {
  itens: ItemChecklist[];
  descobertos: ItemChecklist[];
  faltantes: ItemChecklist[];
  completudePct: number;
  /** As três perguntas mais importantes que ainda faltam. */
  proximasPerguntas: string[];
};

/**
 * Monta o checklist a partir do que a Sara devolveu.
 * Aceita `{ regiao: "Zona Sul", ... }`. Qualquer chave desconhecida é ignorada
 * — a Sara não inventa campo, e se inventar, não entra.
 */
export function montarChecklist(descobertas: unknown): Checklist {
  const bruto = (descobertas && typeof descobertas === "object" && !Array.isArray(descobertas))
    ? (descobertas as Record<string, unknown>)
    : {};

  const itens: ItemChecklist[] = CAMPOS_QUALIFICACAO.map((c) => {
    const v = bruto[c.chave];
    const valor = typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim().slice(0, 120) : null;
    return { chave: c.chave, rotulo: c.rotulo, pergunta: c.pergunta, peso: c.peso, valor };
  });

  const descobertos = itens.filter((i) => i.valor !== null);
  const faltantes = itens.filter((i) => i.valor === null);

  return {
    itens,
    descobertos,
    faltantes,
    completudePct: Math.round((descobertos.length / TOTAL_CAMPOS) * 100),
    proximasPerguntas: faltantes
      .slice()
      .sort((a, b) => a.peso - b.peso)
      .slice(0, 3)
      .map((i) => i.pergunta),
  };
}

/** true quando o campo existe no checklist canônico. */
export function campoValido(chave: string): boolean {
  return CHAVES.has(chave);
}

/** Frase curta para o card e para a ficha. */
export function resumoChecklist(c: Checklist): string {
  if (c.faltantes.length === 0) return "Cliente qualificado — as onze informações foram descobertas.";
  if (c.descobertos.length === 0) return "Ainda não sabemos nada sobre o que este cliente procura.";
  return `${c.descobertos.length} de ${TOTAL_CAMPOS} informações descobertas.`;
}
