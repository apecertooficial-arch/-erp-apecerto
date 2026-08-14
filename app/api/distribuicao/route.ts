import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, userId: data.user.id };
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
  const { data: corretores } = await auth.supabase.from("corretores").select("id,nome,ativo,forcar_distribuicao").eq("ativo", true).order("nome");
  return Response.json({ config: cfg.data, saude: saude.data ?? null, corretores: corretores ?? [] });
}

export async function POST(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;

  // Voto de minerva — SÓ admin liga/desliga, por corretor. Auditado.
  if (body.action === "minerva") {
    const { data: me } = await auth.supabase.from("usuarios").select("role,nome").eq("id", auth.userId).maybeSingle();
    if ((me as { role?: string } | null)?.role !== "admin") return Response.json({ error: "Só administradores podem usar o voto de minerva." }, { status: 403 });
    const corretorId = Number(body.corretorId);
    const ligado = body.on === true;
    if (!Number.isSafeInteger(corretorId) || corretorId <= 0) return Response.json({ error: "Corretor inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("corretores").update({ forcar_distribuicao: ligado } as never).eq("id", corretorId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ success: true });
  }

  const time = (v: unknown) => typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
  const modo = typeof body.modoForaJanela === "string" && ["quem_veio_no_dia", "todos_do_bloco", "nao_distribuir"].includes(body.modoForaJanela) ? body.modoForaJanela : null;
  const modoRodizio = typeof body.modoRodizio === "string" && ["fila_circular", "placar_justo", "sequencial_por_peso"].includes(body.modoRodizio) ? body.modoRodizio : null;
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
