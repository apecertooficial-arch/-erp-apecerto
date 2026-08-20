import { createServerSupabaseClient } from "../../lib/supabase/server";

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
  const [
    { data, error },
    { data: digitalHealth, error: digitalError },
    { data: deliveryHealth, error: deliveryError },
    { data: digitalJourney, error: journeyError },
  ] = await Promise.all([
    supabase.rpc("tracking_360_ceo", { p_days: days }),
    supabase.rpc("tracking_360_digital_health", { p_days: days }),
    supabase.rpc("tracking_delivery_health", { p_days: days }),
    supabase.rpc("tracking_360_jornada_digital", { p_days: days }),
  ]);

  if (error || digitalError || deliveryError || journeyError) {
    console.error("tracking_360 falhou:", error?.message ?? digitalError?.message ?? deliveryError?.message ?? journeyError?.message);
    return Response.json({ error: "Não foi possível carregar a Inteligência agora." }, { status: 502 });
  }

  return Response.json(
    {
      resumo: {
        ...(data as Record<string, unknown>),
        digital_health: digitalHealth,
        delivery_health: deliveryHealth,
        digital_journey: digitalJourney,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
