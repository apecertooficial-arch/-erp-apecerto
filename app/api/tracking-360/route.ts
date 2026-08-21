import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type RpcResult = { data: unknown; error: { message?: string } | null };

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = Math.max(1, Math.min(Number.isFinite(requestedDays) ? Math.trunc(requestedDays) : 30, 365));
  const supabase = createServerSupabaseClient(accessToken);
  const { data: auth, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !auth.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const rpc = (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> }).rpc.bind(supabase);
  const [dashboard, attribution] = await Promise.all([
    rpc("tracking_360_dashboard", { p_days: days }),
    rpc("tracking_360_attribution_scope", { p_days: days }),
  ]);
  const error = dashboard.error || attribution.error;
  if (error) {
    const forbidden = /forbidden|permission|permissão|42501/i.test(error.message || "");
    return Response.json({ error: forbidden ? "Acesso restrito à gestão." : "Não foi possível carregar o tracking.", detail: error.message }, { status: forbidden ? 403 : 502 });
  }

  return Response.json({ ...(dashboard.data as Record<string, unknown>), attribution: attribution.data }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
