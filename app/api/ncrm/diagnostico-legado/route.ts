/**
 * Diagnóstico da carteira ANTIGA — ainda não migrada (Fase 3, Regra 1 / P1).
 * SOMENTE LEITURA. Classifica alertas legados (vw_sla_leads, proxy: tempo sem interação)
 * por faixa de atraso, EXCLUINDO negócios já ingeridos na Nova Era. A exclusão pagina
 * ncrm_estado por COMPLETO (não fica limitada a 5.000 IDs → sem dupla contagem acima do teto).
 * Nunca escreve ncrm_*, nunca move lead legado, nenhuma ação Nova Era. Erros são GENÉRICOS
 * ao cliente (detalhe fica só no log server-side).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { diagnosticoCarteiraLegada, resumoCarteiraNovaEra, type AlertaLegado } from "../../../features/crm-nova-era/lib/carteira";

export const dynamic = "force-dynamic";
const PAGINA = 1000;         // página da varredura de ncrm_estado
const MAX_ESTADOS = 200000;  // salvaguarda dura (evita loop infinito)
const TETO_ALERTAS = 5000;   // teto de leitura da view legada (reporta truncamento)

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

/** Coleta TODOS os negocio_id de ncrm_estado paginando até esgotar (sem teto de 5k). */
async function todosEstadosIngeridos(db: SupabaseClient): Promise<number[]> {
  const ids: number[] = [];
  for (let from = 0; from < MAX_ESTADOS; from += PAGINA) {
    const { data, error } = await db.from("ncrm_estado").select("negocio_id").order("negocio_id").range(from, from + PAGINA - 1);
    if (error) throw error;
    const lote = (data ?? []) as { negocio_id: number }[];
    for (const r of lote) ids.push(r.negocio_id);
    if (lote.length < PAGINA) break; // última página
  }
  return ids;
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  try {
    // Exclusão COMPLETA (paginada) dos já ingeridos — sem dupla contagem acima de 5k.
    const idsIngeridos = await todosEstadosIngeridos(db);

    const { data: sla, error: sErr, count } = await db
      .from("vw_sla_leads")
      .select("negocio_id,min_sem_interacao", { count: "exact" })
      .order("negocio_id")
      .range(0, TETO_ALERTAS - 1);
    if (sErr) throw sErr;

    const alertas: AlertaLegado[] = (sla ?? []).map((r: { negocio_id: number; min_sem_interacao: number | null }) => ({
      negocioId: r.negocio_id,
      atrasoHoras: typeof r.min_sem_interacao === "number" ? r.min_sem_interacao / 60 : null,
    }));

    const diagnostico = diagnosticoCarteiraLegada(alertas, idsIngeridos);
    const novaEra = resumoCarteiraNovaEra(idsIngeridos.length);
    const totalAlertas = count ?? alertas.length;
    const truncado = totalAlertas > TETO_ALERTAS;

    return Response.json({
      ok: true,
      novaEra,
      diagnostico,
      totais: { total_alertas_legado: totalAlertas, considerados: diagnostico.totalConsiderado, lidos: alertas.length, truncado },
      observacao: "Somente leitura. Alertas da carteira antiga (não migrada); não habilitam ações do CRM Nova Era. Proxy de atraso = tempo sem interação.",
    });
  } catch (e) {
    // NÃO vazar mensagem crua de SQL/Supabase ao cliente; detalhe só no log.
    console.error("diagnostico-legado:", e instanceof Error ? e.message : String(e));
    return Response.json({ error: "Não foi possível calcular o diagnóstico da carteira antiga." }, { status: 502 });
  }
}
