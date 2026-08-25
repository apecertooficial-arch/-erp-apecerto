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

const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "ativas", rotulo: "Ativas" },
  { id: "publicadas", rotulo: "Publicadas" },
  { id: "rascunhos", rotulo: "Rascunhos" },
  { id: "arquivadas", rotulo: "Arquivadas" },
];

function mapaInicial(nome: string) {
  const id = "b1";
  return {
    editor: {
      uid: 2,
      notes: {},
      wires: [],
      blocks: {
        [id]: { id, fam: "gatilho", sub: "json-http-request-trigger", x: 120, y: 200, note: "", extra: {}, parts: [], ramos: [], noteOpen: false },
      },
    },
    automation: {
      name: nome,
      provider: "apecerto-erp",
      anotacoes: [],
      blocks: [{ id, type: "trigger", options: { triggers: [{ name: "json-http-request-trigger", group: "system", options: {} }], nextBlockId: "" }, presentation: { x: 120, y: 200 } }],
    },
  };
}

function dataCurta(valor?: string | null) {
  if (!valor) return "Sem edição recente";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Sem edição recente";
  return `Editada ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data)}`;
}

function passaFiltro(a: Automacao, filtro: Filtro) {
  if (filtro === "arquivadas") return a.arquivada === true;
  if (a.arquivada) return false;
  if (filtro === "ativas") return a.ativa === true;
  if (filtro === "publicadas") return (a.status || "publicado") === "publicado";
  if (filtro === "rascunhos") return (a.status || "publicado") === "rascunho";
  return true;
}

export function AutomationsHome({
  accessToken,
  supabaseUrl,
  publishableKey,
  onOpen,
}: {
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  onOpen: (id: number) => void;
}) {
  const [aba, setAba] = useState<"automacoes" | "operacao">("automacoes");
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const headers = useMemo(() => ({
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }), [accessToken, publishableKey]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes?select=id,nome,grupo,ativa,status,arquivada,atualizada_em&order=grupo.asc.nullslast,id.asc`, {
        headers,
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error(`Não foi possível carregar as automações (${resposta.status}).`);
      setAutomacoes(await resposta.json() as Automacao[]);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as automações.");
    } finally {
      setCarregando(false);
    }
  }, [headers, supabaseUrl]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void carregar(); });
    return () => window.cancelAnimationFrame(frame);
  }, [carregar]);

  useEffect(() => {
    if (!criando) return;
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !salvando) setCriando(false);
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [criando, salvando]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return automacoes.filter((a) => passaFiltro(a, filtro) && (!q || a.nome.toLocaleLowerCase("pt-BR").includes(q) || (a.grupo || "").toLocaleLowerCase("pt-BR").includes(q)));
  }, [automacoes, busca, filtro]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Automacao[]>();
    visiveis.forEach((a) => {
      const chave = a.grupo?.trim() || "Sem grupo";
      mapa.set(chave, [...(mapa.get(chave) || []), a]);
    });
    return [...mapa.entries()];
  }, [visiveis]);

  const totais = useMemo(() => ({
    disponiveis: automacoes.filter((a) => !a.arquivada).length,
    ativas: automacoes.filter((a) => !a.arquivada && a.ativa).length,
    rascunhos: automacoes.filter((a) => !a.arquivada && (a.status || "publicado") === "rascunho").length,
    arquivadas: automacoes.filter((a) => a.arquivada).length,
  }), [automacoes]);

  const criar = useCallback(async () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    setSalvando(true);
    setErro(null);
    const mapa = mapaInicial(nomeLimpo);
    try {
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ nome: nomeLimpo, grupo: grupo.trim() || null, ativa: false, status: "rascunho", mapa, mapa_rascunho: mapa }),
      });
      if (!resposta.ok) throw new Error(`Não foi possível criar a automação (${resposta.status}).`);
      const criada = (await resposta.json() as Automacao[])[0];
      setCriando(false);
      setNome("");
      setGrupo("");
      onOpen(criada.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a automação.");
    } finally {
      setSalvando(false);
    }
  }, [grupo, headers, nome, onOpen, supabaseUrl]);

  const duplicar = useCallback(async (automacao: Automacao) => {
    try {
      const origem = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${automacao.id}&select=nome,grupo,mapa,mapa_rascunho`, { headers });
      if (!origem.ok) throw new Error("Não foi possível ler a automação original.");
      const row = (await origem.json() as Array<{ nome: string; grupo: string | null; mapa: unknown; mapa_rascunho: unknown }>)[0];
      const draft = row.mapa_rascunho || row.mapa;
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ nome: `${row.nome} (cópia)`, grupo: row.grupo, ativa: false, status: "rascunho", mapa: draft, mapa_rascunho: draft }),
      });
      if (!resposta.ok) throw new Error("Não foi possível duplicar a automação.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível duplicar a automação.");
    }
  }, [carregar, headers, supabaseUrl]);

  const alternarArquivo = useCallback(async (automacao: Automacao) => {
    try {
      const resposta = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${automacao.id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ arquivada: !automacao.arquivada }),
      });
      if (!resposta.ok) throw new Error("Não foi possível atualizar o arquivo.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o arquivo.");
    }
  }, [carregar, headers, supabaseUrl]);

  return (
    <section className="automation-home" aria-label="Central de Automações">
      <header className="automation-home-header">
        <div>
          <span className="automation-eyebrow">CENTRAL DE AUTOMAÇÕES</span>
          <h1>Automações organizadas, claras e seguras</h1>
          <p>Crie, encontre e acompanhe fluxos sem misturar gestão, construção e operação.</p>
        </div>
        <button type="button" className="automation-primary" onClick={() => setCriando(true)}>+ Nova automação</button>
      </header>

      <nav className="automation-section-tabs" aria-label="Seções da Central">
        <button type="button" className={aba === "automacoes" ? "active" : ""} onClick={() => setAba("automacoes")}>Minhas automações</button>
        <button type="button" className={aba === "operacao" ? "active" : ""} onClick={() => setAba("operacao")}>Execuções e saúde</button>
        <a href="/abordagens">Biblioteca de abordagens</a>
      </nav>

      {aba === "operacao" ? (
        <div className="automation-operations-page">
          <header><span className="automation-eyebrow">OPERAÇÃO</span><h2>Execuções, exceções e saúde</h2><p>Monitoramento separado do espaço de construção.</p></header>
          <CentralOperationsPanel accessToken={accessToken} />
        </div>
      ) : (
        <>
          <div className="automation-kpis" aria-label="Resumo das automações">
            <article><span>Disponíveis</span><strong>{totais.disponiveis}</strong><small>fora do arquivo</small></article>
            <article><span>Rodando</span><strong>{totais.ativas}</strong><small>publicadas e ativas</small></article>
            <article><span>Rascunhos</span><strong>{totais.rascunhos}</strong><small>aguardando publicação</small></article>
            <article><span>Arquivadas</span><strong>{totais.arquivadas}</strong><small>preservadas, fora da rotina</small></article>
          </div>

          <div className="automation-home-tools">
            <label className="automation-search"><span aria-hidden="true">⌕</span><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou grupo" /></label>
            <div className="automation-filters" aria-label="Filtrar automações">
              {FILTROS.map((item) => <button type="button" key={item.id} className={filtro === item.id ? "active" : ""} onClick={() => setFiltro(item.id)}>{item.rotulo}</button>)}
            </div>
          </div>

          {erro ? <div className="automation-feedback error" role="alert">{erro}<button type="button" onClick={() => void carregar()}>Tentar novamente</button></div> : null}

          {carregando ? (
            <div className="automation-loading" aria-live="polite"><span /><span /><span /> Carregando automações…</div>
          ) : grupos.length === 0 ? (
            <div className="automation-empty"><span aria-hidden="true">◇</span><h2>Nenhuma automação encontrada</h2><p>Ajuste os filtros ou crie um novo fluxo.</p><button type="button" className="automation-primary" onClick={() => setCriando(true)}>Criar automação</button></div>
          ) : (
            <div className="automation-groups">
              {grupos.map(([nomeGrupo, itens]) => (
                <section key={nomeGrupo} className="automation-group">
                  <header><div><span className="automation-group-icon" aria-hidden="true">⌁</span><h2>{nomeGrupo}</h2></div><span>{itens.length} {itens.length === 1 ? "automação" : "automações"}</span></header>
                  <div className="automation-card-grid">
                    {itens.map((a) => {
                      const publicada = (a.status || "publicado") === "publicado";
                      return <article key={a.id} className="automation-card">
                        <button type="button" className="automation-card-main" onClick={() => onOpen(a.id)}>
                          <span className={`automation-card-mark ${a.ativa ? "running" : publicada ? "published" : "draft"}`} aria-hidden="true">⌁</span>
                          <span className="automation-card-copy"><strong>{a.nome}</strong><small>{dataCurta(a.atualizada_em)}</small></span>
                          <span className="automation-card-statuses">
                            <span className={publicada ? "published" : "draft"}>{publicada ? "Publicada" : "Rascunho"}</span>
                            <span className={a.ativa ? "running" : "inactive"}>{a.ativa ? "Ativa" : "Inativa"}</span>
                          </span>
                        </button>
                        <footer>
                          <button type="button" onClick={() => onOpen(a.id)}>Abrir construtor</button>
                          <button type="button" onClick={() => void duplicar(a)}>Duplicar</button>
                          <button type="button" onClick={() => void alternarArquivo(a)}>{a.arquivada ? "Desarquivar" : "Arquivar"}</button>
                        </footer>
                      </article>;
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <ExplicadorAutomacoes accessToken={accessToken} />

      {criando ? (
        <div className="automation-dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) setCriando(false); }}>
          <form className="automation-dialog" role="dialog" aria-modal="true" aria-labelledby="nova-automacao-titulo" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
            <header><div><span className="automation-eyebrow">NOVO FLUXO</span><h2 id="nova-automacao-titulo">Criar automação</h2></div><button type="button" aria-label="Fechar" onClick={() => setCriando(false)} disabled={salvando}>×</button></header>
            <p>A automação começa em rascunho, inativa e com um único bloco de início.</p>
            <label>Nome<input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Entrada novo produto" /></label>
            <label>Grupo ou produto <span>(opcional)</span><input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: Campanhas de entrada" /></label>
            <footer><button type="button" className="automation-secondary" onClick={() => setCriando(false)} disabled={salvando}>Cancelar</button><button type="submit" className="automation-primary" disabled={salvando || !nome.trim()}>{salvando ? "Criando…" : "Criar e abrir"}</button></footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
