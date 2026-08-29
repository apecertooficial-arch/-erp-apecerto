/**
 * API canônica da Agenda.
 *
 * Mobile e desktop leem o mesmo endpoint. Visitas novas nascem na ficha do
 * lead no CRM; compromissos existentes podem ser reagendados no calendário.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { denyIfCannot, resolveEffectiveAccess } from "../../lib/supabase/authz";
import { instanteSaoPaulo } from "../../lib/timezone";

export const dynamic = "force-dynamic";

const GESTAO_AGENDA = new Set(["admin", "gestor", "gerente", "diretor", "executivo", "gestor_comercial", "gestor_equipe"]);

type Authenticated = {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  user: { id: string };
};

async function autenticar(request: Request): Promise<Authenticated | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

function texto(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function lerData(bruto: string | null): string | null {
  if (!bruto || !/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return null;
  return Number.isNaN(Date.parse(bruto)) ? null : bruto;
}

function lerPeriodo(bruto: string | null): "dia" | "semana" | "mes" {
  return bruto === "semana" || bruto === "mes" ? bruto : "dia";
}

export async function GET(request: Request) {
  const auth = await autenticar(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const supabase = auth.supabase as unknown as SupabaseClient;
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  if (!access.resolved) return Response.json({ error: "Perfil operacional não encontrado." }, { status: 403 });
  const gestao = GESTAO_AGENDA.has(access.role.toLowerCase());
  const corretorAtual = gestao ? { data: null, error: null } : await auth.supabase.rpc("f2_corretor_atual");
  const corretorId = corretorAtual.data == null ? null : Number(corretorAtual.data);
  if (!gestao && (!Number.isSafeInteger(corretorId) || Number(corretorId) < 1)) {
    return Response.json({ error: "Corretor não vinculado à sessão." }, { status: 403 });
  }
  const agenda = await supabase.rpc("ncrm_agenda_corretor", {
    p_data: lerData(params.get("data")),
    p_periodo: lerPeriodo(params.get("periodo")),
  });
  if (agenda.error) return Response.json({ ok: false, error: "Falha ao carregar a agenda." }, { status: 502 });

  const result = (agenda.data ?? {}) as Record<string, unknown>;
  if (result.ok === false) {
    return Response.json({ ok: false, erro: result.erro }, { status: result.erro === "nao_autenticado" ? 403 : 409 });
  }
  if (params.get("workspace") !== "1") {
    const itens = Array.isArray(result.itens) ? result.itens as Array<Record<string, unknown>> : [];
    return Response.json(gestao
      ? { ...result, scope: "equipe" }
      : { ok: true, scope: "propria", itens: itens.filter((item) => item.meu === true) });
  }

  const cardsQuery = auth.supabase.from("f2_lead").select("origem_negocio_id")
    .is("descartado_em", null).not("origem_negocio_id", "is", null);
  const visitsQuery = auth.supabase.from("visitas")
    .select("id,lead_id,negocio_id,corretor_id,cliente_nome,produto,empreendimento_id,data,hora_inicio,hora_fim,local,observacoes,com_gerente,gerente_id,status")
    .order("data").order("hora_inicio");
  const tasksQuery = auth.supabase.from("crm_tarefas")
    .select("id,lead_id,corretor_id,titulo,vencimento,concluida,prioridade").order("vencimento");
  const [cards, brokers, products, visits, tasks, gerentes] = await Promise.all([
    gestao ? cardsQuery : cardsQuery.eq("corretor_id", corretorId!),
    gestao
      ? auth.supabase.rpc("listar_corretores_transferencia")
      : auth.supabase.from("corretores").select("id,nome").eq("id", corretorId!),
    auth.supabase.from("empreendimentos").select("id,nome").eq("rascunho", false).order("nome").limit(500),
    gestao ? visitsQuery : visitsQuery.eq("corretor_id", corretorId!),
    gestao ? tasksQuery : tasksQuery.eq("corretor_id", corretorId!),
    auth.supabase.from("gerentes").select("id,nome,geral,corretor_id").eq("ativo", true).order("geral", { ascending: false }),
  ]);
  const firstError = [cards, brokers, products, visits, tasks, gerentes].find((item) => item.error)?.error;
  if (firstError) return Response.json({ error: "Não foi possível carregar os dados da agenda." }, { status: 502 });

  const negocioIds = [...new Set((cards.data ?? []).map((item) => Number(item.origem_negocio_id)).filter(Number.isSafeInteger))];
  const deals = negocioIds.length
    ? await auth.supabase.from("negocios").select("id,lead_id,corretor_id").in("id", negocioIds).eq("status", "aberto")
    : { data: [], error: null };
  if (deals.error) return Response.json({ error: "Não foi possível carregar os negócios ativos." }, { status: 502 });

  const leadIds = [...new Set((deals.data ?? []).map((item) => Number(item.lead_id)).filter(Number.isSafeInteger))];
  const leads = leadIds.length
    ? await auth.supabase.from("leads").select("id,nome,telefone,email,status,origem,corretor_id").in("id", leadIds)
    : { data: [], error: null };
  if (leads.error) return Response.json({ error: "Não foi possível carregar os clientes ativos." }, { status: 502 });

  const itensSeguros = gestao
    ? (Array.isArray(result.itens) ? result.itens : [])
    : (Array.isArray(result.itens) ? (result.itens as Array<Record<string, unknown>>).filter((item) => item.meu === true) : []);
  return Response.json({
    ok: true,
    itens: itensSeguros,
    scope: gestao ? "equipe" : "propria",
    brokers: brokers.data ?? [],
    leads: leads.data ?? [],
    deals: deals.data ?? [],
    products: products.data ?? [],
    visits: visits.data ?? [],
    tasks: tasks.data ?? [],
    gerentes: gerentes.data ?? [],
    role: access.role,
  });
}

export async function PATCH(request: Request) {
  const auth = await autenticar(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const db = auth.supabase;
  const rpcDb = db as unknown as SupabaseClient;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });

  const action = texto(body.action, 60);
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  if (!access.resolved) return Response.json({ error: "Perfil operacional não encontrado." }, { status: 403 });
  const guard = (verb: "editar", message: string) =>
    denyIfCannot(access, [["calendario", verb], ["crm", verb]], message);

  async function visitaOperavel(visitId: string) {
    const { data: visit, error } = await db.from("visitas")
      .select("id,negocio_id,corretor_id,data,hora_inicio,hora_fim,produto,empreendimento_id,unidade,observacoes,status,com_gerente,gerente_id")
      .eq("id", visitId).maybeSingle();
    if (error) return { response: Response.json({ error: "Não foi possível consultar a visita." }, { status: 502 }) };
    if (!visit) return { response: Response.json({ error: "Visita não encontrada." }, { status: 404 }) };

    const gestao = GESTAO_AGENDA.has(access.role.toLowerCase());
    if (!gestao) {
      const { data: atual, error: erroAtual } = await db.rpc("f2_corretor_atual");
      const corretorId = Number(atual);
      if (erroAtual || !Number.isSafeInteger(corretorId) || corretorId < 1 || visit.corretor_id !== corretorId) {
        return { response: Response.json({ error: "Você só pode alterar as suas visitas." }, { status: 403 }) };
      }
    }
    if (!visit.negocio_id) return { response: Response.json({ error: "A visita não está ligada a um negócio." }, { status: 409 }) };
    const { data: card, error: erroCard } = await db.from("f2_lead").select("id")
      .eq("origem_negocio_id", visit.negocio_id).is("descartado_em", null).maybeSingle();
    if (erroCard) return { response: Response.json({ error: "Não foi possível consultar o atendimento." }, { status: 502 }) };
    if (!card) return { response: Response.json({ error: "A visita não está ligada a um negócio ativo no Funil 2.0." }, { status: 409 }) };
    return { visit, card };
  }

  if (action === "visitAvailability") {
    const visitId = texto(body.visitId, 40);
    const date = lerData(texto(body.data, 10));
    if (!visitId || !date) return Response.json({ error: "Visita ou data inválida." }, { status: 422 });
    const denied = guard("editar", "Você não tem permissão para reagendar visitas.");
    if (denied) return denied;
    const lookup = await visitaOperavel(visitId);
    if ("response" in lookup) return lookup.response;
    const { data: disponibilidade, error } = await rpcDb.rpc("f2_disponibilidade_visitas", {
      p_lead_id: lookup.card.id,
      p_data: date,
      p_gerente_id: lookup.visit.com_gerente === true ? lookup.visit.gerente_id : null,
      p_visita_id: visitId,
    } as never);
    if (error) return Response.json({ error: "Não foi possível consultar os horários." }, { status: 502 });
    const resultado = (disponibilidade ?? {}) as { ok?: boolean; horarios?: Array<{ inicio?: unknown; fim?: unknown; estado?: unknown }> };
    if (resultado.ok !== true) return Response.json({ error: "Não foi possível consultar os horários." }, { status: 409 });
    const estados = new Set(["disponivel", "indisponivel", "meu"]);
    const horarios = (resultado.horarios ?? []).flatMap((horario) => {
      const inicio = typeof horario.inicio === "string" && /^\d{2}:\d{2}$/.test(horario.inicio) ? horario.inicio : null;
      const fim = typeof horario.fim === "string" && /^\d{2}:\d{2}$/.test(horario.fim) ? horario.fim : null;
      const estado = typeof horario.estado === "string" && estados.has(horario.estado) ? horario.estado : null;
      return inicio && fim && estado ? [{ inicio, fim, estado }] : [];
    });
    return Response.json({ ok: true, data: date, duracao_min: 60, horarios });
  }

  if (action === "updateVisit") {
    const visitId = texto(body.visitId, 40);
    const date = lerData(texto(body.date, 10));
    const startTime = texto(body.startTime, 8);
    if (!visitId || !date || !/^\d{2}:\d{2}(?::\d{2})?$/.test(startTime)) {
      return Response.json({ error: "Informe uma data e um horário válidos." }, { status: 422 });
    }
    const denied = guard("editar", "Você não tem permissão para reagendar visitas.");
    if (denied) return denied;
    const lookup = await visitaOperavel(visitId);
    if ("response" in lookup) return lookup.response;
    if (!["agendada", "confirmada"].includes(String(lookup.visit.status).toLowerCase())) {
      return Response.json({ error: "Somente visitas ativas podem ser reagendadas." }, { status: 409 });
    }
    const inicioEm = instanteSaoPaulo(date, startTime);
    if (!inicioEm) return Response.json({ error: "Data ou horário inválido." }, { status: 422 });
    const fimEm = new Date(new Date(inicioEm).getTime() + 60 * 60 * 1000).toISOString();
    const { data: result, error } = await rpcDb.rpc("f2_reagendar_visita", {
      p_visita_id: visitId,
      p_inicio_em: inicioEm,
      p_fim_em: fimEm,
    } as never);
    const outcome = result as { ok?: boolean; erro?: string } | null;
    const conflito = error?.message?.includes("ocupado") || ["horario_ocupado", "corretor_ocupado", "gerente_ocupado"].includes(outcome?.erro ?? "");
    if (error || !outcome?.ok) return Response.json({
      error: conflito ? "Esse horário não está mais disponível. Escolha outro." : "Não foi possível reagendar a visita.",
    }, { status: conflito ? 409 : 502 });
    return Response.json({ success: true });
  }

  if (action === "updateVisitStatus") {
    const visitId = texto(body.visitId, 40);
    const status = texto(body.status, 30);
    if (!visitId || !["agendada", "realizada", "cancelada"].includes(status)) return Response.json({ error: "Visita ou status inválido." }, { status: 400 });
    const denied = guard("editar", "Você não tem permissão para alterar o status de visitas.");
    if (denied) return denied;
    const lookup = await visitaOperavel(visitId);
    if ("response" in lookup) return lookup.response;
    const { visit, card } = lookup;
    const observation = status === "cancelada" ? (texto(body.reason, 500) || visit.observacoes) : visit.observacoes;
    const { data: result, error } = await auth.supabase.rpc("f2_salvar_visita", {
      p_id: visitId, p_lead_id: card.id,
      p_inicio_em: visit.hora_inicio ? instanteSaoPaulo(String(visit.data), String(visit.hora_inicio)) : null,
      p_fim_em: visit.hora_fim ? instanteSaoPaulo(String(visit.data), String(visit.hora_fim)) : null,
      p_imovel: visit.produto || "Visita", p_status: status, p_observacao: observation,
      p_empreendimento_id: visit.empreendimento_id, p_unidade: visit.unidade,
      p_com_gerente: visit.com_gerente === true, p_gerente_id: visit.gerente_id,
    } as never);
    const outcome = result as { ok?: boolean; erro?: string } | null;
    if (error || !outcome?.ok) return Response.json({ error: "Não foi possível alterar a visita." }, { status: 502 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação de agenda inválida." }, { status: 400 });
}
