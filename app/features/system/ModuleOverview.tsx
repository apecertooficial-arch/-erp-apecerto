"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { humanizeTableName, moduleMap, type ModuleName } from "./module-map";

type DataRecord = Record<string, unknown>;
type Connection = { table: string; count: number; connected: boolean; error: string | null; records: DataRecord[] };
type Summary = { module: ModuleName; description: string; gap: string | null; connections: Connection[] };
type PageSpec = { eyebrow: string; tabs: string[]; title: string; guidance: string; flows: string[]; empty?: string };

const pageSpecs: Partial<Record<ModuleName, PageSpec>> = {
  "Início": { eyebrow: "VISÃO DA OPERAÇÃO", tabs: ["Visão geral", "Atendimentos", "Agenda"], title: "Operação de hoje", guidance: "Leads, produtos, conversas e vendas reunidos em uma visão executiva.", flows: ["Acompanhar novos leads e pendências", "Ver compromissos e visitas do dia", "Monitorar vendas e produtos ativos"] },
  Performance: { eyebrow: "INTELIGÊNCIA COMERCIAL", tabs: ["Visão geral", "Atividade", "Organização", "Ranking", "Metas"], title: "Performance da equipe", guidance: "Indicadores baseados nas ações registradas pela equipe, sem estimativas fictícias.", flows: ["Atendimento e velocidade de resposta", "Atividade e organização da carteira", "Ranking, metas e evolução comercial"] },
  Abordagens: { eyebrow: "BIBLIOTECA COMERCIAL", tabs: ["Produtos", "Modelos gerais"], title: "Abordagens e modelos", guidance: "Modelos existentes preservados para uso em automações, chat e disparos.", flows: ["Abordagens vinculadas a produtos", "Modelos gerais sem produto", "Mensagens ordenadas por sequência"] },
  Financiamento: { eyebrow: "CRÉDITO IMOBILIÁRIO", tabs: ["Solicitações", "Simulações", "Processo", "Publicadas"], title: "Fichas de financiamento", guidance: "Solicitações e simulações vinculadas aos atendimentos e às vendas.", flows: ["Aguardando preenchimento", "Simulação em andamento", "Resultado pronto para o cliente"] },
  Disparos: { eyebrow: "CAMPANHAS DE WHATSAPP", tabs: ["Público-alvo", "Mensagem", "Cadência", "Recentes"], title: "Disparos segmentados", guidance: "Base, abordagem e velocidade organizadas no mesmo fluxo do HTML final.", flows: ["Selecionar leads por etapa, tag ou planilha", "Escolher produto e abordagem", "Definir cadência, período e dias"] },
  Calendário: { eyebrow: "AGENDA COMERCIAL", tabs: ["Agenda", "Visitas", "Tarefas"], title: "Calendário da equipe", guidance: "Visitas, propostas, tarefas e compromissos associados aos leads.", flows: ["Agenda diária e mensal", "Visitas com imóvel e participantes", "Tarefas e lembretes de atendimento"] },
  "Agentes de IA": { eyebrow: "INTELIGÊNCIA APLICADA", tabs: ["Agentes", "Fontes", "Execuções", "Sinais"], title: "Agentes de IA", guidance: "Agentes, fontes de conhecimento e execuções do motor em uma visão operacional.", flows: ["Agentes ativos e suas funções", "Fontes consultadas por cada agente", "Execuções, sinais e acompanhamento"] },
  Usuários: { eyebrow: "GESTÃO DA EQUIPE", tabs: ["Equipe", "Acessos", "Instâncias", "Documentos"], title: "Usuários e permissões", guidance: "Equipe, presença, acessos, instâncias de WhatsApp e documentos do corretor.", flows: ["Perfis e permissões por usuário", "Seleção pesquisável de instâncias", "RG/CNH e contrato de parceria"] },
  Notificações: { eyebrow: "CENTRAL DE ALERTAS", tabs: ["Recentes", "Não lidas", "Sistema"], title: "Notificações", guidance: "Alertas de atendimento, agenda, mensagens e eventos operacionais.", flows: ["Novos leads e respostas pendentes", "Tarefas, visitas e prazos", "Eventos de automação e integração"] },
  "Base de conhecimento": { eyebrow: "CONHECIMENTO DA IA", tabs: ["Conteúdos", "Documentos", "Produtos", "Políticas"], title: "Base de conhecimento da IA", guidance: "Fontes que os agentes consultam: documentos, regras, produtos e políticas.", flows: ["Conteúdos e orientações internas", "Documentos e materiais de apoio", "Regras comerciais e políticas"], empty: "A estrutura visual foi preservada. O conteúdo ainda precisa ser migrado do HTML para uma tabela própria." },
  Auditoria: { eyebrow: "AUDITORIA E SEGURANÇA", tabs: ["Visão geral", "Ações", "Segurança", "Acessos"], title: "Auditoria e segurança", guidance: "Registro de ações, alterações, execuções e tentativas de acesso.", flows: ["Eventos e alterações operacionais", "Execuções do motor e integrações", "Acompanhamento de acesso e segurança"] },
  Configurações: { eyebrow: "ADMINISTRAÇÃO DO SISTEMA", tabs: ["Imobiliária", "Operação", "Financeiro", "Segurança"], title: "Configurações", guidance: "Preferências e regras compartilhadas pela operação da ApêCerto.", flows: ["Dados da imobiliária e escritório", "Regras de SLA e atendimento", "Parâmetros financeiros e segurança"] },
  Ajuda: { eyebrow: "CENTRAL DE AJUDA", tabs: ["Primeiros passos", "Vendas", "Produtos", "Atendimento"], title: "Ajuda e tutoriais", guidance: "Orientações de uso preservadas do ERP original para apoiar a equipe.", flows: ["Guias rápidos por módulo", "Dúvidas frequentes da operação", "Boas práticas de atendimento"], empty: "Selecione uma área acima para consultar o roteiro operacional." },
};

const ignoredFields = new Set(["id", "payload", "meta", "created_by", "criado_por", "trace_id"]);

function plain(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} item(ns)` : "Dados vinculados";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(text));
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function labelFor(record: DataRecord, table: string) {
  const preferred = ["nome", "titulo", "comprador_nome", "evento", "tipo", "descricao", "produto", "status", "rotulo"];
  for (const field of preferred) if (record[field]) return plain(record[field]);
  const identifier = record.id ? String(record.id).slice(0, 8) : "registro";
  return `${humanizeTableName(table)} · ${identifier}`;
}

function detailsFor(record: DataRecord) {
  return Object.entries(record)
    .filter(([key, value]) => !ignoredFields.has(key) && value !== null && value !== undefined && value !== "")
    .slice(0, 3);
}

function statusFor(record: DataRecord) {
  const status = record.status ?? record.ativo ?? record.processado ?? record.concluida ?? record.online;
  if (status === true) return "Ativo";
  if (status === false) return "Pendente";
  return plain(status === undefined ? "Registrado" : status);
}

export function ModuleOverview({ moduleName, accessToken }: { moduleName: ModuleName; accessToken: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("Todas as fontes");
  const [selected, setSelected] = useState<{ table: string; record: DataRecord } | null>(null);
  const definition = moduleMap[moduleName];
  const spec = pageSpecs[moduleName] ?? { eyebrow: "OPERAÇÃO", tabs: ["Visão geral"], title: moduleName, guidance: definition.description, flows: ["Dados reais conectados", "Operação preservada", "Evolução segura"] };
  const initialTab = pageSpecs[moduleName]?.tabs[0] ?? "Visão geral";

  async function load() {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/module-summary?module=${encodeURIComponent(moduleName)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error("Não foi possível consultar este módulo.");
      setSummary(await response.json() as Summary);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro de conexão."); }
    finally { setLoading(false); }
  }

  useEffect(() => { setActiveTab(initialTab); setQuery(""); setSource("Todas as fontes"); setSelected(null); void load(); }, [accessToken, moduleName, initialTab]);

  const visibleConnections = useMemo(() => (summary?.connections ?? []).filter((item) => humanizeTableName(item.table).toLowerCase().includes(query.toLowerCase())), [summary, query]);
  const records = useMemo(() => (summary?.connections ?? []).flatMap((connection) => connection.records.map((record) => ({ table: connection.table, record }))).filter((item) => {
    if (source !== "Todas as fontes" && item.table !== source) return false;
    if (!query.trim()) return true;
    return `${humanizeTableName(item.table)} ${JSON.stringify(item.record)}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [summary, query, source]);
  const connectedCount = summary?.connections.filter((item) => item.connected).length ?? 0;
  const totalRecords = summary?.connections.reduce((sum, item) => sum + (item.connected ? item.count : 0), 0) ?? 0;

  function exportData() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${moduleName.toLowerCase().replaceAll(" ", "-")}.json`; link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="operational-module">
    <header className="operational-header">
      <div><span>{spec.eyebrow}</span><h1>{moduleName}</h1><p>{definition.description}</p></div>
      <div className="operational-header-actions"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nesta página" /></label><button onClick={() => void load()} disabled={loading} type="button">↻ Atualizar</button></div>
    </header>
    <nav className="operational-tabs" aria-label={`Áreas de ${moduleName}`}>{spec.tabs.map((tab) => <button className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} type="button" key={tab}>{tab}</button>)}<span>● Supabase conectado</span></nav>
    <main className="operational-content">
      {loading && <div className="module-state">Carregando dados reais…</div>}
      {error && <div className="module-state error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
      {!loading && !error && <>
        <section className="operational-kpis">
          <article><span>◎</span><div><strong>{totalRecords.toLocaleString("pt-BR")}</strong><small>registros disponíveis</small></div></article>
          <article><span>✓</span><div><strong>{connectedCount}</strong><small>fontes conectadas</small></div></article>
          <article><span>◷</span><div><strong>Agora</strong><small>última atualização</small></div></article>
          <article><span>◆</span><div><strong>{activeTab}</strong><small>visão selecionada</small></div></article>
        </section>
        {summary?.gap && <div className="module-gap"><strong>Preservação necessária</strong><span>{summary.gap}</span></div>}
        <section className="operational-toolbar">
          <div><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar em ${moduleName.toLowerCase()}...`} /></div>
          <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Filtrar fonte"><option>Todas as fontes</option>{summary?.connections.map((connection) => <option value={connection.table} key={connection.table}>{humanizeTableName(connection.table)}</option>)}</select>
          <button type="button" onClick={exportData} disabled={records.length === 0}>↓ Exportar</button>
        </section>
        <section className="operational-layout">
          <article className="operational-focus">
            <div className="operational-section-title"><div><span>{activeTab}</span><h2>{spec.title}</h2><p>{spec.guidance}</p></div><em>Dados reais</em></div>
            {records.length > 0 ? <div className="operational-records">{records.map((item, index) => <button type="button" onClick={() => setSelected(item)} key={`${item.table}-${String(item.record.id ?? index)}`}>
              <span className="record-icon">{labelFor(item.record, item.table).slice(0, 1).toUpperCase()}</span>
              <span className="record-copy"><strong>{labelFor(item.record, item.table)}</strong><small>{detailsFor(item.record).map(([key, value]) => `${humanizeTableName(key)}: ${plain(value)}`).join(" · ") || humanizeTableName(item.table)}</small></span>
              <span className="record-source">{humanizeTableName(item.table)}<b>{statusFor(item.record)}</b></span>
            </button>)}</div> : <div className="operational-empty-state"><span>◇</span><strong>Nenhum registro nesta visão</strong><p>{spec.empty ?? "Use os filtros acima ou atualize a página para consultar os dados desta área."}</p></div>}
          </article>
          <aside className="operational-health"><div className="operational-section-title"><div><span>INTEGRAÇÕES</span><h2>Saúde dos dados</h2></div></div>{visibleConnections.map((connection) => <article key={connection.table}><span className={connection.connected ? "ok" : "blocked"} /><div><strong>{humanizeTableName(connection.table)}</strong><small>{connection.connected ? `${connection.count.toLocaleString("pt-BR")} registros` : connection.error || "Permissão pendente"}</small></div><b>{connection.connected ? "Ativa" : "Revisar"}</b></article>)}{visibleConnections.length === 0 && <div className="operational-empty">Nenhuma fonte encontrada.</div>}</aside>
        </section>
        <section className="operational-preserved"><div><span>FLUXO ORIGINAL PRESERVADO</span><h2>Funções desta área</h2></div>{spec.flows.map((flow, index) => <article key={flow}><b>{index + 1}</b><span>{flow}</span><em>{index < connectedCount ? "conectado" : "estrutura pronta"}</em></article>)}</section>
      </>}
    </main>
    {selected && <div className="operational-drawer-scrim" onClick={() => setSelected(null)}><aside className="operational-drawer" onClick={(event) => event.stopPropagation()}>
      <header><div><span>{humanizeTableName(selected.table)}</span><h2>{labelFor(selected.record, selected.table)}</h2></div><button type="button" onClick={() => setSelected(null)}>×</button></header>
      <div className="operational-drawer-fields">{Object.entries(selected.record).filter(([key]) => !["payload", "meta"].includes(key)).map(([key, value]) => <label key={key}><span>{humanizeTableName(key)}</span><strong>{plain(value)}</strong></label>)}</div>
      <footer><button type="button" onClick={() => setSelected(null)}>Fechar</button></footer>
    </aside></div>}
  </div>;
}
