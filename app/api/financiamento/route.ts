import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão ausente." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const { data, error } = await supabase
    .from("financiamento_fichas")
    .select("id,comprador_nome,telefone,produto,unidade,status,renda,valor_imovel,valor_entrada,valor_financiar,link_token,criado_em,preenchida_em,concluida_em")
    .order("criado_em", { ascending: false })
    .limit(500);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ fichas: data ?? [] });
}
