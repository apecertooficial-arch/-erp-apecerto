import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase };
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [cfg, saude] = await Promise.all([
    auth.supabase.rpc("distribuicao_config_ler"),
    auth.supabase.rpc("distribuicao_saude"),
  ]);
  if (cfg.error) return Response.json({ error: cfg.error.message }, { status: 502 });
  if (!cfg.data) return Response.json({ error: "Apenas administradores podem ver as regras de distribuição." }, { status: 403 });
  return Response.json({ config: cfg.data, saude: saude.data ?? null });
}

export async function POST(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const time = (v: unknown) => typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
  const modo = typeof body.modoForaJanela === "string" && ["quem_veio_no_dia", "todos_do_bloco", "nao_distribuir"].includes(body.modoForaJanela) ? body.modoForaJanela : null;
  const modoRodizio = typeof body.modoRodizio === "string" && ["fila_circular", "placar_justo"].includes(body.modoRodizio) ? body.modoRodizio : null;
  const { error } = await auth.supabase.rpc("distribuicao_config_salvar", {
    p_janela_inicio: time(body.janelaInicio),
    p_janela_fim: time(body.janelaFim),
    p_receber_ate: time(body.receberAte),
    p_modo_fora_janela: modo,
    p_modo_rodizio: modoRodizio,
    p_fds_exige_presencas: Number.isSafeInteger(Number(body.fdsExigePresencas)) ? Number(body.fdsExigePresencas) : null,
    p_failover_envio: typeof body.failoverEnvio === "boolean" ? body.failoverEnvio : null,
    p_failover_transfere_lead: typeof body.failoverTransfereLead === "boolean" ? body.failoverTransfereLead : null,
    p_resgate_orfaos: typeof body.resgateOrfaos === "boolean" ? body.resgateOrfaos : null,
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ success: true });
}
