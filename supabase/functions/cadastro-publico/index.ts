import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.110.2";
import {
  candidatosToken,
  normalizarEmail,
  papelAutocadastroValido,
  problemaSenha,
} from "../_shared/convites-policy.mjs";
import { json, originAllowed, preflight } from "../_shared/edge-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Invite = {
  id: string;
  role: string;
  criado_por: string | null;
  criado_por_nome: string | null;
  expira_em: string;
  usado_em: string | null;
};

async function findInvite(rawToken: unknown): Promise<Invite | null> {
  const candidates = await candidatosToken(rawToken);
  for (const token of candidates) {
    const { data, error } = await admin.from("cadastro_convites")
      .select("id,role,criado_por,criado_por_nome,expira_em,usado_em")
      .eq("token", token)
      .maybeSingle();
    if (!error && data) return data as Invite;
  }
  return null;
}

function inviteState(invite: Invite | null) {
  if (!invite || !papelAutocadastroValido(invite.role)) return "invalido";
  if (invite.usado_em) return "usado";
  if (!Number.isFinite(Date.parse(invite.expira_em)) || Date.parse(invite.expira_em) <= Date.now()) return "expirado";
  return null;
}

async function reserveInvite(invite: Invite) {
  const reservedAt = new Date().toISOString();
  const { data, error } = await admin.from("cadastro_convites")
    .update({ usado_em: reservedAt })
    .eq("id", invite.id)
    .is("usado_em", null)
    .gt("expira_em", reservedAt)
    .select("id")
    .maybeSingle();
  return error || !data ? null : reservedAt;
}

async function releaseInvite(inviteId: string, reservedAt: string) {
  await admin.from("cadastro_convites")
    .update({ usado_em: null, usado_email: null, usado_usuario_id: null })
    .eq("id", inviteId)
    .eq("usado_em", reservedAt)
    .is("usado_usuario_id", null)
    .then(() => undefined, () => undefined);
}

async function rollbackUser(userId: string, brokerId?: number | null) {
  if (brokerId) await admin.from("corretores").delete().eq("id", brokerId).then(() => undefined, () => undefined);
  await admin.from("usuarios").delete().eq("id", userId).then(() => undefined, () => undefined);
  await admin.auth.admin.deleteUser(userId).then(() => undefined, () => undefined);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return preflight(request);
  if (!originAllowed(request)) return json(request, { ok: false, motivo: "origem_nao_permitida" }, 403);
  if (request.method !== "POST") return json(request, { ok: false, motivo: "metodo_nao_permitido" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(request, { ok: false, motivo: "servico_indisponivel" }, 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json(request, { ok: false, motivo: "json_invalido" }, 400);
  const action = String(body.action ?? "");
  const invite = await findInvite(body.token);
  const state = inviteState(invite);

  if (action === "validar") {
    return state
      ? json(request, { ok: false, motivo: state })
      : json(request, { ok: true, role: "corretor", expiraEm: invite!.expira_em });
  }
  if (action !== "registrar") return json(request, { ok: false, motivo: "acao_desconhecida" }, 400);
  if (state || !invite) return json(request, { ok: false, motivo: state ?? "invalido" }, state === "usado" ? 409 : 422);

  const name = String(body.nome ?? "").normalize("NFKC").trim().slice(0, 160);
  const email = normalizarEmail(body.email);
  const phone = body.telefone ? String(body.telefone).trim().slice(0, 40) : null;
  const password = typeof body.senha === "string" ? body.senha : "";
  if (name.length < 2) return json(request, { ok: false, motivo: "nome_invalido" }, 422);
  if (!email) return json(request, { ok: false, motivo: "email_invalido" }, 422);
  const passwordIssue = problemaSenha(password);
  if (passwordIssue) return json(request, { ok: false, motivo: passwordIssue }, 422);

  const reservedAt = await reserveInvite(invite);
  if (!reservedAt) return json(request, { ok: false, motivo: "usado" }, 409);
  const { data: existing } = await admin.from("usuarios").select("id").ilike("email", email).maybeSingle();
  if (existing) {
    await releaseInvite(invite.id, reservedAt);
    return json(request, { ok: false, motivo: "email_ja_cadastrado" }, 409);
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: name },
  });
  if (authError || !created.user) {
    await releaseInvite(invite.id, reservedAt);
    const code = String((authError as { code?: string } | null)?.code ?? "");
    return json(request, { ok: false, motivo: /exists|registered/i.test(code) ? "email_ja_cadastrado" : "falha_auth" }, /exists|registered/i.test(code) ? 409 : 502);
  }
  const userId = created.user.id;
  const { error: profileError } = await admin.from("usuarios").insert({
    id: userId,
    nome: name,
    role: "corretor",
    ativo: true,
    email,
    telefone: phone,
    superior_id: null,
    permissoes: null,
  });
  if (profileError) {
    await rollbackUser(userId);
    await releaseInvite(invite.id, reservedAt);
    return json(request, { ok: false, motivo: "falha_perfil" }, 502);
  }

  const { data: maxOrder } = await admin.from("corretores").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { data: broker, error: brokerError } = await admin.from("corretores").insert({
    nome: name,
    email,
    telefone: phone,
    usuario_id: userId,
    ordem: Number(maxOrder?.ordem ?? 0) + 1,
  }).select("id").single();
  if (brokerError || !broker) {
    await rollbackUser(userId);
    await releaseInvite(invite.id, reservedAt);
    return json(request, { ok: false, motivo: "falha_corretor" }, 502);
  }

  const { error: finishError } = await admin.from("cadastro_convites")
    .update({ usado_email: email, usado_usuario_id: userId })
    .eq("id", invite.id)
    .eq("usado_em", reservedAt);
  if (finishError) {
    await rollbackUser(userId, broker.id);
    await releaseInvite(invite.id, reservedAt);
    return json(request, { ok: false, motivo: "falha_convite" }, 502);
  }

  await admin.from("erp_auditoria").insert({
    usuario_id: invite.criado_por,
    usuario_nome: invite.criado_por_nome ?? "Convite por link",
    acao: "autocadastro_por_link",
    modulo: "Usuários",
    entidade: "usuario",
    entidade_id: userId,
    depois: { role: "corretor", corretorId: broker.id, conviteId: invite.id },
    detalhe: "autocadastro_por_link",
  }).then(() => undefined, () => undefined);

  return json(request, { ok: true, usuarioId: userId, corretorId: broker.id });
});
