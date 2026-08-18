/* Catálogo das 17 páginas da Inteligência — EXATAMENTE as duas famílias e os
 * rótulos do protótipo aprovado.
 *
 * CORREÇÃO DESTA RODADA: a publicação tinha inventado quatro grupos (Empresa,
 * Operação comercial, Mercado e digital, Governança). O protótipo não é assim: a
 * navegação de primeiro nível é o segmentado SITE E MARKETING / PERFORMANCE, e o
 * segundo nível é a fileira de pílulas de cada família — 8 páginas no site e
 * marketing, 9 na performance. Os rótulos também eram outros (“Visão CEO”,
 * “Equipe”, “Qualidade”, “Alertas”…). Aqui ficam os do desenho.
 *
 * As CHAVES não mudaram: registro.tsx e o conteúdo do Copiloto seguem casando.
 */

export type GrupoChave = "site" | "performance";

export type Grupo = {
  chave: GrupoChave;
  rotulo: string;
  /** Quem abre, em uma linha. Vira o title da pílula do segmentado. */
  publico: string;
};

export type Tela = {
  chave: string;
  grupo: GrupoChave;
  /** Rótulo da pílula do segundo nível — igual ao do protótipo. */
  rotulo: string;
  titulo: string;
  sub: string;
  /** Dimensões oferecidas na barra de filtros desta página. */
  filtros: string[];
  /** Artboard aprovado de origem. */
  ref: string;
  /** Badge da pílula, quando o desenho pede (ex.: Alertas · 5). */
  badge?: string;
};

export const grupos: Grupo[] = [
  { chave: "site", rotulo: "Site e marketing", publico: "De onde vem a demanda e o que ela procura no site. Abre para CEO e marketing." },
  { chave: "performance", rotulo: "Performance", publico: "Como a empresa vende, atende e ganha dinheiro. Abre para CEO, gestores e gerentes." },
];

export const telas: Tela[] = [
  /* SITE E MARKETING — as 8 páginas da família digital, na ordem do protótipo. */
  { chave: "digital", grupo: "site", rotulo: "Visão do digital", titulo: "Visão do digital", sub: "Do acesso no site até a venda no Funil 2.0 — o que melhorou, o que piorou e onde agir.", filtros: ["Origem", "Mídia", "Campanha", "Dispositivo", "Página", "Imóvel", "Bairro", "Finalidade", "Tipo de lead", "Consentimento"], ref: "2a" },
  { chave: "aquisicao", grupo: "site", rotulo: "Aquisição", titulo: "Aquisição e campanhas", sub: "Qual canal traz resultado comercial de verdade — negócio e venda, não só clique.", filtros: ["Origem", "Mídia", "Campanha", "Dispositivo", "Finalidade", "Tipo de lead"], ref: "3a" },
  { chave: "comportamento", grupo: "site", rotulo: "Comportamento", titulo: "Comportamento e conteúdo", sub: "O que as pessoas fazem no site e onde perdem interesse.", filtros: ["Página / tipo", "Origem", "Dispositivo", "Consentimento"], ref: "4a" },
  { chave: "imoveis", grupo: "site", rotulo: "Imóveis", titulo: "Imóveis e procura", sub: "Quais imóveis e regiões geram demanda — e quais precisam de ajuste.", filtros: ["Bairro", "Finalidade", "Faixa de preço", "Responsável", "Status"], ref: "6a" },
  { chave: "conversao", grupo: "site", rotulo: "Conversão e CRM", titulo: "Conversão e CRM", sub: "O que acontece depois que o lead entra — do primeiro contato à chave na mão.", filtros: ["Corretor", "Campanha", "Imóvel", "Tipo de lead", "Etapa"], ref: "5a" },
  { chave: "proprietarios", grupo: "site", rotulo: "Proprietários", titulo: "Captação de proprietários", sub: "O site está ajudando a captar imóveis — do clique ao anúncio publicado.", filtros: ["Origem", "Campanha", "Bairro", "Tipo", "Finalidade", "Corretor"], ref: "7a" },
  { chave: "sara", grupo: "site", rotulo: "Sara", titulo: "Sara — assistente de imóveis", sub: "A Sara facilita a descoberta de imóveis e gera oportunidade de verdade?", filtros: ["Dispositivo", "Bairro", "Finalidade", "Faixa de preço"], ref: "8a" },
  { chave: "privacidade", grupo: "site", rotulo: "Privacidade e tracking", titulo: "Privacidade e qualidade do tracking", sub: "Os dados são confiáveis — e estamos respeitando o que cada pessoa escolheu?", filtros: ["Nível de consentimento", "Dispositivo"], ref: "9a" },

  /* PERFORMANCE — as 9 páginas da família de operação, na ordem do protótipo. */
  { chave: "empresa", grupo: "performance", rotulo: "Visão CEO", titulo: "Visão CEO", sub: "A empresa está vendendo, atendendo e ganhando dinheiro — e onde agir primeiro.", filtros: ["Equipe", "Gerente", "Origem", "Empreendimento"], ref: "14b" },
  { chave: "atendimento", grupo: "performance", rotulo: "Atendimento e SLA", titulo: "Atendimento e SLA", sub: "Quem está esperando resposta agora — e há quanto tempo.", filtros: ["Equipe", "Corretor", "Origem", "Dia da semana"], ref: "15a" },
  { chave: "equipe", grupo: "performance", rotulo: "Equipe", titulo: "Performance da equipe", sub: "Quatro pilares, duas equipes, nenhuma nota geral.", filtros: ["Equipe", "Período de admissão"], ref: "16a" },
  { chave: "gerentes", grupo: "performance", rotulo: "Gerentes", titulo: "Gerentes", sub: "Carga, cobertura de horário, coaching e intervenções.", filtros: ["Gerente", "Equipe"], ref: "17a" },
  { chave: "corretores", grupo: "performance", rotulo: "Corretores", titulo: "Corretores", sub: "Lista gerencial, perfil e a visão do próprio corretor.", filtros: ["Equipe", "Corretor", "Situação"], ref: "18a" },
  { chave: "qualidade", grupo: "performance", rotulo: "Qualidade", titulo: "Qualidade e desenvolvimento", sub: "Oito critérios, amostra declarada, plano por pessoa.", filtros: ["Equipe", "Corretor", "Critério"], ref: "19a" },
  { chave: "vendas", grupo: "performance", rotulo: "Vendas e previsão", titulo: "Vendas e previsão", sub: "Realizado, previsão ponderada e cobertura da meta.", filtros: ["Equipe", "Corretor", "Empreendimento", "Etapa"], ref: "19b" },
  { chave: "financeiro", grupo: "performance", rotulo: "Financeiro", titulo: "Financeiro e comissões", sub: "A cascata que separa VGV de contribuição — nunca lucro líquido.", filtros: ["Equipe", "Corretor", "Tipo de contrato"], ref: "20a" },
  { chave: "alertas", grupo: "performance", rotulo: "Alertas", titulo: "Central de alertas", sub: "Gravidade, evidência, dono e ação.", filtros: ["Gravidade", "Tipo", "Equipe", "Responsável", "Status"], ref: "21a", badge: "5" },
];

export const telasDoGrupo = (grupo: GrupoChave) => telas.filter((t) => t.grupo === grupo);

export const telaPorChave = (chave: string): Tela | undefined => telas.find((t) => t.chave === chave);

/** Primeira tela de cada família — o clique no segmentado cai aqui. */
export const primeiraDoGrupo = (grupo: GrupoChave): string => (telasDoGrupo(grupo)[0] ?? telas[0]).chave;

export const periodos = ["Hoje", "7 dias", "30 dias", "90 dias", "Personalizado"] as const;
