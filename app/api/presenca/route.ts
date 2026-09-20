import { createServerSupabaseClient } from "../../lib/supabase/server";

type SupabaseLike = ReturnType<typeof createServerSupabaseClient>;
type ErroPresenca = { code?: string; message?: string } | null | undefined;

export const dynamic = "force-dynamic";

function falhaPresenca(error: ErroPresenca, operacao: string) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("presenca_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : "Não foi possível verificar a presença no momento. Tente novamente.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : 502 });
}

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

async function naRedeDoEscritorio(request: Request, supabase: SupabaseLike) {
  const ip = ipDaRequisicao(request);
  if (!ip) return { noEscritorio: false, error: null };
  const { data, error } = await supabase.rpc("presenca_ip_confere", { p_ip: ip });
  return { noEscritorio: data === true, error };
}

export async function GET(request: Request) {
  const a = await auth(request);
  if (!a) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("config")) {
    const [config, corretores] = await Promise.all([
      a.supabase.rpc("presenca_config_ler"),
      a.supabase.from("corretores").select("id,nome").eq("ativo", true).order("nome"),
    ]);
    const firstError = config.error ?? corretores.error;
    if (firstError) return falhaPresenca(firstError, config.error ? "carregar_configuracao" : "carregar_corretores");
    return Response.json({ config: config.data, corretores: corretores.data ?? [] });
  }
  const rede = await naRedeDoEscritorio(request, a.supabase);
  if (rede.error) return falhaPresenca(rede.error, "conferir_rede_escritorio");
  const { data, error } = await a.supabase.rpc("presenca_status");
  if (error) return falhaPresenca(error, "carregar_status");

  const status = data && typeof data === "object" && !Array.isArray(data) ? data : { ativa: false, prompt: false };
  return Response.json({ ...status, no_escritorio_ip: rede.noEscritorio });
}

export async function POST(request: Request) {
  const a = await auth(request);
  if (!a) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "confirm") {
    return Response.json({
      error: "A confirmação de presença deve passar pela validação segura da rede do escritório.",
    }, { status: 409 });
  }
  if (action === "drop") {
    const { data, error } = await a.supabase.rpc("presenca_derrubar");
    if (error) return falhaPresenca(error, "sair_distribuicao");
    if (!data || typeof data !== "object" || Array.isArray(data) || (data as { ok?: boolean }).ok !== true) {
      return Response.json({ error: "Não foi possível confirmar a saída da distribuição.", erro: "presenca_nao_alterada" }, { status: 409 });
    }
    return Response.json(data);
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
    if (error) return falhaPresenca(error, "salvar_configuracao");
    return Response.json({ config: data });
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
