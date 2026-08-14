/**
 * API canônica da Agenda.
 *
 * Mobile e desktop leem o mesmo endpoint. O modo workspace acrescenta os
 * catálogos necessários para editar visitas; os negócios disponíveis vêm
 * somente da carteira ativa do Funil 2.0, nunca da base histórica de recall.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { TablesUpdate } from "../../lib/supabase/database.types";
import { denyIfCannot, resolveEffectiveAccess } from "../../lib/supabase/authz";

export const dynamic = "force-dynamic";

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

function inteiroPositivo(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function instanteSaoPaulo(data: string, hora: string | null) {
  if (!data || !hora) return null;
  const instante = new Date(`${data}T${hora.slice(0, 8)}-03:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
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
  const agenda = await supabase.rpc("ncrm_agenda_corretor", {
    p_data: lerData(params.get("data")),
    p_periodo: lerPeriodo(params.get("periodo")),
  });
  if (agenda.error) return Response.json({ ok: false, error: "Falha ao carregar a agenda." }, { status: 502 });

  const result = (agenda.data ?? {}) as Record<string, unknown>;
  if (result.ok === false) {
    return Response.json({ ok: false, erro: result.erro }, { status: result.erro === "nao_autenticado" ? 403 : 409 });
  }
  if (params.get("workspace") !== "1") return Response.json(result);

  const [cards, brokers, products, visits, tasks, gerentes, profile] = await Promise.all([
    auth.supabase.from("f2_lead").select("origem_negocio_id").is("descartado_em", null).not("origem_negocio_id", "is", null),
    auth.supabase.rpc("listar_corretores_transferencia"),
    auth.supabase.from("empreendimentos").select("id,nome").eq("rascunho", false).order("nome").limit(500),
    auth.supabase.from("visitas").select("id,lead_id,negocio_id,corretor_id,cliente_nome,produto,empreendimento_id,data,hora_inicio,hora_fim,local,observacoes,com_gerente,gerente_id,status").order("data").order("hora_inicio"),
    auth.supabase.from("crm_tarefas").select("id,lead_id,corretor_id,titulo,vencimento,concluida,prioridade").order("vencimento"),
    auth.supabase.from("gerentes").select("id,nome,geral,corretor_id").eq("ativo", true).order("geral", { ascending: false }),
    auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle(),
  ]);
  const firstError = [cards, brokers, products, visits, tasks, gerentes, profile].find((item) => item.error)?.error;
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

  return Response.json({
    ...result,
    brokers: brokers.data ?? [],
    leads: leads.data ?? [],
    deals: deals.data ?? [],
    products: products.data ?? [],
    visits: visits.data ?? [],
    tasks: tasks.data ?? [],
    gerentes: gerentes.data ?? [],
    role: profile.data?.role ?? "",
  });
}

export async function PATCH(request: Request) {
  const auth = await autenticar(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });

  const action = texto(body.action, 60);
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  const guard = (verb: "criar" | "editar", message: string) =>
    denyIfCannot(access, [["calendario", verb], ["crm", verb]], message);

  if (action === "createVisit") {
    const leadId = inteiroPositivo(body.leadId);
    const dealId = inteiroPositivo(body.dealId);
    const date = texto(body.date, 10);
    const startTime = texto(body.startTime, 8);
    const productId = texto(body.productId, 40) || null;
    if (!leadId || !dealId || !date || !startTime) return Response.json({ error: "Informe data e horário da visita." }, { status: 422 });
    const denied = guard("criar", "Você não tem permissão para agendar visitas.");
    if (denied) return denied;

    const [{ data: lead }, { data: deal }, { data: card }, { data: product }] = await Promise.all([
      auth.supabase.from("leads").select("nome").eq("id", leadId).maybeSingle(),
      auth.supabase.from("negocios").select("corretor_id").eq("id", dealId).eq("lead_id", leadId).maybeSingle(),
      auth.supabase.from("f2_lead").select("id").eq("origem_negocio_id", dealId).is("descartado_em", null).maybeSingle(),
      productId ? auth.supabase.from("empreendimentos").select("id,nome,endereco,numero,bairro,cidade").eq("id", productId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!lead || !deal || !card) return Response.json({ error: "O negócio não está ativo no Funil 2.0." }, { status: 404 });

    const local = texto(body.local, 300) || (product ? [product.endereco, product.numero, product.bairro, product.cidade].filter(Boolean).join(", ") : null);
    const comGerente = body.withManager === true;
    let gerenteId: number | null = null;
    if (comGerente) {
      gerenteId = inteiroPositivo(body.gerenteId);
      if (!gerenteId) {
        const { data: geral } = await auth.supabase.from("gerentes").select("id").eq("ativo", true).eq("geral", true).maybeSingle();
        gerenteId = geral?.id ?? null;
      }
    }
    const inicioEm = instanteSaoPaulo(date, startTime);
    if (!inicioEm) return Response.json({ error: "Data ou horário inválido." }, { status: 422 });
    const fimEm = instanteSaoPaulo(date, texto(body.endTime, 8) || null);
    const { data: result, error } = await auth.supabase.rpc("f2_salvar_visita", {
      p_id: null, p_lead_id: card.id, p_inicio_em: inicioEm,
      p_imovel: product?.nome ?? (texto(body.productName, 180) || local || "Visita"),
      p_status: "agendada", p_observacao: texto(body.observations, 500) || null,
      p_empreendimento_id: product?.id ?? null, p_unidade: null,
      p_com_gerente: comGerente, p_gerente_id: gerenteId, p_fim_em: fimEm,
    } as never);
    const outcome = result as { ok?: boolean; id?: string; erro?: string } | null;
    if (error || !outcome?.ok) return Response.json({ error: error?.message ?? `Não foi possível agendar a visita (${outcome?.erro ?? "erro desconhecido"}).` }, { status: 502 });
    return Response.json({ success: true, visitaId: outcome.id ?? null });
  }

  if (action === "updateVisit") {
    const visitId = texto(body.visitId, 40);
    if (!visitId) return Response.json({ error: "Visita inválida." }, { status: 400 });
    const denied = guard("editar", "Você não tem permissão para editar visitas.");
    if (denied) return denied;
    const { data: current } = await auth.supabase.from("visitas").select("id,negocio_id,data,hora_inicio,hora_fim,produto,empreendimento_id,unidade,observacoes,status,com_gerente,gerente_id").eq("id", visitId).maybeSingle();
    if (!current) return Response.json({ error: "Visita não encontrada." }, { status: 404 });

    const isManager = access.role === "admin" || access.role === "gestor";
    const patch: TablesUpdate<"visitas"> = { atualizado_em: new Date().toISOString() };
    if (typeof body.date === "string" && body.date) patch.data = texto(body.date, 10);
    if (body.startTime !== undefined) patch.hora_inicio = texto(body.startTime, 8) || null;
    if (body.endTime !== undefined) patch.hora_fim = texto(body.endTime, 8) || null;
    if (body.local !== undefined) patch.local = texto(body.local, 300) || null;
    if (body.observations !== undefined) patch.observacoes = texto(body.observations, 1200) || null;
    if (body.productId !== undefined) {
      const productId = texto(body.productId, 40) || null;
      const { data: product } = productId
        ? await auth.supabase.from("empreendimentos").select("id,nome,endereco,numero,bairro,cidade").eq("id", productId).maybeSingle()
        : { data: null };
      patch.empreendimento_id = product?.id ?? null;
      patch.produto = product?.nome ?? null;
      if (!texto(body.local, 300) && product) patch.local = [product.endereco, product.numero, product.bairro, product.cidade].filter(Boolean).join(", ") || null;
    }
    let comGerente = current.com_gerente === true;
    if (isManager && body.withManager !== undefined) {
      comGerente = body.withManager === true;
      patch.com_gerente = comGerente;
    }
    if (comGerente) {
      const chosen = inteiroPositivo(body.gerenteId);
      if (isManager && chosen) patch.gerente_id = chosen;
      else if (current.gerente_id == null) {
        const { data: geral } = await auth.supabase.from("gerentes").select("id").eq("ativo", true).eq("geral", true).maybeSingle();
        patch.gerente_id = geral?.id ?? null;
      }
    } else patch.gerente_id = null;
    if (!current.negocio_id) return Response.json({ error: "A visita não está ligada a um negócio." }, { status: 409 });
    const { data: card } = await auth.supabase.from("f2_lead").select("id").eq("origem_negocio_id", current.negocio_id).is("descartado_em", null).maybeSingle();
    if (!card) return Response.json({ error: "A visita não está ligada a um negócio ativo no Funil 2.0." }, { status: 409 });
    const merged = { ...current, ...patch };
    const { data: result, error } = await auth.supabase.rpc("f2_salvar_visita", {
      p_id: visitId, p_lead_id: card.id,
      p_inicio_em: instanteSaoPaulo(String(merged.data), merged.hora_inicio ? String(merged.hora_inicio) : null),
      p_fim_em: instanteSaoPaulo(String(merged.data), merged.hora_fim ? String(merged.hora_fim) : null),
      p_imovel: merged.produto || "Visita", p_status: merged.status || "agendada",
      p_observacao: merged.observacoes, p_empreendimento_id: merged.empreendimento_id,
      p_unidade: merged.unidade, p_com_gerente: merged.com_gerente === true,
      p_gerente_id: merged.gerente_id,
    } as never);
    const outcome = result as { ok?: boolean; erro?: string } | null;
    return error || !outcome?.ok
      ? Response.json({ error: error?.message ?? `Não foi possível atualizar a visita (${outcome?.erro ?? "erro desconhecido"}).` }, { status: 502 })
      : Response.json({ success: true });
  }

  if (action === "gerenteDisponibilidade") {
    const corretorId = inteiroPositivo(body.corretorId);
    const date = texto(body.date, 10);
    const startTime = texto(body.startTime, 8);
    if (!corretorId || !date || !startTime) return Response.json({ ok: true, conflitos: [] });
    let gerenteId = inteiroPositivo(body.gerenteId);
    if (!gerenteId) {
      const { data } = await auth.supabase.rpc("corretor_gerente", { p_corretor: corretorId });
      gerenteId = Number.isSafeInteger(Number(data)) ? Number(data) : null;
    }
    if (!gerenteId) return Response.json({ ok: true, gerente_id: null, conflitos: [] });
    const { data: conflitos } = await auth.supabase.rpc("gerente_conflitos", {
      p_gerente: gerenteId, p_data: date, p_inicio: startTime,
      p_fim: texto(body.endTime, 8) || startTime, p_exclude: texto(body.visitId, 40) || undefined,
    });
    return Response.json({ ok: true, gerente_id: gerenteId, conflitos: conflitos ?? [] });
  }

  if (action === "updateVisitStatus") {
    const visitId = texto(body.visitId, 40);
    const status = texto(body.status, 30);
    if (!visitId || !["agendada", "realizada", "cancelada"].includes(status)) return Response.json({ error: "Visita ou status inválido." }, { status: 400 });
    const denied = guard("editar", "Você não tem permissão para alterar o status de visitas.");
    if (denied) return denied;
    const { data: visit } = await auth.supabase.from("visitas").select("negocio_id,data,hora_inicio,hora_fim,produto,empreendimento_id,unidade,observacoes,com_gerente,gerente_id").eq("id", visitId).maybeSingle();
    if (!visit) return Response.json({ error: "Visita não encontrada." }, { status: 404 });
    if (!visit.negocio_id) return Response.json({ error: "A visita não está ligada a um negócio." }, { status: 409 });
    const { data: card } = await auth.supabase.from("f2_lead").select("id").eq("origem_negocio_id", visit.negocio_id).is("descartado_em", null).maybeSingle();
    if (!card) return Response.json({ error: "A visita não está ligada a um negócio ativo no Funil 2.0." }, { status: 409 });
    const observation = status === "cancelada" ? (texto(body.reason, 500) || visit.observacoes) : visit.observacoes;
    const { data: result, error } = await auth.supabase.rpc("f2_salvar_visita", {
      p_id: visitId, p_lead_id: card.id,
      p_inicio_em: instanteSaoPaulo(String(visit.data), visit.hora_inicio ? String(visit.hora_inicio) : null),
      p_fim_em: instanteSaoPaulo(String(visit.data), visit.hora_fim ? String(visit.hora_fim) : null),
      p_imovel: visit.produto || "Visita", p_status: status, p_observacao: observation,
      p_empreendimento_id: visit.empreendimento_id, p_unidade: visit.unidade,
      p_com_gerente: visit.com_gerente === true, p_gerente_id: visit.gerente_id,
    } as never);
    const outcome = result as { ok?: boolean; erro?: string } | null;
    return error || !outcome?.ok
      ? Response.json({ error: error?.message ?? `Não foi possível alterar a visita (${outcome?.erro ?? "erro desconhecido"}).` }, { status: 502 })
      : Response.json({ success: true });
  }

  return Response.json({ error: "Ação de agenda inválida." }, { status: 400 });
}
