/**
 * Conversa real do lead para o CRM Nova Era — enxuto e sob RLS.
 * Resolve o lead pelo negócio VISÍVEL (ncrm_estado sob RLS) e retorna as mensagens
 * das conversas do lead (wa_mensagens), SEM `raw`, paginadas e com limites seguros.
 * Reutiliza as tabelas reais de chat; respeita a autorização existente (JWT do usuário).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { inteiroPositivo, inteiroNaoNeg } from "../validate";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  const url = new URL(request.url);
  const nid = inteiroPositivo(url.searchParams.get("negocio"));
  if (nid === null) return Response.json({ error: "negocio inválido" }, { status: 422 });
  const limit = Math.min(200, Math.max(1, inteiroNaoNeg(url.searchParams.get("limit") ?? "80", 200) ?? 80));
  const offset = inteiroNaoNeg(url.searchParams.get("offset") ?? "0", Number.MAX_SAFE_INTEGER) ?? 0;

  // 1) o negócio precisa estar VISÍVEL (RLS de ncrm_estado). Também obtém o lead_id.
  const { data: estado } = await db.from("ncrm_estado").select("negocio_id,negocios(lead_id,leads(nome,telefone))").eq("negocio_id", nid).maybeSingle();
  if (!estado) return Response.json({ error: "Lead não visível." }, { status: 404 });
  const leadId = (estado as { negocios?: { lead_id?: number } }).negocios?.lead_id ?? null;
  if (!leadId) return Response.json({ ok: true, negocio: nid, mensagens: [], total: 0 });

  // 2) conversas do lead: wa_contatos(lead_id) -> wa_conversas(contato_id)
  const { data: contatos } = await db.from("wa_contatos").select("id").eq("lead_id", leadId);
  const contatoIds = (contatos ?? []).map((c: { id: string }) => c.id);
  if (contatoIds.length === 0) return Response.json({ ok: true, negocio: nid, mensagens: [], total: 0 });
  const { data: conversas } = await db.from("wa_conversas").select("id").in("contato_id", contatoIds);
  const conversaIds = (conversas ?? []).map((c: { id: string }) => c.id);
  if (conversaIds.length === 0) return Response.json({ ok: true, negocio: nid, mensagens: [], total: 0 });

  // 3) mensagens (sem `raw`), ordem cronológica, paginadas.
  const { data: msgs, error, count } = await db
    .from("wa_mensagens")
    .select("id,direcao,tipo,conteudo,media_url,enviado_em,criado_em,status,transcricao", { count: "exact" })
    .in("conversa_id", conversaIds)
    .order("criado_em", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ ok: true, negocio: nid, total: count ?? (msgs?.length ?? 0), offset, limit, mensagens: msgs ?? [] });
}
