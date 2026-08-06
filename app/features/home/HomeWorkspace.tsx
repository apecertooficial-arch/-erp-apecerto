"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import "../../styles/inicio-redesign.css";
import { RodagemCards } from "./RodagemCards";
import { FunilCards } from "./FunilCards";
import { FinanceiroCards } from "./FinanceiroCards";
import { NaMesaCards } from "./NaMesaCards";
import { InicioApp } from "./InicioApp";
import { useEhCelular } from "../system/useFormato";
import { marcarWhatsappAberto } from "../crm-nova-era/lib/whatsappAberto";

type ItemFila = {
  lead_id: number | null;
  negocio_id: number;
  nome: string | null;
  telefone_normalizado: string | null;
  interesse_resumo: string | null;
  motivo_prioridade: string;
  prioridade?: number;
  etapa: string;
  tempo_espera: number;
  sara_orientacao_curta: string | null;
  proxima_acao_tipo?: string | null;
  proxima_acao_prazo?: string | null;
  outbound_real_confirmado?: boolean;
  aguardando_sincronizacao?: boolean;
};

type Lead = { id: number; nome?: string | null };
type Deal = { id: number; lead_id: number; corretor_id?: number | null; stage_id?: number | null; status?: string | null; venda_id?: string | null };
type Stage = { id: number; nome: string; cor?: string | null; ordem?: number | null };
type Broker = { id: number; nome: string };
type Task = { id: number; concluida?: boolean | null };
type ProductLink = { lead_id: number; empreendimento_id: string; empreendimentos?: { nome?: string | null } | null };
type CrmData = { leads: Lead[]; deals: Deal[]; stages: Stage[]; brokers: Broker[]; tasks: Task[]; alerts: unknown[]; productLinks: ProductLink[] };
type Sale = { id: string; empreendimento_id?: string | null; empreendimento_nome?: string | null; vgv: number; percentual_comissao?: number | null; data_venda: string; data_conclusao?: string | null; status?: string | null };
type Cash = { tipo: string; valor: number };
type Goal = { nome?: string | null; meta_vgv?: number | null };
type FinanceData = { sales: Sale[]; cash: Cash[]; goals: Goal[]; receipts: Array<{ status?: string | null }> };
type CatalogItem = { id: string; name: string; available: number; neighborhood: string };
type CatalogData = { catalog: CatalogItem[] };
type DashboardData = { crm: CrmData; finance: FinanceData; catalog: CatalogData };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function sameMonth(value: string) {
  const now = new Date();
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function calcRestanteSegundos(item: ItemFila, agoraMs: number, loadedAtMs: number): number {
  if (item.proxima_acao_prazo) {
    const prazoMs = new Date(item.proxima_acao_prazo).getTime();
    if (!isNaN(prazoMs)) {
      return Math.floor((prazoMs - agoraMs) / 1000);
    }
  }
  // SLA padrão de 5 minutos (300s)
  const decMin = Number(item.tempo_espera) || 0;
  const decSeg = decMin * 60 + Math.floor((agoraMs - loadedAtMs) / 1000);
  return 300 - decSeg;
}

function fmtClock(restanteSegundos: number): { text: string; sub: string } {
  if (restanteSegundos >= 0) {
    const mm = String(Math.floor(restanteSegundos / 60)).padStart(2, "0");
    const ss = String(restanteSegundos % 60).padStart(2, "0");
    return { text: `${mm}:${ss}`, sub: "restantes" };
  } else {
    const absSec = Math.abs(restanteSegundos);
    const mm = String(Math.floor(absSec / 60)).padStart(2, "0");
    const ss = String(absSec % 60).padStart(2, "0");
    return { text: `−${mm}:${ss}`, sub: "estourado" };
  }
}

export function HomeWorkspace({ accessToken, sessionName = "", onNavigate, onIr }: { accessToken: string; sessionName?: string; onNavigate?: (module: string) => void; onIr?: (destino: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metaMesGlobal, setMetaMesGlobal] = useState<number | null>(null);
  
  // Fila Operacional & Relógio Vivo
  const [fila, setFila] = useState<ItemFila[] | null>(null);
  const [carregandoFila, setCarregandoFila] = useState(true);
  const [erroFila, setErroFila] = useState<string | null>(null);
  const [loadedAtMs, setLoadedAtMs] = useState<number>(Date.now());
  const [agoraMs, setAgoraMs] = useState<number>(Date.now());
  const [drawerLead, setDrawerLead] = useState<ItemFila | null>(null);
  const [metricasExpandidas, setMetricasExpandidas] = useState(false);

  const ehCelular = useEhCelular();
  const ehDesktop = ehCelular === false;

  // Carregar Fila Operacional
  const carregarFila = useCallback(async () => {
    setCarregandoFila(true);
    setErroFila(null);
    try {
      const res = await fetch("/api/ncrm/fila-operacional", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Falha ao buscar fila (${res.status})`);
      const json = await res.json();
      setFila((json.itens as ItemFila[]) ?? []);
      const now = Date.now();
      setLoadedAtMs(now);
      setAgoraMs(now);
    } catch (e) {
      setErroFila(e instanceof Error ? e.message : "Erro ao carregar fila.");
      setFila([]);
    } finally {
      setCarregandoFila(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (ehDesktop) {
      void carregarFila();
    }
  }, [ehDesktop, carregarFila]);

  // Tick vivo a cada 1 segundo para contagem regressiva viva
  useEffect(() => {
    const timer = setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Metas e Dashboard Dados Secundários (Abaixo da Dobra)
  useEffect(() => {
    const now = new Date();
    void fetch("/api/metas", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((response) => response.ok ? response.json() : { metas: [] })
      .then((json: { metas?: Array<{ corretor_id: number | null; periodo_tipo: string; ano: number; periodo: number; meta_vgv: number }> }) => {
        const found = (json.metas ?? []).find((m) => m.corretor_id === null && m.periodo_tipo === "mensal" && m.ano === now.getFullYear() && m.periodo === now.getMonth() + 1);
        setMetaMesGlobal(found ? Number(found.meta_vgv) : null);
      }).catch(() => setMetaMesGlobal(null));
  }, [accessToken]);

  useEffect(() => {
    if (!ehDesktop) return;
    const headers = { Authorization: `Bearer ${accessToken}` };
    void Promise.all([
      fetch("/api/crm", { headers }),
      fetch("/api/finance", { headers }),
      fetch("/api/catalog", { headers }),
    ]).then(async (responses) => {
      const failed = responses.find((response) => !response.ok);
      if (failed) return;
      const [crm, finance, catalog] = await Promise.all(responses.map((response) => response.json()));
      setError(null);
      setData({ crm, finance, catalog } as DashboardData);
    }).catch(() => {});
  }, [accessToken, ehDesktop]);

  // Processamento e Ordenação da Fila por SLA Restante
  const filaProcessada = useMemo(() => {
    if (!fila) return [];
    return fila.map((item) => {
      const restante = calcRestanteSegundos(item, agoraMs, loadedAtMs);
      let estado: "estourado" | "apertado" | "no-prazo";
      if (restante < 0) estado = "estourado";
      else if (restante <= 60) estado = "apertado";
      else estado = "no-prazo";
      return { item, restante, estado, clock: fmtClock(restante) };
    }).sort((a, b) => a.restante - b.restante);
  }, [fila, agoraMs, loadedAtMs]);

  const contadoresSLA = useMemo(() => {
    let estourados = 0;
    let apertados = 0;
    let noPrazo = 0;
    for (const p of filaProcessada) {
      if (p.estado === "estourado") estourados++;
      else if (p.estado === "apertado") apertados++;
      else noPrazo++;
    }
    return { estourados, apertados, noPrazo, total: filaProcessada.length };
  }, [filaProcessada]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const monthSales = data.finance.sales.filter((item) => item.data_conclusao && sameMonth(item.data_conclusao));
    const monthVgv = monthSales.reduce((sum, item) => sum + Number(item.vgv || 0), 0);
    const negociacao = data.finance.sales.filter((item) => !item.data_conclusao && item.status !== "distrato");
    const negociacaoVgv = negociacao.reduce((sum, item) => sum + Number(item.vgv || 0), 0);
    const goal = data.finance.goals.reduce((sum, item) => sum + Number(item.meta_vgv || 0), 0);
    return { monthSales, monthVgv, goal, negociacao, negociacaoVgv };
  }, [data]);

  const irPara = (destino: string) => { if (onIr) onIr(destino); else if (onNavigate) onNavigate(destino); };

  if (ehCelular === true) {
    return (
      <div className="home-mobile">
        <InicioApp accessToken={accessToken} nome={sessionName} onIr={irPara} />
      </div>
    );
  }

  if (ehCelular === null) return <div className="inicio-workspace">Conectando ao ERP…</div>;

  const firstName = sessionName ? sessionName.split(/\s+/)[0] : "Corretor";
  const initial = (sessionName || "C").trim().slice(0, 1).toUpperCase();

  return (
    <div className="inicio-workspace">
      {/* Header do Início */}
      <header className="inicio-header">
        <div className="inicio-header-info">
          <span className="inicio-eyebrow">Atendimento & SLA · apêcerto erp</span>
          <h1 className="inicio-title">Fila Operacional de Atendimento</h1>
          <p className="inicio-subtitle">
            {contadoresSLA.estourados > 0
              ? `${contadoresSLA.estourados} lead(s) com SLA estourado aguardando atendimento urgente.`
              : contadoresSLA.apertados > 0
              ? `${contadoresSLA.apertados} lead(s) em risco de estourar a janela de 5 minutos.`
              : "Sua fila de SLA está sob controle."}
          </p>
        </div>
        <div className="inicio-header-meta">
          <div className="inicio-user-badge">
            <span className="inicio-avatar-pill">{initial}</span>
            <span>Olá, <b>{firstName}</b></span>
          </div>
        </div>
      </header>

      {/* Indicador Global de SLA */}
      <div className="inicio-sla-summary-bar">
        <div className="inicio-sla-summary-group">
          <div className="inicio-sla-pill">
            <span className="inicio-sla-dot estourado" />
            <span><b>{contadoresSLA.estourados}</b> estourado(s)</span>
          </div>
          <div className="inicio-sla-pill">
            <span className="inicio-sla-dot apertado" />
            <span><b>{contadoresSLA.apertados}</b> em risco (1 min)</span>
          </div>
          <div className="inicio-sla-pill">
            <span className="inicio-sla-dot no-prazo" />
            <span><b>{contadoresSLA.noPrazo}</b> no prazo</span>
          </div>
        </div>
        <button type="button" className="inicio-refresh-btn" onClick={() => void carregarFila()}>
          ↻ Atualizar fila
        </button>
      </div>

      {/* Seção Principal: Fila de Atendimento */}
      <section className="inicio-queue-section">
        <div className="inicio-queue-header">
          <div className="inicio-queue-title-group">
            <h2 className="inicio-queue-title">Próximas Ações Urgentíssimas</h2>
            <span className="inicio-queue-count">{contadoresSLA.total} lead(s)</span>
          </div>
        </div>

        {carregandoFila && (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--fg-2)" }}>
            Buscando fila de SLA ao vivo…
          </div>
        )}

        {erroFila && (
          <div style={{ padding: "20px", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "var(--radius-md)" }}>
            Não foi possível carregar a fila: {erroFila}
          </div>
        )}

        {!carregandoFila && !erroFila && filaProcessada.length === 0 && (
          <div className="inicio-empty-card">
            <img
              src="/docs/design/ds-oficial/assets/grafismo-laranja.png"
              alt="ApêCerto"
              className="inicio-empty-grafismo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="inicio-eyebrow">Conquista de Atendimento</span>
            <h3 className="inicio-empty-title">Tudo atendido!</h3>
            <p className="inicio-empty-subtitle">
              Sua fila de SLA está 100% em dia. Todo lead recebido foi abordado dentro da janela de 5 minutos.
            </p>
            <button type="button" className="inicio-btn-secondary" onClick={() => irPara("/crm")}>
              Ver Carteira no CRM →
            </button>
          </div>
        )}

        {!carregandoFila && !erroFila && filaProcessada.length > 0 && (
          <ul className="inicio-queue-list">
            {filaProcessada.map(({ item, estado, clock }) => {
              const nameStr = item.nome ?? `Negócio #${item.negocio_id}`;
              const initials = nameStr.trim().slice(0, 2).toUpperCase();
              const tel = item.telefone_normalizado;

              return (
                <li key={item.negocio_id} className={`inicio-lead-card ${estado}`}>
                  {/* Coluna 1: SLA Clock & Nome */}
                  <div className="inicio-card-left">
                    <div className="inicio-sla-clock-badge">
                      <span className="inicio-sla-clock-time">{clock.text}</span>
                      <span className="inicio-sla-clock-label">{clock.sub}</span>
                    </div>
                    <span className="inicio-lead-avatar">{initials}</span>
                    <div className="inicio-lead-identity">
                      <span className="inicio-lead-name">{nameStr}</span>
                      {item.interesse_resumo && (
                        <span className="inicio-lead-origin">{item.interesse_resumo}</span>
                      )}
                    </div>
                  </div>

                  {/* Coluna 2: Contexto & Dica da Sara */}
                  <div className="inicio-card-center">
                    <div className="inicio-card-tags">
                      <span className="inicio-tag motivo">{item.motivo_prioridade}</span>
                      <span className="inicio-tag">{item.etapa}</span>
                    </div>
                    {item.sara_orientacao_curta && (
                      <div className="inicio-sara-hint">
                        <b>Sara:</b>
                        <span>{item.sara_orientacao_curta}</span>
                      </div>
                    )}
                  </div>

                  {/* Coluna 3: Ações Primárias */}
                  <div className="inicio-card-right">
                    {tel ? (
                      <a
                        className="inicio-btn-primary"
                        href={`whatsapp://send?phone=${tel}`}
                        onClick={() => marcarWhatsappAberto(item.negocio_id)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        Chamar no WhatsApp
                      </a>
                    ) : null}

                    <button
                      type="button"
                      className="inicio-btn-secondary"
                      onClick={() => setDrawerLead(item)}
                    >
                      Ver detalhes
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Context Drawer (Slide-Over Lateral) */}
      {drawerLead && (
        <div className="inicio-drawer-backdrop" onClick={() => setDrawerLead(null)}>
          <aside className="inicio-drawer" onClick={(e) => e.stopPropagation()}>
            <header className="inicio-drawer-header">
              <div>
                <span className="inicio-eyebrow">Detalhes do Atendimento</span>
                <h3 className="inicio-drawer-header-title">{drawerLead.nome ?? `Negócio #${drawerLead.negocio_id}`}</h3>
              </div>
              <button
                type="button"
                className="inicio-drawer-close"
                onClick={() => setDrawerLead(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="inicio-drawer-body">
              <div className="inicio-drawer-section">
                <span className="inicio-drawer-label">Empreendimento de Interesse</span>
                <span className="inicio-drawer-value">{drawerLead.interesse_resumo ?? "Não especificado"}</span>
              </div>

              <div className="inicio-drawer-section">
                <span className="inicio-drawer-label">Motivo de Prioridade</span>
                <span className="inicio-drawer-value">{drawerLead.motivo_prioridade}</span>
              </div>

              <div className="inicio-drawer-section">
                <span className="inicio-drawer-label">Etapa Atual</span>
                <span className="inicio-drawer-value">{drawerLead.etapa}</span>
              </div>

              {drawerLead.sara_orientacao_curta && (
                <div className="inicio-drawer-section">
                  <span className="inicio-drawer-label">Recomendação da Sara</span>
                  <div className="inicio-sara-hint" style={{ fontSize: "14px", padding: "12px" }}>
                    <span>{drawerLead.sara_orientacao_curta}</span>
                  </div>
                </div>
              )}

              <div className="inicio-drawer-section" style={{ marginTop: "auto", gap: "12px" }}>
                {drawerLead.telefone_normalizado && (
                  <a
                    className="inicio-btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    href={`https://wa.me/${drawerLead.telefone_normalizado}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => marcarWhatsappAberto(drawerLead.negocio_id)}
                  >
                    Abrir no WhatsApp Web
                  </a>
                )}
                <button
                  type="button"
                  className="inicio-btn-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => irPara(`/crm?lead=${drawerLead.negocio_id}`)}
                >
                  Abrir Ficha Completa no CRM →
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Seção Recolhível de Indicadores & Métricas (Abaixo da Dobra) */}
      <section className="inicio-metrics-accordion">
        <button
          type="button"
          className="inicio-accordion-toggle"
          onClick={() => setMetricasExpandidas((prev) => !prev)}
        >
          <span>Métricas de Vendas & Esteira (Abaixo da Dobra)</span>
          <span>{metricasExpandidas ? "▲ Recolher" : "▼ Expandir"}</span>
        </button>

        {metricasExpandidas && (
          <div className="inicio-metrics-content">
            {metrics && (
              <div style={{ marginBottom: "24px", padding: "16px", background: "var(--bg-surface)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)" }}>
                <span className="inicio-eyebrow">Meta de VGV do Mês</span>
                <h3 style={{ margin: "4px 0", fontSize: "20px" }}>{brl.format(metrics.monthVgv)} / {metrics.goal > 0 ? brl.format(metrics.goal) : "—"}</h3>
              </div>
            )}
            <NaMesaCards accessToken={accessToken} onNavigate={onNavigate} />
            <RodagemCards accessToken={accessToken} onNavigate={onNavigate} />
            <FunilCards accessToken={accessToken} onNavigate={onNavigate} />
            <FinanceiroCards accessToken={accessToken} onNavigate={onNavigate} />
          </div>
        )}
      </section>
    </div>
  );
}
