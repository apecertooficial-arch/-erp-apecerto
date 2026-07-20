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
  const [sales, processes, deals, leads, products, brokers, stages, etapaDocs, anexos, users, history, verificacoes, solicitacoes] = await Promise.all([
    auth.supabase.from("vendas").select("id,created_at,data_venda,empreendimento_id,empreendimento_nome,unidade_id,vgv,forma_pgto,status,obs").order("created_at", { ascending: false }),
    auth.supabase.from("venda_processos").select("id,venda_id,negocio_id,etapa,tipo_venda,responsavel_usuario_id,prazo_em,observacoes,criado_em,atualizado_em"),
    auth.supabase.from("negocios").select("id,venda_id,lead_id,corretor_id,empreendimento_id,valor,status"),
    auth.supabase.from("leads").select("id,nome,telefone,email,corretor_id,tags,extras"),
    auth.supabase.from("empreendimentos").select("id,nome,origem,bairro,cidade").order("nome"),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("esteira_etapas").select("id,slug,nome,cor,ordem,papel,sla_dias,resale,exige_docs").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("esteira_etapa_docs").select("id,etapa_slug,nome,obrigatorio,ordem").eq("ativo", true).order("ordem", { ascending: true }),
    auth.supabase.from("esteira_anexos").select("id,processo_ref,negocio_id,etapa_slug,doc_nome,nome,path,mime,tamanho,criado_em").order("criado_em", { ascending: false }),
    auth.supabase.from("usuarios").select("id,nome,role"),
    auth.supabase.from("venda_processo_historico").select("processo_id,etapa_de,etapa_para,movido_por,movido_em").order("movido_em", { ascending: true }),
    auth.supabase.from("esteira_etapa_verificacoes").select("id,processo_ref,etapa_slug,verificado_por,verificado_em"),
    auth.supabase.from("venda_solicitacoes").select("id,negocio_id,corretor_id,solicitado_por,produto_id,vgv,forma_pgto,obs,status,criado_em").eq("status", "pendente").order("criado_em", { ascending: true }),
  ]);
  const error = [sales, processes, deals, leads, products, brokers, stages, etapaDocs, anexos].find((item) => item.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ sales: sales.data ?? [], processes: processes.data ?? [], deals: deals.data ?? [], leads: leads.data ?? [], products: products.data ?? [], brokers: brokers.data ?? [], stages: stages.data ?? [], etapaDocs: etapaDocs.data ?? [], anexos: anexos.data ?? [], users: users.data ?? [], history: history.data ?? [], verificacoes: verificacoes.data ?? [], solicitacoes: solicitacoes.data ?? [] });
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
    const { data: proc } = await auth.supabase.from("venda_processos").select("etapa,negocio_id").eq("id", processId).maybeSingle();
    const atual = proc ? stageBySlug.get(proc.etapa as string) : null;
    const destino = stageBySlug.get(stage);
    const avancando = atual && destino && Number(destino.ordem) > Number(atual.ordem);
    if (avancando && atual?.exige_docs) {
      // Modelo híbrido: a etapa que exige documentos só libera avanço depois de VERIFICADA por um gestor.
      const { data: verif } = await auth.supabase.from("esteira_etapa_verificacoes").select("id").eq("processo_ref", processId).eq("etapa_slug", proc!.etapa).maybeSingle();
      if (!verif) {
        const { data: reqDocs } = await auth.supabase.from("esteira_etapa_docs").select("nome").eq("etapa_slug", proc!.etapa).eq("obrigatorio", true).eq("ativo", true);
        const exigidos = (reqDocs ?? []).map((d) => (d.nome as string));
        if (exigidos.length) {
          const { data: anexados } = await auth.supabase.from("esteira_anexos").select("doc_nome").eq("processo_ref", processId).eq("etapa_slug", proc!.etapa);
          const anexadosSet = new Set((anexados ?? []).map((a) => (a.doc_nome as string)));
          const faltando = exigidos.filter((nome) => !anexadosSet.has(nome));
          if (faltando.length) return Response.json({ error: `Faltam documentos obrigatórios em "${atual.nome}": ${faltando.join(", ")}.` }, { status: 409 });
        }
        return Response.json({ error: `A etapa "${atual.nome}" precisa ser verificada por um gestor antes de avançar.` }, { status: 409 });
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
      const { error } = await auth.supabase.from("esteira_anexos").delete().eq("id", id);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
    }
    const processo_ref = clean(body.processId, 60);
    const path = clean(body.path, 400);
    const nome = clean(body.nome, 200);
    if (!processo_ref || !path || !nome) return Response.json({ error: "Informe o processo, o arquivo e o nome." }, { status: 422 });
    const insert: Record<string, unknown> = {
      processo_ref, nome, path,
      etapa_slug: clean(body.etapaSlug, 40) || null,
      doc_nome: clean(body.docNome, 200) || null,
      mime: clean(body.mime, 100) || null,
      tamanho: Number.isFinite(Number(body.tamanho)) ? Math.trunc(Number(body.tamanho)) : null,
      negocio_id: Number.isSafeInteger(Number(body.negocioId)) && Number(body.negocioId) > 0 ? Number(body.negocioId) : null,
      enviado_por: auth.user.id,
    };
    const { error } = await auth.supabase.from("esteira_anexos").insert(insert as never);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
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
    const { data: sale, error: saleError } = await auth.supabase.from("vendas").insert({ data_venda: new Date().toISOString().slice(0, 10), empreendimento_id: product.id, empreendimento_nome: product.nome, vgv, forma_pgto: String(body.payment || "") || null, status: "pendente", obs: String(body.notes || "") || null }).select("id").single();
    if (saleError || !sale) return Response.json({ error: saleError?.message || "Não foi possível criar a venda." }, { status: 502 });
    const { error: dealError } = await auth.supabase.from("negocios").update({ venda_id: sale.id }).eq("id", deal.id);
    const { error: processError } = await auth.supabase.from("venda_processos").insert({ venda_id: sale.id, negocio_id: deal.id, etapa: "inicio", tipo_venda: product.origem === "terceiros" ? "revenda" : "construtora", criado_por: auth.user.id });
    if (dealError || processError) return Response.json({ error: dealError?.message || processError?.message }, { status: 502 });
    return Response.json({ success: true, saleId: sale.id });
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
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
