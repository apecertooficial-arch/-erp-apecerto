/**
 * Agenda compartilhada da operação.
 *
 * GET ?data=YYYY-MM-DD&periodo=dia|semana|mes
 *
 * O cliente não escolhe corretor. A RPC decide o escopo e devolve a agenda da
 * imobiliária, permitindo que a equipe enxergue conflitos de horário.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function lerData(bruto: string | null): string | null {
  if (!bruto || !/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return null;
  return Number.isNaN(Date.parse(bruto)) ? null : bruto;
}

function lerPeriodo(bruto: string | null): "dia" | "semana" | "mes" {
  return bruto === "semana" || bruto === "mes" ? bruto : "dia";
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const { data, error } = await (supabase as unknown as SupabaseClient).rpc("ncrm_agenda_corretor", {
    p_data: lerData(params.get("data")),
    p_periodo: lerPeriodo(params.get("periodo")),
  });
  if (error) return Response.json({ ok: false, error: "Falha ao carregar a agenda." }, { status: 502 });

  const result = (data ?? {}) as { ok?: boolean; erro?: string };
  if (result.ok === false) {
    return Response.json({ ok: false, erro: result.erro }, { status: result.erro === "nao_autenticado" ? 403 : 409 });
  }
  return Response.json(data);
}
