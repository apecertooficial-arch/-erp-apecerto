/**
 * Sara — MODO DE OPERAÇÃO (Fase 3, Regra 5). Admin autenticado.
 * GET  -> ncrm_sara_modo_status (modo atual + contagem de análises)
 * POST { modo } -> ncrm_sara_definir_modo(modo, true). 'execute' é bloqueado no banco.
 * Usa o JWT real do usuário; NUNCA service_role. Não muta nada operacional.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { saraModoValido } from "../../../../features/crm-nova-era/lib/saraModo";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

const ERRO_HUMANO: Record<string, string> = {
  nao_autenticado: "Sessão inválida. Faça login novamente.",
  sem_permissao: "Apenas administradores podem operar a Sara.",
  confirmacao_obrigatoria: "Confirmação explícita é obrigatória.",
  modo_invalido: "Modo inválido.",
  execute_bloqueado_nesta_fase: "O modo execute está bloqueado nesta fase (Sara segue em observação).",
};

async function db(request: Request): Promise<{ db: SupabaseClient } | { erro: Response }> {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

function responder(data: unknown, err: { message: string } | null) {
  if (err) return Response.json({ ok: false, error: "Falha ao operar a Sara." }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) {
    const status = res.erro === "sem_permissao" || res.erro === "nao_autenticado" ? 403 : 409;
    return Response.json({ ok: false, erro: res.erro, mensagem: (res.erro && ERRO_HUMANO[res.erro]) || "Operação não permitida." }, { status });
  }
  return Response.json(data);
}

export async function GET(request: Request) {
  const s = await db(request);
  if ("erro" in s) return s.erro;
  const { data, error } = await s.db.rpc("ncrm_sara_modo_status");
  return responder(data, error);
}

export async function POST(request: Request) {
  const s = await db(request);
  if ("erro" in s) return s.erro;
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const modo = body.modo;
  if (!saraModoValido(modo)) return Response.json({ error: "Modo inválido (off|observer|suggest|execute)." }, { status: 422 });
  const { data, error } = await s.db.rpc("ncrm_sara_definir_modo", { p_modo: modo, p_confirmar: true });
  return responder(data, error);
}
