import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { interesseDasTags, normalizarTagsDoLead, type TagDoLead } from "../../lib/lead-tags";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function clienteAutenticado(request: Request) {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

/* Lead descartado sai do funil mas continua no banco: o descarte e sempre
   decisao humana e precisa poder ser auditado e resgatado depois. */
async function listarLeadsSemCorte(db: SupabaseClient) {
  const pagina = 1000;
  const todos: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await db
      .from("f2_lead")
      .select("*")
      .is("descartado_em", null)
      .order("proxima_acao_em", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) return { data: null, error };
    todos.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data?.length ?? 0) < pagina) return { data: todos, error: null };
  }
}

async function listarAnalisesSemCorte(db: SupabaseClient) {
  const pagina = 1000;
  const todos: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await db.from("f2_sara_analise")
      .select("id,funil_lead_id,status,momento_sugerido,acao_sugerida,resumo,confianca,analisado_em")
      .order("analisado_em", { ascending: false }).range(inicio, inicio + pagina - 1);
    if (error) return { data: null, error };
    todos.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data?.length ?? 0) < pagina) return { data: todos, error: null };
  }
}

/* A instancia REAL de cada lead: a da ultima mensagem da conversa dele, em
   qualquer direcao. E a conversa viva -- se o cliente escreveu para o numero A,
   e por A que ele tem que ser respondido, nao importa qual numero o corretor
   usou por ultimo em outro atendimento.

   O calculo vive numa funcao SQL (f2_instancia_por_lead) porque exige a ultima
   mensagem de cada conversa: sao 130 mil linhas em wa_mensagens, e um
   `distinct on` com indice resolve em ~20ms o que em JavaScript exigiria
   trazer a tabela inteira. A funcao e SECURITY INVOKER, entao le sob as mesmas
   policies de RLS que esta rota ja obedece. */
async function instanciasPorLead(db: SupabaseClient) {
  const mapa = new Map<string, { rotulo: string | null; telefone: string | null; status: string | null }>();
  const { data, error } = await db.rpc("f2_instancia_por_lead");
  /* Falhar aqui nao pode derrubar o Funil: sem o mapa, cada lead cai no numero
     padrao do corretor -- exatamente o comportamento anterior. */
  if (error || !Array.isArray(data)) return mapa;
  for (const linha of data as Array<{ funil_lead_id: string; rotulo: string | null; telefone: string | null; status: string | null }>) {
    if (!linha?.funil_lead_id) continue;
    mapa.set(String(linha.funil_lead_id), {
      rotulo: linha.rotulo ? String(linha.rotulo).trim() : null,
      telefone: linha.telefone ? String(linha.telefone) : null,
      status: linha.status ? String(linha.status) : null,
    });
  }
  return mapa;
}

/* Numero padrao do corretor -- usado SO quando o lead ainda nao tem conversa
   nenhuma. Enquanto isto era a unica fonte, corretor com dois numeros via o
   mesmo selo em todos os leads e nao sabia por onde falar com cada cliente. */
async function instanciasPorCorretor(db: SupabaseClient, corretorIds: number[]) {
  const mapa = new Map<number, { rotulo: string | null; telefone: string | null; status: string | null }>();
  if (!corretorIds.length) return mapa;
  const { data } = await db
    .from("wa_instancias")
    .select("corretor_id,rotulo,telefone,status,ultimo_heartbeat")
    .in("corretor_id", corretorIds)
    .order("ultimo_heartbeat", { ascending: false, nullsFirst: false });
  for (const linha of data ?? []) {
    const id = Number(linha.corretor_id);
    if (!Number.isFinite(id) || mapa.has(id)) continue;
    mapa.set(id, {
      rotulo: linha.rotulo ? String(linha.rotulo).trim() : null,
      telefone: linha.telefone ? String(linha.telefone) : null,
      status: linha.status ? String(linha.status) : null,
    });
  }
  return mapa;
}

export async function GET(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  const db = auth.db;
  const [
    { data: leads, error: e1 }, { data: momentos, error: e2 }, { data: eventos, error: e3 },
    { data: etapas, error: e4 }, { data: visitas, error: e5 }, { data: negociacoes, error: e6 },
    { data: aquario, error: e7 }, { data: operacao, error: e8 }, { data: notas },
    { data: saraModo }, { data: saraRunner }, { data: saraF2Config }, saraF2Analises,
    analisesSara, { data: decisoesSara },
  ] = await Promise.all([
    listarLeadsSemCorte(db),
    db.from("f2_momento_config").select("*").order("etapa", { ascending: true }).order("ordem", { ascending: true }),
    db.from("f2_evento").select("id,funil_lead_id,tipo,titulo,detalhe,payload,criado_em").order("criado_em", { ascending: false }).limit(100),
    db.from("f2_etapa_config").select("codigo,ordem,rotulo,ajuda,ativo").order("ordem", { ascending: true }),
    db.from("f2_visita").select("id,funil_lead_id,inicio_em,fim_em,imovel,status,observacao,empreendimento_id,unidade,com_gerente,gerente_id,feedback_em,feedback_por,atualizado_em").order("inicio_em", { ascending: true }),
    db.from("f2_negociacao").select("id,funil_lead_id,titulo,etapa,valor,observacao,atualizado_em").order("atualizado_em", { ascending: false }),
    db.rpc("f2_listar_aquario"),
    db.from("f2_operacao_config").select("*").eq("id", true).maybeSingle(),
    db.from("f2_nota").select("id,funil_lead_id,texto,origem,autor_nome,criado_em").order("criado_em", { ascending: false }).limit(500),
    db.rpc("ncrm_sara_modo_status"),
    db.rpc("ncrm_sara_runner_status"),
    db.from("f2_sara_config").select("enabled,lote,modo_execucao,canary_limite").eq("id", true).maybeSingle(),
    db.from("f2_sara_analise").select("id", { count: "exact", head: true }),
    listarAnalisesSemCorte(db),
    db.from("f2_sara_decisao").select("id,analise_id,funil_lead_id,decisao,motivo,decidido_em").order("decidido_em", { ascending: false }),
  ]);
  if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || analisesSara.error) {
    const message = e1?.message || e2?.message || e3?.message || e4?.message || e5?.message || e6?.message || e7?.message || analisesSara.error?.message || "Falha ao carregar o Funil 2.0.";
    return Response.json({ error: message }, { status: message.toLowerCase().includes("permission") ? 403 : 502 });
  }
  const negociosIds = [...new Set((leads ?? []).map((lead) => Number(lead.origem_negocio_id)).filter(Number.isFinite))];
  const negocioLead = new Map<number, number>();
  for (let inicio = 0; inicio < negociosIds.length; inicio += 500) {
    const { data: negocios, error } = await db.from("negocios").select("id,lead_id").in("id", negociosIds.slice(inicio, inicio + 500));
    if (error) return Response.json({ error: "Não foi possível vincular o histórico real dos leads." }, { status: 502 });
    for (const negocio of negocios ?? []) negocioLead.set(Number(negocio.id), Number(negocio.lead_id));
  }
  /* f2_lead e uma copia operacional e, de proposito, nao duplica as tags.
     Voltamos ao lead original pelo negocio e lemos com o MESMO cliente
     autenticado da sessao: as policies de RLS continuam decidindo exatamente
     quais tags o corretor pode ver. */
  const tagsPorLead = new Map<number, { tags: TagDoLead[]; interesse: string | null }>();
  const leadsOriginaisIds = [...new Set(negocioLead.values())].filter(Number.isFinite);
  for (let inicio = 0; inicio < leadsOriginaisIds.length; inicio += 500) {
    const { data: originais, error } = await db.from("leads").select("id,tags").in("id", leadsOriginaisIds.slice(inicio, inicio + 500));
    if (error) return Response.json({ error: "Não foi possível carregar as tags de interesse dos leads." }, { status: 502 });
    for (const original of originais ?? []) {
      const tags = normalizarTagsDoLead(original.tags);
      tagsPorLead.set(Number(original.id), { tags, interesse: interesseDasTags(tags) });
    }
  }
  const corretorIds = [...new Set((leads ?? []).map((lead) => Number(lead.corretor_id)).filter(Number.isFinite))];
  const [instancias, instanciaDoLead] = await Promise.all([
    instanciasPorCorretor(db, corretorIds),
    instanciasPorLead(db),
  ]);
  const leadsComOrigem = (leads ?? []).map((lead) => {
    /* A conversa manda. O numero padrao do corretor so entra quando o lead
       ainda nao trocou nenhuma mensagem -- ai qualquer numero dele serve, e o
       selo vira uma previsao ("vai sair por aqui") em vez de um fato. */
    const daConversa = instanciaDoLead.get(String(lead.id));
    const instancia = daConversa ?? instancias.get(Number(lead.corretor_id));
    const leadOriginalId = negocioLead.get(Number(lead.origem_negocio_id)) ?? 0;
    const contexto = tagsPorLead.get(leadOriginalId);
    return {
      ...lead,
      lead_id: leadOriginalId,
      interesse: contexto?.interesse ?? null,
      tags: contexto?.tags ?? [],
      instancia_rotulo: instancia?.rotulo ?? null,
      instancia_telefone: instancia?.telefone ?? null,
      instancia_status: instancia?.status ?? null,
      instancia_origem: daConversa ? "conversa" : "padrao",
    };
  });
  return Response.json({
    leads: leadsComOrigem, momentos: momentos ?? [], eventos: eventos ?? [], etapas: etapas ?? [],
    visitas: visitas ?? [], negociacoes: negociacoes ?? [], aquario: aquario ?? [], operacao: e8 ? null : operacao ?? null,
    notas: notas ?? [], analisesSara: analisesSara.data ?? [], decisoesSara: decisoesSara ?? [],
    sara: {
      modo: typeof saraModo === "object" && saraModo !== null && "modo" in saraModo ? String((saraModo as { modo?: unknown }).modo ?? "") || null : null,
      runnerAtivo: typeof saraRunner === "object" && saraRunner !== null && "enabled" in saraRunner ? (saraRunner as { enabled?: unknown }).enabled === true : false,
      analisesNoLaboratorio: saraF2Analises.count ?? (leads ?? []).filter((lead) => Boolean(lead.ultima_reavaliacao_sara_em)).length,
      reavaliacaoAutomaticaFunil2: saraF2Config?.enabled === true,
      loteFunil2: typeof saraF2Config?.lote === "number" ? saraF2Config.lote : null,
      modoExecucaoFunil2: saraF2Config?.modo_execucao === "completo" ? "completo" : "canary",
      canaryLimiteFunil2: typeof saraF2Config?.canary_limite === "number" ? saraF2Config.canary_limite : null,
    },
    limite: null, laboratorio: false,
    migracao: { aquarioIncluido: false, origensPreservadas: true },
  });
}

export async function POST(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const action = String(body.action ?? "");
  if (action === "decidirSugestao") {
    const analiseId = Number(body.analiseId);
    const decisao = body.decisao === "aceita" ? "aceita" : body.decisao === "recusada" ? "recusada" : "";
    if (!Number.isInteger(analiseId) || analiseId < 1 || !decisao) return Response.json({ error: "Decisão inválida." }, { status: 422 });
    const { data, error } = await auth.db.rpc("f2_decidir_sugestao", {
      p_analise_id: analiseId,
      p_decisao: decisao,
      p_motivo: String(body.motivo ?? "").trim().slice(0, 500) || null,
    });
    if (error) return Response.json({ error: "Não foi possível registrar sua decisão." }, { status: 502 });
    const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
    if (resultado.ok !== true) {
      const conflito = ["versao_conflito", "decisao_ja_registrada"].includes(resultado.erro ?? "");
      const proibido = resultado.erro === "sem_permissao";
      return Response.json({ error: conflito
        ? "A sugestão mudou desde que foi exibida. Atualize e tente de novo."
        : proibido ? "Você não pode decidir por este atendimento." : "Sugestão não encontrada." },
      { status: conflito ? 409 : proibido ? 403 : 404 });
    }
    return Response.json({ ok: true, decisao });
  }
  let rpc = "";
  let args: Record<string, unknown> = {};

  if (action === "configurarEtapa") {
    rpc = "f2_configurar_etapa";
    args = {
      p_codigo: String(body.codigo ?? "").slice(0, 40), p_rotulo: String(body.rotulo ?? "").slice(0, 60),
      p_ajuda: String(body.ajuda ?? "").slice(0, 240), p_ordem: Number(body.ordem), p_ativo: body.ativo !== false,
    };
  } else if (action === "configurarMomento") {
    rpc = "f2_configurar_momento";
    args = {
      p_codigo: String(body.codigo ?? "").slice(0, 50), p_etapa: String(body.etapa ?? "").slice(0, 40),
      p_rotulo: String(body.rotulo ?? "").slice(0, 80), p_descricao: String(body.descricao ?? "").slice(0, 300),
      p_acao_rotulo: String(body.acaoRotulo ?? "").slice(0, 120), p_prazo_minutos: Number(body.prazoMinutos),
      p_ordem: Number(body.ordem), p_exige_dapi: body.exigeDapi === true, p_ativo: body.ativo !== false,
    };
  } else if (action === "salvarVisita") {
    const inicio = new Date(String(body.inicioEm ?? ""));
    if (Number.isNaN(inicio.getTime())) return Response.json({ error: "Data da visita inválida." }, { status: 422 });
    rpc = "f2_salvar_visita";
    args = {
      p_id: body.id || null, p_lead_id: body.leadId,
      p_inicio_em: inicio.toISOString(),
      p_imovel: String(body.imovel ?? "").slice(0, 120),
      p_status: body.status || "agendada",
      p_observacao: body.observacao ? String(body.observacao).slice(0, 500) : null,
      /* Campos que o CRM antigo sempre teve e o Funil 2.0 tinha perdido:
         produto, unidade e presenca do gerente. Sem eles a visita vira um
         compromisso solto, sem dizer o que vai ser mostrado nem com quem. */
      p_empreendimento_id: body.empreendimentoId || null,
      p_unidade: body.unidade ? String(body.unidade).slice(0, 60) : null,
      p_com_gerente: body.comGerente === true,
      p_gerente_id: body.gerenteId ? Number(body.gerenteId) : null,
      p_fim_em: body.fimEm ? new Date(String(body.fimEm)).toISOString() : null,
    };
  } else if (action === "salvarNota") {
    const leadId = String(body.leadId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return Response.json({ error: "Lead inválido." }, { status: 422 });
    const texto = String(body.texto ?? "").trim();
    if (!texto) return Response.json({ error: "Escreva a nota antes de salvar." }, { status: 422 });
    rpc = "f2_salvar_nota";
    args = { p_lead_id: leadId, p_texto: texto.slice(0, 2000) };
  } else if (action === "salvarNegociacao") {
    rpc = "f2_salvar_negociacao";
    args = { p_id: body.id || null, p_lead_id: body.leadId, p_titulo: String(body.titulo ?? "").slice(0, 120), p_etapa: body.etapa || "qualificacao", p_valor: body.valor === "" || body.valor == null ? null : Number(body.valor), p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "pescar") {
    rpc = "f2_pescar_negocio";
    args = { p_negocio_id: Number(body.negocioId), p_substituir_id: null };
  } else if (action === "trazerLeadAntigo") {
    /* Traz UM lead da carteira antiga para o funil, na etapa e no momento que
       o corretor escolheu. A trava de "Lead novo / Primeira abordagem" mora na
       função SQL, não aqui: regra de negócio perto do dado é regra que uma
       segunda porta não consegue burlar. */
    rpc = "f2_trazer_lead_antigo";
    args = {
      p_lead_id: Number(body.leadId),
      p_etapa: String(body.etapa ?? "").slice(0, 40),
      p_momento: String(body.momento ?? "").slice(0, 50),
    };
  } else if (action === "configurarOperacao") {
    rpc = "f2_configurar_operacao";
    args = {
      p_horario_inicio: body.horarioInicio, p_horario_fim: body.horarioFim,
      p_presenca_ttl_min: Number(body.presencaTtlMin), p_primeira_abordagem_min: Number(body.primeiraAbordagemMin),
      p_feedback_visita_min: Number(body.feedbackVisitaMin), p_notificacao_urgente_min: Number(body.notificacaoUrgenteMin),
      p_peso_primeira_abordagem: Number(body.pesoPrimeiraAbordagem), p_peso_acoes_prazo: Number(body.pesoAcoesPrazo),
      p_peso_feedback_visita: Number(body.pesoFeedbackVisita), p_peso_presenca_dapi: Number(body.pesoPresencaDapi),
      p_peso_coerencia_sara: Number(body.pesoCoerenciaSara), p_suspensao_nivel_1_h: Number(body.suspensaoNivel1H),
      p_suspensao_nivel_2_h: Number(body.suspensaoNivel2H), p_suspensao_nivel_3_h: Number(body.suspensaoNivel3H),
    };
  } else {
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  const { data, error } = await auth.db.rpc(rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
  if (resultado.ok === false) return Response.json({ error: resultado.erro || "Ação não permitida." }, { status: 409 });
  return Response.json({ ok: true, resultado });
}

/* Mensagem em portugues para cada recusa da RPC. Sem isto o corretor ve
   "motivo_invalido" na tela e nao sabe o que fazer. */
const RECUSAS: Record<string, string> = {
  sem_permissao: "Este lead não é seu.",
  lead_nao_encontrado: "Lead não encontrado.",
  versao_desatualizada: "Alguém mexeu neste lead agora. Recarregue e tente de novo.",
  ja_descartado: "Este lead já foi descartado.",
  motivo_obrigatorio: "Escolha o motivo do descarte.",
  motivo_invalido: "Motivo de descarte desconhecido.",
  texto_vazio: "Escreva a nota antes de salvar.",
  texto_muito_longo: "A nota passou de 2000 caracteres.",
  versao_conflito: "O lead acabou de mudar. Tente salvar novamente.",
};

export async function PATCH(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  const versao = Number(body.versao);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(versao) || versao < 1) {
    return Response.json({ error: "Lead ou versão inválidos." }, { status: 422 });
  }

  const db = auth.db;
  const action = String(body.action ?? "");
  let rpc = "";
  let args: Record<string, unknown> = {};
  if (action === "atualizarMomento") {
    const momento = String(body.momentoCodigo ?? "");
    if (!/^[A-Z_]{3,50}$/.test(momento)) return Response.json({ error: "Momento inválido." }, { status: 422 });
    const prazo = body.prazoCombinado ? new Date(String(body.prazoCombinado)) : null;
    if (prazo && Number.isNaN(prazo.getTime())) return Response.json({ error: "Prazo combinado inválido." }, { status: 422 });
    rpc = "f2_atualizar_momento";
    args = { p_id: id, p_versao: versao, p_momento_codigo: momento, p_prazo_combinado: prazo?.toISOString() ?? null, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "confirmarAcao") {
    const fonte = body.fonte === "dapi" ? "dapi" : body.fonte === "registro_operacional" ? "registro_operacional" : "";
    if (!fonte) return Response.json({ error: "Fonte de confirmação inválida." }, { status: 422 });
    rpc = "f2_confirmar_acao";
    args = { p_id: id, p_versao: versao, p_fonte: fonte, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "descartar") {
    /* Nenhum lead sai do funil sozinho, por silencio ou por tempo. Sempre tem
       alguem clicando e escolhendo o motivo -- regra do Romulo, 05/08/2026. */
    const motivo = String(body.motivo ?? "").trim();
    if (!motivo) return Response.json({ error: "Escolha o motivo do descarte." }, { status: 422 });
    rpc = "f2_descartar_lead";
    args = { p_id: id, p_versao: versao, p_motivo: motivo.slice(0, 80), p_detalhe: String(body.detalhe ?? "").slice(0, 500) || null };
  } else {
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  let { data, error } = await db.rpc(rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  let resultado = (data ?? {}) as { ok?: boolean; erro?: string };

  /* A Sara reavalia o lead em segundo plano e sobe a versão. Quando isso
     acontece entre o corretor abrir a ficha e salvar, a versão que a tela
     mandou fica para trás e a RPC recusa com "versao_conflito", obrigando o
     corretor a recarregar a página. Em vez disso, relemos a versão atual do
     lead (o corretor já pode vê-lo por RLS) e reexecutamos a ação UMA vez com
     a versão correta — a observação/momento é gravada sem refresh manual.
     Retry único: se conflitar de novo, é disputa real e a recusa segue. */
  if (resultado.ok === false && resultado.erro === "versao_conflito") {
    const { data: atual } = await db.from("f2_lead").select("versao").eq("id", id).maybeSingle();
    const versaoAtual = (atual as { versao?: number } | null)?.versao;
    if (typeof versaoAtual === "number" && versaoAtual !== versao) {
      args = { ...args, p_versao: versaoAtual };
      ({ data, error } = await db.rpc(rpc, args));
      if (error) return Response.json({ error: error.message }, { status: 502 });
      resultado = (data ?? {}) as { ok?: boolean; erro?: string };
    }
  }

  if (resultado.ok === false) {
    const chave = String(resultado.erro ?? "");
    // Devolve também o código cru (erro) para a tela poder reagir a conflitos
    // de versão sem depender do texto traduzido.
    return Response.json({ error: RECUSAS[chave] || resultado.erro || "Ação não permitida.", erro: chave }, { status: 409 });
  }
  return Response.json({ ok: true, resultado });
}
