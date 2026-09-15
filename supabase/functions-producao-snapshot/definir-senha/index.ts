// definir-senha — fluxo de autoatendimento: o corretor abre o link (token único) e define a própria senha.
// Ações: "validar" (checa o token e devolve o nome) e "definir" (grava a nova senha via Admin API).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function convitePorToken(token: string) {
  const { data } = await admin.from("acesso_convites").select("id,corretor_id,usuario_id,expira_em,usado_em").eq("token", token).maybeSingle();
  return data;
}
async function nomeDoCorretor(corretorId: number | null) {
  if (!corretorId) return null;
  const { data } = await admin.from("corretores").select("nome").eq("id", corretorId).maybeSingle();
  return data?.nome ?? null;
}
function estado(c: any): { ok: boolean; motivo?: string } {
  if (!c) return { ok: false, motivo: "invalido" };
  if (c.usado_em) return { ok: false, motivo: "usado" };
  if (new Date(c.expira_em).getTime() < Date.now()) return { ok: false, motivo: "expirado" };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, motivo: "method_not_allowed" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, motivo: "json_invalido" }, 400); }
  const action = String(body.action ?? "");
  const token = String(body.token ?? "").trim();
  if (!token) return json({ ok: false, motivo: "sem_token" }, 400);

  const c = await convitePorToken(token);
  const st = estado(c);

  if (action === "validar") {
    if (!st.ok) return json(st);
    return json({ ok: true, nome: await nomeDoCorretor(c!.corretor_id) });
  }

  if (action === "definir") {
    if (!st.ok) return json(st);
    const senha = String(body.senha ?? "");
    if (senha.length < 8) return json({ ok: false, motivo: "senha_curta" });
    if (senha.length > 72) return json({ ok: false, motivo: "senha_longa" });
    const { error } = await admin.auth.admin.updateUserById(c!.usuario_id, { password: senha });
    if (error) return json({ ok: false, motivo: "falha_ao_salvar", detalhe: error.message }, 500);
    await admin.from("acesso_convites").update({ usado_em: new Date().toISOString() }).eq("id", c!.id);
    return json({ ok: true, nome: await nomeDoCorretor(c!.corretor_id) });
  }

  return json({ ok: false, motivo: "acao_desconhecida" }, 400);
});
