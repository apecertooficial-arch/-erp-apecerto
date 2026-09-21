import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type ProjectsError = { code?: string; message?: string } | null | undefined;

function falhaProjetos(error: ProjectsError, operacao: string, status = 502) {
  const semPermissao = error?.code === "42501" || /permission|policy|acesso negado/i.test(error?.message ?? "");
  console.error("projetos_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: semPermissao
      ? "Você não tem permissão para concluir esta operação."
      : "Não foi possível concluir a operação de Projetos no momento.",
    erro: semPermissao ? "sem_permissao" : "falha_banco",
  }, { status: semPermissao ? 403 : status });
}

function falhaProjetosParcial(error: ProjectsError, operacao: string) {
  console.error("projetos_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: "A operação foi aplicada apenas em parte. Não repita a ação; a gestão precisa reconciliar Projetos.",
    erro: "reconciliacao_necessaria",
  }, { status: 502 });
}

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { status: "missing" as const };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return { status: "auth_error" as const, error };
  if (!data.user) return { status: "invalid" as const };
  return { status: "ok" as const, supabase, user: data.user };
}
type Auth = Extract<Awaited<ReturnType<typeof authClient>>, { status: "ok" }>;

function falhaAuth(auth: Awaited<ReturnType<typeof authClient>>) {
  if (auth.status === "auth_error") return falhaProjetos(auth.error, "autenticar");
  return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
}

const clean = (value: unknown, max = 400) => typeof value === "string" ? value.trim().slice(0, max) : "";
const cleanOrNull = (value: unknown, max = 400) => { const v = clean(value, max); return v || null; };

async function log(auth: Auth, acao: string, detalhe: string, projetoId: string | null, tarefaId: string | null) {
  try {
    // A função aceita NULL para indicar que o evento pertence apenas ao projeto
    // ou apenas à tarefa; o gerador de tipos do PostgREST não expressa nulidade
    // de argumentos RPC, por isso a compatibilidade fica localizada aqui.
    const { error } = await auth.supabase.rpc("pj_log", { p_acao: acao, p_detalhe: detalhe, p_projeto: projetoId as string, p_tarefa: tarefaId as string });
    return error as ProjectsError;
  } catch {
    return { code: "transporte_auditoria" } as ProjectsError;
  }
}

const DEFAULT_COLUMNS = [
  { nome: "A fazer", cor: "#8d99ae", ordem: 1 },
  { nome: "Em andamento", cor: "#2f6fed", ordem: 2 },
  { nome: "Em revisão", cor: "#c79a00", ordem: 3 },
  { nome: "Concluído", cor: "#1fa85a", ordem: 4 },
];

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (auth.status !== "ok") return falhaAuth(auth);
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
  const error = [projetos, participantes, colunas, tarefas, comentarios, atividades, usuarios, leads, produtos, vendas, anexos].find((item) => item.error)?.error;
  if (error) return falhaProjetos(error, "carregar_workspace");
  return Response.json({
    projetos: projetos.data ?? [], participantes: participantes.data ?? [], colunas: colunas.data ?? [],
    tarefas: tarefas.data ?? [], comentarios: comentarios.data ?? [], atividades: atividades.data ?? [],
    usuarios: usuarios.data ?? [], leads: leads.data ?? [], produtos: produtos.data ?? [], vendas: vendas.data ?? [],
    anexos: anexos.data ?? [], me: auth.user.id,
  });
}

export async function PATCH(request: Request) {
  const auth = await authClient(request);
  if (auth.status !== "ok") return falhaAuth(auth);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
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
    if (error || !proj) return falhaProjetos(error, "criar_projeto");
    const participantes = Array.isArray(body.participantes) ? (body.participantes as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
    if (participantes.length) {
      const { error: participantesError } = await auth.supabase.from("projeto_participantes").insert(participantes.map((usuario_id) => ({ projeto_id: proj.id, usuario_id })) as never);
      if (participantesError) return falhaProjetosParcial(participantesError, "criar_participantes");
    }
    const { data: colunasCriadas, error: colunasError } = await auth.supabase
      .from("projeto_colunas")
      .insert(DEFAULT_COLUMNS.map((c) => ({ ...c, projeto_id: proj.id })) as never)
      .select("id");
    if (colunasError || colunasCriadas?.length !== DEFAULT_COLUMNS.length) return falhaProjetosParcial(colunasError, "criar_colunas_padrao");
    const auditError = await log(auth, "projeto_criado", `Projeto "${proj.nome}" criado.`, proj.id, null);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_projeto_criado");
    return Response.json({ success: true, projectId: proj.id });
  }

  if (action === "updateProject" || action === "archiveProject" || action === "deleteProject") {
    const id = clean(body.projectId, 60);
    if (!id) return Response.json({ error: "Projeto inválido." }, { status: 422 });
    if (action === "deleteProject") {
      const { data: removido, error } = await auth.supabase.from("projetos").delete().eq("id", id).select("id").maybeSingle();
      if (error) return falhaProjetos(error, "excluir_projeto");
      if (!removido) return Response.json({ error: "Projeto não encontrado ou sem permissão." }, { status: 404 });
      // O projeto já não existe; auditar com o ID como vínculo faria `pj_log`
      // retornar sem gravar por não encontrar mais um projeto visível.
      const auditError = await log(auth, "projeto_excluido", `Projeto ${id} excluído.`, null, null);
      if (auditError) return falhaProjetosParcial(auditError, "auditar_projeto_excluido");
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
    const { data: atualizado, error } = await auth.supabase.from("projetos").update(patch as never).eq("id", id).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "atualizar_projeto");
    if (!atualizado) return Response.json({ error: "Projeto não encontrado ou sem permissão." }, { status: 404 });
    if (Array.isArray(body.participantes)) {
      const lista = (body.participantes as unknown[]).map((v) => clean(v, 60)).filter(Boolean);
      const { error: removerError } = await auth.supabase.from("projeto_participantes").delete().eq("projeto_id", id);
      if (removerError) return falhaProjetosParcial(removerError, "substituir_participantes");
      if (lista.length) {
        const { error: inserirError } = await auth.supabase.from("projeto_participantes").insert(lista.map((usuario_id) => ({ projeto_id: id, usuario_id })) as never);
        if (inserirError) return falhaProjetosParcial(inserirError, "substituir_participantes");
      }
    }
    const auditError = await log(auth, action === "archiveProject" ? (body.unarchive === true ? "projeto_reativado" : "projeto_arquivado") : "projeto_editado", "Projeto atualizado.", id, null);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_projeto_atualizado");
    return Response.json({ success: true });
  }

  if (["createColumn", "updateColumn", "deleteColumn", "reorderColumns"].includes(action)) {
    const projectId = clean(body.projectId, 60);
    if (action === "createColumn") {
      const nome = clean(body.nome, 60);
      if (!projectId || !nome) return Response.json({ error: "Informe o nome da coluna." }, { status: 422 });
      const { data: last, error: lastError } = await auth.supabase.from("projeto_colunas").select("ordem").eq("projeto_id", projectId).order("ordem", { ascending: false }).limit(1).maybeSingle();
      if (lastError) return falhaProjetos(lastError, "carregar_ordem_coluna");
      const { data: criada, error } = await auth.supabase.from("projeto_colunas").insert({ projeto_id: projectId, nome, cor: clean(body.cor, 20) || "#8d99ae", ordem: (last?.ordem ?? 0) + 1 } as never).select("id").maybeSingle();
      if (error) return falhaProjetos(error, "criar_coluna");
      if (!criada) return falhaProjetos(null, "confirmar_coluna_criada");
      const auditError = await log(auth, "coluna_criada", `Coluna "${nome}" criada.`, projectId, null);
      if (auditError) return falhaProjetosParcial(auditError, "auditar_coluna_criada");
      return Response.json({ success: true });
    }
    if (action === "reorderColumns") {
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((v) => clean(v, 60)).filter(Boolean) : [];
      if (!projectId || !ids.length) return Response.json({ error: "Ordenação inválida." }, { status: 422 });
      for (let index = 0; index < ids.length; index += 1) {
        const { data: atualizada, error } = await auth.supabase.from("projeto_colunas").update({ ordem: index + 1 } as never).eq("id", ids[index]).eq("projeto_id", projectId).select("id").maybeSingle();
        if (error || !atualizada) return falhaProjetosParcial(error, "reordenar_colunas");
      }
      return Response.json({ success: true });
    }
    const colunaId = clean(body.colunaId, 60);
    if (!colunaId) return Response.json({ error: "Coluna inválida." }, { status: 422 });
    if (action === "deleteColumn") {
      const { count, error: countError } = await auth.supabase.from("projeto_tarefas").select("id", { count: "exact", head: true }).eq("coluna_id", colunaId).eq("arquivada", false);
      if (countError) return falhaProjetos(countError, "contar_tarefas_coluna");
      if ((count ?? 0) > 0) return Response.json({ error: "Esta coluna tem tarefas. Mova-as antes de excluir." }, { status: 409 });
      const { data: arquivada, error } = await auth.supabase.from("projeto_colunas").update({ arquivada: true } as never).eq("id", colunaId).select("id").maybeSingle();
      if (error) return falhaProjetos(error, "arquivar_coluna");
      if (!arquivada) return Response.json({ error: "Coluna não encontrada ou sem permissão." }, { status: 404 });
      const auditError = await log(auth, "coluna_arquivada", "Coluna arquivada.", projectId || null, null);
      if (auditError) return falhaProjetosParcial(auditError, "auditar_coluna_arquivada");
      return Response.json({ success: true });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.nome === "string") patch.nome = clean(body.nome, 60);
    if (typeof body.cor === "string") patch.cor = clean(body.cor, 20);
    if (body.limite !== undefined) patch.limite = Number.isFinite(Number(body.limite)) && Number(body.limite) > 0 ? Math.trunc(Number(body.limite)) : null;
    const { data: atualizada, error } = await auth.supabase.from("projeto_colunas").update(patch as never).eq("id", colunaId).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "atualizar_coluna");
    if (!atualizada) return Response.json({ error: "Coluna não encontrada ou sem permissão." }, { status: 404 });
    return Response.json({ success: true });
  }

  if (action === "createTask") {
    const projectId = clean(body.projectId, 60);
    const colunaId = clean(body.colunaId, 60);
    const titulo = clean(body.titulo, 200);
    if (!projectId || !colunaId || !titulo) return Response.json({ error: "Informe o título da tarefa." }, { status: 422 });
    const { data: last, error: lastError } = await auth.supabase.from("projeto_tarefas").select("ordem").eq("coluna_id", colunaId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    if (lastError) return falhaProjetos(lastError, "carregar_ordem_tarefa");
    const responsavelId = cleanOrNull(body.responsavelId, 60);
    const { data: task, error } = await auth.supabase.from("projeto_tarefas").insert({
      projeto_id: projectId, coluna_id: colunaId, titulo, descricao: cleanOrNull(body.descricao, 4000),
      prioridade: clean(body.prioridade, 12) || "media", responsavel_id: responsavelId,
      prazo: cleanOrNull(body.prazo, 12), ordem: Number(last?.ordem ?? 0) + 1000, criado_por: auth.user.id,
    } as never).select("id,titulo").single();
    if (error || !task) return falhaProjetos(error, "criar_tarefa");
    const auditCreateError = await log(auth, "tarefa_criada", `Tarefa "${task.titulo}" criada.`, projectId, task.id);
    if (auditCreateError) return falhaProjetosParcial(auditCreateError, "auditar_tarefa_criada");
    if (responsavelId && responsavelId !== auth.user.id) {
      const auditAssignError = await log(auth, "tarefa_atribuida", `Tarefa "${task.titulo}" atribuída a você.`, projectId, task.id);
      if (auditAssignError) return falhaProjetosParcial(auditAssignError, "auditar_tarefa_atribuida");
    }
    return Response.json({ success: true, taskId: task.id });
  }

  if (action === "updateTask") {
    const taskId = clean(body.taskId, 60);
    if (!taskId) return Response.json({ error: "Tarefa inválida." }, { status: 422 });
    const { data: before, error: beforeError } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo,responsavel_id,prazo,data_inicio,concluida,checklist,etiquetas,descricao,prioridade,vinculo_rotulo").eq("id", taskId).maybeSingle();
    if (beforeError) return falhaProjetos(beforeError, "carregar_tarefa_atual");
    if (!before) return Response.json({ error: "Tarefa não encontrada ou sem permissão." }, { status: 404 });
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
    const { data: atualizada, error } = await auth.supabase.from("projeto_tarefas").update(patch as never).eq("id", taskId).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "atualizar_tarefa");
    if (!atualizada) return Response.json({ error: "Tarefa não encontrada ou sem permissão." }, { status: 404 });
    // --- histórico específico: descreve exatamente o que mudou ---
    const projId = before?.projeto_id ?? null;
    const fmtBR = (d: string | null) => d ? d.split("-").reverse().join("/") : null;
    const msgs: string[] = [];
    let acao = "tarefa_editada";
    if (typeof patch.titulo === "string" && before && patch.titulo !== before.titulo) msgs.push(`renomeou a tarefa para "${patch.titulo}"`);
    if ("descricao" in patch && before && (patch.descricao ?? "") !== (before.descricao ?? "")) msgs.push("atualizou a descrição");
    if (typeof patch.prioridade === "string" && before && patch.prioridade !== before.prioridade) msgs.push(`mudou a prioridade para ${patch.prioridade}`);
    if ("responsavel_id" in patch && before && (patch.responsavel_id ?? null) !== (before.responsavel_id ?? null)) {
      acao = "tarefa_atribuida";
      if (patch.responsavel_id) { const { data: u } = await auth.supabase.rpc("pj_listar_usuarios"); const nome = ((u ?? []) as Array<{ id: string; nome: string }>).find((x) => x.id === patch.responsavel_id)?.nome; msgs.push(`definiu ${nome ?? "novo responsável"} como responsável`); }
      else msgs.push("removeu o responsável");
    }
    if ("prazo" in patch && before && (patch.prazo ?? null) !== (before.prazo ?? null)) { acao = "prazo_alterado"; msgs.push(patch.prazo ? `definiu o prazo para ${fmtBR(patch.prazo as string)}` : "removeu o prazo"); }
    if ("data_inicio" in patch && before && (patch.data_inicio ?? null) !== (before.data_inicio ?? null)) msgs.push(patch.data_inicio ? `definiu o início para ${fmtBR(patch.data_inicio as string)}` : "removeu a data de início");
    if (Array.isArray(patch.checklist) && before) {
      const antes = new Map(((before.checklist ?? []) as Array<{ texto: string; feito: boolean }>).map((i) => [i.texto, i.feito]));
      const depois = new Map((patch.checklist as Array<{ texto: string; feito: boolean }>).map((i) => [i.texto, i.feito]));
      for (const [texto, feito] of depois) {
        if (!antes.has(texto)) msgs.push(`adicionou "${texto}" ao checklist`);
        else if (antes.get(texto) !== feito) msgs.push(feito ? `marcou "${texto}" como feito` : `desmarcou "${texto}"`);
      }
      for (const [texto] of antes) if (!depois.has(texto)) msgs.push(`removeu "${texto}" do checklist`);
      if (msgs.length) acao = "checklist";
    }
    if (Array.isArray(patch.etiquetas) && before) {
      const antes = new Set((before.etiquetas ?? []) as string[]);
      const depois = new Set(patch.etiquetas as string[]);
      for (const t of depois) if (!antes.has(t)) msgs.push(`adicionou a etiqueta "${t}"`);
      for (const t of antes) if (!depois.has(t)) msgs.push(`removeu a etiqueta "${t}"`);
    }
    if ("vinculo_rotulo" in patch && before && (patch.vinculo_rotulo ?? null) !== (before.vinculo_rotulo ?? null)) msgs.push(patch.vinculo_rotulo ? `vinculou a "${patch.vinculo_rotulo}"` : "removeu o vínculo");
    if (typeof body.concluida === "boolean" && before && body.concluida !== before.concluida) { acao = body.concluida ? "tarefa_concluida" : "tarefa_reaberta"; msgs.push(body.concluida ? "concluiu a tarefa" : "reabriu a tarefa"); }
    if (body.arquivar === true) { acao = "tarefa_arquivada"; msgs.push("arquivou a tarefa"); }
    if (msgs.length) {
      const auditError = await log(auth, acao, msgs.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join("; ") + ".", projId, taskId);
      if (auditError) return falhaProjetosParcial(auditError, "auditar_tarefa_atualizada");
    }
    return Response.json({ success: true });
  }

  if (action === "moveTask") {
    const taskId = clean(body.taskId, 60);
    const colunaId = clean(body.colunaId, 60);
    if (!taskId || !colunaId) return Response.json({ error: "Movimentação inválida." }, { status: 422 });
    const { data: col, error: colError } = await auth.supabase.from("projeto_colunas").select("id,nome,limite,projeto_id").eq("id", colunaId).maybeSingle();
    if (colError) return falhaProjetos(colError, "carregar_coluna_destino");
    if (!col) return Response.json({ error: "Coluna não encontrada." }, { status: 404 });
    if (col.limite) {
      const { count, error: countError } = await auth.supabase.from("projeto_tarefas").select("id", { count: "exact", head: true }).eq("coluna_id", colunaId).eq("arquivada", false);
      if (countError) return falhaProjetos(countError, "contar_limite_coluna");
      if ((count ?? 0) >= col.limite) return Response.json({ error: `A coluna "${col.nome}" atingiu o limite de ${col.limite} tarefas.` }, { status: 409 });
    }
    const { data: last, error: lastError } = await auth.supabase.from("projeto_tarefas").select("ordem").eq("coluna_id", colunaId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    if (lastError) return falhaProjetos(lastError, "carregar_ordem_destino");
    const done = /conclu/i.test(col.nome);
    const { data: moved, error } = await auth.supabase.from("projeto_tarefas").update({ coluna_id: colunaId, ordem: Number(last?.ordem ?? 0) + 1000, concluida: done, concluida_em: done ? new Date().toISOString() : null } as never).eq("id", taskId).select("titulo,projeto_id").single();
    if (error) return falhaProjetos(error, "mover_tarefa");
    if (!moved) return Response.json({ error: "Tarefa não encontrada ou sem permissão." }, { status: 404 });
    const auditError = await log(auth, "tarefa_movida", `Tarefa "${moved.titulo}" movida para "${col.nome}".`, col.projeto_id, taskId);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_tarefa_movida");
    return Response.json({ success: true });
  }

  if (action === "deleteTask") {
    const taskId = clean(body.taskId, 60);
    if (!taskId) return Response.json({ error: "Tarefa inválida." }, { status: 422 });
    const { data: before, error: beforeError } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo").eq("id", taskId).maybeSingle();
    if (beforeError) return falhaProjetos(beforeError, "carregar_tarefa_exclusao");
    if (!before) return Response.json({ error: "Tarefa não encontrada ou sem permissão." }, { status: 404 });
    const { data: removida, error } = await auth.supabase.from("projeto_tarefas").delete().eq("id", taskId).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "excluir_tarefa");
    if (!removida) return Response.json({ error: "Tarefa não encontrada ou sem permissão." }, { status: 404 });
    const auditError = await log(auth, "tarefa_excluida", `Tarefa "${before.titulo}" excluída.`, before.projeto_id, taskId);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_tarefa_excluida");
    return Response.json({ success: true });
  }

  if (action === "duplicateTask") {
    const taskId = clean(body.taskId, 60);
    if (!taskId) return Response.json({ error: "Tarefa inválida." }, { status: 422 });
    const { data: src, error: srcError } = await auth.supabase.from("projeto_tarefas").select("*").eq("id", taskId).maybeSingle();
    if (srcError) return falhaProjetos(srcError, "carregar_tarefa_duplicacao");
    if (!src) return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
    const { data: duplicada, error } = await auth.supabase.from("projeto_tarefas").insert({
      projeto_id: src.projeto_id, coluna_id: src.coluna_id, titulo: `${src.titulo} (cópia)`, descricao: src.descricao,
      prioridade: src.prioridade, responsavel_id: src.responsavel_id, prazo: src.prazo, ordem: Number(src.ordem) + 1,
      etiquetas: src.etiquetas, checklist: src.checklist, vinculo_tipo: src.vinculo_tipo, vinculo_id: src.vinculo_id, vinculo_rotulo: src.vinculo_rotulo, criado_por: auth.user.id,
    } as never).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "duplicar_tarefa");
    if (!duplicada) return falhaProjetos(null, "confirmar_tarefa_duplicada");
    const auditError = await log(auth, "tarefa_duplicada", `Tarefa "${src.titulo}" duplicada.`, src.projeto_id, duplicada.id);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_tarefa_duplicada");
    return Response.json({ success: true });
  }

  if (action === "iaCriarTarefas") {
    const projectId = clean(body.projectId, 60);
    const texto = clean(body.texto, 4000);
    if (!projectId || texto.length < 8) return Response.json({ error: "Escreva a ideia ou demanda com um pouco mais de detalhe." }, { status: 422 });
    const { data: ia, error: iaErr } = await auth.supabase.functions.invoke("ia-router", { body: { agente_slug: "criador-tarefas", input: texto } });
    if (iaErr) return falhaProjetos(iaErr, "gerar_tarefas_ia");
    const r = (ia ?? {}) as { ok?: boolean; reason?: string; saida?: unknown; resposta?: string };
    if (!r.ok) return Response.json({
      error: r.reason === "sem_chave" ? "A IA ainda não está configurada para Projetos." : "A IA não concluiu a estruturação das tarefas.",
      erro: "falha_integracao",
    }, { status: 502 });
    let payload: unknown = r.saida;
    if (typeof payload === "string") { const s = payload.replace(/```json|```/g, "").trim(); try { payload = JSON.parse(s); } catch { payload = null; } }
    let lista = Array.isArray(payload) ? payload : (payload as { tarefas?: unknown[] } | null)?.tarefas;
    if (!Array.isArray(lista) || !lista.length) {
      const m = String(r.resposta || "").replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      if (m) { try { lista = (JSON.parse(m[0]) as { tarefas?: unknown[] })?.tarefas; } catch { /* segue */ } }
    }
    if (!Array.isArray(lista) || !lista.length) return Response.json({ error: "A IA não conseguiu estruturar tarefas a partir desse texto. Tente detalhar mais." }, { status: 502 });
    const { data: col, error: colError } = await auth.supabase.from("projeto_colunas").select("id,nome").eq("projeto_id", projectId).eq("arquivada", false).order("ordem", { ascending: true }).limit(1).maybeSingle();
    if (colError) return falhaProjetos(colError, "carregar_coluna_tarefas_ia");
    if (!col) return Response.json({ error: "O projeto não tem colunas." }, { status: 422 });
    const { data: last, error: lastError } = await auth.supabase.from("projeto_tarefas").select("ordem").eq("coluna_id", col.id).order("ordem", { ascending: false }).limit(1).maybeSingle();
    if (lastError) return falhaProjetos(lastError, "carregar_ordem_tarefas_ia");
    let ordem = Number(last?.ordem ?? 0) + 1000;
    const criadas: string[] = [];
    let insertError: ProjectsError = null;
    for (const item of (lista as Array<Record<string, unknown>>).slice(0, 8)) {
      const titulo = clean(item.titulo, 200);
      if (!titulo) continue;
      const prio = ["baixa", "media", "alta", "urgente"].includes(String(item.prioridade)) ? String(item.prioridade) : "media";
      const etiquetas = Array.isArray(item.etiquetas) ? (item.etiquetas as unknown[]).map((v) => clean(v, 40)).filter(Boolean).slice(0, 4) : [];
      const checklist = Array.isArray(item.checklist) ? (item.checklist as Array<Record<string, unknown>>).map((i) => ({ texto: clean(i?.texto, 200), feito: false })).filter((i) => i.texto).slice(0, 8) : [];
      const prazo = /^\d{4}-\d{2}-\d{2}$/.test(String(item.prazo ?? "")) ? String(item.prazo) : null;
      const { data: criada, error } = await auth.supabase.from("projeto_tarefas").insert({
        projeto_id: projectId, coluna_id: col.id, titulo, descricao: cleanOrNull(item.descricao, 4000),
        prioridade: prio, responsavel_id: auth.user.id, prazo, ordem, etiquetas, checklist, criado_por: auth.user.id,
      } as never).select("id").maybeSingle();
      if (error || !criada) { insertError = error ?? { code: "confirmacao_ausente" }; break; }
      criadas.push(titulo); ordem += 1000;
    }
    if (insertError) return criadas.length
      ? falhaProjetosParcial(insertError, "criar_tarefas_ia")
      : falhaProjetos(insertError, "criar_tarefas_ia");
    if (!criadas.length) return Response.json({ error: "A IA não devolveu nenhuma tarefa válida para gravar." }, { status: 422 });
    const auditError = await log(auth, "tarefas_ia", `IA criou ${criadas.length} tarefa(s) em "${col.nome}": ${criadas.join(" · ")}.`, projectId, null);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_tarefas_ia");
    return Response.json({ success: true, criadas, coluna: col.nome });
  }

  if (action === "addAnexoTarefa") {
    const taskId = clean(body.taskId, 60);
    const nome = clean(body.nome, 200);
    const path = clean(body.path, 400);
    if (!taskId || !nome || !path) return Response.json({ error: "Anexo inválido." }, { status: 422 });
    const { data: anexo, error } = await auth.supabase.from("projeto_anexos").insert({ tarefa_id: taskId, nome, path, mime: cleanOrNull(body.mime, 100), tamanho: Number.isFinite(Number(body.tamanho)) ? Number(body.tamanho) : null, criado_por: auth.user.id } as never).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "adicionar_anexo");
    if (!anexo) return falhaProjetos(null, "confirmar_anexo_adicionado");
    const { data: t, error: taskError } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo").eq("id", taskId).maybeSingle();
    if (taskError || !t) return falhaProjetosParcial(taskError, "carregar_tarefa_anexo");
    const auditError = await log(auth, "anexo_adicionado", `Anexo "${nome}" adicionado em "${t.titulo}".`, t.projeto_id, taskId);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_anexo_adicionado");
    return Response.json({ success: true });
  }
  if (action === "removeAnexoTarefa") {
    const id = clean(body.anexoId, 60);
    if (!id) return Response.json({ error: "Anexo inválido." }, { status: 422 });
    const { data: ax, error: axError } = await auth.supabase.from("projeto_anexos").select("nome,tarefa_id").eq("id", id).maybeSingle();
    if (axError) return falhaProjetos(axError, "carregar_anexo_remocao");
    if (!ax) return Response.json({ error: "Anexo não encontrado ou sem permissão." }, { status: 404 });
    const { data: removido, error } = await auth.supabase.from("projeto_anexos").delete().eq("id", id).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "remover_anexo");
    if (!removido) return Response.json({ error: "Anexo não encontrado ou sem permissão." }, { status: 404 });
    const { data: t, error: taskError } = await auth.supabase.from("projeto_tarefas").select("projeto_id").eq("id", ax.tarefa_id).maybeSingle();
    if (taskError || !t) return falhaProjetosParcial(taskError, "carregar_tarefa_anexo_removido");
    const auditError = await log(auth, "anexo_removido", `Anexo "${ax.nome}" removido.`, t.projeto_id, ax.tarefa_id);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_anexo_removido");
    return Response.json({ success: true });
  }
  if (action === "comment") {
    const taskId = clean(body.taskId, 60);
    const texto = clean(body.texto, 2000);
    if (!taskId || !texto) return Response.json({ error: "Escreva o comentário." }, { status: 422 });
    const { data: comentario, error } = await auth.supabase.from("projeto_comentarios").insert({ tarefa_id: taskId, usuario_id: auth.user.id, texto } as never).select("id").maybeSingle();
    if (error) return falhaProjetos(error, "adicionar_comentario");
    if (!comentario) return falhaProjetos(null, "confirmar_comentario");
    const { data: t, error: taskError } = await auth.supabase.from("projeto_tarefas").select("projeto_id,titulo").eq("id", taskId).maybeSingle();
    if (taskError || !t) return falhaProjetosParcial(taskError, "carregar_tarefa_comentario");
    const auditError = await log(auth, "comentario", `Comentário em "${t.titulo}".`, t.projeto_id, taskId);
    if (auditError) return falhaProjetosParcial(auditError, "auditar_comentario");
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
