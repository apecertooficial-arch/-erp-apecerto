import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}
type Auth = NonNullable<Awaited<ReturnType<typeof authClient>>>;

const clean = (value: unknown, max = 400) => typeof value === "string" ? value.trim().slice(0, max) : "";
const cleanOrNull = (value: unknown, max = 400) => { const v = clean(value, max); return v || null; };

async function log(auth: Auth, acao: string, detalhe: string, projetoId: string | null, tarefaId: string | null) {
  try {
    await auth.supabase.rpc("pj_log", { p_acao: acao, p_detalhe: detalhe, p_projeto: projetoId, p_tarefa: tarefaId });
  } catch { /* auditoria nunca derruba a ação */ }
}

const DEFAULT_COLUMNS = [
  { nome: "A fazer", cor: "#8d99ae", ordem: 1 },
  { nome: "Em andamento", cor: "#2f6fed", ordem: 2 },
  { nome: "Em revisão", cor: "#c79a00", ordem: 3 },
  { nome: "Concluído", cor: "#1fa85a", ordem: 4 },
];

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const [projetos, participantes, colunas, tarefas, comentarios, atividades, usuarios, leads, produtos, vendas, anexos] = await Promise.all([
    auth.supabase.from("projetos").select("*").order("atualizado_em", { ascending: false }),
    auth.supabase.from("projeto_participantes").select("projeto_id,usuario_id"),
    auth.supabase.from("projeto_colunas").select("*").eq("arquivada", false).order("ordem", { ascending: true }),
    auth.supabase.from("projeto_tarefas").select("*").eq("arquivada", false).order("ordem", { ascending: true }),
    auth.supabase.from("projeto_comentarios").select("*").order("criado_em", { ascending: true }),
    auth.supabase.from("projeto_atividades").select("*").order("criado_em", { ascending: false }).limit(200),
    auth.supabase.rpc("pj_listar_usuarios"),
    auth.supabase.from("leads").select("id,nome,telefone").order("id", { ascending: false }).limit(600),
    auth.supabase.from("empreendimentos").select("id,nome").order("nome"),
    auth.supabase.from("vendas").select("id,empreendimento_nome,cliente_nome").order("created_at", { ascending: false }).limit(200),
    auth.supabase.from("projeto_anexos").select("*").order("criado_em", { ascending: false }),
  ]);
  const error = [projetos, colunas, tarefas, usuarios].find((item) => item.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({
    projetos: projetos.data ?? [], participantes: participantes.data ?? [], colunas: colunas.data ?? [],
    tarefas: tarefas.data ?? [], comentarios: comentarios.data ?? [], atividades: atividades.data ?? [],
    usuarios: usuarios.data ?? [], leads: leads.data ?? [], produtos: produtos.data ?? [], vendas: vendas.data ?? [],
    anexos: anexos.data ?? [], me: auth.user.id,
  });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");

  if (action === "createProject") {
    const nome = clean(body.nome, 120);
    if (!nome) return Response.json({ error: "Informe o nome do projeto." }, { status: 422 });
    const { data: proj, error } = await auth.supabase.from("projetos").insert({
      nome, descricao: cleanOrNull(body.descricao, 2000), setor: cleanOrNull(body.setor, 80), cor: clean(body.cor, 20) || "#ff7000",
      responsavel_id: cleanOrNull(body.responsavelId, 60), visibilidade: ["privado"].includes(clean(body.visibilidade, 20)) ? "privado" : "publico",
      data_inicio: cleanOrNull(body.dataInicio, 12), prazo: cleanOrNull(body.prazo, 12),
      prioridade: clean(body.prioridade, 12) || "media", criado_por: auth.user.id,
    } as never).select("id,nome").single();
    if (error || !proj) return Response.json({ error: error?.message || "Não foi possível criar o projeto." }, { status: 502 });
    const participantes = Array.isArray(body.participantes) ? (body.participantes as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
    if (participantes.length) await auth.supabase.from("projeto_participantes").insert(participantes.map((usuario_id) => ({ projeto_id: proj.id, usuario_id })) as never);
    await auth.supabase.from("projeto_colunas").insert(DEFAULT_COLUMNS.map((c) => ({ ...c, projeto_id: proj.id })) as never);
    await log(auth, "projeto_criado", `Projeto "${proj.nome}" criado.`, proj.id, null);
    return Response.json({ success: true, projectId: proj.id });
  }

  if (action === "updateProject" || action === "archiveProject" || action === "deleteProject") {
    const id = clean(body.projectId, 60);
    if (!id) return Response.json({ error: "Projeto inválido." }, { status: 422 });
    if (action === "deleteProject") {
      const { error } = await auth.supabase.from("projetos").delete().eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 502 });
      await log(auth, "projeto_excluido", `Projeto excluído.`, id, null);
      return Response.json({ success: true });
    }
    const patch: Record<string, unknown> = {};
    if (action === "archiveProject") patch.status = body.unarchive === true ? "ativo" : "arquivado";
    for (const [key, col] of [["nome", "nome"], ["descricao", "descricao"], ["setor", "setor"], ["cor", "cor"], ["prioridade", "prioridade"], ["visibilidade", "visibilidade"], ["status", "status"]] as const) {
      if (typeof body[key] === "string") patch[col] = cleanOrNull(body[key], key === "descricao" ? 2000 : 120);
    }
    if (patch.nome === null) delete patch.nome; // nome nunca pode ficar vazio
    if (typeof body.responsavelId === "string") patch.responsavel_id = cleanOrNull(body.responsavelId, 60);
    if (typeof body.dataInicio === "string") patch.data_inicio = cleanOrNull(body.dataInicio, 12);
    if (typeof body.prazo === "string") patch.prazo = cleanOrNull(body.prazo, 12);
    const { error } = await auth.supabase.from("projetos").update(patch as never).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (Array.isArray(body.participantes)) {
      const lista = (body.participantes as unknown[]).map((v) => clean(v, 60)).filter(Boolean);
      await auth.supabase.from("projeto_participantes").delete().eq("projeto_id", id);
      if (lista.length) await auth.supabase.from("projeto_participantes").insert(lista.map((usuario_id) => ({ projeto_id: id, usuario_id })) as never);
    }
    await log(auth, action === "archiveProject" ? (body.unarchive === true ? "projeto_reativado" : "projeto_arquivado") : "projeto_editado", `Projeto atualizado.`, id, null);
    return Response.json({ success: true });
  }

  if (["createColumn", "updateColumn", "deleteColumn", "reorderColumns"].includes(action)) {
    const projectId = clean(body.projectId, 60);
    if (action === "createColumn") {
      const nome = clean(body.nome, 60);
      if (!projectId || !nome) return Response.json({ error: "Informe o nome da coluna." }, { status: 422 });
      const { data: last } = await auth.supabase.from("projeto_colunas").select("ordem").eq("projeto_id", projectId).order("ordem", { ascending: false }).limit(1).maybeSingle();
      const { error } = await auth.supabase.from("projeto_colunas").insert({ projeto_id: projectId, nome, cor: clean(body.cor, 20) || "#8d99ae", ordem: (last?.ordem ?? 0) + 1 } as never);
      if (error) return Response.json({ error: error.message }, { status: 502 });
      await log(auth, "coluna_criada", `Coluna "${nome}" criada.`, projectId, null);
      return Response.json({ success: true });
    }
    if (action === "reorderColumns") {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
      for (let index = 0; index < ids.length; index += 1) {
        await auth.supabase.from("projeto_colunas").update({ ordem: index + 1 } as never).eq("id", ids[index]);
      }
      return Response.json({ success: true });
    }
    const colunaId = clean(body.colunaId, 60);
    if (!colunaId) return Response.json({ error: "Coluna inválida." }, { status: 422 });
    if (action === "deleteColumn") {
      const { count } = await auth.supabase.from("projeto_tarefas").select("id", { count: "exact", head: true }).eq("coluna_id", colunaId).eq("arquivada", false);
      if ((count ?? 0) > 0) return Response.json({ error: "Esta coluna tem tarefas. Mova-as antes de excluir." }, { status: 409 });
      const { error } = await auth.supabase.from("projeto_colunas").update({ arquivada: true } as never).eq("id", colunaId);
      if (error) return Response.json({ error: error.message }, { status: 502 });
      await log(auth, "coluna_arquivada", "Coluna arquivada.", projectId || null, null);
      return Response.json({ success: true });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.nome === "string") patch.nome = clean(body.nome, 60);
    if (typeof body.cor === "string") patch.cor = clean(body.cor, 20);
    if (body.limite !== undefined) patch.limite = Number.isFinite(Number(body.limite)) && Number(body.limite) > 0 ? Math.trunc(Number(body.limite)) : null;
    const { error } = await auth.supabase.from("projeto_colunas").update(patch as never).eq("id", colunaId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "createTask") {
    const projectId = clean(body.projectId, 60);
    const colunaId = clean(body.colunaId, 60);
    const titulo = clean(body.titulo, 200);
    if (!projectId || !colunaId || !titulo) return Response.json({ error: "Informe o título da tarefa." }, { status: 422 });
    const { data: last } = await auth.supabase.from("projeto_tarefas").select("ordem").eq("coluna_id", colunaId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const responsavelId = cleanOrNull(body.responsavelId, 60);
    const { data: task, error } = await auth.supabase.from("projeto_tarefas").insert({
      projeto_id: projectId, coluna_id: colunaId, titulo, descricao: cleanOrNull(body.descricao, 4000),
      prioridade: clean(body.prioridade, 12) || "media", responsavel_id: responsavelId,
      prazo: cleanOrNull(body.prazo, 12), ordem: Number(last?.ordem ?? 0) + 1000, criado_por: auth.user.id,
    } as never).select("id,titulo").single();
    if (error || !task) return Response.json({ error: error?.message || "Não foi possível criar a tarefa." }, { status: 502 });
    await log(auth, "tarefa_criada", `Tarefa "${task.titulo}" criada.`, projectId, task.id);
    if (responsavelId && responsavelId !== auth.user.id) await log(auth, "tarefa_atribuida", `Tarefa "${task.titulo}" atribuída a você.`, projectId, task.id);
    return Response.json({ success: true, taskId: task.id });
  }

  if (action === "updateTask") {
    const taskId = clean(body.taskId, 60);
    if (!taskId) return Response.json({ error: "Tarefa inválida." }, { status: 422 });
    const { data: before } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo,responsavel_id,prazo,concluida").eq("id", taskId).maybeSingle();
    const patch: Record<string, unknown> = {};
    if (typeof body.titulo === "string") patch.titulo = clean(body.titulo, 200);
    if (typeof body.descricao === "string") patch.descricao = cleanOrNull(body.descricao, 4000);
    if (typeof body.prioridade === "string") patch.prioridade = clean(body.prioridade, 12);
    if (typeof body.responsavelId === "string") patch.responsavel_id = cleanOrNull(body.responsavelId, 60);
    if (typeof body.dataInicio === "string") patch.data_inicio = cleanOrNull(body.dataInicio, 12);
    if (typeof body.prazo === "string") patch.prazo = cleanOrNull(body.prazo, 12);
    if (Array.isArray(body.etiquetas)) patch.etiquetas = (body.etiquetas as unknown[]).map((v) => clean(v, 40)).filter(Boolean);
    if (Array.isArray(body.checklist)) patch.checklist = (body.checklist as Array<{ texto?: unknown; feito?: unknown }>).map((i) => ({ texto: clean(i?.texto, 200), feito: i?.feito === true })).filter((i) => i.texto);
    if (typeof body.vinculoTipo === "string") { patch.vinculo_tipo = cleanOrNull(body.vinculoTipo, 20); patch.vinculo_id = cleanOrNull(body.vinculoId, 60); patch.vinculo_rotulo = cleanOrNull(body.vinculoRotulo, 160); }
    if (typeof body.concluida === "boolean") { patch.concluida = body.concluida; patch.concluida_em = body.concluida ? new Date().toISOString() : null; }
    if (body.arquivar === true) patch.arquivada = true;
    const { error } = await auth.supabase.from("projeto_tarefas").update(patch as never).eq("id", taskId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    const projId = before?.projeto_id ?? null;
    if (typeof body.responsavelId === "string" && body.responsavelId && body.responsavelId !== before?.responsavel_id) await log(auth, "tarefa_atribuida", `Tarefa "${before?.titulo}" atribuída a novo responsável.`, projId, taskId);
    else if (typeof body.prazo === "string" && body.prazo !== (before?.prazo ?? "")) await log(auth, "prazo_alterado", `Prazo da tarefa "${before?.titulo}" alterado.`, projId, taskId);
    else if (body.arquivar === true) await log(auth, "tarefa_arquivada", `Tarefa "${before?.titulo}" arquivada.`, projId, taskId);
    else if (typeof body.concluida === "boolean" && body.concluida !== before?.concluida) await log(auth, body.concluida ? "tarefa_concluida" : "tarefa_reaberta", `Tarefa "${before?.titulo}" ${body.concluida ? "concluída" : "reaberta"}.`, projId, taskId);
    else await log(auth, "tarefa_editada", `Tarefa "${before?.titulo}" editada.`, projId, taskId);
    return Response.json({ success: true });
  }

  if (action === "moveTask") {
    const taskId = clean(body.taskId, 60);
    const colunaId = clean(body.colunaId, 60);
    if (!taskId || !colunaId) return Response.json({ error: "Movimentação inválida." }, { status: 422 });
    const { data: col } = await auth.supabase.from("projeto_colunas").select("id,nome,limite,projeto_id").eq("id", colunaId).maybeSingle();
    if (!col) return Response.json({ error: "Coluna não encontrada." }, { status: 404 });
    if (col.limite) {
      const { count } = await auth.supabase.from("projeto_tarefas").select("id", { count: "exact", head: true }).eq("coluna_id", colunaId).eq("arquivada", false);
      if ((count ?? 0) >= col.limite) return Response.json({ error: `A coluna "${col.nome}" atingiu o limite de ${col.limite} tarefas.` }, { status: 409 });
    }
    const { data: last } = await auth.supabase.from("projeto_tarefas").select("ordem").eq("coluna_id", colunaId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const done = /conclu/i.test(col.nome);
    const { data: moved, error } = await auth.supabase.from("projeto_tarefas").update({ coluna_id: colunaId, ordem: Number(last?.ordem ?? 0) + 1000, concluida: done, concluida_em: done ? new Date().toISOString() : null } as never).eq("id", taskId).select("titulo,projeto_id").single();
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await log(auth, "tarefa_movida", `Tarefa "${moved?.titulo}" movida para "${col.nome}".`, col.projeto_id, taskId);
    return Response.json({ success: true });
  }

  if (action === "deleteTask") {
    const taskId = clean(body.taskId, 60);
    const { data: before } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo").eq("id", taskId).maybeSingle();
    const { error } = await auth.supabase.from("projeto_tarefas").delete().eq("id", taskId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await log(auth, "tarefa_excluida", `Tarefa "${before?.titulo}" excluída.`, before?.projeto_id ?? null, taskId);
    return Response.json({ success: true });
  }

  if (action === "duplicateTask") {
    const taskId = clean(body.taskId, 60);
    const { data: src } = await auth.supabase.from("projeto_tarefas").select("*").eq("id", taskId).maybeSingle();
    if (!src) return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
    const { error } = await auth.supabase.from("projeto_tarefas").insert({
      projeto_id: src.projeto_id, coluna_id: src.coluna_id, titulo: `${src.titulo} (cópia)`, descricao: src.descricao,
      prioridade: src.prioridade, responsavel_id: src.responsavel_id, prazo: src.prazo, ordem: Number(src.ordem) + 1,
      etiquetas: src.etiquetas, checklist: src.checklist, vinculo_tipo: src.vinculo_tipo, vinculo_id: src.vinculo_id, vinculo_rotulo: src.vinculo_rotulo, criado_por: auth.user.id,
    } as never);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await log(auth, "tarefa_duplicada", `Tarefa "${src.titulo}" duplicada.`, src.projeto_id, taskId);
    return Response.json({ success: true });
  }

  if (action === "addAnexoTarefa") {
    const taskId = clean(body.taskId, 60);
    const nome = clean(body.nome, 200);
    const path = clean(body.path, 400);
    if (!taskId || !nome || !path) return Response.json({ error: "Anexo inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("projeto_anexos").insert({ tarefa_id: taskId, nome, path, mime: cleanOrNull(body.mime, 100), tamanho: Number.isFinite(Number(body.tamanho)) ? Number(body.tamanho) : null, criado_por: auth.user.id } as never);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    const { data: t } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo").eq("id", taskId).maybeSingle();
    await log(auth, "anexo_adicionado", `Anexo "${nome}" adicionado em "${t?.titulo}".`, t?.projeto_id ?? null, taskId);
    return Response.json({ success: true });
  }
  if (action === "removeAnexoTarefa") {
    const id = clean(body.anexoId, 60);
    const { data: ax } = await auth.supabase.from("projeto_anexos").select("nome,tarefa_id").eq("id", id).maybeSingle();
    const { error } = await auth.supabase.from("projeto_anexos").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (ax) { const { data: t } = await auth.supabase.from("projeto_tarefas").select("projeto_id").eq("id", ax.tarefa_id).maybeSingle(); await log(auth, "anexo_removido", `Anexo "${ax.nome}" removido.`, t?.projeto_id ?? null, ax.tarefa_id); }
    return Response.json({ success: true });
  }
  if (action === "comment") {
    const taskId = clean(body.taskId, 60);
    const texto = clean(body.texto, 2000);
    if (!taskId || !texto) return Response.json({ error: "Escreva o comentário." }, { status: 422 });
    const { error } = await auth.supabase.from("projeto_comentarios").insert({ tarefa_id: taskId, usuario_id: auth.user.id, texto } as never);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    const { data: t } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo").eq("id", taskId).maybeSingle();
    await log(auth, "comentario", `Comentário em "${t?.titulo}".`, t?.projeto_id ?? null, taskId);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
