// CRM Nova Era — Edge Function do RUNNER da Sara em modo OBSERVADOR (Fase 3 hotfix final).
// PREPARADO, NÃO IMPLANTADO nesta rodada (não fazer deploy de Edge Function).
// -----------------------------------------------------------------------------
// Autenticação (config.toml: verify_jwt=false): EXIGE `x-cron-secret` (Vault) validado em
// tempo ~constante ANTES de qualquer leitura (401 se ausente/incorreto). service_role SÓ
// dentro da Edge (para o banco); nunca Bearer cron→Edge; nunca no frontend.
// Reusa o NÚCLEO TESTADO (app/features/crm-nova-era/lib/*): só observer, nunca muta,
// idempotente por (negocio_id, context_hash), lote/timeout/retry, fila justa com backoff,
// falha isolada por negócio, contrato real da Sara (saraSchema), FAIL-CLOSED no contexto.
// Dependência FIXADA (evita import flutuante).
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";
import { tratarRequisicaoObserver, sanitizarErro } from "../../../app/features/crm-nova-era/lib/saraObserverRunner.ts";
import { carregarContextoAdaptador, mapearSugestaoParaAnalise } from "../../../app/features/crm-nova-era/lib/saraContexto.ts";
import { normalizarSugestaoSara } from "../../../app/api/ncrm/saraSchema.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const VERSAO_PROMPT = "sara-observer-v1";
const VERSAO_MODELO = Deno.env.get("SARA_MODELO") ?? "ia-router";
const OPTS = { lote: Number(Deno.env.get("SARA_LOTE") ?? 100), timeoutMs: 20000, maxRetries: 1 };

const OVERRIDE =
  "Você é a Sara, co-piloto comercial imobiliário da Apecerto. Use as ferramentas consultar_lead e " +
  "avaliar_conversa (mensagens reais, áudios transcritos e avaliações). Responda SOMENTE um JSON válido " +
  "com as chaves: etapa_sugerida (novo|tentando_contato|em_atendimento|em_acompanhamento), " +
  "temperatura (frio|morno|quente|negociando), intencao_detectada, proxima_acao (1 frase concreta), " +
  "prazo_sugerido (ISO 8601), objecoes (array), risco_abandono (baixo|medio|alto), " +
  "possibilidade_visita (baixa|media|alta), possibilidade_proposta (baixa|media|alta), justificativa, " +
  "confianca (0..1), evidencias (array de trechos reais da conversa). Nada além do JSON. Você apenas sugere.";

function comTimeout(p, ms) {
  return Promise.race([Promise.resolve(p), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

Deno.serve(async (req: Request) => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const runId = crypto.randomUUID();

  // Consultas REAIS (nomes de colunas do database.types.ts), cada uma devolvendo {data,error}.
  const queries = {
    estado: async (negocioId: number) => {
      const { data, error } = await comTimeout(
        db.from("ncrm_estado").select("etapa,proxima_acao_titulo,ultima_interacao_em,negocios(lead_id,leads(nome),corretores(nome))").eq("negocio_id", negocioId).maybeSingle(), 10000);
      if (error) return { data: null, error };
      if (!data) return { data: null, error: null };
      return { data: { etapa: data.etapa, proxima_acao_titulo: data.proxima_acao_titulo, ultima_interacao_em: data.ultima_interacao_em, lead_id: data.negocios?.lead_id ?? null, lead_nome: data.negocios?.leads?.nome ?? null, corretor_nome: data.negocios?.corretores?.nome ?? null }, error: null };
    },
    contatos: async (leadId: number) => await db.from("wa_contatos").select("id").eq("lead_id", leadId),
    conversas: async (cids: string[]) => await db.from("wa_conversas").select("id").in("contato_id", cids),
    mensagens: async (convIds: string[]) => {
      const { data, error } = await comTimeout(db.from("wa_mensagens").select("id,direcao,tipo,conteudo,transcricao,enviado_em").in("conversa_id", convIds).order("enviado_em", { ascending: false }).limit(20), 10000);
      return { data: (data ?? []).map((m: any) => ({ id: m.id, direcao: m.direcao, tipo: m.tipo, conteudo: m.conteudo, transcricao: m.transcricao, enviadoEm: m.enviado_em })), error };
    },
    // lead_avaliacoes REAL: nota, contexto (Json), feedbacks (Json), criado_em. NÃO existe "resumo".
    avaliacoes: async (leadId: number) => await db.from("lead_avaliacoes").select("nota,contexto,feedbacks,criado_em").eq("lead_id", leadId).limit(5),
  };

  const deps = {
    // ERRO ao consultar modo => LANÇA (não executa; nunca assume observer). Config ausente idem.
    getModo: async () => {
      const { data, error } = await db.from("ncrm_sara_config").select("modo").eq("id", true).maybeSingle();
      if (error || !data) throw new Error("erro_modo");
      return data.modo;
    },
    listarElegiveis: async (lote: number) => {
      const { data, error } = await db.rpc("ncrm_sara_elegiveis", { p_lote: lote });
      if (error || data?.ok === false) throw new Error("elegiveis_falhou");
      return (data?.negocios ?? []).map((negocioId: number) => ({ negocioId }));
    },
    lerContexto: async (negocioId: number) => await carregarContextoAdaptador(negocioId, queries), // null => sem_contexto; lança => erro
    jaAnalisado: async (negocioId: number, hash: string) => {
      const { data, error } = await db.from("ncrm_sara_analise").select("id").eq("negocio_id", negocioId).eq("context_hash", hash).maybeSingle();
      if (error) throw new Error("erro_ja_analisado");
      return !!data;
    },
    chamarIaRouter: async ({ texto }: { texto: string }) => {
      const r = await comTimeout(fetch(`${SUPABASE_URL}/functions/v1/ia-router`, {
        method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ agente_slug: "sara", input: texto, override_prompt: OVERRIDE }),
      }), OPTS.timeoutMs);
      if (!r.ok) throw new Error(`ia_router_http_${r.status}`);
      const j = await r.json();
      return (j && typeof j.saida === "object") ? j.saida : (j.resposta ?? j);
    },
    validar: (raw: unknown, ctx: any) => {
      const n = normalizarSugestaoSara(raw);
      if (!n.ok) return { ok: false };                         // inválida => sem análise falsa
      const a = mapearSugestaoParaAnalise(n.sugestao as any, ctx);
      return a ? { ok: true, analise: { ...a, etapaAtual: ctx.etapaAtual } } : { ok: false };
    },
    registrar: async (negocioId: number, hash: string, analise: any) => {
      const { data, error } = await db.rpc("ncrm_sara_registrar_analise", {
        p_run_id: runId, p_context_hash: hash, p_negocio_id: negocioId,
        p_etapa_atual: analise.etapaAtual ?? null, p_etapa_sugerida: analise.etapaSugerida ?? null,
        p_proxima_acao_sugerida: analise.proximaAcaoSugerida ?? null, p_prazo_sugerido: analise.prazoSugerido ?? null,
        p_justificativa: analise.justificativa, p_evidencias: analise.evidencias ?? [], p_confianca: analise.confianca,
        p_cliente_aguardando: !!analise.clienteAguardando, p_promessa_retorno: !!analise.promessaRetorno,
        p_visita_mencionada: !!analise.visitaMencionada, p_proposta_mencionada: !!analise.propostaMencionada,
        p_versao_prompt: VERSAO_PROMPT, p_versao_modelo: VERSAO_MODELO,
      });
      if (error) throw new Error("registro_falhou");
      return { ok: data?.ok !== false, ja: !!data?.ja_analisado };
    },
    // Marca TODO negócio processado (fila justa / backoff). Best-effort.
    marcarResultado: async (negocioId: number, status: string, erro?: string) => {
      await db.rpc("ncrm_sara_runner_marcar_item", { p_negocio_id: negocioId, p_status: status, p_run_id: runId, p_erro: erro ?? null });
    },
    log: (m: string) => console.log(m),
  };

  try {
    const { status, body } = await tratarRequisicaoObserver(
      { segredoRecebido: req.headers.get("x-cron-secret"), segredoEsperado: CRON_SECRET },
      deps, OPTS,
    );
    if (status === 200 && body?.executou) {
      try { await db.rpc("ncrm_sara_runner_marcar_execucao", { p_run_id: runId, p_ultimo_negocio_id: body.ultimoNegocioId ?? null, p_processados: body.processados ?? 0 }); } catch { /* best-effort */ }
    }
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ncrm-sara-observer:", sanitizarErro(e)); // detalhe sanitizado só no log
    return new Response(JSON.stringify({ ok: false, erro: "falha_interna" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
