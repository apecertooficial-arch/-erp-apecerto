/* Catálogo das 17 páginas da Inteligência.
 *
 * Fonte única: a casca, o segundo nível do menu e o Copiloto leem daqui. Dois
 * arrays divergiriam — foi o que aconteceu no desenho quando "Visão executiva"
 * existia em dois grupos com o mesmo nome (resolvido no print 23a: viraram
 * "Visão da empresa" e "Visão do digital").
 */

export type GrupoChave = "empresa" | "operacao" | "digital" | "governanca";

export type Grupo = {
  chave: GrupoChave;
  rotulo: string;
  /** Quem abre, em uma linha. Aparece no cartão de escolha de grupo. */
  publico: string;
};

export type Tela = {
  chave: string;
  grupo: GrupoChave;
  /** Rótulo curto da pílula do segundo nível. */
  rotulo: string;
  /** Título da página. */
  titulo: string;
  /** Subtítulo: o que a tela responde. */
  sub: string;
  /** Dimensões oferecidas na barra de filtros desta página. */
  filtros: string[];
  /** Referência do artboard aprovado, para rastrear o desenho de origem. */
  ref: string;
};

export const grupos: Grupo[] = [
  { chave: "empresa", rotulo: "Empresa", publico: "O número da imobiliária inteira. Abre para CEO, diretoria e financeiro." },
  { chave: "operacao", rotulo: "Operação comercial", publico: "Como o time atende e converte. Abre para CEO, gestores e gerentes." },
  { chave: "digital", rotulo: "Mercado e digital", publico: "De onde vem a demanda e o que ela procura. Abre para CEO e marketing." },
  { chave: "governanca", rotulo: "Governança", publico: "Se o dado é confiável e o que precisa de ação. Abre para CEO e responsável por dados." },
];

export const telas: Tela[] = [
  { chave: "empresa", grupo: "empresa", rotulo: "Visão da empresa", titulo: "Visão da empresa", sub: "A operação inteira num lugar: atendimento, comercial, financeiro e meta.", filtros: ["Equipe", "Gerente", "Origem", "Empreendimento"], ref: "14b" },
  { chave: "vendas", grupo: "empresa", rotulo: "Vendas e previsão", titulo: "Vendas e previsão", sub: "Realizado, previsão ponderada e cobertura da meta.", filtros: ["Equipe", "Corretor", "Empreendimento", "Etapa"], ref: "19b" },
  { chave: "financeiro", grupo: "empresa", rotulo: "Financeiro e comissões", titulo: "Financeiro e comissões", sub: "A cascata que separa VGV de contribuição — nunca lucro líquido.", filtros: ["Equipe", "Corretor", "Tipo de contrato"], ref: "20a" },

  { chave: "atendimento", grupo: "operacao", rotulo: "Atendimento e SLA", titulo: "Atendimento e SLA", sub: "Quem está esperando resposta agora, e há quanto tempo.", filtros: ["Equipe", "Corretor", "Origem", "Dia da semana"], ref: "15a" },
  { chave: "equipe", grupo: "operacao", rotulo: "Performance da equipe", titulo: "Performance da equipe", sub: "Quatro pilares, duas equipes, nenhuma nota geral.", filtros: ["Equipe", "Período de admissão"], ref: "16a" },
  { chave: "gerentes", grupo: "operacao", rotulo: "Gerentes", titulo: "Gerentes", sub: "Carga, cobertura de horário, coaching e intervenções.", filtros: ["Gerente", "Equipe"], ref: "17a" },
  { chave: "corretores", grupo: "operacao", rotulo: "Corretores", titulo: "Corretores", sub: "Lista gerencial, perfil e a visão do próprio corretor.", filtros: ["Equipe", "Corretor", "Situação"], ref: "18a" },
  { chave: "qualidade", grupo: "operacao", rotulo: "Qualidade e desenvolvimento", titulo: "Qualidade e desenvolvimento", sub: "Oito critérios, amostra declarada, plano por pessoa.", filtros: ["Equipe", "Corretor", "Critério"], ref: "19a" },
  { chave: "conversao", grupo: "operacao", rotulo: "Conversão e CRM", titulo: "Conversão e CRM", sub: "O que acontece depois que o lead entra — do primeiro contato à chave na mão.", filtros: ["Corretor", "Campanha", "Imóvel", "Etapa"], ref: "5a" },

  { chave: "digital", grupo: "digital", rotulo: "Visão do digital", titulo: "Visão do digital", sub: "Do acesso no site até a venda no Funil 2.0 — o que melhorou, o que piorou e onde agir.", filtros: ["Origem", "Mídia", "Campanha", "Dispositivo", "Página", "Imóvel", "Bairro", "Consentimento"], ref: "2a" },
  { chave: "aquisicao", grupo: "digital", rotulo: "Aquisição e campanhas", titulo: "Aquisição e campanhas", sub: "Qual canal traz resultado comercial de verdade — negócio e venda, não só clique.", filtros: ["Origem", "Mídia", "Campanha", "Dispositivo"], ref: "3a" },
  { chave: "comportamento", grupo: "digital", rotulo: "Comportamento e conteúdo", titulo: "Comportamento e conteúdo", sub: "O que as pessoas fazem no site e onde perdem interesse.", filtros: ["Página", "Origem", "Dispositivo", "Consentimento"], ref: "4a" },
  { chave: "imoveis", grupo: "digital", rotulo: "Imóveis e procura", titulo: "Imóveis e procura", sub: "Quais imóveis e regiões geram demanda — e quais precisam de ajuste.", filtros: ["Bairro", "Finalidade", "Faixa de preço", "Responsável", "Status"], ref: "6a" },
  { chave: "proprietarios", grupo: "digital", rotulo: "Captação de proprietários", titulo: "Captação de proprietários", sub: "O site está ajudando a captar imóveis — do clique ao anúncio publicado.", filtros: ["Origem", "Campanha", "Bairro", "Tipo", "Corretor"], ref: "7a" },
  { chave: "sara", grupo: "digital", rotulo: "Sara", titulo: "Sara — assistente de imóveis", sub: "A Sara facilita a descoberta de imóveis e gera oportunidade de verdade?", filtros: ["Dispositivo", "Bairro", "Finalidade", "Faixa de preço"], ref: "8a" },

  { chave: "alertas", grupo: "governanca", rotulo: "Central de alertas", titulo: "Central de alertas", sub: "Gravidade, evidência, dono e ação.", filtros: ["Gravidade", "Tipo", "Equipe", "Responsável", "Status"], ref: "21a" },
  { chave: "privacidade", grupo: "governanca", rotulo: "Privacidade e tracking", titulo: "Privacidade e qualidade do tracking", sub: "Os dados são confiáveis — e estamos respeitando o que cada pessoa escolheu?", filtros: ["Nível de consentimento", "Dispositivo"], ref: "9a" },
];

export const telasDoGrupo = (grupo: GrupoChave) => telas.filter((t) => t.grupo === grupo);

export const telaPorChave = (chave: string): Tela | undefined => telas.find((t) => t.chave === chave);

/** Primeira tela de cada grupo — o clique no grupo cai aqui. */
export const primeiraDoGrupo = (grupo: GrupoChave): string => (telasDoGrupo(grupo)[0] ?? telas[0]).chave;

export const periodos = ["Hoje", "7 dias", "30 dias", "90 dias", "Personalizado"] as const;
