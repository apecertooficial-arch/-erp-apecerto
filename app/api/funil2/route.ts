import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { normalizarInstanteSaoPaulo } from "../../lib/timezone";
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

function textoExtra(extras: unknown, chave: string): string | null {
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) return null;
  const valor = (extras as Record<string, unknown>)[chave];
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function enderecoDoLead(extras: unknown): string | null {
  const partes = ["endereco", "numero", "complemento", "bairro", "cidade", "estado", "cep"]
    .map((chave) => textoExtra(extras, chave))
    .filter((valor): valor is string => Boolean(valor));
  return partes.length ? partes.join(", ") : null;
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
  const historicoLeadId = new URL(request.url).searchParams.get("historicoLeadId");
  if (historicoLeadId) {
    if (!/^[0-9a-f-]{36}$/i.test(historicoLeadId)) return Response.json({ error: "Lead inválido." }, { status: 422 });
    /* A carga inicial é deliberadamente curta para o CRM abrir rápido. A ficha,
       porém, precisa do histórico daquele cliente — e não dos 100 eventos mais
       recentes da operação inteira. O RLS continua decidindo o que a sessão
       autenticada pode ler. */
    const [{ data: eventos, error: erroEventos }, { data: notas, error: erroNotas }] = await Promise.all([
      db.from("f2_evento").select("id,funil_lead_id,tipo,titulo,detalhe,payload,criado_em").eq("funil_lead_id", historicoLeadId).order("criado_em", { ascending: false }).limit(500),
      db.from("f2_nota").select("id,funil_lead_id,texto,origem,autor_nome,criado_em").eq("funil_lead_id", historicoLeadId).order("criado_em", { ascending: false }).limit(500),
    ]);
    if (erroEventos || erroNotas) return Response.json({ error: "Não foi possível carregar o histórico deste atendimento." }, { status: 502 });
    return Response.json({ eventos: eventos ?? [], notas: notas ?? [] });
  }
  const [
    { data: leads, error: e1 }, { data: momentos, error: e2 },
    { data: etapas, error: e4 }, { data: visitas, error: e5 },
    { data: aquario, error: e7 }, { data: operacao, error: e8 },
    { data: saraModo }, { data: saraRunner }, { data: saraF2Config }, saraF2Analises,
    { data: tagCatalogo, error: e9 },
  ] = await Promise.all([
    listarLeadsSemCorte(db),
    db.from("f2_momento_config").select("*").order("etapa", { ascending: true }).order("ordem", { ascending: true }),
    db.from("f2_etapa_config").select("codigo,ordem,rotulo,ajuda,ativo").order("ordem", { ascending: true }),
    db.from("f2_visita").select("id,funil_lead_id,inicio_em,fim_em,imovel,status,observacao,empreendimento_id,unidade,com_gerente,gerente_id,feedback_em,feedback_por,atualizado_em").order("inicio_em", { ascending: true }),
    db.rpc("f2_listar_aquario"),
    db.from("f2_operacao_config").select("*").eq("id", true).maybeSingle(),
    db.rpc("ncrm_sara_modo_status"),
    db.rpc("ncrm_sara_runner_status"),
    db.from("f2_sara_config").select("enabled,lote,modo_execucao,canary_limite").eq("id", true).maybeSingle(),
    db.from("f2_sara_analise").select("id", { count: "exact", head: true }),
    db.from("lead_tag_catalogo").select("id,nome,cor").eq("ativo", true).order("nome"),
  ]);
  if (e1 || e2 || e4 || e5 || e7 || e9) {
    const message = e1?.message || e2?.message || e4?.message || e5?.message || e7?.message || e9?.message || "Falha ao carregar o Funil 2.0.";
    return Response.json({ error: message }, { status: message.toLowerCase().includes("permission") ? 403 : 502 });
  }
  const negociacoes: Array<Record<string, unknown>> = [];
  const funilLeadIds = (leads ?? []).map((lead) => String(lead.id));
  for (let inicio = 0; inicio < funilLeadIds.length; inicio += 100) {
    const { data, error } = await db.from("f2_negociacao").select("id,funil_lead_id,titulo,etapa,valor,observacao,atualizado_em").in("funil_lead_id", funilLeadIds.slice(inicio, inicio + 100)).order("atualizado_em", { ascending: false });
    if (error) return Response.json({ error: "Não foi possível carregar as oportunidades do atendimento." }, { status: error.message.toLowerCase().includes("permission") ? 403 : 502 });
    negociacoes.push(...((data ?? []) as Array<Record<string, unknown>>));
  }
  const negociosIds = [...new Set((leads ?? []).map((lead) => Number(lead.origem_negocio_id)).filter(Number.isFinite))];
  type NegocioOriginal = { id: number; lead_id: number; pipeline_id: number; stage_id: number | null; empreendimento_id: string | null; unidade_id: string | null; valor: number | null; status: string; criado_em: string; ultima_movimentacao: string | null };
  type LeadOriginal = { id: number; nome: string | null; telefone: string | null; email: string | null; origem: string | null; corretor_id: number | null; tags: unknown; extras: unknown };
  const negocioLead = new Map<number, { leadId: number; valor: number | null }>();
  for (let inicio = 0; inicio < negociosIds.length; inicio += 500) {
    const { data: negocios, error } = await db.from("negocios").select("id,lead_id,valor").in("id", negociosIds.slice(inicio, inicio + 500));
    if (error) return Response.json({ error: "Não foi possível vincular o histórico real dos leads." }, { status: 502 });
    for (const negocio of negocios ?? []) negocioLead.set(Number(negocio.id), {
      leadId: Number(negocio.lead_id),
      valor: negocio.valor == null ? null : Number(negocio.valor),
    });
  }
  /* f2_lead e uma copia operacional e, de proposito, nao duplica as tags.
     Voltamos ao lead original pelo negocio e lemos com o MESMO cliente
     autenticado da sessao: as policies de RLS continuam decidindo exatamente
     quais tags o corretor pode ver. */
  const contextoPorLead = new Map<number, { original: LeadOriginal; tags: TagDoLead[]; interesse: string | null }>();
  const leadsOriginaisIds = [...new Set([...negocioLead.values()].map((negocio) => negocio.leadId))].filter(Number.isFinite);
  for (let inicio = 0; inicio < leadsOriginaisIds.length; inicio += 500) {
    const { data: originais, error } = await db.from("leads").select("id,nome,telefone,email,origem,corretor_id,tags,extras").in("id", leadsOriginaisIds.slice(inicio, inicio + 500));
    if (error) return Response.json({ error: "Não foi possível carregar a identidade real dos leads." }, { status: error.message.toLowerCase().includes("permission") ? 403 : 502 });
    for (const original of (originais ?? []) as LeadOriginal[]) {
      const tags = normalizarTagsDoLead(original.tags);
      contextoPorLead.set(Number(original.id), { original, tags, interesse: interesseDasTags(tags) });
    }
  }

  const negociosOriginais: NegocioOriginal[] = [];
  for (let inicio = 0; inicio < leadsOriginaisIds.length; inicio += 500) {
    const { data, error } = await db.from("negocios").select("id,lead_id,pipeline_id,stage_id,empreendimento_id,unidade_id,valor,status,criado_em,ultima_movimentacao").in("lead_id", leadsOriginaisIds.slice(inicio, inicio + 500));
    if (error) return Response.json({ error: "Não foi possível carregar os negócios vinculados." }, { status: error.message.toLowerCase().includes("permission") ? 403 : 502 });
    negociosOriginais.push(...((data ?? []) as NegocioOriginal[]));
  }
  const pipelineIds = [...new Set(negociosOriginais.map((item) => item.pipeline_id).filter(Number.isFinite))];
  const stageIds = [...new Set(negociosOriginais.map((item) => item.stage_id).filter((id): id is number => Number.isFinite(id)))];
  const empreendimentoIds = [...new Set(negociosOriginais.map((item) => item.empreendimento_id).filter((id): id is string => Boolean(id)))];
  const unidadeIds = [...new Set(negociosOriginais.map((item) => item.unidade_id).filter((id): id is string => Boolean(id)))];
  const [{ data: pipelines, error: erroPipelines }, { data: stages, error: erroStages }, { data: empreendimentos, error: erroEmpreendimentos }, { data: unidades, error: erroUnidades }] = await Promise.all([
    pipelineIds.length ? db.from("pipelines").select("id,nome").in("id", pipelineIds) : Promise.resolve({ data: [], error: null }),
    stageIds.length ? db.from("pipeline_stages").select("id,nome").in("id", stageIds) : Promise.resolve({ data: [], error: null }),
    empreendimentoIds.length ? db.from("empreendimentos").select("id,nome,endereco,bairro,cidade,preco").in("id", empreendimentoIds) : Promise.resolve({ data: [], error: null }),
    unidadeIds.length ? db.from("unidades").select("id,numero,tipologia,valor_promo,valor_tabela").in("id", unidadeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (erroPipelines || erroStages || erroEmpreendimentos || erroUnidades) return Response.json({ error: "Não foi possível carregar o contexto imobiliário dos negócios." }, { status: 502 });
  const pipelinePorId = new Map((pipelines ?? []).map((item) => [Number(item.id), String(item.nome)]));
  const stagePorId = new Map((stages ?? []).map((item) => [Number(item.id), String(item.nome)]));
  const empreendimentoPorId = new Map((empreendimentos ?? []).map((item) => [String(item.id), item]));
  const unidadePorId = new Map((unidades ?? []).map((item) => [String(item.id), item]));
  const funilIdsPorLeadOriginal = new Map<number, string[]>();
  for (const lead of leads ?? []) {
    const origem = negocioLead.get(Number(lead.origem_negocio_id));
    if (!origem) continue;
    const ids = funilIdsPorLeadOriginal.get(origem.leadId) ?? [];
    ids.push(String(lead.id));
    funilIdsPorLeadOriginal.set(origem.leadId, ids);
  }
  const negociosVinculados = negociosOriginais.flatMap((item) =>
    (funilIdsPorLeadOriginal.get(Number(item.lead_id)) ?? []).map((funilLeadId) => ({
      id: Number(item.id), funil_lead_id: funilLeadId,
      pipeline: pipelinePorId.get(Number(item.pipeline_id)) ?? null,
      etapa: item.stage_id == null ? null : stagePorId.get(Number(item.stage_id)) ?? null,
      empreendimento_id: item.empreendimento_id, unidade_id: item.unidade_id,
      valor: item.valor == null ? null : Number(item.valor), status: String(item.status),
    })),
  );
  const imoveisVinculados = negociosOriginais.filter((item) => item.empreendimento_id || item.unidade_id).flatMap((item) => {
    const empreendimento = item.empreendimento_id ? empreendimentoPorId.get(item.empreendimento_id) : null;
    const unidade = item.unidade_id ? unidadePorId.get(item.unidade_id) : null;
    return (funilIdsPorLeadOriginal.get(Number(item.lead_id)) ?? []).map((funilLeadId) => ({
      negocio_id: Number(item.id), funil_lead_id: funilLeadId,
      empreendimento_id: item.empreendimento_id, empreendimento: empreendimento?.nome ? String(empreendimento.nome) : null,
      unidade_id: item.unidade_id, unidade: unidade?.numero ? String(unidade.numero) : null,
      valor: unidade?.valor_promo != null ? Number(unidade.valor_promo) : unidade?.valor_tabela != null ? Number(unidade.valor_tabela) : item.valor == null ? null : Number(item.valor),
    }));
  });

  let arquivosVinculados: Array<{ id: string; funil_lead_id: string; negocio_id: number; nome: string; status: string; criado_em: string }> = [];
  let arquivosEstado: "ok" | "sem_vinculo" | "erro" = negociosOriginais.length ? "ok" : "sem_vinculo";
  if (negociosOriginais.length) {
    const processos: Array<{ id: string; negocio_id: number }> = [];
    for (let inicio = 0; inicio < negociosOriginais.length; inicio += 500) {
      const { data, error } = await db.from("venda_processos").select("id,negocio_id").in("negocio_id", negociosOriginais.slice(inicio, inicio + 500).map((item) => item.id));
      if (error) { arquivosEstado = "erro"; break; }
      processos.push(...((data ?? []) as Array<{ id: string; negocio_id: number }>));
    }
    if (arquivosEstado !== "erro" && processos.length) {
      const processoNegocio = new Map(processos.map((item) => [String(item.id), Number(item.negocio_id)]));
      const anexos: Array<{ id: string; processo_ref: string; negocio_id: number | null; nome: string; status: string; criado_em: string }> = [];
      const processoIds = [...processoNegocio.keys()];
      for (let inicio = 0; inicio < processoIds.length; inicio += 100) {
        const { data, error } = await db.from("esteira_anexos").select("id,processo_ref,negocio_id,nome,status,criado_em").in("processo_ref", processoIds.slice(inicio, inicio + 100));
        if (error) { arquivosEstado = "erro"; break; }
        anexos.push(...((data ?? []) as typeof anexos));
      }
      const negocioPorId = new Map(negociosOriginais.map((item) => [Number(item.id), item]));
      if (arquivosEstado !== "erro") arquivosVinculados = anexos.flatMap((item) => {
        const negocioId = Number(item.negocio_id ?? processoNegocio.get(String(item.processo_ref)));
        const negocio = negocioPorId.get(negocioId);
        if (!negocio) return [];
        return (funilIdsPorLeadOriginal.get(Number(negocio.lead_id)) ?? []).map((funilLeadId) => ({
          id: String(item.id), funil_lead_id: funilLeadId, negocio_id: negocioId,
          nome: String(item.nome), status: String(item.status), criado_em: String(item.criado_em),
        }));
      });
    } else if (arquivosEstado !== "erro") {
      arquivosEstado = "sem_vinculo";
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
    const negocio = negocioLead.get(Number(lead.origem_negocio_id));
    const leadOriginalId = negocio?.leadId ?? 0;
    const contexto = contextoPorLead.get(leadOriginalId);
    const original = contexto?.original;
    return {
      ...lead,
      lead_id: leadOriginalId,
      valor: negocio?.valor ?? null,
      nome: original?.nome?.trim() || lead.nome,
      telefone: original?.telefone ?? lead.telefone,
      email: original?.email ?? null,
      cpf_cnpj: textoExtra(original?.extras, "cpf_cnpj"),
      endereco: enderecoDoLead(original?.extras),
      origem_cadastro: original?.origem ?? null,
      interesse: contexto?.interesse ?? null,
      tags: contexto?.tags ?? [],
      instancia_rotulo: instancia?.rotulo ?? null,
      instancia_telefone: instancia?.telefone ?? null,
      instancia_status: instancia?.status ?? null,
      instancia_origem: daConversa ? "conversa" : "padrao",
    };
  });
  return Response.json({
    leads: leadsComOrigem, momentos: momentos ?? [], eventos: [], etapas: etapas ?? [],
    visitas: visitas ?? [], negociacoes: negociacoes ?? [], negociosVinculados, imoveisVinculados, arquivosVinculados,
    fontes: { arquivos: arquivosEstado }, aquario: aquario ?? [], operacao: e8 ? null : operacao ?? null,
    notas: [], tagCatalogo: tagCatalogo ?? [],
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
  if (action === "associarTag") {
    const leadId = String(body.leadId ?? "");
    const tagId = String(body.tagId ?? "");
    const cor = String(body.cor ?? "").trim().toUpperCase();
    if (!/^[0-9a-f-]{36}$/i.test(leadId) || !/^[0-9a-f-]{36}$/i.test(tagId)) {
      return Response.json({ error: "Lead ou tag inválidos." }, { status: 422 });
    }
    if (!/^#[0-9A-F]{6}$/.test(cor)) return Response.json({ error: "Escolha uma cor válida." }, { status: 422 });
    const { data, error } = await auth.db.rpc("f2_associar_tag", { p_funil_lead_id: leadId, p_tag_id: tagId, p_cor: cor });
    if (error) return Response.json({ error: "Não foi possível associar a tag." }, { status: 502 });
    const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
    if (resultado.ok !== true) {
      const mensagens: Record<string, string> = {
        sem_permissao: "Este lead não pertence à sua carteira.", tag_invalida: "Essa tag não está mais disponível.",
        lead_nao_encontrado: "Lead não encontrado.", cor_invalida: "Escolha uma cor válida.",
      };
      return Response.json({ error: mensagens[resultado.erro ?? ""] ?? "Não foi possível associar a tag." }, { status: resultado.erro === "sem_permissao" ? 403 : 409 });
    }
    return Response.json({ ok: true, resultado });
  }
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
      p_acao_rotulo: String(body.acaoRotulo ?? "").slice(0, 120), p_prazo_minutos: body.prazoMinutos == null ? null : Number(body.prazoMinutos),
      p_ordem: Number(body.ordem), p_exige_dapi: body.exigeDapi === true, p_ativo: body.ativo !== false,
    };
  } else if (action === "salvarVisita") {
    const inicio = normalizarInstanteSaoPaulo(String(body.inicioEm ?? ""));
    if (!inicio) return Response.json({ error: "Data da visita inválida." }, { status: 422 });
    const fim = body.fimEm ? normalizarInstanteSaoPaulo(String(body.fimEm)) : null;
    if (body.fimEm && !fim) return Response.json({ error: "Horário final da visita inválido." }, { status: 422 });
    rpc = "f2_salvar_visita";
    args = {
      p_id: body.id || null, p_lead_id: body.leadId,
      p_inicio_em: inicio,
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
      p_fim_em: fim,
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
  if (resultado.ok === false) {
    const chave = String(resultado.erro ?? "");
    return Response.json({ error: RECUSAS[chave] || resultado.erro || "Ação não permitida.", erro: chave }, { status: 409 });
  }
  return Response.json({ ok: true, resultado });
}

/* Mensagem em portugues para cada recusa da RPC. Sem isto o corretor ve
   "motivo_invalido" na tela e nao sabe o que fazer. */
const RECUSAS: Record<string, string> = {
  sem_permissao: "Você não tem permissão para concluir esta ação.",
  dados_invalidos: "Revise os campos obrigatórios, o prazo e a posição informada.",
  gerente_ocupado: "Esse gerente já tem uma visita nesse horário. Escolha outro horário ou outro gerente.",
  ordem_em_uso: "Essa posição está ocupada e não pôde ser reorganizada. Recarregue e tente novamente.",
  etapa_em_uso: "Esta etapa possui leads ou momentos ativos. Edite-a ou mova os itens antes de desativar.",
  momento_em_uso: "Este momento está associado a leads. Edite-o ou reclassifique os leads antes de desativar.",
  limite_etapas: "Não há uma posição livre para criar outra etapa.",
  limite_momentos: "Não há uma posição livre para criar outro momento nesta etapa.",
  lead_nao_encontrado: "Lead não encontrado.",
  versao_desatualizada: "Alguém mexeu neste lead agora. Recarregue e tente de novo.",
  ja_descartado: "Este lead já foi descartado.",
  motivo_obrigatorio: "Escolha o motivo do descarte.",
  motivo_invalido: "Motivo de descarte desconhecido.",
  texto_vazio: "Escreva a nota antes de salvar.",
  texto_muito_longo: "A nota passou de 2000 caracteres.",
  temperatura_invalida: "Escolha uma temperatura válida.",
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
  let momentoAnterior: string | null = null;
  if (action === "atualizarMomento") {
    const momento = String(body.momentoCodigo ?? "");
    if (!/^[A-Z_]{3,50}$/.test(momento)) return Response.json({ error: "Momento inválido." }, { status: 422 });
    const { data: leadAntes, error: leadAntesErro } = await db
      .from("f2_lead")
      .select("momento_codigo")
      .eq("id", id)
      .maybeSingle();
    if (leadAntesErro) return Response.json({ error: leadAntesErro.message }, { status: 502 });
    momentoAnterior = (leadAntes as { momento_codigo?: string } | null)?.momento_codigo ?? null;
    const prazo = body.prazoCombinado ? new Date(String(body.prazoCombinado)) : null;
    if (prazo && Number.isNaN(prazo.getTime())) return Response.json({ error: "Prazo combinado inválido." }, { status: 422 });
    rpc = "f2_atualizar_momento";
    args = { p_id: id, p_versao: versao, p_momento_codigo: momento, p_prazo_combinado: prazo?.toISOString() ?? null, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "atualizarTemperatura") {
    const temperatura = body.temperatura == null || body.temperatura === "aguardando"
      ? null
      : String(body.temperatura);
    if (temperatura !== null && !["frio", "morno", "quente", "negociando"].includes(temperatura)) {
      return Response.json({ error: "Temperatura inválida." }, { status: 422 });
    }
    rpc = "f2_atualizar_temperatura";
    args = { p_id: id, p_versao: versao, p_temperatura: temperatura };
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
  let rastreamentoMeta: unknown = null;
  if (action === "atualizarMomento" && momentoAnterior) {
    const { data: trackingData, error: trackingError } = await db.rpc("tracking_register_qualified_transition", {
      p_f2_lead_id: id,
      p_previous_momento: momentoAnterior,
      p_new_momento: String(args.p_momento_codigo ?? ""),
    });
    rastreamentoMeta = trackingError
      ? { ok: false, erro: trackingError.message }
      : trackingData;
  }
  return Response.json({ ok: true, resultado, rastreamentoMeta });
}
