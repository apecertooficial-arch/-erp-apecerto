import type { CrmV3Scenario, CrmV3State } from "./types";

/**
 * Única fronteira de mutação do laboratório local.
 *
 * A interface não conhece endpoint, RPC ou token. O adaptador devolve uma
 * nova fotografia tipada e nunca executa fetch. Na futura conexão, esta
 * fronteira pode delegar aos serviços canônicos sem espalhar condicionais de
 * laboratório pelos componentes.
 */
export async function runLocalValidationMutation(
  scenario: CrmV3Scenario,
  current: CrmV3State,
  mutation: (state: CrmV3State) => CrmV3State,
): Promise<{ ok: true; state: CrmV3State } | { ok: false; state: CrmV3State; error: string }> {
  if (scenario === "offline") return { ok: false, state: current, error: "Sem conexão. Esta ação fica indisponível no modo cache." };
  if (scenario === "error") return { ok: false, state: current, error: "Falha simulada. Nenhum dado foi alterado." };
  if (scenario === "loading") await new Promise((resolve) => window.setTimeout(resolve, 450));
  try { return { ok: true, state: mutation(current) }; }
  catch (reason) { return { ok: false, state: current, error: reason instanceof Error ? reason.message : "Não foi possível concluir a ação local." }; }
}

export const CRM_V3_EXTERNAL_MUTATIONS_BLOCKED = true;

