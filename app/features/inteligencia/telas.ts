export type GrupoChave = "site" | "performance";

export const grupos = [
  {
    chave: "site" as const,
    rotulo: "Marketing, site e tracking",
    titulo: "Marketing, site e tracking",
    sub: "Do investimento à venda: campanhas, comportamento, conversão e saúde da coleta.",
  },
  {
    chave: "performance" as const,
    rotulo: "Empresa e operação",
    titulo: "Empresa e operação comercial",
    sub: "Quem está trabalhando, quem está produzindo e onde a operação perde oportunidades.",
  },
];

export const periodos = ["Hoje", "7 dias", "30 dias", "90 dias"] as const;
