import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "../../lib/supabase/database.types";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

type ErroAgentes = { code?: string; message?: string } | null | undefined;

function falhaAgentes(error: ErroAgentes, operacao: string, parcial = false) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("agentes_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: parcial
      ? "A operação foi aplicada apenas em parte. Não repita a ação; solicite reconciliação."
      : semPermissao
        ? "Você não tem permissão para concluir esta operação."
        : "Não foi possível concluir a operação de agentes no momento.",
    erro: parcial ? "reconciliacao_necessaria" : semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: parcial ? 502 : semPermissao ? 403 : 502 });
}

async function autenticar(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { status: "missing" as const };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return { status: "auth_error" as const, error };
  if (!data.user) return { status: "invalid" as const };
  return { status: "ok" as const, supabase, token, user: data.user };
}

async function acessoSupervisor(request: Request) {
  const auth = await autenticar(request);
  if (auth.status !== "ok") return auth;
  const { data: profile, error } = await auth.supabase
    .from("usuarios").select("role,ativo").eq("id", auth.user.id).maybeSingle();
  if (error) return { status: "profile_error" as const, error };
  if (!profile?.ativo || !papelNoGrupo(profile.role, "supervisao_ia")) return { status: "forbidden" as const };
  return auth;
}

function falhaAcesso(access: Awaited<ReturnType<typeof acessoSupervisor>>) {
  if (access.status === "missing" || access.status === "invalid") return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (access.status === "forbidden") return Response.json({ error: "Apenas a supervisão de IA pode acessar este laboratório." }, { status: 403 });
  if (access.status === "auth_error") return falhaAgentes(access.error, "autenticar");
  if (access.status === "profile_error") return falhaAgentes(access.error, "autorizar_supervisao");
  return falhaAgentes(null, "autorizar_supervisao");
}

async function respostaIntegracao(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json() as unknown;
  } catch {
    return Response.json({ error: "A integração de IA retornou uma resposta inválida.", erro: "falha_integracao" }, { status: 502 });
  }
  if (!response.ok) return Response.json({ error: "A integração de IA não concluiu a operação.", erro: "falha_integracao" }, { status: 502 });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "A integração de IA retornou uma resposta inválida.", erro: "falha_integracao" }, { status: 502 });
  }
  return Response.json(payload);
}

const str = (v: unknown, max = 8000) => (typeof v === "string" ? v.slice(0, max) : "");
const STATUSES = ["rascunho", "em_teste", "revisao", "aprovado", "publicado", "arquivado"];
const MODELOS = ["gpt-4o-mini", "gpt-4o", "gpt-5.4-nano", "gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol"];
const anonimizar = (texto: string) => texto
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
  .replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]")
  .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
  .replace(/\s+/g, " ").trim().slice(0, 500);

export async function GET(request: Request) {
  const access = await acessoSupervisor(request);
  if (access.status !== "ok") return falhaAcesso(access);
  const auth = access;
  const slug = new URL(request.url).searchParams.get("slug");

  if (!slug) {
    const { data, error } = await auth.supabase
      .from("agentes_ia")
      .select("id,slug,nome,tipo,categoria,modelo,status,versao_atual,ativo,missao")
      .order("ativo", { ascending: false })
      .order("id");
    return error ? falhaAgentes(error, "listar_agentes") : Response.json({ agentes: data ?? [] });
  }

  const { data: agente, error: aErr } = await auth.supabase
    .from("agentes_ia")
    .select("id,slug,nome,tipo,categoria,modelo,status,versao_atual,ativo,missao,indicadores,publico,canais,gatilhos,system_prompt,config")
    .eq("slug", slug)
    .maybeSingle();
  if (aErr) return falhaAgentes(aErr, "carregar_agente");
  if (!agente) return Response.json({ error: "Agente não encontrado." }, { status: 404 });

  const [links, ferrs, perms, cenarios, avals, execs] = await Promise.all([
    auth.supabase.from("agente_fonte_links").select("fonte_id").eq("agente_id", agente.id),
    auth.supabase.from("agente_ferramentas").select("id,slug,nome,tipo,requer_confirmacao,ativo").order("id"),
    auth.supabase.from("agente_ferramenta_permissoes").select("ferramenta_id,habilitado,perfis_autorizados").eq("agente_id", agente.id),
    auth.supabase.from("agente_cenarios").select("id,pergunta,categoria,peso,ferramentas_esperadas,fontes_esperadas").eq("agente_id", agente.id).order("id"),
    auth.supabase.from("agente_avaliacoes").select("cenario_id,agente_versao,nota_auto,aprovado,regras_descumpridas,criado_em").eq("agente_id", agente.id).order("criado_em", { ascending: false }).limit(400),
    auth.supabase.from("agente_execucoes").select("id,modelo,tokens_entrada,tokens_saida,custo_usd,status,ferramentas_acionadas,fontes_consultadas,latencia_ms,criado_em,avaliacao_humana,usuario,tela").eq("agente_id", agente.id).order("criado_em", { ascending: false }).limit(200),
  ]);
  const detailError = [links, ferrs, perms, cenarios, avals, execs].find((result) => result.error)?.error;
  if (detailError) return falhaAgentes(detailError, "carregar_detalhe");

  const fonteLinks = (links.data ?? []).map((l) => l.fonte_id);
  const { data: fontes, error: fontesError } = await auth.supabase
    .from("agente_fontes")
    .select("id,titulo,tipo,conteudo,versao,situacao,responsavel,validade,atualizado_em")
    .order("id", { ascending: false });
  if (fontesError) return falhaAgentes(fontesError, "carregar_fontes");

  const execucoes = execs.data ?? [];
  const desde = Date.now() - 30 * 86400000;
  const rec = execucoes.filter((e) => new Date(e.criado_em).getTime() >= desde);
  const ok = rec.filter((e) => e.status === "ok").length;
  const avaliadas = rec.filter((e) => e.avaliacao_humana === "util" || e.avaliacao_humana === "nao_util");
  const uteis = avaliadas.filter((e) => e.avaliacao_humana === "util").length;
  const minutosEconomizados = rec.reduce((total, e) => {
    const fs = Array.isArray(e.ferramentas_acionadas) ? e.ferramentas_acionadas : [];
    return total + fs.reduce<number>((s, item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return s;
      const registro = item as Record<string, unknown>;
      if (!("ferramenta" in registro)) return s;
      const nome = String(registro.ferramenta);
      return s + (nome.includes("visita") ? 8 : nome.includes("whatsapp") ? 5 : nome.includes("tarefa") || nome.includes("mover") ? 4 : 2);
    }, 0);
  }, 0);
  let piloto: { ok: boolean; participantes: number; ativos: number; execucoes_30d: number; jornadas: string[] } | null = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (supabaseUrl && publishableKey) {
    try {
      const pResp = await fetch(`${supabaseUrl}/rest/v1/sara_piloto_participantes?select=usuario_id,ativo`, {
        headers: { Authorization:`Bearer ${auth.token}`,apikey:publishableKey },cache:"no-store",
      });
      if (pResp.ok) {
        const rows = await pResp.json() as Array<{ usuario_id: string; ativo: boolean }>;
        const ativos = new Set(rows.filter((p) => p.ativo).map((p) => p.usuario_id));
        piloto = { ok:true,participantes:rows.length,ativos:ativos.size,execucoes_30d:rec.filter((e) => e.usuario && ativos.has(e.usuario)).length,jornadas:["Localizar lead","Agenda completa","Direção do dia"] };
      }
    } catch { /* métrica opcional; o restante do laboratório permanece disponível */ }
  }

  // latest evaluation per cenario
  const latest = new Map<number, { cenario_id: number; agente_versao: number; nota_auto: number; aprovado: boolean; regras_descumpridas: string[] }>();
  for (const a of (avals.data ?? [])) {
    if (a.cenario_id == null || latest.has(a.cenario_id)) continue;
    latest.set(a.cenario_id, {
      cenario_id: a.cenario_id,
      agente_versao: a.agente_versao ?? 0,
      nota_auto: a.nota_auto ?? 0,
      aprovado: a.aprovado === true,
      regras_descumpridas: a.regras_descumpridas ?? [],
    });
  }

  return Response.json({
    agente,
    fontes: fontes ?? [],
    fonteLinks,
    ferramentas: ferrs.data ?? [],
    permissoes: perms.data ?? [],
    cenarios: cenarios.data ?? [],
    avaliacoes: [...latest.values()],
    execucoes: execucoes.slice(0, 50),
    metricas: {
      execucoes_30d: rec.length,
      sucessos: ok,
      falhas: rec.length - ok,
      sucesso_pct: rec.length ? Math.round(100 * ok / rec.length) : 0,
      minutos_economizados: minutosEconomizados,
      avaliadas: avaliadas.length,
      satisfacao_pct: avaliadas.length ? Math.round(100 * uteis / avaliadas.length) : null,
      usuarios_ativos: new Set(rec.map((e) => e.usuario).filter(Boolean)).size,
    },
    piloto,
  });
}

export async function POST(request: Request) {
  const access = await acessoSupervisor(request);
  if (access.status !== "ok") return falhaAcesso(access);
  const auth = access;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Envie um corpo JSON válido." }, { status: 400 });
  }
  const action = str(body.action, 40);
  const slug = str(body.slug, 80);

  if (action === "salvar") {
    if (!slug) return Response.json({ error: "Agente não informado." }, { status: 422 });
    const update: TablesUpdate<"agentes_ia"> = {};
    if (typeof body.nome === "string") update.nome = str(body.nome, 120);
    if (typeof body.missao === "string") update.missao = str(body.missao, 2000);
    if (typeof body.system_prompt === "string") update.system_prompt = str(body.system_prompt, 20000);
    if (typeof body.modelo === "string") {
      const modelo = str(body.modelo, 40);
      if (!MODELOS.includes(modelo)) return Response.json({ error: "Modelo de IA inválido." }, { status: 422 });
      update.modelo = modelo;
    }
    if (typeof body.status === "string") {
      const status = str(body.status, 30);
      if (!STATUSES.includes(status)) return Response.json({ error: "Status do agente inválido." }, { status: 422 });
      update.status = status;
    }
    update.atualizado_em = new Date().toISOString();
    const { data: updated, error } = await auth.supabase.from("agentes_ia").update(update).eq("slug", slug).select("id").maybeSingle();
    if (error) return falhaAgentes(error, "atualizar_agente");
    if (!updated) return Response.json({ error: "Agente não encontrado.", erro: "confirmar_agente" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (action === "toggleFerramenta") {
    const agenteId = Number(body.agente_id), ferramentaId = Number(body.ferramenta_id);
    const habilitado = body.habilitado === true;
    if (!Number.isSafeInteger(agenteId) || !Number.isSafeInteger(ferramentaId)) return Response.json({ error: "Parâmetros inválidos." }, { status: 422 });
    const { data: permission, error } = await auth.supabase
      .from("agente_ferramenta_permissoes")
      .upsert({ agente_id: agenteId, ferramenta_id: ferramentaId, habilitado }, { onConflict: "agente_id,ferramenta_id" })
      .select("agente_id,ferramenta_id").maybeSingle();
    if (error) return falhaAgentes(error, "salvar_permissao_ferramenta");
    if (!permission) return falhaAgentes(null, "confirmar_permissao_ferramenta");
    return Response.json({ ok: true });
  }

  if (action === "salvarFonte") {
    const SIT = ["rascunho", "aprovada", "vencida", "arquivada"];
    const titulo = str(body.titulo, 200).trim();
    const situacao = str(body.situacao, 30);
    if (!titulo) return Response.json({ error: "Informe o título da fonte." }, { status: 422 });
    const row: TablesInsert<"agente_fontes"> = {
      titulo,
      tipo: str(body.tipo, 60) || "documento",
      conteudo: str(body.conteudo, 40000),
      responsavel: str(body.responsavel, 120) || null,
      versao: str(body.versao, 20) || null,
      validade: (typeof body.validade === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.validade)) ? body.validade : null,
      situacao: SIT.includes(situacao) ? situacao : "rascunho",
      atualizado_em: new Date().toISOString(),
    };
    const fonteId = Number(body.fonte_id);
    if (Number.isSafeInteger(fonteId) && fonteId > 0) {
      const { data: updated, error } = await auth.supabase.from("agente_fontes").update(row).eq("id", fonteId).select("id").maybeSingle();
      if (error) return falhaAgentes(error, "atualizar_fonte");
      if (!updated) return Response.json({ error: "Fonte não encontrada.", erro: "confirmar_fonte" }, { status: 404 });
      return Response.json({ ok: true, fonte_id: fonteId });
    }
    const agenteId = Number(body.agente_id);
    if (!Number.isSafeInteger(agenteId) || agenteId <= 0) return Response.json({ error: "Agente inválido para vincular a fonte." }, { status: 422 });
    const { data, error } = await auth.supabase.from("agente_fontes").insert(row).select("id").maybeSingle();
    if (error) return falhaAgentes(error, "criar_fonte");
    if (!data) return falhaAgentes(null, "confirmar_fonte");
    const { data: linked, error: linkError } = await auth.supabase.from("agente_fonte_links")
      .upsert({ agente_id: agenteId, fonte_id: data.id }, { onConflict: "agente_id,fonte_id" })
      .select("agente_id,fonte_id").maybeSingle();
    if (linkError || !linked) return falhaAgentes(linkError, "vincular_fonte_criada", true);
    return Response.json({ ok: true, fonte_id: data.id });
  }

  if (action === "vincularFonte") {
    const agenteId = Number(body.agente_id), fonteId = Number(body.fonte_id);
    if (!Number.isSafeInteger(agenteId) || !Number.isSafeInteger(fonteId)) return Response.json({ error: "Parâmetros inválidos." }, { status: 422 });
    if (body.vincular === true) {
      const { data: linked, error } = await auth.supabase.from("agente_fonte_links")
        .upsert({ agente_id: agenteId, fonte_id: fonteId }, { onConflict: "agente_id,fonte_id" })
        .select("agente_id,fonte_id").maybeSingle();
      if (error) return falhaAgentes(error, "vincular_fonte");
      if (!linked) return falhaAgentes(null, "confirmar_vinculo_fonte");
      return Response.json({ ok: true });
    }
    const { error } = await auth.supabase.from("agente_fonte_links").delete().eq("agente_id", agenteId).eq("fonte_id", fonteId);
    return error ? falhaAgentes(error, "desvincular_fonte") : Response.json({ ok: true });
  }

  if (action === "testar") {
    if (!slug || !body.input) return Response.json({ error: "Informe a mensagem de teste." }, { status: 422 });
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) return Response.json({ error: "A integração de IA não está configurada.", erro: "falha_integracao" }, { status: 502 });
    try {
      const r = await fetch(`${baseUrl}/functions/v1/ia-router`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ agente_slug: slug, input: str(body.input, 2000) }) });
      return respostaIntegracao(r);
    } catch {
      return Response.json({ error: "A integração de IA não respondeu.", erro: "falha_integracao" }, { status: 502 });
    }
  }

  if (action === "bateria") {
    if (!slug) return Response.json({ error: "Agente não informado." }, { status: 422 });
    const offset = Number(body.offset ?? 0), limit = Number(body.limit ?? 5);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 8) return Response.json({ error: "Paginação inválida para a bateria." }, { status: 422 });
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) return Response.json({ error: "A integração de IA não está configurada.", erro: "falha_integracao" }, { status: 502 });
    try {
      const r = await fetch(`${baseUrl}/functions/v1/ia-testes`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ agente_slug: slug, offset, limit }) });
      return respostaIntegracao(r);
    } catch {
      return Response.json({ error: "A integração de IA não respondeu.", erro: "falha_integracao" }, { status: 502 });
    }
  }

  if (action === "promoverDuvidas") {
    if (!slug) return Response.json({ error: "Agente não informado." }, { status: 422 });
    const { data: agente, error: agenteError } = await auth.supabase.from("agentes_ia").select("id").eq("slug", slug).maybeSingle();
    if (agenteError) return falhaAgentes(agenteError, "carregar_agente_promocao");
    if (!agente) return Response.json({ error: "Agente não encontrado." }, { status: 404 });
    const { data: execucoes, error } = await auth.supabase.from("agente_execucoes")
      .select("id,entrada").eq("agente_id", agente.id).eq("status", "ok").order("criado_em", { ascending: false }).limit(80);
    if (error) return falhaAgentes(error, "carregar_execucoes_promocao");
    const perguntas: Array<{ pergunta: string; execucao_id: number }> = [];
    for (const e of execucoes ?? []) {
      const entrada = e.entrada && typeof e.entrada === "object" && !Array.isArray(e.entrada) ? e.entrada : null;
      let texto = "";
      if (entrada && "input" in entrada && typeof entrada.input === "string") texto = entrada.input;
      if (!texto && entrada && "messages" in entrada && Array.isArray(entrada.messages)) {
        const usuarios = entrada.messages.filter((m) => m && typeof m === "object" && "role" in m && m.role === "user");
        const ultima = usuarios.at(-1);
        if (ultima && typeof ultima === "object" && !Array.isArray(ultima)) {
          const registro = ultima as Record<string, unknown>;
          if (typeof registro.content === "string") texto = registro.content;
        }
      }
      const pergunta = anonimizar(texto);
      if (pergunta.length >= 8 && !perguntas.some((p) => p.pergunta.toLowerCase() === pergunta.toLowerCase())) perguntas.push({ pergunta, execucao_id:e.id });
      if (perguntas.length >= 10) break;
    }
    if (!perguntas.length) return Response.json({ ok: true, criados: 0 });
    const existentes = await auth.supabase.from("agente_cenarios").select("pergunta").eq("agente_id", agente.id);
    if (existentes.error) return falhaAgentes(existentes.error, "carregar_cenarios_existentes");
    const ja = new Set((existentes.data ?? []).map((c) => c.pergunta.toLowerCase()));
    const novos: TablesInsert<"agente_cenarios">[] = perguntas.filter((p) => !ja.has(p.pergunta.toLowerCase())).map((p) => ({
      agente_id:agente.id,pergunta:p.pergunta,categoria:"duvida_real_anonimizada",peso:2,
      resposta_esperada:"Responder com dados reais, respeitar o escopo e pedir apenas a informação que faltar.",
      respostas_proibidas:["inventar dados","expor telefone completo","afirmar execução sem comprovante"],
      criterio_aprovacao:"Resposta útil, segura, verificável e coerente com a operação.",
      contexto:{ origem:"execucao_anonimizada",execucao_id:p.execucao_id },
    }));
    if (!novos.length) return Response.json({ ok:true,criados:0 });
    const { data: created, error: iErr } = await auth.supabase.from("agente_cenarios").insert(novos).select("id");
    if (iErr) return falhaAgentes(iErr, "criar_cenarios_promovidos");
    if ((created ?? []).length !== novos.length) return falhaAgentes(null, "confirmar_cenarios_promovidos", true);
    return Response.json({ ok:true,criados:novos.length });
  }

  return Response.json({ error: "Ação inválida." }, { status: 422 });
}
