import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function extractToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

async function callAgent(token: string, slug: string, input: string, override: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-router`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agente_slug: slug, input, override_prompt: override }),
    });
    const j = await r.json();
    let out: Record<string, unknown> | null = (j && typeof j.saida === "object") ? j.saida as Record<string, unknown> : null;
    if (!out && typeof j?.resposta === "string") {
      const m = j.resposta.match(/\{[\s\S]*\}/);
      if (m) { try { out = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    return out;
  } catch { return null; }
}

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });

  const lead = new URL(request.url).searchParams.get("lead")?.trim();
  if (!lead) return Response.json({ ok: false, error: "Informe o lead." }, { status: 422 });

  // resolve o lead_id
  const { data: leadRow } = await supabase.from("leads").select("id").or(`nome.ilike.%${lead}%,telefone.ilike.%${lead}%`).order("atualizado_em", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const leadId = leadRow?.id ?? null;

  // Sara (ação + mensagem) roda em paralelo com a leitura/geração da nota
  const saraOverride =
    `Voce e a Sara, assistente da Apecerto. Para o lead "${lead}", use as ferramentas consultar_lead e avaliar_conversa. ` +
    `Responda SOMENTE um JSON valido: ` +
    `{"proxima_acao":"<a proxima melhor acao, concreta, com prazo, 1 frase>", ` +
    `"mensagem_sugerida":"<uma mensagem curta, pronta para copiar e enviar ao cliente agora, no tom do playbook, personalizada>"}. Nada alem do JSON.`;

  async function lerOuGerarAvaliacao(): Promise<{ nota: number | null; feedbacks: unknown[] }> {
    if (!leadId) return { nota: null, feedbacks: [] };
    // 1) nota já gravada (rápido)
    const { data: cached } = await supabase.rpc("ia_ultima_avaliacao", { p_lead_id: leadId });
    let aval = cached as { nota?: number | null; feedbacks?: unknown[] } | null;
    // 2) se ainda não há nota, gera agora (uma vez) e relê
    if (!aval || aval.nota == null) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-avaliar-lote`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ lead }),
        });
        const { data: novo } = await supabase.rpc("ia_ultima_avaliacao", { p_lead_id: leadId });
        aval = novo as { nota?: number | null; feedbacks?: unknown[] } | null;
      } catch { /* segue sem nota */ }
    }
    return { nota: aval?.nota ?? null, feedbacks: Array.isArray(aval?.feedbacks) ? aval!.feedbacks as unknown[] : [] };
  }

  const [avaliacao, acao] = await Promise.all([
    lerOuGerarAvaliacao(),
    callAgent(token, "sara", lead, saraOverride),
  ]);

  return Response.json({
    ok: true,
    nota: avaliacao.nota,
    feedbacks: (avaliacao.feedbacks || []).slice(0, 6),
    proxima_acao: (acao as { proxima_acao?: string })?.proxima_acao ?? null,
    mensagem_sugerida: (acao as { mensagem_sugerida?: string })?.mensagem_sugerida ?? null,
  });
}
