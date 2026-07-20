import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

export async function GET(request: Request) {
  const a = await auth(request);
  if (!a) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("config")) {
    const [{ data, error }, { data: brokers }] = await Promise.all([
      a.supabase.rpc("presenca_config_ler"),
      a.supabase.from("corretores").select("id,nome").eq("ativo", true).order("nome"),
    ]);
    if (error) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ config: data, corretores: brokers ?? [] });
  }
  const { data, error } = await a.supabase.rpc("presenca_status");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data ?? { ativa: false, prompt: false });
}

export async function POST(request: Request) {
  const a = await auth(request);
  if (!a) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "confirm") {
    const { data, error } = await a.supabase.rpc("presenca_confirmar");
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json(data ?? { ok: true });
  }
  if (action === "drop") {
    const { data, error } = await a.supabase.rpc("presenca_derrubar");
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json(data ?? { ok: true });
  }
  if (action === "saveConfig") {
    const { data, error } = await a.supabase.rpc("presenca_config_salvar", {
      p_ativa: typeof body.ativa === "boolean" ? body.ativa : null,
      p_dias_semana: Array.isArray(body.diasSemana) ? (body.diasSemana as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) : null,
      p_inicio: typeof body.horaInicio === "string" ? body.horaInicio : null,
      p_fim: typeof body.horaFim === "string" ? body.horaFim : null,
      p_intervalo: Number.isFinite(Number(body.intervaloMin)) ? Number(body.intervaloMin) : null,
      p_prazo: Number.isFinite(Number(body.prazoSeg)) ? Number(body.prazoSeg) : null,
      p_corretores: Array.isArray(body.corretores) ? (body.corretores as unknown[]).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : null,
    });
    if (error) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ config: data });
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
