import type { SupabaseClient } from "@supabase/supabase-js";
import { ga4Configurado, lerGa4 } from "../../lib/ga4";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelNoGrupo } from "../../lib/papeis";
import { dataOperacao } from "../../lib/timezone";

export const dynamic = "force-dynamic";

type RpcResult = { data: unknown; error: { message?: string } | null };
type AuthResult =
  | { kind: "unavailable" }
  | { kind: "denied" }
  | { kind: "ok"; supabase: ReturnType<typeof createServerSupabaseClient>; user: { id: string }; token: string; role: string };

async function autenticar(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil, error: profileError } = await supabase
    .from("usuarios")
    .select("role,ativo")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) return { kind: "unavailable" } as const satisfies AuthResult;
  const role = String(perfil?.role ?? "corretor");
  if (!perfil?.ativo || !papelNoGrupo(role, "gestao")) return { kind: "denied" } as const satisfies AuthResult;
  return { kind: "ok", supabase, user: data.user, token, role } as const satisfies AuthResult;
}

function periodo(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("days") ?? 30);
  return Number.isFinite(requested) ? Math.max(1, Math.min(Math.trunc(requested), 365)) : 30;
}

function dataIso(value: Date) {
  return dataOperacao(value);
}

function registro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeroNaoNegativo(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function respostaErroCentral(error: { message?: string } | null) {
  const forbidden = /forbidden|permission|permissão|acesso_negado|42501/i.test(error?.message ?? "");
  return Response.json(
    { error: forbidden ? "A Central de Comando é restrita à gestão." : "Não foi possível consolidar os dados agora." },
    { status: forbidden ? 403 : 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

async function gestaoMobile(supabase: ReturnType<typeof createServerSupabaseClient>, days: number) {
  const rpc = (supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  }).rpc.bind(supabase);
  const [central, teamExecution] = await Promise.all([
    rpc("central_comando_dashboard_v2", { p_days: days }),
    rpc("central_comando_equipe_execucao", { p_days: days }),
  ]);
  if (central.error || teamExecution.error) return respostaErroCentral(central.error || teamExecution.error);
  if (!registro(central.data)) {
    return Response.json(
      { error: "Os indicadores gerenciais chegaram em formato inválido." },
      { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  const centralData = central.data;
  if (!registro(centralData.summary) || !Array.isArray(centralData.team) || !Array.isArray(teamExecution.data)) {
    return Response.json(
      { error: "Os indicadores gerenciais chegaram em formato inválido." },
      { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  const summaryData = centralData.summary;

  const summaryKeys = ["acoes_vencidas", "clientes_aguardando", "clientes_criticos", "visitas_sem_feedback", "corretores_ativos"] as const;
  const summary = Object.fromEntries(summaryKeys.map((key) => [key, numeroNaoNegativo(summaryData[key])]));
  if (Object.values(summary).some((value) => value === null)) {
    return Response.json(
      { error: "Os indicadores gerenciais estão incompletos." },
      { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const executionByBroker = new Map<string, Record<string, unknown>>();
  for (const item of teamExecution.data) {
    if (registro(item) && item.corretor_id != null) executionByBroker.set(String(item.corretor_id), item);
  }
  const team: Array<Record<string, unknown>> = [];
  for (const item of centralData.team) {
    if (!registro(item) || (typeof item.corretor_id !== "string" && typeof item.corretor_id !== "number") || typeof item.nome !== "string" || !item.nome.trim()) {
      return Response.json(
        { error: "A fila gerencial por corretor está incompleta." },
        { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    const execution = executionByBroker.get(String(item.corretor_id));
    if (!execution) {
      return Response.json(
        { error: "A execução de um corretor ativo não foi consolidada." },
        { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    const metrics = {
      carteira_ativa: numeroNaoNegativo(item.carteira_ativa),
      acoes_vencidas: numeroNaoNegativo(item.acoes_vencidas),
      clientes_aguardando: numeroNaoNegativo(item.clientes_aguardando),
      clientes_criticos: numeroNaoNegativo(item.clientes_criticos),
      carteira_trabalhada: numeroNaoNegativo(execution.carteira_trabalhada),
      pct_carteira_trabalhada: execution.pct_carteira_trabalhada == null ? null : numeroNaoNegativo(execution.pct_carteira_trabalhada),
    };
    if (metrics.carteira_ativa === null || metrics.acoes_vencidas === null || metrics.clientes_aguardando === null || metrics.clientes_criticos === null || metrics.carteira_trabalhada === null || (metrics.carteira_ativa > 0 && metrics.pct_carteira_trabalhada === null)) {
      return Response.json(
        { error: "A fila gerencial por corretor contém métricas inválidas." },
        { status: 502, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    team.push({
      corretor_id: item.corretor_id,
      nome: item.nome.trim().slice(0, 100),
      online: item.online === true,
      no_escritorio: item.no_escritorio === true,
      ...metrics,
    });
  }

  return Response.json(
    { summary, team, period_days: days, generated_at: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function GET(request: Request) {
  const auth = await autenticar(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.kind === "unavailable") return Response.json({ error: "Não foi possível confirmar seu perfil agora." }, { status: 502 });
  if (auth.kind === "denied") return Response.json({ error: "A Central de Comando é restrita à gestão." }, { status: 403 });

  const days = periodo(request);
  const section = new URL(request.url).searchParams.get("section");
  if (section === "gestao-mobile") return gestaoMobile(auth.supabase, days);
  const fim = new Date();
  const inicio = new Date(fim.getTime() - (days - 1) * 86_400_000);
  const loose = auth.supabase as unknown as SupabaseClient;
  const rpc = (auth.supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  }).rpc.bind(auth.supabase);

  const [central, teamExecution, tracking, attribution, quality, media, ga4, alertActions] = await Promise.all([
    rpc("central_comando_dashboard_v2", { p_days: days }),
    rpc("central_comando_equipe_execucao", { p_days: days }),
    rpc("central_comando_site_marketing", { p_days: days }),
    rpc("central_comando_atribuicao_marketing", { p_days: days }),
    rpc("central_comando_qualidade_dados", { p_days: days }),
    auth.supabase.functions
      .invoke("marketing-ads-read", { body: { days } })
      .catch(() => ({ data: null, error: { message: "Leitura de mídia indisponível." } })),
    lerGa4(dataIso(inicio), dataIso(fim)).catch(() => null),
    loose.from("central_alerta_acoes").select("alerta_chave,responsavel,prazo,visto,resolvido,atualizado_em"),
  ]);

  const firstError = central.error || teamExecution.error || tracking.error || attribution.error || quality.error;
  if (firstError) {
    const forbidden = /forbidden|permission|permissão|acesso_negado|42501/i.test(firstError.message ?? "");
    return Response.json(
      { error: forbidden ? "A Central de Comando é restrita à gestão." : "Não foi possível consolidar os dados agora." },
      { status: forbidden ? 403 : 502 },
    );
  }

  const mediaData = media.data ?? {
    ok: false,
    meta: { status: "indisponivel", motivo: media.error?.message ?? "Leitura indisponível.", anuncios: [] },
    google: { status: "indisponivel", motivo: "Leitura indisponível.", anuncios: [] },
  };
  const mediaRecord = mediaData as Record<string, unknown>;
  const metaRecord = (mediaRecord.meta ?? {}) as Record<string, unknown>;
  const googleRecord = (mediaRecord.google ?? {}) as Record<string, unknown>;
  const ga4IsConfigured = ga4Configurado();
  const centralRecord = (central.data ?? {}) as Record<string, unknown>;
  const teamRows = Array.isArray(centralRecord.team) ? centralRecord.team : [];
  const executionRows = Array.isArray(teamExecution.data) ? teamExecution.data : [];
  const executionByBroker = new Map(
    executionRows.map((row) => [String((row as Record<string, unknown>).corretor_id), row as Record<string, unknown>]),
  );
  const centralData = {
    ...centralRecord,
    team: teamRows.map((row) => {
      const broker = row as Record<string, unknown>;
      return { ...broker, ...(executionByBroker.get(String(broker.corretor_id)) ?? {}) };
    }),
  };

  return Response.json({
    central: centralData,
    tracking: { ...(tracking.data as Record<string, unknown>), attribution: attribution.data, quality: quality.data },
    media: mediaData,
    ga4,
    ga4_configurado: ga4IsConfigured,
    sources: {
      crm: { status: "conectado", motivo: null },
      site_eventos: { status: "conectado", motivo: null },
      meta: { status: String(metaRecord.status ?? "indisponivel"), motivo: metaRecord.motivo ?? null },
      google: { status: String(googleRecord.status ?? "indisponivel"), motivo: googleRecord.motivo ?? null },
      ga4: ga4
        ? { status: "conectado", motivo: null }
        : ga4IsConfigured
          ? { status: "erro", motivo: "A GA4 está configurada, mas a Data API não devolveu leitura neste recorte." }
          : { status: "nao_configurado", motivo: "Faltam GA4_SERVICE_ACCOUNT_JSON e GA4_PROPERTY_ID no servidor." },
    },
    alert_actions: alertActions.data ?? [],
    period_days: days,
    generated_at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function texto(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const auth = await autenticar(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.kind === "unavailable") return Response.json({ error: "Não foi possível confirmar seu perfil agora." }, { status: 502 });
  if (auth.kind === "denied") return Response.json({ error: "A Central de Comando é restrita à gestão." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const key = texto(body.key, 120);
  const action = texto(body.action, 20);
  if (!/^[a-z0-9:_-]+$/i.test(key)) return Response.json({ error: "Alerta inválido." }, { status: 422 });
  if (!new Set(["assign", "seen", "resolve", "reopen"]).has(action)) return Response.json({ error: "Ação inválida." }, { status: 422 });

  const loose = auth.supabase as unknown as SupabaseClient;
  const { data: existing } = await loose
    .from("central_alerta_acoes")
    .select("alerta_chave,responsavel,prazo,visto,resolvido")
    .eq("alerta_chave", key)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    alerta_chave: key,
    responsavel: existing?.responsavel ?? null,
    prazo: existing?.prazo ?? null,
    visto: existing?.visto ?? false,
    resolvido: existing?.resolvido ?? false,
    atualizado_em: new Date().toISOString(),
    atualizado_por: auth.user.id,
  };

  if (action === "assign") {
    const responsavel = texto(body.responsavel, 80);
    const prazo = texto(body.prazo, 10);
    if (!responsavel) return Response.json({ error: "Escolha a pessoa ou equipe responsável." }, { status: 422 });
    if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return Response.json({ error: "Prazo inválido." }, { status: 422 });
    patch.responsavel = responsavel;
    patch.prazo = prazo || null;
  }
  if (action === "seen") patch.visto = true;
  if (action === "resolve") { patch.visto = true; patch.resolvido = true; }
  if (action === "reopen") patch.resolvido = false;

  const { data, error } = await loose
    .from("central_alerta_acoes")
    .upsert(patch, { onConflict: "alerta_chave" })
    .select("alerta_chave,responsavel,prazo,visto,resolvido,atualizado_em")
    .single();

  if (error) return Response.json({ error: "Não foi possível atualizar o alerta." }, { status: 502 });
  return Response.json({ action: data });
}
