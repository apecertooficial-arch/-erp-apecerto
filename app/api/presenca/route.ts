import { createServerSupabaseClient } from "../../lib/supabase/server";

type SupabaseLike = ReturnType<typeof createServerSupabaseClient>;

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

/* Presenca serve para saber quem esta NO ESCRITORIO. Confirmada do sofa, ela
   nao prova nada -- e ate hoje provava mesmo nada, porque o resultado desta
   checagem morria no navegador e nunca era gravado no banco.
   O IP tem de ser lido AQUI, no servidor: o navegador nao conhece o proprio IP
   publico e qualquer valor vindo do cliente seria falsificavel. */
async function naRedeDoEscritorio(request: Request, supabase: SupabaseLike): Promise<boolean> {
  const ipBruto =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0];
  const ip = (ipBruto ?? "").trim();
  if (!ip) return false;
  const { data: cfg } = await supabase.from("escritorio_config").select("ips").maybeSingle();
  const permitidos = (cfg?.ips ?? []) as string[];
  return permitidos.some((permitido) => permitido.trim() === ip);
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

  const noEscritorio = await naRedeDoEscritorio(request, a.supabase);
  return Response.json({ ...(data ?? { ativa: false, prompt: false }), no_escritorio_ip: noEscritorio });
}

export async function POST(request: Request) {
  const a = await auth(request);
  if (!a) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "confirm") {
    /* O que decide a fila e ESTE valor, apurado no servidor. */
    /* O cast existe porque database.types.ts ainda nao foi regerado com o novo
       parametro. O resto deste arquivo ja convive com o mesmo descompasso. */
    const { data, error } = await (a.supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)("presenca_confirmar", {
      p_no_escritorio: await naRedeDoEscritorio(request, a.supabase),
    });
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
