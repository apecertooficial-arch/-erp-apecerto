/**
 * Painel de início do app do corretor.
 *
 * GET -> ncrm_painel_corretor(): leads novos, atrasados, ações de hoje, base,
 * visitas agendadas, nota de atendimento e score de performance.
 *
 * Uma chamada, uma consulta. O /api/ncrm/metricas continua existindo para o
 * desktop, mas faz 9 `count` separados — no celular isso é lento na rua.
 *
 * O escopo (admin, gestor ou carteira própria) é decidido DENTRO do banco.
 * Esta rota não aceita corretor_id: aceitar seria IDOR.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("ncrm_painel_corretor");

  /* Falha vira 502, nunca zero silencioso: painel zerado por erro faria o
     corretor achar que a carteira esvaziou. */
  if (error) return Response.json({ ok: false, error: "Falha ao carregar o painel." }, { status: 502 });

  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) {
    return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "nao_autenticado" ? 403 : 409 });
  }
  return Response.json(data);
}
