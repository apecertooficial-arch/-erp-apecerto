import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.110.2";
import { candidatosToken, problemaSenha } from "../_shared/convites-policy.mjs";
import { json, originAllowed, preflight } from "../_shared/edge-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Invite = {
  id: string;
  corretor_id: number | null;
  usuario_id: string;
  expira_em: string;
  usado_em: string | null;
};

async function findInvite(rawToken: unknown): Promise<Invite | null> {
  const candidates = await candidatosToken(rawToken);
  for (const token of candidates) {
    const { data, error } = await admin.from("acesso_convites")
      .select("id,corretor_id,usuario_id,expira_em,usado_em")
      .eq("token", token)
      .maybeSingle();
    if (!error && data) return data as Invite;
  }
  return null;
}

function inviteState(invite: Invite | null) {
  if (!invite) return "invalido";
  if (invite.usado_em) return "usado";
  if (!Number.isFinite(Date.parse(invite.expira_em)) || Date.parse(invite.expira_em) <= Date.now()) return "expirado";
  return null;
}

async function brokerName(brokerId: number | null) {
  if (!brokerId) return null;
  const { data } = await admin.from("corretores").select("nome").eq("id", brokerId).maybeSingle();
  return data?.nome ?? null;
}

async function reserveInvite(invite: Invite) {
  const reservedAt = new Date().toISOString();
  const { data, error } = await admin.from("acesso_convites")
    .update({ usado_em: reservedAt })
    .eq("id", invite.id)
    .is("usado_em", null)
    .gt("expira_em", reservedAt)
    .select("id")
    .maybeSingle();
  return error || !data ? null : reservedAt;
}

async function releaseInvite(inviteId: string, reservedAt: string) {
  await admin.from("acesso_convites")
    .update({ usado_em: null })
    .eq("id", inviteId)
    .eq("usado_em", reservedAt)
    .then(() => undefined, () => undefined);
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
      : json(request, { ok: true, nome: await brokerName(invite!.corretor_id) });
  }
  if (action !== "definir") return json(request, { ok: false, motivo: "acao_desconhecida" }, 400);
  if (state || !invite) return json(request, { ok: false, motivo: state ?? "invalido" }, state === "usado" ? 409 : 422);

  const password = typeof body.senha === "string" ? body.senha : "";
  const passwordIssue = problemaSenha(password);
  if (passwordIssue) return json(request, { ok: false, motivo: passwordIssue }, 422);
  const reservedAt = await reserveInvite(invite);
  if (!reservedAt) return json(request, { ok: false, motivo: "usado" }, 409);

  const { error } = await admin.auth.admin.updateUserById(invite.usuario_id, { password });
  if (error) {
    await releaseInvite(invite.id, reservedAt);
    return json(request, { ok: false, motivo: "falha_ao_salvar" }, 502);
  }
  return json(request, { ok: true, nome: await brokerName(invite.corretor_id) });
});
