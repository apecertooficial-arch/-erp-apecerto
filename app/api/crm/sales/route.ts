import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { blocoAberto, etapaDoBloco, pendenciasParaAvancar, podeEditarEtapa, type BlocoEsteira, type DadosCompletude, type EtapaRegra } from "../../../lib/esteira";
import { papelNoGrupo } from "../../../lib/papeis";
import { criarVendaCrmAtomica, type ClienteRpcVendaCrm } from "../sales-create-rpc";
import { saveSalesCommissionAtomic, type SalesCommissionRpcClient } from "../sales-commission-rpc";
import { reviewSalesDocumentAtomic, type SalesDocumentReviewRpcClient } from "../sales-document-review-rpc";
import { mutateSalesPartyAtomic, type SalesPartyRpcClient } from "../sales-party-rpc";
import { returnSaleAtomic, type SalesReturnRpcClient } from "../sales-return-rpc";
import { createSalesStageAtomic, type SalesStageCreateRpcClient } from "../sales-stage-create-rpc";
import { reorderSalesStagesAtomic, type SalesStageOrderRpcClient } from "../sales-stage-order-rpc";
import { confirmSalesTriageAtomic, type SalesTriageConfirmRpcClient } from "../sales-triage-confirm-rpc";
import { registerSalesBatchAttachmentsAtomic, type SalesBatchAttachmentRpcClient } from "../sales-batch-attachment-rpc";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

const clean = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const slugify = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

function falhaEsteira(error: { code?: string; message?: string }, operacao: string) {
  const semPermissao = error.code === "42501" || /permission|policy|acesso negado/i.test(error.message ?? "");
  console.error("esteira_vendas_falhou", { operacao, codigo: error.code ?? "desconhecido" });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para executar esta operação."
      : "Não foi possível concluir a operação da venda no momento.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : 502 });
}

const MENSAGENS_CLASSIFICACAO: Record<string, { error: string; status: number }> = {
  nao_autorizado: { error: "Você não tem permissão para classificar estes documentos.", status: 403 },
  processo_nao_encontrado: { error: "Venda não encontrada.", status: 404 },
  sem_chave: { error: "A classificação de documentos está temporariamente indisponível.", status: 503 },
  "faltando processo_ref": { error: "Venda inválida.", status: 422 },
  "faltando lote_id ou anexo_ids": { error: "Informe os documentos que devem ser classificados.", status: 422 },
};

function respostaClassificacao(reason: unknown) {
  const motivo = typeof reason === "string" ? reason : "";
  return MENSAGENS_CLASSIFICACAO[motivo] ?? {
    error: "A Sara não conseguiu classificar os documentos no momento.",
    status: 502,
  };
}

async function falhaClassificacaoDocumentos(error: { code?: string; context?: Response }) {
  let reason = "";
  try {
    const payload = error.context ? await error.context.json() as { reason?: unknown } : null;
    reason = typeof payload?.reason === "string" ? payload.reason : "";
  } catch { /* resposta remota inválida também falha fechada */ }
  const resposta = respostaClassificacao(reason);
  const codigo = Object.hasOwn(MENSAGENS_CLASSIFICACAO, reason) ? reason : "falha_integracao";
  console.error("esteira_classificacao_falhou", { motivo: codigo, codigo: error.code ?? "desconhecido" });
  return Response.json({ error: resposta.error, erro: codigo }, { status: resposta.status });
}

// Papéis das partes de uma negociação (comprador/vendedor e respectivos cônjuges).
const PAPEIS_PARTE = ["comprador", "conjuge_comprador", "vendedor", "conjuge_vendedor"] as const;
const FORMAS_PGTO = ["a_vista", "financiamento", "consorcio", "misto"] as const;

/** Bloco de documentos correspondente a cada grupo do checklist. */
const GRUPO_BLOCO: Record<string, BlocoEsteira> = {
  comprador: "docs_comprador", conjuge_comprador: "docs_comprador",
  vendedor: "docs_vendedor", conjuge_vendedor: "docs_vendedor",
  imovel: "docs_imovel",
};

/**
 * Carrega tudo que a cascata precisa avaliar para um processo:
 * etapas configuradas, etapa atual, condições, comissão, partes, checklist e anexos.
 */
async function contexto(auth: Auth, processId: string) {
  const [procQuery, etapasQuery, etapaDocsQuery, condQuery, comQuery, partesQuery, modeloQuery, anexosQuery, meQuery] = await Promise.all([
    auth.supabase.from("venda_processos").select("id,etapa,negocio_id,tipo_venda,aprovacao_status").eq("id", processId).maybeSingle(),
    auth.supabase.from("esteira_etapas").select("slug,nome,ordem,libera,restrito_a,exige_docs,resale,sla_dias").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("esteira_etapa_docs").select("etapa_slug,nome,obrigatorio").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("venda_condicoes").select("valor_total,forma_pagamento,comprador_tem_conjuge,vendedor_tem_conjuge").eq("processo_ref", processId).maybeSingle(),
    auth.supabase.from("venda_comissao").select("percentual_total,valor_total").eq("processo_ref", processId).maybeSingle(),
    auth.supabase.from("venda_partes").select("papel,nome,telefone,email").eq("processo_ref", processId),
    auth.supabase.from("esteira_doc_modelo").select("grupo,nome,obrigatorio,condicao").eq("ativo", true),
    auth.supabase.from("esteira_anexos").select("grupo,etapa_slug,doc_nome,status,obrigatorio").eq("processo_ref", processId),
    auth.supabase.from("usuarios").select("role,nome").eq("id", auth.user.id).maybeSingle(),
  ]);
  const error = [procQuery, etapasQuery, etapaDocsQuery, condQuery, comQuery, partesQuery, modeloQuery, anexosQuery, meQuery].find((item) => item.error)?.error ?? null;
  const proc = procQuery.data;
  const etapasRaw = etapasQuery.data;
  const etapaDocs = (etapaDocsQuery.data ?? []) as Array<{ etapa_slug: string; nome: string; obrigatorio: boolean }>;
  const cond = condQuery.data;
  const com = comQuery.data;
  const partes = partesQuery.data;
  const modelo = modeloQuery.data;
  const anexos = anexosQuery.data;
  const me = meQuery.data;
  const etapas = (etapasRaw ?? []) as unknown as EtapaRegra[];
  const atual = proc ? etapas.find((e) => e.slug === (proc as { etapa: string }).etapa) ?? null : null;
  const dados: DadosCompletude = {
    condicao: (cond ?? null) as DadosCompletude["condicao"],
    comissao: (com ?? null) as DadosCompletude["comissao"],
    partes: (partes ?? []) as DadosCompletude["partes"],
    modelo: (modelo ?? []) as DadosCompletude["modelo"],
    anexos: (anexos ?? []) as DadosCompletude["anexos"],
    temConjugeComprador: Boolean((cond as { comprador_tem_conjuge?: boolean } | null)?.comprador_tem_conjuge),
    temConjugeVendedor: Boolean((cond as { vendedor_tem_conjuge?: boolean } | null)?.vendedor_tem_conjuge),
  };
  return { proc, etapas, etapaDocs, atual, dados, role: (me?.role as string | undefined) ?? null, error };
}

type ContextoEsteira = Awaited<ReturnType<typeof contexto>>;

function trackDoContexto(ctx: ContextoEsteira) {
  const revenda = ctx.proc?.tipo_venda === "revenda";
  return ctx.etapas.filter((etapa) => !etapa.resale || revenda);
}

function proximaEtapa(ctx: ContextoEsteira) {
  const track = trackDoContexto(ctx);
  const atual = track.findIndex((etapa) => etapa.slug === ctx.atual?.slug);
  return atual >= 0 ? track[atual + 1] ?? null : null;
}

function documentosDaEtapa(ctx: ContextoEsteira) {
  const etapaUsaChecklistDePartes = (ctx.atual?.libera ?? []).some((bloco) => bloco.startsWith("docs_"));
  if (!ctx.atual || etapaUsaChecklistDePartes) return [];
  return ctx.etapaDocs.filter((doc) => doc.etapa_slug === ctx.atual?.slug);
}

function pendenciasDoContexto(ctx: ContextoEsteira) {
  const pendencias = pendenciasParaAvancar(ctx.atual, ctx.dados);
  const modelados = new Set(ctx.dados.modelo.map((doc) => `${doc.grupo}::${doc.nome}`));
  const avulsos = ctx.dados.anexos.filter((anexo) => anexo.obrigatorio && !anexo.etapa_slug && !modelados.has(`${anexo.grupo}::${anexo.doc_nome}`) && anexo.status !== "aprovado" && anexo.status !== "triagem").length;
  if (avulsos) pendencias.push(`${avulsos} documento(s) adicional(is) marcado(s) como obrigatório(s) sem aprovação`);
  const aprovados = new Set(ctx.dados.anexos
    .filter((anexo) => anexo.etapa_slug === ctx.atual?.slug && anexo.status === "aprovado")
    .map((anexo) => anexo.doc_nome));
  const faltando = documentosDaEtapa(ctx).filter((doc) => doc.obrigatorio && !aprovados.has(doc.nome));
  if (faltando.length) pendencias.push(`comprovação da etapa: ${faltando.map((doc) => doc.nome).join(", ")} sem aprovação`);
  return pendencias;
}

async function guardDocumentoEtapa(auth: Auth, processId: string, etapaSlug: string, docNome: string) {
  const ctx = await contexto(auth, processId);
  if (ctx.error) return { deny: falhaEsteira(ctx.error, "carregar_contexto_documento_etapa"), ctx };
  if (!ctx.proc) return { deny: Response.json({ error: "Venda não encontrada." }, { status: 404 }), ctx };
  if (etapaSlug !== ctx.atual?.slug) return { deny: Response.json({ error: "A comprovação só pode ser alterada na etapa atual da venda." }, { status: 409 }), ctx };
  if (!podeEditarEtapa(ctx.role, ctx.atual)) return { deny: Response.json({ error: `Você não pode preencher a etapa "${ctx.atual?.nome ?? etapaSlug}".` }, { status: 403 }), ctx };
  if (!documentosDaEtapa(ctx).some((doc) => doc.nome === docNome)) return { deny: Response.json({ error: "Documento não configurado para esta etapa." }, { status: 422 }), ctx };
  return { deny: null, ctx };
}

/** Primeiro bloco de documentos aberto na etapa atual (para arquivos de lote ainda sem grupo). */
function blocoDocsAberto(ctx: { atual: EtapaRegra | null }): BlocoEsteira | null {
  const abertos = (ctx.atual?.libera ?? []).filter((b) => b.startsWith("docs_")) as BlocoEsteira[];
  return abertos[0] ?? null;
}

/**
 * Trava de cascata: o bloco só pode ser preenchido na etapa que o libera,
 * e só por quem tem papel para aquela etapa. Devolve null quando está liberado.
 */
async function guardBloco(auth: Auth, processId: string, bloco: BlocoEsteira) {
  const ctx = await contexto(auth, processId);
  if (ctx.error) return { deny: falhaEsteira(ctx.error, "carregar_contexto_venda"), ctx };
  if (!ctx.proc) return { deny: Response.json({ error: "Venda não encontrada." }, { status: 404 }), ctx };
  if (!blocoAberto(ctx.atual, bloco)) {
    const alvo = etapaDoBloco(ctx.etapas, bloco);
    const onde = alvo ? `Isso é preenchido na etapa "${alvo.nome}".` : "Este bloco não está habilitado em nenhuma etapa.";
    return { deny: Response.json({ error: `A venda está em "${ctx.atual?.nome ?? "etapa desconhecida"}". ${onde}` }, { status: 409 }), ctx };
  }
  if (!podeEditarEtapa(ctx.role, ctx.atual)) {
    const quem = (ctx.atual?.restrito_a ?? []).join(" ou ");
    return { deny: Response.json({ error: `Só ${quem} pode preencher a etapa "${ctx.atual?.nome}".` }, { status: 403 }), ctx };
  }
  return { deny: null, ctx };
}

/** Registra um evento na trilha de auditoria dos anexos (nunca derruba a requisição principal). */
async function trilha(auth: Auth, evento: string, dados: { anexoId?: string | null; processoRef?: string | null; loteId?: string | null; detalhe?: unknown }) {
  try {
    const { data: me } = await auth.supabase.from("usuarios").select("nome").eq("id", auth.user.id).maybeSingle();
    await auth.supabase.from("esteira_anexo_eventos").insert({
      anexo_id: dados.anexoId ?? null,
      processo_ref: dados.processoRef ?? null,
      lote_id: dados.loteId ?? null,
      evento,
      detalhe: (dados.detalhe ?? null) as never,
      ator: auth.user.id,
      ator_nome: me?.nome ?? null,
    } as never);
  } catch { /* auditoria é best-effort */ }
}

type Auth = { supabase: ReturnType<typeof createServerSupabaseClient>; user: { id: string } };
async function requireManager(auth: Auth) {
  const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  return me && papelNoGrupo(me.role, "esteira_config") ? null : Response.json({ error: "Apenas administradores podem configurar as etapas." }, { status: 403 });
}
async function activeSlugs(auth: Auth) {
  const { data } = await auth.supabase.from("esteira_etapas").select("slug,sla_dias").eq("ativo", true);
  return new Map((data ?? []).map((row) => [row.slug as string, Number(row.sla_dias)]));
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [sales, processes, deals, leads, products, brokers, stages, etapaDocs, anexos, users, history, verificacoes, solicitacoes, docModelo, condicoes, comissao, comissaoParcelas, observacoes, pipelines, pipelineStages, partes, anexoEventos] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,data_conclusao,cliente_nome,empreendimento_id,empreendimento_nome,unidade_id,vgv,forma_pgto,status,obs").order("created_at", { ascending: false }),
    auth.supabase.from("venda_processos").select("id,venda_id,negocio_id,etapa,tipo_venda,responsavel_usuario_id,prazo_em,observacoes,criado_em,atualizado_em,aprovacao_status,aprovacao_motivo,solicitado_por"),
    // range explícito: sem ele o PostgREST corta em 1000 linhas e a ficha da venda
    // perde o nome do cliente quando o lead está além dessa posição.
    auth.supabase.from("negocios").select("id,venda_id,lead_id,corretor_id,empreendimento_id,valor,status").order("id", { ascending: false }).range(0, 19999),
    auth.supabase.from("leads").select("id,nome,telefone,email,corretor_id,tags,extras").order("id", { ascending: false }).range(0, 19999),
    auth.supabase.from("empreendimentos").select("id,nome,origem,bairro,cidade").order("nome"),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("esteira_etapas").select("id,slug,nome,cor,ordem,papel,sla_dias,resale,exige_docs,libera,restrito_a").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("esteira_etapa_docs").select("id,etapa_slug,nome,obrigatorio,ordem").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("esteira_anexos").select("id,processo_ref,negocio_id,etapa_slug,doc_nome,nome,path,mime,tamanho,criado_em,grupo,status,status_motivo,obrigatorio,observacao,enviado_por,revisado_por,revisado_em,lote_id,origem,ia_status,ia_grupo,ia_doc_nome,ia_confianca,ia_extraido,ia_motivo,ia_processado_em").order("criado_em", { ascending: false }),
    auth.supabase.from("usuarios").select("id,nome,role"),
    auth.supabase.from("venda_processo_historico").select("processo_id,etapa_de,etapa_para,movido_por,movido_em").order("movido_em", { ascending: true }),
    auth.supabase.from("esteira_etapa_verificacoes").select("id,processo_ref,etapa_slug,verificado_por,verificado_em"),
    auth.supabase.from("venda_solicitacoes").select("id,negocio_id,corretor_id,solicitado_por,produto_id,vgv,forma_pgto,obs,status,criado_em").eq("status", "pendente").order("criado_em", { ascending: true }),
    auth.supabase.from("esteira_doc_modelo").select("id,grupo,nome,obrigatorio,ordem,condicao").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("venda_condicoes").select("*"),
    auth.supabase.from("venda_comissao").select("*"),
    auth.supabase.from("venda_comissao_parcelas").select("*").order("ordem", { ascending: true }),
    auth.supabase.from("venda_observacoes").select("id,processo_ref,texto,autor,autor_nome,criado_em").order("criado_em", { ascending: false }),
    auth.supabase.from("pipelines").select("id,nome,ordem").order("ordem", { ascending: true }),
    auth.supabase.from("pipeline_stages").select("id,pipeline_id,nome,ordem").order("ordem", { ascending: true }),
    auth.supabase.from("venda_partes").select("id,processo_ref,papel,ordem,nome,telefone,email,cpf,observacao,atualizado_em").order("ordem", { ascending: true }),
    auth.supabase.from("esteira_anexo_eventos").select("id,anexo_id,processo_ref,lote_id,evento,detalhe,ator,ator_nome,criado_em").order("criado_em", { ascending: false }).limit(400),
  ]);
  const error = [sales, processes, deals, leads, products, brokers, stages, etapaDocs, anexos, users, history, verificacoes, solicitacoes, docModelo, condicoes, comissao, comissaoParcelas, observacoes, pipelines, pipelineStages, partes, anexoEventos].find((item) => item.error)?.error;
  if (error) return falhaEsteira(error, "listar");
  return Response.json({ sales: sales.data ?? [], processes: processes.data ?? [], deals: deals.data ?? [], leads: leads.data ?? [], products: products.data ?? [], brokers: brokers.data ?? [], stages: stages.data ?? [], etapaDocs: etapaDocs.data ?? [], anexos: anexos.data ?? [], users: users.data ?? [], history: history.data ?? [], verificacoes: verificacoes.data ?? [], solicitacoes: solicitacoes.data ?? [], docModelo: docModelo.data ?? [], condicoes: condicoes.data ?? [], comissao: comissao.data ?? [], comissaoParcelas: comissaoParcelas.data ?? [], observacoes: observacoes.data ?? [], pipelines: pipelines.data ?? [], pipelineStages: pipelineStages.data ?? [], partes: partes.data ?? [], anexoEventos: anexoEventos.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");
  if (action === "move") {
    const processId = String(body.processId || "");
    const stage = String(body.stage || "");
    const slugs = await activeSlugs(auth);
    if (!processId || !slugs.has(stage)) return Response.json({ error: "Etapa inválida." }, { status: 422 });
    // ===== Cascata de etapas =====
    // Ao AVANÇAR, tudo que a etapa atual liberou para preenchimento precisa estar completo.
    // A configuração vive em esteira_etapas.libera, então o gestor muda a regra sem deploy.
    const ctx = await contexto(auth, processId);
    if (ctx.error) return falhaEsteira(ctx.error, "carregar_contexto_movimentacao");
    if (!ctx.proc) return Response.json({ error: "Venda não encontrada." }, { status: 404 });
    if ((ctx.proc as { aprovacao_status?: string }).aprovacao_status === "pendente") {
      return Response.json({ error: "Esta venda ainda está aguardando aprovação de entrada na esteira." }, { status: 409 });
    }
    if (!podeEditarEtapa(ctx.role, ctx.atual)) {
      const quem = (ctx.atual?.restrito_a ?? []).join(" ou ");
      return Response.json({ error: `Só ${quem || "um perfil autorizado"} pode mover a venda a partir de "${ctx.atual?.nome ?? "etapa desconhecida"}".` }, { status: 403 });
    }
    const destino = ctx.etapas.find((e) => e.slug === stage);
    if (!destino || !trackDoContexto(ctx).some((etapa) => etapa.slug === destino.slug)) return Response.json({ error: "Etapa inválida para este tipo de venda." }, { status: 422 });
    const avancando = ctx.atual && destino && Number(destino.ordem) > Number(ctx.atual.ordem);
    const proxima = proximaEtapa(ctx);
    if (avancando && destino.slug !== proxima?.slug) {
      return Response.json({ error: `Avance uma etapa por vez. A próxima é "${proxima?.nome ?? "a conclusão"}".` }, { status: 409 });
    }
    if (avancando) {
      const pendencias = pendenciasDoContexto(ctx);
      if (pendencias.length) {
        return Response.json({ error: `Não é possível sair de "${ctx.atual!.nome}" — ${pendencias.join("; ")}.` }, { status: 409 });
      }
    }
    const isFinal = slugs.get(stage) === 0;
    const update = isFinal
      ? { etapa: stage, atualizado_em: new Date().toISOString(), prazo_em: null }
      : { etapa: stage, atualizado_em: new Date().toISOString() };
    const { data: movido, error } = await auth.supabase.from("venda_processos").update(update).eq("id", processId).eq("etapa", ctx.proc.etapa).select("id,etapa").maybeSingle();
    if (error) return falhaEsteira(error, "mover_etapa");
    if (!movido) return Response.json({ error: "Esta venda mudou de etapa enquanto você trabalhava. Recarregue e tente novamente." }, { status: 409 });
    return Response.json({ success: true, stage: movido.etapa });
  }

  if (action === "addAnexo" || action === "removeAnexo") {
    if (action === "removeAnexo") {
      const id = clean(body.anexoId, 60);
      if (!id) return Response.json({ error: "Anexo inválido." }, { status: 422 });
      const { data: antes } = await auth.supabase.from("esteira_anexos").select("processo_ref,grupo,etapa_slug,doc_nome,nome,path,status").eq("id", id).maybeSingle();
      if (antes?.processo_ref) {
        if (antes.etapa_slug && antes.doc_nome && !antes.grupo) {
          const g = await guardDocumentoEtapa(auth, String(antes.processo_ref), String(antes.etapa_slug), String(antes.doc_nome));
          if (g.deny) return g.deny;
        } else {
          // Arquivo ainda em triagem não tem grupo: liberado enquanto qualquer bloco de documentos estiver aberto.
          const bloco = GRUPO_BLOCO[String(antes.grupo ?? "")] ?? null;
          const g = await guardBloco(auth, String(antes.processo_ref), bloco ?? blocoDocsAberto(await contexto(auth, String(antes.processo_ref))) ?? "docs_comprador");
          if (g.deny) return g.deny;
        }
      }
      const { error } = await auth.supabase.from("esteira_anexos").delete().eq("id", id);
      if (error) return falhaEsteira(error, "remover_anexo");
      await trilha(auth, "removido", { processoRef: (antes?.processo_ref as string) ?? null, detalhe: antes ?? { id } });
      return Response.json({ success: true });
    }
    const processo_ref = clean(body.processId, 60);
    const path = clean(body.path, 400);
    const nome = clean(body.nome, 200);
    if (!processo_ref || !path || !nome) return Response.json({ error: "Informe o processo, o arquivo e o nome." }, { status: 422 });
    const grupoAlvo = clean(body.grupo, 40);
    const etapaSlug = clean(body.etapaSlug, 40);
    const docNome = clean(body.docNome, 200);
    if (grupoAlvo) {
      const blocoAlvo = GRUPO_BLOCO[grupoAlvo];
      if (!blocoAlvo) return Response.json({ error: "Grupo de documento inválido." }, { status: 422 });
      const gAnexo = await guardBloco(auth, processo_ref, blocoAlvo);
      if (gAnexo.deny) return gAnexo.deny;
    } else {
      if (!etapaSlug || !docNome) return Response.json({ error: "Informe a etapa e o tipo da comprovação." }, { status: 422 });
      const gEtapa = await guardDocumentoEtapa(auth, processo_ref, etapaSlug, docNome);
      if (gEtapa.deny) return gEtapa.deny;
    }
    const insert: Record<string, unknown> = {
      processo_ref, nome, path,
      etapa_slug: etapaSlug || null,
      doc_nome: docNome || null,
      grupo: grupoAlvo || null,
      obrigatorio: body.obrigatorio === true,
      observacao: clean(body.observacao, 400) || null,
      status: "anexado",
      mime: clean(body.mime, 100) || null,
      tamanho: Number.isFinite(Number(body.tamanho)) ? Math.trunc(Number(body.tamanho)) : null,
      negocio_id: Number.isSafeInteger(Number(body.negocioId)) && Number(body.negocioId) > 0 ? Number(body.negocioId) : null,
      enviado_por: auth.user.id,
    };
    const { data: criado, error } = await auth.supabase.from("esteira_anexos").insert(insert as never).select("id").maybeSingle();
    if (error) return falhaEsteira(error, "adicionar_anexo");
    await trilha(auth, "upload", { anexoId: (criado?.id as string) ?? null, processoRef: processo_ref, detalhe: { arquivo: nome, grupo: insert.grupo, doc_nome: insert.doc_nome, origem: "manual" } });
    return Response.json({ success: true });
  }

  if (action === "verifyStage" || action === "unverifyStage") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    const processId = clean(body.processId, 60);
    const etapaSlug = clean(body.etapaSlug, 40);
    if (!processId || !etapaSlug) return Response.json({ error: "Informe o processo e a etapa." }, { status: 422 });
    const ctx = await contexto(auth, processId);
    if (ctx.error) return falhaEsteira(ctx.error, "carregar_contexto_verificacao");
    if (!ctx.proc) return Response.json({ error: "Venda não encontrada." }, { status: 404 });
    if (etapaSlug !== ctx.atual?.slug) return Response.json({ error: "Só é possível verificar a etapa atual da venda." }, { status: 409 });
    if (action === "unverifyStage") {
      const { error } = await auth.supabase.from("esteira_etapa_verificacoes").delete().eq("processo_ref", processId).eq("etapa_slug", etapaSlug);
      return error ? falhaEsteira(error, "desverificar_etapa") : Response.json({ success: true });
    }
    const pendencias = pendenciasDoContexto(ctx);
    if (pendencias.length) return Response.json({ error: `Não é possível verificar "${ctx.atual.nome}" — ${pendencias.join("; ")}.` }, { status: 409 });
    const { error: verifErr } = await auth.supabase.from("esteira_etapa_verificacoes").upsert({ processo_ref: processId, etapa_slug: etapaSlug, verificado_por: auth.user.id, verificado_em: new Date().toISOString() } as never, { onConflict: "processo_ref,etapa_slug" });
    if (verifErr) return falhaEsteira(verifErr, "verificar_etapa");
    let advancedTo: string | null = null;
    const next = proximaEtapa(ctx);
    if (next) {
      const isFinal = Number(next.sla_dias) === 0;
      const update = isFinal ? { etapa: next.slug, atualizado_em: new Date().toISOString(), prazo_em: null } : { etapa: next.slug, atualizado_em: new Date().toISOString() };
      const { data: movido, error: mvErr } = await auth.supabase.from("venda_processos").update(update as never).eq("id", processId).eq("etapa", etapaSlug).select("id,etapa").maybeSingle();
      if (mvErr) return falhaEsteira(mvErr, "avancar_etapa_verificada");
      if (!movido) return Response.json({ error: "Esta venda mudou de etapa enquanto você verificava. Recarregue e tente novamente." }, { status: 409 });
      advancedTo = next.slug;
    }
    return Response.json({ success: true, advancedTo });
  }

  if (["docCreate", "docUpdate", "docDelete", "docReorder"].includes(action)) {
    const denied = await requireManager(auth);
    if (denied) return denied;
    if (action === "docCreate") {
      const etapaSlug = clean(body.etapaSlug, 40);
      const nome = clean(body.nome, 120);
      if (!etapaSlug || !nome) return Response.json({ error: "Informe a etapa e o nome do documento." }, { status: 422 });
      const { data: last } = await auth.supabase.from("esteira_etapa_docs").select("ordem").eq("etapa_slug", etapaSlug).order("ordem", { ascending: false }).limit(1).maybeSingle();
      const ordem = (last?.ordem ?? 0) + 1;
      const { error } = await auth.supabase.from("esteira_etapa_docs").insert({ etapa_slug: etapaSlug, nome, obrigatorio: body.obrigatorio !== false, ordem } as never);
      return error ? falhaEsteira(error, "criar_documento_etapa") : Response.json({ success: true });
    }
    if (action === "docUpdate") {
      const id = clean(body.docId, 60);
      if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = clean(body.nome, 120);
      if (typeof body.obrigatorio === "boolean") patch.obrigatorio = body.obrigatorio;
      if (Object.keys(patch).length === 0) return Response.json({ error: "Nada para atualizar." }, { status: 422 });
      const { error } = await auth.supabase.from("esteira_etapa_docs").update(patch as never).eq("id", id);
      return error ? falhaEsteira(error, "atualizar_documento_etapa") : Response.json({ success: true });
    }
    if (action === "docReorder") {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
      if (!ids.length) return Response.json({ error: "Ordem inválida." }, { status: 422 });
      for (let index = 0; index < ids.length; index += 1) {
        const { error } = await auth.supabase.from("esteira_etapa_docs").update({ ordem: index + 1 } as never).eq("id", ids[index]);
        if (error) return falhaEsteira(error, "reordenar_documentos_etapa");
      }
      return Response.json({ success: true });
    }
    // docDelete
    const id = clean(body.docId, 60);
    if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("esteira_etapa_docs").update({ ativo: false } as never).eq("id", id);
    return error ? falhaEsteira(error, "remover_documento_etapa") : Response.json({ success: true });
  }
  if (action === "createStage" || action === "updateStage" || action === "reorderStages" || action === "deleteStage" || action === "bulkMoveStage") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    if (action === "createStage") {
      const nome = clean(body.nome, 80);
      const requestId = clean(body.requestId, 60);
      if (!nome || !requestId) return Response.json({ error: "Informe o nome e a solicitação da etapa." }, { status: 422 });
      const slugBase = slugify(nome) || `etapa_${requestId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
      const resultado = await createSalesStageAtomic(auth.supabase as unknown as SalesStageCreateRpcClient, {
        name: nome,
        slugBase,
        color: clean(body.cor, 20) || "#8d2bd1",
        role: clean(body.papel, 40) || "Corretor",
        slaDays: Number.isFinite(Number(body.slaDias)) ? Math.max(0, Math.trunc(Number(body.slaDias))) : 3,
        resale: body.resale === true,
        requestId,
      });
      if ("internalError" in resultado && resultado.internalError) console.error("esteira_etapa_criacao_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
      return Response.json(resultado.body, { status: resultado.status });
    }
    if (action === "updateStage") {
      const id = clean(body.stageId, 60);
      if (!id) return Response.json({ error: "Etapa inválida." }, { status: 422 });
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = clean(body.nome, 80);
      if (typeof body.cor === "string") patch.cor = clean(body.cor, 20);
      if (typeof body.papel === "string") patch.papel = clean(body.papel, 40);
      if (body.slaDias !== undefined && Number.isFinite(Number(body.slaDias))) patch.sla_dias = Math.max(0, Math.trunc(Number(body.slaDias)));
      if (typeof body.resale === "boolean") patch.resale = body.resale;
      if (typeof body.exigeDocs === "boolean") patch.exige_docs = body.exigeDocs;
      if (Object.keys(patch).length === 0) return Response.json({ error: "Nada para atualizar." }, { status: 422 });
      const { error } = await auth.supabase.from("esteira_etapas").update(patch as never).eq("id", id);
      return error ? falhaEsteira(error, "atualizar_etapa") : Response.json({ success: true });
    }
    if (action === "reorderStages") {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((value) => clean(value, 60)).filter(Boolean) : [];
      const requestId = clean(body.requestId, 60);
      if (ids.length < 2 || !requestId) return Response.json({ error: "Ordem ou solicitação inválida." }, { status: 422 });
      const resultado = await reorderSalesStagesAtomic(auth.supabase as unknown as SalesStageOrderRpcClient, { stageIds: ids, requestId });
      if ("internalError" in resultado && resultado.internalError) console.error("esteira_etapas_reordenacao_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
      return Response.json(resultado.body, { status: resultado.status });
    }
    if (action === "bulkMoveStage") {
      return Response.json({ error: "Cada venda precisa ser movida individualmente para validar suas pré-condições." }, { status: 409 });
    }
    // deleteStage
    const id = clean(body.stageId, 60);
    if (!id) return Response.json({ error: "Etapa inválida." }, { status: 422 });
    const { data: stageRow } = await auth.supabase.from("esteira_etapas").select("slug").eq("id", id).maybeSingle();
    if (stageRow?.slug) {
      const { count } = await auth.supabase.from("venda_processos").select("id", { count: "exact", head: true }).eq("etapa", stageRow.slug);
      if ((count ?? 0) > 0) return Response.json({ error: "Esta etapa tem vendas. Mova cada venda individualmente antes de excluir." }, { status: 409 });
    }
    const { error } = await auth.supabase.from("esteira_etapas").update({ ativo: false } as never).eq("id", id);
    return error ? falhaEsteira(error, "remover_etapa") : Response.json({ success: true });
  }
  if (action === "assign") {
    const processId = String(body.processId || "");
    const userId = body.userId ? String(body.userId) : null;
    const { error } = await auth.supabase.from("venda_processos").update({ responsavel_usuario_id: userId, atualizado_em: new Date().toISOString() }).eq("id", processId);
    return error ? falhaEsteira(error, "atribuir_responsavel") : Response.json({ success: true });
  }
  if (action === "devolverFunil") {
    // Devolve uma venda da esteira de volta ao funil de atendimento (follow-up). Reabre o negócio.
    const denied = await requireManager(auth);
    if (denied) return denied;
    const processId = clean(body.processId, 60);
    const requestId = clean(body.requestId, 60);
    if (!processId || !requestId) return Response.json({ error: "Venda ou solicitação inválida." }, { status: 422 });
    const motivo = clean(body.motivo, 400) || null;
    const stageId = Number(body.stageId);
    if (!Number.isSafeInteger(stageId) || stageId <= 0) return Response.json({ error: "Etapa de destino inválida." }, { status: 422 });
    const result = await returnSaleAtomic(auth.supabase as unknown as SalesReturnRpcClient, { processId, stageId, reason: motivo, requestId });
    if ("internalError" in result && result.internalError && result.status >= 500) console.error("esteira_venda_rpc_falhou", { operacao: "devolver", codigo: result.internalError.code ?? "desconhecido" });
    return Response.json(result.body, { status: result.status });
  }
  if (action === "approveSale" || action === "rejectSale") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    const processId = clean(body.processId, 60);
    if (!processId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    const { data: proc } = await auth.supabase.from("venda_processos").select("id,negocio_id").eq("id", processId).maybeSingle();
    if (!proc) return Response.json({ error: "Venda não encontrada." }, { status: 404 });
    if (action === "approveSale") {
      const { error } = await auth.supabase.from("venda_processos").update({ aprovacao_status: "aprovada", aprovacao_motivo: null, aprovado_por: auth.user.id, aprovado_em: new Date().toISOString() } as never).eq("id", processId);
      return error ? falhaEsteira(error, "aprovar_venda") : Response.json({ success: true });
    }
    // rejectSale — devolve o negócio ao corretor (volta ao funil) com o motivo
    const motivo = clean(body.motivo, 400) || "Entrada recusada pelo gestor.";
    const { error } = await auth.supabase.from("venda_processos").update({ aprovacao_status: "recusada", aprovacao_motivo: motivo, aprovado_por: auth.user.id, aprovado_em: new Date().toISOString() } as never).eq("id", processId);
    if (error) return falhaEsteira(error, "recusar_venda");
    if (proc.negocio_id) {
      const { error: reabrirError } = await auth.supabase.from("negocios").update({ status: "aberto", venda_id: null, ultima_movimentacao: new Date().toISOString() }).eq("id", proc.negocio_id);
      if (reabrirError) return falhaEsteira(reabrirError, "reabrir_negocio_recusado");
    }
    return Response.json({ success: true });
  }

  if (action === "create") {
    const dealId = Number(body.dealId);
    const productId = String(body.productId || "");
    const requestId = clean(body.requestId, 60);
    // O valor não entra aqui: é definido nas Condições comerciais, na etapa de Proposta.
    const vgv = Number.isFinite(Number(body.vgv)) && Number(body.vgv) > 0 ? Number(body.vgv) : 0;
    if (!Number.isSafeInteger(dealId) || !productId || !requestId) return Response.json({ error: "Selecione o negócio e o produto." }, { status: 422 });
    const resultado = await criarVendaCrmAtomica(auth.supabase as unknown as ClienteRpcVendaCrm, {
      request_id: requestId,
      negocio_id: dealId,
      produto_id: productId,
      vgv,
      forma_pgto: clean(body.payment, 120) || null,
      obs: clean(body.notes, 1000) || null,
    });
    if ("erroInterno" in resultado && resultado.erroInterno && resultado.status >= 500) console.error("esteira_venda_rpc_falhou", { operacao: "criar", codigo: resultado.erroInterno.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }
  if (action === "solicitar") {
    const dealId = Number(body.dealId);
    const productId = String(body.productId || "");
    const vgv = Number.isFinite(Number(body.vgv)) && Number(body.vgv) > 0 ? Number(body.vgv) : 0;
    if (!Number.isSafeInteger(dealId) || !productId) return Response.json({ error: "Selecione o negócio e o produto." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("solicitar_venda", { p_negocio: dealId, p_produto: productId, p_vgv: vgv, p_forma: String(body.payment || "") || undefined, p_obs: String(body.notes || "") || undefined });
    if (error) return falhaEsteira(error, "solicitar_venda");
    const r = (data ?? {}) as { ok?: boolean; erro?: string };
    if (!r.ok) return Response.json({ error: r.erro === "ja_solicitado" ? "Já existe uma solicitação pendente para este negócio." : r.erro === "ja_tem_venda" ? "Este negócio já virou venda." : r.erro === "sem_permissao_neste_negocio" ? "Você só pode enviar negócios sob sua responsabilidade." : (r.erro || "Não foi possível solicitar.") }, { status: 422 });
    return Response.json({ success: true });
  }
  if (action === "aprovarSolicitacao") {
    const id = String(body.id || "");
    if (!id) return Response.json({ error: "Solicitação inválida." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("aprovar_solicitacao", { p_id: id });
    if (error) return falhaEsteira(error, "aprovar_solicitacao");
    const r = (data ?? {}) as { ok?: boolean; erro?: string };
    if (!r.ok) return Response.json({ error: r.erro === "sem_permissao" ? "Apenas admin/gestor pode aprovar." : r.erro === "ja_decidida" ? "Esta solicitação já foi decidida." : (r.erro || "Não foi possível aprovar.") }, { status: 422 });
    return Response.json({ success: true, saleId: (data as { venda_id?: string }).venda_id });
  }
  if (action === "recusarSolicitacao") {
    const id = String(body.id || "");
    const motivo = String(body.motivo || "").slice(0, 300);
    if (!id) return Response.json({ error: "Solicitação inválida." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("recusar_solicitacao", { p_id: id, p_motivo: motivo });
    if (error) return falhaEsteira(error, "recusar_solicitacao");
    const r = (data ?? {}) as { ok?: boolean; erro?: string };
    if (!r.ok) return Response.json({ error: r.erro === "sem_permissao" ? "Apenas admin/gestor pode recusar." : (r.erro || "Não foi possível recusar.") }, { status: 422 });
    return Response.json({ success: true });
  }
  // ===== Negociação: status de documento (revisão), condições comerciais, comissão, observações =====
  if (action === "docStatus") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    const id = clean(body.anexoId, 60);
    const status = clean(body.status, 20);
    const requestId = clean(body.requestId, 60);
    const validos = ["anexado", "em_analise", "aprovado", "recusado", "correcao"];
    if (!id || !requestId || !validos.includes(status)) return Response.json({ error: "Documento, status ou solicitação inválida." }, { status: 422 });
    const motivo = clean(body.motivo, 400);
    if ((status === "recusado" || status === "correcao") && !motivo) return Response.json({ error: "Informe o motivo da recusa/correção." }, { status: 422 });
    const resultado = await reviewSalesDocumentAtomic(auth.supabase as unknown as SalesDocumentReviewRpcClient, {
      attachmentId: id, status, reason: motivo, requestId,
    });
    if ("internalError" in resultado && resultado.internalError) console.error("esteira_documento_revisao_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  if (action === "docAnexoObrig") {
    // marca um anexo avulso como obrigatório/opcional (gestor)
    const denied = await requireManager(auth);
    if (denied) return denied;
    const id = clean(body.anexoId, 60);
    if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("esteira_anexos").update({ obrigatorio: body.obrigatorio === true } as never).eq("id", id);
    return error ? falhaEsteira(error, "alterar_obrigatoriedade_anexo") : Response.json({ success: true });
  }

  if (["docModeloCreate", "docModeloUpdate", "docModeloDelete"].includes(action)) {
    const denied = await requireManager(auth);
    if (denied) return denied;
    if (action === "docModeloCreate") {
      const grupo = clean(body.grupo, 40); const nome = clean(body.nome, 120);
      if (!grupo || !nome) return Response.json({ error: "Informe o grupo e o nome do documento." }, { status: 422 });
      const condicaoNova = clean(body.condicao, 20) || null;
      if (condicaoNova && !["financiamento", "consorcio", "nao_a_vista"].includes(condicaoNova)) return Response.json({ error: "Condição inválida." }, { status: 422 });
      const { data: last } = await auth.supabase.from("esteira_doc_modelo").select("ordem").eq("grupo", grupo).order("ordem", { ascending: false }).limit(1).maybeSingle();
      const { error } = await auth.supabase.from("esteira_doc_modelo").insert({ grupo, nome, obrigatorio: body.obrigatorio !== false, ordem: (last?.ordem ?? 0) + 1, condicao: condicaoNova } as never);
      return error ? falhaEsteira(error, "criar_modelo_documento") : Response.json({ success: true });
    }
    if (action === "docModeloUpdate") {
      const id = clean(body.id, 60); if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = clean(body.nome, 120);
      if (typeof body.obrigatorio === "boolean") patch.obrigatorio = body.obrigatorio;
      if (body.condicao !== undefined) {
        const c = clean(body.condicao, 20) || null;
        if (c && !["financiamento", "consorcio", "nao_a_vista"].includes(c)) return Response.json({ error: "Condição inválida." }, { status: 422 });
        patch.condicao = c;
      }
      const { error } = await auth.supabase.from("esteira_doc_modelo").update(patch as never).eq("id", id);
      return error ? falhaEsteira(error, "atualizar_modelo_documento") : Response.json({ success: true });
    }
    const id = clean(body.id, 60); if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("esteira_doc_modelo").update({ ativo: false } as never).eq("id", id);
    return error ? falhaEsteira(error, "remover_modelo_documento") : Response.json({ success: true });
  }

  if (action === "salvarCondicoes") {
    const processId = clean(body.processId, 60);
    if (!processId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    // O toggle "possui cônjuge?" mora nesta tabela mas pertence à documentação —
    // por isso ele é aceito fora da etapa de proposta; o resto respeita a cascata.
    if (body.somenteConjuge !== true) {
      const g = await guardBloco(auth, processId, "condicoes");
      if (g.deny) return g.deny;
    }
    const num = (v: unknown) => v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
    const dt = (v: unknown) => { const s = clean(v, 10); return s || null; };
    const row: Record<string, unknown> = {
      processo_ref: processId,
      comprador_tem_conjuge: body.comprador_tem_conjuge === true,
      vendedor_tem_conjuge: body.vendedor_tem_conjuge === true,
      valor_total: num(body.valor_total), valor_entrada: num(body.valor_entrada), data_entrada: dt(body.data_entrada),
      valor_financiado: num(body.valor_financiado), valor_fgts: num(body.valor_fgts), valor_recursos_proprios: num(body.valor_recursos_proprios),
      valor_parcelas_interm: num(body.valor_parcelas_interm), qtd_parcelas: num(body.qtd_parcelas), valor_parcela: num(body.valor_parcela),
      valor_assinatura: num(body.valor_assinatura), valor_chaves: num(body.valor_chaves),
      data_assinatura: dt(body.data_assinatura), data_conclusao: dt(body.data_conclusao),
      origem_recursos: Array.isArray(body.origem_recursos) ? body.origem_recursos : [],
      atualizado_por: auth.user.id, atualizado_em: new Date().toISOString(),
    };
    // Forma de pagamento governa quais documentos o checklist passa a exigir.
    const forma = clean(body.forma_pagamento, 20);
    if (forma) {
      if (!(FORMAS_PGTO as readonly string[]).includes(forma)) return Response.json({ error: "Forma de pagamento inválida." }, { status: 422 });
      row.forma_pagamento = forma;
    } else if (body.forma_pagamento === null) {
      row.forma_pagamento = null;
    }
    const { error } = await auth.supabase.from("venda_condicoes").upsert(row as never, { onConflict: "processo_ref" });
    return error ? falhaEsteira(error, "salvar_condicoes") : Response.json({ success: true });
  }

  if (action === "salvarComissao") {
    const processId = clean(body.processId, 60);
    const requestId = clean(body.requestId, 60);
    if (!processId || !requestId) return Response.json({ error: "Venda ou solicitação inválida." }, { status: 422 });
    const g = await guardBloco(auth, processId, "comissao");
    if (g.deny) return g.deny;
    const num = (v: unknown) => v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
    const participantInputs = Array.isArray(body.participantes) ? body.participantes : [];
    const installmentInputs = Array.isArray(body.parcelas) ? body.parcelas : null;
    const registro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
    if (participantInputs.length > 50 || participantInputs.some((p) => !registro(p))
       || (installmentInputs && (installmentInputs.length > 60 || installmentInputs.some((p) => !registro(p))))) {
      return Response.json({ error: "Participantes ou parcelas inválidos ou acima do limite permitido." }, { status: 422 });
    }
    const commission: Record<string, unknown> = {
      percentual_total: num(body.percentual_total), valor_total: num(body.valor_total),
      imobiliaria: clean(body.imobiliaria, 160) || null, forma_pgto: clean(body.forma_pgto, 80) || null,
      participantes: participantInputs.map((p) => ({
        nome: clean(p.nome, 160), papel: clean(p.papel, 80), percentual: num(p.percentual), valor: num(p.valor),
      })),
    };
    const installments = installmentInputs ? installmentInputs.map((p) => ({
        valor: num(p.valor), gatilho: clean(p.gatilho, 80) || null,
        data_prevista: clean(p.data_prevista, 10) || null, data_efetiva: clean(p.data_efetiva, 10) || null,
        responsavel: clean(p.responsavel, 120) || null, status: clean(p.status, 20) || "previsto",
      })) : null;
    const resultado = await saveSalesCommissionAtomic(auth.supabase as unknown as SalesCommissionRpcClient, { processId, commission, installments, requestId });
    if ("internalError" in resultado && resultado.internalError) console.error("esteira_comissao_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  // ===== Partes da negociação: nome, telefone e e-mail de comprador, vendedor e cônjuges =====
  // A presença de uma parte "conjuge_*" é o que liga o grupo de documentos do cônjuge,
  // por isso adicionar/remover cônjuge sincroniza a flag em venda_condicoes.
  if (action === "salvarParte" || action === "adicionarParte") {
    const processId = clean(body.processId, 60);
    const papel = clean(body.papel, 30);
    const requestId = clean(body.requestId, 60);
    if (!processId || !requestId || !(PAPEIS_PARTE as readonly string[]).includes(papel)) return Response.json({ error: "Informe a venda, o papel e a solicitação da parte." }, { status: 422 });
    const g = await guardBloco(auth, processId, papel.includes("vendedor") ? "partes_vendedor" : "partes_comprador");
    if (g.deny) return g.deny;
    const email = clean(body.email, 160).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 422 });
    const ordem = Number.isSafeInteger(Number(body.ordem)) && Number(body.ordem) > 0 ? Number(body.ordem) : 1;
    const payload: Record<string, unknown> = {
      papel, ordem,
      nome: clean(body.nome, 160) || null,
      telefone: clean(body.telefone, 40) || null,
      email: email || null,
      cpf: clean(body.cpf, 20) || null,
      observacao: clean(body.observacao, 400) || null,
    };
    const resultado = await mutateSalesPartyAtomic(auth.supabase as unknown as SalesPartyRpcClient, {
      action: action === "adicionarParte" ? "adicionar" : "salvar", processId, payload, requestId,
    });
    if ("internalError" in resultado && resultado.internalError) console.error("esteira_parte_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  if (action === "removerParte") {
    const id = clean(body.parteId, 60);
    const processId = clean(body.processId, 60);
    const requestId = clean(body.requestId, 60);
    if (!id || !processId || !requestId) return Response.json({ error: "Venda, parte ou solicitação inválida." }, { status: 422 });
    const { data: alvo, error: alvoError } = await auth.supabase.from("venda_partes").select("processo_ref,papel,ordem").eq("id", id).eq("processo_ref", processId).maybeSingle();
    if (alvoError) return falhaEsteira(alvoError, "carregar_parte_remocao");
    if (alvo) {
      const papel = String(alvo.papel);
      const g = await guardBloco(auth, processId, papel.includes("vendedor") ? "partes_vendedor" : "partes_comprador");
      if (g.deny) return g.deny;
    }
    const resultado = await mutateSalesPartyAtomic(auth.supabase as unknown as SalesPartyRpcClient, {
      action: "remover", processId, partyId: id, requestId,
    });
    if ("internalError" in resultado && resultado.internalError) console.error("esteira_parte_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  // ===== Upload em lote: o corretor manda tudo de uma vez e a Sara organiza =====
  if (action === "addAnexoLote") {
    const processo_ref = clean(body.processId, 60);
    const loteId = clean(body.loteId, 60);
    const arquivos = Array.isArray(body.arquivos) ? (body.arquivos as Array<Record<string, unknown>>) : [];
    if (!processo_ref || !loteId) return Response.json({ error: "Venda ou lote inválido." }, { status: 422 });
    if (!arquivos.length) return Response.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
    if (arquivos.length > 15) return Response.json({ error: "Envie no máximo 15 arquivos por lote." }, { status: 422 });
    // O lote entra sem grupo definido, então basta que a etapa tenha algum bloco de documentos aberto.
    const ctxLote = await contexto(auth, processo_ref);
    if (ctxLote.error) return falhaEsteira(ctxLote.error, "carregar_contexto_lote");
    const blocoLote = blocoDocsAberto(ctxLote);
    if (!blocoLote) {
      const alvo = etapaDoBloco(ctxLote.etapas, "docs_comprador");
      return Response.json({ error: `A venda está em "${ctxLote.atual?.nome ?? "etapa desconhecida"}". Documentos começam na etapa "${alvo?.nome ?? "Documentação do comprador"}".` }, { status: 409 });
    }
    const gLote = await guardBloco(auth, processo_ref, blocoLote);
    if (gLote.deny) return gLote.deny;
    const linhas = arquivos.map((a) => ({
      nome: clean(a.nome, 200), path: clean(a.path, 400),
      mime: clean(a.mime, 100) || null,
      tamanho: Number.isFinite(Number(a.tamanho)) ? Math.trunc(Number(a.tamanho)) : null,
    })).filter((l) => l.nome && l.path);
    if (!linhas.length) return Response.json({ error: "Arquivos inválidos." }, { status: 422 });
    const resultado = await registerSalesBatchAttachmentsAtomic(auth.supabase as unknown as SalesBatchAttachmentRpcClient, {
      processId: processo_ref,
      batchId: loteId,
      stageSlug: clean(body.etapaSlug, 40) || null,
      files: linhas,
    });
    if ("internalError" in resultado && resultado.internalError) console.error("esteira_lote_atomico_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  if (action === "classificarLote") {
    const processId = clean(body.processId, 60);
    const loteId = clean(body.loteId, 60) || null;
    const anexoIds = Array.isArray(body.anexoIds) ? (body.anexoIds as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
    if (!processId || (!loteId && !anexoIds.length)) return Response.json({ error: "Informe a venda e o lote a classificar." }, { status: 422 });
    const { data, error } = await auth.supabase.functions.invoke("ia-docs-classificar", {
      body: { processo_ref: processId, lote_id: loteId, anexo_ids: anexoIds },
    });
    if (error) return falhaClassificacaoDocumentos(error as { code?: string; context?: Response });
    const r = (data ?? {}) as { ok?: boolean; reason?: string; processados?: number; classificados?: number; triagem?: number; resultados?: unknown[] };
    if (!r.ok) {
      const resposta = respostaClassificacao(r.reason);
      const codigo = typeof r.reason === "string" && Object.hasOwn(MENSAGENS_CLASSIFICACAO, r.reason) ? r.reason : "falha_integracao";
      return Response.json({ error: resposta.error, erro: codigo }, { status: resposta.status });
    }
    return Response.json({ success: true, processados: r.processados ?? 0, classificados: r.classificados ?? 0, triagem: r.triagem ?? 0, resultados: r.resultados ?? [] });
  }

  if (action === "triagemConfirmar") {
    // O corretor/gestor confirma (ou corrige) o destino sugerido pela Sara.
    const id = clean(body.anexoId, 60);
    const grupo = clean(body.grupo, 40);
    const docNome = clean(body.docNome, 200);
    if (!id || !grupo) return Response.json({ error: "Informe o documento e o grupo." }, { status: 422 });
    const { data: antes } = await auth.supabase.from("esteira_anexos").select("processo_ref,nome,ia_grupo,ia_doc_nome,ia_confianca").eq("id", id).maybeSingle();
    if (!antes?.processo_ref) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    const blocoTriagem = GRUPO_BLOCO[grupo];
    if (!blocoTriagem) return Response.json({ error: "Grupo de documento inválido." }, { status: 422 });
    const gTriagem = await guardBloco(auth, String(antes.processo_ref), blocoTriagem);
    if (gTriagem.deny) return gTriagem.deny;
    const requestId = clean(body.requestId, 60);
    if (!requestId) return Response.json({ error: "Informe a solicitação da confirmação." }, { status: 422 });
    const resultado = await confirmSalesTriageAtomic(auth.supabase as unknown as SalesTriageConfirmRpcClient, {
      attachmentId: id, group: grupo, documentName: docNome, required: body.obrigatorio === true, requestId,
    });
    if ("internalError" in resultado && resultado.internalError) console.error("esteira_triagem_confirmacao_atomica_falhou", { codigo: resultado.internalError.code ?? "desconhecido" });
    return Response.json(resultado.body, { status: resultado.status });
  }

  // ===== Exclusão definitiva da venda (admin e diretor) =====
  if (action === "excluirVenda") {
    const processId = clean(body.processId, 60);
    if (!processId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("excluir_venda_esteira", {
      p_processo: processId,
      p_motivo: clean(body.motivo, 400) || undefined,
      p_forcar: body.forcar === true,
      p_descartar_lead: body.descartarLead === true,
    });
    if (error) return falhaEsteira(error, "excluir_venda");
    const r = (data ?? {}) as { ok?: boolean; erro?: string; bloqueios?: string[]; paths?: string[]; lead?: string; forcada?: boolean };
    if (!r.ok) {
      if (r.erro === "sem_permissao") return Response.json({ error: "Apenas administrador ou diretor pode excluir uma venda." }, { status: 403 });
      if (r.erro === "processo_nao_encontrado") return Response.json({ error: "Venda não encontrada." }, { status: 404 });
      if (r.erro === "impacto_financeiro") {
        return Response.json({
          error: `Esta venda já movimentou o financeiro: ${(r.bloqueios ?? []).join(", ")}. Confirme a exclusão para apagar mesmo assim.`,
          bloqueios: r.bloqueios ?? [],
          precisaForcar: true,
        }, { status: 409 });
      }
      return Response.json({ error: r.erro || "Não foi possível excluir a venda." }, { status: 422 });
    }
    // O snapshot já está salvo em venda_exclusoes; agora limpamos os arquivos do bucket.
    const paths = Array.isArray(r.paths) ? r.paths.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
    let arquivosRemovidos = 0;
    if (paths.length) {
      const { error: stErr } = await auth.supabase.storage.from("esteira-docs").remove(paths);
      if (!stErr) arquivosRemovidos = paths.length;
    }
    return Response.json({ success: true, arquivosRemovidos, arquivosTotal: paths.length, lead: r.lead, forcada: r.forcada === true });
  }

  if (action === "addObs") {
    const processId = clean(body.processId, 60);
    const texto = clean(body.texto, 4000);
    if (!processId || !texto) return Response.json({ error: "Escreva a observação." }, { status: 422 });
    const { data: processo, error: processoError } = await auth.supabase.from("venda_processos").select("id").eq("id", processId).maybeSingle();
    if (processoError) return falhaEsteira(processoError, "autorizar_observacao");
    if (!processo) return Response.json({ error: "Venda não encontrada ou sem acesso." }, { status: 404 });
    const { data: me } = await auth.supabase.from("usuarios").select("nome").eq("id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("venda_observacoes").insert({ processo_ref: processId, texto, autor: auth.user.id, autor_nome: me?.nome ?? null } as never);
    return error ? falhaEsteira(error, "adicionar_observacao") : Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
