/**
 * Chave publica VAPID.
 *
 * O navegador precisa dela para se inscrever no push. E publica por definicao --
 * viaja em todo pedido de inscricao e o proprio servico de push a le. O que
 * NUNCA sai daqui e a privada, que vive so em Edge Secrets do Supabase.
 *
 * Por que uma rota em vez de NEXT_PUBLIC_: variavel publica e assada no build.
 * Girar a chave exigiria rebuild e deploy. Aqui e so trocar a variavel no Render
 * e reiniciar -- e a rota exige sessao, entao a chave nao fica exposta a
 * varredura anonima.
 */
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const chave = process.env.NCRM_VAPID_PUBLIC_KEY ?? "";
  /* Sem chave configurada respondemos 503, nao 200 com string vazia: o cliente
     tem de conseguir distinguir "servidor nao configurado" de "chave errada". */
  if (!chave) {
    return Response.json({ ok: false, erro: "vapid_nao_configurada" }, { status: 503 });
  }

  return Response.json({ ok: true, chave });
}
