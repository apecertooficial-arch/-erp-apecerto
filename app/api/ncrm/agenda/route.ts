/**
 * Agenda do app do corretor.
 *
 * GET ?data=YYYY-MM-DD&periodo=dia|semana|mes
 *   -> ncrm_agenda_corretor
 *
 * A rota NÃO aceita corretor_id. O escopo é decidido dentro do banco — e a
 * agenda é da imobiliária inteira de propósito: sem isso dois corretores saem
 * para o mesmo empreendimento no mesmo horário sem saber.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

/** Só ISO puro. Data malformada vira null e o banco usa hoje. */
function lerData(bruto: string | null): string | null {
  if (!bruto || !/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return null;
  return Number.isNaN(Date.parse(bruto)) ? null : bruto;
}

/** Lista fechada: qualquer outra coisa vira "dia". */
function lerPeriodo(bruto: string | null): "dia" | "semana" | "mes" {
  return bruto === "semana" || bruto === "mes" ? bruto : "dia";
}

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const db = supabase as unknown as SupabaseClient;
  const params = new URL(request.url).searchParams;

  const { data, error } = await db.rpc("ncrm_agenda_corretor", {
    p_data: lerData(params.get("data")),
    p_periodo: lerPeriodo(params.get("periodo")),
  });
  if (error) return Response.json({ ok: false, error: "Falha ao carregar a agenda." }, { status: 502 });

  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) {
    return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "nao_autenticado" ? 403 : 409 });
  }
  return Response.json(data);
}
