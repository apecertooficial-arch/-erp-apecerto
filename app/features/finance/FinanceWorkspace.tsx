"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import { MoneyInput as MoneyField } from "../../components/MoneyInput";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { VendaModal } from "./VendaModal";
import { ExtratoImport, type ExtratoImportacao, type ExtratoLinha } from "./ExtratoImport";

export type Sale = { id: string; created_at: string; data_venda: string; data_conclusao?: string | null; empreendimento_id: string | null; empreendimento_nome: string | null; unidade_id: string | null; unidade_rotulo?: string | null; cliente_nome?: string | null; proprietario_nome?: string | null; vgv: number; custos: number; forma_pgto: string | null; percentual_comissao: number | null; status: string; obs: string | null };
type Detail = { id: string | null; data_venda: string | null; empreendimento: string | null; unidade: string | null; bairro: string | null; incorporadora: string | null; vgv: number | null; percentual_comissao: number | null; comissao_bruta: number | null; comissao_corretores: number | null; comissao_executivo: number | null; comissao_apecerto: number | null; indicacao: number | null; corretores: string | null; forma_pgto: string | null; status: string | null; obs: string | null };
type Commission = { id: string; venda_id: string; beneficiario_id: string | null; papel: string; valor_calculado: number | null; valor_final: number; override_motivo: string | null; created_at: string };
type Receipt = { id: string; venda_id: string; numero_parcela: number; valor_total: number; data_prevista: string | null; data_recebimento: string | null; status: string; created_at: string };
type Cash = { id: string; venda_id: string | null; recebimento_id: string | null; data: string; tipo: "entrada" | "saida"; categoria: string; descricao: string | null; valor: number; origem: string | null; papel: string | null; beneficiario_id?: string | null; comissao_id?: string | null; natureza?: string | null; created_at: string };
export type Payout = { id: string; venda_id: string; comissao_id: string | null; beneficiario_id: string | null; papel: string; valor: number; ordem: number; data_prevista: string | null; data_pagamento: string | null; status: string; observacao: string | null; lancamento_id: string | null; created_at: string };
export type FinanceData = { sales: Sale[]; details: Detail[]; commissions: Commission[]; receipts: Receipt[]; cash: Cash[]; users: Array<{ id: string; nome: string; role: string; ativo: boolean }>; brokers: Array<{ id: number; nome: string; usuario_id: string | null; online: boolean; ativo: boolean }>; goals: Array<{ nome: string; meta_vgv: number; atualizado_em: string }>; leads: Array<{ id: number; nome: string | null; origem: string | null; criado_em: string; corretor_id: number | null }>; deals: Array<{ id: number; lead_id: number; corretor_id: number | null; venda_id: string | null; status: string; valor: number | null; criado_em: string }>; empreendimentos?: Array<{ id: string; nome: string; bairro: string | null; cidade: string | null }>; categorias?: Array<{ id: string; nome: string; tipo: "entrada" | "saida" | "ambos"; natureza?: string | null; cor?: string | null; ordem: number }>; rankingVgv?: Array<{ corretor_id: string; corretor: string; vendas: number; vgv: number }>; payouts?: Payout[]; extratos?: ExtratoImportacao[]; extratoLinhas?: ExtratoLinha[] };
type Meta = { id: string; corretor_id: number | null; periodo_tipo: string; ano: number; periodo: number; meta_vgv: number; meta_vendas: number };
type Tab = "overview" | "sales" | "cash" | "marketing" | "indications" | "taxas" | "metas" | "ganhos";
type GanhoRow = { comissao_id: string; venda_id: string; data_venda: string | null; empreendimento: string | null; unidade: string | null; vgv: number | null; status_venda: string; ganho: number; ganho_previsto: number; ganho_recebido: number; situacao: string };
type FinanceRankingRow = { id: string | number; name: string; sales: number; vgv: number; generated: number; received: number; ticket: number };
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 });
/* Faixa das marcas de acento combinantes (U+0300 a U+036F). Montada por
   codigo de proposito: a linha fica so com ASCII e nao se corrompe ao
   passar por ferramenta que reinterpreta sequencia de escape. */
const MARCAS_DE_ACENTO = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function FinanceWorkspace({ accessToken, sessionRole = "corretor", perfil = null, sessionUserId = null }: { accessToken: string; sessionRole?: "admin" | "gestor" | "corretor"; perfil?: string | null; sessionUserId?: string | null }) {
  const [data, setData] = useState<FinanceData | null>(null); const [tab, setTab] = useState<Tab>("overview"); const [period, setPeriod] = useState("all"); const [message, setMessage] = useState<string | null>(null); const [cashOpen, setCashOpen] = useState(false); const [receiptOpen, setReceiptOpen] = useState(false); const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null); const [newSaleOpen, setNewSaleOpen] = useState(false); const [cashEdit, setCashEdit] = useState<Cash | null>(null);
  const load = async () => { const response = await fetch("/api/finance", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as FinanceData & { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível carregar o financeiro."); setData(result); };
  useEffect(() => { void load().catch((reason) => setMessage(reason instanceof Error ? reason.message : "Erro ao carregar o financeiro.")); }, [accessToken]);
  useEffect(() => { const supabase = getBrowserSupabaseClient(); const channel = supabase.channel("finance-live").on("postgres_changes", { event: "*", schema: "public", table: "lancamentos_caixa" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "recebimentos" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [accessToken]);
  useEffect(() => { const changePeriod = (event: Event) => setPeriod((event as CustomEvent<string>).detail); window.addEventListener("finance-period-change", changePeriod); return () => window.removeEventListener("finance-period-change", changePeriod); }, []);
  const mutate = async (body: Record<string, unknown>) => { const response = await fetch("/api/finance", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível salvar."); await load(); return result as { error?: string; reopened?: boolean }; };
  const months = useMemo(() => [...new Set((data?.cash ?? []).map((item) => item.data.slice(0, 7)).concat((data?.sales ?? []).map((item) => item.data_venda.slice(0, 7))))].sort().reverse(), [data]);
  const years = useMemo(() => [...new Set(months.map((item) => item.slice(0, 4)))].sort().reverse(), [months]);
  const filterDate = (value: string) => {
    if (period === "all") return true;
    const [kind, key] = period.split(":");
    if (kind === "month") return value.startsWith(key);
    if (kind === "year") return value.startsWith(key);
    if (kind === "semester") { const [year, semester] = key.split("-"); const month = Number(value.slice(5, 7)); return value.startsWith(year) && (semester === "1" ? month <= 6 : month >= 7); }
    if (kind === "range") { const [start, end] = key.split(","); return (!start || value >= start) && (!end || value <= end); }
    return true;
  };
  const sales = (data?.sales ?? []).filter((item) => filterDate(item.data_venda)); const cash = (data?.cash ?? []).filter((item) => filterDate(item.data)); const receipts = (data?.receipts ?? []).filter((item) => filterDate(item.data_prevista || item.data_recebimento || item.created_at));
  // VGV só conta venda concluída (data_conclusao carimbada quando a esteira chega na etapa final).
  // O que ainda está em processo aparece num card próprio, para não sumir da vista nem inflar o resultado.
  const concluidas = (data?.sales ?? []).filter((item) => item.data_conclusao && filterDate(item.data_conclusao));
  const emNegociacao = (data?.sales ?? []).filter((item) => !item.data_conclusao && item.status !== "distrato" && filterDate(item.data_venda));
  const vgvEmNegociacao = emNegociacao.reduce((sum, item) => sum + item.vgv, 0);
  const totalVgv = concluidas.reduce((sum, item) => sum + item.vgv, 0); const entries = cash.filter((item) => item.tipo === "entrada").reduce((sum, item) => sum + item.valor, 0); const exits = cash.filter((item) => item.tipo === "saida").reduce((sum, item) => sum + item.valor, 0); const pending = receipts.filter((item) => item.status !== "recebido").reduce((sum, item) => sum + item.valor_total, 0); const projectedCommission = concluidas.reduce((sum, item) => sum + item.vgv * Number(item.percentual_comissao || 0), 0); const paidCommission = (data?.commissions ?? []).filter((item) => concluidas.some((sale) => sale.id === item.venda_id)).reduce((sum, item) => sum + item.valor_final, 0);
  const saleById = new Map(concluidas.map((sale) => [sale.id, sale]));
  const normalizeName = (value: string | null | undefined) => (value || "").normalize("NFD").replace(MARCAS_DE_ACENTO, "").trim().toLowerCase();
  const brokerRanking = (data?.brokers ?? []).map((broker) => {
    const dealSaleIds = (data?.deals ?? []).filter((deal) => deal.venda_id && saleById.has(deal.venda_id) && deal.corretor_id === broker.id).map((deal) => deal.venda_id as string);
    const brokerName = normalizeName(broker.nome);
    const historicalSaleIds = (data?.details ?? []).filter((detail) => detail.id && saleById.has(detail.id) && normalizeName(detail.corretores).includes(brokerName)).map((detail) => detail.id as string);
    const saleIds = new Set([...dealSaleIds, ...historicalSaleIds]);
    const brokerSales = [...saleIds].map((saleId) => saleById.get(saleId)).filter((sale): sale is Sale => Boolean(sale));
    const vgv = brokerSales.reduce((sum, sale) => sum + sale.vgv, 0);
    const generated = brokerSales.reduce((sum, sale) => sum + sale.vgv * Number(sale.percentual_comissao || 0), 0);
    const received = (data?.commissions ?? []).filter((commission) => saleIds.has(commission.venda_id) && (!broker.usuario_id || commission.beneficiario_id === broker.usuario_id)).reduce((sum, commission) => sum + commission.valor_final, 0);
    return { id: broker.id, name: broker.nome, sales: brokerSales.length, vgv, generated, received, ticket: brokerSales.length ? vgv / brokerSales.length : 0, saleIds };
  }).filter((item) => item.sales > 0);
  const rankedSaleIds = new Set(brokerRanking.flatMap((item) => [...item.saleIds]));
  const unassignedSales = concluidas.filter((sale) => !rankedSaleIds.has(sale.id));
  const unassignedIds = new Set(unassignedSales.map((sale) => sale.id));
  const unassignedVgv = unassignedSales.reduce((sum, sale) => sum + sale.vgv, 0);
  const ranking: FinanceRankingRow[] = [...brokerRanking.map((item) => ({ id: item.id, name: item.name, sales: item.sales, vgv: item.vgv, generated: item.generated, received: item.received, ticket: item.ticket })), ...(unassignedSales.length ? [{ id: "unassigned", name: "Não atribuído", sales: unassignedSales.length, vgv: unassignedVgv, generated: unassignedSales.reduce((sum, sale) => sum + sale.vgv * Number(sale.percentual_comissao || 0), 0), received: (data?.commissions ?? []).filter((commission) => unassignedIds.has(commission.venda_id)).reduce((sum, commission) => sum + commission.valor_final, 0), ticket: unassignedVgv / unassignedSales.length }] : [])].sort((a, b) => b.vgv - a.vgv);
  if (!data) return <div className="crm-loading"><span /><strong>Conectando vendas, comissões e caixa…</strong></div>;
  return <div className="finance-workspace"><header><div><span>CONTROLE FINANCEIRO</span><h1>Financeiro</h1><p>Vendas, comissões, recebimentos e caixa em uma única visão.</p></div><div><select aria-label="Filtrar período" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">Todo o período</option>{months.map((item) => <option value={`month:${item}`} key={`month:${item}`}>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${item}-15T12:00:00Z`))}</option>)}{years.flatMap((year) => [<option value={`semester:${year}-1`} key={`semester:${year}-1`}>1º semestre de {year}</option>, <option value={`semester:${year}-2`} key={`semester:${year}-2`}>2º semestre de {year}</option>, <option value={`year:${year}`} key={`year:${year}`}>Ano de {year}</option>])}</select></div></header><nav>{[["overview", "Visão geral"], ["sales", "Vendas & comissões"], ["indications", "Indicações"], ...(perfil === "gerente" || perfil === "diretor" || sessionRole === "admin" ? [["taxas", "Taxas de gerente"]] : []), ...(sessionRole !== "corretor" ? [["cash", "Fluxo de caixa"], ["marketing", "Marketing"], ["ganhos", "Meus ganhos"], ["metas", "Metas"]] : [])].map(([id, label]) => <button className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id as Tab)} key={id}>{label}</button>)}</nav>{message && <button className="finance-message" type="button" onClick={() => setMessage(null)}>{message} ×</button>}<section className="finance-kpis"><article><i className="orange">R$</i><span>VGV vendido</span><strong>{compact.format(totalVgv)}</strong><small>{concluidas.length} venda(s) concluída(s)</small></article><article><i className="blue">◔</i><span>Em negociação</span><strong>{compact.format(vgvEmNegociacao)}</strong><small>{emNegociacao.length} na esteira — entra no VGV ao concluir</small></article>{sessionRole !== "corretor" && <><article><i className="green">↙</i><span>Entradas em caixa</span><strong>{compact.format(entries)}</strong><small>Valores efetivamente lançados</small></article><article><i className="red">↗</i><span>Saídas do caixa</span><strong>{compact.format(exits)}</strong><small>Custos e repasses</small></article></>}<article><i className="blue">◷</i><span>Falta receber</span><strong>{compact.format(pending)}</strong><small>Recebimentos pendentes</small></article><article><i className="purple">%</i><span>{sessionRole === "corretor" ? "Minha comissão a receber" : "Comissões calculadas"}</span><strong>{compact.format(sessionRole === "corretor" ? paidCommission : (paidCommission || projectedCommission))}</strong><small>{data.commissions.length} lançamentos</small></article></section>{tab === "overview" && <FinanceOverview months={months} receipts={receipts} sales={concluidas} totalVgv={totalVgv} goal={data.goals[0]?.meta_vgv ?? 0} projectedCommission={projectedCommission} paidCommission={paidCommission} ranking={ranking} commissions={data.commissions} sessionRole={sessionRole} rankingVgv={data.rankingVgv} />}{tab === "sales" && <SalesCommissions data={data} sales={sales} onSale={setSelectedSaleId} onNewSale={() => setNewSaleOpen(true)} sessionRole={sessionRole} />}{tab === "indications" && <Indicacoes data={data} sales={sales} onSale={setSelectedSaleId} />}{tab === "taxas" && <TaxasGerente data={data} sales={sales} onSale={setSelectedSaleId} sessionUserId={sessionUserId} isAdmin={sessionRole === "admin"} />}{tab === "metas" && sessionRole !== "corretor" && <MetasTab accessToken={accessToken} data={data} />}{tab === "cash" && <CashFlow cash={cash} receipts={receipts} sales={data.sales} data={data} onMutate={async (payload) => { await mutate(payload); }} onSale={setSelectedSaleId} onNewCash={() => setCashOpen(true)} onNewReceipt={() => setReceiptOpen(true)} onEditCash={(item) => setCashEdit(item)} onDeleteCash={async (item) => { if (!window.confirm(`Excluir este lançamento?\n\n${item.tipo === "entrada" ? "Entrada" : "Saída"} de ${brl.format(item.valor)} · ${item.categoria} · ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.data}T12:00:00`))}${item.recebimento_id ? "\n\nA parcela vinculada volta a aparecer em \"A receber\"." : ""}\n\nA ação fica registrada na auditoria.`)) return; try { const resposta = await mutate({ action: "deleteCash", cashId: item.id }); setMessage(resposta?.reopened ? "Lançamento excluído. A parcela vinculada voltou para pendente." : "Lançamento excluído."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível excluir."); } }} onSettle={async (receipt, received) => { try { await mutate({ action: "settleReceipt", receiptId: receipt.id, received }); setMessage(received ? "Recebimento baixado." : "Baixa desfeita."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível baixar."); } }} />}{tab === "marketing" && <MarketingFinance data={data} cash={cash} sales={sales} />}{tab === "ganhos" && <MeusGanhos />} {selectedSaleId && <VendaModal data={data} saleId={selectedSaleId} sessionRole={sessionRole} onClose={() => setSelectedSaleId(null)} onSave={async (payload) => { await mutate(payload); }} onDelete={async (saleId) => { await mutate({ action: "deleteSale", saleId }); setSelectedSaleId(null); setMessage("Venda apagada."); }} />}{(cashOpen || cashEdit) && <CashModal data={data} initial={cashEdit} onClose={() => { setCashOpen(false); setCashEdit(null); }} onManage={async (payload) => { await mutate(payload); }} onSave={async (payload) => { await mutate(payload); const editava = Boolean(cashEdit); setCashOpen(false); setCashEdit(null); setMessage(editava ? "Lançamento atualizado." : "Movimentação registrada no caixa."); }} />}{receiptOpen && <ReceiptModal sales={data.sales} receipts={data.receipts} onClose={() => setReceiptOpen(false)} onSave={async (payload) => { await mutate(payload); setReceiptOpen(false); setMessage("Recebimento programado."); }} />}{newSaleOpen && <VendaModal data={data} saleId={null} sessionRole={sessionRole} onClose={() => setNewSaleOpen(false)} onSave={async (payload) => { await mutate(payload); setNewSaleOpen(false); setMessage("Venda lançada com sucesso."); }} onDelete={async () => {}} />}</div>;
}

function FinancePeriodBar({ months }: { months: string[] }) {
  const availableYears = [...new Set(months.map((item) => item.slice(0, 4)))].sort().reverse();
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(availableYears[0] || String(new Date().getFullYear()));
  const [semester, setSemester] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const apply = () => {
    const next = start || end ? `range:${start},${end}` : month ? `month:${year}-${month}` : semester ? `semester:${year}-${semester}` : year ? `year:${year}` : "all";
    window.dispatchEvent(new CustomEvent("finance-period-change", { detail: next }));
  };
  const clear = () => { setMonth(""); setSemester(""); setStart(""); setEnd(""); setYear(availableYears[0] || String(new Date().getFullYear())); window.dispatchEvent(new CustomEvent("finance-period-change", { detail: "all" })); };
  return <section className="finance-period-bar" aria-label="Filtros do período financeiro">
    <label>Mês<select value={month} onChange={(event) => { setMonth(event.target.value); if (event.target.value) { setSemester(""); setStart(""); setEnd(""); } }}><option value="">Todos</option>{Array.from({ length: 12 }, (_, index) => { const value = String(index + 1).padStart(2, "0"); const label = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, index, 15)); return <option value={value} key={value}>{label[0].toUpperCase() + label.slice(1)}</option>; })}</select></label>
    <label>Ano<select value={year} onChange={(event) => setYear(event.target.value)}>{(availableYears.length ? availableYears : [String(new Date().getFullYear())]).map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
    <label>Semestre<select value={semester} onChange={(event) => { setSemester(event.target.value); if (event.target.value) { setMonth(""); setStart(""); setEnd(""); } }}><option value="">Todos</option><option value="1">1º semestre</option><option value="2">2º semestre</option></select></label>
    <span className="finance-period-divider">ou período</span>
    <label>De<input type="date" value={start} onChange={(event) => { setStart(event.target.value); if (event.target.value) { setMonth(""); setSemester(""); } }} /></label>
    <label>Até<input type="date" min={start || undefined} value={end} onChange={(event) => { setEnd(event.target.value); if (event.target.value) { setMonth(""); setSemester(""); } }} /></label>
    <button className="apply" type="button" onClick={apply}>Aplicar filtros</button><button type="button" onClick={clear}>Limpar</button>
  </section>;
}

function FinanceOverview({ months, receipts, sales, totalVgv, goal, projectedCommission, paidCommission, ranking, commissions, sessionRole = "corretor", rankingVgv }: { months: string[]; receipts: Receipt[]; sales: Sale[]; totalVgv: number; goal: number; projectedCommission: number; paidCommission: number; ranking: FinanceRankingRow[]; commissions: Commission[]; sessionRole?: "admin" | "gestor" | "corretor"; rankingVgv?: Array<{ corretor_id: string; corretor: string; vendas: number; vgv: number }> }) {
  const isCorretor = sessionRole === "corretor";
  const vgvRows = (rankingVgv ?? []).map((r) => ({ id: r.corretor_id, name: r.corretor, sales: Number(r.vendas) || 0, vgv: Number(r.vgv) || 0 })).sort((a, b) => b.vgv - a.vgv).slice(0, 10);
  const vgvTotalAll = (rankingVgv ?? []).reduce((sum, r) => sum + (Number(r.vgv) || 0), 0);
  const [rankingScope, setRankingScope] = useState<"broker" | "team" | "product">("broker");
  const [rankingSort, setRankingSort] = useState<"vgv" | "sales" | "generated">("vgv");
  const progress = goal > 0 ? Math.min(100, Math.round(totalVgv / goal * 100)) : 0;
  const averageTicket = sales.length ? totalVgv / sales.length : 0;
  const canceledSales = sales.filter((sale) => /cancel|distrato/i.test(sale.status || ""));
  const canceledVgv = canceledSales.reduce((sum, sale) => sum + sale.vgv, 0);
  const pendingCommission = Math.max(0, projectedCommission - paidCommission);
  const today = new Date().toISOString().slice(0, 10);
  const overdueReceipts = receipts.filter((receipt) => receipt.status !== "recebido" && Boolean(receipt.data_prevista) && receipt.data_prevista! < today).reduce((sum, receipt) => sum + receipt.valor_total, 0);
  const teamRows: FinanceRankingRow[] = sales.length ? [{ id: "team", name: "Equipe comercial", sales: sales.length, vgv: totalVgv, generated: projectedCommission, received: paidCommission, ticket: averageTicket }] : [];
  const productRows: FinanceRankingRow[] = [...new Set(sales.map((sale) => sale.empreendimento_nome || "Produto não informado"))].map((name) => { const productSales = sales.filter((sale) => (sale.empreendimento_nome || "Produto não informado") === name); const saleIds = new Set(productSales.map((sale) => sale.id)); const vgv = productSales.reduce((sum, sale) => sum + sale.vgv, 0); const generated = productSales.reduce((sum, sale) => sum + sale.vgv * Number(sale.percentual_comissao || 0), 0); const received = commissions.filter((commission) => saleIds.has(commission.venda_id)).reduce((sum, commission) => sum + commission.valor_final, 0); return { id: name, name, sales: productSales.length, vgv, generated, received, ticket: productSales.length ? vgv / productSales.length : 0 }; });
  const scopedRanking = rankingScope === "broker" ? ranking : rankingScope === "team" ? teamRows : productRows;
  const visibleRanking = [...scopedRanking].sort((a, b) => rankingSort === "sales" ? b.sales - a.sales : rankingSort === "generated" ? b.generated - a.generated : b.vgv - a.vgv).slice(0, 10);
  return <section className="finance-overview">
    <FinancePeriodBar months={months} />
    <div className="finance-vgv-block">
      <article className="finance-vgv-hero"><span>VGV VENDIDO</span><strong>{brl.format(totalVgv)}</strong><small>{sales.length} venda(s) concluída(s) · período selecionado</small><em className="finance-vgv-badge">● Dados atualizados</em><p>Meta do período · {goal > 0 ? brl.format(goal) : "não definida"}<b>{progress}%</b></p><i><u style={{ width: `${progress}%` }} /></i></article>
      <div className="finance-vgv-side"><article><span>Ticket médio</span><strong>{brl.format(averageTicket)}</strong></article>{!isCorretor && <article><span>Comissão prevista</span><strong>{brl.format(projectedCommission)}</strong></article>}<article><span>{isCorretor ? "Minha comissão" : "Comissão recebida"}</span><strong className="positive">{brl.format(paidCommission)}</strong></article><article><span>Vendas canceladas</span><strong>{canceledSales.length} · {compact.format(canceledVgv)}</strong></article></div>
    </div>
    <section className="finance-summary-strip">{!isCorretor && <article><span>Comissão prevista</span><strong>{compact.format(projectedCommission)}</strong></article>}<article><span>{isCorretor ? "Minha comissão" : "Comissão recebida"}</span><strong className="positive">{compact.format(paidCommission)}</strong></article>{!isCorretor && <article><span>Comissão pendente</span><strong className="warning">{compact.format(pendingCommission)}</strong></article>}<article><span>Recebimentos vencidos</span><strong className="negative">{compact.format(overdueReceipts)}</strong></article><article><span>Nº de vendas</span><strong>{sales.length}</strong></article><article><span>Ticket médio</span><strong>{compact.format(averageTicket)}</strong></article><article><span>Canceladas</span><strong>{canceledSales.length}</strong></article></section>
    {isCorretor
      ? <article className="finance-panel finance-ranking finance-ranking-designer"><header className="finance-ranking-toolbar"><div><h2>Ranking de VGV — equipe</h2><p style={{ margin: "3px 0 0", color: "#918b86", fontSize: 11 }}>Comparativo de vendas (VGV) entre corretores. Valores de comissão são individuais e não aparecem aqui.</p></div></header><div className="finance-ranking-table finance-ranking-vgv"><div className="finance-ranking-head"><span>#</span><span>Corretor</span><span>Vendas</span><span>VGV</span><span>% do total</span></div>{vgvRows.map((item, index) => <article key={item.id}><b>{index + 1}</b><strong>{item.name}</strong><span>{item.sales}</span><span>{compact.format(item.vgv)}</span><span>{vgvTotalAll > 0 ? `${Math.round(item.vgv / vgvTotalAll * 100)}%` : "0%"}</span></article>)}{vgvRows.length === 0 && <p className="finance-empty">Ranking indisponível no momento.</p>}</div></article>
      : <article className="finance-panel finance-ranking finance-ranking-designer"><header className="finance-ranking-toolbar"><div><h2>Ranking de vendas</h2><nav><button className={rankingScope === "broker" ? "active" : ""} type="button" onClick={() => setRankingScope("broker")}>Corretor</button><button className={rankingScope === "team" ? "active" : ""} type="button" onClick={() => setRankingScope("team")}>Equipe</button><button className={rankingScope === "product" ? "active" : ""} type="button" onClick={() => setRankingScope("product")}>Empreendimento</button></nav></div><select aria-label="Ordenar ranking" value={rankingSort} onChange={(event) => setRankingSort(event.target.value as "vgv" | "sales" | "generated")}><option value="vgv">Maior VGV</option><option value="sales">Mais vendas</option><option value="generated">Maior comissão</option></select></header><div className="finance-ranking-table"><div className="finance-ranking-head"><span>#</span><span>Nome</span><span>Vendas</span><span>VGV</span><span>Comissão gerada</span><span>Comissão recebida</span><span>Ticket médio</span><span>% VGV</span></div>{visibleRanking.map((item, index) => <article key={item.id}><b>{index + 1}</b><strong>{item.name}</strong><span>{item.sales}</span><span>{compact.format(item.vgv)}</span><span>{compact.format(item.generated)}</span><span>{compact.format(item.received)}</span><span>{compact.format(item.ticket)}</span><span>{totalVgv > 0 ? `${Math.round(item.vgv / totalVgv * 100)}%` : "0%"}</span></article>)}{visibleRanking.length === 0 && <p className="finance-empty">Nenhuma venda encontrada neste período.</p>}</div></article>}
  </section>;
}

function SalesCommissions({ data, sales, onSale, onNewSale, sessionRole = "corretor" }: { data: FinanceData; sales: Sale[]; onSale: (id: string) => void; onNewSale?: () => void; sessionRole?: "admin" | "gestor" | "corretor" }) {
  const isCorretor = sessionRole === "corretor";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const detailById = new Map(data.details.filter((item): item is Detail & { id: string } => Boolean(item.id)).map((item) => [item.id, item]));
  const dealBySale = new Map(data.deals.filter((item): item is typeof item & { venda_id: string } => Boolean(item.venda_id)).map((item) => [item.venda_id, item]));
  const leadById = new Map(data.leads.map((item) => [item.id, item]));
  const brokerById = new Map(data.brokers.map((item) => [item.id, item]));
  const commissionBySale = data.commissions.reduce((map, item) => map.set(item.venda_id, (map.get(item.venda_id) || 0) + Number(item.valor_final || 0)), new Map<string, number>());
  const rows = sales.map((sale) => {
    const detail = detailById.get(sale.id);
    const deal = dealBySale.get(sale.id);
    const lead = deal ? leadById.get(deal.lead_id) : null;
    const broker = deal?.corretor_id ? brokerById.get(deal.corretor_id) : null;
    const predicted = sale.vgv * Number(sale.percentual_comissao || 0);
    const received = commissionBySale.get(sale.id) || 0;
    const statusKey = /distrato|cancel/i.test(sale.status) ? "cancelada" : /pago|concluido|fech/i.test(sale.status) ? "fechada" : "processo";
    return { sale, code: `VD-${sale.id.slice(0, 4).toUpperCase()}`, client: lead?.nome || "Cliente não informado", broker: broker?.nome || detail?.corretores || "Não atribuído", product: sale.empreendimento_nome || detail?.empreendimento || "Empreendimento não informado", unit: detail?.unidade || sale.unidade_id || "—", predicted, received, balance: Math.max(0, predicted - received), statusKey };
  });
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = rows.filter((row) => {
    const haystack = `${row.code} ${row.client} ${row.broker} ${row.product} ${row.unit}`.toLocaleLowerCase("pt-BR");
    return (!normalizedQuery || haystack.includes(normalizedQuery)) && (status === "all" || row.statusKey === status) && (!dateFrom || row.sale.data_venda >= dateFrom) && (!dateTo || row.sale.data_venda <= dateTo);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const groups = visible.reduce((map, row) => { const key = row.sale.data_venda.slice(0, 7); const current = map.get(key) || []; current.push(row); map.set(key, current); return map; }, new Map<string, typeof visible>());
  const resetPage = () => setPage(1);
  return <section className="finance-sales finance-sales-designer">
    <article className="finance-sales-panel">
      <header className="finance-sales-toolbar"><div><h2>Vendas</h2><label><span>⌕</span><input aria-label="Buscar vendas" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Buscar cliente, corretor, unidade..." /></label><select aria-label="Filtrar status" value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="all">Todos os status</option><option value="fechada">Fechadas</option><option value="processo">Em processo</option><option value="cancelada">Canceladas</option></select><button className={filtersOpen ? "active" : ""} type="button" onClick={() => setFiltersOpen((value) => !value)}>Filtros</button></div><button className="finance-new-sale" type="button" onClick={onNewSale}>＋ Lançar nova venda</button></header>
      {filtersOpen && <div className="finance-sales-extra-filters"><label>De<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} /></label><label>Até<input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => { setDateTo(event.target.value); resetPage(); }} /></label><button type="button" onClick={() => { setDateFrom(""); setDateTo(""); resetPage(); }}>Limpar período</button></div>}
      <div className="finance-sales-scroll"><div className={`finance-sales-head${isCorretor ? " slim" : ""}`}><span>Código</span><span>Data</span><span>Cliente</span><span>Corretor</span><span>Empreendimento</span><span>Un.</span><span>Valor</span>{!isCorretor && <span>Com. prev.</span>}<span>{isCorretor ? "Minha comissão" : "Com. receb."}</span>{!isCorretor && <span>Saldo</span>}<span>Status</span><span>Ações</span></div>
        {[...groups.entries()].map(([month, monthRows]) => <section className="finance-sales-month" key={month}><header><strong>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`)).toLocaleUpperCase("pt-BR")}</strong><span>{monthRows.length} {monthRows.length === 1 ? "venda" : "vendas"} · {compact.format(monthRows.reduce((sum, row) => sum + row.sale.vgv, 0))}</span></header>{monthRows.map((row) => <article className={`finance-sale-row ${row.statusKey}${isCorretor ? " slim" : ""}`} key={row.sale.id}><span><b>{row.code}</b></span><span>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${row.sale.data_venda}T12:00:00`))}</span><span title={row.client}>{row.client}</span><span title={row.broker}>{row.broker}</span><span title={row.product}>{row.product}</span><span>{row.unit}</span><span><b>{brl.format(row.sale.vgv)}</b></span>{!isCorretor && <span>{brl.format(row.predicted)}</span>}<span>{brl.format(row.received)}</span>{!isCorretor && <span>{brl.format(row.balance)}</span>}<span><em className={row.statusKey}>{row.statusKey === "fechada" ? "Fechada" : row.statusKey === "cancelada" ? "Cancelada" : "Processo"}</em></span><span><button aria-label={`Abrir ${row.code}`} title="Abrir ficha da venda" type="button" onClick={() => onSale(row.sale.id)}>•••</button></span></article>)}</section>)}
        {visible.length === 0 && <p className="finance-sales-empty">Nenhuma venda encontrada com estes filtros.</p>}
      </div>
      <footer className="finance-sales-footer"><span>{filtered.length ? `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)} de ${filtered.length} vendas` : "0 vendas"}</span><nav><button disabled={safePage === 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), Math.max(3, safePage)).map((item) => <button className={item === safePage ? "active" : ""} type="button" onClick={() => setPage(item)} key={item}>{item}</button>)}<button disabled={safePage === totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button></nav></footer>
    </article>
  </section>;
}

function CashFlow({ cash, receipts, sales, data, onSale, onNewCash, onNewReceipt, onSettle, onEditCash, onDeleteCash, onMutate }: { cash: Cash[]; receipts: Receipt[]; sales: Sale[]; data: FinanceData; onSale: (id: string) => void; onNewCash: () => void; onNewReceipt: () => void; onSettle: (receipt: Receipt, received: boolean) => Promise<void>; onEditCash: (item: Cash) => void; onDeleteCash: (item: Cash) => void; onMutate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [sub, setSub] = useState<"movements" | "receive" | "pay" | "extrato">("movements");
  const [query, setQuery] = useState("");
  const [movementType, setMovementType] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const saleById = new Map(sales.map((item) => [item.id, item]));
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const movementRows = cash.filter((item) => (sub !== "pay" || item.tipo === "saida") && (movementType === "all" || item.tipo === movementType)).filter((item) => `${item.descricao || ""} ${item.categoria} ${item.origem || ""} ${item.venda_id ? saleById.get(item.venda_id)?.empreendimento_nome || "" : ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  const receiptRows = receipts.filter((item) => `${saleById.get(item.venda_id)?.empreendimento_nome || "Venda"} ${item.numero_parcela} ${item.status}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  const activeLength = sub === "receive" ? receiptRows.length : movementRows.length;
  const totalPages = Math.max(1, Math.ceil(activeLength / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleMovementRows = movementRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleReceiptRows = receiptRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const movementGroups = visibleMovementRows.reduce((map, item) => { const key = item.data.slice(0, 7); const current = map.get(key) || []; current.push(item); map.set(key, current); return map; }, new Map<string, Cash[]>());
  const receiptGroups = visibleReceiptRows.reduce((map, item) => { const key = (item.data_prevista || item.data_recebimento || item.created_at).slice(0, 7); const current = map.get(key) || []; current.push(item); map.set(key, current); return map; }, new Map<string, Receipt[]>());
  const monthTitle = (key: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`)).toLocaleUpperCase("pt-BR");
  const changeSub = (next: "movements" | "receive" | "pay" | "extrato") => { setSub(next); setPage(1); };
  return <section className="cash-flow finance-data-designer">
    <article className="finance-sales-panel">
      <header className="finance-sales-toolbar finance-cash-toolbar"><div><h2>Fluxo de caixa</h2><nav className="finance-data-tabs"><button className={sub === "movements" ? "active" : ""} type="button" onClick={() => changeSub("movements")}>Movimentações</button><button className={sub === "receive" ? "active" : ""} type="button" onClick={() => changeSub("receive")}>A receber</button><button className={sub === "pay" ? "active" : ""} type="button" onClick={() => changeSub("pay")}>A pagar</button><button className={sub === "extrato" ? "active" : ""} type="button" onClick={() => changeSub("extrato")}>Importar extrato</button></nav></div><div className="finance-cash-actions"><button type="button" onClick={onNewCash}>＋ Novo lançamento</button><button className="primary" type="button" onClick={onNewReceipt}>＋ Programar recebimento</button></div></header>
      {sub === "extrato" && <ExtratoImport importacoes={data.extratos ?? []} linhas={data.extratoLinhas ?? []} data={data} onMutate={onMutate} />}
      {sub !== "extrato" && <>
      <div className="finance-data-filterbar"><label><span>⌕</span><input aria-label="Buscar no fluxo de caixa" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={sub === "receive" ? "Buscar venda, parcela ou status..." : "Buscar descrição, categoria ou venda..."} /></label>{sub !== "receive" && <select aria-label="Filtrar tipo de movimentação" value={movementType} onChange={(event) => { setMovementType(event.target.value); setPage(1); }}><option value="all">Entradas e saídas</option><option value="entrada">Somente entradas</option><option value="saida">Somente saídas</option></select>}<strong>{sub === "receive" ? `${receiptRows.length} recebimentos · ${brl.format(receiptRows.reduce((sum, item) => sum + item.valor_total, 0))}` : `${movementRows.length} lançamentos · ${brl.format(movementRows.reduce((sum, item) => sum + (item.tipo === "entrada" ? item.valor : -item.valor), 0))}`}</strong></div>
      {sub === "receive" ? <div className="finance-data-scroll"><div className="finance-receipt-head"><span>Venda / parcela</span><span>Vencimento</span><span>Valor</span><span>Status</span><span>Ação</span></div>{[...receiptGroups.entries()].map(([month, items]) => <section className="finance-data-month" key={month}><header><strong>{monthTitle(month)}</strong><span>{items.length} {items.length === 1 ? "recebimento" : "recebimentos"} · {brl.format(items.reduce((sum, item) => sum + item.valor_total, 0))}</span></header>{items.map((item) => <article className={`finance-receipt-row ${item.status}`} key={item.id}><span><b>{saleById.get(item.venda_id)?.empreendimento_nome || "Venda"}</b><small>Parcela {item.numero_parcela}</small></span><span>{item.data_prevista ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.data_prevista}T12:00:00`)) : "—"}</span><span><b>{brl.format(item.valor_total)}</b></span><span><em className={item.status}>{item.status === "recebido" ? "Recebido" : "Pendente"}</em></span><span><button type="button" onClick={() => void onSettle(item, item.status !== "recebido")}>{item.status === "recebido" ? "Desfazer" : "Dar baixa"}</button></span></article>)}</section>)}{receiptRows.length === 0 && <p className="finance-data-empty">Nenhum recebimento encontrado.</p>}</div> : <div className="finance-data-scroll"><div className="finance-cash-head"><span>Data</span><span>Descrição</span><span>Categoria</span><span>Origem</span><span>Venda relacionada</span><span>Valor</span><span>Tipo</span><span>Ações</span></div>{[...movementGroups.entries()].map(([month, items]) => <section className="finance-data-month" key={month}><header><strong>{monthTitle(month)}</strong><span>{items.length} {items.length === 1 ? "lançamento" : "lançamentos"} · saldo {brl.format(items.reduce((sum, item) => sum + (item.tipo === "entrada" ? item.valor : -item.valor), 0))}</span></header>{items.map((item) => <article className={`finance-cash-row ${item.tipo}`} key={item.id}><span>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.data}T12:00:00`))}</span><span title={item.descricao || item.categoria}><b>{item.descricao || item.categoria}</b></span><span>{item.categoria}</span><span>{item.origem || "Manual"}</span><span title={item.venda_id ? saleById.get(item.venda_id)?.empreendimento_nome || "Venda vinculada" : "Sem vínculo"}>{item.venda_id ? saleById.get(item.venda_id)?.empreendimento_nome || "Venda vinculada" : "Sem vínculo"}</span><span><b>{item.tipo === "entrada" ? "+ " : "− "}{brl.format(item.valor)}</b></span><span><em className={item.tipo}>{item.tipo === "entrada" ? "Entrada" : "Saída"}</em></span><span><CashRowMenu item={item} saleName={item.venda_id ? saleById.get(item.venda_id)?.empreendimento_nome || null : null} onSale={onSale} onEdit={onEditCash} onDelete={onDeleteCash} /></span></article>)}</section>)}{movementRows.length === 0 && <p className="finance-data-empty">Nenhuma movimentação encontrada.</p>}</div>}
      <footer className="finance-sales-footer"><span>{activeLength ? `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, activeLength)} de ${activeLength} ${sub === "receive" ? "recebimentos" : "lançamentos"}` : `0 ${sub === "receive" ? "recebimentos" : "lançamentos"}`}</span><nav><button aria-label="Página anterior" disabled={safePage === 1} type="button" onClick={() => setPage(Math.max(1, safePage - 1))}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), Math.max(3, safePage)).map((item) => <button className={item === safePage ? "active" : ""} type="button" onClick={() => setPage(item)} key={item}>{item}</button>)}<button aria-label="Próxima página" disabled={safePage === totalPages} type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))}>›</button></nav></footer></>}
    </article>
  </section>;
}

function MarketingFinance({ data, cash, sales }: { data: FinanceData; cash: Cash[]; sales: Sale[] }) {
  const investment = cash.filter((item) => item.tipo === "saida" && /marketing|meta|google|tr[aá]fego|an[uú]ncio/i.test(`${item.categoria} ${item.descricao || ""}`)).reduce((sum, item) => sum + item.valor, 0);
  const origins = [...new Set(data.leads.map((item) => item.origem || "Sem origem"))].map((origin) => ({ origin, leads: data.leads.filter((item) => (item.origem || "Sem origem") === origin).length, sales: data.deals.filter((deal) => deal.venda_id && data.leads.find((lead) => lead.id === deal.lead_id)?.origem === (origin === "Sem origem" ? null : origin)).length })).sort((a, b) => b.leads - a.leads);
  const revenue = sales.reduce((sum, item) => sum + item.vgv * Number(item.percentual_comissao || 0), 0);
  const totalLeads = origins.reduce((sum, item) => sum + item.leads, 0);
  const totalSales = origins.reduce((sum, item) => sum + item.sales, 0);
  const visibleOrigins = origins.slice(0, 12);
  const tones = ["orange", "purple", "green", "blue", "red"];
  return <section className="finance-data-designer finance-marketing-designer">
    <article className="finance-sales-panel">
      <header className="finance-sales-toolbar"><div><h2>Marketing</h2><p>Investimento, origem dos leads e conversão em vendas.</p></div><strong className="finance-data-total">{totalLeads} leads · {totalSales} vendas</strong></header>
      <div className="finance-module-kpis">
        <article className="tone-orange"><span>Investimento identificado</span><strong>{brl.format(investment)}</strong><small>Saídas de mídia e tráfego</small></article>
        <article className="tone-green"><span>Receita de comissão</span><strong>{brl.format(revenue)}</strong><small>Projetada pelas vendas</small></article>
        <article className="tone-purple"><span>Retorno sobre mídia</span><strong>{investment ? `${(revenue / investment).toFixed(1)}x` : "—"}</strong><small>Receita ÷ investimento</small></article>
      </div>
      <div className="finance-data-scroll"><div className="finance-marketing-head"><span>#</span><span>Canal de origem</span><span>Leads</span><span>Vendas</span><span>Conversão</span><span>Participação</span></div>{visibleOrigins.map((item, index) => <article className={`finance-marketing-row tone-${tones[index % tones.length]}`} key={item.origin}><span><b>{index + 1}</b></span><span><strong>{item.origin}</strong></span><span>{item.leads}</span><span>{item.sales}</span><span><em>{item.leads ? Math.round(item.sales / item.leads * 100) : 0}%</em></span><span><i><u style={{ width: `${totalLeads ? item.leads / totalLeads * 100 : 0}%` }} /></i><small>{totalLeads ? Math.round(item.leads / totalLeads * 100) : 0}%</small></span></article>)}{visibleOrigins.length === 0 && <p className="finance-data-empty">Nenhuma origem encontrada para o período selecionado.</p>}</div>
      <footer className="finance-sales-footer"><span>{visibleOrigins.length} de {origins.length} canais de origem</span></footer>
    </article>
  </section>;
}

const CASH_CATEGORIES: Record<"entrada" | "saida", string[]> = {
  entrada: ["Recebimento de venda", "Sinal / entrada de venda", "Distrato / estorno", "Aporte / capital", "Outros recebimentos"],
  saida: ["Pagamento de comissão", "Repasse ao proprietário", "Marketing e tráfego", "Taxas e impostos", "Despesa operacional", "Folha / salários", "Outras saídas"],
};

/* Menu de ações de cada linha do fluxo de caixa (ago/2026).
   Antes o ••• só existia quando o lançamento tinha venda vinculada, e só servia para
   abrir a venda — lançamento errado ficava no caixa para sempre. Agora o ••• aparece
   em toda linha e concentra as três ações. Uma affordance só: quem opera não precisa
   decorar dois botões parecidos lado a lado.

   O fundo invisível fecha o menu ao clicar fora. É um <button>, não uma <div> com
   onClick, para o teclado e o leitor de tela também conseguirem sair daqui. */
function CashRowMenu({ item, saleName, onSale, onEdit, onDelete }: { item: Cash; saleName: string | null; onSale: (id: string) => void; onEdit: (item: Cash) => void; onDelete: (item: Cash) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const fechar = () => setPos(null);
  /* O menu é `position:fixed` ancorado no botão, e NÃO um dropdown absoluto dentro da
     linha. A célula de Ações tem overflow:hidden e a tabela vive dentro de um contêiner
     com rolagem — um dropdown normal seria cortado nos dois. Fixed escapa de ambos.
     Se não couber para baixo, abre para cima: nas últimas linhas da página o menu
     ficaria fora da tela. */
  const abrir = () => {
    if (pos) { fechar(); return; }
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const altura = item.venda_id ? 150 : 108;
    const paraCima = r.bottom + altura + 12 > window.innerHeight;
    setPos({ top: paraCima ? r.top - altura - 6 : r.bottom + 6, left: Math.max(10, Math.min(r.right - 236, window.innerWidth - 246)) });
  };
  return <div className="cash-row-menu">
    <button aria-expanded={Boolean(pos)} aria-haspopup="menu" aria-label="Ações do lançamento" className="cash-row-menu-trigger" ref={trigger} type="button" onClick={abrir}>•••</button>
    {pos && <>
      <button aria-label="Fechar menu" className="cash-row-menu-backdrop" type="button" onClick={fechar} />
      <div className="cash-row-menu-pop" role="menu" style={{ top: pos.top, left: pos.left }}>
        <button role="menuitem" type="button" onClick={() => { fechar(); onEdit(item); }}>✎ Editar lançamento</button>
        {item.venda_id && <button role="menuitem" type="button" onClick={() => { fechar(); onSale(item.venda_id!); }}>↗ Abrir {saleName || "venda relacionada"}</button>}
        <button className="cash-row-menu-danger" role="menuitem" type="button" onClick={() => { fechar(); onDelete(item); }}>🗑 Excluir lançamento</button>
      </div>
    </>}
  </div>;
}

function CashModal({ data, initial, onClose, onSave, onManage }: { data: FinanceData; initial?: Cash | null; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void>; onManage: (payload: Record<string, unknown>) => Promise<void> }) {
  /* O mesmo modal serve para criar e para editar. Em modo edição os VÍNCULOS (venda,
     parcela, comissão) entram só como leitura: alterá-los aqui dessincronizaria a venda
     e o "A receber" sem aviso. Para trocar vínculo, exclua e lance de novo. */
  const editando = Boolean(initial);
  const [form, setForm] = useState(initial
    ? { type: initial.tipo, category: initial.categoria, date: initial.data, value: String(initial.valor), description: initial.descricao || "", saleId: initial.venda_id || "", receiptId: initial.recebimento_id || "", commissionId: initial.comissao_id || "", settle: false }
    : { type: "saida", category: "", date: new Date().toISOString().slice(0, 10), value: "", description: "", saleId: "", receiptId: "", commissionId: "", settle: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const userById = new Map(data.users.map((u) => [u.id, u]));
  const detailById = new Map(data.details.filter((d) => d.id).map((d) => [d.id as string, d]));
  const papelLabel: Record<string, string> = { corretor: "Corretor", executivo: "Executivo", gerente: "Taxa de gerente", indicacao: "Indicação", apecerto: "Apecerto" };
  const saleLabel = (sale: Sale) => {
    const detail = detailById.get(sale.id);
    const bits = [`VD-${sale.id.slice(0, 4).toUpperCase()}`, sale.empreendimento_nome || detail?.empreendimento || "Venda"];
    if (detail?.unidade) bits.push(`Un ${detail.unidade}`);
    bits.push(new Intl.DateTimeFormat("pt-BR").format(new Date(`${sale.data_venda}T12:00:00`)));
    bits.push(brl.format(sale.vgv));
    return bits.join(" · ");
  };
  const dbCategories = (data.categorias ?? []).filter((c) => c.tipo === form.type || c.tipo === "ambos");
  const categories = dbCategories.length ? dbCategories.map((c) => c.nome) : CASH_CATEGORIES[form.type as "entrada" | "saida"];
  const selectedCat = dbCategories.find((c) => c.nome === form.category);
  const natureza = selectedCat?.natureza || "normal";
  const isCommissionPayment = natureza === "comissao_paga";
  const isCommissionReceived = natureza === "comissao_recebida";
  const saleCommissions = form.saleId ? data.commissions.filter((c) => c.venda_id === form.saleId) : [];
  const saleReceipts = form.saleId ? data.receipts.filter((r) => r.venda_id === form.saleId).sort((a, b) => a.numero_parcela - b.numero_parcela) : [];
  /* Na edição os vínculos são imutáveis, então os seletores de parcela e de comissão
     saem de cena — deixá-los visíveis prometeria uma troca que o backend não aceita. */
  const showReceiptPicker = !editando && form.type === "entrada" && !isCommissionReceived && Boolean(form.saleId) && saleReceipts.length > 0;
  const runManage = (payload: Record<string, unknown>) => { setManageBusy(true); void onManage(payload).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível atualizar as categorias.")).finally(() => setManageBusy(false)); };
  const addCategory = () => { const nome = newCategory.trim(); if (!nome) return; runManage({ action: "createCategory", nome, tipo: form.type }); setNewCategory(""); };
  const selectSale = (saleId: string) => setForm((f) => ({ ...f, saleId, receiptId: "", commissionId: "", settle: false }));
  const selectCommission = (commissionId: string) => {
    const comm = saleCommissions.find((c) => c.id === commissionId);
    setForm((f) => ({ ...f, commissionId, value: f.value || (comm ? String(comm.valor_final) : "") }));
  };
  const selectReceipt = (receiptId: string) => {
    const rec = saleReceipts.find((r) => r.id === receiptId);
    setForm((f) => ({ ...f, receiptId, value: f.value || (rec ? String(rec.valor_total) : ""), settle: rec ? rec.status !== "recebido" : f.settle }));
  };
  const submit = () => {
    setError(null);
    if (!form.category) { setError("Selecione a categoria."); return; }
    /* As travas de comissão valem só na criação: na edição os vínculos não mudam,
       então exigi-los de novo bloquearia corrigir a data ou o valor de um lançamento
       antigo sem nenhum ganho. */
    if (!editando && isCommissionPayment && !form.saleId) { setError("Para pagamento de comissão, selecione a venda."); return; }
    if (!editando && isCommissionPayment && saleCommissions.length > 0 && !form.commissionId) { setError("Selecione qual comissão / corretor está sendo pago."); return; }
    if (!editando && isCommissionReceived && !form.saleId) { setError("Para comissão recebida, selecione a venda."); return; }
    if (editando) {
      setBusy(true);
      void onSave({ action: "updateCash", cashId: initial!.id, type: form.type, category: form.category, date: form.date, value: Number(form.value), description: form.description })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível salvar.")).finally(() => setBusy(false));
      return;
    }
    setBusy(true);
    const comm = saleCommissions.find((c) => c.id === form.commissionId);
    void onSave({
      action: "createCash",
      type: form.type,
      category: form.category,
      date: form.date,
      value: Number(form.value),
      description: form.description,
      natureza,
      saleId: form.saleId || null,
      receiptId: form.receiptId || null,
      commissionId: form.commissionId || null,
      beneficiarioId: comm?.beneficiario_id || null,
      papel: comm?.papel || null,
      settleReceipt: form.settle && Boolean(form.receiptId),
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível salvar.")).finally(() => setBusy(false));
  };
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <header><div><span>FLUXO DE CAIXA</span><h2>{editando ? "Editar lançamento" : "Nova movimentação"}</h2><p>{editando ? "Corrija data, tipo, categoria, valor ou descrição. Os vínculos com venda, parcela e comissão não mudam por aqui." : "Registre somente valores que efetivamente entraram ou saíram do caixa e amarre à venda correspondente."}</p></div><button type="button" onClick={onClose}>×</button></header>
    {error && <div className="modal-error">{error}</div>}
    <div className="finance-form-grid">
      <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, category: "", commissionId: "", receiptId: "", settle: false })}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
      <label>Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
      <label>Categoria<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, commissionId: "" })}><option value="">Selecione a categoria…</option>{categories.map((cat) => <option value={cat} key={cat}>{cat}</option>)}</select><button type="button" className="cash-cat-manage" onClick={() => setManageOpen((v) => !v)}>{manageOpen ? "Fechar gerenciador" : "⚙ Gerenciar categorias"}</button></label>
      {manageOpen && <div className="wide cash-cat-panel"><div className="cash-cat-add"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder={`Nova categoria de ${form.type === "entrada" ? "entrada" : "saída"}`} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCategory(); } }} /><button type="button" disabled={manageBusy || !newCategory.trim()} onClick={addCategory}>＋ Adicionar</button></div><div className="cash-cat-list">{dbCategories.length === 0 && <p className="nova-venda-hint">Usando a lista padrão. Adicione uma categoria para personalizar.</p>}{dbCategories.map((cat) => <div className="cash-cat-item" key={cat.id}><span>{cat.nome}</span><button type="button" disabled={manageBusy} title="Renomear" onClick={() => { const nome = window.prompt("Novo nome da categoria:", cat.nome); if (nome && nome.trim() && nome.trim() !== cat.nome) runManage({ action: "renameCategory", categoryId: cat.id, nome: nome.trim() }); }}>✎</button><button type="button" className="cash-cat-del" disabled={manageBusy} title="Remover" onClick={() => runManage({ action: "removeCategory", categoryId: cat.id })}>×</button></div>)}</div></div>}
      <label>Valor<MoneyInput value={form.value} ariaLabel="Valor" onChange={(raw) => setForm({ ...form, value: raw })} /></label>
      <label className="wide">Venda relacionada{editando ? " (não editável)" : (isCommissionPayment || isCommissionReceived ? " (obrigatória)" : "")}<select disabled={editando} value={form.saleId} onChange={(event) => selectSale(event.target.value)}><option value="">Sem vínculo</option>{data.sales.map((item) => <option value={item.id} key={item.id}>{saleLabel(item)}</option>)}</select></label>
      {editando && <p className="nova-venda-hint wide-hint">Para trocar a venda, a parcela ou a comissão deste lançamento, exclua e lance de novo — assim a baixa da parcela e a comissão são refeitas junto, sem ficar nada pendurado.</p>}
      {!editando && isCommissionReceived && form.saleId && <p className="nova-venda-hint wide-hint">Este valor será apontado na venda como <b>recebido pela imobiliária</b>, aguardando repasse às partes. Depois, registre cada repasse com uma categoria de comissão paga.</p>}
      {!editando && isCommissionPayment && form.saleId && (saleCommissions.length > 0
        ? <label className="wide">Comissão / corretor que está sendo pago<select required value={form.commissionId} onChange={(event) => selectCommission(event.target.value)}><option value="">Selecione a parte…</option>{saleCommissions.map((c) => <option value={c.id} key={c.id}>{papelLabel[c.papel] || c.papel}{c.beneficiario_id ? ` · ${userById.get(c.beneficiario_id)?.nome || "sem nome"}` : ""} · {brl.format(c.valor_final)}</option>)}</select></label>
        : <p className="nova-venda-hint warn wide-hint">Esta venda ainda não tem comissões distribuídas. Abra a ficha da venda em “Vendas &amp; comissões” e cadastre os participantes antes de lançar o pagamento.</p>)}
      {showReceiptPicker && <label className="wide">Parcela / recebimento desta venda<select value={form.receiptId} onChange={(event) => selectReceipt(event.target.value)}><option value="">Não amarrar a uma parcela</option>{saleReceipts.map((r) => <option value={r.id} key={r.id}>Parcela {r.numero_parcela} · {brl.format(r.valor_total)} · {r.status === "recebido" ? "recebida" : `vence ${r.data_prevista ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${r.data_prevista}T12:00:00`)) : "—"}`}</option>)}</select></label>}
      {showReceiptPicker && form.receiptId && <label className="wide cash-settle-line"><input type="checkbox" checked={form.settle} onChange={(event) => setForm({ ...form, settle: event.target.checked })} />Dar baixa nesta parcela (marcar como recebida)</label>}
      <label className="wide">Descrição<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Detalhe opcional do lançamento" /></label>
    </div>
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">{busy ? "Salvando…" : editando ? "Salvar alterações" : "Registrar"}</button></footer>
  </form></div>;
}

function ReceiptModal({ sales, receipts, onClose, onSave }: { sales: Sale[]; receipts: Receipt[]; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) { const [form, setForm] = useState({ saleId: "", installment: "1", due: new Date().toISOString().slice(0, 10), value: "" }); const [busy, setBusy] = useState(false); return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); void onSave({ action: "createReceipt", ...form, installment: Number(form.installment), value: Number(form.value) }).finally(() => setBusy(false)); }}><header><div><span>CONTAS A RECEBER</span><h2>Programar recebimento</h2><p>Crie uma parcela prevista ligada à venda.</p></div><button type="button" onClick={onClose}>×</button></header><label>Venda<select required value={form.saleId} onChange={(event) => { const saleId = event.target.value; setForm({ ...form, saleId, installment: String(receipts.filter((item) => item.venda_id === saleId).length + 1) }); }}><option value="">Selecione</option>{sales.map((item) => <option value={item.id} key={item.id}>{item.empreendimento_nome || item.id}</option>)}</select></label><div className="finance-form-grid"><label>Parcela<input required min="1" type="number" value={form.installment} onChange={(event) => setForm({ ...form, installment: event.target.value })} /></label><label>Vencimento<input required type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} /></label><label className="wide">Valor<MoneyInput value={form.value} ariaLabel="Valor" onChange={(raw) => setForm({ ...form, value: raw })} /></label></div><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">Programar</button></footer></form></div>; }

// Mantém a assinatura em string usada aqui, delegando a máscara ao componente compartilhado.
function MoneyInput({ value, onChange, ariaLabel, placeholder }: { value: string; onChange: (raw: string) => void; ariaLabel?: string; placeholder?: string }) {
  return <MoneyField value={value} aria-label={ariaLabel} placeholder={placeholder} onChange={(valor) => onChange(valor === "" ? "" : String(valor))} />;
}

function MetasTab({ accessToken, data }: { accessToken: string; data: FinanceData }) {
  const now = new Date();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [form, setForm] = useState({ corretorId: "global", periodoTipo: "mensal", ano: String(now.getFullYear()), periodo: String(now.getMonth() + 1), metaVgv: "", metaVendas: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const brokerById = new Map(data.brokers.map((b) => [b.id, b]));
  const saleCorretor = new Map(data.deals.filter((d) => d.venda_id).map((d) => [d.venda_id as string, d.corretor_id]));
  const load = async () => { const r = await fetch("/api/metas", { headers: { Authorization: `Bearer ${accessToken}` } }); const j = await r.json() as { metas?: Meta[] }; setMetas(j.metas ?? []); };
  useEffect(() => { void load(); }, []);
  const inPeriod = (dv: string, tipo: string, ano: number, periodo: number) => { const d = new Date(`${dv}T12:00:00`); if (d.getFullYear() !== ano) return false; const m = d.getMonth() + 1; if (tipo === "anual") return true; if (tipo === "mensal") return m === periodo; if (tipo === "semestral") return periodo === 1 ? m <= 6 : m >= 7; return false; };
  // Meta realizada = só venda concluída, medida no mês da conclusão.
  const realized = (meta: Meta) => { const rel = data.sales.filter((s) => s.data_conclusao && inPeriod(s.data_conclusao, meta.periodo_tipo, meta.ano, meta.periodo) && (meta.corretor_id === null || saleCorretor.get(s.id) === meta.corretor_id)); return { vgv: rel.reduce((sum, s) => sum + Number(s.vgv || 0), 0), count: rel.length }; };
  const save = async () => { setBusy(true); setMsg(null); try { const r = await fetch("/api/metas", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", corretorId: form.corretorId, periodoTipo: form.periodoTipo, ano: Number(form.ano), periodo: form.periodoTipo === "anual" ? 0 : Number(form.periodo), metaVgv: Number(form.metaVgv), metaVendas: Number(form.metaVendas) }) }); const j = await r.json() as { error?: string }; if (!r.ok) throw new Error(j.error); setMsg(editingId ? "Meta atualizada." : "Meta salva."); setForm({ ...form, metaVgv: "", metaVendas: "" }); setEditingId(null); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setBusy(false); } };
  const edit = (m: Meta) => { setEditingId(m.id); setMsg(null); setForm({ corretorId: m.corretor_id === null ? "global" : String(m.corretor_id), periodoTipo: m.periodo_tipo, ano: String(m.ano), periodo: String(m.periodo || (m.periodo_tipo === "anual" ? 0 : 1)), metaVgv: m.meta_vgv ? String(m.meta_vgv) : "", metaVendas: m.meta_vendas ? String(m.meta_vendas) : "" }); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setEditingId(null); setForm({ ...form, metaVgv: "", metaVendas: "" }); };
  const remove = async (id: string) => { setBusy(true); try { await fetch("/api/metas", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) }); if (editingId === id) { setEditingId(null); } await load(); } finally { setBusy(false); } };
  const periodoLabel = (m: Meta) => m.periodo_tipo === "anual" ? `Ano ${m.ano}` : m.periodo_tipo === "semestral" ? `${m.periodo}º sem/${m.ano}` : `${String(m.periodo).padStart(2, "0")}/${m.ano}`;
  return <section className="metas-tab finance-data-designer finance-goals-designer">
    <article className="finance-sales-panel finance-goal-panel"><header className="finance-sales-toolbar"><div><h2>Definir meta</h2><p>Crie objetivos proporcionais por período e responsável.</p></div><strong className="finance-data-total">VGV e nº de vendas</strong></header>
      <div className="metas-form">
        <label>Escopo<select value={form.corretorId} onChange={(e) => setForm({ ...form, corretorId: e.target.value })}><option value="global">Imobiliária (global)</option>{data.brokers.filter((b) => b.ativo).map((b) => <option value={b.id} key={b.id}>{b.nome}</option>)}</select></label>
        <label>Período<select value={form.periodoTipo} onChange={(e) => setForm({ ...form, periodoTipo: e.target.value })}><option value="mensal">Mensal</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></label>
        <label>Ano<input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} /></label>
        {form.periodoTipo !== "anual" && <label>{form.periodoTipo === "mensal" ? "Mês" : "Semestre"}<select value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })}>{(form.periodoTipo === "mensal" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2]).map((n) => <option value={n} key={n}>{n}</option>)}</select></label>}
        <label>Meta VGV (R$)<MoneyInput value={form.metaVgv} ariaLabel="Meta VGV em reais" onChange={(raw) => setForm({ ...form, metaVgv: raw })} /></label>
        <label>Meta nº vendas<input type="number" min="0" value={form.metaVendas} onChange={(e) => setForm({ ...form, metaVendas: e.target.value })} /></label>
        <div className="metas-form-actions"><button className="crm-primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : editingId ? "Atualizar meta" : "Salvar meta"}</button>{editingId && <button type="button" className="metas-cancel" disabled={busy} onClick={cancelEdit}>Cancelar edição</button>}</div>
      </div>
      {msg && <p className="metas-msg">{msg}</p>}
    </article>
    <article className="finance-sales-panel finance-goal-panel"><header className="finance-sales-toolbar"><div><h2>Metas definidas</h2><p>Acompanhamento do realizado e do objetivo.</p></div><strong className="finance-data-total">{metas.length} {metas.length === 1 ? "meta" : "metas"}</strong></header>
      <div className="metas-list">{metas.map((m) => { const r = realized(m); const pv = m.meta_vgv > 0 ? Math.min(100, r.vgv / m.meta_vgv * 100) : 0; const pc = m.meta_vendas > 0 ? Math.min(100, r.count / m.meta_vendas * 100) : 0; return <article key={m.id}><div className="metas-list-head"><strong>{m.corretor_id === null ? "Imobiliária (global)" : brokerById.get(m.corretor_id)?.nome || "Corretor"}</strong><span>{periodoLabel(m)}</span><div className="metas-list-actions"><button type="button" className={editingId === m.id ? "metas-editing" : ""} disabled={busy} onClick={() => edit(m)}>Editar</button><button type="button" disabled={busy} onClick={() => void remove(m.id)}>Apagar</button></div></div><div className="metas-bar"><span>VGV {brl.format(r.vgv)} / {brl.format(m.meta_vgv)} · {pv.toFixed(0)}%</span><i><u style={{ width: `${pv}%` }} /></i></div><div className="metas-bar"><span>Vendas {r.count} / {m.meta_vendas} · {pc.toFixed(0)}%</span><i><u style={{ width: `${pc}%` }} /></i></div></article>; })}{metas.length === 0 && <p className="finance-empty">Nenhuma meta definida ainda.</p>}</div>
    </article>
  </section>;
}

function Indicacoes({ data, sales, onSale }: { data: FinanceData; sales: Sale[]; onSale: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const userById = new Map(data.users.map((item) => [item.id, item]));
  const saleById = new Map(data.sales.map((item) => [item.id, item]));
  const detailById = new Map(data.details.filter((item) => item.id).map((item) => [item.id as string, item]));
  const visibleSaleIds = new Set(sales.map((item) => item.id));
  const rows = data.commissions.filter((item) => item.papel === "indicacao" && visibleSaleIds.has(item.venda_id)).map((item) => {
    const sale = saleById.get(item.venda_id);
    const detail = detailById.get(item.venda_id);
    const statusKey = sale && /pago|concluido|fech/i.test(sale.status) ? "paga" : "prevista";
    return { item, sale, detail, indicator: userById.get(item.beneficiario_id || "")?.nome || "Indicador não informado", product: sale?.empreendimento_nome || detail?.empreendimento || "Venda", unit: detail?.unidade || sale?.unidade_id || "—", date: sale?.data_venda || item.created_at.slice(0, 10), statusKey };
  });
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = rows.filter((row) => `${row.indicator} ${row.product} ${row.unit}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery) && (status === "all" || row.statusKey === status));
  const total = filtered.reduce((sum, row) => sum + Number(row.item.valor_final || 0), 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const groups = visible.reduce((map, row) => { const key = row.date.slice(0, 7); const current = map.get(key) || []; current.push(row); map.set(key, current); return map; }, new Map<string, typeof visible>());
  return <section className="finance-sales finance-sales-designer finance-indications-designer"><article className="finance-sales-panel">
    <header className="finance-sales-toolbar"><div><h2>Indicações</h2><label><span>⌕</span><input aria-label="Buscar indicações" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar indicador, empreendimento ou unidade..." /></label><select aria-label="Filtrar status das indicações" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Todos os status</option><option value="paga">Pagas</option><option value="prevista">Previstas</option></select></div><strong className="finance-data-total">{filtered.length} {filtered.length === 1 ? "indicação" : "indicações"} · {brl.format(total)}</strong></header>
    <div className="finance-data-scroll"><div className="finance-indication-head"><span>Indicador</span><span>Empreendimento</span><span>Un.</span><span>Data</span><span>Valor</span><span>Status</span><span>Ações</span></div>{[...groups.entries()].map(([month, monthRows]) => <section className="finance-data-month" key={month}><header><strong>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`)).toLocaleUpperCase("pt-BR")}</strong><span>{monthRows.length} {monthRows.length === 1 ? "indicação" : "indicações"} · {brl.format(monthRows.reduce((sum, row) => sum + Number(row.item.valor_final || 0), 0))}</span></header>{monthRows.map((row) => <article className={`finance-indication-row ${row.statusKey}`} key={row.item.id}><span title={row.indicator}><b>{row.indicator}</b></span><span title={row.product}>{row.product}</span><span>{row.unit}</span><span>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${row.date}T12:00:00`))}</span><span><b>{brl.format(row.item.valor_final)}</b></span><span><em className={row.statusKey}>{row.statusKey === "paga" ? "Paga" : "Prevista"}</em></span><span><button aria-label="Abrir venda da indicação" type="button" onClick={() => onSale(row.item.venda_id)}>•••</button></span></article>)}</section>)}{visible.length === 0 && <p className="finance-data-empty">Nenhuma indicação encontrada para o período e os filtros selecionados.</p>}</div>
    <footer className="finance-sales-footer"><span>{filtered.length ? `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)} de ${filtered.length} indicações` : "0 indicações"}</span><nav><button disabled={safePage === 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), Math.max(3, safePage)).map((item) => <button className={item === safePage ? "active" : ""} type="button" onClick={() => setPage(item)} key={item}>{item}</button>)}<button disabled={safePage === totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button></nav></footer>
  </article></section>;
}

/* Taxas de gerente — padrão do papel Gerente: cada gerente vê as PRÓPRIAS taxas
   (comissões com papel "gerente" em que ele é o beneficiário). Admin vê todas. */
function TaxasGerente({ data, sales, onSale, sessionUserId, isAdmin }: { data: FinanceData; sales: Sale[]; onSale: (id: string) => void; sessionUserId: string | null; isAdmin: boolean }) {
  const [status, setStatus] = useState("all");
  const userById = new Map(data.users.map((item) => [item.id, item]));
  const saleById = new Map(data.sales.map((item) => [item.id, item]));
  const detailById = new Map(data.details.filter((item) => item.id).map((item) => [item.id as string, item]));
  const visibleSaleIds = new Set(sales.map((item) => item.id));
  const rows = data.commissions
    .filter((item) => item.papel === "gerente" && visibleSaleIds.has(item.venda_id) && (isAdmin || (sessionUserId && item.beneficiario_id === sessionUserId)))
    .map((item) => {
      const sale = saleById.get(item.venda_id);
      const detail = detailById.get(item.venda_id);
      const statusKey = sale && /pago|concluido|fech/i.test(sale.status) ? "paga" : "prevista";
      return { item, gerente: userById.get(item.beneficiario_id || "")?.nome || "Gerente", product: sale?.empreendimento_nome || detail?.empreendimento || "Venda", unit: detail?.unidade || "—", date: sale?.data_venda || item.created_at.slice(0, 10), statusKey };
    })
    .filter((row) => status === "all" || row.statusKey === status)
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((sum, row) => sum + Number(row.item.valor_final || 0), 0);
  const recebido = rows.filter((r) => r.statusKey === "paga").reduce((sum, row) => sum + Number(row.item.valor_final || 0), 0);
  return <section className="finance-sales finance-sales-designer finance-indications-designer"><article className="finance-sales-panel">
    <header className="finance-sales-toolbar"><div><h2>Taxas de gerente</h2><select aria-label="Filtrar status das taxas" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="paga">Pagas</option><option value="prevista">Previstas</option></select></div><strong className="finance-data-total">{rows.length} {rows.length === 1 ? "taxa" : "taxas"} · {brl.format(total)} <small>({brl.format(recebido)} pagas)</small></strong></header>
    <div className="finance-data-scroll">
      <div className="finance-indication-head"><span>{isAdmin ? "Gerente" : "Beneficiário"}</span><span>Empreendimento</span><span>Un.</span><span>Data</span><span>Valor</span><span>Status</span><span>Ações</span></div>
      {rows.map((row) => <article className={`finance-indication-row ${row.statusKey}`} key={row.item.id}><span title={row.gerente}><b>{row.gerente}</b></span><span title={row.product}>{row.product}</span><span>{row.unit}</span><span>{new Intl.DateTimeFormat("pt-BR").format(new Date(`${row.date}T12:00:00`))}</span><span><b>{brl.format(row.item.valor_final)}</b></span><span><em className={row.statusKey}>{row.statusKey === "paga" ? "Paga" : "Prevista"}</em></span><span><button aria-label="Abrir venda da taxa" type="button" onClick={() => onSale(row.item.venda_id)}>•••</button></span></article>)}
      {rows.length === 0 && <p className="finance-data-empty">Nenhuma taxa de gerente lançada no período. As taxas aparecem aqui quando uma venda tem comissão com papel &quot;Taxa de gerente&quot; para você.</p>}
    </div>
  </article></section>;
}

function MeusGanhos() {
  const [rows, setRows] = useState<GanhoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        type MiniClient = { from: (table: string) => { select: (columns: string) => Promise<{ data: GanhoRow[] | null; error: { message: string } | null }> } };
        const supabase = getBrowserSupabaseClient() as unknown as MiniClient;
        const { data, error } = await supabase.from("v_ganhos_executivo").select("*");
        if (!active) return;
        if (error) throw new Error(error.message);
        setRows(data ?? []);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar seus ganhos.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);
  const recebido = rows.reduce((sum, item) => sum + Number(item.ganho_recebido || 0), 0);
  const previsto = rows.reduce((sum, item) => sum + Number(item.ganho_previsto || 0), 0);
  const total = recebido + previsto;
  const label: Record<string, string> = { recebido: "Recebido", previsto: "Previsto", distrato: "Distrato" };
  if (loading) return <section className="finance-data-designer finance-earnings-designer"><article className="finance-sales-panel"><p className="finance-data-empty">Carregando seus ganhos…</p></article></section>;
  return <section className="finance-data-designer finance-earnings-designer">
    <article className="finance-sales-panel">
      <header className="finance-sales-toolbar"><div><h2>Meus ganhos</h2><p>Comissões de executivo recebidas e previstas por venda.</p></div><strong className="finance-data-total">{rows.length} {rows.length === 1 ? "venda" : "vendas"}</strong></header>
      <div className="finance-module-kpis">
        <article className="tone-green"><span>Recebido</span><strong>{brl.format(recebido)}</strong><small>Comissões já recebidas</small></article>
        <article className="tone-orange"><span>Previsto</span><strong>{brl.format(previsto)}</strong><small>Valores ainda pendentes</small></article>
        <article className="tone-purple"><span>Total</span><strong>{brl.format(total)}</strong><small>{rows.length} vendas no total</small></article>
      </div>
      <div className="finance-data-scroll"><div className="finance-earnings-head"><span>Venda / produto</span><span>Data</span><span>VGV</span><span>Meu ganho</span><span>Status</span></div>{rows.map((row) => {
        const cls = row.situacao === "recebido" ? "recebido" : row.situacao === "previsto" ? "pendente" : "distrato";
        return <article className={`finance-earnings-row ${cls}`} key={row.comissao_id}><span><strong>{row.empreendimento || "Venda"}</strong><small>{row.unidade && row.unidade !== "-" ? `Unidade ${row.unidade}` : "Unidade não informada"}</small></span><span>{row.data_venda ? date.format(new Date(`${row.data_venda}T12:00:00`)) : "—"}</span><span><b>{brl.format(Number(row.vgv || 0))}</b></span><span><b>{brl.format(Number(row.ganho || 0))}</b></span><span><em className={cls}>{label[row.situacao] || row.situacao}</em></span></article>;
      })}{error && <p className="finance-data-empty">{error}</p>}{!error && rows.length === 0 && <p className="finance-data-empty">Você ainda não tem ganhos de executivo registrados.</p>}</div>
      <footer className="finance-sales-footer"><span>{rows.length} {rows.length === 1 ? "registro" : "registros"} de ganhos</span></footer>
    </article>
  </section>;
}
