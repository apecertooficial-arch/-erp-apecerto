/**
 * Métricas do CRM Nova Era — AGREGADAS sobre a carteira AUTORIZADA (não sobre a página).
 * A RLS de ncrm_estado (pode_ver_negocio) limita o conjunto ao escopo do usuário
 * (corretor vê a sua; gestor a equipe; admin tudo). Usa count exato no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

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

  // Cada contagem é RLS-escopada (pode_ver_negocio). head:true => só o count, sem trafegar linhas.
  const q = () => db.from("ncrm_estado").select("negocio_id", { count: "exact", head: true });
  const n = async (builder: PromiseLike<{ count: number | null }>): Promise<number> => (await builder).count ?? 0;
  const agora = new Date().toISOString();

  const [total, ativos, respondeu, visitas, propostas, descartados, nutricao, atrasados, semProxima] = await Promise.all([
    n(q()),
    n(q().is("saida", null)),
    n(q().is("saida", null).eq("respondeu", true)),
    n(q().eq("saida", "pipeline_visitas")),
    n(q().eq("saida", "esteira_vendas")),
    n(q().eq("saida", "descartado")),
    n(q().eq("saida", "nutricao")),
    n(q().is("saida", null).lt("proxima_acao_em", agora)),
    n(q().is("saida", null).is("proxima_acao_em", null)),
  ]);

  const taxaResposta = total > 0 ? Math.round((respondeu / Math.max(1, ativos + respondeu)) * 100) : 0;
  return Response.json({
    escopo: "carteira_autorizada",
    metricas: {
      total, ativos, respondeu, visitas_agendadas: visitas, propostas, descartados, nutricao,
      atrasados, sem_proxima_acao: semProxima, taxa_resposta_pct: taxaResposta,
    },
    observacao: "Proposta não é venda; a venda permanece no fluxo atual da Esteira.",
  });
}
