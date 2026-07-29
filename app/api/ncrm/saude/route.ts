/** Fase 6 PR B — Saúde do CRM Nova Era: diagnóstico e ações administrativas seguras. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const ACOES = new Set([
  "reprocessar_item", "retentar_analise", "desligar_runner",
  "desligar_entrada", "religar_runner_observador", "atualizar_diagnostico",
]);

async function autenticar(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

function responder(data: unknown, error: unknown) {
  if (error) return Response.json({ ok: false, error: "Falha ao carregar." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json(res, { status: res.erro === "sem_permissao" ? 403 : 422 });
  return Response.json(data);
}

export async function GET(request: Request) {
  const { erro, db } = await autenticar(request);
  if (erro || !db) return erro!;
  const { data, error } = await db.rpc("ncrm_saude");
  return responder(data, error);
}

export async function POST(request: Request) {
  const { erro, db } = await autenticar(request);
  if (erro || !db) return erro!;
  let body: { acao?: string; alvo?: string; confirmacao?: string; limite?: number };
  try { body = await request.json(); } catch { return Response.json({ ok: false, erro: "payload_invalido" }, { status: 400 }); }
  const acao = typeof body.acao === "string" ? body.acao : "";

  // Classificação do backlog: pura reclassificação da fila. Não cria atendimento,
  // não aciona a Sara, não envia mensagem e não apaga nenhum registro.
  if (acao === "classificar_backlog") {
    const limite = Number(body.limite);
    const { data, error } = await db.rpc("ncrm_ingest_classificar_backlog", {
      p_limite: Number.isFinite(limite) && limite > 0 ? Math.min(Math.trunc(limite), 5000) : 1000,
      p_confirmacao: typeof body.confirmacao === "string" ? body.confirmacao : "",
    });
    return responder(data, error);
  }

  if (!ACOES.has(acao)) return Response.json({ ok: false, erro: "acao_invalida" }, { status: 400 });
  const { data, error } = await db.rpc("ncrm_saude_acao", {
    p_acao: acao,
    p_alvo: typeof body.alvo === "string" && body.alvo.trim() ? body.alvo.trim().slice(0, 120) : null,
    p_confirmacao: typeof body.confirmacao === "string" ? body.confirmacao : null,
  });
  return responder(data, error);
}
