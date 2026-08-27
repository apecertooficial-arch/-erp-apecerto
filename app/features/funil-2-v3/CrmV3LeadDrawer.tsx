"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { rotuloTemperatura } from "../funil-2/modelo";
import type { ActivityV3, CrmV3State, DealV3, LeadV3, VisitFeedbackV3 } from "./types";
import { CrmV3Icon } from "./CrmV3Icon";

const TABS = [
  ["service", "Atendimento"], ["history", "Histórico"], ["activities", "Atividades"], ["deals", "Negócios"], ["properties", "Imóveis"], ["files", "Arquivos"], ["data", "Dados do lead"],
] as const;
type TabId = typeof TABS[number][0];

export function CrmV3LeadDrawer({ state, deal, lead, onClose, onDapi, onMove, onWon, onLost, onRestore, onActivity, onCompleteActivity, onDeleteActivity, onSaveLead, onFeedback }: {
  state: CrmV3State;
  deal: DealV3;
  lead: LeadV3;
  onClose: () => void;
  onDapi: () => void;
  onMove: (pipelineId: string, stageId: string) => void;
  onWon: () => void;
  onLost: (reason: string) => void;
  onRestore: () => void;
  onActivity: (activity?: ActivityV3) => void;
  onCompleteActivity: (id: string) => void;
  onDeleteActivity: (id: string) => void;
  onSaveLead: (lead: LeadV3) => void;
  onFeedback: (visitId: string, feedback: VisitFeedbackV3) => void;
}) {
  const [tab, setTab] = useState<TabId>("service");
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const [draft, setDraft] = useState(lead);
  const [feedbackVisitId, setFeedbackVisitId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<VisitFeedbackV3>({ interest: "high", liked: "", objections: "", nextStep: "" });
  const [movePipelineId, setMovePipelineId] = useState(deal.pipelineId);
  const [moveStageId, setMoveStageId] = useState(deal.stageId);
  const drawer = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const activities = state.activities.filter((item) => item.leadId === lead.id);
  const deals = state.deals.filter((item) => item.leadId === lead.id);
  const visits = state.visits.filter((item) => item.leadId === lead.id);
  const history = state.history.filter((item) => item.leadId === lead.id).slice().reverse();
  const pipeline = state.pipelines.find((item) => item.id === deal.pipelineId) ?? state.pipelines[0];
  const selectedPipeline = state.pipelines.find((item) => item.id === movePipelineId) ?? pipeline;
  const tabIndex = useMemo(() => TABS.findIndex(([id]) => id === tab), [tab]);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    drawer.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key === "Tab") {
        const nodes = Array.from(drawer.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []);
        if (!nodes.length) return;
        const first = nodes[0]; const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); before?.focus(); };
  }, []);

  const handleTabs = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (tabIndex + direction + TABS.length) % TABS.length;
    setTab(TABS[next][0]);
    drawer.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return <div className="crm-v3-drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside ref={drawer} className="crm-v3-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="crm-v3-drawer-head">
        <span className="crm-v3-avatar large">{lead.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
        <div><h2 id={titleId}>{lead.name}</h2><p>{lead.owner} · {lead.source} · {lead.phone}</p></div>
        <button type="button" className="crm-v3-icon-btn" onClick={onClose} aria-label="Fechar ficha"><CrmV3Icon name="close" /></button>
      </header>

      <div className="crm-v3-drawer-summary">
        <span className={`crm-v3-temperature temperature-${deal.temperature ?? "waiting"}`}><i />{rotuloTemperatura(deal.temperature) ?? "Aguardando leitura"}</span>
        <span>{deal.momentLabel}</span><span>{deal.nextAction ?? "Sem próxima atividade"}</span>
      </div>

      <div className="crm-v3-drawer-actions">
        <button type="button" className="primary" onClick={onDapi}>WhatsApp</button>
        <button type="button" onClick={() => onActivity()}>Nova atividade</button>
        {deal.status === "open" ? <><button type="button" onClick={onWon}>Ganho</button><button type="button" className="danger-ghost" onClick={() => setLossOpen((value) => !value)}>Perdido</button></> : <button type="button" onClick={onRestore}>Restaurar</button>}
      </div>
      {lossOpen && <form className="crm-v3-inline-form" onSubmit={(event) => { event.preventDefault(); if (lossReason) { onLost(lossReason); setLossOpen(false); } }}>
        <label>Motivo da perda<select value={lossReason} onChange={(event) => setLossReason(event.target.value)} required><option value="">Selecione</option><option>Preço acima do orçamento</option><option>Fechou com outra imobiliária</option><option>Sem interesse</option><option>Produto incompatível</option></select></label>
        <button type="submit" className="danger">Confirmar perda</button>
      </form>}

      <nav className="crm-v3-tabs" role="tablist" aria-label="Áreas da ficha">
        {TABS.map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className={tab === id ? "active" : ""} onKeyDown={handleTabs} onClick={() => setTab(id)}>{label}{id === "activities" && <b>{activities.filter((item) => item.status === "pending").length}</b>}{id === "deals" && <b>{deals.length}</b>}{id === "files" && <b>0</b>}</button>)}
      </nav>

      <div className="crm-v3-drawer-content" role="tabpanel" tabIndex={0}>
        {tab === "service" && <>
          <section className="crm-v3-next-action"><span>Próxima ação</span><strong>{deal.nextAction ?? "Defina a próxima atividade"}</strong><em className={`tone-${deal.dueTone}`}>{deal.dueLabel}</em><button type="button" onClick={onDapi}>Confirmar ação</button><small>O clique não conclui — só o retorno confirmado do D-API conclui.</small></section>
          <div className="crm-v3-data-grid"><section><span>Identidade</span><dl><dt>Telefone</dt><dd>{lead.phone}</dd><dt>E-mail</dt><dd>{lead.email}</dd><dt>Origem</dt><dd>{lead.source}</dd><dt>Corretor</dt><dd>{lead.owner}</dd></dl></section><section><span>Interesse e tags</span><strong>{lead.interest}</strong><div className="crm-v3-tags">{lead.tags.map((tag) => <i key={tag}>{tag}</i>)}</div></section></div>
          <section className="crm-v3-sara"><header><span>Sara</span><b>automático</b></header><p>Cliente demonstrou interesse no perfil do imóvel. Momento sugerido: conversando e qualificando. A aplicação continua sendo uma decisão humana.</p><div><button type="button">Aplicar momento sugerido</button><button type="button">Descartar sugestão</button></div></section>
        </>}

        {tab === "history" && <section><div className="crm-v3-section-title"><div><h3>Linha do tempo única</h3><p>Ações humanas e automáticas são identificadas.</p></div></div><div className="crm-v3-timeline">{history.map((item) => <article key={item.id} className={`actor-${item.actor}`}><i /><div><strong>{item.title}</strong><span>{item.actor === "human" ? "Humano" : item.actor === "dapi" ? "D-API" : item.actor === "sara" ? "Sara · automático" : "Sistema"}</span><p>{item.detail}</p></div><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></article>)}</div></section>}

        {tab === "activities" && <section><div className="crm-v3-section-title"><div><h3>Atividades</h3><p>Próxima ação e prazo permanecem ligados ao negócio.</p></div><button type="button" className="secondary" onClick={() => onActivity()}>Nova atividade</button></div><div className="crm-v3-list">{activities.map((item) => <article key={item.id}><div><span>{item.kind}</span><strong>{item.title}</strong><p>{new Date(item.dueAt).toLocaleString("pt-BR")} · {item.durationMinutes} min · {item.owner}</p></div><em>{item.status === "pending" ? "Pendente" : "Concluída"}</em><div>{item.status === "pending" && <button type="button" onClick={() => onCompleteActivity(item.id)}>Concluir</button>}<button type="button" onClick={() => onActivity(item)}>Editar</button><button type="button" className="danger-ghost" onClick={() => onDeleteActivity(item.id)}>Excluir</button></div></article>)}</div></section>}

        {tab === "deals" && <section><div className="crm-v3-section-title"><div><h3>Negócios deste lead</h3><p>Um lead pode ter negócios em pipelines diferentes.</p></div></div><div className="crm-v3-list">{deals.map((item) => { const itemPipeline = state.pipelines.find((entry) => entry.id === item.pipelineId); return <article key={item.id}><div><strong>{item.title}</strong><p>{itemPipeline?.label} · {itemPipeline?.stages.find((stage) => stage.id === item.stageId)?.label}</p></div><b>{Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(item.value)}</b><em>{item.status === "open" ? "Em andamento" : item.status === "won" ? "Ganho" : "Perdido"}</em></article>; })}</div><form className="crm-v3-move-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onMove(String(form.get("pipeline")), String(form.get("stage"))); }}><label>Pipeline<select name="pipeline" value={movePipelineId} onChange={(event) => { const nextPipelineId = event.target.value; const firstStage = state.pipelines.find((item) => item.id === nextPipelineId)?.stages[0]; setMovePipelineId(nextPipelineId); setMoveStageId(firstStage?.id ?? ""); }}>{state.pipelines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Etapa<select name="stage" value={moveStageId} onChange={(event) => setMoveStageId(event.target.value)}>{selectedPipeline.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button type="submit" className="secondary">Mover negócio</button></form></section>}

        {tab === "properties" && <section><div className="crm-v3-section-title"><div><h3>Imóveis do negócio em foco</h3><p>Interesse pertence ao lead; imóvel vinculado pertence ao negócio.</p></div></div><article className="crm-v3-property"><div className="crm-v3-property-photo"><CrmV3Icon name="home" /></div><div><strong>{deal.property}</strong><p>42 m² · studio · sem vaga</p><span>Principal</span></div><b>{Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(deal.value)}</b></article></section>}

        {tab === "files" && <section><div className="crm-v3-section-title"><div><h3>Arquivos</h3><p>Nenhum arquivo na fixture sanitizada.</p></div><button type="button" className="secondary" disabled>Adicionar arquivo</button></div><div className="crm-v3-empty"><CrmV3Icon name="file" /><strong>Nenhum arquivo</strong><span>Uploads reais ficam bloqueados nesta rota local.</span></div></section>}

        {tab === "data" && <form className="crm-v3-form" onSubmit={(event) => { event.preventDefault(); onSaveLead(draft); }}><div className="crm-v3-form-grid"><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Telefone<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label>E-mail<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><label>CPF/CNPJ<input value={draft.document} onChange={(event) => setDraft({ ...draft, document: event.target.value })} /></label><label>Origem<input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label><label>Corretor responsável<input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label><label className="full">Endereço<input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label><label className="full">Interesse<textarea value={draft.interest} onChange={(event) => setDraft({ ...draft, interest: event.target.value })} /></label></div><footer><button type="submit" className="primary">Salvar dados</button></footer></form>}

        {tab === "service" && visits.filter((item) => item.status === "completed" && !item.feedback).map((visit) => <section key={visit.id} className="crm-v3-feedback-callout"><div><strong>Feedback pendente</strong><p>{visit.property}</p></div><button type="button" onClick={() => setFeedbackVisitId(visit.id)}>Registrar feedback</button>{feedbackVisitId === visit.id && <form onSubmit={(event) => { event.preventDefault(); onFeedback(visit.id, feedback); setFeedbackVisitId(null); }}><label>Interesse<select value={feedback.interest} onChange={(event) => setFeedback({ ...feedback, interest: event.target.value as VisitFeedbackV3["interest"] })}><option value="high">Alto</option><option value="medium">Médio</option><option value="low">Baixo</option></select></label><label>O que gostou<textarea required value={feedback.liked} onChange={(event) => setFeedback({ ...feedback, liked: event.target.value })} /></label><label>Objeções<textarea required value={feedback.objections} onChange={(event) => setFeedback({ ...feedback, objections: event.target.value })} /></label><label>Próximo passo<textarea required value={feedback.nextStep} onChange={(event) => setFeedback({ ...feedback, nextStep: event.target.value })} /></label><button type="submit" className="primary">Salvar feedback</button></form>}</section>)}
      </div>
    </aside>
  </div>;
}
