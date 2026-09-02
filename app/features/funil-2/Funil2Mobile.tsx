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
 *
 * MEU DIA EM TRES GRUPOS: o que acabou de chegar, o que chamar agora e o que
 * fica para mais tarde. Antes era uma lista corrida com chips de filtro em
 * cima, e o corretor tinha que ler card por card para descobrir o que era
 * urgente -- o grupo responde isso antes da leitura.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoWhatsApp } from "./BotaoWhatsApp";
import { AssociarTagLead } from "./AssociarTagLead";
import { Funil2ConversationDrawer } from "./Funil2ConversationDrawer";
import { HorariosVisita } from "./HorariosVisita";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  acaoVisivel,
  erroAgendamentoVisita,
  esperandoPrimeiraChamada,
  rotuloTemperatura,
  situacaoPrazo,
  venceHoje,
  type EventoFunil2,
  type EtapaConfigFunil2,
  type LeadFunil2,
  type MomentoFunil2,
  type NotaFunil2,
  type TagCatalogoFunil2,
  type TemperaturaLead,
} from "./modelo";

type PayloadMobile = {
  leads?: LeadFunil2[];
  momentos?: MomentoFunil2[];
  eventos?: EventoFunil2[];
  notas?: NotaFunil2[];
  tagCatalogo?: TagCatalogoFunil2[];
  etapas?: EtapaConfigFunil2[];
  error?: string;
};

type FiltroDia = "agora" | "novos" | "hoje" | "todos";
type TemperaturaFiltroMobile = TemperaturaLead | "aguardando" | "todas";

const TEMPERATURAS_MOBILE: ReadonlyArray<{ codigo: Exclude<TemperaturaFiltroMobile, "todas">; rotulo: string }> = [
  { codigo: "quente", rotulo: "Quente" },
  { codigo: "negociando", rotulo: "Negociando" },
  { codigo: "morno", rotulo: "Morno" },
  { codigo: "frio", rotulo: "Frio" },
  { codigo: "aguardando", rotulo: "Aguardando leitura" },
];

const temperaturaMobile = (lead: LeadFunil2): Exclude<TemperaturaFiltroMobile, "todas"> => lead.temperatura ?? "aguardando";

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

const ETAPAS_FALLBACK = [
  ["novo", "Lead novo"],
  ["tentando_contato", "Tentando contato"],
  ["em_atendimento", "Em atendimento"],
  ["visita", "Visita"],
  ["pos_visita", "Pós-visita"],
  ["atualizar_manual", "Atualizar manualmente"],
  ["legado", "Leads legado"],
  ["pescado", "Pescado"],
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
  return ETAPAS_FALLBACK.find(([chave]) => chave === codigo)?.[1] ?? codigo.replaceAll("_", " ");
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

function horaAgora() {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function textoCurto(texto: string, limite = 56) {
  return texto.length > limite ? `${texto.slice(0, limite - 1).trim()}…` : texto;
}

/* Interesse e tags sao coisas diferentes da etapa: etapa diz onde atender;
   interesse diz O QUE o cliente pediu. No card, o produto fica inteiro e as
   tags de aquisicao entram logo abaixo como contexto. */
function ContextoDoLead({ lead, completo = false }: { lead: LeadFunil2; completo?: boolean }) {
  const tags = lead.tags ?? [];
  const contexto = tags.filter((tag) =>
    tag.nome.toLocaleLowerCase("pt-BR") !== lead.interesse?.toLocaleLowerCase("pt-BR")
    && !/^automa[cç][aã]o\s*:/i.test(tag.nome),
  );
  const exibidas = completo ? tags : contexto.slice(0, 3);
  if (!lead.interesse && exibidas.length === 0) return null;
  return <div className={`ape-interesse-wrap${completo ? " completo" : ""}`}>
    {lead.interesse ? <div className="ape-interesse">
      <span>INTERESSE DO LEAD</span>
      <strong>{lead.interesse}</strong>
    </div> : null}
    {exibidas.length > 0 ? <div className="ape-tags-lead" aria-label="Tags de origem e interesse">
      {exibidas.map((tag) => <span key={tag.nome} title={tag.nome}>
        <i style={tag.cor ? { backgroundColor: tag.cor } : undefined} />{textoCurto(tag.nome)}
      </span>)}
      {!completo && contexto.length > exibidas.length ? <em>+{contexto.length - exibidas.length} tags</em> : null}
    </div> : null}
  </div>;
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

/* A fila mostra somente o necessário para decidir e agir. Origem, campanha,
   tags completas, canal e explicações ficam na ficha, onde existe espaço e
   intenção de leitura. */
function CartaoLead({
  lead,
  momento,
  onAbrir,
}: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  onAbrir: () => void;
}) {
  const prazo = situacaoPrazo(lead.proxima_acao_em);
  return <article className="ape-card">
    <div className="ape-card-topo">
      <span className="ape-avatar" aria-hidden="true">{iniciais(lead.nome)}</span>
      <button type="button" className="ape-quem" onClick={onAbrir}>
        <strong>{lead.nome}</strong>
        <span>{nomeEtapa(lead.etapa)} · {lead.corretor_nome ?? "Aguardando responsável"}</span>
      </button>
      <span className={`ape-prazo ${prazo.classe}`}><IconeRelogio />{situacaoPrazo(lead.proxima_acao_em).rotulo}</span>
    </div>

    <div className="ape-card-leitura">
      <span><small>MOMENTO</small><b className="ape-momento">{momento?.rotulo ?? lead.momento_codigo}</b></span>
      <span><small>TEMPERATURA</small><b className={`ape-momento temperatura-${temperaturaMobile(lead)}`}><i />{rotuloTemperatura(lead.temperatura) ?? "Aguardando leitura"}</b></span>
    </div>

    <div className="ape-card-acao"><small>PRÓXIMA AÇÃO</small><strong>{acaoVisivel(lead)}</strong>{lead.interesse && <span>{lead.interesse}</span>}</div>

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
  abertoInicial = false,
  onFechar,
}: {
  lead: LeadFunil2;
  accessToken: string;
  onSalvo: () => void;
  abertoInicial?: boolean;
  onFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [quando, setQuando] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [comGerente, setComGerente] = useState(false);
  const [gerente, setGerente] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([]);
  const [gerentes, setGerentes] = useState<{ id: number; nome: string }[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(abertoInicial);
  const [erroProdutos, setErroProdutos] = useState("");

  useEffect(() => {
    if (!aberto) return;
    const sb = getBrowserSupabaseClient();
    void sb.from("empreendimentos").select("id,nome").order("nome").limit(200)
      .then(({ data, error }) => {
        setCarregandoProdutos(false);
        if (error) { setErroProdutos("Não foi possível carregar os produtos. Tente novamente em instantes."); return; }
        setProdutos((data ?? []) as { id: string; nome: string }[]);
      });
    void sb.from("gerentes").select("id,nome").eq("ativo", true).order("geral", { ascending: false }).order("nome")
      .then(({ data }) => setGerentes((data ?? []) as { id: number; nome: string }[]));
  }, [aberto]);

  async function salvar() {
    const erroFormulario = erroAgendamentoVisita({
      leadId: lead.id,
      inicio: quando,
      empreendimentoId: empreendimento,
      unidade,
      comGerente,
      gerenteId: gerente,
    });
    if (erroFormulario) { setErro(erroFormulario); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "salvarVisita",
          leadId: lead.id,
          // `datetime-local` não carrega fuso. O servidor converte esta hora
          // de parede usando America/Sao_Paulo, independentemente do aparelho.
          inicioEm: quando,
          imovel: unidade.trim() || "",
          empreendimentoId: empreendimento || null,
          unidade: unidade.trim() || null,
          comGerente,
          gerenteId: comGerente ? Number(gerente) : null,
          status: "agendada",
        }),
      });
      const dados = await resposta.json().catch(() => null) as { ok?: boolean; error?: string; erro?: string } | null;
      if (!resposta.ok || dados?.ok === false) {
        setErro(dados?.error || (dados?.erro === "gerente_ocupado"
          ? "Esse gerente já tem visita nesse horário. Escolha outro horário ou outro gerente."
          : "Não foi possível agendar. Confira os dados e tente de novo."));
        return;
      }
      setAberto(false); setQuando(""); setEmpreendimento(""); setUnidade("");
      setComGerente(false); setGerente("");
      onSalvo(); onFechar?.();
    } catch {
      setErro("Não foi possível agendar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return <button type="button" className="f2m-agendar-abrir" onClick={() => { setCarregandoProdutos(true); setErroProdutos(""); setAberto(true); }}>Agendar visita</button>;
  }

  return <section className="f2m-agendar">
    <h3>Agendar visita</h3>

    <label>Produto
      <select value={empreendimento} disabled={carregandoProdutos || Boolean(erroProdutos)} onChange={(e) => { setEmpreendimento(e.target.value); setErro(""); }}>
        <option value="">{carregandoProdutos ? "Carregando produtos…" : erroProdutos ? "Produtos indisponíveis" : produtos.length === 0 ? "Nenhum produto disponível" : "— escolha o empreendimento —"}</option>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
    {erroProdutos && <p className="f2m-agendar-erro" role="alert">{erroProdutos}</p>}

    <label>Unidade <small>(opcional)</small>
      <input type="text" value={unidade} placeholder="Ex.: apto 402" onChange={(e) => { setUnidade(e.target.value); setErro(""); }} />
    </label>

    <label className="f2m-agendar-check">
      <input type="checkbox" checked={comGerente} onChange={(e) => { setComGerente(e.target.checked); setQuando(""); setErro(""); }} />
      Quero o gerente presente
    </label>

    {comGerente && <label>Qual gerente
      <select value={gerente} onChange={(e) => { setGerente(e.target.value); setQuando(""); setErro(""); }}>
        <option value="">— escolha —</option>
        {gerentes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
    </label>}

    <HorariosVisita
      accessToken={accessToken}
      leadId={lead.id}
      comGerente={comGerente}
      gerenteId={gerente ? Number(gerente) : null}
      value={quando}
      onChange={(valor) => { setQuando(valor); setErro(""); }}
      disabled={salvando}
    />

    {erro && <p className="f2m-agendar-erro" role="alert">{erro}</p>}
    <div className="f2m-agendar-acoes">
      <button type="button" className="f2m-agendar-nao" onClick={() => { setAberto(false); onFechar?.(); }} disabled={salvando}>Cancelar</button>
      <button type="button" className="f2m-agendar-ok" onClick={() => void salvar()} disabled={salvando || !quando}>
        {salvando ? "Agendando…" : "Confirmar visita"}
      </button>
    </div>
  </section>;
}

function AtualizarMomentoMobile({ lead, momento, momentos, etapas, accessToken, onSalvo, abertoInicial = false }: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  momentos: MomentoFunil2[];
  etapas: EtapaConfigFunil2[];
  accessToken: string;
  onSalvo: () => void;
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [codigo, setCodigo] = useState(lead.momento_codigo);
  const [prazo, setPrazo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const escolhido = momentos.find((item) => item.codigo === codigo) ?? momento;

  async function salvar() {
    if (!codigo) { setErro("Escolha o momento do cliente."); return; }
    if (codigo === "RETORNO_PROGRAMADO" && !prazo) { setErro("Informe a data e a hora combinadas."); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "atualizarMomento", id: lead.id, versao: lead.versao, momentoCodigo: codigo, prazoCombinado: prazo || null, observacao: observacao.trim() || null }),
      });
      const dados = await resposta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!resposta.ok || dados?.ok === false) { setErro(dados?.error || "Não foi possível atualizar o momento."); return; }
      setAberto(false); setObservacao(""); setPrazo(""); onSalvo();
    } catch {
      setErro("Não foi possível atualizar. Tente novamente.");
    } finally { setSalvando(false); }
  }

  if (!aberto) return <button type="button" className="f2m-momento-abrir" onClick={() => setAberto(true)}>Atualizar momento do cliente</button>;

  return <section className="f2m-agendar f2m-momento-form">
    <h3>Atualizar momento</h3><p>Registre onde o cliente está agora. O próximo prazo será recalculado automaticamente.</p>
    <label>Momento oficial<select value={codigo} onChange={(evento) => setCodigo(evento.target.value)}>
      {etapas.filter((etapa) => etapa.ativo).map((etapa) => {
        const opcoes = momentos.filter((item) => item.ativo !== false && item.etapa === etapa.codigo);
        return opcoes.length ? <optgroup key={etapa.codigo} label={etapa.rotulo}>{opcoes.map((item) => <option key={item.codigo} value={item.codigo}>{item.rotulo}</option>)}</optgroup> : null;
      })}
    </select></label>
    {escolhido && <div className="f2m-momento-preview"><span>PRÓXIMA AÇÃO</span><strong>{escolhido.acao_rotulo}</strong><small>{escolhido.prazo_rotulo || "Data combinada"}</small></div>}
    {codigo === "RETORNO_PROGRAMADO" && <label>Data e hora combinadas<input type="datetime-local" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} /></label>}
    <label>Observação <small>(opcional)</small><textarea value={observacao} onChange={(evento) => setObservacao(evento.target.value)} placeholder="O que mudou ou ficou combinado?" maxLength={500} rows={3} /></label>
    {erro && <p className="f2m-agendar-erro">{erro}</p>}
    <div className="f2m-agendar-acoes"><button type="button" className="f2m-agendar-nao" onClick={() => setAberto(false)} disabled={salvando}>Cancelar</button><button type="button" className="f2m-agendar-ok" onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : "Salvar momento"}</button></div>
  </section>;
}

function GerarNegociacaoMobile({ lead, accessToken, onSalvo, abertoInicial = false, onFechar }: { lead: LeadFunil2; accessToken: string; onSalvo: () => void; abertoInicial?: boolean; onFechar?: () => void }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (titulo.trim().length < 2) { setErro("Informe qual é a oportunidade."); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "salvarNegociacao", leadId: lead.id, titulo: titulo.trim(), valor: valor ? Number(valor) : null, etapa: "qualificacao" }),
      });
      const dados = await resposta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!resposta.ok || dados?.ok === false) { setErro(dados?.error || "Não foi possível criar a negociação."); return; }
      setAberto(false); setTitulo(""); setValor(""); onSalvo(); onFechar?.();
    } catch {
      setErro("Não foi possível criar a negociação. Tente novamente.");
    } finally { setSalvando(false); }
  }

  if (!aberto) return <button type="button" className="f2m-negociacao-abrir" onClick={() => setAberto(true)}>Criar negociação</button>;

  return <section className="f2m-agendar f2m-negociacao-form">
    <h3>Criar negociação</h3><p>A oportunidade será vinculada a {lead.nome} e entrará em Qualificação na Esteira.</p>
    <label>Oportunidade<input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} placeholder="Ex.: Apartamento no Centro" maxLength={120} /></label>
    <label>Valor estimado <small>(opcional)</small><input type="number" min="0" step="0.01" value={valor} onChange={(evento) => setValor(evento.target.value)} /></label>
    {erro && <p className="f2m-agendar-erro">{erro}</p>}
    <div className="f2m-agendar-acoes"><button type="button" className="f2m-agendar-nao" onClick={() => { setAberto(false); onFechar?.(); }} disabled={salvando}>Cancelar</button><button type="button" className="f2m-agendar-ok" onClick={() => void salvar()} disabled={salvando || titulo.trim().length < 2}>{salvando ? "Criando…" : "Criar negociação"}</button></div>
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
  abertoInicial = false,
  onFechar,
}: {
  lead: LeadFunil2;
  accessToken: string;
  onDescartado: () => void;
  abertoInicial?: boolean;
  onFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
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
      <button type="button" className="f2m-agendar-nao" onClick={() => { setAberto(false); onFechar?.(); }} disabled={salvando}>Cancelar</button>
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
  momentos,
  etapas,
  eventos,
  notas,
  onFechar,
  accessToken,
  onSalvo,
  onRecarregar,
  tagCatalogo,
}: {
  lead: LeadFunil2;
  momento: MomentoFunil2 | null;
  momentos: MomentoFunil2[];
  etapas: EtapaConfigFunil2[];
  eventos: EventoFunil2[];
  notas: NotaFunil2[];
  onFechar: () => void;
  accessToken: string;
  onSalvo: () => void;
  onRecarregar: () => void;
  tagCatalogo: TagCatalogoFunil2[];
}) {
  const [aba, setAba] = useState<"atendimento" | "notas" | "historico">("atendimento");
  const [chatAberto, setChatAberto] = useState(false);
  const [maisAcoes, setMaisAcoes] = useState(false);
  const [acaoMais, setAcaoMais] = useState<"visita" | "negociacao" | "tag" | "descarte" | null>(null);
  const [temperaturaAberta, setTemperaturaAberta] = useState(false);
  const [salvandoTemperatura, setSalvandoTemperatura] = useState(false);
  const [erroTemperatura, setErroTemperatura] = useState("");
  const prazo = situacaoPrazo(lead.proxima_acao_em);
  const temperatura = lead.temperatura ?? null;
  const temperaturaRotulo = rotuloTemperatura(temperatura) ?? "Aguardando leitura";
  useEffect(() => {
    const fechar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      if (chatAberto) setChatAberto(false);
      else if (acaoMais) setAcaoMais(null);
      else if (maisAcoes) setMaisAcoes(false);
      else if (temperaturaAberta) setTemperaturaAberta(false);
      else onFechar();
    };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [acaoMais, chatAberto, maisAcoes, onFechar, temperaturaAberta]);

  async function atualizarTemperatura(temperaturaNova: TemperaturaLead | null) {
    setSalvandoTemperatura(true); setErroTemperatura("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "atualizarTemperatura", id: lead.id, versao: lead.versao, temperatura: temperaturaNova }),
      });
      const json = await resposta.json().catch(() => ({})) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível alterar a temperatura.");
      setTemperaturaAberta(false);
      onRecarregar();
    } catch (falha) {
      setErroTemperatura(falha instanceof Error ? falha.message : "Não foi possível alterar a temperatura.");
    } finally {
      setSalvandoTemperatura(false);
    }
  }

  return <div className="ape-folha" role="dialog" aria-modal="true" aria-label={`Atendimento de ${lead.nome}`} onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onFechar(); }}>
    <section className="ape-ficha">
      <div className="ape-ficha-topo">
        <button type="button" className="ape-voltar" onClick={onFechar}><IconeVoltar />Fila</button>
      </div>

      <div className="ape-ficha-nome">
        <h2>{lead.nome}</h2>
        <p>{lead.corretor_nome ?? "Sem responsável"} · negócio #{lead.origem_negocio_id}</p>
        <div className="ape-ficha-etiquetas ape-ficha-resumo-chips"><span className="ape-etapa"><small>Etapa</small>{nomeEtapa(lead.etapa)}</span><span className="ape-momento"><small>Momento</small>{momento?.rotulo ?? lead.momento_codigo}</span><span className="ape-temperatura-controle"><button type="button" className={`ape-momento temperatura-${temperatura ?? "aguardando"}`} aria-expanded={temperaturaAberta} aria-label={`Alterar temperatura. Atual: ${temperaturaRotulo}`} disabled={salvandoTemperatura} onClick={() => setTemperaturaAberta((aberta) => !aberta)}><i /><small>Temp.</small>{temperaturaRotulo}<b>⌄</b></button>{temperaturaAberta && <span className="ape-temperatura-popover" role="dialog" aria-label="Alterar temperatura"><strong>Temperatura do lead</strong>{TEMPERATURAS_MOBILE.map((item) => <button type="button" key={item.codigo} disabled={salvandoTemperatura} className={`temperatura-${item.codigo}${temperaturaMobile(lead) === item.codigo ? " ativa" : ""}`} onClick={() => void atualizarTemperatura(item.codigo === "aguardando" ? null : item.codigo)}><i />{item.rotulo}</button>)}{erroTemperatura && <em role="alert">{erroTemperatura}</em>}</span>}</span><em className={`ape-momento prazo-${prazo.classe}`}><small>Prazo</small>{prazo.rotulo}</em></div>
        <p className="ape-ficha-interesse">Interesse: <b>{lead.interesse ?? "Não identificado"}</b></p>
      </div>

      <section className="ape-ordem ape-proxima-aprovada"><span className="ape-contexto-titulo">Próxima ação</span><h3>{acaoVisivel(lead)}</h3>{momento?.descricao ? <p>{momento.descricao}</p> : null}</section>

      <div className="ape-ficha-acoes-aprovadas"><button type="button" onClick={() => setChatAberto(true)}>Chat</button><button type="button" onClick={() => setAcaoMais("visita")}>Agendar visita</button><button type="button" aria-expanded={maisAcoes} onClick={() => setMaisAcoes(true)}>Mais</button></div>

      <nav className="ape-ficha-abas" role="tablist" aria-label="Áreas do atendimento">{([ ["atendimento", "Atendimento"], ["notas", "Notas"], ["historico", "Histórico"] ] as const).map(([chave, rotulo]) => <button key={chave} type="button" role="tab" aria-selected={aba === chave} className={aba === chave ? "ativa" : ""} onClick={() => setAba(chave)}>{rotulo}</button>)}</nav>

      {aba === "atendimento" && <div className="ape-ficha-painel"><section className="f2m-sara-resumo f2m-sara-aprovado"><span>LEITURA DA SARA</span><strong className="f2m-sara-frase">{lead.ultima_reavaliacao_resumo ?? "Ainda não existe uma leitura resumida."}</strong>{lead.qualidade_atendimento_resumo && <details><summary>Ver avaliação do atendimento</summary><small>{lead.qualidade_atendimento_resumo}</small></details>}</section><details className="f2m-detalhes-atendimento"><summary>Detalhes do atendimento</summary><div><span><b>Última ação confirmada</b><strong>{lead.ultima_acao_confirmada_em ? new Date(lead.ultima_acao_confirmada_em).toLocaleString("pt-BR") : "Ainda não confirmada"}</strong></span><span><b>Sara reavaliou</b><strong>{lead.ultima_reavaliacao_sara_em ? new Date(lead.ultima_reavaliacao_sara_em).toLocaleString("pt-BR") : "Ainda não reavaliou"}</strong></span><span><b>Nota do atendimento</b><strong>{lead.qualidade_atendimento_nota == null ? "Ainda não avaliado" : `${Number(lead.qualidade_atendimento_nota).toFixed(1)}/10`}</strong></span><span><b>Telefone</b><strong>{lead.telefone || "Não informado"}</strong></span><span><b>Canal</b><strong>{lead.instancia_rotulo || "Não identificado"}</strong></span></div><ContextoDoLead lead={lead} completo /><p>A temperatura vem da conversa e é classificada pela Sara. A conclusão da tarefa vem do D-API.</p></details><AtualizarMomentoMobile lead={lead} momento={momento} momentos={momentos} etapas={etapas} accessToken={accessToken} onSalvo={onRecarregar} abertoInicial /></div>}

      {aba === "notas" && <div className="ape-ficha-painel"><NotasMobile lead={lead} notas={notas} accessToken={accessToken} onSalvo={onRecarregar} /></div>}

      {aba === "historico" && <div className="ape-ficha-painel"><section className="f2m-historico"><h3>Últimas atualizações</h3>{eventos.length === 0 ? <p>Ainda não há atualização registrada neste atendimento.</p> : eventos.slice(0, 8).map((evento) => <article key={evento.id}><i /><div><strong>{evento.titulo}</strong>{evento.detalhe && <span>{evento.detalhe}</span>}<small>{new Date(evento.criado_em).toLocaleString("pt-BR")}</small></div></article>)}</section></div>}

      <div className="ape-ficha-rodape-aprovado"><BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} compacto /><button type="button" onClick={() => setChatAberto(true)} aria-label="Ver conversa">Chat</button></div>

      {chatAberto && (lead.lead_id > 0 ? <Funil2ConversationDrawer accessToken={accessToken} leadId={lead.id} nome={lead.nome} onClose={() => setChatAberto(false)} /> : <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setChatAberto(false); }}><section><button type="button" onClick={() => setChatAberto(false)}>×</button><p>Este cliente ainda não possui conversa vinculada.</p></section></div>)}

      {maisAcoes && <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setMaisAcoes(false); }}><section role="dialog" aria-label="Mais ações"><i /><button type="button" onClick={() => { setMaisAcoes(false); setAcaoMais("negociacao"); }}>Gerar negociação</button><button type="button" onClick={() => { setMaisAcoes(false); setAcaoMais("tag"); }}>Adicionar tag</button><hr /><button type="button" className="risco" onClick={() => { setMaisAcoes(false); setAcaoMais("descarte"); }}>Descartar lead</button><p>O descarte pede motivo e confirmação antes de concluir.</p></section></div>}

      {acaoMais && <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setAcaoMais(null); }}><section role="dialog" aria-label={acaoMais === "visita" ? "Agendar visita" : acaoMais === "negociacao" ? "Gerar negociação" : acaoMais === "tag" ? "Adicionar tag" : "Descartar lead"}><i />{acaoMais === "visita" && <AgendarVisitaMobile lead={lead} accessToken={accessToken} onSalvo={onSalvo} abertoInicial onFechar={() => setAcaoMais(null)} />}{acaoMais === "negociacao" && <GerarNegociacaoMobile lead={lead} accessToken={accessToken} onSalvo={onRecarregar} abertoInicial onFechar={() => setAcaoMais(null)} />}{acaoMais === "tag" && <AssociarTagLead leadId={lead.id} catalogo={tagCatalogo} tagsAssociadas={(lead.tags ?? []).map((tag) => tag.nome)} accessToken={accessToken} onSalvo={onRecarregar} mobile abertoInicial onFechar={() => setAcaoMais(null)} />}{acaoMais === "descarte" && <DescartarMobile lead={lead} accessToken={accessToken} onDescartado={() => { onSalvo(); onFechar(); }} abertoInicial onFechar={() => setAcaoMais(null)} />}</section></div>}
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
  /* No Meu Dia a lista NAO e filtrada por chip: os tres grupos abaixo dao conta
     do recorte. "todos" aqui significa "deixe o agrupamento decidir". */
  const filtroDia: FiltroDia = "todos";
  const [etapa, setEtapa] = useState("ativos");
  const [temperatura, setTemperatura] = useState<TemperaturaFiltroMobile>("todas");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [historicoDetalhe, setHistoricoDetalhe] = useState<{ leadId: string; eventos: EventoFunil2[]; notas: NotaFunil2[] } | null>(null);
  const [pedidoUrl] = useState(lerLeadDaUrl);
  const [agora] = useState(() => Date.now());

  const leads = useMemo(() => [...(dados?.leads ?? [])].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em)), [dados]);
  const momentos = dados?.momentos ?? [];
  const eventos = dados?.eventos ?? [];
  const notas = dados?.notas ?? [];
  const etapas = useMemo(() => {
    const configuradas = (dados?.etapas ?? []).filter((item) => item.ativo);
    return configuradas.length > 0
      ? configuradas.map((item) => [item.codigo, item.rotulo] as const)
      : [...ETAPAS_FALLBACK];
  }, [dados]);

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
      const cabeNaEtapa = etapa === "ativos" ? lead.etapa !== "legado" : lead.etapa === etapa;
      const cabeNaTemperatura = temperatura === "todas" || temperaturaMobile(lead) === temperatura;
      const cabeNaBusca = !termo || `${lead.nome} ${lead.telefone ?? ""} ${lead.interesse ?? ""} ${(lead.tags ?? []).map((tag) => tag.nome).join(" ")}`.toLocaleLowerCase("pt-BR").includes(termo);
      return cabeNoDia && cabeNaEtapa && cabeNaTemperatura && cabeNaBusca;
    });
  }, [agora, busca, etapa, filtroDia, fimHoje, leads, temperatura]);

  /* OS TRES GRUPOS DO MEU DIA, na ordem em que o corretor age.
     "Acabou de chegar" vem primeiro mesmo com prazo mais folgado: lead novo tem
     minutos, nao horas. Depois o que ja venceu ou vence agora, e por fim o
     resto de hoje. Quem tem prazo depois de hoje nao aparece aqui -- isso e a
     carteira, e mora no CRM. */
  const gruposDoDia = useMemo(() => {
    const chegou = visiveis.filter((lead) => esperandoPrimeiraChamada(lead));
    const idsChegou = new Set(chegou.map((lead) => lead.id));
    const resto = visiveis.filter((lead) => !idsChegou.has(lead.id) && +new Date(lead.proxima_acao_em) <= fimHoje);
    return [
      { chave: "chegou", titulo: "Acabou de chegar", leads: chegou },
      { chave: "agora", titulo: "Chamar agora", leads: resto.filter((lead) => +new Date(lead.proxima_acao_em) <= agora) },
      { chave: "depois", titulo: "Daqui a pouco", leads: resto.filter((lead) => +new Date(lead.proxima_acao_em) > agora) },
    ].filter((grupo) => grupo.leads.length > 0);
  }, [agora, fimHoje, visiveis]);

  /* A manchete conta quem esta esperando AGORA (chegou + vencido), nao a lista
     inteira: "esperam voce agora" tem que casar com o que os dois primeiros
     grupos mostram. */
  const esperandoAgora = gruposDoDia
    .filter((grupo) => grupo.chave !== "depois")
    .reduce((total, grupo) => total + grupo.leads.length, 0);
  const totalNoDia = gruposDoDia.reduce((total, grupo) => total + grupo.leads.length, 0);

  const leadPedido = pedidoUrl === null ? null : leads.find((lead) => lead.origem_negocio_id === pedidoUrl) ?? null;
  const leadAberto = selecionado === "__fechado__" ? null : leads.find((lead) => lead.id === selecionado) ?? leadPedido;
  const leadHistoricoId = leadAberto?.id ?? null;
  const leadHistoricoVersao = leadAberto?.versao ?? null;
  useEffect(() => {
    if (!leadHistoricoId) return;
    let ativo = true;
    void fetch(`/api/funil2?historicoLeadId=${encodeURIComponent(leadHistoricoId)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => ({ ok: response.ok, json: await response.json().catch(() => ({})) as PayloadMobile }))
      .then((resposta) => {
        if (!ativo || !resposta.ok) return;
        setHistoricoDetalhe({ leadId: leadHistoricoId, eventos: resposta.json.eventos ?? [], notas: resposta.json.notas ?? [] });
      });
    return () => { ativo = false; };
  }, [accessToken, leadHistoricoId, leadHistoricoVersao]);
  const primeiroNome = nome.trim().split(/\s+/)[0] || "corretor";

  const cartao = (lead: LeadFunil2) => <CartaoLead
    key={lead.id}
    lead={lead}
    momento={momentos.find((momento) => momento.codigo === lead.momento_codigo) ?? null}
    onAbrir={() => setSelecionado(lead.id)}
  />;

  return <main className={`ape-app modo-${modo}`} aria-label={modo === "inicio" ? `Meu Dia de ${primeiroNome}` : "CRM"}>
    <header className="ape-abertura">
      {modo === "inicio" ? <>
        <span className="ape-sobrancelha">Meu Dia</span>
        <h1 className="ape-manchete">{esperandoAgora === 1 ? "1 pessoa espera você agora" : `${esperandoAgora} pessoas esperam você agora`}</h1>
      </> : <>
        <span className="ape-sobrancelha">Carteira</span>
        <h1 className="ape-manchete">Seus clientes</h1>
      </>}
      <div className="ape-atualizado">
        <span>Atualizado {horaAgora()}</span>
        <button type="button" className="ape-atualizar" onClick={recarregar}><IconeAtualizar />Atualizar</button>
      </div>
    </header>

    {sucesso && <div className="ape-visita-sucesso" role="status">
      <div><strong>Visita agendada com sucesso</strong><span>{sucesso}</span></div>
      <button type="button" onClick={() => { setSucesso(null); onIr("/agenda"); }}>Abrir Agenda</button>
      <button type="button" className="fechar" aria-label="Fechar confirmação" onClick={() => setSucesso(null)}>×</button>
    </div>}

    {modo === "inicio" && <section className="ape-numeros" aria-label="Resumo do dia">
      <article><b>{contagens.agora}</b><span>aguardando</span></article>
      <article><b>{contagens.novos}</b><span>leads novos</span></article>
      <article><b>{contagens.hoje}</b><span>para hoje</span></article>
    </section>}

    {modo === "crm" && <label className="ape-busca">
      <IconeBusca />
      <input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar cliente ou telefone" />
    </label>}

    {modo === "crm" && <nav className="ape-filtros" aria-label="Filtrar atendimentos">
      <button type="button" className={etapa === "ativos" ? "ativo" : ""} onClick={() => setEtapa("ativos")}>Ativos</button>
      {etapas.map(([chave, rotulo]) => <button key={chave} type="button" className={etapa === chave ? "ativo" : ""} onClick={() => setEtapa(chave)}>{rotulo}</button>)}
    </nav>}

    {modo === "crm" && <nav className="ape-temperatura-filtros" aria-label="Filtrar por temperatura">
      <span>TEMPERATURA</span>
      <button type="button" className={temperatura === "todas" ? "ativo" : ""} onClick={() => setTemperatura("todas")}>Todas</button>
      {TEMPERATURAS_MOBILE.map((item) => <button type="button" key={item.codigo} className={`${temperatura === item.codigo ? "ativo " : ""}temperatura-${item.codigo}`} onClick={() => setTemperatura(item.codigo)}><i />{item.rotulo}</button>)}
    </nav>}

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

    {dados && !erro && modo === "inicio" && totalNoDia === 0 && <div className="ape-estado">
      <span className="ape-estado-icone"><IconeCheck /></span>
      <strong>Fila zerada por agora</strong>
      <p>Você respondeu todo mundo que estava esperando hoje. O restante da carteira está no CRM.</p>
      <button type="button" onClick={() => onIr("/crm")}>Ver minha carteira</button>
    </div>}

    {dados && !erro && modo === "crm" && visiveis.length === 0 && <div className="ape-estado">
      <span className="ape-estado-icone"><IconeCheck /></span>
      <strong>Nenhum cliente neste filtro</strong>
      <p>Troque a etapa ou limpe a busca para ver o restante da carteira.</p>
    </div>}

    {modo === "inicio"
      ? gruposDoDia.map((grupo) => <section className="ape-grupo" key={grupo.chave} aria-label={grupo.titulo}>
          <div className="ape-grupo-topo">
            <span className={`ape-grupo-titulo ${grupo.chave}`}>{grupo.titulo}</span>
            <span className="ape-grupo-total">{grupo.leads.length}</span>
          </div>
          <div className="ape-lista">{grupo.leads.map(cartao)}</div>
        </section>)
      : <section className="ape-lista" aria-label="Atendimentos">{visiveis.slice(0, 60).map(cartao)}</section>}

    {modo === "inicio" && totalNoDia > 0 && <button type="button" className="ape-ver-carteira" onClick={() => onIr("/crm")}>
      Ver minha carteira ({leads.length})
    </button>}

    {leadAberto && <FichaLead
      lead={leadAberto}
      momento={momentos.find((momento) => momento.codigo === leadAberto.momento_codigo) ?? null}
      momentos={momentos}
      etapas={dados?.etapas ?? []}
      eventos={(historicoDetalhe?.leadId === leadAberto.id ? historicoDetalhe.eventos : eventos.filter((evento) => evento.funil_lead_id === leadAberto.id)).sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))}
      notas={historicoDetalhe?.leadId === leadAberto.id ? historicoDetalhe.notas : notas.filter((nota) => nota.funil_lead_id === leadAberto.id)}
      tagCatalogo={dados?.tagCatalogo ?? []}
      onFechar={() => { setSelecionado("__fechado__"); limparLeadDaUrl(); }}
      accessToken={accessToken}
      onSalvo={() => { setSucesso("Ela já está na Agenda, no horário escolhido."); void recarregar(); setSelecionado(null); }}
      onRecarregar={() => { void recarregar(); }}
    />}
  </main>;
}
