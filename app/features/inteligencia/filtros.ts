/* Contrato único entre os dropdowns da casca e os parâmetros aceitos pelas
 * RPCs. Manter rótulo, valor de API e tela juntos evita exibir um filtro que o
 * backend ignore silenciosamente. */

type OpcaoFiltro = { rotulo: string; parametro: string };

export const opcoesReaisPorTela: Record<string, Record<string, readonly OpcaoFiltro[]>> = {
  privacidade: {
    "Nível de consentimento": [
      { rotulo: "Somente essenciais", parametro: "essential" },
      { rotulo: "Analytics", parametro: "analytics" },
      { rotulo: "Marketing", parametro: "marketing" },
    ],
    Dispositivo: [
      { rotulo: "Desktop", parametro: "desktop" },
      { rotulo: "Celular", parametro: "mobile" },
      { rotulo: "Tablet", parametro: "tablet" },
    ],
  },
};

export function extrairFiltros(chips: string[]): { consent: string | null; device: string | null } {
  let consent: string | null = null;
  let device: string | null = null;

  for (const chip of chips) {
    const separador = chip.indexOf(":");
    if (separador < 0) continue;
    const dimensao = chip.slice(0, separador);
    const rotulo = chip.slice(separador + 1).trim();
    const opcao = opcoesReaisPorTela.privacidade[dimensao]?.find((item) => item.rotulo === rotulo);
    if (!opcao) continue;
    if (dimensao === "Nível de consentimento") consent = opcao.parametro;
    if (dimensao === "Dispositivo") device = opcao.parametro;
  }

  return { consent, device };
}
