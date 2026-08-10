import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* Regras do Funil.

   Toda a decisão de permissão mora no banco: as RPCs chamam can_manage_all() e
   devolvem null (leitura) ou {ok:false, erro:'sem_permissao'} (escrita). Esta
   rota não reimplementa a regra -- ela só traduz a recusa para uma frase que o
   usuário entende. Regra perto do dado é regra que uma segunda porta não
   consegue burlar. */

function tokenDe(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function clienteAutenticado(request: Request) {
  const token = tokenDe(request);
  if (!token) return { erro: Response.json({ error: "Sessão necessária." }, { status: 401 }) };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { erro: Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 }) };
  return { db: supabase as unknown as SupabaseClient };
}

const SEM_PERMISSAO = "Só quem administra a operação pode mexer nas regras do funil.";

const RECUSAS: Record<string, string> = {
  sem_permissao: SEM_PERMISSAO,
  regra_nao_encontrada: "Esta regra não existe mais. Recarregue a tela.",
};

export async function GET(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;

  const { data, error } = await auth.db.rpc("funil_regra_ler");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  /* funil_regra_ler devolve NULL para quem não administra -- é a forma de a
     própria função dizer "você não pode ver isto" sem vazar a estrutura. */
  if (!data) return Response.json({ error: SEM_PERMISSAO }, { status: 403 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const action = String(body.action ?? "");
  let rpc = "";
  let args: Record<string, unknown> = {};

  if (action === "salvar") {
    const regra = body.regra;
    if (typeof regra !== "object" || regra === null) {
      return Response.json({ error: "Regra inválida." }, { status: 422 });
    }
    /* A validação de conteúdo (nome vazio, momento de destino faltando,
       abordagem não escolhida) já está dentro de funil_regra_salvar e devolve
       a frase pronta. Repetir aqui só criaria duas verdades. */
    rpc = "funil_regra_salvar";
    args = { p_regra: regra };
  } else if (action === "excluir") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Regra inválida." }, { status: 422 });
    rpc = "funil_regra_excluir";
    args = { p_id: id };
  } else if (action === "previa") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Regra inválida." }, { status: 422 });
    rpc = "funil_regra_previa";
    args = { p_id: id };
  } else if (action === "motor") {
    rpc = "funil_motor_ligar";
    args = { p_ativo: body.ativo === true };
  } else if (action === "simular" || action === "rodar") {
    /* Simular é o mesmo motor com p_simular=true: percorre todas as regras
       ligadas e devolve o que FARIA, sem mover card nenhum. É o ensaio antes
       de ligar o motor de verdade. */
    const lote = Number(body.lote);
    rpc = "funil_tick";
    args = {
      p_simular: action === "simular",
      p_lote: Number.isInteger(lote) && lote > 0 ? Math.min(lote, 500) : 50,
    };
  } else {
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  const { data, error } = await auth.db.rpc(rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
  if (resultado.ok === false) {
    const chave = String(resultado.erro ?? "");
    return Response.json({ error: RECUSAS[chave] || resultado.erro || "Ação não permitida." }, { status: 409 });
  }
  return Response.json({ ok: true, resultado });
}
