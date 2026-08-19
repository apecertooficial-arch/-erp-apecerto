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
};

export const estadoConexaoDe = (chave: string): EstadoConexao => estadoConexaoTela[chave] ?? "demo";
