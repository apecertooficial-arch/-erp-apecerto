import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const { data, error } = await auth.supabase
    .from("metas")
    .select("id,corretor_id,periodo_tipo,ano,periodo,meta_vgv,meta_vendas")
    .order("ano", { ascending: false })
    .order("periodo_tipo")
    .order("periodo");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ metas: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);

  const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  if (!me || !["admin", "gestor"].includes(me.role)) return Response.json({ error: "Apenas administradores podem definir metas." }, { status: 403 });

  if (action === "save") {
    const corretorId = body.corretorId === null || body.corretorId === "" || body.corretorId === "global" ? null : Number(body.corretorId);
    const periodoTipo = clean(body.periodoTipo, 20);
    const ano = Number(body.ano);
    const periodo = Number.isFinite(Number(body.periodo)) ? Number(body.periodo) : 0;
    const metaVgv = Number(body.metaVgv) || 0;
    const metaVendas = Math.max(0, Math.round(Number(body.metaVendas) || 0));
    if (!["mensal", "semestral", "anual"].includes(periodoTipo) || !Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      return Response.json({ error: "Preencha período, ano e valores válidos." }, { status: 422 });
    }
    if (corretorId !== null && !Number.isSafeInteger(corretorId)) return Response.json({ error: "Corretor inválido." }, { status: 422 });
    let existQ = auth.supabase.from("metas").select("id").eq("periodo_tipo", periodoTipo).eq("ano", ano).eq("periodo", periodo);
    existQ = corretorId === null ? existQ.is("corretor_id", null) : existQ.eq("corretor_id", corretorId);
    const { data: existing } = await existQ.maybeSingle();
    if (existing) {
      const { error } = await auth.supabase.from("metas").update({ meta_vgv: metaVgv, meta_vendas: metaVendas, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return Response.json({ error: error.message }, { status: 502 });
    } else {
      const { error } = await auth.supabase.from("metas").insert({ corretor_id: corretorId, periodo_tipo: periodoTipo, ano, periodo, meta_vgv: metaVgv, meta_vendas: metaVendas, criado_por: auth.user.id });
      if (error) return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json({ success: true });
  }

  if (action === "delete") {
    const id = clean(body.id, 50);
    if (!id) return Response.json({ error: "Meta inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("metas").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação de metas desconhecida." }, { status: 400 });
}
