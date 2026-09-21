import type { SupabaseClient } from "@supabase/supabase-js";
import { dataOperacao } from "../timezone.ts";

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

/** Confirma a escrita antes de a interface remover a pendência da fila. */
export async function confirmarResultadoVisitaPersistido(
  db: SupabaseClient,
  visitaId: string,
  status: string,
  resultadoCodigo: string,
  justificativa: string,
): Promise<boolean> {
  const { data, error } = await db.from("f2_visita")
    .select("status,resultado_codigo,resultado_justificativa,resultado_em,inicio_em")
    .eq("id", visitaId)
    .maybeSingle();
  if (error
    || data?.status !== status
    || data.resultado_codigo !== resultadoCodigo
    || data.resultado_justificativa !== justificativa
    || typeof data.resultado_em !== "string"
    || typeof data.inicio_em !== "string") return false;

  const dia = dataOperacao(new Date(data.inicio_em));
  if (!dia) return false;
  const pendencias = await db.rpc("f2_visitas_resultado_pendente", { p_inicio: dia, p_fim: dia });
  if (pendencias.error || pendencias.data?.ok !== true || !Array.isArray(pendencias.data.itens)) return false;
  return !pendencias.data.itens.some((item: unknown) => (
    typeof item === "object" && item !== null && "id" in item && item.id === visitaId
  ));
}
