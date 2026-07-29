/**
 * Métricas do CRM Nova Era — AGREGADAS sobre a carteira AUTORIZADA (não sobre a página).
 * A RLS de ncrm_estado (pode_ver_negocio) limita o conjunto ao escopo do usuário.
 * Correções:
 *  - taxa de resposta NÃO duplica respondidos no denominador (usa o total da carteira);
 *  - erro de consulta vira 502 (NÃO é transformado em contagem zero silenciosa).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { taxaRespostaPct } from "../metricasCalc";

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

  const q = () => db.from("ncrm_estado").select("negocio_id", { count: "exact", head: true });
  const agora = new Date().toISOString();

  // Cada contagem é RLS-escopada. Falha de QUALQUER consulta => 502 (nunca zero silencioso).
  const resultados = await Promise.all([
    q(),
    q().is("saida", null),
    q().eq("respondeu", true), // total de respondidos (independe de saída) — denominador NÃO duplica
    q().eq("saida", "pipeline_visitas"),
    q().eq("saida", "esteira_vendas"),
    q().eq("saida", "descartado"),
    q().eq("saida", "nutricao"),
    q().is("saida", null).lt("proxima_acao_em", agora),
    q().is("saida", null).is("proxima_acao_em", null),
  ]) as Array<{ count: number | null; error: { message: string } | null }>;

  const comErro = resultados.find((r) => r.error);
  if (comErro?.error) return Response.json({ error: "Falha ao calcular métricas.", detalhe: comErro.error.message }, { status: 502 });

  const [total, ativos, respondeu, visitas, propostas, descartados, nutricao, atrasados, semProxima] =
    resultados.map((r) => r.count ?? 0);

  return Response.json({
    escopo: "carteira_autorizada",
    metricas: {
      total, ativos, respondeu, visitas_agendadas: visitas, propostas, descartados, nutricao,
      atrasados, sem_proxima_acao: semProxima, taxa_resposta_pct: taxaRespostaPct(respondeu, total),
    },
    observacao: "Proposta não é venda; a venda permanece no fluxo atual da Esteira.",
  });
}
