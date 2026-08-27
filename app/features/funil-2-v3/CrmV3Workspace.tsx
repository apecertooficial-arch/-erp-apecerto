"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rotuloTemperatura } from "../funil-2/modelo";
import { completeActivity, completeVisit, confirmDapiAction, confirmVisit, createDeal, createLead, deleteActivity, feedbackPending, markLost, markWon, moveDeals, restoreDeal, saveActivity, saveVisit, saveVisitFeedback, stageSummary, summaries } from "./engine";
import { createCrmV3Fixture } from "./fixtures";
import type { ActivityV3, CrmV3Area, CrmV3Profile, CrmV3Scenario, CrmV3State, DealV3, MutationSource } from "./types";
import { runLocalValidationMutation } from "./validationAdapter";
import { CrmV3Dialog } from "./CrmV3Dialog";
import { CrmV3Icon, type CrmV3IconName } from "./CrmV3Icon";
import { CrmV3LeadDrawer } from "./CrmV3LeadDrawer";
import { useCrmV3Undo } from "./useCrmV3Undo";

const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const AREAS: Array<{ id: CrmV3Area; label: string; icon: CrmV3IconName; management?: boolean }> = [
  { id: "day", label: "Meu Dia", icon: "day" },
  { id: "deals", label: "Negócios", icon: "deals" },
  { id: "leads", label: "Leads", icon: "leads" },
  { id: "activities", label: "Atividades", icon: "activities" },
  { id: "visits", label: "Visitas", icon: "visits" },
  { id: "sales", label: "Esteira de vendas", icon: "sales" },
  { id: "management", label: "Painel gerencial", icon: "management", management: true },
  { id: "settings", label: "Configurações", icon: "settings", management: true },
  { id: "matrix", label: "Matriz de validação", icon: "matrix", management: true },
];
const MOBILE_AREAS: Array<{ id: CrmV3Area; label: string; icon: CrmV3IconName }> = [
  { id: "day", label: "Meu Dia", icon: "day" }, { id: "deals", label: "Funil", icon: "deals" }, { id: "leads", label: "Leads", icon: "leads" }, { id: "activities", label: "Agenda", icon: "calendar" }, { id: "visits", label: "Visitas", icon: "visits" },
];
type Segment = "open" | "won" | "lost" | "triage";
type ModalKind = "lead" | "deal" | "activity" | "visit" | null;
type UndoSnapshot = {
  state: CrmV3State;
  profile: CrmV3Profile;
  area: CrmV3Area;
  pipelineId: string;
  segment: Segment;
  search: string;
  selected: string[];
  selectionMode: boolean;
  mobileStage: string;
};

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }

export function CrmV3Workspace({ realProfile, realName, localValidation }: { realProfile: CrmV3Profile; realName: string; localValidation: boolean }) {
  const [state, setState] = useState<CrmV3State>(() => createCrmV3Fixture());
  const [scenario, setScenario] = useState<CrmV3Scenario>("normal");
  const [profile, setProfile] = useState<CrmV3Profile>(realProfile);
  const [area, setArea] = useState<CrmV3Area>("deals");
  const [pipelineId, setPipelineId] = useState("comercial-moema");
  const [segment, setSegment] = useState<Segment>("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [focusedDealId, setFocusedDealId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [activityEditing, setActivityEditing] = useState<ActivityV3 | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState("novo");
  const [moreOpen, setMoreOpen] = useState(false);
  const stateRef = useRef(state);
  const mutationInFlight = useRef(false);
  const mutationContext = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const undo = useCrmV3Undo<UndoSnapshot>(useCallback((snapshot) => {
    stateRef.current = snapshot.state;
    setState(snapshot.state);
    setProfile(snapshot.profile);
    setArea(snapshot.area);
    setPipelineId(snapshot.pipelineId);
    setSegment(snapshot.segment);
    setSearch(snapshot.search);
    setSelected(snapshot.selected);
    setSelectionMode(snapshot.selectionMode);
    setMobileStage(snapshot.mobileStage);
    setNotice("Ação desfeita. Estado, filtros, contagens e histórico foram restaurados.");
  }, []));

  const clearSelection = useCallback(() => { setSelected([]); setSelectionMode(false); }, []);
  const invalidateMutationContext = useCallback(() => { mutationContext.current += 1; undo.clear(); }, [undo]);
  const navigate = useCallback((next: CrmV3Area) => { invalidateMutationContext(); clearSelection(); setArea(next); setMoreOpen(false); }, [clearSelection, invalidateMutationContext]);
  const changePipeline = useCallback((next: string) => { invalidateMutationContext(); clearSelection(); setPipelineId(next); setSegment(next === "triagem" ? "triage" : "open"); setMobileStage(state.pipelines.find((item) => item.id === next)?.stages[0]?.id ?? "novo"); }, [clearSelection, invalidateMutationContext, state.pipelines]);
  const changeSegment = useCallback((next: Segment) => { invalidateMutationContext(); clearSelection(); setSegment(next); if (next === "triage") setPipelineId("triagem"); else if (pipelineId === "triagem") setPipelineId("comercial-moema"); }, [clearSelection, invalidateMutationContext, pipelineId]);

  const mutate = useCallback(async (message: string, mutation: (current: CrmV3State) => CrmV3State, undoable = true) => {
    if (mutationInFlight.current) { setError("Aguarde a ação local em andamento terminar."); return false; }
    mutationInFlight.current = true;
    setError(null); setNotice(null);
    const contextAtStart = mutationContext.current;
    const current = stateRef.current;
    const snapshot: UndoSnapshot = {
      state: structuredClone(current), profile, area, pipelineId, segment, search,
      selected: [...selected], selectionMode, mobileStage,
    };
    try {
      const result = await runLocalValidationMutation(scenario, current, mutation);
      if (!mounted.current || contextAtStart !== mutationContext.current) return false;
      if (!result.ok) { setError(result.error); return false; }
      stateRef.current = result.state;
      setState(result.state); setNotice(message);
      if (undoable) undo.arm(snapshot, message);
      return true;
    } finally {
      mutationInFlight.current = false;
    }
  }, [area, mobileStage, pipelineId, profile, scenario, search, segment, selected, selectionMode, undo]);

  const executeMove = useCallback(async (ids: string[], targetPipeline: string, targetStage: string, source: MutationSource) => {
    let resultMessage = "Negócio movido.";
    const ok = await mutate(resultMessage, (current) => {
      const result = moveDeals(current, ids, targetPipeline, targetStage, source);
      if (!result.ok) throw new Error(result.message);
      resultMessage = result.message;
      return result.state;
    });
    if (ok) { setNotice(resultMessage); clearSelection(); }
  }, [clearSelection, mutate]);

  const executeWon = useCallback(async (ids: string[]) => {
    let message = "Negócio marcado como ganho.";
    const ok = await mutate(message, (current) => { const result = markWon(current, ids); if (!result.ok) throw new Error(result.message); message = result.message; return result.state; });
    if (ok) { setNotice(message); clearSelection(); }
  }, [clearSelection, mutate]);
  const executeLost = useCallback(async (ids: string[], reason: string) => {
    let message = "Negócio marcado como perdido.";
    const ok = await mutate(message, (current) => { const result = markLost(current, ids, reason); if (!result.ok) throw new Error(result.message); message = result.message; return result.state; });
    if (ok) { setNotice(message); clearSelection(); }
  }, [clearSelection, mutate]);
  const executeRestore = useCallback(async (id: string) => {
    let message = "Negócio restaurado.";
    const ok = await mutate(message, (current) => { const result = restoreDeal(current, id); if (!result.ok) throw new Error(result.message); message = result.message; return result.state; });
    if (ok) setNotice(message);
  }, [mutate]);

  const scopedState = useMemo<CrmV3State>(() => {
    if (profile !== "corretor") return state;
    const deals = state.deals.filter((deal) => deal.owner === "Bianca Rodrigues");
    const leadIds = new Set(deals.map((deal) => deal.leadId));
    return {
      ...state,
      deals,
      leads: state.leads.filter((lead) => leadIds.has(lead.id)),
      activities: state.activities.filter((activity) => leadIds.has(activity.leadId)),
      visits: state.visits.filter((visit) => leadIds.has(visit.leadId)),
      history: state.history.filter((entry) => leadIds.has(entry.leadId)),
    };
  }, [profile, state]);
  const visibleDeals = useMemo(() => {
    const bySegment = segment === "triage" ? scopedState.deals.filter((deal) => deal.pipelineId === "triagem") : scopedState.deals.filter((deal) => deal.pipelineId === pipelineId && deal.status === segment);
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return bySegment;
    return bySegment.filter((deal) => `${deal.title} ${deal.property} ${scopedState.leads.find((lead) => lead.id === deal.leadId)?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));
  }, [pipelineId, scopedState, search, segment]);
  const pipeline = state.pipelines.find((item) => item.id === pipelineId) ?? state.pipelines[0];
  const summary = summaries(scopedState, pipelineId);
  const focusedDeal = scopedState.deals.find((deal) => deal.id === focusedDealId) ?? null;
  const focusedLead = focusedDeal ? scopedState.leads.find((lead) => lead.id === focusedDeal.leadId) ?? null : null;
  const pendingActivities = scopedState.activities.filter((item) => item.status === "pending");
  const pendingFeedback = feedbackPending(scopedState);
  const offline = scenario === "offline";
  const displayName = profile === realProfile ? realName : profile === "corretor" ? "Bianca Rodrigues" : profile === "gestor" ? "Diego Martins" : "Admin local";

  const openActivity = (activity?: ActivityV3) => {
    setFocusedDealId(null);
    setActivityEditing(activity ?? null);
    setModal("activity");
  };
  const countArea = (id: CrmV3Area) => id === "day" ? pendingActivities.length : id === "deals" ? scopedState.deals.length : id === "leads" ? scopedState.leads.length : id === "activities" ? pendingActivities.length : id === "visits" ? scopedState.visits.length : null;

  return <div className={`crm-v3${localValidation ? "" : " is-preview"}`} data-scenario={scenario}>
    {localValidation && <ValidationBar scenario={scenario} profile={profile} onScenario={(next) => { invalidateMutationContext(); setScenario(next); setError(null); setNotice(null); clearSelection(); }} onProfile={(next) => { invalidateMutationContext(); setProfile(next); clearSelection(); if ((next === "corretor" && ["management", "settings", "matrix"].includes(area)) || (next === "gestor" && area === "matrix")) setArea("deals"); }} />}
    <div className="crm-v3-shell">
      <aside className="crm-v3-sidebar">
        <div className="crm-v3-brand"><strong><span>apê</span>certo</strong><i>CRM V3</i></div>
        <nav aria-label="Áreas do CRM V3">
          <span>Operação</span>
          {AREAS.filter((item) => !item.management).map((item) => <button key={item.id} type="button" className={area === item.id ? "active" : ""} onClick={() => navigate(item.id)}><CrmV3Icon name={item.icon} /><b>{item.label}</b>{countArea(item.id) !== null && <em>{countArea(item.id)}</em>}</button>)}
          <span>Gestão</span>
          {AREAS.filter((item) => item.management && profile !== "corretor" && (item.id !== "matrix" || profile === "admin")).map((item) => <button key={item.id} type="button" className={area === item.id ? "active" : ""} onClick={() => navigate(item.id)}><CrmV3Icon name={item.icon} /><b>{item.label}</b></button>)}
        </nav>
        <footer><span className="crm-v3-avatar">{initials(displayName)}</span><div><strong>{displayName}</strong><small>{profile === "corretor" ? "Corretora · própria carteira" : profile === "gestor" ? "Gestor · equipe" : "Admin · visão completa"}</small></div></footer>
      </aside>

      <main className="crm-v3-main">
        <header className="crm-v3-page-head">
          <div><h1>{area === "deals" ? <><span className="crm-v3-desktop-title">Negócios</span><span className="crm-v3-mobile-title">Funil</span></> : AREAS.find((item) => item.id === area)?.label}</h1><p>{area === "deals" ? `${pipeline.label} · ${pipeline.description}` : area === "day" ? "O que precisa de atenção, em ordem de prazo." : "Experiência paralela com dados locais sanitizados."}</p></div>
          <div><button type="button" className="secondary">Avisos <b>{pendingActivities.length + pendingFeedback.length}</b></button>{area === "deals" && <button type="button" className="primary" onClick={() => setModal("deal")} disabled={offline}><CrmV3Icon name="plus" /> Novo negócio</button>}<button type="button" className="crm-v3-mobile-more" onClick={() => setMoreOpen(true)} aria-label="Mais áreas"><CrmV3Icon name="more" /></button></div>
        </header>

        {offline && <OfflineBanner area={area} onReconnect={() => setScenario("normal")} />}
        {error && <div className="crm-v3-alert error" role="alert"><strong>Não foi possível concluir</strong><span>{error}</span></div>}
        {notice && <div className="crm-v3-alert success" role="status"><strong>Pronto</strong><span>{notice}</span></div>}

        {scenario === "loading" ? <LoadingState /> : scenario === "error" && area !== "matrix" ? <ErrorState onRetry={() => setScenario("normal")} /> : scenario === "empty" ? <EmptyState area={area} /> : <>
          {area === "deals" && <DealsView state={scopedState} pipeline={pipeline} pipelineId={pipelineId} segment={segment} summary={summary} visibleDeals={visibleDeals} search={search} selected={selected} selectionMode={selectionMode} mobileStage={mobileStage} offline={offline} onPipeline={changePipeline} onSegment={changeSegment} onSearch={setSearch} onSelectionMode={() => { setSelectionMode((value) => !value); setSelected([]); }} onSelect={(id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])} onMobileStage={setMobileStage} onOpen={setFocusedDealId} onMove={executeMove} onWon={executeWon} onLost={executeLost} />}
          {area === "day" && <DayView state={scopedState} onOpen={(dealId) => setFocusedDealId(dealId)} onComplete={(id) => void mutate("Atividade concluída.", (current) => completeActivity(current, id))} />}
          {area === "leads" && <LeadsView state={scopedState} profile={profile} onOpen={(leadId) => setFocusedDealId(scopedState.deals.find((deal) => deal.leadId === leadId)?.id ?? null)} onCreate={() => setModal("lead")} />}
          {area === "activities" && <ActivitiesView state={scopedState} onCreate={() => openActivity()} onOpen={openActivity} onComplete={(id) => void mutate("Atividade concluída.", (current) => completeActivity(current, id))} onDelete={(id) => void mutate("Atividade excluída.", (current) => deleteActivity(current, id))} />}
          {area === "visits" && <VisitsView state={scopedState} onCreate={() => setModal("visit")} onConfirm={(id) => void mutate("Visita confirmada.", (current) => confirmVisit(current, id))} onComplete={(id) => void mutate("Visita marcada como realizada. Feedback agora é obrigatório.", (current) => completeVisit(current, id))} onFeedback={(dealId) => { setFocusedDealId(dealId); }} />}
          {area === "sales" && <SalesView state={scopedState} />}
          {area === "management" && <ManagementView state={scopedState} profile={profile} />}
          {area === "settings" && <SettingsView state={scopedState} profile={profile} />}
          {area === "matrix" && <MatrixView profile={profile} />}
        </>}
      </main>
    </div>

    <nav className="crm-v3-mobile-nav" aria-label="Navegação do CRM V3 no celular">{MOBILE_AREAS.map((item) => <button key={item.id} type="button" className={area === item.id ? "active" : ""} onClick={() => navigate(item.id)}><CrmV3Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>
    {area === "deals" && <button type="button" className="crm-v3-mobile-cta" onClick={() => setModal("deal")} disabled={offline}>Novo negócio</button>}
    {moreOpen && <div className="crm-v3-more-layer" onClick={() => setMoreOpen(false)}><section role="dialog" aria-modal="true" aria-label="Mais áreas" onClick={(event) => event.stopPropagation()}><header><strong>Mais</strong><button type="button" onClick={() => setMoreOpen(false)} aria-label="Fechar"><CrmV3Icon name="close" /></button></header>{AREAS.filter((item) => item.id === "sales" || (item.management && profile !== "corretor" && (item.id !== "matrix" || profile === "admin"))).map((item) => <button key={item.id} type="button" onClick={() => navigate(item.id)}><CrmV3Icon name={item.icon} />{item.label}<CrmV3Icon name="arrow" /></button>)}</section></div>}

    {selected.length > 0 && <BulkBar count={selected.length} pipeline={pipeline} onMove={(stageId) => void executeMove(selected, pipelineId, stageId, "bulk")} onWon={() => void executeWon(selected)} onLost={() => void executeLost(selected, "Sem interesse")} onClear={clearSelection} />}
    {undo.entry && <div className="crm-v3-undo" role="status" tabIndex={0} onMouseEnter={undo.pause} onMouseLeave={undo.resume} onFocus={undo.pause} onBlur={undo.resume}><div><strong>{undo.entry.message}</strong><span>Você pode desfazer por {Math.ceil(undo.entry.remainingMs / 1000)}s ativos.</span></div><button type="button" onClick={undo.undo}>Desfazer</button></div>}

    {focusedDeal && focusedLead && <CrmV3LeadDrawer state={scopedState} deal={focusedDeal} lead={focusedLead} onClose={() => setFocusedDealId(null)} onDapi={() => { const result = confirmDapiAction(state, focusedDeal.id, false); setNotice(result.message); }} onMove={(nextPipeline, nextStage) => void executeMove([focusedDeal.id], nextPipeline, nextStage, "drawer")} onWon={() => void executeWon([focusedDeal.id])} onLost={(reason) => void executeLost([focusedDeal.id], reason)} onRestore={() => void executeRestore(focusedDeal.id)} onActivity={(activity) => openActivity(activity)} onCompleteActivity={(id) => void mutate("Atividade concluída.", (current) => completeActivity(current, id))} onDeleteActivity={(id) => void mutate("Atividade excluída.", (current) => deleteActivity(current, id))} onSaveLead={(updated) => void mutate("Dados do lead salvos localmente.", (current) => ({ ...current, leads: current.leads.map((item) => item.id === updated.id ? updated : item) }))} onFeedback={(visitId, feedback) => void mutate("Feedback salvo. A visita saiu de Feedback pendente.", (current) => saveVisitFeedback(current, visitId, feedback))} />}
    {modal && <MutationModal kind={modal} state={scopedState} activity={activityEditing} onClose={() => { setModal(null); setActivityEditing(null); }} onSubmit={async (message, mutation) => { const ok = await mutate(message, mutation); if (ok) { setModal(null); setActivityEditing(null); } }} />}
  </div>;
}

function ValidationBar({ scenario, profile, onScenario, onProfile }: { scenario: CrmV3Scenario; profile: CrmV3Profile; onScenario: (scenario: CrmV3Scenario) => void; onProfile: (profile: CrmV3Profile) => void }) {
  return <div className="crm-v3-validation"><strong>Validação local</strong><span>fora da produção · integrações bloqueadas</span><div><div className="crm-v3-validation-group"><small>Estado</small>{(["normal", "loading", "empty", "error", "offline"] as const).map((item) => <button type="button" key={item} className={scenario === item ? "active" : ""} onClick={() => onScenario(item)}>{item === "normal" ? "Normal" : item === "loading" ? "Carregando" : item === "empty" ? "Vazio" : item === "error" ? "Erro" : "Sem conexão"}</button>)}</div><div className="crm-v3-validation-group"><small>Perfil</small>{(["corretor", "gestor", "admin"] as const).map((item) => <button type="button" key={item} className={profile === item ? "active purple" : ""} onClick={() => onProfile(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div></div>;
}

function OfflineBanner({ area, onReconnect }: { area: CrmV3Area; onReconnect: () => void }) {
  const blocked = area === "deals" ? "mover, ganhar, perder e criar negócio" : area === "visits" ? "confirmar, registrar feedback e criar visita" : "criar, editar ou concluir registros";
  return <div className="crm-v3-offline" role="status"><CrmV3Icon name="wifi" /><div><strong>Sem conexão — exibindo dados em cache</strong><span>Indisponível agora: {blocked}.</span></div><button type="button" onClick={onReconnect}>Reconectar</button></div>;
}

function DealsView({ state, pipeline, pipelineId, segment, summary, visibleDeals, search, selected, selectionMode, mobileStage, offline, onPipeline, onSegment, onSearch, onSelectionMode, onSelect, onMobileStage, onOpen, onMove, onWon, onLost }: {
  state: CrmV3State; pipeline: CrmV3State["pipelines"][number]; pipelineId: string; segment: Segment; summary: ReturnType<typeof summaries>; visibleDeals: DealV3[]; search: string; selected: string[]; selectionMode: boolean; mobileStage: string; offline: boolean;
  onPipeline: (id: string) => void; onSegment: (segment: Segment) => void; onSearch: (value: string) => void; onSelectionMode: () => void; onSelect: (id: string) => void; onMobileStage: (id: string) => void; onOpen: (id: string) => void; onMove: (ids: string[], pipelineId: string, stageId: string, source: MutationSource) => void; onWon: (ids: string[]) => void; onLost: (ids: string[], reason: string) => void;
}) {
  return <section className="crm-v3-deals">
    <div className="crm-v3-deals-tabs"><select aria-label="Trocar pipeline" value={pipelineId} onChange={(event) => onPipeline(event.target.value)}>{state.pipelines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><div role="tablist" aria-label="Situação dos negócios"><button type="button" role="tab" aria-selected={segment === "open"} className={segment === "open" ? "active" : ""} onClick={() => onSegment("open")}>Em andamento <b>{summary.open}</b></button><button type="button" role="tab" aria-selected={segment === "won"} className={segment === "won" ? "active" : ""} onClick={() => onSegment("won")}>Ganhos <b>{summary.won}</b></button><button type="button" role="tab" aria-selected={segment === "lost"} className={segment === "lost" ? "active" : ""} onClick={() => onSegment("lost")}>Perdidos <b>{summary.lost}</b></button><button type="button" role="tab" aria-selected={segment === "triage"} className={segment === "triage" ? "active" : ""} onClick={() => onSegment("triage")}>Triagem <b>{state.deals.filter((deal) => deal.pipelineId === "triagem").length}</b></button></div><label className="crm-v3-search"><CrmV3Icon name="search" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Lead, imóvel ou título" /></label></div>
    <div className="crm-v3-toolbar"><button type="button">Filtros</button><select aria-label="Ordenação"><option>Atividade mais urgente</option><option>Maior valor</option><option>Menor valor</option></select><select aria-label="Período"><option>Últimos 30 dias · movimentação</option><option>Hoje</option><option>Últimos 7 dias</option></select><button type="button" className={selectionMode ? "active" : ""} onClick={onSelectionMode}>{selectionMode ? "Cancelar seleção" : "Selecionar"}</button><span>{visibleDeals.length} negócio(s) · {MONEY.format(visibleDeals.reduce((total, item) => total + item.value, 0))}</span></div>
    <div className="crm-v3-stage-chips" aria-label="Etapas do pipeline">{pipeline.stages.map((stage) => <button type="button" key={stage.id} className={mobileStage === stage.id ? "active" : ""} onClick={() => onMobileStage(stage.id)}>{stage.label} <b>{visibleDeals.filter((deal) => deal.stageId === stage.id).length}</b></button>)}</div>
    <div className="crm-v3-kanban">{pipeline.stages.map((stage) => { const deals = visibleDeals.filter((deal) => deal.stageId === stage.id); const stageTotals = stageSummary({ ...state, deals: visibleDeals }, pipelineId, stage.id); return <section data-crm-v3-stage-id={stage.id} className={`crm-v3-column stage-${stage.color}${mobileStage === stage.id ? " mobile-active" : ""}`} key={stage.id} onDragOver={(event) => { if (!offline) event.preventDefault(); }} onDrop={(event) => { const id = event.dataTransfer.getData("text/crm-v3-deal"); if (id && !offline) onMove([id], pipelineId, stage.id, "drag"); }}><header><div><i /><strong>{stage.label}</strong><b>{deals.length}</b></div><span>{stageTotals.value ? MONEY.format(stageTotals.value) : "—"}</span></header><div className="crm-v3-column-body">{deals.map((deal) => <DealCard key={deal.id} state={state} deal={deal} stages={pipeline.stages} selected={selected.includes(deal.id)} selectionMode={selectionMode} offline={offline} onSelect={() => onSelect(deal.id)} onOpen={() => onOpen(deal.id)} onMove={(stageId, source = "menu") => onMove([deal.id], pipelineId, stageId, source)} onWon={() => onWon([deal.id])} onLost={() => onLost([deal.id], "Sem interesse")} />)}{deals.length === 0 && <div className="crm-v3-column-empty"><span>—</span><strong>Nada nesta etapa</strong><small>Arraste um negócio para cá.</small></div>}</div></section>; })}</div>
  </section>;
}

function DealCard({ state, deal, stages, selected, selectionMode, offline, onSelect, onOpen, onMove, onWon, onLost }: { state: CrmV3State; deal: DealV3; stages: CrmV3State["pipelines"][number]["stages"]; selected: boolean; selectionMode: boolean; offline: boolean; onSelect: () => void; onOpen: () => void; onMove: (stageId: string, source?: MutationSource) => void; onWon: () => void; onLost: () => void }) {
  const lead = state.leads.find((item) => item.id === deal.leadId);
  const [actions, setActions] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const ignoreNextClick = useRef(false);
  const ignoreClickTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (ignoreClickTimer.current !== null) window.clearTimeout(ignoreClickTimer.current);
  }, []);
  return <article
    className={`crm-v3-deal-card tone-${deal.dueTone}${selected ? " selected" : ""}`}
    onPointerDown={(event) => {
      if (offline || deal.status !== "open" || selectionMode || event.button !== 0 || (event.target as Element).closest("button,input,select")) return;
      pointerStart.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { pointerStart.current = null; }}
    onPointerUp={(event) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-crm-v3-stage-id]");
      const stageId = target?.dataset.crmV3StageId;
      if (stageId && stageId !== deal.stageId) {
        ignoreNextClick.current = true;
        onMove(stageId, "drag");
        if (ignoreClickTimer.current !== null) window.clearTimeout(ignoreClickTimer.current);
        ignoreClickTimer.current = window.setTimeout(() => {
          ignoreNextClick.current = false;
          ignoreClickTimer.current = null;
        }, 0);
      }
    }}
    onClick={() => {
      if (ignoreNextClick.current) {
        ignoreNextClick.current = false;
        if (ignoreClickTimer.current !== null) window.clearTimeout(ignoreClickTimer.current);
        ignoreClickTimer.current = null;
        return;
      }
      if (selectionMode) onSelect(); else onOpen();
    }}
    tabIndex={0}
    role="button"
    aria-pressed={selectionMode ? selected : undefined}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (selectionMode) onSelect(); else onOpen(); } }}
  >
    {selectionMode && <input type="checkbox" checked={selected} readOnly aria-label={`Selecionar ${lead?.name ?? deal.title}`} />}
    <header><div><strong>{lead?.name ?? "Lead"}</strong><span>{deal.property}</span></div><em className={`crm-v3-temperature temperature-${deal.temperature ?? "waiting"}`}><i />{rotuloTemperatura(deal.temperature) ?? "Aguardando leitura"}</em></header>
    <div className="crm-v3-deal-value"><strong>{MONEY.format(deal.value)}</strong><span>{deal.momentLabel}</span></div>
    <div className="crm-v3-deal-next"><span>{deal.nextAction ?? "Sem próxima atividade"}</span><em className={`tone-${deal.dueTone}`}>{deal.dueLabel}</em></div>
    <footer><span className="crm-v3-avatar small">{initials(deal.owner)}</span><div className="crm-v3-tags">{deal.tags.slice(0, 2).map((tag) => <i key={tag}>{tag}</i>)}{deal.tags.length > 2 && <i>+{deal.tags.length - 2}</i>}</div><button type="button" className="crm-v3-card-more" aria-label={`Ações de ${lead?.name ?? deal.title}`} aria-expanded={actions} onClick={(event) => { event.stopPropagation(); setActions((value) => !value); }}><CrmV3Icon name="more" /></button></footer>
    {actions && <div className="crm-v3-card-actions" onClick={(event) => event.stopPropagation()}><label>Mover para<select value={deal.stageId} disabled={offline} onChange={(event) => { onMove(event.target.value); setActions(false); }}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>{deal.status === "open" && <><button type="button" disabled={offline} onClick={onWon}>Marcar ganho</button><button type="button" className="danger-ghost" disabled={offline} onClick={onLost}>Marcar perdido</button></>}</div>}
  </article>;
}

function DayView({ state, onOpen, onComplete }: { state: CrmV3State; onOpen: (dealId: string) => void; onComplete: (id: string) => void }) {
  const [renderedAt] = useState(() => Date.now());
  const items = state.activities.filter((activity) => activity.status === "pending").slice().sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  return <section className="crm-v3-simple-page"><div className="crm-v3-kpis"><article><span>Agora</span><strong>{items.filter((item) => +new Date(item.dueAt) <= renderedAt).length}</strong></article><article><span>Para hoje</span><strong>{items.length}</strong></article><article><span>Feedback pendente</span><strong>{feedbackPending(state).length}</strong></article></div><div className="crm-v3-list">{items.map((activity) => { const lead = state.leads.find((item) => item.id === activity.leadId); return <article key={activity.id}><span className="crm-v3-avatar">{initials(lead?.name ?? "Lead")}</span><div><span>{activity.kind}</span><strong>{activity.title}</strong><p>{lead?.name} · {new Date(activity.dueAt).toLocaleString("pt-BR")}</p></div><div><button type="button" onClick={() => { if (activity.dealId) onOpen(activity.dealId); }}>Abrir ficha</button><button type="button" className="primary" onClick={() => onComplete(activity.id)}>Concluir</button></div></article>; })}</div></section>;
}

function LeadsView({ state, profile, onOpen, onCreate }: { state: CrmV3State; profile: CrmV3Profile; onOpen: (id: string) => void; onCreate: () => void }) {
  const leads = profile === "corretor" ? state.leads.filter((lead) => lead.owner === "Bianca Rodrigues") : state.leads;
  return <section className="crm-v3-simple-page"><div className="crm-v3-section-title"><div><h2>Leads</h2><p>Pessoa única; negócios e imóveis permanecem objetos separados.</p></div><button type="button" className="primary" onClick={onCreate}><CrmV3Icon name="plus" /> Novo lead</button></div><div className="crm-v3-table-wrap"><table><thead><tr><th>Lead</th><th>Origem</th><th>Corretor</th><th>Interesse</th><th>Negócios</th><th /></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td><span className="crm-v3-avatar small">{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>{lead.phone}</small></div></td><td>{lead.source}</td><td>{lead.owner}</td><td>{lead.interest}</td><td>{state.deals.filter((deal) => deal.leadId === lead.id).length}</td><td><button type="button" onClick={() => onOpen(lead.id)}>Abrir ficha</button></td></tr>)}</tbody></table></div></section>;
}

function ActivitiesView({ state, onCreate, onOpen, onComplete, onDelete }: { state: CrmV3State; onCreate: () => void; onOpen: (activity: ActivityV3) => void; onComplete: (id: string) => void; onDelete: (id: string) => void }) {
  return <section className="crm-v3-simple-page"><div className="crm-v3-section-title"><div><h2>Atividades e agenda</h2><p>Ligadas ao lead e, quando houver, ao negócio.</p></div><button type="button" className="primary" onClick={onCreate}><CrmV3Icon name="plus" /> Nova atividade</button></div><div className="crm-v3-list">{state.activities.map((activity) => { const lead = state.leads.find((item) => item.id === activity.leadId); return <article key={activity.id}><span className="crm-v3-avatar">{initials(lead?.name ?? "Lead")}</span><div><span>{activity.kind}</span><strong>{activity.title}</strong><p>{lead?.name} · {new Date(activity.dueAt).toLocaleString("pt-BR")} · {activity.durationMinutes} min</p></div><em>{activity.status === "pending" ? "Pendente" : "Concluída"}</em><div>{activity.status === "pending" && <button type="button" onClick={() => onComplete(activity.id)}>Concluir</button>}<button type="button" onClick={() => onOpen(activity)}>Editar</button><button type="button" className="danger-ghost" onClick={() => onDelete(activity.id)}>Excluir</button></div></article>; })}</div></section>;
}

function VisitsView({ state, onCreate, onConfirm, onComplete, onFeedback }: { state: CrmV3State; onCreate: () => void; onConfirm: (id: string) => void; onComplete: (id: string) => void; onFeedback: (dealId: string) => void }) {
  return <section className="crm-v3-simple-page"><div className="crm-v3-section-title"><div><h2>Visitas</h2><p>Compromisso ligado ao lead, negócio e imóvel; feedback não vira outra visita.</p></div><button type="button" className="primary" onClick={onCreate}><CrmV3Icon name="plus" /> Nova visita</button></div><div className="crm-v3-kpis"><article><span>Agendadas</span><strong>{state.visits.filter((item) => ["scheduled", "confirmed"].includes(item.status)).length}</strong></article><article><span>Feedback pendente</span><strong>{feedbackPending(state).length}</strong></article><article><span>Encerradas</span><strong>{state.visits.filter((item) => item.feedback !== null).length}</strong></article></div><div className="crm-v3-list visit-list">{state.visits.map((visit) => { const lead = state.leads.find((item) => item.id === visit.leadId); return <article key={visit.id}><span className="crm-v3-calendar"><b>{new Date(visit.startsAt).getDate()}</b><small>{new Date(visit.startsAt).toLocaleString("pt-BR", { month: "short" })}</small></span><div><span>{visit.status === "scheduled" ? "Agendada" : visit.status === "confirmed" ? "Confirmada" : visit.feedback ? "Feedback concluído" : "Feedback pendente"}</span><strong>{lead?.name} · {visit.property}</strong><p>{new Date(visit.startsAt).toLocaleString("pt-BR")} · {visit.durationMinutes} min · {visit.meetingPoint}</p></div><div>{visit.status === "scheduled" && <button type="button" onClick={() => onConfirm(visit.id)}>Confirmar visita</button>}{visit.status === "confirmed" && <button type="button" onClick={() => onComplete(visit.id)}>Marcar realizada</button>}{visit.status === "completed" && !visit.feedback && <button type="button" className="primary" onClick={() => onFeedback(visit.dealId)}>Registrar feedback</button>}{visit.feedback && <button type="button" onClick={() => onFeedback(visit.dealId)}>Ver feedback</button>}</div></article>; })}</div></section>;
}

function SalesView({ state }: { state: CrmV3State }) { return <section className="crm-v3-simple-page"><div className="crm-v3-contract-note"><CrmV3Icon name="sales" /><div><strong>Esteira oficial preservada</strong><p>Esta validação não monta a Esteira conectada porque seus controles fariam mutações reais. A integração continua apontando para <code>SalesProcessView</code> e <code>/api/crm/sales</code>; aqui o contrato é somente leitura.</p></div></div><div className="crm-v3-kpis"><article><span>Negociações abertas</span><strong>{state.deals.filter((item) => item.status === "open").length}</strong></article><article><span>Valor em aberto</span><strong>{MONEY.format(state.deals.filter((item) => item.status === "open").reduce((total, item) => total + item.value, 0))}</strong></article><article><span>Vínculos preservados</span><strong>100%</strong></article></div></section>; }
function ManagementView({ state, profile }: { state: CrmV3State; profile: CrmV3Profile }) { if (profile === "corretor") return <AccessDenied />; return <section className="crm-v3-simple-page"><div className="crm-v3-kpis"><article><span>Carteira</span><strong>{state.deals.length}</strong></article><article><span>Ações pendentes</span><strong>{state.activities.filter((item) => item.status === "pending").length}</strong></article><article><span>Feedback pendente</span><strong>{feedbackPending(state).length}</strong></article><article><span>Valor aberto</span><strong>{MONEY.format(state.deals.filter((item) => item.status === "open").reduce((total, item) => total + item.value, 0))}</strong></article></div><div className="crm-v3-contract-note"><CrmV3Icon name="management" /><div><strong>Leitura gerencial sem atalho de permissão</strong><p>Gestor e Admin veem a equipe; Corretor recebe acesso negado. Os números vêm do mesmo estado local usado no Funil.</p></div></div></section>; }
function SettingsView({ state, profile }: { state: CrmV3State; profile: CrmV3Profile }) { if (profile === "corretor") return <AccessDenied />; return <section className="crm-v3-simple-page"><div className="crm-v3-section-title"><div><h2>Vocabulário canônico</h2><p>Somente leitura nesta rota: nenhuma migration, RPC ou permissão é alterada.</p></div></div><div className="crm-v3-settings-grid">{state.pipelines.map((pipeline) => <article key={pipeline.id}><strong>{pipeline.label}</strong><p>{pipeline.description}</p><ol>{pipeline.stages.map((stage) => <li key={stage.id}><i className={`stage-${stage.color}`} />{stage.label}{stage.requiresActivity && <em>Exige atividade</em>}</li>)}</ol></article>)}</div></section>; }
function MatrixView({ profile }: { profile: CrmV3Profile }) { const rows = [["Etapa, momento e prazo", "modelo.ts", "Reutilizado"], ["Movimento", "motor único local → contrato canônico", "Testável"], ["Sara", "f2_sara_analise", "Sem envio"], ["D-API", "outbound confirmado", "Clique não conclui"], ["Visitas", "f2_salvar_visita", "Fixture tipada"], ["Esteira", "SalesProcessView", "Preservada"], ["Permissões", "GuardaModulo + perfil", profile === "corretor" ? "Acesso operacional" : "Acesso gerencial"]]; return <section className="crm-v3-simple-page"><div className="crm-v3-table-wrap"><table><thead><tr><th>Função</th><th>Contrato real</th><th>CRM V3</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div></section>; }
function AccessDenied() { return <div className="crm-v3-access" role="alert"><CrmV3Icon name="management" /><strong>Acesso negado</strong><p>Esta área é reservada a Gestor e Admin. A rota não cria atalhos locais de permissão.</p></div>; }
function LoadingState() { return <div className="crm-v3-loading" role="status"><span /><strong>Carregando o CRM V3…</strong><div>{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="crm-v3-empty error"><strong>Não foi possível carregar</strong><span>Falha simulada. Nenhum dado real foi consultado ou alterado.</span><button type="button" onClick={onRetry}>Tentar novamente</button></div>; }
function EmptyState({ area }: { area: CrmV3Area }) { return <div className="crm-v3-empty"><strong>Nada por aqui</strong><span>O estado vazio de {AREAS.find((item) => item.id === area)?.label} está pronto e não deixa a tela sem orientação.</span></div>; }

function BulkBar({ count, pipeline, onMove, onWon, onLost, onClear }: { count: number; pipeline: CrmV3State["pipelines"][number]; onMove: (stageId: string) => void; onWon: () => void; onLost: () => void; onClear: () => void }) { return <div className="crm-v3-bulk"><strong>{count} negócio(s) selecionado(s)</strong><select defaultValue="" onChange={(event) => { if (event.target.value) onMove(event.target.value); }}><option value="">Mover para…</option>{pipeline.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><button type="button" onClick={onWon}>Marcar ganho</button><button type="button" onClick={onLost}>Marcar perdido</button><button type="button" aria-label="Limpar seleção" onClick={onClear}><CrmV3Icon name="close" /></button></div>; }

function MutationModal({ kind, state, activity, onClose, onSubmit }: { kind: Exclude<ModalKind, null>; state: CrmV3State; activity: ActivityV3 | null; onClose: () => void; onSubmit: (message: string, mutation: (state: CrmV3State) => CrmV3State) => Promise<void> }) {
  if (kind === "lead") return <CrmV3Dialog title="Novo lead" description="Cria a pessoa sem criar negócio automaticamente." onClose={onClose}><form className="crm-v3-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSubmit("Lead criado localmente.", (current) => createLead(current, { name: String(data.get("name")), phone: String(data.get("phone")), email: String(data.get("email")), document: String(data.get("document")), source: String(data.get("source")), owner: String(data.get("owner")), address: String(data.get("address")), interest: String(data.get("interest")), tags: [] })); }}><div className="crm-v3-form-grid"><Field name="name" label="Nome" required autoFocus/><Field name="phone" label="Telefone" required/><Field name="email" label="E-mail" type="email"/><Field name="document" label="CPF/CNPJ"/><Field name="source" label="Origem" required/><Field name="owner" label="Corretor responsável" defaultValue="Bianca Rodrigues" required/><Field name="address" label="Endereço" full/><Field name="interest" label="Interesse" full/></div><FormFooter onClose={onClose} label="Criar lead"/></form></CrmV3Dialog>;
  if (kind === "deal") return <CrmV3Dialog title="Novo negócio" description="Liga um negócio a um lead existente e a um pipeline." onClose={onClose}><form className="crm-v3-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const pipelineId = String(data.get("pipelineId")); const stageId = state.pipelines.find((item) => item.id === pipelineId)?.stages[0]?.id ?? "novo"; const leadId = String(data.get("leadId")); void onSubmit("Negócio criado localmente.", (current) => createDeal(current, { leadId, title: String(data.get("title")), property: String(data.get("property")), value: Number(data.get("value")), pipelineId, stageId, temperature: null, momentCode: "PRIMEIRA_ABORDAGEM", momentLabel: "Primeira abordagem", nextAction: "WhatsApp · Primeira abordagem", dueLabel: "Vence em 5 min", dueTone: "warning", owner: current.leads.find((lead) => lead.id === leadId)?.owner ?? "Bianca Rodrigues", tags: [] })); }}><div className="crm-v3-form-grid"><label className="full">Lead<select name="leadId" required autoFocus><option value="">Selecione</option>{state.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label><Field name="title" label="Título do negócio" required/><Field name="property" label="Imóvel ou unidade" required/><Field name="value" label="Valor" type="number" required/><label>Pipeline<select name="pipelineId" required>{state.pipelines.filter((item) => item.id !== "triagem").map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.label}</option>)}</select></label></div><FormFooter onClose={onClose} label="Criar negócio"/></form></CrmV3Dialog>;
  if (kind === "activity") return <CrmV3Dialog title={activity ? "Editar atividade" : "Nova atividade"} description="A próxima ação fica ligada ao lead e, quando houver, ao negócio." onClose={onClose}><form className="crm-v3-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const dealId = String(data.get("dealId")) || null; const leadId = dealId ? state.deals.find((deal) => deal.id === dealId)?.leadId ?? String(data.get("leadId")) : String(data.get("leadId")); void onSubmit(activity ? "Atividade editada localmente." : "Atividade criada localmente.", (current) => saveActivity(current, { id: activity?.id, leadId, dealId, kind: String(data.get("kind")) as ActivityV3["kind"], title: String(data.get("title")), dueAt: String(data.get("dueAt")), durationMinutes: Number(data.get("duration")), owner: String(data.get("owner")) })); }}><div className="crm-v3-form-grid"><label>Lead<select name="leadId" defaultValue={activity?.leadId ?? ""} required><option value="">Selecione</option>{state.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label><label>Negócio<select name="dealId" defaultValue={activity?.dealId ?? ""}><option value="">Sem negócio</option>{state.deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></label><label>Tipo<select name="kind" defaultValue={activity?.kind ?? "WhatsApp"}><option>WhatsApp</option><option>Ligação</option><option>Tarefa</option><option>Visita</option></select></label><Field name="title" label="Título" defaultValue={activity?.title} required/><Field name="dueAt" label="Data e hora" type="datetime-local" defaultValue={activity?.dueAt.slice(0, 16)} required/><Field name="duration" label="Duração (min)" type="number" defaultValue={String(activity?.durationMinutes ?? 15)} required/><Field name="owner" label="Responsável" defaultValue={activity?.owner ?? "Bianca Rodrigues"} required/></div><FormFooter onClose={onClose} label={activity ? "Salvar atividade" : "Criar atividade"}/></form></CrmV3Dialog>;
  return <CrmV3Dialog title="Nova visita" description="Fluxo específico ligado a lead, negócio, imóvel e atividade." onClose={onClose} wide><form className="crm-v3-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const dealId = String(data.get("dealId")); const deal = state.deals.find((item) => item.id === dealId); const date = String(data.get("date")); const time = String(data.get("time")); if (!deal) return; void onSubmit("Visita criada e atividade vinculada.", (current) => saveVisit(current, { leadId: deal.leadId, dealId, property: String(data.get("property")), owner: String(data.get("owner")), manager: String(data.get("manager")) || null, startsAt: `${date}T${time}:00-03:00`, durationMinutes: Number(data.get("duration")), meetingPoint: String(data.get("meetingPoint")), notes: String(data.get("notes")) })); }}><div className="crm-v3-form-grid"><label>Negócio<select name="dealId" required autoFocus><option value="">Selecione</option>{state.deals.filter((deal) => deal.status === "open").map((deal) => <option key={deal.id} value={deal.id}>{state.leads.find((lead) => lead.id === deal.leadId)?.name} · {deal.title}</option>)}</select></label><Field name="property" label="Imóvel" required/><Field name="owner" label="Responsável" defaultValue="Bianca Rodrigues" required/><Field name="manager" label="Gerente / acompanhante"/><Field name="date" label="Data" type="date" required/><Field name="time" label="Hora" type="time" required/><Field name="duration" label="Duração (min)" type="number" defaultValue="60" required/><Field name="meetingPoint" label="Ponto de encontro" required/><label className="full">Observações<textarea name="notes" /></label></div><FormFooter onClose={onClose} label="Criar visita"/></form></CrmV3Dialog>;
}
function Field({ label, name, type = "text", required, defaultValue, full, autoFocus }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; full?: boolean; autoFocus?: boolean }) { return <label className={full ? "full" : undefined}>{label}<input name={name} type={type} required={required} defaultValue={defaultValue} autoFocus={autoFocus} /></label>; }
function FormFooter({ onClose, label }: { onClose: () => void; label: string }) { return <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">{label}</button></footer>; }
