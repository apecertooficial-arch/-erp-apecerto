import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.110.2";
import { normalizarPapel, papelNoGrupo } from "../_shared/papeis.ts";
import {
  gerarTokenConvite,
  normalizarEmail,
  tokenArmazenado,
  uuidValido,
} from "../_shared/convites-policy.mjs";
import { bearer, json, originAllowed, preflight } from "../_shared/edge-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Caller = { id: string; nome: string };
type Body = Record<string, unknown>;
const ROLES_COM_CORRETOR = new Set(["corretor", "gerente", "diretor"]);
const ROLES_SUPERIORES = new Set(["admin", "diretor", "gerente"]);

async function callerAdmin(request: Request): Promise<Caller | null> {
  const token = bearer(request);
  if (!token || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  const scoped = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await scoped.auth.getUser(token);
  if (authError || !auth.user) return null;
  const { data: profile, error: profileError } = await scoped
    .from("usuarios")
    .select("id,nome,role,ativo")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile?.ativo || !papelNoGrupo(profile.role, "admin")) return null;
  return { id: profile.id, nome: profile.nome };
}

async function audit(caller: Caller, action: string, entityId: string, after: Record<string, unknown>) {
  await admin.from("erp_auditoria").insert({
    usuario_id: caller.id,
    usuario_nome: caller.nome,
    acao: action,
    modulo: "Usuários",
    entidade: "usuario",
    entidade_id: entityId,
    depois: after,
    detalhe: action,
  }).then(() => undefined, () => undefined);
}

async function invalidateOpenInvites(userId: string, now: string) {
  await admin.from("acesso_convites")
    .update({ usado_em: now })
    .eq("usuario_id", userId)
    .is("usado_em", null)
    .then(() => undefined, () => undefined);
}

async function createAccessInvite(userId: string, brokerId: number | null) {
  const rawToken = gerarTokenConvite();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await invalidateOpenInvites(userId, now.toISOString());
  const { error } = await admin.from("acesso_convites").insert({
    usuario_id: userId,
    corretor_id: brokerId,
    token: await tokenArmazenado(rawToken),
    expira_em: expiresAt,
  });
  return error ? { token: null, expiresAt: null } : { token: rawToken, expiresAt };
}

async function validatedSuperior(superiorId: string | null) {
  if (!superiorId) return { id: null, valid: true };
  const { data, error } = await admin.from("usuarios")
    .select("id,role,ativo")
    .eq("id", superiorId)
    .maybeSingle();
  return { id: superiorId, valid: !error && Boolean(data?.ativo && ROLES_SUPERIORES.has(data.role)) };
}

async function rollbackCreatedUser(userId: string, brokerId?: number | null) {
  if (brokerId) await admin.from("corretores").delete().eq("id", brokerId).then(() => undefined, () => undefined);
  await admin.from("usuarios").delete().eq("id", userId).then(() => undefined, () => undefined);
  await admin.auth.admin.deleteUser(userId).then(() => undefined, () => undefined);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return preflight(request);
  if (!originAllowed(request)) return json(request, { ok: false, motivo: "origem_nao_permitida" }, 403);
  if (request.method !== "POST") return json(request, { ok: false, motivo: "metodo_nao_permitido" }, 405);
  const caller = await callerAdmin(request);
  if (!caller) return json(request, { ok: false, motivo: "acesso_negado" }, 403);

  const body = await request.json().catch(() => null) as Body | null;
  if (!body) return json(request, { ok: false, motivo: "json_invalido" }, 400);
  const action = String(body.action ?? "");

  if (action === "criarConviteCadastro") {
    const rawToken = gerarTokenConvite();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("cadastro_convites").insert({
      token: await tokenArmazenado(rawToken),
      role: "corretor",
      criado_por: caller.id,
      criado_por_nome: caller.nome,
      expira_em: expiresAt,
    });
    if (error) return json(request, { ok: false, motivo: "falha_convite" }, 502);
    await audit(caller, "criar_convite_cadastro", caller.id, { role: "corretor", expiraEm: expiresAt });
    return json(request, { ok: true, token: rawToken, expiraEm: expiresAt });
  }

  if (action === "reenviarConvite") {
    const userId = uuidValido(body.usuarioId);
    if (!userId) return json(request, { ok: false, motivo: "usuario_invalido" }, 422);
    const { data: user, error: userError } = await admin.from("usuarios")
      .select("id,ativo")
      .eq("id", userId)
      .maybeSingle();
    if (userError || !user?.ativo) return json(request, { ok: false, motivo: "usuario_nao_encontrado" }, 404);
    const { data: broker } = await admin.from("corretores").select("id").eq("usuario_id", userId).maybeSingle();
    const invite = await createAccessInvite(userId, broker?.id ?? null);
    if (!invite.token) return json(request, { ok: false, motivo: "falha_convite" }, 502);
    await audit(caller, "reenviar_convite", userId, { expiraEm: invite.expiresAt });
    return json(request, { ok: true, token: invite.token, expiraEm: invite.expiresAt });
  }

  if (action !== "criar") return json(request, { ok: false, motivo: "acao_desconhecida" }, 400);

  const name = String(body.nome ?? "").normalize("NFKC").trim().slice(0, 160);
  const email = normalizarEmail(body.email);
  const phone = body.telefone ? String(body.telefone).trim().slice(0, 40) : null;
  const role = normalizarPapel(body.role);
  const superiorId = body.superiorId ? uuidValido(body.superiorId) : null;
  if (name.length < 2) return json(request, { ok: false, motivo: "nome_invalido" }, 422);
  if (!email) return json(request, { ok: false, motivo: "email_invalido" }, 422);
  if (!role) return json(request, { ok: false, motivo: "cargo_invalido" }, 422);
  if (body.superiorId && !superiorId) return json(request, { ok: false, motivo: "superior_invalido" }, 422);
  const superior = await validatedSuperior(superiorId);
  if (!superior.valid) return json(request, { ok: false, motivo: "superior_invalido" }, 422);

  const shouldCreateBroker = body.criarCorretor === undefined
    ? ROLES_COM_CORRETOR.has(role)
    : body.criarCorretor === true && ROLES_COM_CORRETOR.has(role);
  const { data: existing } = await admin.from("usuarios").select("id").ilike("email", email).maybeSingle();
  if (existing) return json(request, { ok: false, motivo: "email_ja_cadastrado" }, 409);

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome: name },
  });
  if (authError || !created.user) {
    const code = String((authError as { code?: string } | null)?.code ?? "");
    return json(request, { ok: false, motivo: /exists|registered/i.test(code) ? "email_ja_cadastrado" : "falha_auth" }, /exists|registered/i.test(code) ? 409 : 502);
  }
  const userId = created.user.id;
  const { error: profileError } = await admin.from("usuarios").insert({
    id: userId,
    nome: name,
    role,
    ativo: true,
    email,
    telefone: phone,
    superior_id: superior.id,
    permissoes: null,
  });
  if (profileError) {
    await rollbackCreatedUser(userId);
    return json(request, { ok: false, motivo: "falha_perfil" }, 502);
  }

  let brokerId: number | null = null;
  if (shouldCreateBroker) {
    const { data: maxOrder } = await admin.from("corretores").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { data: broker, error: brokerError } = await admin.from("corretores").insert({
      nome: name,
      email,
      telefone: phone,
      usuario_id: userId,
      ordem: Number(maxOrder?.ordem ?? 0) + 1,
    }).select("id").single();
    if (brokerError || !broker) {
      await rollbackCreatedUser(userId);
      return json(request, { ok: false, motivo: "falha_corretor" }, 502);
    }
    brokerId = broker.id;
  }

  const invite = await createAccessInvite(userId, brokerId);
  await audit(caller, "criar_usuario", userId, { role, superiorId: superior.id, corretorId: brokerId });
  return json(request, {
    ok: true,
    usuarioId: userId,
    corretorId: brokerId,
    token: invite.token,
    expiraEm: invite.expiresAt,
    ...(invite.token ? {} : { aviso: "Usuário criado, mas o convite não foi gerado." }),
  });
});
