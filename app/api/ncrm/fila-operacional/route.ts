/**
 * FILA OPERACIONAL — payload do app do corretor.
 *
 * NAO cria contrato novo no banco. Reusa a fila canonica
 * (ncrm_fila_trabalho, SECURITY DEFINER, escopo por carteira/papel decidido
 * DENTRO do banco) e enriquece em lote apenas os itens que ela devolveu.
 *
 * A regra de ouro desta rota, e a razao de ela existir separada:
 *
 *   O CONJUNTO DE IDS AUTORIZADOS VEM DA FILA. Nada aqui pode ampliar esse
 *   conjunto. Todo lote de enriquecimento e filtrado pela intersecao com ele
 *   ANTES de qualquer projecao de telefone.
 *
 * Nao basta devolver telefone nulo para lead alheio: lead alheio nao aparece.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

import {
  POR_PAGINA, normalizarTelefone, orientacaoCurta, ordemCanonica,
  aplicarCursor, codificarCursor, type ItemFila,
} from "./logica";

export async function GET(request: Request) {
  const a = request.headers.get("authorization");
  const token = a?.startsWith("Bearer ") ? a.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  /* corretor_id / broker_id / user_id vindos do cliente sao IGNORADOS de
     proposito. O escopo e do banco; aceitar isso aqui seria um IDOR. */

  const db = supabase as unknown as SupabaseClient;

  const { data: fila, error: erroFila } = await db.rpc("ncrm_fila_trabalho", {
    p_filtro: "agora",
    p_corretor: null,
    p_limite: 300,
  });
  if (erroFila) return Response.json({ ok: false, error: "Falha ao carregar a fila." }, { status: 502 });

  const todos = ((fila as { itens?: ItemFila[] } | null)?.itens ?? []).slice().sort(ordemCanonica);
  const pagina = aplicarCursor(todos, cursor).slice(0, POR_PAGINA);

  /* AUTORIZADOS: o unico conjunto que pode aparecer na resposta. */
  const autorizados = new Set(pagina.map((i) => i.negocio_id));
  if (autorizados.size === 0) {
    return Response.json({ ok: true, itens: [], next_cursor: null });
  }
  const ids = [...autorizados];

  /* Cinco consultas em lote. Nenhuma dentro de laco -- N+1 aqui seria 20 idas
     ao banco por abertura de tela. */
  const [negRes, estRes, saraRes, intRes] = await Promise.all([
    db.from("negocios").select("id,lead_id,empreendimento_id").in("id", ids),
    db.from("ncrm_estado").select("negocio_id,proxima_acao_tipo,primeira_saida_humana_em,primeira_saida_message_id").in("negocio_id", ids),
    db.from("ncrm_sara_analise").select("negocio_id,proxima_acao_sugerida,justificativa,analisado_em").in("negocio_id", ids).order("analisado_em", { ascending: false }),
    db.from("ncrm_whatsapp_intencao").select("negocio_id,aberto_em,confirmada_em,expirada_em").in("negocio_id", ids).order("aberto_em", { ascending: false }),
  ]);

  /* INTERSECAO OBRIGATORIA: descarta qualquer linha cujo negocio nao esteja no
     conjunto autorizado, aconteca o que acontecer com RLS ou com a consulta. */
  const negocios = (negRes.data ?? []).filter((n) => autorizados.has(Number(n.id)));
  const estados = new Map((estRes.data ?? []).filter((e) => autorizados.has(Number(e.negocio_id))).map((e) => [Number(e.negocio_id), e]));

  const sara = new Map<number, { proxima_acao_sugerida: string | null; justificativa: string | null }>();
  for (const s of saraRes.data ?? []) {
    const id = Number(s.negocio_id);
    if (!autorizados.has(id) || sara.has(id)) continue; // ja ordenado desc: o primeiro e o mais recente
    sara.set(id, s);
  }
  const intencao = new Map<number, { aberto_em: string | null; confirmada_em: string | null; expirada_em: string | null }>();
  for (const i of intRes.data ?? []) {
    const id = Number(i.negocio_id);
    if (!autorizados.has(id) || intencao.has(id)) continue;
    intencao.set(id, i);
  }

  const leadIds = [...new Set(negocios.map((n) => Number(n.lead_id)).filter(Boolean))];
  const empIds = [...new Set(negocios.map((n) => n.empreendimento_id).filter(Boolean))];

  const [leadRes, empRes] = await Promise.all([
    leadIds.length ? db.from("leads").select("id,nome,telefone").in("id", leadIds) : Promise.resolve({ data: [] }),
    empIds.length ? db.from("empreendimentos").select("id,nome").in("id", empIds) : Promise.resolve({ data: [] }),
  ]);

  const leadsPermitidos = new Set(leadIds);
  const leads = new Map((leadRes.data ?? []).filter((l) => leadsPermitidos.has(Number(l.id))).map((l) => [Number(l.id), l]));
  const emps = new Map((empRes.data ?? []).map((e) => [String(e.id), e]));
  const negocioPorId = new Map(negocios.map((n) => [Number(n.id), n]));

  const itens = pagina.map((i) => {
    const neg = negocioPorId.get(i.negocio_id);
    const lead = neg ? leads.get(Number(neg.lead_id)) : null;
    const est = estados.get(i.negocio_id);
    const s = sara.get(i.negocio_id);
    const wa = intencao.get(i.negocio_id);

    /* Outbound REAL: so a saida humana registrada com message_id conta. Abrir o
       WhatsApp nao e ter falado com o cliente. */
    const outboundConfirmado = !!(est?.primeira_saida_humana_em && est?.primeira_saida_message_id);
    const aguardando = !!wa?.aberto_em && !wa?.confirmada_em && !wa?.expirada_em && !outboundConfirmado;

    return {
      lead_id: neg ? Number(neg.lead_id) : null,
      negocio_id: i.negocio_id,
      nome: lead?.nome ?? i.lead_nome ?? null,
      telefone_normalizado: normalizarTelefone(lead?.telefone),
      interesse_resumo: neg?.empreendimento_id ? (emps.get(String(neg.empreendimento_id))?.nome ?? null) : null,
      motivo_prioridade: i.motivo,
      /* Campos de agrupamento do Meu Dia. Aditivos ao contrato: o front decide
         o bloco com a MESMA regra do banco, sem recalcular prioridade. */
      prioridade: i.prioridade,
      respondeu: !!i.respondeu,
      etapa: i.etapa,
      tempo_espera: Math.round(Number(i.espera_min) || 0),
      sara_orientacao_curta: orientacaoCurta(s?.proxima_acao_sugerida ?? s?.justificativa),
      proxima_acao_tipo: est?.proxima_acao_tipo ?? null,
      proxima_acao_prazo: i.proxima_acao_em,
      outbound_real_confirmado: outboundConfirmado,
      aguardando_sincronizacao: aguardando,
      deep_link: `/crm?lead=${i.negocio_id}`,
    };
  });

  const ultimo = pagina[pagina.length - 1];
  const temMais = aplicarCursor(todos, cursor).length > pagina.length;

  return Response.json({ ok: true, itens, next_cursor: temMais && ultimo ? codificarCursor(ultimo) : null });
}
