// admin-usuarios — criação de usuários pelo admin (service role) + convite de acesso.
// Ações: "criar" (auth user + usuarios + corretores + convite) e "reenviarConvite".
// Segurança: exige JWT válido E que o chamador seja admin ativo em public.usuarios.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ROLES = ["admin", "executivo", "diretor", "gerente", "corretor"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function chamadorAdmin(req: Request): Promise<{ id: string; nome: string } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await admin.from("usuarios").select("id,nome,role,ativo").eq("id", data.user.id).maybeSingle();
  if (!perfil?.ativo || perfil.role !== "admin") return null;
  return { id: perfil.id, nome: perfil.nome };
}

function novoToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
}

async function auditar(caller: { id: string; nome: string }, acao: string, entidadeId: string, detalhe: string, depois: unknown) {
  await admin.from("erp_auditoria").insert({ usuario_id: caller.id, usuario_nome: caller.nome, acao, modulo: "Usuários", entidade: "usuario", entidade_id: entidadeId, depois, detalhe }).then(() => undefined, () => undefined);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, motivo: "method_not_allowed" }, 405);

  const caller = await chamadorAdmin(req);
  if (!caller) return json({ ok: false, motivo: "acesso_negado", detalhe: "Apenas administradores." }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, motivo: "json_invalido" }, 400); }
  const action = String(body.action ?? "");

  if (action === "criar") {
    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "corretor");
    const telefone = body.telefone ? String(body.telefone).trim() : null;
    const superiorId = typeof body.superiorId === "string" && body.superiorId.length >= 30 ? body.superiorId : null;
    const permissoes = body.permissoes && typeof body.permissoes === "object" ? body.permissoes : null;
    const criarCorretor = body.criarCorretor === undefined ? ["corretor", "gerente", "diretor"].includes(role) : body.criarCorretor === true;

    if (nome.length < 2) return json({ ok: false, motivo: "nome_invalido" }, 422);
    if (!EMAIL_RE.test(email)) return json({ ok: false, motivo: "email_invalido" }, 422);
    if (!ROLES.includes(role)) return json({ ok: false, motivo: "cargo_invalido" }, 422);

    const { data: emailExiste } = await admin.from("usuarios").select("id").ilike("email", email).maybeSingle();
    if (emailExiste) return json({ ok: false, motivo: "email_ja_cadastrado" }, 409);

    // 1) Cria o usuário de autenticação (sem senha — vai definir pelo convite)
    const { data: created, error: authError } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nome } });
    if (authError || !created.user) {
      const msg = authError?.message ?? "";
      if (/already|registered|exists/i.test(msg)) return json({ ok: false, motivo: "email_ja_cadastrado" }, 409);
      return json({ ok: false, motivo: "falha_auth", detalhe: msg }, 500);
    }
    const usuarioId = created.user.id;

    // 2) Perfil em public.usuarios (rollback do auth user se falhar)
    const { error: userError } = await admin.from("usuarios").insert({ id: usuarioId, nome, role, ativo: true, email, telefone, superior_id: superiorId, permissoes });
    if (userError) {
      await admin.auth.admin.deleteUser(usuarioId).catch(() => undefined);
      return json({ ok: false, motivo: "falha_perfil", detalhe: userError.message }, 500);
    }

    // 3) Registro operacional em corretores (para quem atende/vende)
    let corretorId: number | null = null;
    if (criarCorretor) {
      const { data: maxOrdem } = await admin.from("corretores").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
      const { data: broker, error: brokerError } = await admin.from("corretores").insert({ nome, email, telefone, usuario_id: usuarioId, ordem: (maxOrdem?.ordem ?? 0) + 1 }).select("id").single();
      if (brokerError) {
        await admin.from("usuarios").delete().eq("id", usuarioId).catch(() => undefined);
        await admin.auth.admin.deleteUser(usuarioId).catch(() => undefined);
        return json({ ok: false, motivo: "falha_corretor", detalhe: brokerError.message }, 500);
      }
      corretorId = broker.id;
    }

    // 4) Convite (token único, 7 dias)
    const token = novoToken();
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: conviteError } = await admin.from("acesso_convites").insert({ usuario_id: usuarioId, corretor_id: corretorId, token, expira_em: expiraEm });
    if (conviteError) return json({ ok: true, usuarioId, corretorId, token: null, aviso: "Usuário criado, mas o convite falhou. Use 'reenviar convite'." });

    await auditar(caller, "criar_usuario", usuarioId, `Usuário ${nome} (${email}) criado como ${role}`, { nome, email, role, telefone, superiorId, corretorId });
    return json({ ok: true, usuarioId, corretorId, token, expiraEm });
  }

  if (action === "reenviarConvite") {
    const usuarioId = typeof body.usuarioId === "string" && body.usuarioId.length >= 30 ? body.usuarioId : null;
    if (!usuarioId) return json({ ok: false, motivo: "usuario_invalido" }, 422);
    const { data: usuario } = await admin.from("usuarios").select("id,nome").eq("id", usuarioId).maybeSingle();
    if (!usuario) return json({ ok: false, motivo: "usuario_nao_encontrado" }, 404);
    const { data: corretor } = await admin.from("corretores").select("id").eq("usuario_id", usuarioId).maybeSingle();
    const token = novoToken();
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("acesso_convites").insert({ usuario_id: usuarioId, corretor_id: corretor?.id ?? null, token, expira_em: expiraEm });
    if (error) return json({ ok: false, motivo: "falha_convite", detalhe: error.message }, 500);
    await auditar(caller, "reenviar_convite", usuarioId, `Novo convite gerado para ${usuario.nome}`, { expiraEm });
    return json({ ok: true, token, expiraEm });
  }

  return json({ ok: false, motivo: "acao_desconhecida" }, 400);
});
