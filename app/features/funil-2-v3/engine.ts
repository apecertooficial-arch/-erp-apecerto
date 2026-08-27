import type { ActivityV3, CrmV3State, DealV3, HistoryV3, LeadV3, MoveResult, MutationSource, VisitFeedbackV3, VisitV3 } from "./types";

function clone(state: CrmV3State): CrmV3State {
  return structuredClone(state);
}

function event(leadId: string, title: string, detail: string, actor: HistoryV3["actor"] = "human"): HistoryV3 {
  return { id: `history-${crypto.randomUUID()}`, leadId, title, detail, actor, createdAt: new Date().toISOString() };
}

export function summaries(state: CrmV3State, pipelineId: string) {
  const deals = state.deals.filter((item) => item.pipelineId === pipelineId);
  return {
    open: deals.filter((item) => item.status === "open").length,
    won: deals.filter((item) => item.status === "won").length,
    lost: deals.filter((item) => item.status === "lost").length,
    value: deals.filter((item) => item.status === "open").reduce((total, item) => total + item.value, 0),
  };
}

export function stageSummary(state: CrmV3State, pipelineId: string, stageId: string) {
  const deals = state.deals.filter((item) => item.pipelineId === pipelineId && item.stageId === stageId && item.status === "open");
  return { count: deals.length, value: deals.reduce((total, item) => total + item.value, 0) };
}

export function moveDeals(
  state: CrmV3State,
  ids: string[],
  targetPipelineId: string,
  targetStageId: string,
  source: MutationSource,
  offline = false,
): MoveResult {
  if (offline) return { ok: false, state, code: "offline", message: "Sem conexão. Movimentações ficam indisponíveis no modo cache." };
  const targetPipeline = state.pipelines.find((item) => item.id === targetPipelineId);
  const targetStage = targetPipeline?.stages.find((item) => item.id === targetStageId);
  if (!targetPipeline || !targetStage) return { ok: false, state, code: "invalid_target", message: "Pipeline ou etapa de destino inválida." };
  const found = state.deals.filter((item) => ids.includes(item.id));
  if (found.length !== ids.length) return { ok: false, state, code: "not_found", message: "Um dos negócios não foi encontrado." };
  if (targetStage.requiresActivity) {
    const blocked = found.find((deal) => !state.activities.some((activity) => activity.dealId === deal.id && activity.status === "pending"));
    if (blocked) return { ok: false, state, code: "activity_required", message: "Crie uma atividade pendente antes de mover para Visita." };
  }
  const next = clone(state);
  next.deals = next.deals.map((deal) => ids.includes(deal.id) ? {
    ...deal,
    lastValidPosition: { pipelineId: deal.pipelineId, stageId: deal.stageId },
    pipelineId: targetPipelineId,
    stageId: targetStageId,
    status: "open",
    lossReason: undefined,
  } : deal);
  for (const deal of found) next.history.push(event(deal.leadId, "Negócio movimentado", `${source}: ${deal.stageId} → ${targetStageId}`));
  return { ok: true, state: next, message: ids.length > 1 ? `${ids.length} negócios movidos.` : `Negócio movido para ${targetStage.label}.` };
}

export function markWon(state: CrmV3State, ids: string[], offline = false): MoveResult {
  if (offline) return { ok: false, state, code: "offline", message: "Sem conexão. Ganhar negócio está indisponível." };
  const found = state.deals.filter((deal) => ids.includes(deal.id));
  if (found.length !== ids.length) return { ok: false, state, code: "not_found", message: "Negócio não encontrado." };
  const next = clone(state);
  next.deals = next.deals.map((deal) => ids.includes(deal.id) ? { ...deal, status: "won", lastValidPosition: { pipelineId: deal.pipelineId, stageId: deal.stageId } } : deal);
  for (const deal of found) next.history.push(event(deal.leadId, "Negócio ganho", deal.title));
  return { ok: true, state: next, message: ids.length > 1 ? `${ids.length} negócios marcados como ganhos.` : "Negócio marcado como ganho." };
}

export function markLost(state: CrmV3State, ids: string[], reason: string, offline = false): MoveResult {
  if (offline) return { ok: false, state, code: "offline", message: "Sem conexão. Perder negócio está indisponível." };
  if (!reason.trim()) return { ok: false, state, code: "invalid_target", message: "Informe o motivo da perda." };
  const found = state.deals.filter((deal) => ids.includes(deal.id));
  if (found.length !== ids.length) return { ok: false, state, code: "not_found", message: "Negócio não encontrado." };
  const next = clone(state);
  next.deals = next.deals.map((deal) => ids.includes(deal.id) ? { ...deal, status: "lost", lossReason: reason, lastValidPosition: { pipelineId: deal.pipelineId, stageId: deal.stageId } } : deal);
  for (const deal of found) next.history.push(event(deal.leadId, "Negócio perdido", reason));
  return { ok: true, state: next, message: ids.length > 1 ? `${ids.length} negócios marcados como perdidos.` : "Negócio marcado como perdido." };
}

export function restoreDeal(state: CrmV3State, id: string, offline = false): MoveResult {
  if (offline) return { ok: false, state, code: "offline", message: "Sem conexão. Restaurar negócio está indisponível." };
  const found = state.deals.find((deal) => deal.id === id);
  if (!found) return { ok: false, state, code: "not_found", message: "Negócio não encontrado." };
  const position = found.lastValidPosition ?? { pipelineId: found.pipelineId, stageId: found.stageId };
  const next = clone(state);
  next.deals = next.deals.map((deal) => deal.id === id ? { ...deal, ...position, status: "open", lossReason: undefined } : deal);
  next.history.push(event(found.leadId, "Negócio restaurado", `Retornou para ${position.stageId}`));
  return { ok: true, state: next, message: "Negócio restaurado para a última posição válida." };
}

export function createLead(state: CrmV3State, input: Omit<LeadV3, "id" | "createdAt">): CrmV3State {
  const next = clone(state);
  next.leads.unshift({ ...input, id: `lead-${crypto.randomUUID()}`, createdAt: new Date().toISOString() });
  return next;
}

export function createDeal(state: CrmV3State, input: Omit<DealV3, "id" | "status" | "lastValidPosition">): CrmV3State {
  if (!state.leads.some((lead) => lead.id === input.leadId)) throw new Error("Selecione um lead existente.");
  const next = clone(state);
  const created: DealV3 = { ...input, id: `deal-${crypto.randomUUID()}`, status: "open" };
  next.deals.unshift(created);
  next.history.push(event(created.leadId, "Negócio criado", `${created.title} · ${created.property}`));
  return next;
}

export function saveActivity(state: CrmV3State, input: Omit<ActivityV3, "id" | "status"> & { id?: string }): CrmV3State {
  const next = clone(state);
  if (input.id) {
    next.activities = next.activities.map((activity) => activity.id === input.id ? { ...activity, ...input } : activity);
    next.history.push(event(input.leadId, "Atividade editada", input.title));
    return next;
  }
  const created: ActivityV3 = { ...input, id: `activity-${crypto.randomUUID()}`, status: "pending" };
  next.activities.unshift(created);
  next.history.push(event(created.leadId, "Atividade criada", created.title));
  return next;
}

export function completeActivity(state: CrmV3State, id: string): CrmV3State {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return state;
  const next = clone(state);
  next.activities = next.activities.map((item) => item.id === id ? { ...item, status: "done" } : item);
  next.history.push(event(activity.leadId, "Atividade concluída", activity.title));
  return next;
}

export function deleteActivity(state: CrmV3State, id: string): CrmV3State {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return state;
  const next = clone(state);
  next.activities = next.activities.filter((item) => item.id !== id);
  next.history.push(event(activity.leadId, "Atividade excluída", activity.title));
  return next;
}

export function saveVisit(state: CrmV3State, input: Omit<VisitV3, "id" | "status" | "feedback"> & { id?: string }): CrmV3State {
  const next = clone(state);
  if (input.id) {
    next.visits = next.visits.map((visit) => visit.id === input.id ? { ...visit, ...input } : visit);
    next.history.push(event(input.leadId, "Visita editada", input.property));
    return next;
  }
  const created: VisitV3 = { ...input, id: `visit-${crypto.randomUUID()}`, status: "scheduled", feedback: null };
  next.visits.unshift(created);
  next.activities.unshift({ id: `activity-${crypto.randomUUID()}`, leadId: created.leadId, dealId: created.dealId, kind: "Visita", title: `Visita · ${created.property}`, dueAt: created.startsAt, durationMinutes: created.durationMinutes, owner: created.owner, status: "pending" });
  next.history.push(event(created.leadId, "Visita agendada", created.property));
  return next;
}

export function confirmVisit(state: CrmV3State, id: string): CrmV3State {
  const visit = state.visits.find((item) => item.id === id);
  if (!visit) return state;
  const next = clone(state);
  next.visits = next.visits.map((item) => item.id === id ? { ...item, status: "confirmed" } : item);
  next.history.push(event(visit.leadId, "Visita confirmada", visit.property));
  return next;
}

export function completeVisit(state: CrmV3State, id: string): CrmV3State {
  const visit = state.visits.find((item) => item.id === id);
  if (!visit) return state;
  const next = clone(state);
  next.visits = next.visits.map((item) => item.id === id ? { ...item, status: "completed" } : item);
  next.history.push(event(visit.leadId, "Visita realizada", visit.property));
  return next;
}

export function saveVisitFeedback(state: CrmV3State, id: string, feedback: VisitFeedbackV3): CrmV3State {
  if (!feedback.liked.trim() || !feedback.objections.trim() || !feedback.nextStep.trim()) throw new Error("Preencha o feedback completo antes de salvar.");
  const visit = state.visits.find((item) => item.id === id);
  if (!visit) return state;
  const next = clone(state);
  next.visits = next.visits.map((item) => item.id === id ? { ...item, status: "completed", feedback } : item);
  next.history.push(event(visit.leadId, "Feedback da visita registrado", feedback.nextStep));
  return next;
}

export function feedbackPending(state: CrmV3State) {
  return state.visits.filter((visit) => visit.status === "completed" && visit.feedback === null);
}

export function confirmDapiAction(state: CrmV3State, dealId: string, confirmedByDapi: boolean) {
  const deal = state.deals.find((item) => item.id === dealId);
  if (!deal) return { state, confirmed: false, message: "Negócio não encontrado." };
  if (!confirmedByDapi) return { state, confirmed: false, message: "Aguardando confirmação do D-API. O clique não concluiu a ação." };
  const next = clone(state);
  next.history.push(event(deal.leadId, "Ação confirmada pelo D-API", deal.nextAction ?? "Ação comercial", "dapi"));
  return { state: next, confirmed: true, message: "D-API confirmou a ação." };
}

