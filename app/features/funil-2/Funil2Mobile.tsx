"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoWhatsApp } from "../crm-nova-era/components/BotaoWhatsApp";
import { AvisoNotificacoes } from "../home/AvisoNotificacoes";
import {
  acaoVisivel,
  prazoDaAcao,
  situacaoPrazo,
  venceHoje,
  type EventoFunil2,
  type LeadFunil2,
  type MomentoFunil2,
} from "./modelo";

type PayloadMobile = {
  leads?: LeadFunil2[];
  momentos?: MomentoFunil2[];
  eventos?: EventoFunil2[];
  error?: string;
};

type FiltroDia = "agora" | "hoje" | "todos";

const ETAPAS = [
  ["todos", "Todos"],
  ["novo", "Novos"],
  ["tentando_contato", "Tentando contato"],
  ["em_atendimento", "Em atendimento"],
  ["pos_visita", "Pós-visita"],
] as const;

function nomeEtapa(codigo: string) {
  return ETAPAS.find(([chave]) => chave === codigo)?.[1] ?? codigo.replaceAll("_", " ");
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

function lerLeadDaUrl() {
  if (typeof window === "undefined") return null;
  const valor = Number(new URLSearchParams(window.location.search).get("lead"));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function limparLeadDaUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("lead");
  window.history.replaceState(null, "", url.toString());
}

function useFunil2Mobile(accessToken: string) {
  const [dados, setDados] = useState<PayloadMobile | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const recarregar = useCallback(() => setVersao((atual) => atual + 1), []);

  useEffect(() => {
    const controle = new AbortController();
    let vivo = true;
    void fetch("/api/funil2", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controle.signal,
    }).then(async (resposta) => {
      const json = await resposta.json().catch(() => ({})) as PayloadMobile;
      if (!resposta.ok) throw new Error(json.error || "Não foi possível abrir o CRM.");
      if (vivo) { setDados(json); setErro(null); }
    }).catch((falha: unknown) => {
      if (vivo && !(falha instanceof DOMException && falha.name === "AbortError")) {
        setErro(falha instanceof Error ? falha.message : "Não foi possível abrir o CRM.");
      }
    });
    return () => { vivo = false; controle.abort(); };
  }, [accessToken, versao]);

  useEffect(() => {
    const relogio = window.setInterval(recarregar, 45_000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);

  return { dados, erro, recarregar };
}

function CartaoLeadMobile({
  lead,
  momento,
  onAbrir,
}: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  onAbrir: () => void;
}) {
  const prazo = prazoDaAcao(lead);
  return <article className="f2m-card">
    <header>
      <span className="f2m-avatar" aria-hidden="true">{iniciais(lead.nome)}</span>
      <div><h3>{lead.nome}</h3><p>{lead.corretor_nome ?? "Aguardando responsável"}</p></div>
      <span className={`f2m-tempo ${prazo.classe}`}>{situacaoPrazo(lead.proxima_acao_em).rotulo}</span>
    </header>

    <div className="f2m-chips">
      <span className={`etapa etapa-${lead.etapa}`}>{nomeEtapa(lead.etapa)}</span>
      <span className="momento">{momento?.rotulo ?? lead.momento_codigo}</span>
    </div>

    <div className="f2m-direcao">
      <span>SARA · FAÇA AGORA</span>
      <strong>{acaoVisivel(lead)}</strong>
      <small>{momento?.descricao ?? "Execute a ação e mantenha este atendimento atualizado."}</small>
    </div>

    <div className="f2m-acoes">
      <div className="f2m-whatsapp">
        <BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} compacto />
      </div>
      <button type="button" className="f2m-abrir" onClick={onAbrir} aria-label={`Abrir ficha de ${lead.nome}`}>•••</button>
    </div>
  </article>;
}

function DetalheMobile({
  lead,
  momento,
  eventos,
  onFechar,
}: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  eventos: EventoFunil2[];
  onFechar: () => void;
}) {
  const prazo = prazoDaAcao(lead);
  return <div className="f2m-overlay" role="dialog" aria-modal="true" aria-label={`Atendimento de ${lead.nome}`}>
    <section className="f2m-detalhe">
      <header>
        <button type="button" onClick={onFechar} aria-label="Voltar">‹</button>
        <div><small>ATENDIMENTO</small><h2>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem responsável"}</p></div>
      </header>

      <div className="f2m-ordem">
        <span>O QUE FAZER AGORA</span>
        <div className="f2m-ordem-contexto"><b>{nomeEtapa(lead.etapa)}</b><b>{momento?.rotulo ?? lead.momento_codigo}</b></div>
        <h3>{acaoVisivel(lead)}</h3>
        <p>{momento?.descricao ?? "Execute a ação e atualize o atendimento."}</p>
        <em className={prazo.classe}>{prazo.rotulo}</em>
      </div>

      <div className="f2m-whatsapp f2m-whatsapp-grande">
        <BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} />
      </div>

      <section className="f2m-historico">
        <h3>Últimas atualizações</h3>
        {eventos.length === 0 ? <p>Ainda não há atualização registrada neste atendimento.</p> : eventos.slice(0, 8).map((evento) => <article key={evento.id}>
          <i />
          <div><strong>{evento.titulo}</strong>{evento.detalhe && <span>{evento.detalhe}</span>}<small>{new Date(evento.criado_em).toLocaleString("pt-BR")}</small></div>
        </article>)}
      </section>
    </section>
  </div>;
}

export function Funil2Mobile({
  accessToken,
  nome,
  modo,
  onIr,
}: {
  accessToken: string;
  nome: string;
  modo: "inicio" | "crm";
  onIr: (destino: string) => void;
}) {
  const { dados, erro, recarregar } = useFunil2Mobile(accessToken);
  const [filtroDia, setFiltroDia] = useState<FiltroDia>("agora");
  const [etapa, setEtapa] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [pedidoUrl] = useState(lerLeadDaUrl);
  const [agora] = useState(() => Date.now());

  const leads = useMemo(() => [...(dados?.leads ?? [])].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em)), [dados]);
  const momentos = dados?.momentos ?? [];
  const eventos = dados?.eventos ?? [];

  const fimHoje = useMemo(() => { const data = new Date(agora); data.setHours(23, 59, 59, 999); return +data; }, [agora]);
  const contagens = useMemo(() => ({
    agora: leads.filter((lead) => +new Date(lead.proxima_acao_em) <= agora).length,
    hoje: leads.filter((lead) => venceHoje(lead, agora)).length,
    novos: leads.filter((lead) => lead.etapa === "novo").length,
  }), [agora, leads]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return leads.filter((lead) => {
      const prazo = +new Date(lead.proxima_acao_em);
      const cabeNoDia = filtroDia === "todos" || (filtroDia === "agora" ? prazo <= agora : prazo <= fimHoje);
      const cabeNaEtapa = etapa === "todos" || lead.etapa === etapa;
      const cabeNaBusca = !termo || `${lead.nome} ${lead.telefone ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo);
      return cabeNoDia && cabeNaEtapa && cabeNaBusca;
    });
  }, [agora, busca, etapa, filtroDia, fimHoje, leads]);

  const leadPedido = pedidoUrl === null ? null : leads.find((lead) => lead.origem_negocio_id === pedidoUrl) ?? null;
  const leadAberto = selecionado === "__fechado__"
    ? null
    : leads.find((lead) => lead.id === selecionado) ?? leadPedido;
  const primeiroNome = nome.trim().split(/\s+/)[0] || "corretor";

  return <main className={`f2m-root modo-${modo}`} aria-label={modo === "inicio" ? "Meu Dia" : "CRM mobile"}>
    <header className="f2m-topo">
      <div>
        {modo === "inicio" ? <><small>Olá, {primeiroNome}</small><h1>{contagens.agora} {contagens.agora === 1 ? "pessoa espera" : "pessoas esperam"}<br />você agora</h1></> : <><small>CARTEIRA FUNIL 2.0</small><h1>Seus clientes</h1></>}
        <button type="button" onClick={recarregar}>↻ Atualizar</button>
      </div>
      <button type="button" className="f2m-sino" onClick={() => onIr("/notificacoes")} aria-label="Abrir avisos">🔔<b>{contagens.agora}</b></button>
    </header>

    {/* A inscricao de push VIVE dentro deste componente (pushManager.subscribe).
        Enquanto o Funil 2.0 nao o montava, ninguem conseguia se inscrever -- nem
        o iPhone chegava a pedir permissao, e por isso o app nem aparecia nos
        Ajustes do iOS. Aviso nenhum chegava porque nao havia a quem entregar. */}
    <AvisoNotificacoes accessToken={accessToken} />

    {modo === "inicio" && <section className="f2m-kpis" aria-label="Resumo do dia">
      <article><b>{contagens.agora}</b><span>agora</span></article>
      <article><b>{contagens.novos}</b><span>leads novos</span></article>
      <article><b>{contagens.hoje}</b><span>para hoje</span></article>
    </section>}

    {modo === "crm" && <label className="f2m-busca">
      <span aria-hidden="true">⌕</span>
      <input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar cliente ou telefone" />
    </label>}

    <nav className="f2m-filtros" aria-label="Filtrar atendimentos">
      {modo === "inicio" ? (["agora", "hoje", "todos"] as const).map((chave) => <button key={chave} type="button" className={filtroDia === chave ? "ativo" : ""} onClick={() => setFiltroDia(chave)}>{chave === "agora" ? `Agora · ${contagens.agora}` : chave === "hoje" ? `Hoje · ${contagens.hoje}` : `Todos · ${leads.length}`}</button>) : ETAPAS.map(([chave, rotulo]) => <button key={chave} type="button" className={etapa === chave ? "ativo" : ""} onClick={() => setEtapa(chave)}>{rotulo}</button>)}
    </nav>

    {erro && <div className="f2m-erro"><strong>{erro}</strong><button type="button" onClick={recarregar}>Tentar novamente</button></div>}
    {!dados && !erro && <div className="f2m-loading">Organizando seu dia…</div>}
    {dados && !erro && visiveis.length === 0 && <div className="f2m-vazio"><strong>Nada pendente aqui.</strong><span>Troque o filtro para consultar o restante da carteira.</span></div>}

    <section className="f2m-lista" aria-label="Atendimentos">
      {visiveis.slice(0, modo === "inicio" ? 30 : 60).map((lead) => <CartaoLeadMobile key={lead.id} lead={lead} momento={momentos.find((momento) => momento.codigo === lead.momento_codigo) ?? null} onAbrir={() => setSelecionado(lead.id)} />)}
    </section>

    {leadAberto && <DetalheMobile lead={leadAberto} momento={momentos.find((momento) => momento.codigo === leadAberto.momento_codigo) ?? null} eventos={eventos.filter((evento) => evento.funil_lead_id === leadAberto.id).sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))} onFechar={() => { setSelecionado("__fechado__"); limparLeadDaUrl(); }} />}
  </main>;
}
