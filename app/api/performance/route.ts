import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  const role = me?.role ?? "corretor";
  const { data: broker } = await auth.supabase.from("corretores").select("id,nome").eq("usuario_id", auth.user.id).maybeSingle();

  const [painel, metricas] = await Promise.all([
    auth.supabase.from("v_painel_corretor").select("corretor_id,corretor,vendas,vgv_rateado,comissao_total,comissao_prevista,comissao_paga,indicacoes"),
    auth.supabase.from("vw_metricas_corretor").select("corretor_id,corretor,leads_ativos,aguardando_resposta,em_alarme,pior_espera_min,tarefas_vencidas,parados_24h,parados_48h,parados_72h,em_atendimento,em_agendamento"),
  ]);
  const firstError = [painel, metricas].find((result) => result.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });

  let metricasRows = metricas.data ?? [];
  let painelRows = painel.data ?? [];
  if (role === "corretor" && broker) {
    metricasRows = metricasRows.filter((row) => Number(row.corretor_id) === Number(broker.id));
  }

  return Response.json({
    role,
    brokerId: broker?.id ?? null,
    brokerNome: broker?.nome ?? null,
    painel: painelRows,
    metricas: metricasRows,
  });
}
