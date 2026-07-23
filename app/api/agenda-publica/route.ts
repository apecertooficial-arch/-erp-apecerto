import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* Agenda pública (somente leitura) — validada pelo código secreto do link. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token")?.trim() ?? "";
  if (!/^[a-f0-9]{40,80}$/i.test(token)) {
    return Response.json({ error: "Link inválido." }, { status: 400 });
  }
  const dia = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("agenda_publica", { p_token: token, p_de: dia(params.get("de")), p_ate: dia(params.get("ate")) });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!data) return Response.json({ error: "Este link de agenda não existe mais. Peça o link atualizado." }, { status: 404 });
  return Response.json(data);
}
