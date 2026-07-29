/**
 * Produtos/empreendimentos VISÍVEIS ao usuário (RLS existente) para o select da proposta.
 * O corretor escolhe pelo NOME; nunca digita UUID. Retorna id (uso interno), nome,
 * bairro/cidade e preço, já formatados para exibição pesquisável.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { formatProduto, type ProdutoRow } from "../produtosFormat";
import { inteiroNaoNeg } from "../validate";

export const dynamic = "force-dynamic";

function tokenDe(request: Request): string | null {
  const a = request.headers.get("authorization");
  return a?.startsWith("Bearer ") ? a.slice(7) : null;
}

export async function GET(request: Request) {
  const token = tokenDe(request);
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const db = supabase as unknown as SupabaseClient;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const limit = Math.min(50, Math.max(1, inteiroNaoNeg(url.searchParams.get("limit") ?? "30", 50) ?? 30));

  // RLS decide o que o usuário enxerga; aqui só filtramos por nome quando houver busca.
  let query = db
    .from("empreendimentos")
    .select("id,nome,bairro,cidade,preco")
    .order("nome", { ascending: true })
    .limit(limit);
  if (q) query = query.ilike("nome", `%${q}%`);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const produtos = ((data ?? []) as ProdutoRow[]).map(formatProduto);
  return Response.json({ ok: true, produtos });
}
