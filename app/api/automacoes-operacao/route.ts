import { createServerSupabaseClient } from "../../lib/supabase/server";
import { denyIfCannot, resolveEffectiveAccess } from "../../lib/supabase/authz";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function autenticar(request: Request) {
  const token = bearer(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) };
  }
  return { db: supabase, user: data.user };
}

function falhaOperacional(error: { code?: string; message?: string } | null, operacao: string) {
  const forbidden = error?.code === "42501"
    || /CENTRAL_ADMIN_REQUIRED|FORBIDDEN|permission|policy/i.test(error?.message ?? "");
  console.error("automacoes_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: forbidden
      ? "Somente a administração pode executar esta operação."
      : "A Central não conseguiu concluir a operação no momento.",
    erro: forbidden ? "sem_permissao" : "falha_banco",
  }, { status: forbidden ? 403 : 502 });
}

async function autorizar(request: Request, action: "consultar_execucoes" | "executar") {
  const auth = await autenticar(request);
  if (auth.erro) return auth;
  const access = await resolveEffectiveAccess(auth.db, auth.user.id);
  if (!access.resolved) return { erro: falhaOperacional(null, "validar_autorizacao") };
  if (!papelNoGrupo(access.role, "acesso_total")) {
    return { erro: Response.json({ error: "Somente a administração pode acessar a Central." }, { status: 403 }) };
  }
  const denied = denyIfCannot(access, [["automacoes", action]]);
  return denied ? { erro: denied } : auth;
}

async function lerComando(request: Request) {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(tamanho) && tamanho > 4_096) return null;
  const texto = await request.text().catch(() => "");
  if (!texto || texto.length > 4_096) return null;
  try {
    const body = JSON.parse(texto) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function respostaConfirmada(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return (data as { ok?: unknown }).ok === true;
}

function falhaDeDominio(data: unknown) {
  const resultado = data && typeof data === "object" && !Array.isArray(data)
    ? data as { erro?: unknown; motivo?: unknown }
    : {};
  const codigo = String(resultado.erro ?? resultado.motivo ?? "");
  const mensagens: Record<string, string> = {
    ITEM_NAO_ESTA_EM_QUARENTENA: "O item não está mais em quarentena.",
    fila_nao_encontrada: "O item de quarentena não existe mais.",
    fila_nao_esta_em_erro: "O item não está mais em quarentena.",
    execucao_ja_possui_parte_de_mensagem: "Este item já iniciou o envio e não pode trocar de versão.",
    automacao_publicada_indisponivel: "A automação publicada não está disponível para reprocessamento.",
    versao_original_sem_abordagem: "A versão original não possui uma abordagem compatível.",
    versao_publicada_invalida: "A versão publicada ainda não atende ao contrato seguro.",
  };
  return Response.json({
    error: mensagens[codigo] ?? "A operação não pôde ser confirmada. Atualize a Central antes de repetir.",
    erro: codigo || "reconciliacao_necessaria",
  }, { status: 409 });
}

export async function GET(request: Request) {
  const auth = await autorizar(request, "consultar_execucoes");
  if (auth.erro) return auth.erro;
  const { data, error } = await auth.db.rpc("central_saude_operacional");
  if (error) return falhaOperacional(error, "consultar_saude");
  return Response.json(data ?? {}, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await autorizar(request, "executar");
  if (auth.erro) return auth.erro;
  const body = await lerComando(request);
  if (!body) return Response.json({ error: "Envie um comando válido para a Central." }, { status: 422 });

  if (body.action === "reprocessar") {
    const filaId = Number(body.fila_id);
    if (!Number.isSafeInteger(filaId) || filaId < 1) {
      return Response.json({ error: "Item de quarentena inválido." }, { status: 422 });
    }
    const { data, error } = await auth.db.rpc("central_reprocessar_fila", { p_fila_id: filaId });
    if (error) return falhaOperacional(error, "reprocessar");
    if (!respostaConfirmada(data)) return falhaDeDominio(data);
    return Response.json(data ?? {});
  }

  if (body.action === "reprocessar_versao_publicada") {
    const filaId = Number(body.fila_id);
    if (!Number.isSafeInteger(filaId) || filaId < 1) {
      return Response.json({ error: "Item de quarentena inválido." }, { status: 422 });
    }
    const { data, error } = await auth.db.rpc("central_reprocessar_fila_versao_publicada", { p_fila_id: filaId });
    if (error) return falhaOperacional(error, "reprocessar_versao_publicada");
    if (!respostaConfirmada(data)) return falhaDeDominio(data);
    return Response.json(data ?? {});
  }

  if (body.action === "abordagem") {
    if (typeof body.liberar !== "boolean") {
      return Response.json({ error: "Informe se o envio deve ser liberado ou bloqueado." }, { status: 422 });
    }
    const { data, error } = await auth.db.rpc("central_abordagem_emergencia", { p_liberar: body.liberar });
    if (error) return falhaOperacional(error, "alterar_freio_abordagem");
    if (!respostaConfirmada(data)) return falhaDeDominio(data);
    return Response.json(data ?? {});
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 422 });
}
