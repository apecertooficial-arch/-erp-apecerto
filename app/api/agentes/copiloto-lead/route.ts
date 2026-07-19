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

  // 1) transcreve os áudios recentes deste lead (para o Avaliador "ouvir")
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-transcrever`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lead, limite: 6 }),
    });
  } catch { /* best-effort */ }

  // 2) puxa a conversa completa (com áudios já transcritos)
  let conversaTexto = "";
  try {
    const { data: conv } = await supabase.rpc("ia_conversa", { p_texto: lead, p_limite: 50 });
    const c = conv as { encontrado?: boolean; mensagens?: Array<{ direcao: string; texto: string }> } | null;
    if (c?.encontrado && Array.isArray(c.mensagens)) {
      conversaTexto = c.mensagens.map((m) => `${m.direcao === "enviada" ? "CORRETOR" : "CLIENTE"}: ${m.texto}`).join("\n");
    }
  } catch { /* ignore */ }
  const temConversa = conversaTexto.trim().length > 0;

  // 3) Avaliador (nota + >=3 feedbacks lendo a conversa toda) e Sara (ação + mensagem) em paralelo
  const avaliadorOverride =
    `Voce e o Avaliador de Atendimento da Apecerto. Avalie o atendimento do CORRETOR com o CLIENTE lendo TODA a conversa abaixo ` +
    `(inclui audios transcritos, marcados com [audio]).\n\nCONVERSA:\n${conversaTexto}\n\n` +
    `Responda SOMENTE um JSON valido, sem texto fora dele: ` +
    `{"nota": <numero de 0 a 10>, "feedbacks": [{"criterio":"<curto>","positivo":<true|false>,"texto":"<por que, 1 frase>"}]}. ` +
    `De PELO MENOS 3 feedbacks, avaliando: velocidade de resposta, clareza das respostas, se atendeu o que o cliente queria, ` +
    `conducao para a visita/fechamento, tom/relacionamento e tecnicas de negociacao. ` +
    `positivo=true quando o corretor foi bem naquele ponto, false quando falhou. Seja especifico e baseado na conversa. Nada alem do JSON.`;

  const saraOverride =
    `Voce e a Sara, assistente da Apecerto. Para o lead "${lead}", use as ferramentas consultar_lead e avaliar_conversa. ` +
    `Responda SOMENTE um JSON valido: ` +
    `{"proxima_acao":"<a proxima melhor acao, concreta, com prazo, 1 frase>", ` +
    `"mensagem_sugerida":"<uma mensagem curta, pronta para copiar e enviar ao cliente agora, no tom do playbook, personalizada>"}. Nada alem do JSON.`;

  const [aval, acao] = await Promise.all([
    temConversa ? callAgent(token, "avaliador-atendimento", lead, avaliadorOverride) : Promise.resolve(null),
    callAgent(token, "sara", lead, saraOverride),
  ]);

  const feedbacks = Array.isArray((aval as { feedbacks?: unknown })?.feedbacks)
    ? ((aval as { feedbacks: Array<{ criterio?: string; positivo?: boolean; texto?: string }> }).feedbacks).slice(0, 6)
    : [];

  return Response.json({
    ok: true,
    tem_conversa: temConversa,
    nota: (aval as { nota?: number | null })?.nota ?? null,
    feedbacks,
    proxima_acao: (acao as { proxima_acao?: string })?.proxima_acao ?? null,
    mensagem_sugerida: (acao as { mensagem_sugerida?: string })?.mensagem_sugerida ?? null,
  });
}
