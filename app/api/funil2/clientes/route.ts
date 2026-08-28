import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { accessCan, denyIfCannot, resolveEffectiveAccess } from "../../../lib/supabase/authz";

export const dynamic = "force-dynamic";

function tokenDe(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function autenticar(request: Request) {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) } as const;
  const db = createServerSupabaseClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) } as const;
  return { db, user: data.user, erro: null } as const;
}

function texto(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function inteiro(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function statusBanco(error: { code?: string; message?: string } | null | undefined) {
  if (error?.code === "42501" || /permission|policy|not allowed|acesso negado/i.test(error?.message ?? "")) return 403;
  if (error?.code === "23505" || /duplicate|unique/i.test(error?.message ?? "")) return 409;
  if (["23502", "23514", "22001", "22P02"].includes(error?.code ?? "")) return 422;
  return 502;
}

function emailNormalizado(value: unknown) {
  return texto(value, 180).toLocaleLowerCase("pt-BR");
}

function documentoNormalizado(value: unknown) {
  return texto(value, 24).replace(/\D/g, "");
}

function documentoValido(value: string) {
  if (!value) return true;
  if (![11, 14].includes(value.length) || /^(\d)\1+$/.test(value)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((total, peso, index) => total + Number(base[index]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (value.length === 11) {
    const d1 = digito(value, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = digito(value, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return Number(value[9]) === d1 && Number(value[10]) === d2;
  }
  const d1 = digito(value, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(value, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(value[12]) === d1 && Number(value[13]) === d2;
}

function valorExtra(extras: unknown, chave: string) {
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) return "";
  const valor = (extras as Record<string, unknown>)[chave];
  return typeof valor === "string" ? valor.trim() : "";
}

function enderecoDoLead(extras: unknown) {
  const partes: string[] = [];
  for (const chave of ["endereco", "numero", "complemento", "bairro", "cidade", "estado", "cep"]) {
    const valor = valorExtra(extras, chave);
    if (!valor) continue;
    const acumulado = partes.join(", ").toLocaleLowerCase("pt-BR");
    if (!acumulado.includes(valor.toLocaleLowerCase("pt-BR"))) partes.push(valor);
  }
  return partes.join(", ");
}

async function telefoneNormalizado(db: ReturnType<typeof createServerSupabaseClient>, value: unknown) {
  const digitado = texto(value, 40);
  if (!digitado) return { telefone: null, error: null };
  const { data, error } = await db.rpc("telefone_br_normalizado", { p_tel: digitado });
  return { telefone: typeof data === "string" && data ? data : null, error };
}

async function duplicidade(db: ReturnType<typeof createServerSupabaseClient>, valores: { telefone: string | null; email: string; cpf_cnpj: string }, ignorarId?: number | null) {
  const [porTelefone, porEmail, porDocumento] = await Promise.all([
    valores.telefone ? db.rpc("wa_match_lead", { p_tel: valores.telefone }) : Promise.resolve({ data: null, error: null }),
    valores.email ? db.from("leads").select("id,nome,telefone,email").ilike("email", valores.email).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
    valores.cpf_cnpj ? db.from("leads").select("id,nome,telefone,email").contains("extras", { cpf_cnpj: valores.cpf_cnpj }).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const erro = porTelefone.error ?? porEmail.error ?? porDocumento.error;
  if (erro) return { erro, lead: null };
  const telefoneId = typeof porTelefone.data === "number" ? porTelefone.data : null;
  const id = [telefoneId, porEmail.data?.id, porDocumento.data?.id]
    .map((valor) => valor == null ? null : Number(valor))
    .find((valor): valor is number => valor !== null && Number.isSafeInteger(valor) && valor > 0 && valor !== ignorarId) ?? null;
  if (!id) return { erro: null, lead: null };
  const { data: lead, error } = await db.from("leads").select("id,nome,telefone,email").eq("id", id).maybeSingle();
  return { erro: error, lead };
}

async function cardDoLead(db: ReturnType<typeof createServerSupabaseClient>, leadId: number) {
  const { data: negocios, error } = await db.from("negocios").select("id").eq("lead_id", leadId).order("criado_em", { ascending: false }).limit(10);
  if (error) return { error, negocioId: null, funilLeadId: null };
  const ids = (negocios ?? []).map((item) => Number(item.id)).filter(Number.isSafeInteger);
  if (!ids.length) return { error: null, negocioId: null, funilLeadId: null };
  const { data: card, error: cardError } = await db.from("f2_lead").select("id,origem_negocio_id").in("origem_negocio_id", ids).is("descartado_em", null).limit(1).maybeSingle();
  return { error: cardError, negocioId: card?.origem_negocio_id ? Number(card.origem_negocio_id) : ids[0], funilLeadId: card?.id ? String(card.id) : null };
}

async function escopoDeCorretor(db: ReturnType<typeof createServerSupabaseClient>, userId: string) {
  const [{ data: proprio }, { data: equipe, error }] = await Promise.all([
    db.from("corretores").select("id,nome").eq("usuario_id", userId).eq("ativo", true).maybeSingle(),
    /* Mesma fonte canônica já usada por Agenda, Chat e Esteira. Ela aplica o
       escopo do usuário no banco e não depende dos agregados de performance. */
    db.rpc("listar_corretores_transferencia"),
  ]);
  if (error) return { error, proprio: proprio ?? null, equipe: [] as Array<{ corretor_id: number; nome: string; is_self: boolean }> };
  const vistos = new Map<number, { corretor_id: number; nome: string; is_self: boolean }>();
  for (const item of equipe ?? []) vistos.set(Number(item.id), { corretor_id: Number(item.id), nome: String(item.nome), is_self: Number(item.id) === Number(proprio?.id) });
  if (proprio) vistos.set(Number(proprio.id), { corretor_id: Number(proprio.id), nome: String(proprio.nome), is_self: true });
  return { error: null, proprio: proprio ?? null, equipe: [...vistos.values()] };
}

export async function GET(request: Request) {
  const auth = await autenticar(request);
  if (auth.erro) return auth.erro;
  const url = new URL(request.url);
  const modo = url.searchParams.get("modo") ?? "opcoes";
  const access = await resolveEffectiveAccess(auth.db, auth.user.id);
  const denied = denyIfCannot(access, [["leads", "criar"], ["crm", "criar"]], "Você não tem permissão para adicionar clientes.");

  if (modo === "opcoes") {
    if (denied) return denied;
    const escopo = await escopoDeCorretor(auth.db, auth.user.id);
    if (escopo.error) return Response.json({ error: "Não foi possível carregar os responsáveis permitidos." }, { status: statusBanco(escopo.error) });
    const podeEscolher = ["admin", "gestor", "executivo", "diretor", "gerente", "gestor_comercial", "gestor_equipe"].includes(access.role)
      || accessCan(access, "crm", "atribuir") || accessCan(access, "crm", "transferir");
    return Response.json({ corretores: podeEscolher ? escopo.equipe : escopo.equipe.filter((item) => item.is_self), corretorProprioId: escopo.proprio?.id ?? null, podeEscolher });
  }

  if (modo === "duplicidade") {
    if (denied) return denied;
    const email = emailNormalizado(url.searchParams.get("email"));
    const cpf_cnpj = documentoNormalizado(url.searchParams.get("cpfCnpj"));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 422 });
    if (!documentoValido(cpf_cnpj)) return Response.json({ error: "CPF/CNPJ inválido." }, { status: 422 });
    const normalizado = await telefoneNormalizado(auth.db, url.searchParams.get("telefone"));
    if (normalizado.error || (url.searchParams.get("telefone") && !normalizado.telefone)) return Response.json({ error: "Telefone inválido." }, { status: 422 });
    const encontrado = await duplicidade(auth.db, { telefone: normalizado.telefone, email, cpf_cnpj });
    if (encontrado.erro) return Response.json({ error: "Não foi possível verificar duplicidade." }, { status: statusBanco(encontrado.erro) });
    if (!encontrado.lead) return Response.json({ duplicado: false });
    const card = await cardDoLead(auth.db, Number(encontrado.lead.id));
    return Response.json({ duplicado: true, lead: encontrado.lead, funilLeadId: card.funilLeadId });
  }

  if (modo === "reconciliar") {
    const leadId = inteiro(url.searchParams.get("leadId"));
    if (!leadId) return Response.json({ error: "Cliente inválido." }, { status: 422 });
    const { data: lead, error } = await auth.db.from("leads").select("id,nome").eq("id", leadId).maybeSingle();
    if (error) return Response.json({ error: "Não foi possível reler o cliente." }, { status: statusBanco(error) });
    if (!lead) return Response.json({ error: "Cliente não encontrado ou fora do seu acesso." }, { status: 404 });
    const card = await cardDoLead(auth.db, leadId);
    if (card.error) return Response.json({ error: "Não foi possível confirmar a entrada no Funil." }, { status: statusBanco(card.error) });
    return Response.json({ conciliado: Boolean(card.funilLeadId), leadId, negocioId: card.negocioId, funilLeadId: card.funilLeadId });
  }

  return Response.json({ error: "Consulta desconhecida." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const auth = await autenticar(request);
  if (auth.erro) return auth.erro;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (body.action !== "atualizar") return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  const access = await resolveEffectiveAccess(auth.db, auth.user.id);
  const denied = denyIfCannot(access, [["leads", "editar"], ["crm", "editar"]], "Você não tem permissão para editar este cliente.");
  if (denied) return denied;
  const f2LeadId = texto(body.f2LeadId, 40);
  if (!/^[0-9a-f-]{36}$/i.test(f2LeadId)) return Response.json({ error: "Lead inválido." }, { status: 422 });
  const { data: card, error: cardError } = await auth.db.from("f2_lead").select("origem_negocio_id").eq("id", f2LeadId).maybeSingle();
  if (cardError) return Response.json({ error: "Não foi possível validar o atendimento." }, { status: statusBanco(cardError) });
  if (!card) return Response.json({ error: "Lead não encontrado ou fora do seu acesso." }, { status: 404 });
  const { data: negocio, error: negocioError } = await auth.db.from("negocios").select("lead_id").eq("id", card.origem_negocio_id).maybeSingle();
  if (negocioError) return Response.json({ error: "Não foi possível validar o negócio de origem." }, { status: statusBanco(negocioError) });
  if (!negocio) return Response.json({ error: "Negócio de origem indisponível." }, { status: 404 });

  const leadId = Number(negocio.lead_id);
  const { data: atual, error: atualError } = await auth.db.from("leads").select("id,nome,telefone,email,origem,corretor_id,extras,atualizado_em").eq("id", leadId).maybeSingle();
  if (atualError) return Response.json({ error: "Não foi possível reler os dados atuais." }, { status: statusBanco(atualError) });
  if (!atual) return Response.json({ error: "Cliente não encontrado ou fora do seu acesso." }, { status: 404 });
  const expectedUpdatedAt = body.expectedUpdatedAt === null ? null : texto(body.expectedUpdatedAt, 60);
  if ((atual.atualizado_em ?? null) !== expectedUpdatedAt) return Response.json({
    error: "Este cliente foi alterado em outra sessão. Revise os dados atuais antes de salvar.",
    atual: {
      nome: atual.nome ?? "",
      telefone: atual.telefone ?? "",
      email: atual.email ?? "",
      cpf_cnpj: valorExtra(atual.extras, "cpf_cnpj") || valorExtra(atual.extras, "cpf"),
      endereco: enderecoDoLead(atual.extras),
      atualizado_em: atual.atualizado_em ?? null,
    },
  }, { status: 409 });

  const nome = texto(body.nome, 160);
  const email = emailNormalizado(body.email);
  const cpf_cnpj = documentoNormalizado(body.cpfCnpj);
  const endereco = texto(body.endereco, 300);
  if (!nome || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !documentoValido(cpf_cnpj)) return Response.json({ error: "Revise nome, e-mail e CPF/CNPJ." }, { status: 422 });
  const normalizado = await telefoneNormalizado(auth.db, body.telefone);
  if (normalizado.error || (body.telefone && !normalizado.telefone)) return Response.json({ error: "Telefone inválido." }, { status: 422 });
  if (!normalizado.telefone && !email) return Response.json({ error: "Informe telefone ou e-mail." }, { status: 422 });
  const repetido = await duplicidade(auth.db, { telefone: normalizado.telefone, email, cpf_cnpj }, leadId);
  if (repetido.erro) return Response.json({ error: "Não foi possível validar duplicidade." }, { status: statusBanco(repetido.erro) });
  if (repetido.lead) return Response.json({ error: "Já existe outro cliente com esse telefone, e-mail ou CPF/CNPJ.", duplicado: repetido.lead }, { status: 409 });

  const extras = atual.extras && typeof atual.extras === "object" && !Array.isArray(atual.extras) ? { ...atual.extras as Record<string, unknown> } : {};
  if (cpf_cnpj) extras.cpf_cnpj = cpf_cnpj; else delete extras.cpf_cnpj;
  if (endereco) extras.endereco = endereco; else delete extras.endereco;
  const atualizado_em = new Date().toISOString();
  let query = auth.db.from("leads").update({ nome, telefone: normalizado.telefone, email: email || null, extras: extras as never, atualizado_em }).eq("id", leadId);
  query = expectedUpdatedAt === null ? query.is("atualizado_em", null) : query.eq("atualizado_em", expectedUpdatedAt);
  const { data: salvo, error } = await query.select("id,nome,telefone,email,origem,corretor_id,extras,atualizado_em").maybeSingle();
  if (error) return Response.json({ error: "Não foi possível salvar os dados do cliente." }, { status: statusBanco(error) });
  if (!salvo) return Response.json({ error: "Este cliente mudou enquanto você editava. Recarregue e revise antes de tentar novamente." }, { status: 409 });
  return Response.json({ ok: true, lead: { ...salvo, cpf_cnpj, endereco } });
}

export async function POST(request: Request) {
  const auth = await autenticar(request);
  if (auth.erro) return auth.erro;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (body.action !== "criar") return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  const access = await resolveEffectiveAccess(auth.db, auth.user.id);
  const denied = denyIfCannot(access, [["leads", "criar"], ["crm", "criar"]], "Você não tem permissão para adicionar clientes.");
  if (denied) return denied;

  const nome = texto(body.nome, 160);
  const email = emailNormalizado(body.email);
  const cpf_cnpj = documentoNormalizado(body.cpfCnpj);
  const endereco = texto(body.endereco, 300);
  const idempotencyKey = texto(body.idempotencyKey, 60);
  if (!nome || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return Response.json({ error: "Informe o nome e reinicie o formulário se necessário." }, { status: 422 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "E-mail inválido." }, { status: 422 });
  if (!documentoValido(cpf_cnpj)) return Response.json({ error: "CPF/CNPJ inválido." }, { status: 422 });
  const normalizado = await telefoneNormalizado(auth.db, body.telefone);
  if (normalizado.error || (body.telefone && !normalizado.telefone)) return Response.json({ error: "Telefone inválido." }, { status: 422 });
  if (!normalizado.telefone && !email) return Response.json({ error: "Informe telefone ou e-mail." }, { status: 422 });

  const repetido = await duplicidade(auth.db, { telefone: normalizado.telefone, email, cpf_cnpj });
  if (repetido.erro) return Response.json({ error: "Não foi possível validar duplicidade." }, { status: statusBanco(repetido.erro) });
  if (repetido.lead) {
    const card = await cardDoLead(auth.db, Number(repetido.lead.id));
    return Response.json({ error: "Este cliente já existe. Abra a ficha existente em vez de duplicar.", duplicado: repetido.lead, funilLeadId: card.funilLeadId }, { status: 409 });
  }

  const escopo = await escopoDeCorretor(auth.db, auth.user.id);
  if (escopo.error) return Response.json({ error: "Não foi possível validar o responsável." }, { status: statusBanco(escopo.error) });
  const podeEscolher = ["admin", "gestor", "executivo", "diretor", "gerente", "gestor_comercial", "gestor_equipe"].includes(access.role)
    || accessCan(access, "crm", "atribuir") || accessCan(access, "crm", "transferir");
  const solicitado = inteiro(body.corretorId);
  const brokerId = podeEscolher ? solicitado : escopo.proprio?.id ?? null;
  if (!brokerId || !escopo.equipe.some((item) => item.corretor_id === brokerId)) return Response.json({ error: "Escolha um responsável permitido da sua equipe." }, { status: 403 });

  const { data: pipeline, error: pipelineError } = await auth.db.from("pipelines").select("id").eq("nome", "Funil 2.0").maybeSingle();
  if (pipelineError) return Response.json({ error: "Não foi possível localizar o Funil canônico." }, { status: statusBanco(pipelineError) });
  if (!pipeline) return Response.json({ error: "O Funil canônico não está disponível. Nenhum cliente foi criado." }, { status: 409 });
  const { data: primeiraEtapa, error: etapaError } = await auth.db.from("pipeline_stages").select("id,chave").eq("pipeline_id", pipeline.id).order("ordem").limit(1).maybeSingle();
  if (etapaError || !primeiraEtapa) return Response.json({ error: "O Funil não possui etapa inicial disponível. Nenhum cliente foi criado." }, { status: etapaError ? statusBanco(etapaError) : 409 });

  const { data: recuperado, error: recuperarError } = await auth.db.from("leads").select("id").contains("extras", { crm_manual_idempotency: idempotencyKey }).limit(1).maybeSingle();
  if (recuperarError) return Response.json({ error: "Não foi possível validar a repetição do cadastro." }, { status: statusBanco(recuperarError) });
  let leadId = recuperado?.id ? Number(recuperado.id) : null;
  if (!leadId) {
    const extras: Record<string, unknown> = { crm_manual_idempotency: idempotencyKey };
    if (cpf_cnpj) extras.cpf_cnpj = cpf_cnpj;
    if (endereco) extras.endereco = endereco;
    const { data: lead, error } = await auth.db.from("leads").insert({ nome, telefone: normalizado.telefone, email: email || null, origem: "manual", pipeline_id: pipeline.id, corretor_id: brokerId, status: "novo", tags: [], extras: extras as never, atualizado_em: new Date().toISOString() }).select("id").single();
    if (error || !lead) return Response.json({ error: "Não foi possível criar o cliente." }, { status: statusBanco(error) });
    leadId = Number(lead.id);
  }

  const { data: negocioExistente, error: negocioBuscaError } = await auth.db.from("negocios").select("id").eq("lead_id", leadId).eq("pipeline_id", pipeline.id).eq("status", "aberto").order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (negocioBuscaError) return Response.json({ error: "Cliente salvo, mas a entrada no Funil precisa ser reconciliada.", leadId, reconciliacaoNecessaria: true }, { status: statusBanco(negocioBuscaError) });
  let negocioId = negocioExistente?.id ? Number(negocioExistente.id) : null;
  if (!negocioId) {
    const { data: negocio, error } = await auth.db.from("negocios").insert({ lead_id: leadId, pipeline_id: pipeline.id, stage_id: primeiraEtapa.id, corretor_id: brokerId, status: "aberto", estagio_desde: new Date().toISOString(), ultima_movimentacao: new Date().toISOString() }).select("id").single();
    if (error || !negocio) return Response.json({ error: "Cliente salvo, mas a entrada no Funil precisa ser reconciliada.", leadId, reconciliacaoNecessaria: true }, { status: statusBanco(error) });
    negocioId = Number(negocio.id);
  }

  const card = await cardDoLead(auth.db, leadId);
  if (card.error) return Response.json({ error: "Cliente salvo, mas a entrada no Funil ainda não foi confirmada.", leadId, negocioId, reconciliacaoNecessaria: true }, { status: statusBanco(card.error) });
  if (!card.funilLeadId) return Response.json({ ok: true, conciliando: true, leadId, negocioId, etapaInicial: primeiraEtapa.chave ?? null }, { status: 202 });
  return Response.json({ ok: true, conciliando: false, leadId, negocioId, funilLeadId: card.funilLeadId });
}
