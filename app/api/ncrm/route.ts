/**
 * API do CRM Nova Era — LEITURA (ncrm_estado/evento/proposta) e AÇÕES via RPCs ncrm_*.
 * ---------------------------------------------------------------------------
 * Segurança:
 *  - Sempre com o JWT do usuário (createServerSupabaseClient(token)) => RLS decide o que ele vê.
 *  - Escrita SOMENTE por RPC ncrm_* (nunca UPDATE/INSERT direto nas tabelas ncrm_*).
 *  - service_role NUNCA é usado aqui (as RPCs de automação são service_role-only e ficam fora).
 *  - A autorização real (corretor/gestor/admin) é reforçada no banco (pode_operar_negocio, fail-closed).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { validarAcao, validarQuery, inteiroPositivo } from "./validate";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

/** Nota: as tabelas ncrm_* ainda não constam em database.types.ts. As chamadas ncrm usam um
 * cliente reinterpretado como SupabaseClient (sem tipos): a segurança é do banco (RLS + RPC fail-closed). */

const EMBED =
  "negocio_id,etapa,respondeu,resposta_pendente,aguardando_automacao,tentativas_feitas," +
  "proxima_acao_tipo,proxima_acao_titulo,proxima_acao_em,ultima_interacao_em,temperatura," +
  "saida,saida_em,visita_id,proposta_id,descarte_motivo,descarte_detalhe,versao,atualizado_em," +
  "msg_automatica_em,primeira_resposta_em," +
  "negocios(id,status,lead_id,corretor_id,leads(nome,telefone,email,origem,extras),corretores(id,nome))";

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  const url = new URL(request.url);
  const negocio = url.searchParams.get("negocio");

  // ---- Detalhe de um lead (estado + eventos + propostas) ----
  if (negocio) {
    const nid = inteiroPositivo(negocio);
    if (nid === null) return Response.json({ error: "negocio inválido" }, { status: 422 });
    const [{ data: estado, error: e1 }, { data: eventos, error: e2 }, { data: propostas, error: e3 }] =
      await Promise.all([
        db.from("ncrm_estado").select(EMBED).eq("negocio_id", nid).maybeSingle(),
        db
          .from("ncrm_evento")
          .select("id,tipo,numero_tentativa,canal,resultado,payload,origem,criado_em,estado_versao_apos")
          .eq("negocio_id", nid)
          .order("id", { ascending: true })
          .limit(500),
        db
          .from("ncrm_proposta")
          .select("id,status,valor,data_proposta,motivo_encerramento,criada_em,encerrada_em,versao")
          .eq("negocio_id", nid)
          .order("criada_em", { ascending: false }),
      ]);
    if (e1 || e2 || e3) return Response.json({ error: e1?.message || e2?.message || e3?.message }, { status: 502 });
    if (!estado) return Response.json({ error: "Lead não visível ou inexistente." }, { status: 404 });

    /* Imóveis do cliente: MESMA tabela e MESMO embed que o CRM atual já lê em
       /api/crm (lead_produtos). Nenhuma tabela nova, nenhuma regra nova — só
       evita que a ficha do CRM 3.0 tenha de baixar o CRM inteiro para mostrar
       o bloco "Imóveis". A RLS continua sendo quem autoriza. */
    const leadId = (estado as { negocios?: { lead_id?: number | null } | null }).negocios?.lead_id ?? null;
    const { data: imoveis } = leadId
      ? await db
          .from("lead_produtos")
          .select("empreendimento_id,empreendimentos(id,nome,bairro,cidade)")
          .eq("lead_id", leadId)
          .limit(30)
      : { data: [] as unknown[] };

    return Response.json({ estado, eventos: eventos ?? [], propostas: propostas ?? [], imoveis: imoveis ?? [] });
  }

  // ---- Quadro / saídas / tudo (paginado) ----
  const vq = validarQuery(url.searchParams);
  if (!vq.ok) return Response.json({ error: vq.erro }, { status: 422 });
  const { scope, limit, offset } = vq.value;

  let q = db.from("ncrm_estado").select(EMBED, { count: "exact" });
  if (scope === "board") q = q.is("saida", null);
  else if (scope === "saidas") q = q.not("saida", "is", null);
  q = q
    .order("proxima_acao_em", { ascending: true, nullsFirst: false })
    .order("negocio_id", { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return Response.json({ error: error.message }, { status: 502 });

  /* Última análise da Sara por negócio — o card mostra diagnóstico, próxima
     ação e prazo sem nenhuma chamada de IA no carregamento. Colunas lidas são
     as liberadas para authenticated; uma consulta indexada, custo constante. */
  const analises: Record<number, unknown> = {};
  const ids = ((data ?? []) as unknown as Array<{ negocio_id: number }>).map((i) => i.negocio_id);
  if (ids.length > 0) {
    const { data: an } = await db
      .from("ncrm_sara_analise")
      .select("negocio_id,proxima_acao_sugerida,justificativa,prazo_sugerido,confianca,etapa_sugerida,analisado_em")
      .in("negocio_id", ids)
      .order("analisado_em", { ascending: false })
      .limit(Math.min(400, ids.length * 3));
    for (const a of (an ?? []) as Array<{ negocio_id: number }>) {
      if (!(a.negocio_id in analises)) analises[a.negocio_id] = a;
    }
  }

  return Response.json({
    analises,
    itens: data ?? [],
    total: count ?? (data?.length ?? 0),
    offset,
    limit,
    temMais: (count ?? 0) > offset + (data?.length ?? 0),
  });
}

/** Mapa ação -> (nome da RPC, construtor de args a partir do body). RPC-only. */
type Ctx = { negocio_id: number; versao: number; idem: string; b: Record<string, unknown> };
const ACOES: Record<string, { rpc: string; args: (c: Ctx) => Record<string, unknown> }> = {
  registrarTentativa: {
    rpc: "ncrm_registrar_tentativa",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id,
      p_versao: versao,
      p_canal: b.canal,
      p_resultado: b.resultado,
      p_obs: b.obs ?? null,
      // Sem resposta: o banco IGNORA estes campos e calcula pela cadência. Com resposta: exige ação comercial.
      p_proxima_tipo: b.proximaTipo ?? null,
      p_proxima_titulo: b.proximaTitulo ?? null,
      p_proxima_em: b.proximaEm ?? null,
      p_idem: idem,
    }),
  },
  concluirAcao: {
    rpc: "ncrm_concluir_acao",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_resultado: b.resultado, p_obs: b.obs ?? null,
      p_proxima_tipo: b.proximaTipo, p_proxima_titulo: b.proximaTitulo, p_proxima_em: b.proximaEm, p_idem: idem,
    }),
  },
  saidaVisita: {
    rpc: "ncrm_saida_visita",
    args: ({ negocio_id, versao, idem, b }) => ({ p_negocio_id: negocio_id, p_versao: versao, p_visita_id: b.visitaId, p_idem: idem }),
  },
  saidaProposta: {
    rpc: "ncrm_saida_proposta",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_empreendimento_id: b.empreendimentoId ?? null,
      p_unidade_id: b.unidadeId ?? null, p_valor: b.valor, p_data: b.data ?? new Date().toISOString(),
      p_obs: b.obs ?? null, p_idem: idem,
    }),
  },
  registrarPropostaEsteira: {
    rpc: "ncrm_registrar_proposta_esteira",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_produto_id: b.produtoId, p_valor: b.valor,
      p_forma: b.forma ?? null, p_obs: b.obs ?? null, p_idem: idem,
    }),
  },
  agendarVisita: {
    rpc: "ncrm_agendar_visita_e_encaminhar",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_lead_id: b.leadId, p_data: b.data, p_hora_inicio: b.horaInicio,
      p_empreendimento_id: b.empreendimentoId ?? null, p_produto: b.produto ?? null,
      p_com_gerente: b.comGerente ?? false, p_gerente_id: b.gerenteId ?? null, p_idem: idem,
    }),
  },
  propostaTransicao: {
    rpc: "ncrm_proposta_transicao",
    args: ({ idem, b }) => ({ p_proposta_id: b.propostaId, p_versao_prop: b.versaoProp, p_novo_status: b.novoStatus, p_motivo: b.motivo ?? null, p_idem: idem }),
  },
  saidaDescarte: {
    rpc: "ncrm_saida_descarte",
    args: ({ negocio_id, versao, idem, b }) => ({ p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo, p_detalhe: b.detalhe ?? null, p_idem: idem }),
  },
  saidaNutricao: {
    rpc: "ncrm_saida_nutricao",
    args: ({ negocio_id, versao, idem, b }) => ({ p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo ?? null, p_idem: idem }),
  },
  reativar: {
    rpc: "ncrm_reativar",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo, p_etapa: b.etapa,
      p_proxima_tipo: b.proximaTipo, p_proxima_titulo: b.proximaTitulo, p_proxima_em: b.proximaEm, p_idem: idem,
    }),
  },
  reativarAposProposta: {
    rpc: "ncrm_reativar_apos_proposta",
    args: ({ negocio_id, versao, idem, b }) => ({
      p_negocio_id: negocio_id, p_versao: versao, p_motivo: b.motivo, p_etapa: b.etapa,
      p_proxima_tipo: b.proximaTipo, p_proxima_titulo: b.proximaTitulo, p_proxima_em: b.proximaEm, p_idem: idem,
    }),
  },
};

const ERRO_HUMANO: Record<string, string> = {
  sem_permissao: "Você não tem permissão para operar este lead.",
  versao_conflito: "O lead mudou enquanto você agia. Recarregue e tente de novo.",
  estado_em_saida: "Este lead já saiu do quadro (visita/proposta/descarte).",
  cadencia_encerrada: "O cliente já respondeu — a prospecção foi encerrada.",
  cadencia_esgotada: "Cadência esgotada. Avalie descarte ou nutrição.",
  proxima_acao_obrigatoria: "Defina a próxima ação comercial.",
  proxima_acao_fora_do_fluxo: "A próxima ação não pertence ao fluxo permitido.",
  proxima_acao_em_no_passado: "O prazo da próxima ação não pode estar no passado.",
  visita_invalida: "Visita inválida ou não pertence a este lead.",
  ja_em_saida: "O lead já está em uma saída.",
  lead_nao_respondeu: "Conclua a ação apenas após o cliente responder.",
  nao_autenticado: "Sessão inválida. Faça login novamente.",
  idempotency_key_obrigatoria: "Falha técnica de idempotência. Tente novamente.",
  produto_obrigatorio: "Selecione o produto/empreendimento da proposta.",
  valor_invalido: "Informe um valor de proposta válido.",
  lead_incoerente: "Lead não corresponde ao negócio.",
  data_hora_obrigatorias: "Informe data e hora da visita.",
  data_no_passado: "A data da visita não pode estar no passado.",
  falha_ao_criar_solicitacao_esteira: "Não foi possível criar a proposta na Esteira. Nada foi encaminhado.",
  solicitacao_pendente_divergente: "Já existe uma proposta pendente para outro produto ou valor. Revise a solicitação na Esteira antes de continuar.",
};

export async function PATCH(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  const v = validarAcao(body);
  if (!v.ok) return Response.json({ error: v.erro }, { status: 422 });
  const { action, args: valid } = v.value;
  const def = ACOES[action];
  if (!def) return Response.json({ error: "Ação desconhecida." }, { status: 400 });

  const negocio_id = Number(valid.negocioId ?? 0);
  const versao = Number(valid.versao ?? 0);
  const idem = String(body.idem ?? `ui:${action}:${negocio_id || valid.propostaId}:${crypto.randomUUID()}`);
  // Constrói os parâmetros da RPC a partir dos campos JÁ validados/normalizados.
  const args = def.args({ negocio_id, versao, idem, b: valid });
  const { data, error } = await db.rpc(def.rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const res = (data ?? {}) as { ok?: boolean; erro?: string; solicitacao_id?: unknown; produto_id_existente?: unknown; valor_existente?: unknown };
  if (res.ok === false) {
    const corpo: Record<string, unknown> = { ok: false, erro: res.erro, mensagem: (res.erro && ERRO_HUMANO[res.erro]) || "Ação não permitida." };
    // Solicitação pendente divergente: devolve os dados para orientar a revisão na Esteira (sem vazar interno).
    if (res.erro === "solicitacao_pendente_divergente") {
      corpo.detalhes = { solicitacao_id: res.solicitacao_id ?? null, produto_id_existente: res.produto_id_existente ?? null, valor_existente: res.valor_existente ?? null };
    }
    return Response.json(corpo, { status: 409 });
  }
  return Response.json({ ok: true, resultado: data });
}
