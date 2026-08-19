/* Estado de conexão de cada tela da Inteligência ao dado real.
 *
 * A casca usa isto para o selo do topo:
 *   real    -> sem selo (a tela inteira é dado real)
 *   parcial -> "DADOS PARCIAIS" + as fontes que faltam vêm no rodapé/meta
 *   demo    -> "DEMONSTRAÇÃO" (ainda não conectada)
 *
 * Só entra aqui a tela cujo usarDados() já lê o endpoint /api/inteligencia. */

export type EstadoConexao = "real" | "parcial" | "demo";

export const estadoConexaoTela: Record<string, EstadoConexao> = {
  privacidade: "real",
  empresa: "parcial", // Visão CEO: CRM real; SLA%, previsão ponderada e valor de pipeline seguem —
  atendimento: "parcial", // Fila viva real; % no SLA de 5 min e taxa de resposta seguem —
  digital: "parcial", // Telemetria de site real; KPIs de negócio/GA4 seguem —
  financeiro: "parcial", // Vendas/comissões reais; lucro líquido segue —
  corretores: "parcial", // Métricas por corretor reais; qualidade/presença seguem —
  equipe: "parcial", // Pilares e rollup por equipe reais; qualidade/cobertura seguem —
  gerentes: "parcial", // Rollup por gerente real; cobertura de horário/qualidade seguem —
  vendas: "parcial", // Realizado/meta/pipeline reais; previsão ponderada e VGV por etapa seguem —
  qualidade: "parcial", // Avaliação por IA real; cobertura/contestação seguem —
  alertas: "parcial", // Alertas sintetizados de sinais reais; motor crm_lead_alertas nascente
  aquisicao: "parcial", // Leads por origem (CRM) reais; custo de mídia/atribuição seguem —
  comportamento: "parcial", // Páginas/eventos/dispositivos reais; Clarity/jornada seguem —
  imoveis: "parcial", // Procura (telemetria) real; tabela por imóvel depende de código de imóvel
  conversao: "parcial", // Funil CRM (Funil 2.0) + SLA + conversão por corretor reais; tempos/motivos/jornada seguem —
  proprietarios: "parcial", // Vendas por empreendimento reais; captação (funil/cortes) ainda não é rastreada
  sara: "parcial", // Sara ainda não envia eventos à Inteligência (0 no período)
};

export const estadoConexaoDe = (chave: string): EstadoConexao => estadoConexaoTela[chave] ?? "demo";
