// CRM Nova Era — Edge Function do RUNNER da Sara em modo OBSERVADOR (Fase 3).
// PREPARADO, NÃO IMPLANTADO nesta rodada (não fazer deploy de Edge Function).
// -----------------------------------------------------------------------------
// Autenticação (contrato):
//  - Invocada pelo pg_cron via net.http_post com header `x-cron-secret: <CRON_SECRET>`
//    (segredo em Vault) OU `Authorization: Bearer <SERVICE_ROLE_KEY>`.
//  - Usa SUPABASE_SERVICE_ROLE_KEY (server-side; NUNCA no frontend) para o cliente
//    Supabase — a RPC de registro é service-only. Identidade = serviço "sara_runner"
//    (jamais um corretor).
// Garantias (idênticas ao núcleo testado app/features/crm-nova-era/lib/saraObserverRunner.ts):
//  - só roda quando modo=observer (kill-switch off); nunca muta operacional;
//  - idempotente por context_hash; lote/timeout/retry; falha isolada por negócio;
//  - reutiliza o contrato real do ia-router; erro sanitizado.
// Deno runtime (Supabase Edge). Tipos `Deno`/import remoto só existem no deploy.
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const VERSAO_PROMPT = "sara-observer-v1";
const VERSAO_MODELO = Deno.env.get("SARA_MODELO") ?? "ia-router";
const LOTE = 100, TIMEOUT_MS = 20000, MAX_RETRIES = 1;

function sanitizarErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/[A-Za-z0-9_-]{20,}/g, "***").slice(0, 200) || "erro";
}
async function comTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

Deno.serve(async (req: Request) => {
  // AUTORIZAÇÃO: só o cron/serviço pode invocar.
  const auth = req.headers.get("authorization") ?? "";
  const cron = req.headers.get("x-cron-secret") ?? "";
  const okAuth = (CRON_SECRET && cron === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE_KEY}`;
  if (!okAuth) return new Response(JSON.stringify({ ok: false, erro: "nao_autorizado" }), { status: 401 });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const runId = crypto.randomUUID();

  // modo (kill-switch): só observer roda.
  const { data: cfg } = await db.from("ncrm_sara_config").select("modo").eq("id", true).maybeSingle();
  const modo = cfg?.modo ?? "observer";
  if (modo !== "observer") return Response.json({ ok: true, executou: false, modo });

  // elegíveis: negócios com estado que ainda não têm análise recente (limite de lote).
  const { data: estados } = await db.from("ncrm_estado").select("negocio_id").limit(LOTE);
  const resumo = { ok: true, executou: true, modo, run_id: runId, processados: 0, analisados: 0, pulados: 0, erros: 0 };

  for (const e of estados ?? []) {
    resumo.processados++;
    const negocioId = e.negocio_id;
    try {
      // contexto real: histórico via API interna (mensagens sem `raw`) — hash estável do conteúdo.
      const contexto = await comTimeout(fetch(`${SUPABASE_URL}/functions/v1/ncrm-contexto?negocio=${negocioId}`, {
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      }).then((r) => r.json()), TIMEOUT_MS);
      const texto: string = contexto?.texto ?? "";
      const hash: string = contexto?.hash ?? "";
      if (!hash) { resumo.erros++; continue; }

      // chama o ia-router no MESMO contrato já usado em produção.
      let raw: any = null;
      for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
          raw = await comTimeout(fetch(`${SUPABASE_URL}/functions/v1/ia-router`, {
            method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ agente_slug: "sara", input: texto }),
          }).then((r) => r.json()), TIMEOUT_MS);
          break;
        } catch (err) { if (i === MAX_RETRIES) throw err; }
      }
      const sug = raw?.saida ?? raw?.resposta ?? null;
      if (!sug || typeof sug !== "object") { resumo.erros++; continue; }

      // registra a ANÁLISE automática (service-only, idempotente por context_hash).
      const { data: reg } = await db.rpc("ncrm_sara_registrar_analise", {
        p_run_id: runId, p_context_hash: hash, p_negocio_id: negocioId,
        p_etapa_atual: sug.etapa_atual ?? null, p_etapa_sugerida: sug.etapa_sugerida ?? null,
        p_proxima_acao_sugerida: sug.proxima_acao ?? null, p_prazo_sugerido: sug.prazo_sugerido ?? null,
        p_justificativa: sug.justificativa ?? "sem justificativa", p_evidencias: sug.evidencias ?? [],
        p_confianca: typeof sug.confianca === "number" ? sug.confianca : 0.5,
        p_cliente_aguardando: !!sug.cliente_aguardando, p_promessa_retorno: !!sug.promessa_retorno,
        p_visita_mencionada: !!sug.visita_mencionada, p_proposta_mencionada: !!sug.proposta_mencionada,
        p_versao_prompt: VERSAO_PROMPT, p_versao_modelo: VERSAO_MODELO,
      });
      if (reg?.ja_analisado) resumo.pulados++;
      else if (reg?.ok) resumo.analisados++;
      else resumo.erros++;
    } catch (err) {
      resumo.erros++;
      console.error(`sara-observer negocio ${negocioId}:`, sanitizarErro(err)); // detalhe server-side sanitizado
    }
  }
  return Response.json(resumo);
});
