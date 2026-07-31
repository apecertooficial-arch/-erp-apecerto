/**
 * Sara para o CRM Nova Era — SUGESTÃO apenas (suggestion-only), no CONTRATO REAL.
 * ---------------------------------------------------------------------------
 * - Usa o MESMO contrato do ia-router já em produção (app/api/agentes/copiloto-lead):
 *   POST {NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ia-router com { agente_slug:"sara", input, override_prompt }.
 *   A Edge Function usa as ferramentas reais (consultar_lead / avaliar_conversa: mensagens,
 *   áudios transcritos e avaliações), com a chave server-side. NENHUMA chave de IA no frontend.
 * - Resposta validada/normalizada por schema explícito (saraSchema). Se não for JSON válido
 *   no formato esperado => FALHA CONTROLADA (nunca devolve string/JSON cru como sugestão).
 * - A Sara NÃO altera etapa, NÃO envia WhatsApp, NÃO cria visita/proposta.
 * - POST (aceitar/rejeitar): persiste o feedback e SÓ responde "registrado" se persistiu.
 *   O evento auditável classificacao_sara (que exige papel `sara`) é persistido pela edge
 *   function service_role `ncrm-ingest` (fora do JWT do corretor) — ver docs.
 */
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { normalizarSugestaoSara } from "../saraSchema";
import { inteiroPositivo, textoLimitado } from "../validate";

export const dynamic = "force-dynamic";

const MAX_SUGESTAO_BYTES = 6000; // limita o tamanho total do JSON da sugestão

/** Hash estável (djb2) para idempotência por sugestão+decisão. */
function hashEstavel(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const OVERRIDE =
  "Você é a Sara, gestora comercial sênior de imobiliária — o nível de leitura de quem já fechou " +
  "centenas de vendas. O INPUT contém a DATA DE HOJE, os dados do atendimento, a CONVERSA REAL na " +
  "íntegra e, quando houver, a ANÁLISE ANTERIOR — use a conversa como fonte primária; as ferramentas " +
  "consultar_lead e avaliar_conversa são complementares. PERCEPÇÃO AGUÇADA: leia o que o cliente NÃO " +
  "disse — sinais de compra (pergunta de preço, condição, prazo de entrega), urgência real vs " +
  "curiosidade, objeção escondida atrás de 'vou pensar', esfriamento no tom e no tempo de resposta, " +
  "quem decide de verdade. Diagnóstico direto, sem genérico: 'entender a necessidade' não é ação; " +
  "'perguntar se a compra é para morar ou investir, porque ele citou aluguel' é. " +
  "COMPONHA com a análise anterior: diga o que MUDOU desde ela e ajuste temperatura e confiança em vez " +
  "de recomeçar do zero — a nota evolui, não reinicia. " +
  "Responda SOMENTE um JSON válido com as chaves: etapa_sugerida (novo|tentando_contato|em_atendimento|em_acompanhamento), " +
  "temperatura (frio|morno|quente|negociando), intencao_detectada, proxima_acao (1 frase concreta e específica), " +
  "prazo_sugerido (ISO 8601, sempre posterior à data de HOJE do input), objecoes (array), risco_abandono (baixo|medio|alto), " +
  "possibilidade_visita (baixa|media|alta), possibilidade_proposta (baixa|media|alta), " +
  "justificativa (o diagnóstico em 1-2 frases, citando o sinal que o sustenta), " +
  "confianca (0..1), evidencias (array de trechos REAIS da conversa), " +
  "objetivo_abordagem (1 frase), roteiro_ligacao (array de 3 a 5 passos curtos), " +
  "whatsapp_sugerido (mensagem curta e humana, sem pressão, <=300 chars), " +
  "perguntas_faltantes (array), cuidados (array de cuidados para não pressionar o cliente), " +
  "evidencia_suficiente (true/false — false quando a conversa não sustenta conclusões), " +
  "informacoes_descobertas (objeto com EXATAMENTE estas chaves: regiao, tipo_imovel, metragem, " +
  "dormitorios, vagas, faixa_valor, forma_pagamento, prazo_compra, motivo_compra, quem_decide, " +
  "disponibilidade_visita — cada uma com o valor dito PELO CLIENTE em poucas palavras, ou null " +
  "quando o cliente ainda não disse). " +
  "REGRA DE OURO do checklist: só preencha um campo se o CLIENTE afirmou aquilo na conversa. " +
  "Suposição, dedução a partir da campanha, do bairro do anúncio ou do preço do imóvel divulgado " +
  "NÃO valem — nesses casos o valor é null. Preencher um campo que o cliente não disse faz o " +
  "corretor deixar de perguntar, e ele perde a venda por informação que nunca existiu. " +
  "A proxima_acao deve atacar o campo faltante mais importante, nesta ordem de prioridade: " +
  "regiao, tipo_imovel, dormitorios, faixa_valor, forma_pagamento, prazo_compra, " +
  "disponibilidade_visita, e só depois metragem, vagas, motivo_compra e quem_decide. " +
  "Se o cliente fez uma pergunta ainda sem resposta, responder a ele vem antes de qualificar. " +
  "NUNCA invente informação que não esteja na conversa; com pouca evidência, use evidencia_suficiente=false " +
  "e limite-se ao que existe. Responda SOMENTE o objeto JSON, sem markdown, sem cerca de código e sem " +
  "texto antes ou depois. Você apenas sugere.";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

/** Chama o ia-router no contrato real e devolve o valor cru da IA (saida/resposta). */
async function chamarIaRouter(token: string, input: string): Promise<{ ok: true; raw: unknown } | { ok: false; erro: string }> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, erro: "supabase_url_ausente" };
  try {
    const r = await fetch(`${base}/functions/v1/ia-router`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agente_slug: "sara", input, override_prompt: OVERRIDE }),
    });
    if (!r.ok) return { ok: false, erro: `ia_router_http_${r.status}` };
    const j = (await r.json()) as Record<string, unknown>;
    if (j && (j as { ok?: boolean }).ok === false) return { ok: false, erro: String((j as { reason?: string }).reason ?? "ia_indisponivel") };
    // contrato real: { saida: object } ou { resposta: string com JSON }
    const raw = (j && typeof (j as { saida?: unknown }).saida === "object") ? (j as { saida: unknown }).saida : (j as { resposta?: unknown }).resposta ?? j;
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha_de_rede" };
  }
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const nid = inteiroPositivo(new URL(request.url).searchParams.get("negocio"));
  if (nid === null) return Response.json({ error: "negocio inválido" }, { status: 422 });

  /* Contexto sob RLS. O input carrega a CONVERSA REAL: em produção o agente
     respondia "sem interação recente" para cliente que respondeu havia 1h,
     porque as ferramentas nem sempre acham o histórico só pelo nome. */
  const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data: estado } = await db
    .from("ncrm_estado")
    .select("negocio_id,etapa,respondeu,resposta_pendente,tentativas_feitas,ultima_interacao_em,proxima_acao_titulo,proxima_acao_em,negocios(lead_id,leads(nome,telefone))")
    .eq("negocio_id", nid).maybeSingle();
  if (!estado) return Response.json({ error: "Lead não visível." }, { status: 404 });
  const est = estado as {
    etapa?: string; respondeu?: boolean; resposta_pendente?: boolean; tentativas_feitas?: number;
    ultima_interacao_em?: string | null; proxima_acao_titulo?: string | null; proxima_acao_em?: string | null;
    negocios?: { lead_id?: number; leads?: { nome?: string; telefone?: string } };
  };
  const leadObj = est.negocios?.leads ?? null;
  const nome = (leadObj?.nome || leadObj?.telefone || `negócio ${nid}`) as string;

  // Conversa real (mesmo caminho da rota /api/ncrm/conversa): últimas 40 mensagens.
  let conversaTxt = "(nenhuma mensagem registrada)";
  const leadId = est.negocios?.lead_id ?? null;
  if (leadId) {
    const { data: contatos } = await db.from("wa_contatos").select("id").eq("lead_id", leadId);
    const contatoIds = (contatos ?? []).map((c: { id: string }) => c.id);
    if (contatoIds.length > 0) {
      const { data: conversas } = await db.from("wa_conversas").select("id").in("contato_id", contatoIds);
      const conversaIds = (conversas ?? []).map((c: { id: string }) => c.id);
      if (conversaIds.length > 0) {
        const { data: msgs } = await db
          .from("wa_mensagens")
          .select("direcao,tipo,conteudo,transcricao,criado_em,enviado_em")
          .in("conversa_id", conversaIds)
          .order("criado_em", { ascending: false })
          .limit(40);
        const linhas = (msgs ?? []).reverse().map((m: { direcao?: string | null; tipo?: string | null; conteudo?: string | null; transcricao?: string | null; criado_em?: string | null; enviado_em?: string | null }) => {
          const doCliente = ["recebida", "entrada", "in", "inbound", "received"].includes(String(m.direcao ?? "").toLowerCase());
          const quando = (m.enviado_em ?? m.criado_em ?? "").slice(0, 16).replace("T", " ");
          const texto = m.conteudo || (m.transcricao ? `(áudio transcrito) ${m.transcricao}` : `(${m.tipo || "mensagem"} sem texto)`);
          return `[${doCliente ? "CLIENTE" : "CORRETOR"} ${quando}] ${texto}`;
        });
        if (linhas.length > 0) conversaTxt = linhas.join("\n");
      }
    }
  }

  /* Análise anterior: a Sara COMPÕE em vez de recomeçar (a nota evolui). */
  let anteriorTxt = "";
  {
    const { data: ant } = await db
      .from("ncrm_sara_analise")
      .select("proxima_acao_sugerida,justificativa,prazo_sugerido,confianca,analisado_em")
      .eq("negocio_id", nid).order("analisado_em", { ascending: false }).limit(1).maybeSingle();
    const a = ant as { proxima_acao_sugerida?: string | null; justificativa?: string | null; prazo_sugerido?: string | null; confianca?: number | null; analisado_em?: string | null } | null;
    if (a && (a.justificativa || a.proxima_acao_sugerida)) {
      anteriorTxt =
        `\nANÁLISE ANTERIOR DA SARA (${a.analisado_em ?? "sem data"}, confiança ${a.confianca ?? "—"}) — componha com ela, dizendo o que mudou:\n` +
        `- Diagnóstico anterior: ${(a.justificativa ?? "—").slice(0, 300)}\n` +
        `- Ação anterior: ${(a.proxima_acao_sugerida ?? "—").slice(0, 200)} (prazo ${a.prazo_sugerido ?? "—"})`;
    }
  }

  const input =
    `HOJE: ${new Date().toISOString()}\n` +
    `ATENDIMENTO: ${nome} (negócio ${nid}) · etapa atual: ${est.etapa ?? "novo"} · ` +
    `cliente respondeu: ${est.respondeu ? "sim" : "não"} · aguardando o corretor: ${est.resposta_pendente ? "sim" : "não"} · ` +
    `tentativas humanas: ${est.tentativas_feitas ?? 0} · última interação: ${est.ultima_interacao_em ?? "nunca"} · ` +
    `próxima ação registrada: ${est.proxima_acao_titulo ?? "nenhuma"} (${est.proxima_acao_em ?? "sem prazo"})\n` +
    `CONVERSA REAL (ordem cronológica):\n${conversaTxt}` + anteriorTxt;

  void supabase.rpc("perf_log_sessao", { p_tipo: "ncrm_sara_pergunta" }).then(() => {}, () => {});

  /* O modelo às vezes responde prosa em vez do JSON pedido (~metade das
     chamadas, medido em produção em 31/07). Falha estocástica se resolve
     tentando de novo: até 3 tentativas, devolvendo a primeira válida. O
     custo é segundos; a alternativa era o corretor ver "sugestão inválida"
     e desistir da Sara. */
  const MAX_TENTATIVAS_IA = 3;
  let ultimaFalha = "ia_indisponivel";
  for (let i = 0; i < MAX_TENTATIVAS_IA; i++) {
    const ia = await chamarIaRouter(token, input);
    if (!ia.ok) { ultimaFalha = ia.erro; continue; }
    const norm = normalizarSugestaoSara(ia.raw);
    if (norm.ok) {
      /* Persiste a análise: é isto que faz o card de TODO aparelho mostrar o
         diagnóstico, a próxima ação e o prazo — sem depender do navegador de
         quem pediu. Hash do input = mesma conversa não duplica linha. */
      const sug = norm.sugestao;
      const { data: grava } = await db.rpc("ncrm_sara_analise_usuario", {
        p_negocio_id: nid,
        p_etapa_atual: est.etapa ?? "novo",
        p_etapa_sugerida: sug.etapa_sugerida,
        p_proxima_acao: sug.proxima_acao,
        p_prazo: sug.prazo_sugerido,
        p_justificativa: sug.justificativa,
        p_evidencias: JSON.parse(JSON.stringify(sug.evidencias ?? [])),
        p_confianca: sug.confianca,
        p_hash: `ui:${hashEstavel(input)}`,
      });
      const gr = (grava ?? {}) as { ok?: boolean };
      return Response.json({ ok: true, negocio: nid, sugestao: sug, tentativa: i + 1, persistida: gr.ok === true });
    }
    ultimaFalha = norm.erro;
  }
  const ehFormato = ultimaFalha.startsWith("resposta_") || ultimaFalha.startsWith("sugestao_") || ultimaFalha === "confianca_invalida";
  return Response.json(
    { error: ehFormato ? "A Sara não retornou uma sugestão válida." : "Sara indisponível no momento.", motivo: ultimaFalha },
    { status: ehFormato ? 422 : 503 },
  );
}

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const decisao = body.decisao === "aceita" ? "aceita" : body.decisao === "rejeitada" ? "rejeitada" : null;
  if (!decisao) return Response.json({ error: "decisao inválida (aceita|rejeitada)" }, { status: 422 });
  const negocioId = inteiroPositivo(body.negocioId);
  if (negocioId === null) return Response.json({ error: "negocio inválido" }, { status: 422 });
  const sugestao = (body.sugestao && typeof body.sugestao === "object" && !Array.isArray(body.sugestao)) ? body.sugestao : null;
  if (!sugestao) return Response.json({ error: "sugestão inválida" }, { status: 422 });
  // Limite de tamanho: não aceitar objeto arbitrário enorme.
  const sugestaoStr = JSON.stringify(sugestao);
  if (sugestaoStr.length > MAX_SUGESTAO_BYTES) return Response.json({ error: "sugestão excede o tamanho máximo permitido." }, { status: 413 });
  // Revalida a sugestão pelo MESMO schema explícito do GET.
  const norm = normalizarSugestaoSara(sugestao);
  if (!norm.ok) return Response.json({ error: "sugestão inválida para persistência.", motivo: norm.erro }, { status: 422 });
  const confianca = norm.sugestao.confianca;
  const justificativa = textoLimitado(body.justificativa, 500);
  const baseVersao = inteiroPositivo(body.baseVersao) ?? 1;
  // Idempotência ESTÁVEL por (decisão, negócio, sugestão): mesma decisão sobre a mesma sugestão não duplica.
  const idem = `sara:${decisao}:${negocioId}:${hashEstavel(sugestaoStr)}`;

  // Persiste a DECISÃO HUMANA de forma AUDITÁVEL via RPC autenticada (pode_operar no banco).
  // registrado=true SÓ depois da persistência real. Sem engolir erro.
  const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data, error } = await db.rpc("ncrm_registrar_decisao_sara", {
    p_negocio_id: negocioId, p_base_versao: baseVersao, p_decisao: decisao,
    p_sugestao: sugestao, p_confianca: confianca, p_justificativa: justificativa, p_idem: idem,
  });
  if (error) return Response.json({ ok: false, error: "Falha ao registrar a decisão da Sara.", detalhe: error.message }, { status: 502 });
  const res = (data ?? {}) as { ok?: boolean; erro?: string };
  if (res.ok === false) return Response.json({ ok: false, erro: res.erro, error: "Decisão não permitida." }, { status: 409 });

  return Response.json({ ok: true, registrado: true, decisao, justificativa });
}
