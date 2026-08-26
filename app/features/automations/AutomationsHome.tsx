"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CentralOperationsPanel } from "./CentralOperationsPanel";
import { ExplicadorAutomacoes } from "./ExplicadorAutomacoes";

type Automacao = {
  id: number;
  nome: string;
  grupo: string | null;
  ativa: boolean;
  status: string | null;
  arquivada?: boolean;
  atualizada_em?: string | null;
};

type Filtro = "todas" | "ativas" | "publicadas" | "rascunhos" | "arquivadas";
type Secao = "visao" | "automacoes" | "gatilhos" | "execucoes" | "excecoes";

const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "ativas", rotulo: "Ativas" },
  { id: "publicadas", rotulo: "Publicadas" },
  { id: "rascunhos", rotulo: "Rascunhos" },
  { id: "arquivadas", rotulo: "Arquivadas" },
];

const SECOES: Array<{ id: Secao; rotulo: string; descricao: string }> = [
  { id: "visao", rotulo: "Visão geral", descricao: "Estado atual da Central" },
  { id: "automacoes", rotulo: "Minhas automações", descricao: "Fluxos e grupos" },
  { id: "gatilhos", rotulo: "Gatilhos", descricao: "Entradas disponíveis" },
  { id: "execucoes", rotulo: "Execuções", descricao: "Atividade nas últimas 24h" },
  { id: "excecoes", rotulo: "Exceções", descricao: "Falhas e decisões pendentes" },
];

const GATILHOS = [
  { grupo: "Entrada e integração", nome: "Webhook HTTP", descricao: "Recebe um POST JSON pela URL da automação." },
  { grupo: "Entrada e integração", nome: "Lead criado no site", descricao: "Inicia quando o cadastro entra pelo site." },
  { grupo: "Entrada e integração", nome: "Iniciada por outra automação", descricao: "Continua a partir de um fluxo publicado." },
  { grupo: "Entrada e integração", nome: "Manual", descricao: "Execução intencional iniciada por uma pessoa." },
  { grupo: "CRM e funil", nome: "Tag adicionada", descricao: "Reage à aplicação explícita de uma tag." },
  { grupo: "CRM e funil", nome: "Entrou na etapa", descricao: "Inicia ao entrar em uma etapa configurada." },
  { grupo: "CRM e funil", nome: "Mudou de etapa", descricao: "Inicia após uma movimentação de etapa." },
  { grupo: "CRM e funil", nome: "Lead distribuído", descricao: "Inicia depois de uma distribuição concluída." },
  { grupo: "Conversas", nome: "Chegou mensagem do lead", descricao: "Reage a uma mensagem recebida do lead." },
  { grupo: "Conversas", nome: "Corretor enviou mensagem", descricao: "Reage ao envio explícito do corretor." },
  { grupo: "Tempo e recuperação", nome: "Venceu o prazo do momento", descricao: "Inicia quando o prazo operacional vence." },
  { grupo: "Tempo e recuperação", nome: "Chegou a data de retomar", descricao: "Retoma o lead na data configurada." },
  { grupo: "Tempo e recuperação", nome: "Entrou no momento", descricao: "Inicia ao entrar em um momento do atendimento." },
  { grupo: "Tempo e recuperação", nome: "Relógio de recuperação da Sara", descricao: "Procura apenas itens devidos pelas regras publicadas." },
];

function Icon({ name }: { name: "plus" | "search" | "folder" | "flow" | "library" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />,
    flow: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a3 3 0 0 1 3 3v6M12 15h3" /></>,
    library: <><path d="M5 4h5v16H5zM14 4h5v16h-5z" /><path d="M7.5 8h0M16.5 8h0" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function mapaInicial(nome: string) {
  const id = "b1";
  return {
    editor: { uid: 2, notes: {}, wires: [], blocks: { [id]: { id, fam: "gatilho", sub: "json-http-request-trigger", x: 120, y: 200, note: "", extra: {}, parts: [], ramos: [], noteOpen: false } } },
    automation: { name: nome, provider: "apecerto-erp", anotacoes: [], blocks: [{ id, type: "trigger", options: { triggers: [{ name: "json-http-request-trigger", group: "system", options: {} }], nextBlockId: "" }, presentation: { x: 120, y: 200 } }] },
  };
}

function dataCurta(valor?: string | null) {
  if (!valor) return "Sem edição recente";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Sem edição recente";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

function passaFiltro(a: Automacao, filtro: Filtro) {
  if (filtro === "arquivadas") return a.arquivada === true;
  if (a.arquivada) return false;
  if (filtro === "ativas") return a.ativa === true;
  if (filtro === "publicadas") return (a.status || "publicado") === "publicado";
  if (filtro === "rascunhos") return (a.status || "publicado") === "rascunho";
  return true;
}

function nomeProvisorio(a: Automacao) {
  return a.ativa && /(?:\bteste\b|\bc[oó]pia\b|renomeie)/iu.test(`${a.nome} ${a.grupo || ""}`);
}

export function AutomationsHome({ accessToken, supabaseUrl, publishableKey, onOpen }: { accessToken: string; supabaseUrl: string; publishableKey: string; onOpen: (id: number) => void }) {
  const [secao, setSecao] = useState<Secao>("automacoes");
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const headers = useMemo(() => ({ apikey: publishableKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }), [accessToken, publishableKey]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes?select=id,nome,grupo,ativa,status,arquivada,atualizada_em&order=grupo.asc.nullslast,id.asc`, { headers, cache: "no-store" });
      if (!resposta.ok) throw new Error(`Não foi possível carregar as automações (${resposta.status}).`);
      setAutomacoes(await resposta.json() as Automacao[]);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as automações.");
    } finally { setCarregando(false); }
  }, [headers, supabaseUrl]);

  useEffect(() => { const frame = window.requestAnimationFrame(() => { void carregar(); }); return () => window.cancelAnimationFrame(frame); }, [carregar]);
  useEffect(() => {
    if (!criando) return;
    const fecharComEscape = (evento: KeyboardEvent) => { if (evento.key === "Escape" && !salvando) setCriando(false); };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [criando, salvando]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return automacoes.filter((a) => passaFiltro(a, filtro) && (!q || a.nome.toLocaleLowerCase("pt-BR").includes(q) || (a.grupo || "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [automacoes, busca, filtro]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Automacao[]>();
    visiveis.forEach((a) => { const chave = a.grupo?.trim() || "Sem grupo"; mapa.set(chave, [...(mapa.get(chave) || []), a]); });
    return [...mapa.entries()];
  }, [visiveis]);

  const totais = useMemo(() => ({
    disponiveis: automacoes.filter((a) => !a.arquivada).length,
    ativas: automacoes.filter((a) => !a.arquivada && a.ativa).length,
    rascunhos: automacoes.filter((a) => !a.arquivada && (a.status || "publicado") === "rascunho").length,
    arquivadas: automacoes.filter((a) => a.arquivada).length,
  }), [automacoes]);

  const criar = useCallback(async () => {
    const nomeLimpo = nome.trim(); if (!nomeLimpo) return;
    setSalvando(true); setErro(null);
    const mapa = mapaInicial(nomeLimpo);
    try {
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ nome: nomeLimpo, grupo: grupo.trim() || null, ativa: false, status: "rascunho", mapa, mapa_rascunho: mapa }) });
      if (!resposta.ok) throw new Error(`Não foi possível criar a automação (${resposta.status}).`);
      const criada = (await resposta.json() as Automacao[])[0]; setCriando(false); setNome(""); setGrupo(""); onOpen(criada.id);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível criar a automação."); }
    finally { setSalvando(false); }
  }, [grupo, headers, nome, onOpen, supabaseUrl]);

  const duplicar = useCallback(async (automacao: Automacao) => {
    try {
      const origem = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${automacao.id}&select=nome,grupo,mapa,mapa_rascunho`, { headers });
      if (!origem.ok) throw new Error("Não foi possível ler a automação original.");
      const row = (await origem.json() as Array<{ nome: string; grupo: string | null; mapa: unknown; mapa_rascunho: unknown }>)[0];
      const draft = row.mapa_rascunho || row.mapa;
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ nome: `${row.nome} (cópia)`, grupo: row.grupo, ativa: false, status: "rascunho", mapa: draft, mapa_rascunho: draft }) });
      if (!resposta.ok) throw new Error("Não foi possível duplicar a automação.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível duplicar a automação."); }
  }, [carregar, headers, supabaseUrl]);

  const alternarArquivo = useCallback(async (automacao: Automacao) => {
    try {
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${automacao.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ arquivada: !automacao.arquivada }) });
      if (!resposta.ok) throw new Error("Não foi possível atualizar o arquivo.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível atualizar o arquivo."); }
  }, [carregar, headers, supabaseUrl]);

  const lista = () => {
    if (erro) return <div className="automation-feedback error" role="alert">{erro}<button type="button" onClick={() => void carregar()}>Tentar novamente</button></div>;
    if (carregando) return <div className="automation-loading" aria-live="polite"><span /><span /><span /> Carregando automações…</div>;
    if (!grupos.length) return <div className="automation-empty"><Icon name="flow" /><h2>Nenhuma automação encontrada</h2><p>Ajuste os filtros ou crie um novo fluxo.</p><button type="button" className="automation-primary" onClick={() => setCriando(true)}>Criar automação</button></div>;
    return <div className="automation-groups">
      {grupos.map(([nomeGrupo, itens]) => <section key={nomeGrupo} className="automation-group">
        <header><div><span className="automation-group-icon"><Icon name="folder" /></span><h2>{nomeGrupo}</h2></div><span>{itens.length} {itens.length === 1 ? "automação" : "automações"}</span></header>
        <div className="automation-table" role="table" aria-label={`Automações de ${nomeGrupo}`}>
          <div className="automation-table-head" role="row"><span>Automação</span><span>Publicação</span><span>Operação</span><span>Modificada</span><span aria-label="Ações" /></div>
          {itens.map((a) => {
            const publicada = (a.status || "publicado") === "publicado";
            return <article key={a.id} className="automation-row" role="row">
              <button type="button" className="automation-row-main" onClick={() => onOpen(a.id)} role="cell"><span className={`automation-card-mark ${a.ativa ? "running" : publicada ? "published" : "draft"}`}><Icon name="flow" /></span><span><strong>{a.nome}</strong><small>ID {a.id} · {nomeGrupo}</small></span></button>
              <span role="cell" className={`state-chip ${publicada ? "published" : "draft"}`}>{publicada ? "Publicada" : "Rascunho"}</span>
              <span role="cell" className={`state-chip ${a.ativa ? "active" : "inactive"}`}>{a.ativa ? "Ativa" : "Inativa"}</span>
              <span role="cell" className="automation-row-date">{dataCurta(a.atualizada_em)}{nomeProvisorio(a) ? <small>Revisar nome</small> : null}</span>
              <span role="cell" className="automation-row-actions"><button type="button" className="open" onClick={() => onOpen(a.id)}>Abrir</button><button type="button" onClick={() => void duplicar(a)}>Duplicar</button><button type="button" onClick={() => void alternarArquivo(a)}>{a.arquivada ? "Desarquivar" : "Arquivar"}</button></span>
            </article>;
          })}
        </div>
      </section>)}
    </div>;
  };

  return <section className="automation-home" aria-label="Central de Automações">
    <header className="automation-home-header"><div><span className="automation-eyebrow">CENTRAL DE AUTOMAÇÕES</span><h1>Fluxos claros, operação previsível</h1><p>Construa, publique e acompanhe cada automação sem misturar o desenho com a operação.</p></div><div className="automation-header-actions"><a href="/abordagens" className="automation-library"><Icon name="library" /> Biblioteca de abordagens</a><button type="button" className="automation-primary" onClick={() => setCriando(true)}><Icon name="plus" /> Nova automação</button></div></header>
    <nav className="automation-section-tabs" aria-label="Seções da Central">{SECOES.map((item) => <button type="button" key={item.id} className={secao === item.id ? "active" : ""} onClick={() => setSecao(item.id)} aria-current={secao === item.id ? "page" : undefined}><strong>{item.rotulo}</strong><small>{item.descricao}</small></button>)}</nav>

    {secao === "visao" ? <div className="automation-view"><header className="automation-view-header"><div><span className="automation-eyebrow">VISÃO GERAL</span><h2>Estado da Central agora</h2></div><p>Números reais da lista e contratos consultados no ambiente atual.</p></header><div className="automation-kpis"><article><span>Disponíveis</span><strong>{totais.disponiveis}</strong><small>fora do arquivo</small></article><article><span>Rodando</span><strong>{totais.ativas}</strong><small>publicadas e ativas</small></article><article><span>Rascunhos</span><strong>{totais.rascunhos}</strong><small>aguardando publicação</small></article><article><span>Arquivadas</span><strong>{totais.arquivadas}</strong><small>preservadas</small></article></div><CentralOperationsPanel accessToken={accessToken} view="overview" /></div> : null}
    {secao === "automacoes" ? <div className="automation-view"><header className="automation-view-header"><div><span className="automation-eyebrow">MINHAS AUTOMAÇÕES</span><h2>Encontre e abra o fluxo certo</h2></div><p>{totais.disponiveis} automações disponíveis, organizadas por grupo.</p></header><div className="automation-home-tools"><label className="automation-search"><Icon name="search" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, grupo ou produto" aria-label="Buscar automações" /></label><div className="automation-filters" aria-label="Filtrar automações">{FILTROS.map((item) => <button type="button" key={item.id} className={filtro === item.id ? "active" : ""} onClick={() => setFiltro(item.id)}>{item.rotulo}</button>)}</div></div>{lista()}</div> : null}
    {secao === "gatilhos" ? <div className="automation-view"><header className="automation-view-header"><div><span className="automation-eyebrow">GATILHOS</span><h2>O que pode iniciar um fluxo</h2></div><p>Catálogo real do editor. O gatilho apenas inicia; não altera o lead por conta própria.</p></header><div className="automation-trigger-groups">{[...new Set(GATILHOS.map((item) => item.grupo))].map((grupoGatilho) => <section key={grupoGatilho}><header><h3>{grupoGatilho}</h3><span>{GATILHOS.filter((item) => item.grupo === grupoGatilho).length}</span></header>{GATILHOS.filter((item) => item.grupo === grupoGatilho).map((item) => <article key={item.nome}><span className="automation-trigger-icon"><Icon name="flow" /></span><div><strong>{item.nome}</strong><p>{item.descricao}</p></div><span className="state-chip published">Disponível</span></article>)}</section>)}</div></div> : null}
    {secao === "execucoes" ? <div className="automation-view"><header className="automation-view-header"><div><span className="automation-eyebrow">EXECUÇÕES</span><h2>Atividade operacional</h2></div><p>Contagens reais das últimas 24 horas, separadas do canvas.</p></header><CentralOperationsPanel accessToken={accessToken} view="executions" /></div> : null}
    {secao === "excecoes" ? <div className="automation-view"><header className="automation-view-header"><div><span className="automation-eyebrow">EXCEÇÕES</span><h2>Falhas que exigem decisão</h2></div><p>Nenhuma falha continua por suposição: quarentena e revisão humana ficam explícitas.</p></header><CentralOperationsPanel accessToken={accessToken} view="exceptions" /></div> : null}

    <ExplicadorAutomacoes accessToken={accessToken} />
    {criando ? <div className="automation-dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) setCriando(false); }}><form className="automation-dialog" role="dialog" aria-modal="true" aria-labelledby="nova-automacao-titulo" onSubmit={(e) => { e.preventDefault(); void criar(); }}><header><div><span className="automation-eyebrow">NOVO FLUXO</span><h2 id="nova-automacao-titulo">Criar automação</h2></div><button type="button" aria-label="Fechar" onClick={() => setCriando(false)} disabled={salvando}>×</button></header><p>A automação começa em rascunho, inativa e com um único bloco de início.</p><label>Nome<input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Entrada novo produto" /></label><label>Grupo ou produto <span>(opcional)</span><input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: Campanhas de entrada" /></label><footer><button type="button" className="automation-secondary" onClick={() => setCriando(false)} disabled={salvando}>Cancelar</button><button type="submit" className="automation-primary" disabled={salvando || !nome.trim()}>{salvando ? "Criando…" : "Criar e abrir"}</button></footer></form></div> : null}
  </section>;
}
