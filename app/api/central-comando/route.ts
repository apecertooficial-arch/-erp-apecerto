import type { SupabaseClient } from "@supabase/supabase-js";
import { ga4Configurado, lerGa4 } from "../../lib/ga4";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const GESTAO = new Set(["admin", "gerente", "gestor", "diretor", "executivo"]);

type RpcResult = { data: unknown; error: { message?: string } | null };

async function autenticar(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("role,ativo")
    .eq("id", data.user.id)
    .maybeSingle();
  const role = String(perfil?.role ?? "corretor");
  if (!perfil?.ativo || !GESTAO.has(role)) return { denied: true as const };
  return { denied: false as const, supabase, user: data.user, token, role };
}

function periodo(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("days") ?? 30);
  return Number.isFinite(requested) ? Math.max(1, Math.min(Math.trunc(requested), 365)) : 30;
}

function dataIso(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = await autenticar(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.denied) return Response.json({ error: "A Central de Comando é restrita à gestão." }, { status: 403 });

  const days = periodo(request);
  const fim = new Date();
  const inicio = new Date(fim.getTime() - (days - 1) * 86_400_000);
  const loose = auth.supabase as unknown as SupabaseClient;
  const rpc = (auth.supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  }).rpc.bind(auth.supabase);

  const [central, tracking, attribution, media, ga4, alertActions] = await Promise.all([
    rpc("central_comando_dashboard", { p_days: days }),
    rpc("tracking_360_dashboard", { p_days: days }),
    rpc("tracking_360_attribution_scope", { p_days: days }),
    auth.supabase.functions
      .invoke("marketing-ads-read", { body: { days } })
      .catch(() => ({ data: null, error: { message: "Leitura de mídia indisponível." } })),
    lerGa4(dataIso(inicio), dataIso(fim)).catch(() => null),
    loose.from("central_alerta_acoes").select("alerta_chave,responsavel,prazo,visto,resolvido,atualizado_em"),
  ]);

  const firstError = central.error || tracking.error || attribution.error;
  if (firstError) {
    const forbidden = /forbidden|permission|permissão|acesso_negado|42501/i.test(firstError.message ?? "");
    return Response.json(
      { error: forbidden ? "A Central de Comando é restrita à gestão." : "Não foi possível consolidar os dados agora." },
      { status: forbidden ? 403 : 502 },
    );
  }

  return Response.json({
    central: central.data,
    tracking: { ...(tracking.data as Record<string, unknown>), attribution: attribution.data },
    media: media.data ?? {
      ok: false,
      meta: { status: "indisponivel", motivo: media.error?.message ?? "Leitura indisponível.", anuncios: [] },
      google: { status: "indisponivel", motivo: "Leitura indisponível.", anuncios: [] },
    },
    ga4,
    ga4_configurado: ga4Configurado(),
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
  if (auth.denied) return Response.json({ error: "A Central de Comando é restrita à gestão." }, { status: 403 });

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
