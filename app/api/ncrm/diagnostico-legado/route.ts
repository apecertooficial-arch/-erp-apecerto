/**
 * Diagnóstico da carteira ANTIGA — ainda não migrada (Fase 3, Regra 1).
 * SOMENTE LEITURA. Lê a view legada vw_sla_leads (sob RLS do usuário) e classifica
 * por faixa de atraso (proxy: tempo sem interação). EXCLUI negócios já ingeridos na
 * Nova Era (ncrm_estado) para NÃO haver dupla contagem. Nunca escreve ncrm_*, nunca
 * move lead legado. Nenhuma ação Nova Era é habilitada sobre estes itens.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { diagnosticoCarteiraLegada, resumoCarteiraNovaEra, type AlertaLegado } from "../../../features/crm-nova-era/lib/carteira";

export const dynamic = "force-dynamic";
const TETO = 5000; // teto de leitura para o diagnóstico (evita varreduras gigantes)

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

  // Negócios já ingeridos na Nova Era (para excluir do diagnóstico legado).
  const { data: estados, error: eErr } = await db.from("ncrm_estado").select("negocio_id").limit(TETO);
  if (eErr) return Response.json({ error: eErr.message }, { status: 502 });
  const idsIngeridos = (estados ?? []).map((r: { negocio_id: number }) => r.negocio_id);

  // Alertas legados (view de SLA existente). Proxy de atraso: minutos sem interação.
  const { data: sla, error: sErr, count } = await db
    .from("vw_sla_leads")
    .select("negocio_id,min_sem_interacao", { count: "exact" })
    .order("negocio_id")
    .range(0, TETO - 1);
  if (sErr) return Response.json({ error: sErr.message }, { status: 502 });

  const alertas: AlertaLegado[] = (sla ?? []).map((r: { negocio_id: number; min_sem_interacao: number | null }) => ({
    negocioId: r.negocio_id,
    atrasoHoras: typeof r.min_sem_interacao === "number" ? r.min_sem_interacao / 60 : null,
  }));

  const diagnostico = diagnosticoCarteiraLegada(alertas, idsIngeridos);
  const novaEra = resumoCarteiraNovaEra(idsIngeridos.length);
  const truncado = (count ?? alertas.length) > TETO;

  return Response.json({
    ok: true,
    novaEra,                 // carteira Nova Era (0 enquanto ncrm_estado vazio)
    diagnostico,             // carteira antiga por faixa (read-only, sem ação Nova Era)
    truncado,                // true se a view excedeu o teto de leitura
    observacao: "Somente leitura. Estes alertas pertencem à carteira antiga (não migrada) e não habilitam ações do CRM Nova Era.",
  });
}
