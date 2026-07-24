import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

// Janela de tempo a partir do período pedido (mês/trimestre/ano), sempre no fuso de SP.
function periodo(p: string | null): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (p === "ano") {
    return { inicio: new Date(Date.UTC(y, 0, 1)).toISOString(), fim: new Date(Date.UTC(y + 1, 0, 1)).toISOString() };
  }
  if (p === "trimestre") {
    const q = Math.floor(m / 3) * 3;
    return { inicio: new Date(Date.UTC(y, q, 1)).toISOString(), fim: new Date(Date.UTC(y, q + 3, 1)).toISOString() };
  }
  // padrão: mês corrente
  return { inicio: new Date(Date.UTC(y, m, 1)).toISOString(), fim: new Date(Date.UTC(y, m + 1, 1)).toISOString() };
}

// Central de Performance (leitura). Os dados vêm por corretor_id — nada de casar
// por nome/instância como no dashboard legado. O escopo (quem aparece) é decidido
// no banco pelas funções SECURITY DEFINER a partir do usuário logado.
export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const url = new URL(request.url);
  const { inicio, fim } = periodo(url.searchParams.get("periodo"));

  const [rich, base] = await Promise.all([
    auth.supabase.rpc("performance_corretores", { p_inicio: inicio, p_fim: fim }),
    auth.supabase.rpc("perf_scores_corretores", { p_inicio: inicio, p_fim: fim }),
  ]);

  if (rich.error) return Response.json({ error: rich.error.message }, { status: 502 });

  const payload = (rich.data ?? {}) as {
    periodo?: unknown;
    corretores?: Array<Record<string, unknown>>;
    semResponsavel?: number;
    metodologiaOperacional?: unknown;
  };

  // Índice dos scores ponderados (perf_metricas_base) por corretor_id, sem vazar
  // ninguém fora do escopo já retornado por performance_corretores.
  type BaseRow = { corretor_id: number; resp_score: number; crm_score: number; fup_score: number; visita_score: number; venda_score: number; tarefa_score: number; score: number };
  const scoreById = new Map<number, BaseRow>();
  if (!base.error && Array.isArray(base.data)) {
    for (const row of base.data as BaseRow[]) scoreById.set(Number(row.corretor_id), row);
  }

  const corretores = (payload.corretores ?? []).map((c) => {
    const s = scoreById.get(Number(c.corretor_id));
    return {
      ...c,
      score: s?.score ?? 0,
      respScore: s?.resp_score ?? 0,
      crmScore: s?.crm_score ?? 0,
      fupScore: s?.fup_score ?? 0,
      visitaScore: s?.visita_score ?? 0,
      vendaScore: s?.venda_score ?? 0,
      tarefaScore: s?.tarefa_score ?? 0,
    };
  });

  return Response.json({
    periodo: payload.periodo ?? { inicio, fim },
    semResponsavel: payload.semResponsavel ?? 0,
    metodologiaOperacional: payload.metodologiaOperacional ?? null,
    corretores,
  });
}
