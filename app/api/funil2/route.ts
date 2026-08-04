import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function clienteAutenticado(request: Request) {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

export async function GET(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  const db = auth.db;
  const [{ data: leads, error: e1 }, { data: momentos, error: e2 }, { data: eventos, error: e3 }] = await Promise.all([
    db.from("f2_lead").select("*").order("proxima_acao_em", { ascending: true }),
    db.from("f2_momento_config").select("*").eq("ativo", true).order("ordem", { ascending: true }),
    db.from("f2_evento").select("id,funil_lead_id,tipo,titulo,detalhe,payload,criado_em").order("criado_em", { ascending: false }).limit(100),
  ]);
  if (e1 || e2 || e3) {
    const message = e1?.message || e2?.message || e3?.message || "Falha ao carregar o Funil 2.0.";
    return Response.json({ error: message }, { status: message.toLowerCase().includes("permission") ? 403 : 502 });
  }
  return Response.json({ leads: leads ?? [], momentos: momentos ?? [], eventos: eventos ?? [], limite: 2, laboratorio: true });
}

export async function PATCH(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  const versao = Number(body.versao);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(versao) || versao < 1) {
    return Response.json({ error: "Lead ou versão inválidos." }, { status: 422 });
  }

  const db = auth.db;
  const action = String(body.action ?? "");
  let rpc = "";
  let args: Record<string, unknown> = {};
  if (action === "atualizarMomento") {
    const momento = String(body.momentoCodigo ?? "");
    if (!/^[A-Z_]{3,50}$/.test(momento)) return Response.json({ error: "Momento inválido." }, { status: 422 });
    const prazo = body.prazoCombinado ? new Date(String(body.prazoCombinado)) : null;
    if (prazo && Number.isNaN(prazo.getTime())) return Response.json({ error: "Prazo combinado inválido." }, { status: 422 });
    rpc = "f2_atualizar_momento";
    args = { p_id: id, p_versao: versao, p_momento_codigo: momento, p_prazo_combinado: prazo?.toISOString() ?? null, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "confirmarAcao") {
    const fonte = body.fonte === "dapi" ? "dapi" : body.fonte === "registro_operacional" ? "registro_operacional" : "";
    if (!fonte) return Response.json({ error: "Fonte de confirmação inválida." }, { status: 422 });
    rpc = "f2_confirmar_acao";
    args = { p_id: id, p_versao: versao, p_fonte: fonte, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else {
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  const { data, error } = await db.rpc(rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
  if (resultado.ok === false) return Response.json({ error: resultado.erro || "Ação não permitida." }, { status: 409 });
  return Response.json({ ok: true, resultado });
}
