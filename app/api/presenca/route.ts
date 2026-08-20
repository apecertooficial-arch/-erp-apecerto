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
function ipDaRequisicao(request: Request): string {
  const bruto =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0];
  return (bruto ?? "").trim();
}

async function naRedeDoEscritorio(request: Request, supabase: SupabaseLike): Promise<boolean> {
  const ip = ipDaRequisicao(request);
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
  const noEscritorio = await naRedeDoEscritorio(request, a.supabase);
  const { data, error } = await a.supabase.rpc("presenca_status");
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const status = data && typeof data === "object" && !Array.isArray(data) ? data : { ativa: false, prompt: false };
  return Response.json({ ...status, no_escritorio_ip: noEscritorio });
}

export async function POST(request: Request) {
  const a = await auth(request);
  if (!a) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "confirm") {
    /* O que decide a fila e ESTE valor, apurado no servidor. */
    const { data, error } = await a.supabase.rpc("presenca_confirmar", {
      p_no_escritorio: await naRedeDoEscritorio(request, a.supabase),
      /* O IP de origem tambem e gravado: sem ver o valor real nao da para
         descobrir por que a checagem falha -- se o cadastro esta velho, se a
         operadora mudou, ou se o corretor esta no 4G. */
      p_ip: ipDaRequisicao(request),
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
    const ativa = typeof body.ativa === "boolean" ? body.ativa : null;
    const diasSemana = Array.isArray(body.diasSemana) ? (body.diasSemana as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) : null;
    const horaInicio = typeof body.horaInicio === "string" ? body.horaInicio : null;
    const horaFim = typeof body.horaFim === "string" ? body.horaFim : null;
    const intervalo = Number(body.intervaloMin);
    const prazo = Number(body.prazoSeg);
    const corretores = Array.isArray(body.corretores) ? (body.corretores as unknown[]).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : null;
    if (ativa == null || diasSemana == null || !horaInicio || !horaFim || !Number.isFinite(intervalo) || !Number.isFinite(prazo) || corretores == null) {
      return Response.json({ error: "Configuração de presença incompleta." }, { status: 422 });
    }
    const { data, error } = await a.supabase.rpc("presenca_config_salvar", {
      p_ativa: ativa, p_dias_semana: diasSemana, p_inicio: horaInicio, p_fim: horaFim,
      p_intervalo: intervalo, p_prazo: prazo, p_corretores: corretores,
    });
    if (error) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ config: data });
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
