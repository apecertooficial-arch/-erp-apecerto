/**
 * Chave pública VAPID — o navegador precisa dela para se inscrever no push.
 *
 * Vem de `ncrm_push_config` pela RPC `ncrm_push_chave_publica()`, não de
 * variável de ambiente. Motivo: variável exige alguém colar valor no painel do
 * Render, e recurso que depende de configuração manual não liga — ou liga pela
 * metade e ninguém descobre. Girar a chave agora é um UPDATE, sem deploy.
 *
 * A pública não é segredo: viaja em todo pedido de inscrição e o próprio
 * serviço de push a lê. A PRIVADA fica no vault do Postgres e só sai para o
 * service_role, dentro da edge function.
 *
 * A RPC também devolve `push_desligado` quando `ativo = false` — assim o app
 * nem oferece o botão de ligar avisos enquanto o recurso estiver fora do ar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const db = supabase as unknown as SupabaseClient;
  const { data, error: eRpc } = await db.rpc("ncrm_push_chave_publica");
  if (eRpc) return Response.json({ ok: false, erro: "falha_ao_ler_chave" }, { status: 502 });

  const res = (data ?? {}) as { ok?: boolean; erro?: string; chave?: string };
  if (res.ok !== true || !res.chave) {
    /* 503 e não 200 com string vazia: o cliente precisa distinguir
       "servidor sem push configurado" de "chave errada". */
    return Response.json({ ok: false, erro: res.erro ?? "vapid_nao_configurada" }, { status: 503 });
  }

  return Response.json({ ok: true, chave: res.chave });
}
