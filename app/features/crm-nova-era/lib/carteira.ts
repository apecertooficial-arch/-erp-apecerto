/**
 * CRM Nova Era — SEPARAÇÃO de fontes: Carteira Nova Era vs Diagnóstico legado.
 * ------------------------------------------------------------------
 * Módulo PURO (Fase 3, Regra 1). A interface deve distinguir explicitamente:
 *  - Carteira Nova Era: leads já ingeridos e persistidos em ncrm_estado.
 *  - Diagnóstico da carteira antiga: alertas calculados sobre leads legados que
 *    ainda NÃO foram migrados. É apenas leitura: nenhum botão do diagnóstico pode
 *    escrever em ncrm_* ou movimentar lead legado.
 * Enquanto ncrm_estado estiver vazio, a carteira Nova Era é vazia e o diagnóstico
 * legado é claramente rotulado como "ainda não migrada". Após a migração, impedir
 * dupla contagem: negócio já ingerido NÃO aparece no diagnóstico legado.
 */

export type FonteDado = "nova_era" | "diagnostico_legado";

export type FaixaAtraso = "sem_atraso" | "ate_24h" | "de_24_48h" | "de_48_72h" | "mais_72h";

export const FAIXA_ATRASO_ROTULO: Record<FaixaAtraso, string> = {
  sem_atraso: "Sem atraso / futuro",
  ate_24h: "Atraso até 24h",
  de_24_48h: "Atraso 24–48h",
  de_48_72h: "Atraso 48–72h",
  mais_72h: "Atraso +72h",
};

export function faixaPorAtrasoHoras(atrasoHoras: number | null | undefined): FaixaAtraso {
  if (atrasoHoras == null || Number.isNaN(atrasoHoras) || atrasoHoras <= 0) return "sem_atraso";
  if (atrasoHoras < 24) return "ate_24h";
  if (atrasoHoras < 48) return "de_24_48h";
  if (atrasoHoras <= 72) return "de_48_72h";
  return "mais_72h";
}

export interface AlertaLegado {
  negocioId: number;
  atrasoHoras: number | null;
}

export interface DiagnosticoLegado {
  fonte: "diagnostico_legado";
  rotulo: string;
  somenteLeitura: true;
  permiteAcaoNovaEra: false;
  totalLegado: number;         // total de alertas legados recebidos
  ignoradosJaMigrados: number; // excluídos por já existirem em ncrm_estado (sem dupla contagem)
  totalConsiderado: number;    // total efetivamente diagnosticado (legado não migrado)
  porFaixa: Record<FaixaAtraso, number>;
}

/**
 * Calcula o diagnóstico da carteira antiga a partir dos alertas legados,
 * EXCLUINDO negócios já ingeridos na Nova Era (idsIngeridos) para não haver
 * dupla contagem. É sempre somente-leitura e nunca habilita ação Nova Era.
 */
export function diagnosticoCarteiraLegada(
  alertas: AlertaLegado[],
  idsIngeridos: Iterable<number> = [],
): DiagnosticoLegado {
  const ingeridos = new Set<number>();
  for (const id of idsIngeridos) ingeridos.add(id);
  const porFaixa: Record<FaixaAtraso, number> = { sem_atraso: 0, ate_24h: 0, de_24_48h: 0, de_48_72h: 0, mais_72h: 0 };
  let ignorados = 0;
  let considerado = 0;
  for (const a of alertas) {
    if (ingeridos.has(a.negocioId)) { ignorados += 1; continue; }
    porFaixa[faixaPorAtrasoHoras(a.atrasoHoras)] += 1;
    considerado += 1;
  }
  return {
    fonte: "diagnostico_legado",
    rotulo: "Diagnóstico da carteira antiga — ainda não migrada",
    somenteLeitura: true,
    permiteAcaoNovaEra: false,
    totalLegado: alertas.length,
    ignoradosJaMigrados: ignorados,
    totalConsiderado: considerado,
    porFaixa,
  };
}

/**
 * Guard explícito: nenhuma ação Nova Era (mover, criar visita/proposta, escrever
 * ncrm_*) é permitida sobre um item do diagnóstico legado. SEMPRE false.
 */
export function acaoNovaEraPermitidaSobreLegado(): false {
  return false;
}

export interface CarteiraNovaEra {
  fonte: "nova_era";
  total: number;              // nº de ncrm_estado
  vazia: boolean;
}

/** Resumo da carteira Nova Era a partir da contagem de ncrm_estado. */
export function resumoCarteiraNovaEra(totalEstados: number): CarteiraNovaEra {
  const total = Number.isFinite(totalEstados) && totalEstados > 0 ? Math.trunc(totalEstados) : 0;
  return { fonte: "nova_era", total, vazia: total === 0 };
}
