/* BUSCA DA CARTEIRA ANTIGA — endpoint separado, de propósito.
 *
 * O corretor só enxerga o Funil 2.0, e a busca de "Todos os Leads" só alcança
 * os leads que já viraram card lá. Quando o cliente antigo volta a responder,
 * o lead dele não está nessa lista — então o corretor sai do 2.0, procura no
 * CRM antigo, e acaba marcando a visita lá. A operação racha em dois lugares.
 *
 * POR QUE NÃO ENTROU NO PAYLOAD DO /api/funil2: são 1.515 leads. Mandá-los em
 * toda carga da tela seria uns 200 KB a mais por request, para um recurso que
 * só é usado quando alguém digita algo. Aqui a consulta só acontece na busca.
 *
 * ESTES LEADS NÃO VIRAM CARD. Este endpoint só os torna encontráveis. Trazer
 * um deles para o funil é ação explícita do corretor, lead a lead, escolhendo
 * etapa e momento — criar card em massa encheria o Meu Dia de todo mundo com
 * cliente que ninguém vai atender hoje.
 *
 * A visibilidade é resolvida dentro da função SQL (admin vê todos, corretor vê
 * os seus), não aqui: regra de acesso perto do dado é regra que não se esquece
 * de aplicar numa segunda porta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const db = createServerSupabaseClient(token);
  const { data: user, error: authError } = await db.auth.getUser(token);
  if (authError || !user.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const busca = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  /* Menos de 3 caracteres devolve lista vazia em vez de meia carteira: busca de
     uma letra não ajuda ninguém a achar cliente e ainda pesa no banco. */
  if (busca.length < 3) return Response.json({ leads: [], curta: true });

  /* Mesmo desvio de tipagem que /api/funil2 usa: database.types.ts é gerado e
     ainda não conhece esta função. Regerar o arquivo inteiro por causa de uma
     RPC nova seria um diff de milhares de linhas. */
  const rpc = db as unknown as SupabaseClient;
  const { data, error } = await rpc.rpc("f2_carteira_antiga", { p_busca: busca, p_limite: 40 });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ leads: data ?? [], curta: false });
}
