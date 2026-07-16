import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function extractToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

async function authenticatedClient(token: string | null) {
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : supabase;
}

export async function GET(request: Request) {
  const token = extractToken(request);
  const supabase = await authenticatedClient(token);
  if (!supabase) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const [flags, executions, scheduled, events, agents, iaExecutions] = await Promise.all([
    supabase.from("motor_flags").select("nome,ativo,atualizado_em").order("nome"),
    supabase.from("motor_execucoes").select("id,automacao_nome,evento,status,detalhe,lead_nome,criado_em").order("criado_em", { ascending: false }).limit(80),
    supabase.from("mensagens_agendadas").select("id,lead_id,telefone,texto,quando,status,resultado,corretor_nome,criado_em").order("criado_em", { ascending: false }).limit(50),
    supabase.from("wa_eventos").select("id,evento,erro,processado,recebido_em,session_id").order("recebido_em", { ascending: false }).limit(50),
    supabase.from("agentes_ia").select("slug,nome,tipo,categoria,modelo,system_prompt,config,ativo").order("id"),
    supabase.from("agente_execucoes").select("id,agente_slug,lead_id,modelo,tokens_entrada,tokens_saida,custo_usd,status,saida,criado_em").order("criado_em", { ascending: false }).limit(60),
  ]);
  const error = [flags, executions, scheduled, events, agents].find((result) => result.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({
    flags: flags.data ?? [],
    executions: executions.data ?? [],
    scheduled: scheduled.data ?? [],
    events: events.data ?? [],
    agents: agents.data ?? [],
    iaExecutions: iaExecutions.data ?? [],
  });
}

export async function POST(request: Request) {
  const token = extractToken(request);
  const supabase = await authenticatedClient(token);
  if (!supabase) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as { action?: string; slug?: string; system_prompt?: string; active?: boolean; input?: string; lead_id?: number | null };

  if (body.action === "toggleAgent" && body.slug && typeof body.active === "boolean") {
    const { error } = await supabase.from("agentes_ia").update({ ativo: body.active }).eq("slug", body.slug);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "saveAgent" && body.slug && typeof body.system_prompt === "string") {
    const { error } = await supabase.from("agentes_ia").update({ system_prompt: body.system_prompt }).eq("slug", body.slug);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "runAgent" && body.slug && body.input) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-router`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agente_slug: body.slug, input: body.input, lead_id: body.lead_id ?? null }),
    });
    const result = await response.json();
    return Response.json(result, { status: response.ok ? 200 : 502 });
  }

  return Response.json({ error: "Ação inválida." }, { status: 422 });
}

export async function PATCH(request: Request) {
  // compat: alterna o estado no motor_flags (mantido para não quebrar chamadas antigas)
  const token = extractToken(request);
  const supabase = await authenticatedClient(token);
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
