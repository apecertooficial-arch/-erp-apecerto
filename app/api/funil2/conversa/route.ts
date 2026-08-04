/**
 * Conversa visível da cópia do Funil 2.0.
 *
 * A cópia mantém o vínculo com o negócio original, mas só enxerga mensagens
 * registradas depois de `corte_conversa_em`. Assim um lead pescado nasce como
 * Novo sem carregar para o corretor o histórico anterior da carteira.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

function uuidValido(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  const url = new URL(request.url);
  const funilLeadId = url.searchParams.get("lead");
  if (!uuidValido(funilLeadId)) return Response.json({ error: "lead inválido" }, { status: 422 });

  // A consulta passa pela RLS administrativa de f2_lead. UUID conhecido não
  // concede acesso a uma cópia que o usuário não possa ver.
  const { data: copia, error: copiaError } = await db
    .from("f2_lead")
    .select("id,origem_negocio_id,corte_conversa_em")
    .eq("id", funilLeadId)
    .maybeSingle();
  if (copiaError) return Response.json({ error: copiaError.message }, { status: 502 });
  if (!copia) return Response.json({ error: "Lead não visível." }, { status: 404 });

  const origemNegocioId = Number(copia.origem_negocio_id);
  const corte = String(copia.corte_conversa_em);
  const { data: negocio, error: negocioError } = await db
    .from("negocios")
    .select("id,lead_id")
    .eq("id", origemNegocioId)
    .maybeSingle();
  if (negocioError) return Response.json({ error: negocioError.message }, { status: 502 });
  if (!negocio?.lead_id) return Response.json({ ok: true, mensagens: [], instancias: [], total: 0, corte });

  const { data: contatos, error: contatosError } = await db.from("wa_contatos").select("id").eq("lead_id", negocio.lead_id);
  if (contatosError) return Response.json({ error: contatosError.message }, { status: 502 });
  const contatoIds = (contatos ?? []).map((item: { id: string }) => item.id);
  if (contatoIds.length === 0) return Response.json({ ok: true, mensagens: [], instancias: [], total: 0, corte });

  const { data: conversas, error: conversasError } = await db.from("wa_conversas").select("id,instancia_id").in("contato_id", contatoIds);
  if (conversasError) return Response.json({ error: conversasError.message }, { status: 502 });
  const conversaIds = (conversas ?? []).map((item: { id: string }) => item.id);
  if (conversaIds.length === 0) return Response.json({ ok: true, mensagens: [], instancias: [], total: 0, corte });

  const { data: mensagens, error: mensagensError, count } = await db
    .from("wa_mensagens")
    .select("id,direcao,tipo,conteudo,media_url,enviado_em,criado_em,status,transcricao,instancia_id", { count: "exact" })
    .in("conversa_id", conversaIds)
    .gte("criado_em", corte)
    .order("criado_em", { ascending: true })
    .limit(200);
  if (mensagensError) return Response.json({ error: mensagensError.message }, { status: 502 });

  const idsInstancia = [...new Set([
    ...(conversas ?? []).map((item: { instancia_id: string | null }) => item.instancia_id),
    ...(mensagens ?? []).map((item: { instancia_id: string | null }) => item.instancia_id),
  ].filter((id): id is string => Boolean(id)))];
  const { data: instancias, error: instanciasError } = idsInstancia.length
    ? await db.from("wa_instancias").select("id,rotulo,telefone,status").in("id", idsInstancia)
    : { data: [], error: null };
  if (instanciasError) return Response.json({ error: instanciasError.message }, { status: 502 });

  const ultimaComInstancia = [...(mensagens ?? [])].reverse().find((item: { instancia_id: string | null }) => Boolean(item.instancia_id));
  const instanciaAtualId = ultimaComInstancia?.instancia_id
    ?? [...(conversas ?? [])].reverse().find((item: { instancia_id: string | null }) => Boolean(item.instancia_id))?.instancia_id
    ?? null;
  const instanciasSeguras = (instancias ?? []).map((item: { id: string; rotulo: string | null; telefone: string | null; status: string | null }) => ({
    id: item.id,
    rotulo: item.rotulo?.trim() || "Instância sem nome",
    telefone: item.telefone ? item.telefone.replace(/\d(?=\d{4})/g, "•") : null,
    status: item.status,
    atual: item.id === instanciaAtualId,
  })).sort((a: { atual: boolean }, b: { atual: boolean }) => Number(b.atual)-Number(a.atual));

  return Response.json({ ok: true, lead: funilLeadId, negocio: origemNegocioId, corte, total: count ?? mensagens?.length ?? 0, instancias: instanciasSeguras, mensagens: mensagens ?? [] });
}
