import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : supabase;
}

export async function GET(request: Request) {
  const supabase = await authenticatedClient(request);
  if (!supabase) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const [flags, executions, scheduled, events] = await Promise.all([
    supabase.from("motor_flags").select("nome,ativo,atualizado_em").order("nome"),
    supabase.from("motor_execucoes").select("id,automacao_nome,evento,status,detalhe,lead_nome,criado_em").order("criado_em", { ascending: false }).limit(80),
    supabase.from("mensagens_agendadas").select("id,lead_id,telefone,texto,quando,status,resultado,corretor_nome,criado_em").order("criado_em", { ascending: false }).limit(50),
    supabase.from("wa_eventos").select("id,evento,erro,processado,recebido_em,session_id").order("recebido_em", { ascending: false }).limit(50),
  ]);
  const error = [flags, executions, scheduled, events].find((result) => result.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({
    flags: flags.data ?? [],
    executions: executions.data ?? [],
    scheduled: scheduled.data ?? [],
    events: events.data ?? [],
  });
}

export async function PATCH(request: Request) {
  const supabase = await authenticatedClient(request);
  if (!supabase) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as { action?: string; name?: string; active?: boolean };
  if (body.action !== "toggleAgent" || !body.name || typeof body.active !== "boolean") {
    return Response.json({ error: "Alteração inválida." }, { status: 422 });
  }
  const { error } = await supabase.from("motor_flags").upsert({
    nome: `agente:${body.name}`,
    ativo: body.active,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "nome" });
  return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
}
