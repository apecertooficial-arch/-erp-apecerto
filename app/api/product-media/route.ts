import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const mediaId = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(mediaId)) return Response.json({ error: "Mídia inválida." }, { status: 400 });

  const supabase = createServerSupabaseClient(token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("usuarios").select("ativo").eq("id", authData.user.id).maybeSingle();
  if (profileError || profile?.ativo !== true) return Response.json({ error: "Acesso negado." }, { status: 403 });

  const { data: media, error: mediaError } = await supabase.from("midias").select("storage_path").eq("id", mediaId).maybeSingle();
  if (mediaError) return Response.json({ error: "Não foi possível carregar a mídia." }, { status: 502 });
  if (!media?.storage_path) return Response.json({ error: "Mídia não encontrada." }, { status: 404 });
  const { data: signed, error: signedError } = await supabase.storage.from("empreendimentos").createSignedUrl(media.storage_path, 300);
  if (signedError || !signed?.signedUrl) return Response.json({ error: "Mídia indisponível." }, { status: 502 });
  return new Response(null, { status: 307, headers: { Location: signed.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
