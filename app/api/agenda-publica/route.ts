import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* Agenda pública (somente leitura) — validada pelo código secreto do link. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!/^[a-f0-9]{40,80}$/i.test(token)) {
    return Response.json({ error: "Link inválido." }, { status: 400 });
  }
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("agenda_publica", { p_token: token });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!data) return Response.json({ error: "Este link de agenda não existe mais. Peça o link atualizado." }, { status: 404 });
  return Response.json(data);
}
