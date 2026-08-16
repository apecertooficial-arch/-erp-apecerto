"use client";

/* MEU DIA / CRM no celular - interface aprovada.
 *
 * O markup desta tela foi substituido pelo layout aprovado (classes .ape-*).
 * As classes .f2m-* da folha antiga nao sao mais usadas aqui: nao ha camada
 * sobre camada, ha uma interface no lugar da outra.
 *
 * Os dados sao reais: /api/funil2 devolve os leads, momentos, eventos e notas
 * do Supabase, com o token da sessao. Nada nesta tela e inventado -- quando um
 * campo nao existe no banco, o bloco correspondente simplesmente nao aparece.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoWhatsApp } from "./BotaoWhatsApp";
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

/* Icones em traço de 2px e ponta arredondada, como manda a identidade. */
const tracos = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconeRelogio() { return <svg width="12" height="12" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.4 2" /></svg>; }
function IconeAtualizar() { return <svg width="14" height="14" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 3.5v5h-5" /></svg>; }
function IconeBusca() { return <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /></svg>; }
function IconeCheck({ tamanho = 30 }: { tamanho?: number }) { return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" {...tracos} strokeWidth={2.4} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>; }
function IconeAlerta() { return <svg width="28" height="28" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="M10.3 4 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4M12 17.2h.01" /></svg>; }
function IconeMais() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18" cy="12" r="1.7" /></svg>; }
function IconeVoltar() { return <svg width="19" height="19" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>; }

function nomeEtapa(codigo: string) {
  return ETAPAS.find(([chave]) => chave === codigo)?.[1] ?? codigo.replaceAll("_", " ");
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

function horaAgora() {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
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

/* Card do cliente: quem, por que agora, em que ponto está, e a única ação que
   importa. O bloco roxo só aparece quando o momento tem descrição no banco --
   espaço vazio é melhor do que conselho inventado. */
function CartaoLead({
  lead,
  momento,
  onAbrir,
}: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  onAbrir: () => void;
}) {
  const prazo = prazoDaAcao(lead);
  return <article className="ape-card">
    <div className="ape-card-topo">
      <span className="ape-avatar" aria-hidden="true">{iniciais(lead.nome)}</span>
      <button type="button" className="ape-quem" onClick={onAbrir}>
        <strong>{lead.nome}</strong>
        <span>{lead.corretor_nome ?? "Aguardando responsável"}{lead.instancia_rotulo ? ` · ${lead.instancia_rotulo}` : ""}</span>
      </button>
      <span className={`ape-prazo ${prazo.classe}`}><IconeRelogio />{situacaoPrazo(lead.proxima_acao_em).rotulo}</span>
    </div>

    <div className="ape-etiquetas">
      <span className="ape-etapa">{nomeEtapa(lead.etapa)}</span>
      <span className="ape-momento">{momento?.rotulo ?? lead.momento_codigo}</span>
    </div>

    {momento?.descricao ? <div className="ape-contexto">
      <span className="ape-contexto-titulo">
        <span className="ape-contexto-selo"><IconeCheck tamanho={10} /></span>
        O momento deste cliente
      </span>
      <p>{momento.descricao}</p>
    </div> : null}

    <div className="ape-acoes">
      <BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} compacto />
      <button type="button" className="ape-mais" onClick={onAbrir} aria-label={`Abrir ficha de ${lead.nome}`}><IconeMais /></button>
    </div>
  </article>;
}

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
    return <button type="button" className="f2m-agendar-abrir" onClick={() => setAberto(true)}>Agendar visita</button>;
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
      <input type="text" value={unidade} placeholder="Ex.: apto 402" onChange={(e) => setUnidade(e.target.value)} />
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
      if (!resposta.ok || dados?.ok === false) { setErro(dados?.error || "Não foi possível salvar a nota."); return; }
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
      if (!resposta.ok || dados?.ok === false) { setErro(dados?.error || "Não foi possível descartar este lead."); return; }
      onDescartado();
    } catch {
      setErro("Não foi possível descartar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return <button type="button" className="f2m-descartar-abrir" onClick={() => setAberto(true)}>Descartar lead</button>;
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

/* Ficha: tela de execução. O que fazer agora em cima, a ação fixa logo abaixo,
   e o histórico por último. */
function FichaLead({
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
  return <div className="ape-folha" role="dialog" aria-modal="true" aria-label={`Atendimento de ${lead.nome}`}>
    <section className="ape-ficha">
      <div className="ape-ficha-topo">
        <button type="button" className="ape-voltar" onClick={onFechar}><IconeVoltar />Fila</button>
      </div>

      <div className="ape-ficha-nome">
        <h2>{lead.nome}</h2>
        <p>{lead.corretor_nome ?? "Sem responsável"}{lead.instancia_rotulo ? ` · ${lead.instancia_rotulo}` : ""}</p>
        <div className="ape-ficha-etiquetas">
          <span className="ape-etapa">{nomeEtapa(lead.etapa)}</span>
          <span className="ape-momento">{momento?.rotulo ?? lead.momento_codigo}</span>
        </div>
      </div>

      <div className="ape-ordem">
        <span className="ape-contexto-titulo">
          <span className="ape-contexto-selo"><IconeCheck tamanho={10} /></span>
          O que fazer agora
        </span>
        <h3>{acaoVisivel(lead)}</h3>
        {momento?.descricao ? <p>{momento.descricao}</p> : null}
        <em className={`ape-ordem-prazo ${prazo.classe}`}>{prazo.rotulo}</em>
      </div>

      <div className="ape-ficha-acao">
        <BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} />
      </div>
      <p className="ape-ficha-nota">A mensagem sai do seu WhatsApp. O app não envia nada por você.</p>

      <AgendarVisitaMobile lead={lead} accessToken={accessToken} onSalvo={onSalvo} />

      <DescartarMobile lead={lead} accessToken={accessToken} onDescartado={() => { onSalvo(); onFechar(); }} />

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
  const leadAberto = selecionado === "__fechado__" ? null : leads.find((lead) => lead.id === selecionado) ?? leadPedido;
  const primeiroNome = nome.trim().split(/\s+/)[0] || "corretor";
  const naFila = contagens.agora;

  return <main className={`ape-app modo-${modo}`} aria-label={modo === "inicio" ? `Meu Dia de ${primeiroNome}` : "CRM"}>
    <header className="ape-abertura">
      {modo === "inicio" ? <>
        <span className="ape-sobrancelha">Sua fila de hoje</span>
        <h1 className="ape-manchete">{naFila === 1 ? "1 pessoa espera você agora" : `${naFila} pessoas esperam você agora`}</h1>
      </> : <>
        <span className="ape-sobrancelha">Carteira</span>
        <h1 className="ape-manchete">Seus clientes</h1>
      </>}
      <div className="ape-atualizado">
        <span>Atualizado {horaAgora()}</span>
        <button type="button" className="ape-atualizar" onClick={recarregar}><IconeAtualizar />Atualizar</button>
      </div>
    </header>

    {modo === "inicio" && <section className="ape-numeros" aria-label="Resumo do dia">
      <article><b>{contagens.agora}</b><span>aguardando</span></article>
      <article><b>{contagens.novos}</b><span>leads novos</span></article>
      <article><b>{contagens.hoje}</b><span>para hoje</span></article>
    </section>}

    {modo === "crm" && <label className="ape-busca">
      <IconeBusca />
      <input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar cliente ou telefone" />
    </label>}

    <nav className="ape-filtros" aria-label="Filtrar atendimentos">
      {modo === "inicio"
        ? (["novos", "agora", "hoje", "todos"] as const).map((chave) => <button
            key={chave}
            type="button"
            className={`${filtroDia === chave ? "ativo" : ""}${chave === "novos" ? " ape-chip-novo" : ""}`}
            onClick={() => setFiltroDia(chave)}
          >{chave === "agora" ? `Agora · ${contagens.agora}` : chave === "novos" ? `Chamar · ${contagens.novos}` : chave === "hoje" ? `Hoje · ${contagens.hoje}` : `Todos · ${leads.length}`}</button>)
        : ETAPAS.map(([chave, rotulo]) => <button key={chave} type="button" className={etapa === chave ? "ativo" : ""} onClick={() => setEtapa(chave)}>{rotulo}</button>)}
    </nav>

    {erro && <div className="ape-estado ruim">
      <span className="ape-estado-icone"><IconeAlerta /></span>
      <strong>Não deu pra carregar sua fila</strong>
      <p>{erro}</p>
      <button type="button" onClick={recarregar}>Tentar novamente</button>
    </div>}

    {!dados && !erro && <div className="ape-esqueleto" aria-label="Carregando">
      {[0, 1, 2].map((i) => <div key={i}>
        <div className="ape-barra curta" />
        <div className="ape-barra media" />
        <div className="ape-barra alta" />
      </div>)}
    </div>}

    {dados && pedidoUrl !== null && !leadPedido && <div className="ape-estado ruim">
      <span className="ape-estado-icone"><IconeAlerta /></span>
      <strong>Este cliente não está mais na sua carteira</strong>
      <button type="button" onClick={() => { limparLeadDaUrl(); onIr("/crm"); }}>Voltar ao CRM</button>
    </div>}

    {dados && !erro && visiveis.length === 0 && <div className="ape-estado">
      <span className="ape-estado-icone"><IconeCheck /></span>
      <strong>Fila zerada por agora</strong>
      <p>Você respondeu todo mundo que estava esperando. Troque o filtro para ver o restante da carteira.</p>
    </div>}

    <section className="ape-lista" aria-label="Atendimentos">
      {visiveis.slice(0, modo === "inicio" ? 30 : 60).map((lead) => <CartaoLead
        key={lead.id}
        lead={lead}
        momento={momentos.find((momento) => momento.codigo === lead.momento_codigo) ?? null}
        onAbrir={() => setSelecionado(lead.id)}
      />)}
    </section>

    {leadAberto && <FichaLead
      lead={leadAberto}
      momento={momentos.find((momento) => momento.codigo === leadAberto.momento_codigo) ?? null}
      eventos={eventos.filter((evento) => evento.funil_lead_id === leadAberto.id).sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))}
      notas={notas.filter((nota) => nota.funil_lead_id === leadAberto.id)}
      onFechar={() => { setSelecionado("__fechado__"); limparLeadDaUrl(); }}
      accessToken={accessToken}
      onSalvo={() => { void recarregar(); setSelecionado(null); }}
      onRecarregar={() => { void recarregar(); }}
    />}
  </main>;
}
