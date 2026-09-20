import type { SupabaseClient } from "@supabase/supabase-js";

export type AutorizacaoResultadoVisita =
  | { permitido: true }
  | { permitido: false; status: 403 | 404 | 502; mensagem: string };

/**
 * O resultado pertence ao corretor dono da carteira. Gestão acompanha e cobra,
 * mas não registra o feedback no lugar dele. Esta barreira protege as APIs
 * enquanto a mesma regra ainda precisa ser endurecida na RPC do banco.
 */
export async function verificarDonoResultadoVisita(
  db: SupabaseClient,
  visitaId: string,
): Promise<AutorizacaoResultadoVisita> {
  const [visita, corretorAtual] = await Promise.all([
    db.from("f2_visita").select("funil_lead_id").eq("id", visitaId).maybeSingle(),
    db.rpc("current_broker_id"),
  ]);
  if (visita.error || corretorAtual.error) {
    return { permitido: false, status: 502, mensagem: "Não foi possível confirmar o responsável pela visita." };
  }
  if (!visita.data?.funil_lead_id) {
    return { permitido: false, status: 404, mensagem: "Visita não encontrada." };
  }
  const corretorId = Number(corretorAtual.data);
  if (!Number.isSafeInteger(corretorId) || corretorId < 1) {
    return { permitido: false, status: 403, mensagem: "O feedback deve ser registrado pelo corretor responsável." };
  }
  const card = await db.from("f2_lead")
    .select("corretor_id")
    .eq("id", visita.data.funil_lead_id)
    .maybeSingle();
  if (card.error) {
    return { permitido: false, status: 502, mensagem: "Não foi possível confirmar o responsável pela visita." };
  }
  if (!card.data) {
    return { permitido: false, status: 404, mensagem: "A visita não está ligada a uma carteira ativa." };
  }
  if (Number(card.data.corretor_id) !== corretorId) {
    return { permitido: false, status: 403, mensagem: "O feedback deve ser registrado pelo corretor responsável." };
  }
  return { permitido: true };
}
