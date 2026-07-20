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

const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const phoneNumber = (value: unknown) => text(value, 40).replace(/\D/g, "");
const idKey = (value: unknown) => value == null ? "" : String(value);

function phoneKeys(value: unknown) {
  const digits = phoneNumber(value);
  if (!digits) return [];
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const keys = new Set([digits, local, digits.slice(-11)]);
  if (local.length === 11 && local[2] === "9") keys.add(`${local.slice(0, 2)}${local.slice(3)}`);
  if (local.length === 10) keys.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  return [...keys].filter((key) => key.length >= 10);
}

function providerError(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const result = data as Record<string, unknown>;
  return result.error ? text(result.error, 400) || "O provedor recusou o envio." : null;
}

function mediaKind(mime: string) {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

function delayMilliseconds(options: Record<string, unknown>) {
  const value = Math.max(0, Number(options.valor) || 0);
  const unit = text(options.unidade, 30).toLowerCase();
  if (unit.startsWith("seg")) return value * 1000;
  if (unit.startsWith("hora")) return value * 3_600_000;
  if (unit.startsWith("dia")) return value * 86_400_000;
  return value * 60_000;
}

type AuthContext = NonNullable<Awaited<ReturnType<typeof authClient>>>;

async function canUseInstance(auth: AuthContext, instanceId: number) {
  const { data, error } = await auth.supabase.from("instancias").select("id").eq("id", instanceId).maybeSingle();
  return !error && Boolean(data);
}

async function canMessagePhone(auth: AuthContext, phone: string) {
  const requested = new Set(phoneKeys(phone));
  if (!requested.size) return false;
  const { data, error } = await auth.supabase.from("leads").select("telefone").limit(5000);
  return !error && (data ?? []).some((lead) => phoneKeys(lead.telefone).some((key) => requested.has(key)));
}

export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (conversationId) {
    const { data: conversation } = await auth.supabase.from("wa_conversas").select("contato_id").eq("id", conversationId).maybeSingle();
    if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
    const { data: contact } = await auth.supabase.from("wa_contatos").select("lead_id,telefone").eq("id", conversation.contato_id).maybeSingle();
    const contactPhoneKeys = new Set(phoneKeys(contact?.telefone));
    let registeredLead = contact?.lead_id
      ? (await auth.supabase.from("leads").select("id").eq("id", contact.lead_id).maybeSingle()).data
      : null;
    if (!registeredLead && contactPhoneKeys.size) {
      const visibleLeads = (await auth.supabase.from("leads").select("id,telefone").limit(5000)).data ?? [];
      registeredLead = visibleLeads.find((lead) => phoneKeys(lead.telefone).some((key) => contactPhoneKeys.has(key))) ?? null;
    }
    if (!registeredLead) return Response.json({ error: "Esta conversa não pertence a um lead cadastrado no CRM." }, { status: 404 });
    const { data, error } = await auth.supabase.from("wa_mensagens")
      .select("id,wa_message_id,conversa_id,instancia_id,direcao,tipo,conteudo,media_url,raw,criado_em,enviado_em,status,status_detalhe")
      .eq("conversa_id", conversationId).order("criado_em").limit(600);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ messages: data ?? [] });
  }
  const [conversations, contacts, instances, messages, leads, deals, brokers, products, media, activities, approaches, stages] = await Promise.all([
    auth.supabase.from("wa_conversas").select("id,contato_id,instancia_id,status,ultima_msg_em,origem").order("ultima_msg_em", { ascending: false, nullsFirst: false }).limit(800),
    auth.supabase.from("wa_contatos").select("id,nome,telefone,lead_id"),
    auth.supabase.from("wa_instancias").select("id,session_id,rotulo,status,corretor_id"),
    auth.supabase.from("wa_mensagens").select("id,conversa_id,direcao,tipo,conteudo,media_url,criado_em").order("criado_em", { ascending: false }).limit(2500),
    auth.supabase.from("leads").select("id,nome,telefone,email,corretor_id,origem,tags"),
    auth.supabase.from("negocios").select("id,lead_id,corretor_id,stage_id,empreendimento_id,valor,status"),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("empreendimentos").select("id,nome,bairro,cidade,preco,status").order("nome"),
    auth.supabase.from("midias").select("id,empreendimento_id,nome,tipo,categoria,storage_path,is_capa").order("created_at", { ascending: false }).limit(5000),
    auth.supabase.from("crm_atividades").select("id,lead_id,tipo,texto,criado_em").eq("tipo", "observacao").order("criado_em", { ascending: false }).limit(500),
    auth.supabase.from("abordagens").select("id,nome,mensagens,produto_id").eq("ativo", true).order("ordem"),
    auth.supabase.from("pipeline_stages").select("id,nome,rotulo,ordem").order("ordem"),
  ]);
  const all = [conversations, contacts, instances, messages, leads, deals, brokers, products, media, activities, approaches, stages];
  const error = all.find((item) => item.error)?.error;
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const leadIds = new Map((leads.data ?? []).map((lead) => [idKey(lead.id), lead.id]));
  const leadByPhone = new Map<string, number>();
  for (const lead of leads.data ?? []) for (const key of phoneKeys(lead.telefone)) leadByPhone.set(key, lead.id);
  const crmContacts = (contacts.data ?? []).flatMap((contact) => {
    const linkedLeadId = leadIds.get(idKey(contact.lead_id));
    const matchedLeadId = linkedLeadId ?? phoneKeys(contact.telefone).map((key) => leadByPhone.get(key)).find(Boolean);
    return matchedLeadId ? [{ ...contact, lead_id: matchedLeadId }] : [];
  });
  const allowedContacts = new Set(crmContacts.map((contact) => idKey(contact.id)));
  const crmConversations = (conversations.data ?? []).filter((conversation) => allowedContacts.has(idKey(conversation.contato_id)));
  const allowedConversations = new Set(crmConversations.map((conversation) => idKey(conversation.id)));
  const latest = new Map<string, unknown>();
  for (const message of messages.data ?? []) {
    const conversationKey = idKey(message.conversa_id);
    if (allowedConversations.has(conversationKey) && !latest.has(conversationKey)) latest.set(conversationKey, message);
  }
  const sessions = [...new Set((instances.data ?? []).map((instance) => instance.session_id))];
  const dapi = sessions.length ? await auth.supabase.from("instancias").select("id,instancia_dapi,nome,conectada").in("instancia_dapi", sessions) : { data: [], error: null };
  return Response.json({ conversations: crmConversations, contacts: crmContacts, instances: instances.data ?? [], dapi: dapi.data ?? [], latest: Object.fromEntries(latest), leads: leads.data ?? [], deals: deals.data ?? [], brokers: brokers.data ?? [], products: products.data ?? [], media: media.data ?? [], activities: activities.data ?? [], approaches: approaches.data ?? [], stages: stages.data ?? [] });
}

async function uploadAndSend(request: Request, auth: NonNullable<Awaited<ReturnType<typeof authClient>>>) {
  const form = await request.formData();
  const file = form.get("file");
  const phone = phoneNumber(form.get("phone"));
  const instanceId = Number(form.get("instanceId"));
  const caption = text(form.get("content"), 4000);
  if (!(file instanceof File) || file.size === 0 || file.size > 50 * 1024 * 1024 || phone.length < 8 || !Number.isSafeInteger(instanceId)) {
    return Response.json({ error: "Arquivo, telefone ou instância inválidos. O limite é 50 MB." }, { status: 422 });
  }
  if (!(await canUseInstance(auth, instanceId)) || !(await canMessagePhone(auth, phone))) return Response.json({ error: "A instância ou o lead não pertence à sua carteira." }, { status: 403 });
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "arquivo";
  const path = `${auth.user.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await auth.supabase.storage.from("chat-midia").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) return Response.json({ error: uploadError.message }, { status: 502 });
  const { data: publicUrl } = auth.supabase.storage.from("chat-midia").getPublicUrl(path);
  const kind = mediaKind(file.type || "application/octet-stream");
  const payload = { telefone: phone, instancia_id: instanceId, tipo: kind, url: publicUrl.publicUrl, legenda: caption || undefined, nome_arquivo: safeName };
  const { data, error } = await auth.supabase.functions.invoke("dapi-enviar", { body: payload });
  const remoteError = providerError(data);
  if (error || remoteError) {
    await auth.supabase.storage.from("chat-midia").remove([path]);
    return Response.json({ error: remoteError || error?.message || "Não foi possível enviar a mídia." }, { status: 502 });
  }
  return Response.json({ success: true, url: publicUrl.publicUrl, type: kind, result: data });
}

export async function POST(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (request.headers.get("content-type")?.includes("multipart/form-data")) return uploadAndSend(request, auth);

  const body = await request.json() as Record<string, unknown>;
  const action = text(body.action, 40);
  const leadId = Number(body.leadId);
  const dealId = Number(body.dealId);
  if (action === "send") {
    const phone = phoneNumber(body.phone); const content = text(body.content, 4000); const instanceId = Number(body.instanceId); const mediaId = text(body.mediaId, 50);
    if (phone.length < 8 || !Number.isSafeInteger(instanceId) || (!content && !mediaId)) return Response.json({ error: "Mensagem, telefone ou instância inválidos." }, { status: 422 });
    if (!(await canUseInstance(auth, instanceId)) || !(await canMessagePhone(auth, phone))) return Response.json({ error: "A instância ou o lead não pertence à sua carteira." }, { status: 403 });
    let payload: Record<string, unknown> = { telefone: phone, instancia_id: instanceId, tipo: "texto", texto: content };
    if (mediaId) {
      const { data: media } = await auth.supabase.from("midias").select("tipo,storage_path,nome").eq("id", mediaId).maybeSingle();
      if (!media) return Response.json({ error: "Material não encontrado." }, { status: 404 });
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = `${base}/storage/v1/object/public/empreendimentos/${media.storage_path.split("/").map(encodeURIComponent).join("/")}`;
      payload = { telefone: phone, instancia_id: instanceId, tipo: media.tipo === "foto" ? "imagem" : media.tipo === "video" ? "video" : "documento", url, legenda: content, nome_arquivo: media.nome || undefined };
    }
    const { data, error } = await auth.supabase.functions.invoke("dapi-enviar", { body: payload });
    const remoteError = providerError(data);
    return error || remoteError ? Response.json({ error: remoteError || error?.message }, { status: 502 }) : Response.json({ success: true, result: data });
  }
  if (action === "schedule") {
    const phone = phoneNumber(body.phone); const content = text(body.content, 4000); const instanceId = Number(body.instanceId); const when = new Date(String(body.when));
    if (phone.length < 8 || !content || !Number.isSafeInteger(instanceId) || Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 30_000) return Response.json({ error: "Defina mensagem, instância e horário futuro válido." }, { status: 422 });
    if (!(await canUseInstance(auth, instanceId)) || !(await canMessagePhone(auth, phone))) return Response.json({ error: "A instância ou o lead não pertence à sua carteira." }, { status: 403 });
    const { error } = await auth.supabase.from("mensagens_agendadas").insert({ telefone: phone, instancia_id: instanceId, lead_id: Number.isSafeInteger(leadId) ? leadId : null, tipo: "text", texto: content, quando: when.toISOString(), status: "agendado", criado_por: auth.user.id });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, scheduled: 1 });
  }
  if (action === "sendApproach") {
    const phone = phoneNumber(body.phone); const instanceId = Number(body.instanceId); const approachId = Number(body.approachId);
    if (phone.length < 8 || !Number.isSafeInteger(instanceId) || !Number.isSafeInteger(approachId)) return Response.json({ error: "Escolha a instância e a abordagem." }, { status: 422 });
    if (!(await canUseInstance(auth, instanceId)) || !(await canMessagePhone(auth, phone))) return Response.json({ error: "A instância ou o lead não pertence à sua carteira." }, { status: 403 });
    const { data: approach, error: approachError } = await auth.supabase.from("abordagens").select("mensagens").eq("id", approachId).eq("ativo", true).maybeSingle();
    if (approachError || !approach || !Array.isArray(approach.mensagens)) return Response.json({ error: approachError?.message || "Abordagem não encontrada." }, { status: 404 });
    let cursor = Date.now() + 5_000;
    const firstName = text(body.leadName, 120).split(/\s+/)[0] || "cliente";
    const rows: Array<Record<string, unknown>> = [];
    for (const rawPart of approach.mensagens) {
      if (!rawPart || typeof rawPart !== "object") continue;
      const part = rawPart as Record<string, unknown>; const name = text(part.name, 60); const options = part.options && typeof part.options === "object" ? part.options as Record<string, unknown> : {};
      if (name === "delay") { cursor += delayMilliseconds(options); continue; }
      const common = { telefone: phone, instancia_id: instanceId, lead_id: Number.isSafeInteger(leadId) ? leadId : null, quando: new Date(cursor).toISOString(), status: "agendado", criado_por: auth.user.id };
      if (name === "send-text-message") {
        const content = text(options.text, 4000).replaceAll("{primeiro_nome}", firstName);
        if (content) rows.push({ ...common, tipo: "text", texto: content });
      } else if (name.startsWith("send-") && name.endsWith("-message")) {
        const url = text(options.url, 2000); if (!url) continue;
        const kind = name.replace("send-", "").replace("-message", "");
        rows.push({ ...common, tipo: kind, url, texto: text(options.caption, 4000) || null, file_name: text(options.filename, 200) || null, mimetype: text(options.mimetype, 120) || null });
      }
      cursor += 1_000;
    }
    if (!rows.length) return Response.json({ error: "A abordagem não possui mensagens enviáveis." }, { status: 422 });
    const { error } = await auth.supabase.from("mensagens_agendadas").insert(rows);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, scheduled: rows.length });
  }
  if (action === "note") {
    const content = text(body.content, 2000);
    if (!Number.isSafeInteger(leadId) || leadId < 1 || !content) return Response.json({ error: "Informe uma observação válida para o lead." }, { status: 422 });
    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("crm_atividades").insert({ lead_id: leadId, negocio_id: dealId || null, corretor_id: broker?.id ?? null, tipo: "observacao", texto: content, criado_por: auth.user.id });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "task" || action === "callReminder") {
    const due = new Date(String(body.due));
    const title = action === "callReminder" ? `Ligar para ${text(body.name, 120) || "cliente"}` : text(body.title, 180);
    const priority = text(body.priority, 20);
    if (!Number.isSafeInteger(leadId) || leadId < 1 || !title || Number.isNaN(due.getTime())) return Response.json({ error: "Informe o título e uma data válida." }, { status: 422 });
    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("crm_tarefas").insert({ lead_id: leadId, negocio_id: dealId || null, corretor_id: broker?.id ?? null, titulo: title, descricao: text(body.description, 500) || null, vencimento: due.toISOString(), prioridade: ["baixa", "normal", "alta"].includes(priority) ? priority : "normal", criado_por: auth.user.id, cliente_nome: text(body.name, 120) || null });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "transfer") {
    const brokerId = Number(body.brokerId);
    if (!Number.isSafeInteger(dealId) || dealId < 1 || !Number.isSafeInteger(brokerId) || brokerId < 1) return Response.json({ error: "Escolha um corretor válido." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("transferir_negocio", { p_negocio_id: dealId, p_corretor_id: brokerId });
    const result = data && typeof data === "object" ? data as Record<string, unknown> : null;
    return error || result?.ok === false ? Response.json({ error: error?.message || text(result?.error, 300) || "Não foi possível transferir o atendimento." }, { status: 502 }) : Response.json({ success: true, result: data });
  }
  if (action === "proposal") {
    const value = Number(body.value);
    if (!Number.isSafeInteger(leadId) || leadId < 1 || !Number.isSafeInteger(dealId) || dealId < 1 || !Number.isFinite(value) || value <= 0) return Response.json({ error: "Informe um valor válido para a proposta." }, { status: 422 });
    const productName = text(body.productName, 180) || "Produto do negócio";
    const conditions = text(body.conditions, 2000);
    const { error: dealError } = await auth.supabase.from("negocios").update({ valor: value, ultima_movimentacao: new Date().toISOString() }).eq("id", dealId).eq("lead_id", leadId);
    if (dealError) return Response.json({ error: dealError.message }, { status: 502 });
    const proposalText = [`Proposta para ${productName}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}.`, conditions].filter(Boolean).join(" ");
    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    const { error } = await auth.supabase.from("crm_atividades").insert({ lead_id: leadId, negocio_id: dealId, corretor_id: broker?.id ?? null, tipo: "proposta", texto: proposalText, criado_por: auth.user.id });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  if (action === "financing") {
    const value = Number(body.value); const downPayment = Number(body.downPayment) || 0; const financing = Number(body.financing);
    if (!Number.isSafeInteger(dealId) || dealId < 1 || !Number.isFinite(value) || value <= 0 || downPayment < 0 || !Number.isFinite(financing)) return Response.json({ error: "Informe valores válidos para o financiamento." }, { status: 422 });
    const { data: deal } = await auth.supabase.from("negocios").select("corretor_id").eq("id", dealId).maybeSingle();
    const { error } = await auth.supabase.from("financiamento_fichas").insert({ created_by: auth.user.id, corretor_id: deal?.corretor_id ?? null, produto: text(body.productName, 180) || null, comprador_nome: text(body.name, 160) || null, telefone: text(body.phone, 40) || null, email: text(body.email, 180) || null, valor_imovel: value, valor_entrada: downPayment, valor_financiar: financing, consentimento_lgpd: body.consent === true, status: "rascunho" });
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
