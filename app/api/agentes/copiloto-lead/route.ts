import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function extractToken(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ ok: false, error: "Sessão inválida." }, { status: 401 });

  const lead = new URL(request.url).searchParams.get("lead")?.trim();
  if (!lead) return Response.json({ ok: false, error: "Informe o lead." }, { status: 422 });

  const override =
    `Voce e a Sara, assistente da Apecerto. Analise o atendimento do cliente/lead "${lead}". ` +
    `Use as ferramentas avaliar_conversa e consultar_lead para ver a conversa e a situacao real dele. ` +
    `Responda SOMENTE um JSON valido, sem nenhum texto fora do JSON, exatamente neste formato: ` +
    `{"nota": <numero de 0 a 10, ou null se nao houver conversa registrada>, ` +
    `"resumo_nota": "<uma frase curta justificando a nota, ou por que nao ha nota>", ` +
    `"proxima_acao": "<a proxima melhor acao, concreta, com prazo, em 1 frase curta>", ` +
    `"mensagem_sugerida": "<uma mensagem curta, pronta para copiar e enviar ao cliente agora, no tom do playbook, personalizada pela situacao>"}. ` +
    `Nada alem do JSON.`;

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-router`;
  let payload: Record<string, unknown> = {};
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agente_slug: "sara", input: lead, override_prompt: override }),
    });
    payload = await r.json();
  } catch {
    return Response.json({ ok: false, error: "Falha ao consultar a Sara." }, { status: 502 });
  }

  let out: Record<string, unknown> | null = null;
  const saida = (payload as { saida?: unknown }).saida;
  if (saida && typeof saida === "object") out = saida as Record<string, unknown>;
  if (!out) {
    const resposta = (payload as { resposta?: string }).resposta;
    if (typeof resposta === "string") {
      const match = resposta.match(/\{[\s\S]*\}/);
      if (match) { try { out = JSON.parse(match[0]); } catch { /* ignore */ } }
    }
  }
  if (!out) return Response.json({ ok: false, error: "Sem sugestão no momento." });

  return Response.json({
    ok: true,
    nota: out.nota ?? null,
    resumo_nota: out.resumo_nota ?? null,
    proxima_acao: out.proxima_acao ?? null,
    mensagem_sugerida: out.mensagem_sugerida ?? null,
  });
}
