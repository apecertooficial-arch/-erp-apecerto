// cadastro-publico — autocadastro de corretor por link de convite.
// O gestor gera um token em cadastro_convites (RLS) e envia o link /cadastro?t=<token>.
// Quem abre o link não tem sessão, por isso verify_jwt=false; a segurança vem do token:
// único, com validade (expira_em) e de uso único (usado_em). Nenhuma ação roda sem token válido.
// Ações: "validar" {token} e "registrar" {token, nome, email, telefone, senha}.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Convite = { id: string; token: string; role: string; criado_por: string | null; criado_por_nome: string | null; expira_em: string; usado_em: string | null };

async function buscarConvite(token: string): Promise<{ convite: Convite | null; motivo: "invalido" | "usado" | "expirado" | null }> {
  if (!token || token.length < 20) return { convite: null, motivo: "invalido" };
  const { data } = await admin.from("cadastro_convites").select("id,token,role,criado_por,criado_por_nome,expira_em,usado_em").eq("token", token).maybeSingle();
  if (!data) return { convite: null, motivo: "invalido" };
  if (data.usado_em) return { convite: null, motivo: "usado" };
  if (new Date(data.expira_em).getTime() < Date.now()) return { convite: null, motivo: "expirado" };
  return { convite: data as Convite, motivo: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, motivo: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, motivo: "json_invalido" }, 400); }
  const action = String(body.action ?? "");
  const token = String(body.token ?? "").trim();

  if (action === "validar") {
    const { convite, motivo } = await buscarConvite(token);
    if (!convite) return json({ ok: false, motivo });
    return json({ ok: true, role: convite.role, expiraEm: convite.expira_em });
  }

  if (action === "registrar") {
    const { convite, motivo } = await buscarConvite(token);
    if (!convite) return json({ ok: false, motivo });

    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const telefone = body.telefone ? String(body.telefone).trim() : null;
    const senha = String(body.senha ?? "");

    if (nome.length < 2) return json({ ok: false, motivo: "nome_invalido" }, 422);
    if (!EMAIL_RE.test(email)) return json({ ok: false, motivo: "email_invalido" }, 422);
    if (senha.length < 8) return json({ ok: false, motivo: "senha_curta" }, 422);

    const { data: emailExiste } = await admin.from("usuarios").select("id").ilike("email", email).maybeSingle();
    if (emailExiste) return json({ ok: false, motivo: "email_ja_cadastrado" }, 409);

    const role = convite.role;

    // 1) Usuário de autenticação já com a senha escolhida (e-mail confirmado — chegou pelo link do gestor)
    const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
    if (authError || !created.user) {
      const msg = authError?.message ?? "";
      if (/already|registered|exists/i.test(msg)) return json({ ok: false, motivo: "email_ja_cadastrado" }, 409);
      return json({ ok: false, motivo: "falha_auth", detalhe: msg }, 500);
    }
    const usuarioId = created.user.id;

    // 2) Perfil em public.usuarios (rollback do auth user se falhar)
    const { error: userError } = await admin.from("usuarios").insert({ id: usuarioId, nome, role, ativo: true, email, telefone, superior_id: null, permissoes: null });
    if (userError) {
      await admin.auth.admin.deleteUser(usuarioId).catch(() => undefined);
      return json({ ok: false, motivo: "falha_perfil", detalhe: userError.message }, 500);
    }

    // 3) Registro operacional em corretores (para quem atende/vende)
    let corretorId: number | null = null;
    if (["corretor", "gerente", "diretor"].includes(role)) {
      const { data: maxOrdem } = await admin.from("corretores").select("ordem").order("ordem", { ascending: false }).limit(1).maybeSingle();
      const { data: broker, error: brokerError } = await admin.from("corretores").insert({ nome, email, telefone, usuario_id: usuarioId, ordem: (maxOrdem?.ordem ?? 0) + 1 }).select("id").single();
      if (brokerError) {
        await admin.from("usuarios").delete().eq("id", usuarioId).catch(() => undefined);
        await admin.auth.admin.deleteUser(usuarioId).catch(() => undefined);
        return json({ ok: false, motivo: "falha_corretor", detalhe: brokerError.message }, 500);
      }
      corretorId = broker.id;
    }

    // 4) Consome o convite — condição usado_em is null evita corrida de uso duplo
    const { data: consumido, error: usoError } = await admin.from("cadastro_convites")
      .update({ usado_em: new Date().toISOString(), usado_email: email, usado_usuario_id: usuarioId })
      .eq("id", convite.id).is("usado_em", null).select("id");
    if (usoError || !consumido?.length) {
      // Alguém usou o mesmo link um instante antes — desfaz tudo
      if (corretorId) await admin.from("corretores").delete().eq("id", corretorId).catch(() => undefined);
      await admin.from("usuarios").delete().eq("id", usuarioId).catch(() => undefined);
      await admin.auth.admin.deleteUser(usuarioId).catch(() => undefined);
      return json({ ok: false, motivo: "usado" }, 409);
    }

    await admin.from("erp_auditoria").insert({
      usuario_id: convite.criado_por, usuario_nome: convite.criado_por_nome ?? "Convite por link",
      acao: "autocadastro_por_link", modulo: "Usuários", entidade: "usuario", entidade_id: usuarioId,
      depois: { nome, email, role, telefone, corretorId, convite_id: convite.id },
      detalhe: `Autocadastro: ${nome} (${email}) entrou como ${role} pelo link de convite`,
    }).then(() => undefined, () => undefined);

    return json({ ok: true, usuarioId, corretorId, email });
  }

  return json({ ok: false, motivo: "acao_desconhecida" }, 400);
});
