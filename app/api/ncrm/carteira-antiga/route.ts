/**
 * Fase 6 PR B — Classificação assistida da carteira antiga.
 * ---------------------------------------------------------
 * GET  ?...filtros  → PRÉVIA SOMENTE LEITURA (teto rígido de 10 itens por lote).
 *                     Não cria atendimento, não move negócio, não envia mensagem,
 *                     não altera o CRM antigo, não cria visita/proposta, não altera venda.
 * POST { acao }     → "analisar"  : pede a leitura da Sara (observação apenas) para até 10 itens,
 *                                   reutilizando o MESMO ia-router já em produção.
 *                     "aprovar"   : aprovação INDIVIDUAL, com confirmação textual, cria o atendimento.
 *                     "rollback"  : desativa individualmente uma migração já aprovada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { normalizarSugestaoSara } from "../saraSchema";
import { LIMITE_LOTE, hashContexto, qualidadeContexto, quantidadeDoLote } from "../../../features/crm-nova-era/lib/carteiraAntiga";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 30000;

const OVERRIDE =
  "Você é a Sara, co-piloto comercial imobiliário da Apecerto. Este cliente está numa carteira antiga e " +
  "ainda não foi organizado no novo fluxo. Use as ferramentas consultar_lead e avaliar_conversa (mensagens " +
  "reais e áudios já transcritos). Responda SOMENTE um JSON válido com as chaves: etapa_sugerida " +
  "(novo|tentando_contato|em_atendimento|em_acompanhamento), temperatura (frio|morno|quente|negociando), " +
  "intencao_detectada, proxima_acao (1 frase concreta), prazo_sugerido (ISO 8601), objecoes (array), " +
  "risco_abandono (baixo|medio|alto), possibilidade_visita (baixa|media|alta), possibilidade_proposta " +
  "(baixa|media|alta), justificativa, confianca (0..1), evidencias (array de trechos reais da conversa), " +
  "evidencia_suficiente (true/false). NUNCA invente informação que não esteja na conversa. Quando a conversa " +
  "não sustentar conclusões, use evidencia_suficiente=false e confianca baixa. Nada além do JSON.";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

async function autenticar(request: Request) {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { token, db: supabase as unknown as SupabaseClient };
}

function responder(data: unknown, error: unknown) {
  if (error) return Response.json({ ok: false, error: "Falha ao carregar." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json(res, { status: res.erro === "sem_permissao" ? 403 : 422 });
  return Response.json(data);
}

/** Uma chamada isolada ao ia-router: falha de um item nunca derruba os demais. */
async function lerComSara(token: string, input: string): Promise<{ ok: true; raw: unknown } | { ok: false; erro: string }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, erro: "supabase_url_ausente" };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${base}/functions/v1/ia-router`, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agente_slug: "sara", input, override_prompt: OVERRIDE }),
    });
    if (!r.ok) return { ok: false, erro: `ia_router_http_${r.status}` };
    const j = (await r.json()) as Record<string, unknown>;
    if (j && (j as { ok?: boolean }).ok === false) return { ok: false, erro: String((j as { reason?: string }).reason ?? "ia_indisponivel") };
    const raw = (j && typeof (j as { saida?: unknown }).saida === "object")
      ? (j as { saida: unknown }).saida : (j as { resposta?: unknown }).resposta ?? j;
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha_de_rede" };
  } finally { clearTimeout(t); }
}

export async function GET(request: Request) {
  const { erro, db } = await autenticar(request);
  if (erro || !db) return erro!;
  const p = new URL(request.url).searchParams;
  const filtros: Record<string, string> = {};
  for (const k of ["corretor", "etapa_antiga", "respondeu", "conversa", "transcricao", "origem", "busca", "atraso_horas"]) {
    const v = p.get(k);
    if (v && v.trim()) filtros[k] = v.trim().slice(0, 120);
  }
  filtros.quantidade = String(quantidadeDoLote(p.get("quantidade")));
  const { data, error } = await db.rpc("ncrm_migracao_preview", { p_filtros: filtros });
  return responder(data, error);
}

export async function POST(request: Request) {
  const { erro, token, db } = await autenticar(request);
  if (erro || !db || !token) return erro!;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch {
    return Response.json({ ok: false, erro: "payload_invalido" }, { status: 400 });
  }
  const acao = body.acao;

  if (acao === "analisar") {
    const ids = Array.isArray(body.negocios)
      ? body.negocios.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0) : [];
    if (ids.length === 0) return Response.json({ ok: false, erro: "sem_itens" }, { status: 400 });
    if (ids.length > LIMITE_LOTE) return Response.json({ ok: false, erro: "limite_10" }, { status: 400 });

    const { data: ctxData, error: ctxErr } = await db.rpc("ncrm_migracao_contexto", { p_ids: ids });
    if (ctxErr) return Response.json({ ok: false, error: "Falha ao carregar o contexto." }, { status: 502 });
    const ctx = (ctxData ?? {}) as { ok?: boolean; erro?: string; itens?: Array<Record<string, unknown>> };
    if (ctx.ok === false) return Response.json(ctx, { status: ctx.erro === "sem_permissao" ? 403 : 422 });

    const resultados: Array<{ negocio_id: number; ok: boolean; erro?: string; evidencia_insuficiente?: boolean }> = [];
    for (const item of ctx.itens ?? []) {
      const nid = Number(item.negocio_id);
      const msgs = Array.isArray(item.mensagens) ? (item.mensagens as Array<Record<string, unknown>>) : [];
      const recebidas = msgs.filter((m) => m.de === "cliente").length;
      const semTranscricao = msgs.filter((m) => typeof m.texto === "string" && /^\[(audio|ptt)\]$/.test(m.texto)).length;
      const qualidade = qualidadeContexto(msgs.length, recebidas, semTranscricao);
      const hash = hashContexto(`${nid}|${msgs.length}|${JSON.stringify(msgs.slice(-6))}`);
      const nome = typeof item.cliente === "string" && item.cliente.trim() ? item.cliente.trim() : `negócio ${nid}`;

      if (qualidade === "insuficiente") {
        // Sem conversa não há o que ler: registra a lacuna em vez de pedir análise sem base.
        const { error } = await db.rpc("ncrm_migracao_registrar_analise", {
          p_analise: { negocio_id: nid, context_hash: hash, contexto_qualidade: "insuficiente", evidencias: [] },
        });
        resultados.push({ negocio_id: nid, ok: !error, erro: error ? "falha_ao_registrar" : undefined, evidencia_insuficiente: true });
        continue;
      }

      const ia = await lerComSara(token, nome);
      if (!ia.ok) { resultados.push({ negocio_id: nid, ok: false, erro: ia.erro }); continue; }
      const norm = normalizarSugestaoSara(ia.raw);
      if (!norm.ok) { resultados.push({ negocio_id: nid, ok: false, erro: norm.erro }); continue; }
      const s = norm.sugestao;
      const { data: reg, error: regErr } = await db.rpc("ncrm_migracao_registrar_analise", {
        p_analise: {
          negocio_id: nid, context_hash: hash,
          resumo: s.intencao_detectada ?? null,
          etapa_sugerida: s.etapa_sugerida, temperatura: s.temperatura,
          risco: s.risco_abandono, proxima_acao: s.proxima_acao, prazo: s.prazo_sugerido,
          justificativa: s.justificativa, evidencias: s.evidencias, confianca: s.confianca,
          contexto_qualidade: s.evidencia_suficiente ? qualidade : "parcial",
          versao_modelo: "sara/ia-router", versao_prompt: "fase6b-carteira-antiga",
        },
      });
      if (regErr) { resultados.push({ negocio_id: nid, ok: false, erro: "falha_ao_registrar" }); continue; }
      const r = (reg ?? {}) as { evidencia_insuficiente?: boolean };
      resultados.push({ negocio_id: nid, ok: true, evidencia_insuficiente: r.evidencia_insuficiente });
    }
    return Response.json({ ok: true, analisados: resultados.filter((r) => r.ok).length, resultados });
  }

  if (acao === "aprovar") {
    const nid = Number(body.negocioId);
    if (!Number.isInteger(nid) || nid <= 0) return Response.json({ ok: false, erro: "negocio_invalido" }, { status: 400 });
    const { data, error } = await db.rpc("ncrm_migracao_aprovar", {
      p_negocio_id: nid,
      p_etapa: typeof body.etapa === "string" ? body.etapa : "",
      p_proxima_acao_tipo: typeof body.proximaTipo === "string" ? body.proximaTipo : "",
      p_proxima_acao_titulo: typeof body.proximaTitulo === "string" ? body.proximaTitulo.slice(0, 400) : "",
      p_prazo: typeof body.prazo === "string" ? body.prazo : null,
      p_confirmacao: typeof body.confirmacao === "string" ? body.confirmacao : "",
    });
    return responder(data, error);
  }

  if (acao === "rollback") {
    const nid = Number(body.negocioId);
    if (!Number.isInteger(nid) || nid <= 0) return Response.json({ ok: false, erro: "negocio_invalido" }, { status: 400 });
    const { data, error } = await db.rpc("ncrm_migracao_rollback", { p_negocio_id: nid });
    return responder(data, error);
  }

  return Response.json({ ok: false, erro: "acao_invalida" }, { status: 400 });
}
