"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoWhatsApp } from "../crm-nova-era/components/BotaoWhatsApp";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  acaoVisivel,
  esperandoPrimeiraChamada,
  prazoDaAcao,
  situacaoPrazo,
  venceHoje,
  type EventoFunil2,
  type LeadFunil2,
  type MomentoFunil2,
  type NotaFunil2,
} from "./modelo";

type PayloadMobile = {
  leads?: LeadFunil2[];
  momentos?: MomentoFunil2[];
  eventos?: EventoFunil2[];
  notas?: NotaFunil2[];
  error?: string;
};

type FiltroDia = "agora" | "novos" | "hoje" | "todos";

/* Lista fechada, igual a da tabela motivos_descarte. Motivo escrito a mao nao
   vira relatorio: ninguem consegue contar quantos "sem grana" existem. */
const MOTIVOS_DESCARTE = [
  "Contato inválido",
  "Sem interesse",
  "Sem capacidade financeira",
  "Fora da região",
  "Já comprou",
  "Duplicado",
  "Pediu para não receber contato",
  "Produto incompatível",
] as const;

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
      <div><h3>{lead.nome}</h3><p>{lead.corretor_nome ?? "Aguardando responsável"}{lead.instancia_rotulo ? <em className="f2m-instancia" title={`Contato saindo por ${lead.instancia_rotulo}`}> · {lead.instancia_rotulo}</em> : null}</p></div>
      <span className={`f2m-tempo ${prazo.classe}`}>{situacaoPrazo(lead.proxima_acao_em).rotulo}</span>
    </header>

    <div className="f2m-chips">
      <span className={`etapa etapa-${lead.etapa}`}>{nomeEtapa(lead.etapa)}</span>
      <span className="momento">{momento?.rotulo ?? lead.momento_codigo}</span>
    </div>

    {/* A ACAO OFICIAL saiu da tela. Ela era o texto fixo do momento, nao uma
        leitura da conversa -- e enquanto a Sara nao analisa de verdade, mostrar
        isso faz o corretor obedecer uma ordem que ninguem pensou. Ficam a etapa
        e o momento, que sao fato. Volta quando a analise real entrar. */}

    <div className="f2m-acoes">
      <div className="f2m-whatsapp">
        <BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} compacto />
      </div>
      <button type="button" className="f2m-abrir" onClick={onAbrir} aria-label={`Abrir ficha de ${lead.nome}`}>•••</button>
    </div>
  </article>;
}

/* AGENDAR VISITA PELO CELULAR.
   O corretor precisa marcar visita de onde estiver -- na rua, no imovel, no
   carro. Ate aqui so dava para agendar pelo computador, o que na pratica
   significava anotar num papel e transcrever depois (ou esquecer).
   Usa a mesma acao salvarVisita da API, entao a visita nasce ja ligada ao
   lead e conta para a protecao do dono e para a elegibilidade. */
/* AGENDAR VISITA PELO CELULAR — com produto, unidade e gerente.
   O CRM antigo sempre teve esses campos (de 140 visitas no historico, 55 com
   gerente e 53 com produto) e o Funil 2.0 tinha nascido so com data e imovel
   escrito a mao. Visita sem produto nao diz o que vai ser mostrado; sem gerente
   nao da para checar conflito de agenda -- erro que so aparece no dia, com o
   cliente na porta. */
function AgendarVisitaMobile({
  lead,
  accessToken,
  onSalvo,
}: {
  lead: LeadFunil2;
  accessToken: string;
  onSalvo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [quando, setQuando] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [comGerente, setComGerente] = useState(false);
  const [gerente, setGerente] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([]);
  const [gerentes, setGerentes] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    if (!aberto) return;
    const sb = getBrowserSupabaseClient();
    void sb.from("empreendimentos").select("id,nome").order("nome").limit(200)
      .then(({ data }) => setProdutos((data ?? []) as { id: string; nome: string }[]));
    void sb.from("gerentes").select("id,nome").eq("ativo", true).order("geral", { ascending: false }).order("nome")
      .then(({ data }) => setGerentes((data ?? []) as { id: number; nome: string }[]));
  }, [aberto]);

  async function salvar() {
    if (!quando) { setErro("Escolha a data e a hora."); return; }
    if (!empreendimento && !unidade.trim()) { setErro("Escolha o produto da visita."); return; }
    if (comGerente && !gerente) { setErro("Escolha qual gerente vai junto."); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salvarVisita",
          leadId: lead.id,
          inicioEm: new Date(quando).toISOString(),
          imovel: unidade.trim() || "",
          empreendimentoId: empreendimento || null,
          unidade: unidade.trim() || null,
          comGerente,
          gerenteId: comGerente ? Number(gerente) : null,
          status: "agendada",
        }),
      });
      const dados = await resposta.json().catch(() => null) as { ok?: boolean; erro?: string } | null;
      if (!resposta.ok || dados?.ok === false) {
        /* Conflito de agenda tem de ser dito com todas as letras: remarcar
           agora custa um minuto, descobrir no dia custa a visita. */
        setErro(dados?.erro === "gerente_ocupado"
          ? "Esse gerente já tem visita nesse horário. Escolha outro horário ou outro gerente."
          : "Não foi possível agendar. Confira os dados e tente de novo.");
        return;
      }
      setAberto(false); setQuando(""); setEmpreendimento(""); setUnidade("");
      setComGerente(false); setGerente("");
      onSalvo();
    } catch {
      setErro("Não foi possível agendar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return <button type="button" className="f2m-agendar-abrir" onClick={() => setAberto(true)}>
      📅 Agendar visita
    </button>;
  }

  return <section className="f2m-agendar">
    <h3>Agendar visita</h3>

    <label>Produto
      <select value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)}>
        <option value="">— escolha o empreendimento —</option>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>

    <label>Unidade <small>(opcional)</small>
      <input type="text" value={unidade} placeholder="Ex.: apto 402"
             onChange={(e) => setUnidade(e.target.value)} />
    </label>

    <label>Data e hora
      <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
    </label>

    <label className="f2m-agendar-check">
      <input type="checkbox" checked={comGerente} onChange={(e) => setComGerente(e.target.checked)} />
      Quero o gerente presente
    </label>

    {comGerente && <label>Qual gerente
      <select value={gerente} onChange={(e) => setGerente(e.target.value)}>
        <option value="">— escolha —</option>
        {gerentes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
    </label>}

    {erro && <p className="f2m-agendar-erro">{erro}</p>}
    <div className="f2m-agendar-acoes">
      <button type="button" className="f2m-agendar-nao" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</button>
      <button type="button" className="f2m-agendar-ok" onClick={() => void salvar()} disabled={salvando}>
        {salvando ? "Agendando…" : "Confirmar visita"}
      </button>
    </div>
  </section>;
}

/* NOTA DO ATENDIMENTO NO CELULAR.
   O que o cliente falou na rua morria no WhatsApp do corretor: quem abrisse o
   card depois -- gestor, outro corretor, o proprio dono -- nao tinha como saber
   o que ja foi combinado. A nota fica no lead, com autor e hora, e e o unico
   lugar onde cabe o contexto que a conversa nao explica sozinha. */
function NotasMobile({
  lead,
  notas,
  accessToken,
  onSalvo,
}: {
  lead: LeadFunil2;
  notas: NotaFunil2[];
  accessToken: string;
  onSalvo: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    const limpo = texto.trim();
    if (!limpo) { setErro("Escreva a nota antes de salvar."); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvarNota", leadId: lead.id, texto: limpo }),
      });
      const dados = await resposta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!resposta.ok || dados?.ok === false) {
        setErro(dados?.error || "Não foi possível salvar a nota.");
        return;
      }
      setTexto("");
      onSalvo();
    } catch {
      setErro("Não foi possível salvar a nota. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return <section className="f2m-historico f2m-notas">
    <h3>Notas do atendimento</h3>
    {notas.length === 0 ? <p>Nenhuma nota escrita ainda.</p> : notas.slice(0, 8).map((nota) => <article key={nota.id}>
      <i />
      <div><strong>{nota.autor_nome ?? "Equipe"}</strong><span>{nota.texto}</span><small>{new Date(nota.criado_em).toLocaleString("pt-BR")}</small></div>
    </article>)}
    <textarea className="f2m-nota-texto" value={texto} onChange={(evento) => setTexto(evento.target.value)}
              placeholder="O que ficou combinado? Escreva para quem abrir este lead depois." maxLength={2000} rows={3} />
    {erro && <p className="f2m-agendar-erro">{erro}</p>}
    <button type="button" className="f2m-agendar-ok" onClick={() => void salvar()} disabled={salvando || !texto.trim()}>
      {salvando ? "Salvando…" : "Salvar nota"}
    </button>
  </section>;
}

/* DESCARTAR COM MOTIVO, PELO CELULAR.
   Nenhum lead sai do funil sozinho, por silencio ou por tempo. Sempre tem
   alguem clicando e escolhendo o motivo -- e o motivo vem de lista fechada
   porque descarte sem motivo contavel vira desculpa no fim do mes. O lead nao
   e apagado: sai da carteira e continua no banco com data, autor e motivo. */
function DescartarMobile({
  lead,
  accessToken,
  onDescartado,
}: {
  lead: LeadFunil2;
  accessToken: string;
  onDescartado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function descartar() {
    if (!motivo) { setErro("Escolha o motivo do descarte."); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "descartar", id: lead.id, versao: lead.versao, motivo, detalhe: detalhe.trim() || null }),
      });
      const dados = await resposta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!resposta.ok || dados?.ok === false) {
        setErro(dados?.error || "Não foi possível descartar este lead.");
        return;
      }
      onDescartado();
    } catch {
      setErro("Não foi possível descartar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return <button type="button" className="f2m-descartar-abrir" onClick={() => setAberto(true)}>
      ✖ Descartar lead
    </button>;
  }

  return <section className="f2m-agendar f2m-descartar">
    <h3>Descartar lead</h3>
    <p>{lead.nome} sai da sua carteira. Nada é apagado: fica registrado quem descartou, quando e por quê.</p>

    <label>Motivo
      <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
        <option value="">— escolha o motivo —</option>
        {MOTIVOS_DESCARTE.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>

    <label>Detalhe <small>(opcional)</small>
      <textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)}
                placeholder="O que aconteceu? Ajuda quem for reabrir este lead depois." maxLength={500} rows={3} />
    </label>

    {erro && <p className="f2m-agendar-erro">{erro}</p>}
    <div className="f2m-agendar-acoes">
      <button type="button" className="f2m-agendar-nao" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</button>
      <button type="button" className="f2m-agendar-ok" onClick={() => void descartar()} disabled={salvando || !motivo}>
        {salvando ? "Descartando…" : "Confirmar descarte"}
      </button>
    </div>
  </section>;
}

function DetalheMobile({
  lead,
  momento,
  eventos,
  notas,
  onFechar,
  accessToken,
  onSalvo,
  onRecarregar,
}: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  eventos: EventoFunil2[];
  notas: NotaFunil2[];
  onFechar: () => void;
  accessToken: string;
  onSalvo: () => void;
  onRecarregar: () => void;
}) {
  const prazo = prazoDaAcao(lead);
  return <div className="f2m-overlay" role="dialog" aria-modal="true" aria-label={`Atendimento de ${lead.nome}`}>
    <section className="f2m-detalhe">
      <header>
        <button type="button" onClick={onFechar} aria-label="Voltar">‹</button>
        <div><small>ATENDIMENTO</small><h2>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem responsável"}{lead.instancia_rotulo ? <em className="f2m-instancia" title={`Contato saindo por ${lead.instancia_rotulo}`}> · {lead.instancia_rotulo}</em> : null}</p></div>
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

      <AgendarVisitaMobile lead={lead} accessToken={accessToken} onSalvo={onSalvo} />

      <DescartarMobile lead={lead} accessToken={accessToken} onDescartado={() => { onSalvo(); onFechar(); }} />

      {/* Visita e descarte encerram a ficha, entao fechar depois de salvar e o
          certo. Nota nao encerra nada: o corretor escreve o que ficou combinado
          e precisa VER a nota entrar na lista. Fechar aqui jogava ele de volta
          na fila sem confirmacao nenhuma -- e ele reescrevia a mesma nota
          achando que nao tinha salvado. Por isso a nota so recarrega. */}
      <NotasMobile lead={lead} notas={notas} accessToken={accessToken} onSalvo={onRecarregar} />

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
  /* No modo CRM os botoes Agora/Hoje/Todos nao sao renderizados -- mas o filtro
     continuava sendo APLICADO, travado em "agora", que so mostra lead com prazo
     ja vencido. Resultado: o corretor abria o CRM e a carteira inteira sumia.
     CRM e a carteira completa; "agora" so faz sentido no Meu Dia. */
  /* O Meu Dia abre em "Lead novo" quando ha lead novo esperando -- e onde o
     corretor precisa olhar primeiro. Sem lead novo, abrir numa aba vazia seria
     pior, entao cai no "Agora". No CRM a aba e sempre "todos" (carteira). */
  const [filtroDia, setFiltroDia] = useState<FiltroDia>(() => {
    if (modo === "crm") return "todos";
    return (dados?.leads ?? []).some((lead) => esperandoPrimeiraChamada(lead)) ? "novos" : "agora";
  });
  const [etapa, setEtapa] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [pedidoUrl] = useState(lerLeadDaUrl);
  const [agora] = useState(() => Date.now());

  const leads = useMemo(() => [...(dados?.leads ?? [])].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em)), [dados]);
  const momentos = dados?.momentos ?? [];
  const eventos = dados?.eventos ?? [];
  const notas = dados?.notas ?? [];

  const fimHoje = useMemo(() => { const data = new Date(agora); data.setHours(23, 59, 59, 999); return +data; }, [agora]);
  const contagens = useMemo(() => ({
    agora: leads.filter((lead) => +new Date(lead.proxima_acao_em) <= agora).length,
    hoje: leads.filter((lead) => venceHoje(lead, agora)).length,
    novos: leads.filter((lead) => esperandoPrimeiraChamada(lead)).length,
  }), [agora, leads]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return leads.filter((lead) => {
      const prazo = +new Date(lead.proxima_acao_em);
      const cabeNoDia = filtroDia === "todos"
        || (filtroDia === "novos" ? esperandoPrimeiraChamada(lead)
          : filtroDia === "agora" ? prazo <= agora : prazo <= fimHoje);
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
      {modo === "inicio" ? (["novos", "agora", "hoje", "todos"] as const).map((chave) => <button key={chave} type="button" className={`${filtroDia === chave ? "ativo" : ""}${chave === "novos" ? " f2m-chip-novo" : ""}`} onClick={() => setFiltroDia(chave)}>{chave === "agora" ? `Agora · ${contagens.agora}` : chave === "novos" ? `Chamar · ${contagens.novos}` : chave === "hoje" ? `Hoje · ${contagens.hoje}` : `Todos · ${leads.length}`}</button>) : ETAPAS.map(([chave, rotulo]) => <button key={chave} type="button" className={etapa === chave ? "ativo" : ""} onClick={() => setEtapa(chave)}>{rotulo}</button>)}
    </nav>

    {erro && <div className="f2m-erro"><strong>{erro}</strong><button type="button" onClick={recarregar}>Tentar novamente</button></div>}
    {!dados && !erro && <div className="f2m-loading">Organizando seu dia…</div>}
    {dados && !erro && visiveis.length === 0 && <div className="f2m-vazio"><strong>Nada pendente aqui.</strong><span>Troque o filtro para consultar o restante da carteira.</span></div>}

    <section className="f2m-lista" aria-label="Atendimentos">
      {visiveis.slice(0, modo === "inicio" ? 30 : 60).map((lead) => <CartaoLeadMobile key={lead.id} lead={lead} momento={momentos.find((momento) => momento.codigo === lead.momento_codigo) ?? null} onAbrir={() => setSelecionado(lead.id)} />)}
    </section>

    {leadAberto && <DetalheMobile lead={leadAberto} momento={momentos.find((momento) => momento.codigo === leadAberto.momento_codigo) ?? null} eventos={eventos.filter((evento) => evento.funil_lead_id === leadAberto.id).sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))} notas={notas.filter((nota) => nota.funil_lead_id === leadAberto.id)} onFechar={() => { setSelecionado("__fechado__"); limparLeadDaUrl(); }} accessToken={accessToken} onSalvo={() => { void recarregar(); setSelecionado(null); }} onRecarregar={() => { void recarregar(); }} />}
  </main>;
}
