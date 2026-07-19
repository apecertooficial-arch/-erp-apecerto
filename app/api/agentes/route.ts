import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function extractToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

async function authed(request: Request) {
  const token = extractToken(request);
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, token };
}

const str = (v: unknown, max = 8000) => (typeof v === "string" ? v.slice(0, max) : "");
const STATUSES = ["rascunho", "em_teste", "revisao", "aprovado", "publicado"];

export async function GET(request: Request) {
  const auth = await authed(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const slug = new URL(request.url).searchParams.get("slug");

  if (!slug) {
    const { data, error } = await auth.supabase
      .from("agentes_ia")
      .select("id,slug,nome,tipo,categoria,modelo,status,versao_atual,ativo,missao")
      .order("ativo", { ascending: false })
      .order("id");
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ agentes: data ?? [] });
  }

  const { data: agente, error: aErr } = await auth.supabase
    .from("agentes_ia")
    .select("id,slug,nome,tipo,categoria,modelo,status,versao_atual,ativo,missao,indicadores,publico,canais,gatilhos,system_prompt,config")
    .eq("slug", slug)
    .maybeSingle();
  if (aErr || !agente) return Response.json({ error: "Agente não encontrado." }, { status: 404 });

  const [links, ferrs, perms, cenarios, avals, execs] = await Promise.all([
    auth.supabase.from("agente_fonte_links").select("fonte_id").eq("agente_id", agente.id),
    auth.supabase.from("agente_ferramentas").select("id,slug,nome,tipo,requer_confirmacao,ativo").order("id"),
    auth.supabase.from("agente_ferramenta_permissoes").select("ferramenta_id,habilitado,perfis_autorizados").eq("agente_id", agente.id),
    auth.supabase.from("agente_cenarios").select("id,pergunta,categoria,peso,ferramentas_esperadas,fontes_esperadas").eq("agente_id", agente.id).order("id"),
    auth.supabase.from("agente_avaliacoes").select("cenario_id,agente_versao,nota_auto,aprovado,regras_descumpridas,criado_em").eq("agente_id", agente.id).order("criado_em", { ascending: false }).limit(400),
    auth.supabase.from("agente_execucoes").select("id,modelo,tokens_entrada,tokens_saida,custo_usd,status,ferramentas_acionadas,fontes_consultadas,latencia_ms,criado_em").eq("agente_id", agente.id).order("criado_em", { ascending: false }).limit(20),
  ]);

  const fonteLinks = (links.data ?? []).map((l) => l.fonte_id);
  const { data: fontes } = await auth.supabase
    .from("agente_fontes")
    .select("id,titulo,tipo,conteudo,versao,situacao,responsavel,validade,atualizado_em")
    .order("id", { ascending: false });

  // latest evaluation per cenario
  const latest = new Map<number, { cenario_id: number; agente_versao: number; nota_auto: number; aprovado: boolean; regras_descumpridas: string[] }>();
  for (const a of (avals.data ?? [])) if (!latest.has(a.cenario_id)) latest.set(a.cenario_id, a);

  return Response.json({
    agente,
    fontes: fontes ?? [],
    fonteLinks,
    ferramentas: ferrs.data ?? [],
    permissoes: perms.data ?? [],
    cenarios: cenarios.data ?? [],
    avaliacoes: [...latest.values()],
    execucoes: execs.data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await authed(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = str(body.action, 40);
  const slug = str(body.slug, 80);

  if (action === "salvar") {
    if (!slug) return Response.json({ error: "Agente não informado." }, { status: 422 });
    const update: Record<string, unknown> = {};
    if (typeof body.nome === "string") update.nome = str(body.nome, 120);
    if (typeof body.missao === "string") update.missao = str(body.missao, 2000);
    if (typeof body.system_prompt === "string") update.system_prompt = str(body.system_prompt, 20000);
    if (typeof body.modelo === "string") update.modelo = str(body.modelo, 40);
    if (typeof body.status === "string" && STATUSES.includes(body.status)) update.status = body.status;
    update.atualizado_em = new Date().toISOString();
    const { error } = await auth.supabase.from("agentes_ia").update(update).eq("slug", slug);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ ok: true });
  }

  if (action === "toggleFerramenta") {
    const agenteId = Number(body.agente_id), ferramentaId = Number(body.ferramenta_id);
    const habilitado = body.habilitado === true;
    if (!Number.isSafeInteger(agenteId) || !Number.isSafeInteger(ferramentaId)) return Response.json({ error: "Parâmetros inválidos." }, { status: 422 });
    const { error } = await auth.supabase
      .from("agente_ferramenta_permissoes")
      .upsert({ agente_id: agenteId, ferramenta_id: ferramentaId, habilitado }, { onConflict: "agente_id,ferramenta_id" });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ ok: true });
  }

  if (action === "salvarFonte") {
    const SIT = ["rascunho", "aprovada", "vencida", "arquivada"];
    const titulo = str(body.titulo, 200).trim();
    if (!titulo) return Response.json({ error: "Informe o título da fonte." }, { status: 422 });
    const row: Record<string, unknown> = {
      titulo,
      tipo: str(body.tipo, 60) || "documento",
      conteudo: str(body.conteudo, 40000),
      responsavel: str(body.responsavel, 120) || null,
      versao: str(body.versao, 20) || null,
      validade: (typeof body.validade === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.validade)) ? body.validade : null,
      situacao: SIT.includes(body.situacao as string) ? body.situacao : "rascunho",
      atualizado_em: new Date().toISOString(),
    };
    const fonteId = Number(body.fonte_id);
    if (Number.isSafeInteger(fonteId) && fonteId > 0) {
      const { error } = await auth.supabase.from("agente_fontes").update(row).eq("id", fonteId);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ ok: true, fonte_id: fonteId });
    }
    const { data, error } = await auth.supabase.from("agente_fontes").insert(row).select("id").maybeSingle();
    if (error || !data) return Response.json({ error: error?.message || "Falha ao criar fonte." }, { status: 502 });
    const agenteId = Number(body.agente_id);
    if (Number.isSafeInteger(agenteId)) {
      await auth.supabase.from("agente_fonte_links").upsert({ agente_id: agenteId, fonte_id: data.id }, { onConflict: "agente_id,fonte_id" });
    }
    return Response.json({ ok: true, fonte_id: data.id });
  }

  if (action === "vincularFonte") {
    const agenteId = Number(body.agente_id), fonteId = Number(body.fonte_id);
    if (!Number.isSafeInteger(agenteId) || !Number.isSafeInteger(fonteId)) return Response.json({ error: "Parâmetros inválidos." }, { status: 422 });
    if (body.vincular === true) {
      const { error } = await auth.supabase.from("agente_fonte_links").upsert({ agente_id: agenteId, fonte_id: fonteId }, { onConflict: "agente_id,fonte_id" });
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ ok: true });
    }
    const { error } = await auth.supabase.from("agente_fonte_links").delete().eq("agente_id", agenteId).eq("fonte_id", fonteId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ ok: true });
  }

  if (action === "testar") {
    if (!slug || !body.input) return Response.json({ error: "Informe a mensagem de teste." }, { status: 422 });
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-router`;
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ agente_slug: slug, input: str(body.input, 2000) }) });
    return Response.json(await r.json(), { status: r.ok ? 200 : 502 });
  }

  if (action === "bateria") {
    if (!slug) return Response.json({ error: "Agente não informado." }, { status: 422 });
    const offset = Number(body.offset ?? 0), limit = Math.min(Number(body.limit ?? 5), 8);
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-testes`;
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ agente_slug: slug, offset, limit }) });
    return Response.json(await r.json(), { status: r.ok ? 200 : 502 });
  }

  return Response.json({ error: "Ação inválida." }, { status: 422 });
}
