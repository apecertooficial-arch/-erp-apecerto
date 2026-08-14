"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { blocoAberto, BLOCO_LABEL, completudeBloco, docExigido as regraDocExigido, docVisivel as regraDocVisivel, etapaDoBloco, podeEditarEtapa, type BlocoEsteira, type DadosCompletude, type EtapaRegra } from "../../lib/esteira";
import { MoneyInput, PercentInput } from "../../components/MoneyInput";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

// Fetch autenticado resiliente: usa o token fresco da sessão do Supabase e,
// se ainda vier 401, faz refresh e tenta 1x. Evita "Sessão inválida ou expirada".
async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const supa = getBrowserSupabaseClient();
  const withTok = (t: string): RequestInit => ({ ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` } });
  let fresh: string | null = null;
  try { const { data } = await supa.auth.getSession(); fresh = data.session?.access_token ?? null; } catch { /* usa o header original */ }
  let response = await fetch(input, fresh ? withTok(fresh) : init);
  if (response.status === 401) {
    try { const { data } = await supa.auth.refreshSession(); if (data.session?.access_token) response = await fetch(input, withTok(data.session.access_token)); } catch { /* segue com 401 */ }
  }
  return response;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function tagList(tags: unknown) {
  if (Array.isArray(tags)) return tags.map((tag) => typeof tag === "string" ? tag : (tag && typeof tag === "object" ? String((tag as Record<string, unknown>).name ?? (tag as Record<string, unknown>).nome ?? "") : String(tag ?? ""))).filter(Boolean);
  if (tags && typeof tags === "object") return Object.entries(tags as Record<string, unknown>).filter(([, value]) => Boolean(value)).map(([key]) => key);
  return [];
}

function initials(name: string | null) {
  return (name || "Lead").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function leadPhoto(extras: unknown) {
  if (!extras || typeof extras !== "object") return null;
  const sources = [extras, ...Object.values(extras as Record<string, unknown>).filter((value) => value && typeof value === "object")];
  const keys = ["foto", "foto_url", "foto_perfil", "avatar", "avatar_url", "profile_picture", "profile_pic_url", "profilePicture", "picture", "picture_url", "photo", "photo_url", "image", "image_url"];
  for (const source of sources) {
    const record = source as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && (/^https?:\/\//i.test(value) || value.startsWith("data:image/"))) return value;
    }
  }
  return null;
}

function LeadAvatar({ lead }: { lead: { nome: string | null; extras?: unknown } }) {
  const [failed, setFailed] = useState(false);
  const photo = leadPhoto(lead.extras);
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="lead-avatar">{photo && !failed ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initials(lead.nome)}</span>;
}

function formatElapsed(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return "agora";
  const value = Math.max(0, Math.round(Number(minutes)));
  const mins = value % 60;
  const hours = Math.floor((value % 1440) / 60);
  if (value < 60) return `${mins} min`;
  if (value < 1440) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  const days = Math.floor(value / 1440);
  if (days < 7) return `${days}d ${hours}h`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} sem ${days % 7}d`;
  if (days < 365) { const months = Math.floor(days / 30); return `${months} ${months === 1 ? "mês" : "meses"} ${Math.floor((days % 30) / 7)} sem`; }
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "ano" : "anos"} ${Math.floor((days % 365) / 30)} m`;
}

type SalesData = {
  sales: Array<{ id: string; created_at: string; data_venda: string; data_conclusao?: string | null; cliente_nome?: string | null; empreendimento_id: string | null; empreendimento_nome: string | null; vgv: number; forma_pgto: string | null; status: string; obs: string | null }>;
  processes: Array<{ id: string; venda_id: string; negocio_id: number | null; etapa: string; tipo_venda: string; responsavel_usuario_id: string | null; prazo_em: string | null; observacoes?: string | null; criado_em?: string; atualizado_em: string; aprovacao_status?: string; aprovacao_motivo?: string | null; solicitado_por?: string | null }>;
  deals: Array<{ id: number; venda_id: string | null; lead_id: number; corretor_id: number | null; empreendimento_id: string | null; valor: number | null; status: string }>;
  leads: Array<{ id: number; nome: string | null; telefone: string | null; email: string | null; corretor_id: number | null; tags: unknown; extras: unknown }>;
  products: Array<{ id: string; nome: string; origem: string; bairro: string | null; cidade: string | null }>;
  brokers: Array<{ id: number; nome: string; usuario_id: string | null; online: boolean }>;
  stages?: Array<{ id: string; slug: string; nome: string; cor: string; ordem: number; papel: string; sla_dias: number; resale: boolean; exige_docs?: boolean; libera?: string[] | null; restrito_a?: string[] | null }>;
  etapaDocs?: Array<{ id: string; etapa_slug: string; nome: string; obrigatorio: boolean; ordem: number }>;
  anexos?: Array<{ id: string; processo_ref: string; negocio_id: number | null; etapa_slug: string | null; doc_nome: string | null; nome: string; path: string; mime: string | null; tamanho: number | null; criado_em: string; grupo?: string | null; status?: string; status_motivo?: string | null; obrigatorio?: boolean; observacao?: string | null; enviado_por?: string | null; revisado_por?: string | null; revisado_em?: string | null; lote_id?: string | null; origem?: string | null; ia_status?: string | null; ia_grupo?: string | null; ia_doc_nome?: string | null; ia_confianca?: number | null; ia_extraido?: Record<string, unknown> | null; ia_motivo?: string | null; ia_processado_em?: string | null }>;
  users?: Array<{ id: string; nome: string; role: string }>;
  history?: Array<{ processo_id: string; etapa_de: string | null; etapa_para: string; movido_por: string | null; movido_em: string }>;
  verificacoes?: Array<{ id: string; processo_ref: string; etapa_slug: string; verificado_por: string | null; verificado_em: string }>;
  solicitacoes?: Array<{ id: string; negocio_id: number | null; corretor_id: number | null; solicitado_por: string | null; produto_id: string | null; vgv: number | null; forma_pgto: string | null; obs: string | null; status: string; criado_em: string }>;
  docModelo?: Array<{ id: string; grupo: string; nome: string; obrigatorio: boolean; ordem: number; condicao?: string | null }>;
  condicoes?: Array<{ processo_ref: string; forma_pagamento?: string | null; comprador_tem_conjuge: boolean; vendedor_tem_conjuge: boolean; valor_total: number | null; valor_entrada: number | null; data_entrada: string | null; valor_financiado: number | null; valor_fgts: number | null; valor_recursos_proprios: number | null; valor_parcelas_interm: number | null; qtd_parcelas: number | null; valor_parcela: number | null; valor_assinatura: number | null; valor_chaves: number | null; data_assinatura: string | null; data_conclusao: string | null; origem_recursos: Array<{ tipo: string; valor: number | string }> }>;
  comissao?: Array<{ processo_ref: string; percentual_total: number | null; valor_total: number | null; imobiliaria: string | null; forma_pgto: string | null; participantes: Array<{ nome: string; papel: string; percentual: number | string; valor: number | string }> }>;
  comissaoParcelas?: Array<{ id: string; processo_ref: string; valor: number | null; gatilho: string | null; data_prevista: string | null; data_efetiva: string | null; responsavel: string | null; status: string; ordem: number }>;
  observacoes?: Array<{ id: string; processo_ref: string; texto: string; autor: string | null; autor_nome: string | null; criado_em: string }>;
  pipelines?: Array<{ id: number; nome: string; ordem: number | null }>;
  pipelineStages?: Array<{ id: number; pipeline_id: number; nome: string; ordem: number | null }>;
  partes?: Array<{ id: string; processo_ref: string; papel: string; ordem: number; nome: string | null; telefone: string | null; email: string | null; cpf: string | null; observacao: string | null; atualizado_em: string | null }>;
  anexoEventos?: Array<{ id: string; anexo_id: string | null; processo_ref: string | null; lote_id: string | null; evento: string; detalhe: Record<string, unknown> | null; ator: string | null; ator_nome: string | null; criado_em: string }>;
};

const saleStages = [
  { id: "inicio", name: "Pedido aprovado", color: "#ff7000", role: "Corretor", days: 1 },
  { id: "doc_comp", name: "Documentação do comprador", color: "#e66200", role: "Corretor", days: 3 },
  { id: "doc_vend", name: "Documentação do vendedor", color: "#f2a82c", role: "Gerente", days: 3, resale: true },
  { id: "contrato", name: "Contrato em geração", color: "#8b00cc", role: "Jurídico", days: 2 },
  { id: "minuta_cnd", name: "Minuta + CNDs em análise", color: "#7a1fa2", role: "Jurídico", days: 4 },
  { id: "minuta_env", name: "Contrato enviado p/ assinatura", color: "#2f6fed", role: "Jurídico", days: 3 },
  { id: "pagamento", name: "Aguardando pagamento", color: "#c79a00", role: "Financeiro", days: 5 },
  { id: "registrada", name: "Venda registrada", color: "#1fa85a", role: "Administrador", days: 0 },
];

/* Exportada para que o Funil 2.0 monte SO a esteira, sem arrastar junto o
   cabecalho, a barra de visoes e os filtros do CRM antigo. */
export function SalesProcessView({ accessToken, initialCreate = false, sessionRole = "corretor" }: { accessToken: string; initialCreate?: boolean; sessionRole?: string }) {
  const [data, setData] = useState<SalesData | null>(null); const [error, setError] = useState<string | null>(null); const [filter, setFilter] = useState("all"); const [creating, setCreating] = useState(initialCreate); const [busy, setBusy] = useState(false); const [detailItem, setDetailItem] = useState<SalesData["processes"][number] | null>(null); const [menuStage, setMenuStage] = useState<string | null>(null); const [bulkFrom, setBulkFrom] = useState<string | null>(null); const [addingStage, setAddingStage] = useState(false); const [newStageName, setNewStageName] = useState("");
  const canManageStages = sessionRole !== "corretor";
  const [renderedAt] = useState(() => Date.now());
  const load = async () => { const response = await authedFetch("/api/crm/sales", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as SalesData & { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível carregar as vendas."); setData(result); };
  const decideSolic = async (id: string, aprovar: boolean, motivo?: string) => { setBusy(true); setError(null); try { const response = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(aprovar ? { action: "aprovarSolicitacao", id } : { action: "recusarSolicitacao", id, motivo: motivo || "" }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível decidir a solicitação."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao decidir a solicitação."); } finally { setBusy(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Erro ao carregar vendas.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessToken]);
  const stageList = (data?.stages && data.stages.length) ? data.stages.slice().sort((a, b) => a.ordem - b.ordem).map((s) => ({ id: s.slug, dbId: s.id, name: s.nome, color: s.cor, role: s.papel, days: s.sla_dias, resale: s.resale, ordem: s.ordem, libera: s.libera ?? [], restritoA: s.restrito_a ?? null })) : saleStages.map((s, i) => ({ ...s, dbId: null as string | null, resale: (s as { resale?: boolean }).resale ?? false, ordem: i + 1, libera: [] as string[], restritoA: null as string[] | null }));
  const saleById = new Map((data?.sales ?? []).map((sale) => [sale.id, sale])); const dealBySale = new Map((data?.deals ?? []).filter((deal) => deal.venda_id).map((deal) => [deal.venda_id!, deal])); const leadById = new Map((data?.leads ?? []).map((lead) => [lead.id, lead])); const brokerById = new Map((data?.brokers ?? []).map((broker) => [broker.id, broker]));
  const finalSlugs = new Set(stageList.filter((s) => s.days === 0).map((s) => s.id));
  const visible = (data?.processes ?? []).filter((item) => !["pendente", "devolvida", "recusada"].includes(item.aprovacao_status ?? "aprovada") && (filter === "all" || item.tipo_venda === filter)); const overdue = visible.filter((item) => !finalSlugs.has(item.etapa) && renderedAt - new Date(item.atualizado_em).getTime() > ((stageList.find((stage) => stage.id === item.etapa)?.days || 99) * 86400000));
  const move = async (processId: string, stage: string) => { setBusy(true); setError(null); try { const response = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", processId, stage }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível mover a venda."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível mover a venda."); } finally { setBusy(false); } };
  const mutateStages = async (payload: Record<string, unknown>, success?: string) => { setBusy(true); setError(null); try { const response = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível salvar a etapa."); await load(); if (success) setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a etapa."); } finally { setBusy(false); } };
  const reorderStage = (index: number, direction: number) => { const ordered = stageList.filter((s) => s.dbId); const target = index + direction; if (target < 0 || target >= ordered.length) return; const ids = ordered.map((s) => s.dbId as string); [ids[index], ids[target]] = [ids[target], ids[index]]; void mutateStages({ action: "reorderStages", ids }); };
  if (!data) return <div className="crm-loading"><span /><strong>Conectando a esteira de vendas…</strong></div>;
  return <section className="sales-process">
    <header><div><span>PÓS-FECHAMENTO</span><h2>Esteira de contrato & documentação</h2><p>Todas as vendas reais ligadas ao negócio, produto, cliente e responsável.</p></div><div className="sales-head-actions">{canManageStages && <button className="crm-secondary" type="button" onClick={() => { setAddingStage(true); setNewStageName(""); }}>＋ Nova etapa</button>}<button className="crm-primary" type="button" onClick={() => setCreating(true)}>＋ Nova venda</button></div></header>
    {canManageStages && (data?.solicitacoes ?? []).length > 0 && <div className="sales-approvals">
      <div className="sales-approvals-head"><strong>⏳ Solicitações aguardando sua aprovação</strong><span>{(data?.solicitacoes ?? []).length}</span></div>
      {(data?.solicitacoes ?? []).map((s) => {
        const deal = (data?.deals ?? []).find((d) => d.id === s.negocio_id);
        const lead = deal ? leadById.get(deal.lead_id) : null;
        const broker = brokerById.get(deal?.corretor_id ?? s.corretor_id ?? -1);
        const prod = (data?.products ?? []).find((p) => p.id === s.produto_id);
        return <div className="sales-approval-row" key={s.id}>
          <div className="sales-approval-info"><strong>{lead?.nome || `Negócio #${s.negocio_id}`}</strong><small>{prod?.nome || "Produto"} · {money.format(s.vgv || 0)} · corretor: {broker?.nome || "—"}</small></div>
          <div className="sales-approval-actions"><button className="crm-primary small" type="button" disabled={busy} onClick={() => void decideSolic(s.id, true)}>Aprovar</button><button type="button" disabled={busy} onClick={() => { const m = window.prompt("Motivo da recusa (opcional):", ""); if (m !== null) void decideSolic(s.id, false, m); }}>Recusar</button></div>
        </div>;
      })}
    </div>}
    {error && <div className="crm-error">{error}</div>}
    {addingStage && <div className="sales-add-stage"><input autoFocus value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="Nome da nova etapa (ex.: Vistoria)" onKeyDown={(event) => { if (event.key === "Enter" && newStageName.trim()) { void mutateStages({ action: "createStage", nome: newStageName.trim() }); setAddingStage(false); } }} /><button type="button" className="crm-primary small" disabled={busy || !newStageName.trim()} onClick={() => { void mutateStages({ action: "createStage", nome: newStageName.trim() }); setAddingStage(false); }}>Criar etapa</button><button type="button" onClick={() => setAddingStage(false)}>Cancelar</button></div>}
    <div className="sales-kpis"><article><strong>{visible.length}</strong><span>em processo</span></article><article className="danger"><strong>{overdue.length}</strong><span>vendas atrasadas</span></article><article><strong>{visible.filter((item) => item.etapa === "minuta_env").length}</strong><span>aguardando assinatura</span></article><article><strong>{visible.filter((item) => ["doc_comp", "doc_vend"].includes(item.etapa)).length}</strong><span>documentos pendentes</span></article><article><strong>{visible.filter((item) => item.etapa === "pagamento").length}</strong><span>aguardando pagamento</span></article></div>
    <div className="sales-filter"><b>Tipo de venda</b>{[["all", "Todas"], ["revenda", "Revenda"], ["construtora", "Construtora"]].map(([id, label]) => <button className={filter === id ? "active" : ""} type="button" onClick={() => setFilter(id)} key={id}>{label}</button>)}<span>Corretor · Gerente · Jurídico · Financeiro</span></div>
    <div className="sales-kanban">{stageList.map((stage, stageIndex) => {
      const items = visible.filter((item) => item.etapa === stage.id && (!stage.resale || item.tipo_venda === "revenda"));
      const configurable = canManageStages && Boolean(stage.dbId);
      const orderableIndex = stageList.filter((s) => s.dbId).findIndex((s) => s.dbId === stage.dbId);
      const orderableTotal = stageList.filter((s) => s.dbId).length;
      return <article className="sales-stage" style={{ "--sale-stage": stage.color } as CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/process-id"); if (id && !busy) void move(id, stage.id); }} key={stage.id}>
        <header><i /><strong>{stage.name}</strong><div className="crm-stage-head-right"><span>{items.length}</span>{configurable && <button type="button" className="crm-stage-cog" title="Opções da etapa" onClick={() => setMenuStage(menuStage === stage.id ? null : stage.id)}>⋯</button>}</div></header><small>{stage.role} · SLA {stage.days ? `${stage.days}d` : "concluído"}</small>
        {configurable && menuStage === stage.id && <div className="crm-stage-menu">
          <div className="crm-stage-menu-row"><label className="crm-stage-color">Cor da etapa<input type="color" value={stage.color} onChange={(event) => void mutateStages({ action: "updateStage", stageId: stage.dbId, cor: event.target.value })} /></label></div>
          <div className="crm-stage-menu-row crm-stage-reorder"><button type="button" disabled={busy || orderableIndex <= 0} onClick={() => reorderStage(orderableIndex, -1)}>◀ Trás</button><button type="button" disabled={busy || orderableIndex < 0 || orderableIndex >= orderableTotal - 1} onClick={() => reorderStage(orderableIndex, 1)}>Frente ▶</button></div>
          <button type="button" className="crm-stage-bulk" onClick={() => { setMenuStage(null); setBulkFrom(stage.id); }}>⇄ Mover todas as vendas desta etapa</button>
          <div className="crm-stage-menu-row crm-stage-reorder"><button type="button" disabled={busy} onClick={() => { const nome = window.prompt("Novo nome da etapa:", stage.name); if (nome && nome.trim() && nome.trim() !== stage.name) void mutateStages({ action: "updateStage", stageId: stage.dbId, nome: nome.trim() }); }}>✎ Renomear</button><button type="button" className="crm-stage-danger" disabled={busy || items.length > 0} title={items.length > 0 ? "Mova as vendas antes de excluir" : "Excluir etapa"} onClick={() => { if (window.confirm(`Excluir a etapa "${stage.name}"?`)) void mutateStages({ action: "deleteStage", stageId: stage.dbId }); }}>🗑 Excluir</button></div>
        </div>}
        <div className="sales-stage-body">{items.map((item) => {
          const sale = saleById.get(item.venda_id);
          const deal = dealBySale.get(item.venda_id);
          const lead = deal ? leadById.get(deal.lead_id) : null;
          const broker = brokerById.get(deal?.corretor_id ?? lead?.corretor_id ?? -1);
          const tags = tagList(lead?.tags).slice(0, 2);
          const late = overdue.some((entry) => entry.id === item.id);
          const minutesInStage = Math.max(0, (Date.now() - new Date(item.atualizado_em).getTime()) / 60000);
          // Nome do cliente vem do lead; se ele não estiver carregado, cai no que foi gravado na venda.
          const nomeCliente = lead?.nome || sale?.cliente_nome || "Cliente não identificado";
          const fallbackLead = { nome: nomeCliente, extras: null };
          return <article className={late ? "sale-card late" : "sale-card"} role="button" tabIndex={0} title="Ver andamento da venda" draggable onDragStart={(event) => event.dataTransfer.setData("text/process-id", item.id)} onClick={() => setDetailItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailItem(item); } }} key={item.id}>
            <div className={`sla-top-band ${late ? "vermelho" : "verde"}`} />
            <div className="sale-card-content">
              <div className="card-person"><LeadAvatar lead={lead ?? fallbackLead} /><div><strong>{nomeCliente}</strong><small>{sale?.empreendimento_nome || "Produto não informado"}</small></div></div>
              <div className="sale-card-broker"><span className={`presence ${broker?.online ? "online" : ""}`} /><strong>{broker?.nome || "Sem responsável"}</strong></div>
              <div className="sla-clock-v3"><b>{formatElapsed(minutesInStage)}</b><span>{late ? "em atraso nesta etapa" : "nesta etapa"}</span></div>
              <div className="card-context"><span>{sale?.empreendimento_nome || "Produto não informado"}</span><b>{money.format(sale?.vgv || 0)}</b></div>
              {tags.length > 0 && <div className="card-tags" aria-label="Tags do lead">{tags.map((tagItem) => <span key={tagItem}>{tagItem}</span>)}</div>}
              <small className="sale-kind">{item.tipo_venda === "revenda" ? "Revenda" : "Construtora"}</small>
            </div>
            <div className="sale-card-controls" onClick={(event) => event.stopPropagation()}><select aria-label={`Mover ${lead?.nome || "venda"} para outra etapa`} disabled={busy} value={item.etapa} onChange={(event) => void move(item.id, event.target.value)}>{stageList.filter((target) => !target.resale || item.tipo_venda === "revenda").map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></div>
          </article>;
        })}{items.length === 0 && <div className="sales-drop">Solte uma venda aqui</div>}</div>
      </article>;
    })}</div>
    {creating && <CreateSaleModal data={data} accessToken={accessToken} onClose={() => setCreating(false)} onDone={async () => { setCreating(false); await load(); }} />}
    {detailItem && (() => { const sale = saleById.get(detailItem.venda_id); const deal = dealBySale.get(detailItem.venda_id); const lead = deal ? leadById.get(deal.lead_id) : null; const broker = brokerById.get(deal?.corretor_id ?? lead?.corretor_id ?? -1); return <SaleDetailDrawer renderedAt={renderedAt} accessToken={accessToken} canApprove={canManageStages} sessionRole={sessionRole} process={detailItem} sale={sale} lead={lead} broker={broker} stageList={stageList} docModelo={data.docModelo ?? []} anexos={(data.anexos ?? []).filter((a) => a.processo_ref === detailItem.id)} condicao={(data.condicoes ?? []).find((c) => c.processo_ref === detailItem.id)} comissao={(data.comissao ?? []).find((c) => c.processo_ref === detailItem.id)} comissaoParcelas={(data.comissaoParcelas ?? []).filter((p) => p.processo_ref === detailItem.id)} observacoes={(data.observacoes ?? []).filter((o) => o.processo_ref === detailItem.id)} partes={(data.partes ?? []).filter((p) => p.processo_ref === detailItem.id)} anexoEventos={(data.anexoEventos ?? []).filter((e) => e.processo_ref === detailItem.id)} users={data.users ?? []} pipelines={data.pipelines ?? []} pipelineStages={data.pipelineStages ?? []} history={(data.history ?? []).filter((h) => h.processo_id === detailItem.id)} busy={busy} onReload={load} onMove={async (stage) => { await move(detailItem.id, stage); setDetailItem((cur) => cur ? { ...cur, etapa: stage } : cur); }} onClose={() => setDetailItem(null)} />; })()}
    {bulkFrom && <div className="crm-center-modal"><form onSubmit={(event) => event.preventDefault()}><header><div><span>AÇÃO EM MASSA</span><h2>Mover uma etapa inteira</h2><p>Todas as vendas de <b>{stageList.find((s) => s.id === bulkFrom)?.name}</b> serão enviadas para o destino escolhido.</p></div><button type="button" onClick={() => setBulkFrom(null)}>×</button></header><div className="bulk-move-grid"><label>Etapa de destino<select id="bulk-to" defaultValue=""><option value="">Selecione</option>{stageList.filter((s) => s.id !== bulkFrom).map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div><footer><button type="button" onClick={() => setBulkFrom(null)}>Cancelar</button><button className="crm-primary" type="button" disabled={busy} onClick={() => { const to = (document.getElementById("bulk-to") as HTMLSelectElement | null)?.value; if (!to) { setError("Selecione a etapa de destino."); return; } void mutateStages({ action: "bulkMoveStage", fromSlug: bulkFrom, toSlug: to }); setBulkFrom(null); }}>Mover vendas</button></footer></form></div>}
  </section>;
}

type SaleStageItem = { id: string; dbId: string | null; name: string; color: string; role: string; days: number; resale: boolean; ordem?: number; libera?: string[] | null; restritoA?: string[] | null };
const DOC_GRUPOS = [
  { key: "comprador", label: "Documentação do comprador", conjugeFlag: "comprador_tem_conjuge" as const, conjugeGrupo: "conjuge_comprador", bloco: "docs_comprador" as const },
  { key: "vendedor", label: "Documentação do vendedor", conjugeFlag: "vendedor_tem_conjuge" as const, conjugeGrupo: "conjuge_vendedor", bloco: "docs_vendedor" as const },
  { key: "imovel", label: "Documentação do imóvel", conjugeFlag: null, conjugeGrupo: null, bloco: "docs_imovel" as const },
] as const;
const GRUPO_LABEL: Record<string, string> = { comprador: "comprador", conjuge_comprador: "cônjuge do comprador", vendedor: "vendedor", conjuge_vendedor: "cônjuge do vendedor", imovel: "imóvel" };
const DOC_STATUS_LABEL: Record<string, string> = { pendente: "Pendente", anexado: "Anexado", em_analise: "Em análise", aprovado: "Aprovado", recusado: "Recusado", correcao: "Necessita correção", triagem: "Aguardando conferência" };
// Partes da negociação — cada uma com nome, telefone e e-mail próprios.
const PAPEIS_PARTE = [
  { key: "comprador", label: "Comprador", hint: "Titular da compra", conjuge: false, lado: "compra", add: "＋ Adicionar outro comprador" },
  { key: "conjuge_comprador", label: "Cônjuge do comprador", hint: "Entra no checklist de documentos", conjuge: true, lado: "compra", add: "＋ Adicionar cônjuge do comprador" },
  { key: "vendedor", label: "Vendedor", hint: "Titular da venda", conjuge: false, lado: "venda", add: "＋ Adicionar outro vendedor" },
  { key: "conjuge_vendedor", label: "Cônjuge do vendedor", hint: "Entra no checklist de documentos", conjuge: true, lado: "venda", add: "＋ Adicionar cônjuge do vendedor" },
] as const;
// Forma de pagamento define quais documentos o checklist passa a exigir.
const FORMA_PGTO_OPCOES = [
  { key: "a_vista", label: "À vista", hint: "Não exige carta de crédito nem aprovação de financiamento" },
  { key: "financiamento", label: "Financiamento bancário", hint: "Exige a carta de aprovação do financiamento" },
  { key: "consorcio", label: "Consórcio", hint: "Exige a carta de crédito do consórcio" },
  { key: "misto", label: "Misto", hint: "Combina recursos próprios com crédito" },
] as const;
const ORIGEM_OPCOES = ["Recursos próprios", "Financiamento bancário", "FGTS", "Consórcio ou carta de crédito", "Permuta", "Outro"];
const COMISSAO_GATILHOS = ["Na entrada", "Na primeira parcela", "Na segunda parcela", "Na assinatura", "Na liberação do financiamento", "Na entrega das chaves", "Outra condição"];
const PARCELA_STATUS = ["previsto", "recebido", "atrasado", "cancelado"];

function SaleDetailDrawer({ renderedAt, accessToken, canApprove, sessionRole = "corretor", process, sale, lead, broker, stageList, docModelo, anexos, condicao, comissao, comissaoParcelas, observacoes, partes = [], anexoEventos = [], users, pipelines, pipelineStages, history = [], busy, onReload, onMove, onClose }: { renderedAt: number; accessToken: string; canApprove?: boolean; sessionRole?: string; process: SalesData["processes"][number]; sale?: SalesData["sales"][number]; lead?: SalesData["leads"][number] | null; broker?: SalesData["brokers"][number]; stageList: SaleStageItem[]; docModelo: NonNullable<SalesData["docModelo"]>; anexos: NonNullable<SalesData["anexos"]>; condicao?: NonNullable<SalesData["condicoes"]>[number]; comissao?: NonNullable<SalesData["comissao"]>[number]; comissaoParcelas: NonNullable<SalesData["comissaoParcelas"]>; observacoes: NonNullable<SalesData["observacoes"]>; partes?: NonNullable<SalesData["partes"]>; anexoEventos?: NonNullable<SalesData["anexoEventos"]>; users: NonNullable<SalesData["users"]>; pipelines: NonNullable<SalesData["pipelines"]>; pipelineStages: NonNullable<SalesData["pipelineStages"]>; history?: NonNullable<SalesData["history"]>; busy?: boolean; onReload: () => Promise<void>; onMove: (stage: string) => Promise<void>; onClose: () => void }) {
  const stageName = (slug: string) => stageList.find((s) => s.id === slug)?.name || slug;
  const enteredAt = (slug: string) => { const rows = history.filter((h) => h.etapa_para === slug); return rows.length ? rows[rows.length - 1].movido_em : null; };
  const currentIndex = stageList.findIndex((s) => s.id === process.etapa);
  const stage = currentIndex >= 0 ? stageList[currentIndex] : undefined;
  const total = stageList.length;
  const done = currentIndex < 0 ? 0 : currentIndex;
  const pct = total > 1 ? Math.round((done / (total - 1)) * 100) : 0;
  const minutesInStage = Math.max(0, (renderedAt - new Date(process.atualizado_em).getTime()) / 60000);
  const overdue = stage && stage.days > 0 && minutesInStage > stage.days * 1440;
  const fmtDate = (value?: string | null) => value ? shortDate.format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—";
  const isRevenda = process.tipo_venda === "revenda";
  const track = stageList.filter((s) => !s.resale || isRevenda);
  const trackCurrent = track.findIndex((s) => s.id === process.etapa);
  const userName = (id?: string | null) => users.find((u) => u.id === id)?.nome || "—";

  const [tab, setTab] = useState<"andamento" | "partes" | "docs" | "condicoes" | "comissao" | "obs">("andamento");
  const [wBusy, setWBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obsText, setObsText] = useState("");
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [devPipe, setDevPipe] = useState<number | "">("");
  const [devStage, setDevStage] = useState<number | "">("");
  const [devMotivo, setDevMotivo] = useState("");
  const [novoDoc, setNovoDoc] = useState<Record<string, { nome: string; obrig: boolean; obs: string }>>({});
  const condDoBanco = () => ({
    forma_pagamento: condicao?.forma_pagamento ?? "",
    comprador_tem_conjuge: condicao?.comprador_tem_conjuge ?? false, vendedor_tem_conjuge: condicao?.vendedor_tem_conjuge ?? false,
    valor_total: condicao?.valor_total ?? "", valor_entrada: condicao?.valor_entrada ?? "", data_entrada: (condicao?.data_entrada ?? "")?.toString().slice(0, 10),
    valor_financiado: condicao?.valor_financiado ?? "", valor_fgts: condicao?.valor_fgts ?? "", valor_recursos_proprios: condicao?.valor_recursos_proprios ?? "",
    valor_parcelas_interm: condicao?.valor_parcelas_interm ?? "", qtd_parcelas: condicao?.qtd_parcelas ?? "", valor_parcela: condicao?.valor_parcela ?? "",
    valor_assinatura: condicao?.valor_assinatura ?? "", valor_chaves: condicao?.valor_chaves ?? "",
    data_assinatura: (condicao?.data_assinatura ?? "")?.toString().slice(0, 10), data_conclusao: (condicao?.data_conclusao ?? "")?.toString().slice(0, 10),
    origem_recursos: (Array.isArray(condicao?.origem_recursos) ? condicao!.origem_recursos : []) as Array<{ tipo: string; valor: number | string }>,
  });
  const [cond, setCond] = useState(condDoBanco);
  const comDoBanco = () => ({
    percentual_total: comissao?.percentual_total ?? "", valor_total: comissao?.valor_total ?? "", imobiliaria: comissao?.imobiliaria ?? "", forma_pgto: comissao?.forma_pgto ?? "",
    participantes: (Array.isArray(comissao?.participantes) ? comissao!.participantes : []) as Array<{ nome: string; papel: string; percentual: number | string; valor: number | string }>,
    parcelas: comissaoParcelas.map((p) => ({ valor: p.valor ?? "", gatilho: p.gatilho ?? "", data_prevista: (p.data_prevista ?? "")?.toString().slice(0, 10), data_efetiva: (p.data_efetiva ?? "")?.toString().slice(0, 10), responsavel: p.responsavel ?? "", status: p.status ?? "previsto" })),
  });
  const [com, setCom] = useState(comDoBanco);
  // Marcadores do que já está gravado: qualquer divergência acende a barra de salvar.
  const [condRef, setCondRef] = useState(() => JSON.stringify(condDoBanco()));
  const [comRef, setComRef] = useState(() => JSON.stringify(comDoBanco()));

  const api = async (payload: Record<string, unknown>) => {
    const r = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json() as { error?: string }; if (!r.ok) throw new Error(j.error || "Falha.");
  };
  const run = async (fn: () => Promise<void>) => { setWBusy(true); setError(null); try { await fn(); await onReload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha."); } finally { setWBusy(false); } };
  const upload = (file: File, grupo: string, docNome: string | null, obrigatorio: boolean, observacao: string) => run(async () => {
    const supabase = getBrowserSupabaseClient();
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `esteira/${process.id}/${grupo}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from("esteira-docs").upload(path, file, { upsert: false });
    if (upErr) throw new Error(upErr.message);
    await api({ action: "addAnexo", processId: process.id, negocioId: process.negocio_id, grupo, docNome, obrigatorio, observacao, nome: file.name, path, mime: file.type, tamanho: file.size });
  });
  const removeAnexo = (id: string) => run(() => api({ action: "removeAnexo", anexoId: id }));
  const setStatus = (a: NonNullable<SalesData["anexos"]>[number], status: string) => { let motivo = ""; if (status === "recusado" || status === "correcao") { motivo = window.prompt(`Motivo (${DOC_STATUS_LABEL[status]}):`, a.status_motivo || "") || ""; if (!motivo.trim()) return; } void run(() => api({ action: "docStatus", anexoId: a.id, status, motivo })); };
  const abrir = async (path: string) => { const { data } = await getBrowserSupabaseClient().storage.from("esteira-docs").createSignedUrl(path, 300); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); };
  const baixar = async (path: string, nome: string) => { const { data } = await getBrowserSupabaseClient().storage.from("esteira-docs").createSignedUrl(path, 300, { download: nome }); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); };
  const saveCondicoes = () => run(async () => { await api({ action: "salvarCondicoes", processId: process.id, ...cond }); setCondRef(JSON.stringify(cond)); });
  const saveComissao = () => run(async () => { await api({ action: "salvarComissao", processId: process.id, ...com }); setComRef(JSON.stringify(com)); });
  const addObs = () => { if (!obsText.trim()) return; void run(async () => { await api({ action: "addObs", processId: process.id, texto: obsText.trim() }); setObsText(""); }); };
  const devolver = (stageId: number, motivo: string) => run(async () => { await api({ action: "devolverFunil", processId: process.id, stageId, motivo }); onClose(); });

  // ===== Exclusão definitiva (admin e diretor) =====
  const podeExcluir = sessionRole === "admin" || sessionRole === "diretor";
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [excMotivo, setExcMotivo] = useState("");
  const [excDescartar, setExcDescartar] = useState(false);
  const [excConfirma, setExcConfirma] = useState("");
  const [excBloqueios, setExcBloqueios] = useState<string[] | null>(null);
  const excluirVenda = (forcar: boolean) => run(async () => {
    const r = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "excluirVenda", processId: process.id, motivo: excMotivo, forcar, descartarLead: excDescartar }) });
    const j = await r.json() as { error?: string; bloqueios?: string[]; precisaForcar?: boolean };
    if (!r.ok) {
      // Impacto financeiro: mostra o que será perdido e exige uma segunda confirmação.
      if (j.precisaForcar) { setExcBloqueios(j.bloqueios ?? []); throw new Error(j.error || "Esta venda movimentou o financeiro."); }
      throw new Error(j.error || "Não foi possível excluir.");
    }
    setExcluirOpen(false);
    onClose();
  });
  const busyAll = busy || wBusy;

  // ===== Envio em lote + organização automática pela Sara =====
  const [loteMsg, setLoteMsg] = useState<string | null>(null);
  const [loteFase, setLoteFase] = useState<"" | "enviando" | "lendo">("");
  const enviarLote = (files: FileList | File[]) => {
    const lista = Array.from(files).slice(0, 15);
    if (!lista.length) return;
    void run(async () => {
      setLoteMsg(null);
      setLoteFase("enviando");
      try {
        const supabase = getBrowserSupabaseClient();
        const loteId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const enviados: Array<{ nome: string; path: string; mime: string; tamanho: number }> = [];
        for (const file of lista) {
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `esteira/${process.id}/_lote/${loteId}/${Date.now()}_${safe}`;
          const { error: upErr } = await supabase.storage.from("esteira-docs").upload(path, file, { upsert: false });
          if (upErr) throw new Error(`${file.name}: ${upErr.message}`);
          enviados.push({ nome: file.name, path, mime: file.type, tamanho: file.size });
        }
        await api({ action: "addAnexoLote", processId: process.id, negocioId: process.negocio_id, loteId, arquivos: enviados });
        setLoteFase("lendo");
        const r = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "classificarLote", processId: process.id, loteId }) });
        const j = await r.json() as { error?: string; classificados?: number; triagem?: number; processados?: number };
        if (!r.ok) throw new Error(j.error || "A Sara não conseguiu ler os documentos.");
        setLoteMsg(`Sara leu ${j.processados ?? 0} arquivo(s): ${j.classificados ?? 0} arquivado(s) automaticamente e ${j.triagem ?? 0} para você conferir.`);
      } finally {
        setLoteFase("");
      }
    });
  };
  const confirmarTriagem = (anexoId: string, grupo: string, docNome: string, obrigatorio: boolean) => run(() => api({ action: "triagemConfirmar", anexoId, grupo, docNome, obrigatorio }));

  // ===== Partes da negociação (várias pessoas por papel) =====
  const partesDe = (papel: string) => partes.filter((p) => p.papel === papel).slice().sort((a, b) => (a.ordem ?? 1) - (b.ordem ?? 1));
  const chave = (papel: string, ordem: number) => `${papel}#${ordem}`;
  const [parteEdit, setParteEdit] = useState<Record<string, { nome: string; telefone: string; email: string; cpf: string }>>(() => {
    const base: Record<string, { nome: string; telefone: string; email: string; cpf: string }> = {};
    partes.forEach((row) => { base[`${row.papel}#${row.ordem ?? 1}`] = { nome: row.nome ?? "", telefone: row.telefone ?? "", email: row.email ?? "", cpf: row.cpf ?? "" }; });
    PAPEIS_PARTE.forEach((p) => { if (!p.conjuge && !base[`${p.key}#1`]) base[`${p.key}#1`] = { nome: "", telefone: "", email: "", cpf: "" }; });
    return base;
  });
  const parteDoBanco = (papel: string, ordem: number) => { const row = partes.find((x) => x.papel === papel && (x.ordem ?? 1) === ordem); return { nome: row?.nome ?? "", telefone: row?.telefone ?? "", email: row?.email ?? "", cpf: row?.cpf ?? "" }; };
  const parteSuja = (papel: string, ordem: number) => JSON.stringify(parteEdit[chave(papel, ordem)] ?? parteDoBanco(papel, ordem)) !== JSON.stringify(parteDoBanco(papel, ordem));
  const partesSujas = () => Object.keys(parteEdit).filter((k) => { const [papel, ordem] = k.split("#"); return parteSuja(papel, Number(ordem)); });
  const salvarParte = (papel: string, ordem: number) => { const v = parteEdit[chave(papel, ordem)]; if (!v) return; void run(() => api({ action: "salvarParte", processId: process.id, papel, ordem, ...v })); };
  const adicionarParte = (papel: string) => run(async () => {
    const r = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "adicionarParte", processId: process.id, papel }) });
    const j = await r.json() as { error?: string; ordem?: number };
    if (!r.ok) throw new Error(j.error || "Não foi possível adicionar.");
    if (j.ordem) setParteEdit((c) => ({ ...c, [chave(papel, j.ordem!)]: { nome: "", telefone: "", email: "", cpf: "" } }));
  });
  const removerParte = (parteId: string) => run(() => api({ action: "removerParte", parteId }));

  // ===== Cascata: o que a etapa atual libera para preenchimento =====
  const etapasRegra: EtapaRegra[] = stageList.map((s2, i) => ({ slug: s2.id, nome: s2.name, ordem: s2.ordem ?? i + 1, libera: s2.libera ?? [], restrito_a: s2.restritoA ?? null }));
  const etapaAtual = etapasRegra.find((e) => e.slug === process.etapa) ?? null;
  const temPapel = podeEditarEtapa(sessionRole, etapaAtual);
  const aberto = (bloco: BlocoEsteira) => blocoAberto(etapaAtual, bloco) && temPapel;
  const travaDe = (bloco: BlocoEsteira): string | null => {
    if (blocoAberto(etapaAtual, bloco)) {
      if (temPapel) return null;
      return `Só ${(etapaAtual?.restrito_a ?? []).join(" ou ")} pode preencher a etapa "${etapaAtual?.nome}".`;
    }
    const alvo = etapaDoBloco(etapasRegra, bloco);
    return alvo ? `Libera na etapa "${alvo.nome}" — a venda está em "${etapaAtual?.nome ?? process.etapa}".`
      : `Este bloco não está habilitado em nenhuma etapa da esteira.`;
  };

  // grupos ativos conforme cônjuge (a existência da parte cônjuge é o que liga o grupo)
  const temConjugeComprador = cond.comprador_tem_conjuge || partesDe("conjuge_comprador").length > 0;
  const temConjugeVendedor = cond.vendedor_tem_conjuge || partesDe("conjuge_vendedor").length > 0;
  const gruposAtivos = ["comprador", "vendedor", "imovel", ...(temConjugeComprador ? ["conjuge_comprador"] : []), ...(temConjugeVendedor ? ["conjuge_vendedor"] : [])];
  const anexoDe = (grupo: string, nome: string) => anexos.find((a) => a.grupo === grupo && a.doc_nome === nome);

  const forma = String(cond.forma_pagamento || "");
  const docExigido = (c?: string | null) => regraDocExigido(c, forma || null);
  const docsDoGrupo = (g: string) => docModelo.filter((d) => d.grupo === g && regraDocVisivel(d.condicao, forma || null));

  const docsAbertos = (["docs_comprador", "docs_vendedor", "docs_imovel"] as BlocoEsteira[]).filter((b) => aberto(b));

  // Fila de triagem: arquivos do lote que a Sara não conseguiu encaixar com segurança.
  const triagem = anexos.filter((a) => a.status === "triagem");

  // Completude por bloco — mesma função que o servidor usa no gate de avanço.
  const dadosCascata: DadosCompletude = {
    condicao: { valor_total: cond.valor_total, forma_pagamento: cond.forma_pagamento || null },
    comissao: { percentual_total: com.percentual_total, valor_total: com.valor_total },
    partes: partes.map((p) => ({ papel: p.papel, nome: p.nome, telefone: p.telefone, email: p.email })),
    modelo: docModelo.map((d) => ({ grupo: d.grupo, nome: d.nome, obrigatorio: d.obrigatorio, condicao: d.condicao })),
    anexos: anexos.map((a) => ({ grupo: a.grupo, doc_nome: a.doc_nome, status: a.status, obrigatorio: a.obrigatorio })),
    temConjugeComprador, temConjugeVendedor,
  };
  const statusBloco = (bloco: BlocoEsteira) => completudeBloco(bloco, dadosCascata);

  // Motivos de bloqueio do avanço — espelha pendenciasParaAvancar do servidor.
  const blockReasons: string[] = ((etapaAtual?.libera ?? []) as BlocoEsteira[])
    .map((bloco) => { const r = statusBloco(bloco); return r.completo ? null : `${BLOCO_LABEL[bloco]}: ${r.faltas.join(", ")}`; })
    .filter(Boolean) as string[];
  const avulsosFalt = anexos.filter((a) => a.obrigatorio && a.status !== "aprovado" && a.status !== "triagem").length;
  if (avulsosFalt) blockReasons.push(`${avulsosFalt} documento(s) adicional(is) obrigatório(s) sem aprovação`);
  const docsAnexados = anexos.length;
  const docsPendentes = gruposAtivos.reduce((acc, g) => acc + docModelo.filter((d) => d.grupo === g && d.obrigatorio && docExigido(d.condicao) && anexoDe(g, d.nome)?.status !== "aprovado").length, 0) + avulsosFalt;

  const somaOrigem = cond.origem_recursos.reduce((sum, o) => sum + (Number(o.valor) || 0), 0);
  const totalCond = Number(cond.valor_total) || 0;
  const somaFecha = totalCond > 0 && Math.abs(somaOrigem - totalCond) < 0.01;

  // ===== Alterações não salvas =====
  const condSujo = JSON.stringify(cond) !== condRef;
  const comSujo = JSON.stringify(com) !== comRef;
  const sujasPartes = partesSujas();
  const temPendencia = condSujo || comSujo || sujasPartes.length > 0;
  const oQueMudou = [
    condSujo ? "condições comerciais" : null,
    comSujo ? "comissão" : null,
    sujasPartes.length ? `${sujasPartes.length} cadastro(s) de parte` : null,
  ].filter(Boolean).join(" · ");
  const salvarTudo = () => run(async () => {
    if (condSujo) { await api({ action: "salvarCondicoes", processId: process.id, ...cond }); setCondRef(JSON.stringify(cond)); }
    if (comSujo) { await api({ action: "salvarComissao", processId: process.id, ...com }); setComRef(JSON.stringify(com)); }
    for (const k of sujasPartes) {
      const [papel, ordem] = k.split("#");
      await api({ action: "salvarParte", processId: process.id, papel, ordem: Number(ordem), ...parteEdit[k] });
    }
  });
  const descartarAlteracoes = () => { setCond(condDoBanco()); setCom(comDoBanco()); setCondRef(JSON.stringify(condDoBanco())); setComRef(JSON.stringify(comDoBanco())); setParteEdit((c) => { const novo = { ...c }; sujasPartes.forEach((k) => { const [papel, ordem] = k.split("#"); novo[k] = parteDoBanco(papel, Number(ordem)); }); return novo; }); };

  // Avisa antes de fechar a aba com edição pendente.
  useEffect(() => {
    if (!temPendencia) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [temPendencia]);

  const fecharComAviso = () => {
    if (temPendencia && !window.confirm("Você tem alterações não salvas. Fechar mesmo assim?")) return;
    onClose();
  };

  const nextStage = trackCurrent >= 0 && trackCurrent < track.length - 1 ? track[trackCurrent + 1] : null;

  const DocRow = ({ grupo, nome, obrigatorio, modelo, condicao, travado }: { grupo: string; nome: string; obrigatorio: boolean; modelo: boolean; condicao?: string | null; travado?: boolean }) => {
    const a = anexoDe(grupo, nome);
    const viaIA = a?.origem === "lote_ia";
    const bloqueado = busyAll || travado === true;
    return <div className={`docx-row ${a ? `st-${a.status}` : "st-pendente"}`}>
      <div className="docx-main">
        <strong>{nome}{condicao && !obrigatorio ? <em className="docx-cond"> · só se {condicao === "financiamento" ? "financiado" : condicao === "consorcio" ? "consórcio" : "não for à vista"}</em> : null}</strong>
        {viaIA && <span className="docx-ia" title={a?.ia_motivo || undefined}>✨ organizado pela Sara{typeof a?.ia_confianca === "number" ? ` · ${Math.round(a.ia_confianca * 100)}% de confiança` : ""}</span>}
        <small>{obrigatorio ? "Obrigatório" : "Opcional"}{a ? ` · ${a.nome} · ${userName(a.enviado_por)} · ${dateTime.format(new Date(a.criado_em))}` : ""}</small>
        {a?.status_motivo && (a.status === "recusado" || a.status === "correcao") && <em className="docx-motivo">⚠ {a.status_motivo}</em>}
      </div>
      <span className={`docx-status st-${a?.status || "pendente"}`}>{a ? DOC_STATUS_LABEL[a.status || "anexado"] : "Pendente"}</span>
      <div className="docx-actions">
        {a ? <>
          <button type="button" title="Abrir" onClick={() => void abrir(a.path)}>👁</button>
          <button type="button" title="Baixar" onClick={() => void baixar(a.path, a.nome)}>⬇</button>
          <label title="Substituir" className="docx-replace">⟳<input type="file" hidden disabled={bloqueado} onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { await api({ action: "removeAnexo", anexoId: a.id }); const supabase = getBrowserSupabaseClient(); const safe = f.name.replace(/[^\w.\-]+/g, "_"); const path = `esteira/${process.id}/${grupo}/${Date.now()}_${safe}`; const { error: ue } = await supabase.storage.from("esteira-docs").upload(path, f); if (ue) throw new Error(ue.message); await api({ action: "addAnexo", processId: process.id, negocioId: process.negocio_id, grupo, docNome: nome, obrigatorio, nome: f.name, path, mime: f.type, tamanho: f.size }); }); e.target.value = ""; }} /></label>
          <button type="button" title="Excluir" className="docx-del" disabled={bloqueado} onClick={() => removeAnexo(a.id)}>🗑</button>
          {canApprove && <select className="docx-statussel" value={a.status || "anexado"} disabled={busyAll} onChange={(e) => setStatus(a, e.target.value)} title="Alterar status">{["anexado", "em_analise", "aprovado", "recusado", "correcao"].map((s) => <option value={s} key={s}>{DOC_STATUS_LABEL[s]}</option>)}</select>}
        </> : <label className="docx-up">📎 Anexar<input type="file" hidden disabled={bloqueado} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, grupo, modelo ? nome : null, obrigatorio, ""); e.target.value = ""; }} /></label>}
      </div>
    </div>;
  };

  return <div className="sale-full-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) fecharComAviso(); }}>
    <div className="sale-full">
      <header className="sale-full-top">
        <div className="sale-full-title"><span className="sale-full-kicker">ESTEIRA DE VENDAS · NEGOCIAÇÃO</span><h2>{lead?.nome || sale?.cliente_nome || "Cliente não identificado"}</h2><p>{sale?.empreendimento_nome || "Produto não informado"}{lead?.telefone ? ` · ☎ ${lead.telefone}` : ""}</p></div>
        <button className="sale-full-close" type="button" onClick={fecharComAviso} aria-label="Fechar">×</button>
      </header>

      <div className="sale-full-kpis">
        <div><small>ETAPA ATUAL</small><strong>{stage?.name || process.etapa}</strong><span>{stage?.role || "—"}</span></div>
        <div><small>TEMPO NA ETAPA</small><strong className={overdue ? "late" : ""}>{formatElapsed(minutesInStage)}</strong><span>{overdue ? "em atraso" : `SLA ${stage?.days ?? 0}d`}</span></div>
        <div><small>PRÓXIMA ETAPA</small><strong>{nextStage?.name || "—"}</strong><span>{nextStage?.role || "conclusão"}</span></div>
        <div><small>DOCUMENTOS</small><strong>{docsAnexados}</strong><span>{docsPendentes} obrigatórios pendentes</span></div>
        <div><small>VALOR (VGV)</small><strong>{money.format(totalCond || sale?.vgv || 0)}</strong><span>{cond.valor_total ? "condições" : "da venda"}</span></div>
        <div className={blockReasons.length ? "block on" : "block"}><small>AVANÇO</small><strong>{blockReasons.length ? "Bloqueado" : "Liberado"}</strong><span>{blockReasons.length ? "ver motivo abaixo" : "etapa concluída"}</span></div>
      </div>

      {blockReasons.length > 0 && <div className="sale-full-block">🔒 <b>Motivo do bloqueio:</b> {blockReasons.join("; ")}.</div>}
      {error && <div className="sale-full-error">{error}</div>}

      <nav className="sale-full-tabs">
        {([
          ["andamento", "Andamento", null],
          ["partes", "Partes", ["partes_comprador", "partes_vendedor"]],
          ["docs", `Documentação${triagem.length ? ` (${triagem.length}!)` : ""}`, ["docs_comprador", "docs_vendedor", "docs_imovel"]],
          ["condicoes", "Condições comerciais", ["condicoes"]],
          ["comissao", "Comissão", ["comissao"]],
          ["obs", "Observações", null],
        ] as Array<[string, string, BlocoEsteira[] | null]>).map(([k, l, blocos]) => {
          const travada = blocos ? !blocos.some((bl) => aberto(bl)) : false;
          const dica = travada && blocos ? travaDe(blocos[0]) : null;
          return <button key={k} type="button" className={`${tab === k ? "active" : ""}${travada ? " travada" : ""}`} title={dica ?? undefined} onClick={() => setTab(k as typeof tab)}>{travada ? "🔒 " : ""}{l}</button>;
        })}
      </nav>

      <div className="sale-full-body">
        {tab === "andamento" && <div className="sale-full-pane">
          <div className="sale-detail-grid">
            <div><small>FORMA DE PAGAMENTO</small><strong>{sale?.forma_pgto || "—"}</strong></div>
            <div><small>TIPO</small><strong>{isRevenda ? "Revenda" : "Construtora"}</strong></div>
            <div><small>DATA DA VENDA</small><strong>{fmtDate(sale?.data_venda)}</strong></div>
            <div><small>RESPONSÁVEL</small><strong>{broker?.nome || "Não definido"}</strong></div>
          </div>
          <div className="sale-detail-progress big"><i style={{ width: `${pct}%`, background: stage?.color || "#7c3aed" }} /></div>
          <ol className="sale-timeline">{track.map((s, i) => { const state = trackCurrent < 0 ? "todo" : i < trackCurrent ? "done" : i === trackCurrent ? "current" : "todo"; const ent = enteredAt(s.id); return <li className={`sale-tl ${state}`} style={{ "--tl": s.color } as CSSProperties} key={s.id}><i />{i < track.length - 1 && <u />}<div><strong>{s.name}</strong><small>{s.role}{s.days ? ` · SLA ${s.days}d` : " · conclusão"}{ent ? ` · ${state === "current" ? "desde" : "entrou"} ${shortDate.format(new Date(ent))}` : ""}</small></div>{i === trackCurrent && <em>Aqui</em>}{state === "done" && <b>✓</b>}</li>; })}</ol>
          {history.length > 0 && <><h4>HISTÓRICO DE MOVIMENTAÇÕES</h4><ul className="sale-moves">{history.slice().reverse().map((h, i) => <li key={i}><b>{dateTime.format(new Date(h.movido_em))}</b><span>{h.etapa_de ? `${stageName(h.etapa_de)} → ${stageName(h.etapa_para)}` : `Entrou em ${stageName(h.etapa_para)}`}{h.movido_por ? ` · ${userName(h.movido_por)}` : ""}</span></li>)}</ul></>}
        </div>}

        {tab === "partes" && <div className="sale-full-pane">
          {(["compra", "venda"] as const).map((lado) => {
            const bloco: BlocoEsteira = lado === "compra" ? "partes_comprador" : "partes_vendedor";
            const editavel = aberto(bloco);
            const trava = travaDe(bloco);
            const st = statusBloco(bloco);
            return <section className="condx partesx-lado" key={lado}>
              <header className="partesx-head">
                <h3>{lado === "compra" ? "Parte compradora" : "Parte vendedora"}</h3>
                <span className={`partesx-selo ${st.completo ? "ok" : "pend"}`}>{st.completo ? "✓ completo" : "pendente"}</span>
              </header>
              {trava && <div className="bloqx">🔒 {trava}</div>}
              {PAPEIS_PARTE.filter((p) => p.lado === lado).map((p) => {
                const linhas = partesDe(p.key);
                return <div className="partesx-papel" key={p.key}>
                  {linhas.map((row, idx) => {
                    const k = chave(p.key, row.ordem ?? idx + 1);
                    const v = parteEdit[k] ?? { nome: row.nome ?? "", telefone: row.telefone ?? "", email: row.email ?? "", cpf: row.cpf ?? "" };
                    const podeRemover = p.conjuge || (row.ordem ?? 1) > 1;
                    return <div className="partesx-card" key={row.id}>
                      <header>
                        <strong>{p.label}{linhas.length > 1 && !p.conjuge ? ` ${idx + 1}` : ""}</strong>
                        <div className="partesx-head-right">
                          <small>{row.atualizado_em ? `atualizado ${shortDate.format(new Date(row.atualizado_em))}` : p.hint}</small>
                          {podeRemover && editavel && <button type="button" className="partesx-del" disabled={busyAll} title="Remover esta pessoa" onClick={() => removerParte(row.id)}>🗑</button>}
                        </div>
                      </header>
                      <div className="partesx-grid">
                        <label>Nome completo<input value={v.nome} disabled={busyAll || !editavel} onChange={(e) => setParteEdit((c) => ({ ...c, [k]: { ...v, nome: e.target.value } }))} /></label>
                        <label>Telefone<input value={v.telefone} disabled={busyAll || !editavel} placeholder="(00) 00000-0000" onChange={(e) => setParteEdit((c) => ({ ...c, [k]: { ...v, telefone: e.target.value } }))} /></label>
                        <label>E-mail<input type="email" value={v.email} disabled={busyAll || !editavel} onChange={(e) => setParteEdit((c) => ({ ...c, [k]: { ...v, email: e.target.value } }))} /></label>
                        <label>CPF<input value={v.cpf} disabled={busyAll || !editavel} onChange={(e) => setParteEdit((c) => ({ ...c, [k]: { ...v, cpf: e.target.value } }))} /></label>
                      </div>
                      <footer>{parteSuja(p.key, row.ordem ?? idx + 1) && <em className="partesx-pend">alterado</em>}<button type="button" className="crm-primary" disabled={busyAll || !editavel} onClick={() => salvarParte(p.key, row.ordem ?? idx + 1)}>Salvar</button></footer>
                    </div>;
                  })}
                  {linhas.length === 0 && !p.conjuge && <div className="partesx-card vazio">
                    <header><strong>{p.label}</strong><small>{p.hint}</small></header>
                    <div className="partesx-grid">
                      {(["nome", "telefone", "email", "cpf"] as const).map((campo) => {
                        const k = chave(p.key, 1);
                        const v = parteEdit[k] ?? { nome: "", telefone: "", email: "", cpf: "" };
                        const rotulo = campo === "nome" ? "Nome completo" : campo === "email" ? "E-mail" : campo === "cpf" ? "CPF" : "Telefone";
                        return <label key={campo}>{rotulo}<input type={campo === "email" ? "email" : "text"} value={v[campo]} disabled={busyAll || !editavel} placeholder={campo === "telefone" ? "(00) 00000-0000" : undefined} onChange={(e) => setParteEdit((c) => ({ ...c, [k]: { ...v, [campo]: e.target.value } }))} /></label>;
                      })}
                    </div>
                    <footer><button type="button" className="crm-primary" disabled={busyAll || !editavel} onClick={() => salvarParte(p.key, 1)}>Salvar</button></footer>
                  </div>}
                  {(p.conjuge ? linhas.length === 0 : true) && <button type="button" className="condx-add" disabled={busyAll || !editavel} onClick={() => adicionarParte(p.key)}>{p.add}</button>}
                </div>;
              })}
              {!st.completo && <p className="partesx-hint">Falta: {st.faltas.join(" · ")}.</p>}
            </section>;
          })}
          <p className="partesx-hint">A Sara usa estes nomes e CPFs para saber de quem é cada documento enviado em lote. Adicionar um cônjuge liga automaticamente o checklist de documentos dele.</p>
        </div>}

        {tab === "docs" && <div className="sale-full-pane">
          {!temPapel && etapaAtual && (etapaAtual.libera ?? []).length > 0 && <div className="bloqx">🔒 Só {(etapaAtual.restrito_a ?? []).join(" ou ")} pode preencher a etapa &quot;{etapaAtual.nome}&quot;.</div>}
          {!docsAbertos.length && <div className="bloqx">🔒 {travaDe("docs_comprador")}</div>}
          {docsAbertos.length > 0 && <section className="lotex">
            <header>
              <div><h3>Enviar tudo de uma vez</h3><p>Solte até 15 arquivos (fotos ou PDFs). A Sara lê cada um, identifica de quem é e arquiva no lugar certo. O que ela não tiver certeza vem para você conferir.</p></div>
              <label className={`lotex-drop ${loteFase ? "busy" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (!busyAll && e.dataTransfer?.files?.length) enviarLote(e.dataTransfer.files); }}>
                <input type="file" hidden multiple accept="image/*,application/pdf" disabled={busyAll} onChange={(e) => { if (e.target.files?.length) enviarLote(e.target.files); e.target.value = ""; }} />
                <strong>{loteFase === "enviando" ? "Enviando arquivos…" : loteFase === "lendo" ? "Sara lendo os documentos…" : "📎 Solte os arquivos aqui ou clique para escolher"}</strong>
                <small>{loteFase ? "Isso pode levar alguns segundos por arquivo." : "Imagens e PDFs · até 8 MB cada"}</small>
              </label>
            </header>
            {loteMsg && <div className="lotex-msg">✓ {loteMsg}</div>}
          </section>}

          {triagem.length > 0 && <section className="triagemx">
            <h3>Conferir classificação da Sara <b>{triagem.length}</b></h3>
            <p>Confirme o destino sugerido ou corrija antes de arquivar. Enquanto houver itens aqui, o avanço de etapa fica bloqueado.</p>
            {triagem.map((a) => <TriagemRow key={a.id} anexo={a} gruposAtivos={gruposAtivos} docsDoGrupo={docsDoGrupo} busy={busyAll} onAbrir={() => void abrir(a.path)} onConfirmar={confirmarTriagem} onDescartar={() => removeAnexo(a.id)} />)}
          </section>}

          {DOC_GRUPOS.map((g) => { const editavelG = aberto(g.bloco); const travaG = travaDe(g.bloco); const stG = statusBloco(g.bloco); return <section className={`docx-group ${editavelG ? "" : "travado"}`} key={g.key}>
            <header><h3>{g.label}</h3>{g.conjugeFlag && <div className="docx-conjuge"><span>Possui cônjuge?</span><button type="button" className={cond[g.conjugeFlag] ? "on" : ""} disabled={busyAll} onClick={() => { const v = { ...cond, [g.conjugeFlag]: true }; setCond(v); void run(async () => { await api({ action: "salvarCondicoes", processId: process.id, somenteConjuge: true, ...v }); setCondRef(JSON.stringify(v)); }); }}>Sim</button><button type="button" className={!cond[g.conjugeFlag] ? "on" : ""} disabled={busyAll} onClick={() => { const v = { ...cond, [g.conjugeFlag]: false }; setCond(v); void run(async () => { await api({ action: "salvarCondicoes", processId: process.id, somenteConjuge: true, ...v }); setCondRef(JSON.stringify(v)); }); }}>Não</button></div>}</header>
            {travaG && <div className="bloqx">🔒 {travaG}</div>}
            {docsDoGrupo(g.key).map((d) => <DocRow key={d.id} grupo={g.key} nome={d.nome} obrigatorio={d.obrigatorio && docExigido(d.condicao)} modelo condicao={d.condicao} travado={!editavelG} />)}
            {anexos.filter((a) => a.grupo === g.key && a.status !== "triagem" && !docModelo.some((d) => d.grupo === g.key && d.nome === a.doc_nome)).map((a) => <DocRow key={a.id} grupo={g.key} nome={a.doc_nome || a.nome} obrigatorio={Boolean(a.obrigatorio)} modelo={false} travado={!editavelG} />)}
            <DocAddRow busy={busyAll || !editavelG} value={novoDoc[g.key]} onChange={(v) => setNovoDoc((c) => ({ ...c, [g.key]: v }))} onUpload={(f, nome, obrig, obs) => { upload(f, g.key, nome, obrig, obs); setNovoDoc((c) => ({ ...c, [g.key]: { nome: "", obrig: true, obs: "" } })); }} />
            {g.conjugeGrupo && cond[g.conjugeFlag] && <div className="docx-conjuge-area">
              <h4>Documentos do {GRUPO_LABEL[g.conjugeGrupo]}</h4>
              {docsDoGrupo(g.conjugeGrupo).map((d) => <DocRow key={d.id} grupo={g.conjugeGrupo!} nome={d.nome} obrigatorio={d.obrigatorio && docExigido(d.condicao)} modelo condicao={d.condicao} travado={!editavelG} />)}
              {anexos.filter((a) => a.grupo === g.conjugeGrupo && a.status !== "triagem" && !docModelo.some((d) => d.grupo === g.conjugeGrupo && d.nome === a.doc_nome)).map((a) => <DocRow key={a.id} grupo={g.conjugeGrupo!} nome={a.doc_nome || a.nome} obrigatorio={Boolean(a.obrigatorio)} modelo={false} travado={!editavelG} />)}
              <DocAddRow busy={busyAll || !editavelG} value={novoDoc[g.conjugeGrupo]} onChange={(v) => setNovoDoc((c) => ({ ...c, [g.conjugeGrupo!]: v }))} onUpload={(f, nome, obrig, obs) => { upload(f, g.conjugeGrupo!, nome, obrig, obs); setNovoDoc((c) => ({ ...c, [g.conjugeGrupo!]: { nome: "", obrig: true, obs: "" } })); }} />
            </div>}
            {!stG.completo && editavelG && <p className="partesx-hint">Falta: {stG.faltas.join(" · ")}.</p>}
          </section>; })}

          {anexoEventos.length > 0 && <section className="trilhax">
            <h3>Trilha dos documentos</h3>
            <ul>{anexoEventos.slice(0, 40).map((ev) => {
              const d = (ev.detalhe ?? {}) as Record<string, unknown>;
              const arquivo = typeof d.arquivo === "string" ? d.arquivo : typeof d.quantidade === "number" ? `${d.quantidade} arquivo(s)` : "documento";
              const texto = ev.evento === "upload" ? `anexou ${arquivo}`
                : ev.evento === "upload_lote" ? `enviou ${arquivo} em lote`
                  : ev.evento === "classificado_ia" ? `Sara arquivou ${arquivo} em ${GRUPO_LABEL[String(d.grupo)] || d.grupo} · ${d.doc_nome}`
                    : ev.evento === "triagem_ia" ? `Sara mandou ${arquivo} para conferência`
                      : ev.evento === "confirmado" ? `confirmou a classificação de ${arquivo}`
                        : ev.evento === "corrigido" ? `corrigiu o destino de ${arquivo}`
                          : ev.evento === "status_alterado" ? `mudou ${arquivo} para ${DOC_STATUS_LABEL[String(d.para)] || d.para}${d.motivo ? ` — ${d.motivo}` : ""}`
                            : ev.evento === "removido" ? `removeu ${arquivo}`
                              : ev.evento;
              return <li key={ev.id}><b>{dateTime.format(new Date(ev.criado_em))}</b><span>{ev.evento.endsWith("_ia") ? "" : `${ev.ator_nome || userName(ev.ator)} `}{texto}</span></li>;
            })}</ul>
          </section>}
        </div>}

        {tab === "condicoes" && <div className="sale-full-pane">
          {travaDe("condicoes") && <div className="bloqx">🔒 {travaDe("condicoes")}</div>}
          <section className="condx">
            <h3>Forma de pagamento</h3>
            <p className="partesx-hint">Define quais documentos o checklist vai exigir. À vista dispensa carta de crédito e carta de aprovação de financiamento.</p>
            <div className="partesx-pgto">{FORMA_PGTO_OPCOES.map((f) => <button key={f.key} type="button" className={cond.forma_pagamento === f.key ? "on" : ""} disabled={busyAll || !aberto("condicoes")} title={f.hint} onClick={() => { const v = { ...cond, forma_pagamento: f.key }; setCond(v); void run(async () => { await api({ action: "salvarCondicoes", processId: process.id, ...v }); setCondRef(JSON.stringify(v)); }); }}><strong>{f.label}</strong><small>{f.hint}</small></button>)}</div>
            <h3>Informações gerais</h3>
            <div className="condx-grid">
              {([["valor_total", "Valor total da venda", "money"], ["valor_entrada", "Valor de entrada", "money"], ["data_entrada", "Data da entrada", "date"], ["valor_financiado", "Valor financiado", "money"], ["valor_fgts", "Valor de FGTS", "money"], ["valor_recursos_proprios", "Recursos próprios", "money"], ["valor_parcelas_interm", "Parcelas intermediárias", "money"], ["qtd_parcelas", "Qtd. de parcelas", "int"], ["valor_parcela", "Valor de cada parcela", "money"], ["valor_assinatura", "Pago na assinatura", "money"], ["valor_chaves", "Pago na entrega das chaves", "money"], ["data_assinatura", "Data prevista assinatura", "date"], ["data_conclusao", "Data prevista conclusão", "date"]] as Array<[string, string, string]>).map(([k, l, t]) => <label key={k}>{l}{t === "money"
                ? <MoneyInput disabled={busyAll || !aberto("condicoes")} value={(cond as Record<string, unknown>)[k] as number | string ?? ""} onChange={(v) => setCond({ ...cond, [k]: v })} />
                : <input type={t === "date" ? "date" : "number"} disabled={busyAll || !aberto("condicoes")} value={(cond as Record<string, unknown>)[k] as string ?? ""} onChange={(e) => setCond({ ...cond, [k]: e.target.value })} />}</label>)}
            </div>
            <h3>Origem dos recursos</h3>
            <div className="condx-origem">{ORIGEM_OPCOES.map((op) => { const sel = cond.origem_recursos.find((o) => o.tipo === op); return <div className={`condx-origem-row ${sel ? "on" : ""}`} key={op}>
              <label><input type="checkbox" checked={!!sel} onChange={(e) => { const list = e.target.checked ? [...cond.origem_recursos, { tipo: op, valor: "" }] : cond.origem_recursos.filter((o) => o.tipo !== op); setCond({ ...cond, origem_recursos: list }); }} />{op}</label>
              {sel && <MoneyInput disabled={busyAll || !aberto("condicoes")} value={sel.valor} onChange={(v) => setCond({ ...cond, origem_recursos: cond.origem_recursos.map((o) => o.tipo === op ? { ...o, valor: v } : o) })} />}
            </div>; })}</div>
            {cond.origem_recursos.length > 0 && <div className={`condx-soma ${somaFecha ? "ok" : "warn"}`}>Soma das formas: <b>{money.format(somaOrigem)}</b> · Valor total: <b>{money.format(totalCond)}</b> — {totalCond <= 0 ? "informe o valor total" : somaFecha ? "✓ valores fecham" : `⚠ diferença de ${money.format(Math.abs(somaOrigem - totalCond))}`}</div>}
            <footer><button type="button" className="crm-primary" disabled={busyAll || !aberto("condicoes")} onClick={saveCondicoes}>Salvar condições</button></footer>
          </section>
        </div>}

        {tab === "comissao" && <div className="sale-full-pane">
          {travaDe("comissao") && <div className="bloqx">🔒 {travaDe("comissao")}</div>}
          <section className="condx">
            <div className="condx-grid">
              <label>Percentual total<PercentInput disabled={busyAll || !aberto("comissao")} value={com.percentual_total as number | string} onChange={(v) => setCom({ ...com, percentual_total: v })} /></label>
              <label>Valor total da comissão<MoneyInput disabled={busyAll || !aberto("comissao")} value={com.valor_total as number | string} onChange={(v) => setCom({ ...com, valor_total: v })} /></label>
              <label>Imobiliária responsável<input value={com.imobiliaria as string} onChange={(e) => setCom({ ...com, imobiliaria: e.target.value })} /></label>
              <label>Forma de pagamento<input value={com.forma_pgto as string} onChange={(e) => setCom({ ...com, forma_pgto: e.target.value })} /></label>
            </div>
            <h3>Participantes</h3>
            {com.participantes.map((p, i) => <div className="condx-part" key={i}>
              <input placeholder="Nome" value={p.nome} onChange={(e) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} />
              <input placeholder="Papel" value={p.papel} onChange={(e) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, papel: e.target.value } : x) })} />
              <PercentInput disabled={busyAll || !aberto("comissao")} placeholder="%" value={p.percentual} onChange={(v) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, percentual: v } : x) })} />
              <MoneyInput disabled={busyAll || !aberto("comissao")} value={p.valor} onChange={(v) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, valor: v } : x) })} />
              <button type="button" onClick={() => setCom({ ...com, participantes: com.participantes.filter((_, j) => j !== i) })}>×</button>
            </div>)}
            <button type="button" className="condx-add" onClick={() => setCom({ ...com, participantes: [...com.participantes, { nome: "", papel: "", percentual: "", valor: "" }] })}>＋ Adicionar participante</button>
            <h3>Parcelas da comissão</h3>
            {com.parcelas.map((p, i) => <div className="condx-parc" key={i}>
              <MoneyInput disabled={busyAll || !aberto("comissao")} value={p.valor} onChange={(v) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, valor: v } : x) })} />
              <select value={p.gatilho} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, gatilho: e.target.value } : x) })}><option value="">Gatilho…</option>{COMISSAO_GATILHOS.map((g) => <option key={g}>{g}</option>)}</select>
              <input type="date" title="Prevista" value={p.data_prevista} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, data_prevista: e.target.value } : x) })} />
              <input type="date" title="Efetiva" value={p.data_efetiva} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, data_efetiva: e.target.value } : x) })} />
              <input placeholder="Responsável" value={p.responsavel} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, responsavel: e.target.value } : x) })} />
              <select value={p.status} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, status: e.target.value } : x) })}>{PARCELA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <button type="button" onClick={() => setCom({ ...com, parcelas: com.parcelas.filter((_, j) => j !== i) })}>×</button>
            </div>)}
            <button type="button" className="condx-add" onClick={() => setCom({ ...com, parcelas: [...com.parcelas, { valor: "", gatilho: "", data_prevista: "", data_efetiva: "", responsavel: "", status: "previsto" }] })}>＋ Adicionar parcela</button>
            <footer><button type="button" className="crm-primary" disabled={busyAll || !aberto("comissao")} onClick={saveComissao}>Salvar comissão</button></footer>
          </section>
        </div>}

        {tab === "obs" && <div className="sale-full-pane">
          <div className="obsx-add"><textarea rows={3} placeholder="Registre acordos, exceções, pendências, condições combinadas…" value={obsText} onChange={(e) => setObsText(e.target.value)} /><button type="button" className="crm-primary" disabled={busyAll || !obsText.trim()} onClick={addObs}>Adicionar observação</button></div>
          <div className="obsx-list">{observacoes.length === 0 && <p className="sale-esteira-empty">Nenhuma observação ainda.</p>}{observacoes.map((o) => <article key={o.id}><p>{o.texto}</p><small>{o.autor_nome || userName(o.autor)} · {dateTime.format(new Date(o.criado_em))}</small></article>)}</div>
        </div>}
      </div>

      {temPendencia && <div className="salvax">
        <span>● Alterações não salvas <small>{oQueMudou}</small></span>
        <div>
          <button type="button" onClick={descartarAlteracoes} disabled={busyAll}>Descartar</button>
          <button type="button" className="crm-primary" onClick={salvarTudo} disabled={busyAll}>{busyAll ? "Salvando…" : "Salvar alterações"}</button>
        </div>
      </div>}

      <footer className="sale-full-foot">
        <div className="sale-full-foot-left">
          
          {canApprove && <button type="button" className="sale-full-devolver" disabled={busyAll} onClick={() => { setDevMotivo(""); setDevPipe(""); setDevStage(""); setDevolverOpen(true); }}>↩ Devolver ao atendimento</button>}
          {podeExcluir && <button type="button" className="sale-full-excluir" disabled={busyAll} onClick={() => { setExcMotivo(""); setExcDescartar(false); setExcConfirma(""); setExcBloqueios(null); setExcluirOpen(true); }}>🗑 Excluir venda</button>}
        </div>
        <div className="sale-full-foot-right">
          {blockReasons.length > 0 && <span className="sale-full-foot-block">🔒 avanço bloqueado</span>}
          {canApprove && <label className="sale-detail-move"><span>Mover etapa</span><select value={process.etapa} disabled={busyAll} onChange={(event) => void onMove(event.target.value)}>{track.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>}
        </div>
      </footer>
    </div>
    {excluirOpen && <div className="crm-center-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setExcluirOpen(false); }}><form className="excx" onSubmit={(e) => { e.preventDefault(); if (excConfirma.trim().toUpperCase() !== "EXCLUIR") return; void excluirVenda(excBloqueios !== null); }}>
      <header><div><span>EXCLUSÃO DEFINITIVA</span><h2>Excluir esta venda da esteira</h2><p>{lead?.nome || sale?.empreendimento_nome || "Venda"} · {money.format(totalCond || sale?.vgv || 0)}</p></div><button type="button" onClick={() => setExcluirOpen(false)}>×</button></header>
      {error && <div className="modal-error">{error}</div>}
      <div className="excx-aviso">
        <strong>Não tem desfazer.</strong> Serão apagados: o card da esteira, as condições comerciais, a comissão, os dados das partes, {docsAnexados} documento(s) anexado(s) e o histórico de movimentações.
        <br />Um registro do que foi excluído fica guardado para auditoria.
      </div>
      {excBloqueios && excBloqueios.length > 0 && <div className="excx-financeiro">
        ⚠ <b>Esta venda já movimentou o financeiro:</b> {excBloqueios.join(", ")}.
        <br />Confirmando agora, esses registros também serão apagados.
      </div>}
      <label>Motivo da exclusão<textarea rows={2} value={excMotivo} onChange={(e) => setExcMotivo(e.target.value)} placeholder="Ex.: venda duplicada, lançada por engano, distrato antes do contrato" /></label>
      <label className="excx-check"><input type="checkbox" checked={excDescartar} onChange={(e) => setExcDescartar(e.target.checked)} />Descartar também o lead (sem marcar, ele volta ao funil como negócio aberto)</label>
      <label>Digite <b>EXCLUIR</b> para confirmar<input value={excConfirma} onChange={(e) => setExcConfirma(e.target.value)} placeholder="EXCLUIR" autoComplete="off" /></label>
      <footer><button type="button" onClick={() => setExcluirOpen(false)}>Cancelar</button><button className="excx-btn" type="submit" disabled={busyAll || excConfirma.trim().toUpperCase() !== "EXCLUIR"}>{excBloqueios ? "Excluir mesmo assim" : "Excluir definitivamente"}</button></footer>
    </form></div>}
    {devolverOpen && <div className="crm-center-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setDevolverOpen(false); }}><form onSubmit={(e) => { e.preventDefault(); if (!devStage) return; void devolver(Number(devStage), devMotivo); }}>
      <header><div><span>DEVOLVER AO ATENDIMENTO</span><h2>Escolha o funil e a etapa</h2><p>O cliente sai da esteira e volta ao funil na etapa escolhida (qualquer funil, qualquer etapa).</p></div><button type="button" onClick={() => setDevolverOpen(false)}>×</button></header>
      <label>Funil (pipe)<select value={devPipe} onChange={(e) => { setDevPipe(e.target.value ? Number(e.target.value) : ""); setDevStage(""); }}><option value="">Selecione o funil</option>{pipelines.slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((p) => <option value={p.id} key={p.id}>{p.nome}</option>)}</select></label>
      <label>Etapa<select value={devStage} disabled={!devPipe} onChange={(e) => setDevStage(e.target.value ? Number(e.target.value) : "")}><option value="">{devPipe ? "Selecione a etapa" : "Escolha o funil primeiro"}</option>{pipelineStages.filter((s) => s.pipeline_id === devPipe).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((s) => <option value={s.id} key={s.id}>{s.nome}</option>)}</select></label>
      <label>Motivo (opcional)<textarea rows={2} value={devMotivo} onChange={(e) => setDevMotivo(e.target.value)} placeholder="Ex.: proposta em negociação, aguardando retorno do cliente" /></label>
      <footer><button type="button" onClick={() => setDevolverOpen(false)}>Cancelar</button><button className="crm-primary" type="submit" disabled={busyAll || !devStage}>Devolver ao funil</button></footer>
    </form></div>}
  </div>;
}

/* Linha da fila de triagem: mostra o palpite da Sara e deixa confirmar ou corrigir antes de arquivar. */
function TriagemRow({ anexo, gruposAtivos, docsDoGrupo, busy, onAbrir, onConfirmar, onDescartar }: { anexo: NonNullable<SalesData["anexos"]>[number]; gruposAtivos: string[]; docsDoGrupo: (g: string) => NonNullable<SalesData["docModelo"]>; busy?: boolean; onAbrir: () => void; onConfirmar: (id: string, grupo: string, docNome: string, obrigatorio: boolean) => void; onDescartar: () => void }) {
  const sugGrupo = anexo.ia_grupo && gruposAtivos.includes(anexo.ia_grupo) ? anexo.ia_grupo : "";
  const [grupo, setGrupo] = useState(sugGrupo);
  const [docNome, setDocNome] = useState(anexo.ia_doc_nome ?? "");
  const opcoes = grupo ? docsDoGrupo(grupo) : [];
  const conf = typeof anexo.ia_confianca === "number" ? Math.round(anexo.ia_confianca * 100) : null;
  const extraido = (anexo.ia_extraido ?? {}) as Record<string, unknown>;
  const lidos = ["nome_completo", "cpf", "numero_matricula", "inscricao_iptu"].map((k) => extraido[k]).filter((v) => typeof v === "string" && v) as string[];
  return <div className={`triagemx-row ${anexo.ia_status === "falhou" ? "falhou" : ""}`}>
    <div className="triagemx-main">
      <strong>{anexo.nome}</strong>
      <small>
        {anexo.ia_status === "falhou" ? `⚠ ${anexo.ia_motivo || "Não consegui ler este arquivo."}` :
          anexo.ia_doc_nome ? `Sara acha que é ${anexo.ia_doc_nome}${conf !== null ? ` (${conf}% de confiança)` : ""}` :
            anexo.ia_motivo || "Sara não reconheceu o documento — escolha o destino."}
      </small>
      {lidos.length > 0 && <em className="triagemx-lido">Leu no documento: {lidos.join(" · ")}</em>}
    </div>
    <div className="triagemx-pick">
      <select value={grupo} disabled={busy} onChange={(e) => { setGrupo(e.target.value); setDocNome(""); }}>
        <option value="">De quem é?</option>
        {gruposAtivos.map((g) => <option key={g} value={g}>{GRUPO_LABEL[g]}</option>)}
      </select>
      <select value={docNome} disabled={busy || !grupo} onChange={(e) => setDocNome(e.target.value)}>
        <option value="">{grupo ? "Qual documento?" : "escolha a parte"}</option>
        {opcoes.map((d) => <option key={d.id} value={d.nome}>{d.nome}</option>)}
        {docNome && !opcoes.some((d) => d.nome === docNome) && <option value={docNome}>{docNome}</option>}
      </select>
    </div>
    <div className="triagemx-actions">
      <button type="button" title="Abrir arquivo" onClick={onAbrir}>👁</button>
      <button type="button" className="crm-primary" disabled={busy || !grupo || !docNome} onClick={() => onConfirmar(anexo.id, grupo, docNome, false)}>Arquivar</button>
      <button type="button" className="docx-del" disabled={busy} title="Descartar arquivo" onClick={onDescartar}>🗑</button>
    </div>
  </div>;
}

function DocAddRow({ busy, value, onChange, onUpload }: { busy?: boolean; value?: { nome: string; obrig: boolean; obs: string }; onChange: (v: { nome: string; obrig: boolean; obs: string }) => void; onUpload: (file: File, nome: string, obrig: boolean, obs: string) => void }) {
  const v = value ?? { nome: "", obrig: true, obs: "" };
  return <div className="docx-add">
    <input placeholder="Anexar outro documento (nome)" value={v.nome} onChange={(e) => onChange({ ...v, nome: e.target.value })} />
    <label className="docx-add-obrig"><input type="checkbox" checked={v.obrig} onChange={(e) => onChange({ ...v, obrig: e.target.checked })} />Obrigatório</label>
    <input placeholder="Observação" value={v.obs} onChange={(e) => onChange({ ...v, obs: e.target.value })} />
    <label className="docx-up"><input type="file" hidden disabled={busy || !v.nome.trim()} onChange={(e) => { const f = e.target.files?.[0]; if (f && v.nome.trim()) onUpload(f, v.nome.trim(), v.obrig, v.obs); e.target.value = ""; }} />＋ Anexar</label>
  </div>;
}
function CreateSaleModal({ data, accessToken, initialDealId = "", onClose, onDone }: { data: SalesData; accessToken: string; initialDealId?: string | number; onClose: () => void; onDone: () => Promise<void> }) {
  const [dealId, setDealId] = useState(String(initialDealId)); const [productId, setProductId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const leadById = new Map(data.leads.map((lead) => [lead.id, lead]));
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); void authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", dealId: Number(dealId), productId }) }).then(async (response) => { const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); await onDone(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar a venda.")).finally(() => setBusy(false)); }}><header><div><span>NOVA VENDA</span><h2>Conectar venda ao CRM</h2><p>O valor é definido nas Condições comerciais, na etapa de Proposta. Até a venda concluir, ele conta como negociação em aberto.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<label>Negócio / cliente<select required value={dealId} onChange={(event) => setDealId(event.target.value)}><option value="">Selecione</option>{data.deals.filter((deal) => !deal.venda_id).map((deal) => <option value={deal.id} key={deal.id}>{leadById.get(deal.lead_id)?.nome || `Negócio #${deal.id}`}</option>)}</select></label><label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{data.products.map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Criar venda"}</button></footer></form></div>;
}

function RefinedSelect({ value, onChange, options, placeholder = "Selecione", disabled = false }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: globalThis.MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return <div className={`rselect ${open ? "open" : ""} ${disabled ? "disabled" : ""}`} ref={ref}>
    <button type="button" className={`rselect-btn ${selected ? "" : "is-placeholder"}`} disabled={disabled} onClick={() => setOpen((prev) => !prev)} aria-haspopup="listbox" aria-expanded={open}>
      <span className="rselect-label">{selected ? selected.label : placeholder}</span>
      <svg className="rselect-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open && <ul className="rselect-panel" role="listbox">
      {options.length === 0 && <li className="rselect-empty">Nenhuma etapa disponível</li>}
      {options.map((option) => <li key={option.value}><button type="button" role="option" aria-selected={option.value === value} className={`rselect-opt ${option.value === value ? "active" : ""}`} onClick={() => { onChange(option.value); setOpen(false); }}><span className="rselect-dot" /><span className="rselect-opt-text">{option.label}</span>{option.value === value && <svg className="rselect-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}</button></li>)}
    </ul>}
  </div>;
}

// Seletor rico da instância do histórico (substitui o <select> nativo).
// Mostra status por cor, corretor como sublinha e a contagem de mensagens como
// badge discreto (some quando é 0, em vez do antigo "0 msgs").
