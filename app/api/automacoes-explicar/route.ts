import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* Explicador de automacoes.

   Lista as automacoes e conta a historia de uma delas. A traducao do desenho
   para portugues vive na funcao automacao_explicar, no banco -- aqui e so a
   porta. Se um bloco novo nascer amanha, ensina-se ele a se explicar la, e
   esta rota nao muda. */

async function clienteAutenticado(request: Request) {
  const valor = request.headers.get("authorization");
  const token = valor?.startsWith("Bearer ") ? valor.slice(7) : null;
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

export async function GET(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;

  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    const { data, error } = await auth.db
      .from("automacoes")
      .select("id,nome,ativa,status,grupo")
      .neq("arquivada", true)
      .order("id", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ automacoes: data ?? [] });
  }

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero < 1) {
    return Response.json({ error: "Automação inválida." }, { status: 422 });
  }

  const { data, error } = await auth.db.rpc("automacao_explicar", { p_id: numero });
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
  if (resultado.ok === false) {
    const motivos: Record<string, string> = {
      automacao_nao_encontrada: "Esta automação não existe mais.",
      automacao_sem_blocos: "Esta automação ainda está vazia.",
      automacao_sem_inicio: "Esta automação não tem um bloco de Início — sem ele nada dispara.",
    };
    const chave = String(resultado.erro ?? "");
    return Response.json({ error: motivos[chave] || "Não consegui explicar esta automação." }, { status: 409 });
  }

  return Response.json(resultado);
}
