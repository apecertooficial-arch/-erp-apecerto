import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelNoGrupo } from "../../lib/papeis";
import { mutateMetaAtomic, type MetasRpcClient } from "./mutation-rpc";

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
  const requestId = clean(body.requestId, 60);

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
    if (!requestId) return Response.json({ error: "A solicitação da meta é inválida. Atualize a tela e tente novamente." }, { status: 422 });
    const result = await mutateMetaAtomic(auth.supabase as unknown as MetasRpcClient, {
      operation: "salvar",
      metaId: null,
      requestId,
      payload: { corretor_id: corretorId, periodo_tipo: periodoTipo, ano, periodo, meta_vgv: metaVgv, meta_vendas: metaVendas },
    });
    if ("internalError" in result && result.internalError && result.status >= 500) console.error("metas_rpc_falhou", { operacao: "salvar", codigo: result.internalError.code ?? "desconhecido" });
    return Response.json(result.body, { status: result.status });
  }

  if (action === "delete") {
    const id = clean(body.id, 50);
    if (!id || !requestId) return Response.json({ error: "Meta ou solicitação inválida." }, { status: 422 });
    const result = await mutateMetaAtomic(auth.supabase as unknown as MetasRpcClient, { operation: "remover", metaId: id, requestId, payload: {} });
    if ("internalError" in result && result.internalError && result.status >= 500) console.error("metas_rpc_falhou", { operacao: "remover", codigo: result.internalError.code ?? "desconhecido" });
    return Response.json(result.body, { status: result.status });
  }

  return Response.json({ error: "Ação de metas desconhecida." }, { status: 400 });
}
