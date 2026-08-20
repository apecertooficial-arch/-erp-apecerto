import { createServerSupabaseClient } from "../../lib/supabase/server";
import { ga4Configurado, lerGa4 } from "../../lib/ga4";

export const dynamic = "force-dynamic";

const rolesGestao = new Set(["admin", "gerente", "diretor", "executivo"]);

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data: me } = await supabase
    .from("usuarios")
    .select("role,ativo")
    .eq("id", userData.user.id)
    .maybeSingle();
  const role = (me as { role?: string; ativo?: boolean } | null)?.role ?? "corretor";
  if (!me?.ativo || !rolesGestao.has(role)) return Response.json({ error: "Sem permissão." }, { status: 403 });

  const requestedDays = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(Math.round(requestedDays), 365)) : 30;
  const fim = new Date();
  const inicio = new Date(fim.getTime() - (days - 1) * 86_400_000);
  const dataIso = (valor: Date) => valor.toISOString().slice(0, 10);
  const [
    { data: operacao, error: operacaoError },
    { data: marketing, error: marketingError },
    midiaResultado,
    ga4,
  ] = await Promise.all([
    supabase.rpc("tracking_360_ceo", { p_days: days }),
    supabase.rpc("tracking_360_jornada_digital", { p_days: days }),
    supabase.functions.invoke("marketing-ads-read", { body: { days } }).catch(() => ({ data: null, error: { message: "Função de mídia indisponível" } })),
    lerGa4(dataIso(inicio), dataIso(fim)).catch(() => null),
  ]);

  if (operacaoError || marketingError) {
    console.error("inteligencia_decisao falhou:", operacaoError?.message ?? marketingError?.message);
    return Response.json({ error: "Não foi possível carregar a Inteligência agora." }, { status: 502 });
  }

  return Response.json(
    {
      resumo: {
        operacao,
        marketing: {
          ...(marketing as Record<string, unknown> | null),
          midia: midiaResultado.data ?? {
            meta: { status: "indisponivel", motivo: midiaResultado.error?.message ?? "Leitura indisponível", anuncios: [] },
            google: { status: "nao_configurado", motivo: "Credenciais do Google Ads não configuradas.", anuncios: [] },
          },
          ga4,
          ga4_configurado: ga4Configurado(),
        },
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
