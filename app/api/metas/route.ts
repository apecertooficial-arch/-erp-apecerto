import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

type ErroMetas = { code?: string; message?: string } | null | undefined;

function falhaMetas(error: ErroMetas, operacao: string) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("metas_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : "Não foi possível concluir a operação de metas no momento.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : 502 });
}

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
  if (error) return falhaMetas(error, "carregar_metas");
  return Response.json({ metas: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);

  const { data: me, error: meError } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  if (meError) return falhaMetas(meError, "autorizar_alteracao");
  if (!me || !papelNoGrupo(me.role, "metas")) return Response.json({ error: "Apenas administradores podem definir metas." }, { status: 403 });

  if (action === "save") {
    const corretorId = body.corretorId === null || body.corretorId === "" || body.corretorId === "global" ? null : Number(body.corretorId);
    const periodoTipo = clean(body.periodoTipo, 20);
    const ano = Number(body.ano);
    const periodo = Number.isFinite(Number(body.periodo)) ? Number(body.periodo) : 0;
    const metaVgvVazio = body.metaVgv == null || (typeof body.metaVgv === "string" && body.metaVgv.trim() === "");
    const metaVendasVazio = body.metaVendas == null || (typeof body.metaVendas === "string" && body.metaVendas.trim() === "");
    const metaVgv = Number(body.metaVgv);
    const metaVendas = Number(body.metaVendas);
    const periodoValido = periodoTipo === "mensal"
      ? Number.isInteger(periodo) && periodo >= 1 && periodo <= 12
      : periodoTipo === "semestral"
        ? Number.isInteger(periodo) && periodo >= 1 && periodo <= 2
        : periodoTipo === "anual" && periodo === 0;
    if (!periodoValido || !Number.isInteger(ano) || ano < 2000 || ano > 2100 || metaVgvVazio || metaVendasVazio || !Number.isFinite(metaVgv) || metaVgv < 0 || !Number.isInteger(metaVendas) || metaVendas < 0) {
      return Response.json({ error: "Preencha período, ano e valores válidos." }, { status: 422 });
    }
    if (corretorId !== null && (!Number.isSafeInteger(corretorId) || corretorId <= 0)) return Response.json({ error: "Corretor inválido." }, { status: 422 });
    let existQ = auth.supabase.from("metas").select("id").eq("periodo_tipo", periodoTipo).eq("ano", ano).eq("periodo", periodo);
    existQ = corretorId === null ? existQ.is("corretor_id", null) : existQ.eq("corretor_id", corretorId);
    const { data: existing, error: existingError } = await existQ.maybeSingle();
    if (existingError) return falhaMetas(existingError, "localizar_meta");
    if (existing) {
      const { data: updated, error } = await auth.supabase.from("metas").update({ meta_vgv: metaVgv, meta_vendas: metaVendas, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").maybeSingle();
      if (error) return falhaMetas(error, "atualizar_meta");
      if (!updated) return Response.json({ error: "A meta deixou de existir antes da atualização.", erro: "meta_conflito" }, { status: 409 });
    } else {
      const { data: created, error } = await auth.supabase.from("metas").insert({ corretor_id: corretorId, periodo_tipo: periodoTipo, ano, periodo, meta_vgv: metaVgv, meta_vendas: metaVendas, criado_por: auth.user.id }).select("id").maybeSingle();
      if (error) return falhaMetas(error, "criar_meta");
      if (!created) return falhaMetas(null, "confirmar_criacao_meta");
    }
    return Response.json({ success: true });
  }

  if (action === "delete") {
    const id = clean(body.id, 50);
    if (!id) return Response.json({ error: "Meta inválida." }, { status: 422 });
    const { data: deleted, error } = await auth.supabase.from("metas").delete().eq("id", id).select("id").maybeSingle();
    if (error) return falhaMetas(error, "apagar_meta");
    if (!deleted) return Response.json({ error: "Meta não encontrada.", erro: "meta_nao_encontrada" }, { status: 404 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação de metas desconhecida." }, { status: 400 });
}
