import { createServerSupabaseClient } from "../../../lib/supabase/server";

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
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

// Pap\u00e9is das partes de uma negocia\u00e7\u00e3o (comprador/vendedor e respectivos c\u00f4njuges).
const PAPEIS_PARTE = ["comprador", "conjuge_comprador", "vendedor", "conjuge_vendedor"] as const;
const FORMAS_PGTO = ["a_vista", "financiamento", "consorcio", "misto"] as const;

/**
 * Regra de documento condicional.
 * condicao null  \u2192 sempre exigido.
 * 'financiamento' \u2192 s\u00f3 quando a venda \u00e9 financiada (ou mista).
 * 'consorcio'     \u2192 s\u00f3 quando a venda \u00e9 por cons\u00f3rcio (ou mista).
 * 'nao_a_vista'   \u2192 qualquer forma que n\u00e3o seja \u00e0 vista.
 * Sem forma de pagamento definida, o documento permanece vis\u00edvel mas n\u00e3o trava o avan\u00e7o.
 */
function docExigido(condicao: string | null, forma: string | null): boolean {
  if (!condicao) return true;
  if (!forma) return false;
  if (condicao === "financiamento") return forma === "financiamento" || forma === "misto";
  if (condicao === "consorcio") return forma === "consorcio" || forma === "misto";
  if (condicao === "nao_a_vista") return forma !== "a_vista";
  return true;
}

/** Registra um evento na trilha de auditoria dos anexos (nunca derruba a requisi\u00e7\u00e3o principal). */
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
  } catch { /* auditoria \u00e9 best-effort */ }
}

type Auth = { supabase: ReturnType<typeof createServerSupabaseClient>; user: { id: string } };
async function requireManager(auth: Auth) {
  const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  return me && ["admin", "gestor", "executivo"].includes(me.role) ? null : Response.json({ error: "Apenas administradores podem configurar as etapas." }, { status: 403 });
}
async function activeSlugs(auth: Auth) {
  const { data } = await auth.supabase.from("esteira_etapas").select("slug,sla_dias").eq("ativo", true);
  return new Map((data ?? []).map((row) => [row.slug as string, Number(row.sla_dias)]));
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [sales, processes, deals, leads, products, brokers, stages, etapaDocs, anexos, users, history, verificacoes, solicitacoes, docModelo, condicoes, comissao, comissaoParcelas, observacoes, pipelines, pipelineStages, partes, anexoEventos] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,empreendimento_id,empreendimento_nome,unidade_id,vgv,forma_pgto,status,obs").order("created_at", { ascending: false }),
    auth.supabase.from("venda_processos").select("id,venda_id,negocio_id,etapa,tipo_venda,responsavel_usuario_id,prazo_em,observacoes,criado_em,atualizado_em,aprovacao_status,aprovacao_motivo,solicitado_por"),
    auth.supabase.from("negocios").select("id,venda_id,lead_id,corretor_id,empreendimento_id,valor,status"),
    auth.supabase.from("leads").select("id,nome,telefone,email,corretor_id,tags,extras"),
    auth.supabase.from("empreendimentos").select("id,nome,origem,bairro,cidade").order("nome"),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("esteira_etapas").select("id,slug,nome,cor,ordem,papel,sla_dias,resale,exige_docs").eq("ativo", true).order("ordem", { ascending: true }),
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
  const error = [sales, processes, deals, leads, products, brokers, stages, etapaDocs, anexos].find((item) => item.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });
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
    // Trava de documentos: só ao AVANÇAR (etapa destino mais à frente) e só se a etapa atual exigir docs.
    const { data: stageRows } = await auth.supabase.from("esteira_etapas").select("slug,ordem,nome,exige_docs").eq("ativo", true);
    const stageBySlug = new Map((stageRows ?? []).map((s) => [s.slug as string, s]));
    const { data: proc } = await auth.supabase.from("venda_processos").select("etapa,negocio_id,aprovacao_status").eq("id", processId).maybeSingle();
    if (proc && (proc as { aprovacao_status?: string }).aprovacao_status === "pendente") return Response.json({ error: "Esta venda ainda está aguardando aprovação de entrada na esteira." }, { status: 409 });
    const atual = proc ? stageBySlug.get(proc.etapa as string) : null;
    const destino = stageBySlug.get(stage);
    const avancando = atual && destino && Number(destino.ordem) > Number(atual.ordem);
    if (avancando && atual?.exige_docs) {
      // Verificação manual do gestor libera direto (override consciente).
      const { data: verif } = await auth.supabase.from("esteira_etapa_verificacoes").select("id").eq("processo_ref", processId).eq("etapa_slug", proc!.etapa).maybeSingle();
      if (!verif) {
        const motivos: string[] = [];
        const { data: cond } = await auth.supabase.from("venda_condicoes").select("valor_total,comprador_tem_conjuge,vendedor_tem_conjuge,forma_pagamento").eq("processo_ref", processId).maybeSingle();
        const grupos = ["comprador", "vendedor", "imovel"];
        if (cond?.comprador_tem_conjuge) grupos.push("conjuge_comprador");
        if (cond?.vendedor_tem_conjuge) grupos.push("conjuge_vendedor");
        const [{ data: modeloRaw }, { data: aps }] = await Promise.all([
          auth.supabase.from("esteira_doc_modelo").select("grupo,nome,condicao").eq("obrigatorio", true).eq("ativo", true).in("grupo", grupos),
          auth.supabase.from("esteira_anexos").select("grupo,doc_nome,status,obrigatorio").eq("processo_ref", processId),
        ]);
        // Documentos condicionais: só entram na conta quando a forma de pagamento da venda os exige.
        // À vista não pede carta de crédito nem aprovação de financiamento.
        const forma = (cond as { forma_pagamento?: string | null } | null)?.forma_pagamento ?? null;
        const modelo = (modeloRaw ?? []).filter((m) => docExigido((m as { condicao?: string | null }).condicao ?? null, forma));
        const aprov = new Set((aps ?? []).filter((a) => a.status === "aprovado").map((a) => `${a.grupo}::${a.doc_nome}`));
        const faltamModelo = modelo.filter((m) => !aprov.has(`${m.grupo}::${m.nome}`));
        const faltamAvulsos = (aps ?? []).filter((a) => a.obrigatorio && a.status !== "aprovado").length;
        const emTriagem = (aps ?? []).filter((a) => a.status === "triagem").length;
        if (emTriagem) motivos.push(`${emTriagem} documento(s) enviado(s) em lote ainda aguardam conferência da classificação da Sara`);
        if (faltamModelo.length || faltamAvulsos) {
          const label: Record<string, string> = { comprador: "do comprador", conjuge_comprador: "do cônjuge do comprador", vendedor: "do vendedor", conjuge_vendedor: "do cônjuge do vendedor", imovel: "do imóvel" };
          const porGrupo: Record<string, number> = {};
          faltamModelo.forEach((m) => { porGrupo[m.grupo as string] = (porGrupo[m.grupo as string] || 0) + 1; });
          const partes = Object.entries(porGrupo).map(([g, n]) => `${n} ${label[g] || g}`);
          if (faltamAvulsos) partes.push(`${faltamAvulsos} adicional(is)`);
          motivos.push(`Faltam documentos obrigatórios aprovados: ${partes.join(", ")}`);
        }
        if (!cond || cond.valor_total == null) motivos.push("as condições comerciais (valor total) ainda não foram preenchidas");
        if (motivos.length) return Response.json({ error: `Não é possível avançar de "${atual.nome}": ${motivos.join("; ")}.` }, { status: 409 });
      }
    }
    const isFinal = slugs.get(stage) === 0;
    const update = isFinal
      ? { etapa: stage, atualizado_em: new Date().toISOString(), prazo_em: null }
      : { etapa: stage, atualizado_em: new Date().toISOString() };
    const { error } = await auth.supabase.from("venda_processos").update(update).eq("id", processId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "addAnexo" || action === "removeAnexo") {
    if (action === "removeAnexo") {
      const id = clean(body.anexoId, 60);
      if (!id) return Response.json({ error: "Anexo inválido." }, { status: 422 });
      const { data: antes } = await auth.supabase.from("esteira_anexos").select("processo_ref,grupo,doc_nome,nome,path").eq("id", id).maybeSingle();
      const { error } = await auth.supabase.from("esteira_anexos").delete().eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 502 });
      await trilha(auth, "removido", { processoRef: (antes?.processo_ref as string) ?? null, detalhe: antes ?? { id } });
      return Response.json({ success: true });
    }
    const processo_ref = clean(body.processId, 60);
    const path = clean(body.path, 400);
    const nome = clean(body.nome, 200);
    if (!processo_ref || !path || !nome) return Response.json({ error: "Informe o processo, o arquivo e o nome." }, { status: 422 });
    const insert: Record<string, unknown> = {
      processo_ref, nome, path,
      etapa_slug: clean(body.etapaSlug, 40) || null,
      doc_nome: clean(body.docNome, 200) || null,
      grupo: clean(body.grupo, 40) || null,
      obrigatorio: body.obrigatorio === true,
      observacao: clean(body.observacao, 400) || null,
      status: "anexado",
      mime: clean(body.mime, 100) || null,
      tamanho: Number.isFinite(Number(body.tamanho)) ? Math.trunc(Number(body.tamanho)) : null,
      negocio_id: Number.isSafeInteger(Number(body.negocioId)) && Number(body.negocioId) > 0 ? Number(body.negocioId) : null,
      enviado_por: auth.user.id,
    };
    const { data: criado, error } = await auth.supabase.from("esteira_anexos").insert(insert as never).select("id").maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await trilha(auth, "upload", { anexoId: (criado?.id as string) ?? null, processoRef: processo_ref, detalhe: { arquivo: nome, grupo: insert.grupo, doc_nome: insert.doc_nome, origem: "manual" } });
    return Response.json({ success: true });
  }

  if (action === "verifyStage" || action === "unverifyStage") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    const processId = clean(body.processId, 60);
    const etapaSlug = clean(body.etapaSlug, 40);
    if (!processId || !etapaSlug) return Response.json({ error: "Informe o processo e a etapa." }, { status: 422 });
    if (action === "unverifyStage") {
      const { error } = await auth.supabase.from("esteira_etapa_verificacoes").delete().eq("processo_ref", processId).eq("etapa_slug", etapaSlug);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    // valida documentos obrigatórios antes de aprovar
    const { data: reqDocs } = await auth.supabase.from("esteira_etapa_docs").select("nome").eq("etapa_slug", etapaSlug).eq("obrigatorio", true).eq("ativo", true);
    const exigidos = (reqDocs ?? []).map((d) => (d.nome as string));
    if (exigidos.length) {
      const { data: anexados } = await auth.supabase.from("esteira_anexos").select("doc_nome").eq("processo_ref", processId).eq("etapa_slug", etapaSlug);
      const anexadosSet = new Set((anexados ?? []).map((a) => (a.doc_nome as string)));
      const faltando = exigidos.filter((nome) => !anexadosSet.has(nome));
      if (faltando.length) return Response.json({ error: `Não é possível verificar: faltam documentos obrigatórios: ${faltando.join(", ")}.` }, { status: 409 });
    }
    const { error: verifErr } = await auth.supabase.from("esteira_etapa_verificacoes").upsert({ processo_ref: processId, etapa_slug: etapaSlug, verificado_por: auth.user.id, verificado_em: new Date().toISOString() } as never, { onConflict: "processo_ref,etapa_slug" });
    if (verifErr) return Response.json({ error: verifErr.message }, { status: 502 });
    // avanço automático: se a etapa verificada é a atual da venda, empurra para a próxima etapa da esteira
    const { data: proc } = await auth.supabase.from("venda_processos").select("etapa,tipo_venda").eq("id", processId).maybeSingle();
    let advancedTo: string | null = null;
    if (proc && proc.etapa === etapaSlug) {
      const { data: stageRows } = await auth.supabase.from("esteira_etapas").select("slug,ordem,resale,sla_dias").eq("ativo", true).order("ordem", { ascending: true });
      const isRevenda = proc.tipo_venda === "revenda";
      const track = (stageRows ?? []).filter((s) => !s.resale || isRevenda);
      const idx = track.findIndex((s) => s.slug === etapaSlug);
      const next = idx >= 0 ? track[idx + 1] : undefined;
      if (next) {
        const isFinal = Number(next.sla_dias) === 0;
        const update = isFinal ? { etapa: next.slug, atualizado_em: new Date().toISOString(), prazo_em: null } : { etapa: next.slug, atualizado_em: new Date().toISOString() };
        const { error: mvErr } = await auth.supabase.from("venda_processos").update(update as never).eq("id", processId);
        if (mvErr) return Response.json({ error: mvErr.message }, { status: 502 });
        advancedTo = next.slug as string;
      }
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
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    if (action === "docUpdate") {
      const id = clean(body.docId, 60);
      if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
      const patch: Record<string, unknown> = {};
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = clean(body.nome, 120);
      if (typeof body.obrigatorio === "boolean") patch.obrigatorio = body.obrigatorio;
      if (Object.keys(patch).length === 0) return Response.json({ error: "Nada para atualizar." }, { status: 422 });
      const { error } = await auth.supabase.from("esteira_etapa_docs").update(patch as never).eq("id", id);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    if (action === "docReorder") {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
      if (!ids.length) return Response.json({ error: "Ordem inválida." }, { status: 422 });
      for (let index = 0; index < ids.length; index += 1) {
        const { error } = await auth.supabase.from("esteira_etapa_docs").update({ ordem: index + 1 } as never).eq("id", ids[index]);
        if (error) return Response.json({ error: error.message }, { status: 502 });
      }
      return Response.json({ success: true });
    }
    // docDelete
    const id = clean(body.docId, 60);
    if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("esteira_etapa_docs").update({ ativo: false } as never).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "createStage" || action === "updateStage" || action === "reorderStages" || action === "deleteStage" || action === "bulkMoveStage") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    if (action === "createStage") {
      const nome = clean(body.nome, 80);
      if (!nome) return Response.json({ error: "Informe o nome da etapa." }, { status: 422 });
      let slug = slugify(nome);
      if (!slug) slug = `etapa_${Date.now().toString(36)}`;
      const { data: existing } = await auth.supabase.from("esteira_etapas").select("slug").eq("slug", slug).maybeSingle();
      if (existing) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;
      const { data: last } = await auth.supabase.from("esteira_etapas").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
      const ordem = (last?.ordem ?? 0) + 1;
      const { error } = await auth.supabase.from("esteira_etapas").insert({ slug, nome, cor: clean(body.cor, 20) || "#8d2bd1", papel: clean(body.papel, 40) || "Corretor", sla_dias: Number.isFinite(Number(body.slaDias)) ? Math.max(0, Math.trunc(Number(body.slaDias))) : 3, resale: body.resale === true, ordem } as never);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
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
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    if (action === "reorderStages") {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((value) => clean(value, 60)).filter(Boolean) : [];
      if (!ids.length) return Response.json({ error: "Ordem inválida." }, { status: 422 });
      for (let index = 0; index < ids.length; index += 1) {
        const { error } = await auth.supabase.from("esteira_etapas").update({ ordem: index + 1 } as never).eq("id", ids[index]);
        if (error) return Response.json({ error: error.message }, { status: 502 });
      }
      return Response.json({ success: true });
    }
    if (action === "bulkMoveStage") {
      const from = clean(body.fromSlug, 40);
      const to = clean(body.toSlug, 40);
      const slugs = await activeSlugs(auth);
      if (!from || !to || from === to || !slugs.has(from) || !slugs.has(to)) return Response.json({ error: "Selecione as etapas de origem e destino." }, { status: 422 });
      const isFinal = slugs.get(to) === 0;
      const update = isFinal ? { etapa: to, atualizado_em: new Date().toISOString(), prazo_em: null } : { etapa: to, atualizado_em: new Date().toISOString() };
      const { error } = await auth.supabase.from("venda_processos").update(update).eq("etapa", from);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    // deleteStage
    const id = clean(body.stageId, 60);
    if (!id) return Response.json({ error: "Etapa inválida." }, { status: 422 });
    const { data: stageRow } = await auth.supabase.from("esteira_etapas").select("slug").eq("id", id).maybeSingle();
    if (stageRow?.slug) {
      const { count } = await auth.supabase.from("venda_processos").select("id", { count: "exact", head: true }).eq("etapa", stageRow.slug);
      if ((count ?? 0) > 0) return Response.json({ error: "Esta etapa tem vendas. Mova-as antes de excluir (Mover todos desta etapa)." }, { status: 409 });
    }
    const { error } = await auth.supabase.from("esteira_etapas").update({ ativo: false } as never).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "assign") {
    const processId = String(body.processId || "");
    const userId = body.userId ? String(body.userId) : null;
    const { error } = await auth.supabase.from("venda_processos").update({ responsavel_usuario_id: userId, atualizado_em: new Date().toISOString() }).eq("id", processId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "devolverFunil") {
    // Devolve uma venda da esteira de volta ao funil de atendimento (follow-up). Reabre o negócio.
    const denied = await requireManager(auth);
    if (denied) return denied;
    const processId = clean(body.processId, 60);
    if (!processId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    const motivo = clean(body.motivo, 400) || null;
    const { data: proc } = await auth.supabase.from("venda_processos").select("negocio_id").eq("id", processId).maybeSingle();
    if (!proc?.negocio_id) return Response.json({ error: "Venda sem negócio vinculado." }, { status: 404 });
    // Etapa de destino: escolhida pelo gestor (qualquer etapa de qualquer funil). Fallback: follow-up do funil atual.
    let stageId: number | null = Number.isSafeInteger(Number(body.stageId)) && Number(body.stageId) > 0 ? Number(body.stageId) : null;
    let pipelineId: number | null = null;
    if (stageId) {
      const { data: st } = await auth.supabase.from("pipeline_stages").select("id,pipeline_id").eq("id", stageId).maybeSingle();
      if (!st) return Response.json({ error: "Etapa de destino inválida." }, { status: 422 });
      pipelineId = st.pipeline_id as number;
    } else {
      const { data: neg } = await auth.supabase.from("negocios").select("pipeline_id").eq("id", proc.negocio_id).maybeSingle();
      if (neg?.pipeline_id) {
        pipelineId = neg.pipeline_id as number;
        const { data: stgs } = await auth.supabase.from("pipeline_stages").select("id,nome,ordem").eq("pipeline_id", neg.pipeline_id).order("ordem", { ascending: true });
        const alvo = (stgs ?? []).find((s) => /follow/i.test(String(s.nome))) || (stgs ?? [])[0];
        stageId = (alvo?.id as number | undefined) ?? null;
      }
    }
    const now = new Date().toISOString();
    const upd: Record<string, unknown> = { status: "aberto", venda_id: null, ultima_movimentacao: now };
    if (pipelineId) upd.pipeline_id = pipelineId;
    if (stageId) { upd.stage_id = stageId; upd.estagio_desde = now; }
    const { error: e1 } = await auth.supabase.from("negocios").update(upd).eq("id", proc.negocio_id);
    if (e1) return Response.json({ error: e1.message }, { status: 502 });
    const { error: e2 } = await auth.supabase.from("venda_processos").update({ aprovacao_status: "devolvida", aprovacao_motivo: motivo, atualizado_em: now } as never).eq("id", processId);
    return e2 ? Response.json({ error: e2.message }, { status: 502 }) : Response.json({ success: true });
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
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    // rejectSale — devolve o negócio ao corretor (volta ao funil) com o motivo
    const motivo = clean(body.motivo, 400) || "Entrada recusada pelo gestor.";
    const { error } = await auth.supabase.from("venda_processos").update({ aprovacao_status: "recusada", aprovacao_motivo: motivo, aprovado_por: auth.user.id, aprovado_em: new Date().toISOString() } as never).eq("id", processId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (proc.negocio_id) await auth.supabase.from("negocios").update({ status: "aberto", venda_id: null, ultima_movimentacao: new Date().toISOString() }).eq("id", proc.negocio_id);
    return Response.json({ success: true });
  }

  if (action === "create") {
    const dealId = Number(body.dealId);
    const productId = String(body.productId || "");
    const vgv = Number(body.vgv);
    if (!Number.isSafeInteger(dealId) || !productId || !Number.isFinite(vgv) || vgv <= 0) return Response.json({ error: "Selecione o negócio, o produto e informe o valor." }, { status: 422 });
    const [{ data: deal }, { data: product }] = await Promise.all([
      auth.supabase.from("negocios").select("id,lead_id,empreendimento_id").eq("id", dealId).maybeSingle(),
      auth.supabase.from("empreendimentos").select("id,nome,origem").eq("id", productId).maybeSingle(),
    ]);
    if (!deal || !product) return Response.json({ error: "Negócio ou produto não encontrado." }, { status: 404 });
    // Gestor/admin que gera a venda já entra aprovada; corretor entra pendente da aprovação do gestor.
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const gestor = !!me && ["admin", "gestor", "executivo"].includes(me.role);
    const aprovacao = gestor ? "aprovada" : "pendente";
    const { data: sale, error: saleError } = await auth.supabase.from("vendas").insert({ data_venda: new Date().toISOString().slice(0, 10), empreendimento_id: product.id, empreendimento_nome: product.nome, vgv, forma_pgto: String(body.payment || "") || null, status: "pendente", obs: String(body.notes || "") || null }).select("id").single();
    if (saleError || !sale) return Response.json({ error: saleError?.message || "Não foi possível criar a venda." }, { status: 502 });
    const { error: dealError } = await auth.supabase.from("negocios").update({ venda_id: sale.id, status: "ganho", ultima_movimentacao: new Date().toISOString() }).eq("id", deal.id);
    const { error: processError } = await auth.supabase.from("venda_processos").insert({ venda_id: sale.id, negocio_id: deal.id, etapa: "inicio", tipo_venda: product.origem === "terceiros" ? "revenda" : "construtora", criado_por: auth.user.id, solicitado_por: auth.user.id, aprovacao_status: aprovacao, aprovado_por: gestor ? auth.user.id : null, aprovado_em: gestor ? new Date().toISOString() : null } as never);
    if (dealError || processError) return Response.json({ error: dealError?.message || processError?.message }, { status: 502 });
    return Response.json({ success: true, saleId: sale.id, aprovacao });
  }
  if (action === "solicitar") {
    const dealId = Number(body.dealId);
    const productId = String(body.productId || "");
    const vgv = Number(body.vgv);
    if (!Number.isSafeInteger(dealId) || !productId || !Number.isFinite(vgv) || vgv <= 0) return Response.json({ error: "Selecione o negócio, o produto e informe o valor." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("solicitar_venda", { p_negocio: dealId, p_produto: productId, p_vgv: vgv, p_forma: String(body.payment || "") || null, p_obs: String(body.notes || "") || null });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    const r = (data ?? {}) as { ok?: boolean; erro?: string };
    if (!r.ok) return Response.json({ error: r.erro === "ja_solicitado" ? "Já existe uma solicitação pendente para este negócio." : r.erro === "ja_tem_venda" ? "Este negócio já virou venda." : r.erro === "sem_permissao_neste_negocio" ? "Você só pode enviar negócios sob sua responsabilidade." : (r.erro || "Não foi possível solicitar.") }, { status: 422 });
    return Response.json({ success: true });
  }
  if (action === "aprovarSolicitacao") {
    const id = String(body.id || "");
    if (!id) return Response.json({ error: "Solicitação inválida." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("aprovar_solicitacao", { p_id: id });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    const r = (data ?? {}) as { ok?: boolean; erro?: string };
    if (!r.ok) return Response.json({ error: r.erro === "sem_permissao" ? "Apenas admin/gestor pode aprovar." : r.erro === "ja_decidida" ? "Esta solicitação já foi decidida." : (r.erro || "Não foi possível aprovar.") }, { status: 422 });
    return Response.json({ success: true, saleId: (data as { venda_id?: string }).venda_id });
  }
  if (action === "recusarSolicitacao") {
    const id = String(body.id || "");
    const motivo = String(body.motivo || "").slice(0, 300);
    if (!id) return Response.json({ error: "Solicitação inválida." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("recusar_solicitacao", { p_id: id, p_motivo: motivo });
    if (error) return Response.json({ error: error.message }, { status: 502 });
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
    const validos = ["anexado", "em_analise", "aprovado", "recusado", "correcao"];
    if (!id || !validos.includes(status)) return Response.json({ error: "Documento ou status inválido." }, { status: 422 });
    const motivo = clean(body.motivo, 400);
    if ((status === "recusado" || status === "correcao") && !motivo) return Response.json({ error: "Informe o motivo da recusa/correção." }, { status: 422 });
    const { data: antes } = await auth.supabase.from("esteira_anexos").select("processo_ref,status,grupo,doc_nome,nome").eq("id", id).maybeSingle();
    const { error } = await auth.supabase.from("esteira_anexos").update({ status, status_motivo: motivo || null, revisado_por: auth.user.id, revisado_em: new Date().toISOString() } as never).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await trilha(auth, "status_alterado", { anexoId: id, processoRef: (antes?.processo_ref as string) ?? null, detalhe: { arquivo: antes?.nome ?? null, de: antes?.status ?? null, para: status, motivo: motivo || null } });
    return Response.json({ success: true });
  }

  if (action === "docAnexoObrig") {
    // marca um anexo avulso como obrigatório/opcional (gestor)
    const denied = await requireManager(auth);
    if (denied) return denied;
    const id = clean(body.anexoId, 60);
    if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("esteira_anexos").update({ obrigatorio: body.obrigatorio === true } as never).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
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
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
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
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    const id = clean(body.id, 60); if (!id) return Response.json({ error: "Documento inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("esteira_doc_modelo").update({ ativo: false } as never).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "salvarCondicoes") {
    const processId = clean(body.processId, 60);
    if (!processId) return Response.json({ error: "Venda inválida." }, { status: 422 });
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
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "salvarComissao") {
    const denied = await requireManager(auth);
    if (denied) return denied;
    const processId = clean(body.processId, 60);
    if (!processId) return Response.json({ error: "Venda inválida." }, { status: 422 });
    const num = (v: unknown) => v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
    const row: Record<string, unknown> = {
      processo_ref: processId,
      percentual_total: num(body.percentual_total), valor_total: num(body.valor_total),
      imobiliaria: clean(body.imobiliaria, 160) || null, forma_pgto: clean(body.forma_pgto, 80) || null,
      participantes: Array.isArray(body.participantes) ? body.participantes : [],
      atualizado_por: auth.user.id, atualizado_em: new Date().toISOString(),
    };
    const { error } = await auth.supabase.from("venda_comissao").upsert(row as never, { onConflict: "processo_ref" });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (Array.isArray(body.parcelas)) {
      await auth.supabase.from("venda_comissao_parcelas").delete().eq("processo_ref", processId);
      const parcelas = (body.parcelas as Array<Record<string, unknown>>).map((p, i) => ({
        processo_ref: processId, valor: num(p.valor), gatilho: clean(p.gatilho, 80) || null,
        data_prevista: clean(p.data_prevista, 10) || null, data_efetiva: clean(p.data_efetiva, 10) || null,
        responsavel: clean(p.responsavel, 120) || null, status: clean(p.status, 20) || "previsto", ordem: i + 1,
      }));
      if (parcelas.length) { const { error: pe } = await auth.supabase.from("venda_comissao_parcelas").insert(parcelas as never); if (pe) return Response.json({ error: pe.message }, { status: 502 }); }
    }
    return Response.json({ success: true });
  }

  // ===== Partes da negociação: nome, telefone e e-mail de comprador, vendedor e cônjuges =====
  if (action === "salvarParte") {
    const processId = clean(body.processId, 60);
    const papel = clean(body.papel, 30);
    if (!processId || !(PAPEIS_PARTE as readonly string[]).includes(papel)) return Response.json({ error: "Informe a venda e o papel da parte." }, { status: 422 });
    const ordem = Number.isSafeInteger(Number(body.ordem)) && Number(body.ordem) > 0 ? Number(body.ordem) : 1;
    const email = clean(body.email, 160).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 422 });
    const row: Record<string, unknown> = {
      processo_ref: processId, papel, ordem,
      nome: clean(body.nome, 160) || null,
      telefone: clean(body.telefone, 40) || null,
      email: email || null,
      cpf: clean(body.cpf, 20) || null,
      observacao: clean(body.observacao, 400) || null,
      atualizado_por: auth.user.id, atualizado_em: new Date().toISOString(),
    };
    const { error } = await auth.supabase.from("venda_partes").upsert(row as never, { onConflict: "processo_ref,papel,ordem" });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "removerParte") {
    const id = clean(body.parteId, 60);
    if (!id) return Response.json({ error: "Parte inválida." }, { status: 422 });
    const { error } = await auth.supabase.from("venda_partes").delete().eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  // ===== Upload em lote: o corretor manda tudo de uma vez e a Sara organiza =====
  if (action === "addAnexoLote") {
    const processo_ref = clean(body.processId, 60);
    const loteId = clean(body.loteId, 60);
    const arquivos = Array.isArray(body.arquivos) ? (body.arquivos as Array<Record<string, unknown>>) : [];
    if (!processo_ref || !loteId) return Response.json({ error: "Venda ou lote inválido." }, { status: 422 });
    if (!arquivos.length) return Response.json({ error: "Nenhum arquivo enviado." }, { status: 422 });
    if (arquivos.length > 15) return Response.json({ error: "Envie no máximo 15 arquivos por lote." }, { status: 422 });
    const negocioId = Number.isSafeInteger(Number(body.negocioId)) && Number(body.negocioId) > 0 ? Number(body.negocioId) : null;
    const linhas = arquivos.map((a) => ({
      processo_ref, negocio_id: negocioId,
      nome: clean(a.nome, 200), path: clean(a.path, 400),
      mime: clean(a.mime, 100) || null,
      tamanho: Number.isFinite(Number(a.tamanho)) ? Math.trunc(Number(a.tamanho)) : null,
      etapa_slug: clean(body.etapaSlug, 40) || null,
      grupo: null, doc_nome: null, obrigatorio: false,
      status: "triagem", origem: "lote_ia", ia_status: "nao_processado",
      lote_id: loteId, enviado_por: auth.user.id,
    })).filter((l) => l.nome && l.path);
    if (!linhas.length) return Response.json({ error: "Arquivos inválidos." }, { status: 422 });
    const { data: criados, error } = await auth.supabase.from("esteira_anexos").insert(linhas as never).select("id,nome");
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await trilha(auth, "upload_lote", { processoRef: processo_ref, loteId, detalhe: { quantidade: linhas.length, arquivos: linhas.map((l) => l.nome) } });
    return Response.json({ success: true, loteId, anexos: criados ?? [] });
  }

  if (action === "classificarLote") {
    const processId = clean(body.processId, 60);
    const loteId = clean(body.loteId, 60) || null;
    const anexoIds = Array.isArray(body.anexoIds) ? (body.anexoIds as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
    if (!processId || (!loteId && !anexoIds.length)) return Response.json({ error: "Informe a venda e o lote a classificar." }, { status: 422 });
    const { data, error } = await auth.supabase.functions.invoke("ia-docs-classificar", {
      body: { processo_ref: processId, lote_id: loteId, anexo_ids: anexoIds },
    });
    if (error) {
      let detalhe = error.message;
      try { const ctx = await (error as { context?: Response }).context?.json(); if (ctx?.reason) detalhe = String(ctx.detalhe || ctx.reason); } catch { /* mantém a mensagem original */ }
      return Response.json({ error: `A Sara não conseguiu ler os documentos: ${detalhe}` }, { status: 502 });
    }
    const r = (data ?? {}) as { ok?: boolean; reason?: string; processados?: number; classificados?: number; triagem?: number; resultados?: unknown[] };
    if (!r.ok) return Response.json({ error: r.reason === "sem_chave" ? "A chave da IA não está configurada no ambiente." : `Não foi possível classificar: ${r.reason || "erro desconhecido"}.` }, { status: 502 });
    return Response.json({ success: true, processados: r.processados ?? 0, classificados: r.classificados ?? 0, triagem: r.triagem ?? 0, resultados: r.resultados ?? [] });
  }

  if (action === "triagemConfirmar") {
    // O corretor/gestor confirma (ou corrige) o destino sugerido pela Sara.
    const id = clean(body.anexoId, 60);
    const grupo = clean(body.grupo, 40);
    const docNome = clean(body.docNome, 200);
    if (!id || !grupo) return Response.json({ error: "Informe o documento e o grupo." }, { status: 422 });
    const { data: antes } = await auth.supabase.from("esteira_anexos").select("processo_ref,nome,ia_grupo,ia_doc_nome,ia_confianca").eq("id", id).maybeSingle();
    const corrigido = antes ? (antes.ia_grupo !== grupo || (antes.ia_doc_nome ?? "") !== docNome) : false;
    const { error } = await auth.supabase.from("esteira_anexos").update({
      grupo, doc_nome: docNome || null, status: "anexado",
      obrigatorio: body.obrigatorio === true,
      confirmado_por: auth.user.id, confirmado_em: new Date().toISOString(),
    } as never).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await trilha(auth, corrigido ? "corrigido" : "confirmado", {
      anexoId: id, processoRef: (antes?.processo_ref as string) ?? null,
      detalhe: { arquivo: antes?.nome ?? null, sugerido: { grupo: antes?.ia_grupo ?? null, doc_nome: antes?.ia_doc_nome ?? null, confianca: antes?.ia_confianca ?? null }, aplicado: { grupo, doc_nome: docNome || null } },
    });
    return Response.json({ success: true });
  }

  if (action === "addObs") {
    const processId = clean(body.processId, 60);
    const texto = clean(body.texto, 4000);
    if (!processId || !texto) return Response.json({ error: "Escreva a observação." }, { status: 422 });
    const { data: me } = await auth.supabase.from("usuarios").select("nome").eq("id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("venda_observacoes").insert({ processo_ref: processId, texto, autor: auth.user.id, autor_nome: me?.nome ?? null } as never);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
