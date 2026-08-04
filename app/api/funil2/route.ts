import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  const db = auth.db;
  const [
    { data: leads, error: e1 }, { data: momentos, error: e2 }, { data: eventos, error: e3 },
    { data: etapas, error: e4 }, { data: visitas, error: e5 }, { data: negociacoes, error: e6 },
    { data: aquario, error: e7 }, { data: operacao, error: e8 },
  ] = await Promise.all([
    db.from("f2_lead").select("*").order("proxima_acao_em", { ascending: true }),
    db.from("f2_momento_config").select("*").order("etapa", { ascending: true }).order("ordem", { ascending: true }),
    db.from("f2_evento").select("id,funil_lead_id,tipo,titulo,detalhe,payload,criado_em").order("criado_em", { ascending: false }).limit(100),
    db.from("f2_etapa_config").select("codigo,ordem,rotulo,ajuda,ativo").order("ordem", { ascending: true }),
    db.from("f2_visita").select("id,funil_lead_id,inicio_em,imovel,status,observacao,atualizado_em").order("inicio_em", { ascending: true }),
    db.from("f2_negociacao").select("id,funil_lead_id,titulo,etapa,valor,observacao,atualizado_em").order("atualizado_em", { ascending: false }),
    db.rpc("f2_listar_aquario"),
    db.from("f2_operacao_config").select("*").eq("id", true).maybeSingle(),
  ]);
  if (e1 || e2 || e3 || e4 || e5 || e6 || e7) {
    const message = e1?.message || e2?.message || e3?.message || e4?.message || e5?.message || e6?.message || e7?.message || "Falha ao carregar o Funil 2.0.";
    return Response.json({ error: message }, { status: message.toLowerCase().includes("permission") ? 403 : 502 });
  }
  return Response.json({
    leads: leads ?? [], momentos: momentos ?? [], eventos: eventos ?? [], etapas: etapas ?? [],
    visitas: visitas ?? [], negociacoes: negociacoes ?? [], aquario: aquario ?? [], operacao: e8 ? null : operacao ?? null, limite: 2, laboratorio: true,
  });
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

  if (action === "configurarEtapa") {
    rpc = "f2_configurar_etapa";
    args = {
      p_codigo: String(body.codigo ?? "").slice(0, 40), p_rotulo: String(body.rotulo ?? "").slice(0, 60),
      p_ajuda: String(body.ajuda ?? "").slice(0, 240), p_ordem: Number(body.ordem), p_ativo: body.ativo !== false,
    };
  } else if (action === "configurarMomento") {
    rpc = "f2_configurar_momento";
    args = {
      p_codigo: String(body.codigo ?? "").slice(0, 50), p_etapa: String(body.etapa ?? "").slice(0, 40),
      p_rotulo: String(body.rotulo ?? "").slice(0, 80), p_descricao: String(body.descricao ?? "").slice(0, 300),
      p_acao_rotulo: String(body.acaoRotulo ?? "").slice(0, 120), p_prazo_minutos: Number(body.prazoMinutos),
      p_ordem: Number(body.ordem), p_exige_dapi: body.exigeDapi === true, p_ativo: body.ativo !== false,
    };
  } else if (action === "salvarVisita") {
    const inicio = new Date(String(body.inicioEm ?? ""));
    if (Number.isNaN(inicio.getTime())) return Response.json({ error: "Data da visita inválida." }, { status: 422 });
    rpc = "f2_salvar_visita";
    args = { p_id: body.id || null, p_lead_id: body.leadId, p_inicio_em: inicio.toISOString(), p_imovel: String(body.imovel ?? "").slice(0, 120), p_status: body.status || "agendada", p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "salvarNegociacao") {
    rpc = "f2_salvar_negociacao";
    args = { p_id: body.id || null, p_lead_id: body.leadId, p_titulo: String(body.titulo ?? "").slice(0, 120), p_etapa: body.etapa || "qualificacao", p_valor: body.valor === "" || body.valor == null ? null : Number(body.valor), p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "pescar") {
    rpc = "f2_pescar_negocio";
    args = { p_negocio_id: Number(body.negocioId), p_substituir_id: null };
  } else if (action === "configurarOperacao") {
    rpc = "f2_configurar_operacao";
    args = {
      p_horario_inicio: body.horarioInicio, p_horario_fim: body.horarioFim,
      p_presenca_ttl_min: Number(body.presencaTtlMin), p_primeira_abordagem_min: Number(body.primeiraAbordagemMin),
      p_feedback_visita_min: Number(body.feedbackVisitaMin), p_notificacao_urgente_min: Number(body.notificacaoUrgenteMin),
      p_peso_primeira_abordagem: Number(body.pesoPrimeiraAbordagem), p_peso_acoes_prazo: Number(body.pesoAcoesPrazo),
      p_peso_feedback_visita: Number(body.pesoFeedbackVisita), p_peso_presenca_dapi: Number(body.pesoPresencaDapi),
      p_peso_coerencia_sara: Number(body.pesoCoerenciaSara), p_suspensao_nivel_1_h: Number(body.suspensaoNivel1H),
      p_suspensao_nivel_2_h: Number(body.suspensaoNivel2H), p_suspensao_nivel_3_h: Number(body.suspensaoNivel3H),
    };
  } else {
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  const { data, error } = await auth.db.rpc(rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
  if (resultado.ok === false) return Response.json({ error: resultado.erro || "Ação não permitida." }, { status: 409 });
  return Response.json({ ok: true, resultado });
}

export async function PATCH(request: Request) {
  const auth = await clienteAutenticado(request);
  if (auth.erro) return auth.erro;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  const versao = Number(body.versao);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(versao) || versao < 1) {
    return Response.json({ error: "Lead ou versão inválidos." }, { status: 422 });
  }

  const db = auth.db;
  const action = String(body.action ?? "");
  let rpc = "";
  let args: Record<string, unknown> = {};
  if (action === "atualizarMomento") {
    const momento = String(body.momentoCodigo ?? "");
    if (!/^[A-Z_]{3,50}$/.test(momento)) return Response.json({ error: "Momento inválido." }, { status: 422 });
    const prazo = body.prazoCombinado ? new Date(String(body.prazoCombinado)) : null;
    if (prazo && Number.isNaN(prazo.getTime())) return Response.json({ error: "Prazo combinado inválido." }, { status: 422 });
    rpc = "f2_atualizar_momento";
    args = { p_id: id, p_versao: versao, p_momento_codigo: momento, p_prazo_combinado: prazo?.toISOString() ?? null, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else if (action === "confirmarAcao") {
    const fonte = body.fonte === "dapi" ? "dapi" : body.fonte === "registro_operacional" ? "registro_operacional" : "";
    if (!fonte) return Response.json({ error: "Fonte de confirmação inválida." }, { status: 422 });
    rpc = "f2_confirmar_acao";
    args = { p_id: id, p_versao: versao, p_fonte: fonte, p_observacao: String(body.observacao ?? "").slice(0, 500) || null };
  } else {
    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  const { data, error } = await db.rpc(rpc, args);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const resultado = (data ?? {}) as { ok?: boolean; erro?: string };
  if (resultado.ok === false) return Response.json({ error: resultado.erro || "Ação não permitida." }, { status: 409 });
  return Response.json({ ok: true, resultado });
}
