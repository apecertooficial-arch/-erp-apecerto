/**
 * Avisos do aplicativo (tela /notificacoes no celular).
 *
 * GET  -> ncrm_notificacoes(): pendentes do usuário, escopo decidido DENTRO
 *         do banco (gestor vê gestão; corretor vê a própria carteira).
 * POST -> { id } marca UMA como vista · { todas: true } marca todas.
 *
 * POR QUE ESTA ROTA EXISTE: a TelaAvisosMobile chama /api/ncrm/notificacoes
 * desde que nasceu, mas a rota nunca tinha sido escrita — no celular a tela
 * de Avisos caía SEMPRE no estado de erro. A RPC já existia; faltava a ponte.
 *
 * TRADUÇÃO DE SHAPE, de propósito e documentada: a RPC devolve `desde` e
 * `vista` (boolean); a tela espera `criada_em` e `vista_em` (ISO ou null).
 * Traduzimos AQUI e não na tela porque o contrato da tela é o do tipo
 * `Aviso` em telaAvisos.logica.ts, que os testes conhecem — a rota é quem
 * se adapta ao banco, nunca o contrário.
 *
 * "Marcar como visto NÃO é contato": a RPC ncrm_notificacao_vista só apaga
 * o ponto laranja. Nenhuma ação aqui toca no atendimento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type ItemRpc = {
  id: number;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  negocio_id: number | null;
  prioridade: number;
  desde: string;
  deep_link: string | null;
  vista: boolean;
};

async function clienteAutenticado(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data: auth, error } = await supabase.auth.getUser(token);
  if (error || !auth.user) return null;
  return supabase as unknown as SupabaseClient;
}

export async function GET(request: Request) {
  const db = await clienteAutenticado(request);
  if (!db) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const { data, error } = await db.rpc("ncrm_notificacoes");

  /* Falha vira 502, nunca lista vazia silenciosa: Avisos zerados por erro
     fariam o corretor achar que está tudo em dia — o oposto da verdade. */
  if (error) return Response.json({ ok: false, error: "Falha ao carregar os avisos." }, { status: 502 });

  const res = (data ?? {}) as { ok?: boolean; erro?: string; itens?: ItemRpc[]; pendentes?: number; urgentes?: number; nao_vistas?: number };
  if (res.ok === false) {
    return Response.json({ ok: false, erro: res.erro }, { status: res.erro === "nao_autenticado" ? 403 : 409 });
  }

  const itens = (res.itens ?? []).map((i) => ({
    id: i.id,
    tipo: i.tipo,
    prioridade: i.prioridade,
    titulo: i.titulo,
    detalhe: i.detalhe ?? null,
    negocio_id: i.negocio_id ?? null,
    deep_link: i.deep_link ?? null,
    criada_em: i.desde,
    /* A RPC não devolve QUANDO foi vista, só SE foi. A tela usa o campo como
       verdade booleana (`!a.vista_em`); a data emprestada de `desde` mantém o
       tipo do contrato sem inventar um horário que pareceria real. */
    vista_em: i.vista ? i.desde : null,
    resolvida_em: null,
  }));

  return Response.json({
    ok: true,
    pendentes: res.pendentes ?? itens.length,
    urgentes: res.urgentes ?? 0,
    nao_vistas: res.nao_vistas ?? 0,
    itens,
  });
}

export async function POST(request: Request) {
  const db = await clienteAutenticado(request);
  if (!db) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  let corpo: { id?: unknown; todas?: unknown } = {};
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Corpo inválido." }, { status: 422 });
  }

  if (corpo.todas === true) {
    const { data, error } = await db.rpc("ncrm_notificacoes_marcar_todas");
    if (error) return Response.json({ ok: false, error: "Falha ao marcar os avisos." }, { status: 502 });
    return Response.json(data ?? { ok: true });
  }

  const id = Number(corpo.id);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ ok: false, error: "Informe o aviso." }, { status: 422 });
  }

  const { data, error } = await db.rpc("ncrm_notificacao_vista", { p_id: id });
  if (error) return Response.json({ ok: false, error: "Falha ao marcar o aviso." }, { status: 502 });
  return Response.json(data ?? { ok: true });
}
