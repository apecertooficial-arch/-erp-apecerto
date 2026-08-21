"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { acaoVisivel, dataCurta, duracao, esperandoPrimeiraChamada, prazoDaAcao, rotuloCadencia, situacaoPrazo, tentativaAtual, venceHoje, type CandidatoAquarioFunil2, type EtapaConfigFunil2, type EventoFunil2, type LeadFunil2, type MomentoFunil2, type NegociacaoFunil2, type NotaFunil2, type OperacaoConfigFunil2, type SaraStatusFunil2, type TagCatalogoFunil2, type VisitaFunil2 } from "./modelo";
import { SalesProcessView } from "../sales/SalesProcessWorkspace";
import { Funil2ConversationDrawer } from "./Funil2ConversationDrawer";
import { AssociarTagLead } from "./AssociarTagLead";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { dataHoraLocalSaoPaulo, dataIsoSaoPaulo, FUSO_OPERACAO } from "../../lib/timezone";

type Perfil = { userId: string; role: string; name: string };
type Payload = {
  leads?: LeadFunil2[]; momentos?: MomentoFunil2[]; eventos?: EventoFunil2[]; etapas?: EtapaConfigFunil2[];
  visitas?: VisitaFunil2[]; negociacoes?: NegociacaoFunil2[]; notas?: NotaFunil2[]; aquario?: CandidatoAquarioFunil2[]; operacao?: OperacaoConfigFunil2 | null; sara?: SaraStatusFunil2; tagCatalogo?: TagCatalogoFunil2[]; error?: string;
};

/* Lista fechada, igual a da tabela motivos_descarte. Motivo escrito a mao nao
   vira relatorio: ninguem consegue contar quantos "sem grana" existem. */
const MOTIVOS_DESCARTE = ["Contato inválido", "Sem interesse", "Sem capacidade financeira", "Fora da região", "Já comprou", "Duplicado", "Pediu para não receber contato", "Produto incompatível"] as const;

/* O pipe de visitas nunca teve campo de data nem de imovel, entao nao existe
   regra de estilo para eles. Ate o CSS ganhar a sua, o campo copia a borda e o
   espacamento do select que ja mora dentro do mesmo cartao. */
const CAMPO_VISITA = { width: "100%", marginTop: "7px", padding: "8px", border: "1px solid var(--f2-line)", borderRadius: "9px", background: "#fff", fontSize: "9px" } as const;

async function api(token: string, init?: RequestInit) {
  const response = await fetch("/api/funil2", {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return { ok: response.ok, json: await response.json().catch(() => ({})) as Payload & { resultado?: unknown } };
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function linkWhatsapp(telefone: string | null) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos.startsWith("55") ? digitos : `55${digitos}`}`;
}

function InteresseLead({ lead, detalhado = false }: { lead: LeadFunil2; detalhado?: boolean }) {
  if (!lead.interesse && !(lead.tags?.length)) return null;
  const titulo = (lead.tags ?? []).map((tag) => tag.nome).join(" · ");
  return <span className={`f2-interesse-lead${detalhado ? " detalhado" : ""}`} title={titulo || undefined}>
    <b>{lead.interesse ? "Interesse" : "Tags"}</b>
    <strong>{lead.interesse ?? `${lead.tags?.length ?? 0} associada(s)`}</strong>
    {(lead.tags?.length ?? 0) > 1 ? <em>{lead.tags!.length} tags</em> : null}
  </span>;
}

/* O input datetime-local so entende hora local sem fuso. Sem esta conversao o
   corretor abre a visita das 14h, ve 17h e remarca sem querer. */
function paraCampoLocal(data: string) {
  return dataHoraLocalSaoPaulo(data);
}

function Icone({ nome }: { nome: "quadro" | "dia" | "historico" | "leads" | "visitas" | "vendas" | "config" | "sino" }) {
  const paths = nome === "quadro"
    ? <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></>
    : nome === "dia"
      ? <><path d="M4 6h16M4 12h16M4 18h11" /><path d="m18 17 2 2 3-4" /></>
      : nome === "historico" ? <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>
      : nome === "leads" ? <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M17 7h4M19 5v4"/></>
      : nome === "visitas" ? <><path d="M4 10 12 4l8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z"/></>
      : nome === "vendas" ? <><path d="M4 18V9m6 9V5m6 13v-7m4 7H2"/></>
      : nome === "config" ? <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1A8 8 0 0 0 15 6l-.3-2.5h-4L10.4 6a8 8 0 0 0-1.6 1L6.5 6 4.5 9.5 6.6 11a7 7 0 0 0 0 2L4.5 14.5l2 3.5 2.3-1a8 8 0 0 0 1.6 1l.3 2.5h4L15 18a8 8 0 0 0 1.6-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z"/></>
      : <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>;
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}

export function Funil2Workspace({ accessToken, profile }: { accessToken: string; profile: Perfil }) {
  const [leads, setLeads] = useState<LeadFunil2[]>([]);
  const [momentos, setMomentos] = useState<MomentoFunil2[]>([]);
  const [eventos, setEventos] = useState<EventoFunil2[]>([]);
  const [notas, setNotas] = useState<NotaFunil2[]>([]);
  const [tagCatalogo, setTagCatalogo] = useState<TagCatalogoFunil2[]>([]);
  const [etapas, setEtapas] = useState<EtapaConfigFunil2[]>([]);
  const [visitas, setVisitas] = useState<VisitaFunil2[]>([]);
  const [aquario, setAquario] = useState<CandidatoAquarioFunil2[]>([]);
  const [operacao, setOperacao] = useState<OperacaoConfigFunil2 | null>(null);
  const [sara, setSara] = useState<SaraStatusFunil2>({ modo: null, runnerAtivo: false, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: false });
  const [aba, setAba] = useState<"quadro" | "dia" | "leads" | "visitas" | "vendas" | "config">("dia");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  /* Quem clica em "Conversa" quer a conversa, nao a ficha com um botao de chat
     dentro. Guardamos a intencao para a ficha ja abrir no mini chat. */
  const [abrirNoChat, setAbrirNoChat] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"pescar" | "visita" | "negociacao" | "descartar" | null>(null);
  // Aviso nunca abre sozinho: no celular um painel automático encobria o CRM.
  // O corretor abre pelo sino quando quiser e fecha sem perder o contexto.
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [etapaMapa, setEtapaMapa] = useState("em_atendimento");
  const [limiteDia, setLimiteDia] = useState(50);
  /* Filtro do Meu Dia. Começa em "atrasadas": é o que o corretor tem que
     resolver agora. Os outros recortes existem, mas por escolha dele. */
  const [filtroDia, setFiltroDia] = useState<"atrasadas" | "urgentes" | "hoje" | "novos" | "visitas">("atrasadas");
  const trocarFiltroDia = useCallback((qual: "atrasadas" | "urgentes" | "hoje" | "novos" | "visitas") => {
    setFiltroDia(qual); setLimiteDia(50); /* volta ao topo: a lista é outra */
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const resposta = await api(accessToken);
    setCarregando(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o Funil 2.0."); return; }
    setLeads(resposta.json.leads ?? []);
    setMomentos(resposta.json.momentos ?? []);
    setEventos(resposta.json.eventos ?? []);
    setNotas(resposta.json.notas ?? []);
    setTagCatalogo(resposta.json.tagCatalogo ?? []);
    setEtapas(resposta.json.etapas ?? []);
    setVisitas(resposta.json.visitas ?? []);
    setAquario(resposta.json.aquario ?? []);
    setOperacao(resposta.json.operacao ?? null);
    setSara(resposta.json.sara ?? { modo: null, runnerAtivo: false, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: false });
  }, [accessToken]);

  useEffect(() => {
    let ativo = true;
    void api(accessToken).then((resposta) => {
      if (!ativo) return;
      setCarregando(false);
      if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o Funil 2.0."); return; }
      const leadsCarregados = resposta.json.leads ?? [];
      setLeads(leadsCarregados);
      setMomentos(resposta.json.momentos ?? []);
      setEventos(resposta.json.eventos ?? []);
      setNotas(resposta.json.notas ?? []);
      setTagCatalogo(resposta.json.tagCatalogo ?? []);
      setEtapas(resposta.json.etapas ?? []);
      setVisitas(resposta.json.visitas ?? []);
      setAquario(resposta.json.aquario ?? []);
      setOperacao(resposta.json.operacao ?? null);
      setSara(resposta.json.sara ?? { modo: null, runnerAtivo: false, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: false });

      /* O push usa o endereço canônico /negocio/N, que chega aqui como
         ?lead=N. Consumimos o parâmetro no retorno assíncrono da carteira para
         abrir diretamente a ficha, sem um segundo efeito e sem render em
         cascata. */
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const abrirConversa = Number(url.searchParams.get("chat"));
        const negocioId = Number(url.searchParams.get("lead")) || abrirConversa;
        const destino = Number.isFinite(negocioId) && negocioId > 0
          ? leadsCarregados.find((item) => item.origem_negocio_id === negocioId)
          : null;
        if (destino) {
          setSelecionado(destino.id);
          setAbrirNoChat(abrirConversa > 0);
          setAba("dia");
          url.searchParams.delete("lead");
          url.searchParams.delete("chat");
          url.searchParams.delete("ler");
          window.history.replaceState(null, "", url.toString());
        }
      }
    });
    return () => { ativo = false; };
  }, [accessToken]);

  const lead = leads.find((item) => item.id === selecionado) ?? null;
  const momentoAtual = lead ? momentos.find((m) => m.codigo === lead.momento_codigo) ?? null : null;
  const eventosLead = lead ? eventos.filter((e) => e.funil_lead_id === lead.id) : [];
  const notasLead = lead ? notas.filter((n) => n.funil_lead_id === lead.id) : [];
  const atrasados = leads.filter((l) => situacaoPrazo(l.proxima_acao_em).classe === "atrasado").length;
  const atualizados = leads.filter((l) => l.ultima_acao_confirmada_em).length;
  const urgentes = leads.filter((l) => situacaoPrazo(l.proxima_acao_em).classe === "urgente").length;
  const vencemHoje = leads.filter((l) => venceHoje(l)).length;
  const leadsNovos = leads.filter((l) => esperandoPrimeiraChamada(l)).length;
  const hojeSaoPaulo = dataIsoSaoPaulo(new Date());
  const visitasDoDia = visitas
    .filter((v) => dataIsoSaoPaulo(v.inicio_em) === hojeSaoPaulo)
    .sort((a, b) => +new Date(a.inicio_em) - +new Date(b.inicio_em));
  const visitasHoje = visitasDoDia.length;

  /* MEU DIA MOSTRA SÓ O QUE ESTÁ ATRASADO (ago/2026).
     Antes a lista era `leads` inteiro ordenado por prazo: 178 linhas para 35
     obrigações reais. Atrasado, a vencer e no prazo empilhados no mesmo lugar,
     e o corretor tinha que garimpar qual era de verdade — que é exatamente o
     trabalho que o Meu Dia existe para tirar dele.

     Os quadradinhos deixaram de ser placar e viraram o filtro da lista. Quem
     quer ver o que vence mais tarde clica no quadrado, em vez de rolar por
     tudo. O número grande e o "primeiro da fila" acompanham o filtro ativo,
     senão o cabeçalho contaria uma história e a lista, outra. */
  const FILTROS_DIA = {
    atrasadas: { rotulo: "atrasadas", teste: (l: LeadFunil2) => situacaoPrazo(l.proxima_acao_em).classe === "atrasado", vazio: "Nenhuma ação atrasada. É esse o objetivo." },
    urgentes: { rotulo: "que vencem em até 2h", teste: (l: LeadFunil2) => situacaoPrazo(l.proxima_acao_em).classe === "urgente", vazio: "Nada vencendo nas próximas duas horas." },
    hoje: { rotulo: "para fazer hoje", teste: (l: LeadFunil2) => venceHoje(l), vazio: "Nada com prazo para hoje." },
    /* Inclui o pescado que ainda não foi chamado: a coluna dele continua sendo
       Pescado, mas o atalho para chamar mora aqui. Ver esperandoPrimeiraChamada. */
    novos: { rotulo: "leads para chamar", teste: (l: LeadFunil2) => esperandoPrimeiraChamada(l), vazio: "Nenhum lead esperando a primeira chamada." },
    /* Visita não é lead: não tem etapa, momento nem próxima ação. O quadro
       abre a lista das visitas de hoje em vez de filtrar `leads` — por isso o
       teste aqui nunca casa e a lista de visitas é montada em separado. */
    visitas: { rotulo: "visitas de hoje", teste: () => false, vazio: "Nenhuma visita marcada para hoje." },
  } as const;
  const filtroAtivo = FILTROS_DIA[filtroDia];
  const mostrandoVisitas = filtroDia === "visitas";
  const aFazer = mostrandoVisitas ? [] : leads.filter(filtroAtivo.teste).sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));
  const totalDoFiltro = mostrandoVisitas ? visitasHoje : aFazer.length;
  const etapasAtivas = etapas.filter((e) => e.ativo);
  const momentosAtivos = momentos.filter((m) => m.ativo !== false);

  async function executar(action: string, body: Record<string, unknown>) {
    setBusy(true); setErro(null);
    const resposta = await api(accessToken, { method: "POST", body: JSON.stringify({ action, ...body }) });
    setBusy(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível concluir a ação."); return false; }
    setModal(null); await carregar(); return true;
  }

  async function atualizar(action: string, body: Record<string, unknown>) {
    if (!lead) return false;
    setBusy(true); setErro(null);
    const resposta = await api(accessToken, { method: "PATCH", body: JSON.stringify({ action, id: lead.id, versao: lead.versao, ...body }) });
    setBusy(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível atualizar a cópia."); return false; }
    await carregar(); return true;
  }

  return (
    <div className="f2-root">
      <header className="f2-topo">
        <div className="f2-marca">
          <span className="f2-eyebrow">OPERAÇÃO OFICIAL</span>
          <h1>Funil 2.0</h1>
          <p>Carteira dos pipes antigos organizada por etapa, momento, ação e prazo.</p>
        </div>
        <div className="f2-topo-acoes">
          <span className="f2-isolado"><i /> Origens preservadas</span>
          <div className="f2-sino-wrap">
            <button type="button" className="f2-sino" onClick={() => setAvisosAbertos((v) => !v)} aria-label="Abrir notificações"><Icone nome="sino" /><b>{atrasados + urgentes}</b></button>
            {avisosAbertos && <CentralAtencao leads={leads} momentos={momentosAtivos} etapas={etapasAtivas} onAbrir={(id) => { setSelecionado(id); setAvisosAbertos(false); }} onMeuDia={() => { setAba("dia"); setAvisosAbertos(false); }} />}
          </div>
          <button type="button" className="f2-pescar" onClick={() => setModal("pescar")}>⌁ Pescar um lead</button>
        </div>
      </header>

      <nav className="f2-nav" aria-label="Visões do Funil 2.0">
        <button type="button" className={aba === "dia" ? "ativo" : ""} onClick={() => setAba("dia")}><Icone nome="dia" /> Meu Dia</button>
        <button type="button" className={aba === "quadro" ? "ativo" : ""} onClick={() => setAba("quadro")}><Icone nome="quadro" /> Funil</button>
        <button type="button" className={aba === "leads" ? "ativo" : ""} onClick={() => setAba("leads")}><Icone nome="leads" /> Todos os Leads</button>
        <button type="button" className={aba === "visitas" ? "ativo" : ""} onClick={() => setAba("visitas")}><Icone nome="visitas" /> Visitas</button>
        <button type="button" className={aba === "vendas" ? "ativo" : ""} onClick={() => setAba("vendas")}><Icone nome="vendas" /> Esteira</button>
        <button type="button" className={aba === "config" ? "ativo" : ""} onClick={() => setAba("config")}><Icone nome="config" /> Configurações</button>
        <span>Carteira operacional · Aquário fora da migração</span>
      </nav>

      {erro && <div className="f2-erro">{erro}</div>}
      {carregando && <div className="f2-loading">Carregando o Funil 2.0…</div>}

      {!carregando && aba === "quadro" && <main className="f2-main">
        <MapaOperacao
          leads={leads}
          etapas={etapasAtivas}
          momentos={momentosAtivos}
          etapaAtiva={etapaMapa}
          onEtapa={setEtapaMapa}
        />
        <section className="f2-resumo" aria-label="Resumo da carteira">
          <article><b>{leads.length}</b><span>leads na carteira</span></article>
          <article className={atrasados ? "alerta" : ""}><b>{atrasados}</b><span>ações atrasadas</span></article>
          <article><b>{atualizados}</b><span>com ação confirmada</span></article>
          <div><strong>Como ler o quadro</strong><span>Etapa organiza · momento explica · ação e prazo movem o trabalho.</span></div>
        </section>

        <section className="f2-board" aria-label="Etapas do Funil 2.0">
          {etapasAtivas.map((etapa, indice) => {
            const daEtapa = leads.filter((l) => l.etapa === etapa.codigo);
            return <div key={etapa.codigo} className={`f2-coluna etapa-${etapa.codigo}`}>
              <div className="f2-coluna-topo"><span>{indice + 1}</span><div><h2>{etapa.rotulo}</h2><p>{etapa.ajuda}</p></div><b>{daEtapa.length}</b></div>
              <div className="f2-lista">
                {daEtapa.slice(0, 100).map((item) => {
                  const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
                  const prazo = prazoDaAcao(item);
                  const cadencia = rotuloCadencia(item);
                  const tentativa = tentativaAtual(item);
                  return <article key={item.id} role="button" tabIndex={0} className={`f2-card ${selecionado === item.id ? "selecionado" : ""}`} onClick={() => setSelecionado(item.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelecionado(item.id); }}>
                    <div className="f2-card-ident"><i>{iniciais(item.nome)}</i><div><strong>{item.nome}</strong><span>{item.corretor_nome ?? "Sem corretor"}{item.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${item.instancia_rotulo}`}> · {item.instancia_rotulo}</em> : null}</span><InteresseLead lead={item} /></div></div>
                    <div className="f2-card-trio">
                      <div className="etapa"><span>ETAPA</span><b>{etapa.rotulo}</b></div>
                      <div className="momento"><span>MOMENTO</span><b>{momento?.rotulo ?? item.momento_codigo}</b></div>
                      <div className="acao"><span>{cadencia ? "CADÊNCIA" : "PRÓXIMA AÇÃO"} <em className="f2-em-obra">em implementação</em></span><b>{acaoVisivel(item)}</b></div>
                    </div>
                    <div className={`f2-prazo ${prazo.classe}`}>{prazo.rotulo}</div>
                    <div className="f2-card-botoes"><button type="button" onClick={(e) => { e.stopPropagation(); setAbrirNoChat(true); setSelecionado(item.id); }}>💬 Conversa</button>{linkWhatsapp(item.telefone) && <a href={linkWhatsapp(item.telefone)!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>WhatsApp</a>}<button type="button" className="f2-descartar" onClick={(e) => { e.stopPropagation(); setSelecionado(item.id); setModal("descartar"); }}>Descartar</button><button type="button" className="principal" onClick={(e) => { e.stopPropagation(); setSelecionado(item.id); }}>{tentativa ? `Executar tentativa ${tentativa}` : "Abrir ação"}</button></div>
                  </article>;
                })}
                {daEtapa.length > 100 && <div className="f2-vazio">Mais {daEtapa.length - 100} lead(s) nesta etapa. Consulte “Todos os Leads”.</div>}
                {daEtapa.length === 0 && <div className="f2-vazio">Nenhum lead-cópia nesta etapa.</div>}
              </div>
            </div>;
          })}
        </section>
      </main>}

      {!carregando && aba === "dia" && <main className="f2-dia">
        <section className="f2-plano">
          <div className="f2-plano-titulo"><div><span className="f2-eyebrow">SEU PLANO DE TRABALHO</span><h2>O CRM colocou o dia na ordem certa.</h2><p>Aqui embaixo só o que está atrasado. Para ver outro recorte, toque num dos quadros.</p></div><b>{totalDoFiltro}<small>{filtroAtivo.rotulo}</small></b></div>
          {aFazer[0] && <div className="f2-proxima"><div><span>PRIMEIRO DA FILA</span><h3>{aFazer[0].nome}</h3><b>{etapasAtivas.find((e) => e.codigo === aFazer[0].etapa)?.rotulo} · {momentosAtivos.find((m) => m.codigo === aFazer[0].momento_codigo)?.rotulo}</b><small>{prazoDaAcao(aFazer[0]).rotulo}</small></div><button type="button" onClick={() => setSelecionado(aFazer[0].id)}>Atender agora</button></div>}
          {/* Os quadros são o filtro da lista, não um placar: cada um abre
              embaixo a lista do que ele conta, para o corretor escolher. */}
          <div className="f2-indicadores">
            <button type="button" className={`vermelho${filtroDia === "atrasadas" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "atrasadas"} onClick={() => trocarFiltroDia("atrasadas")}><b>{atrasados}</b><span>ações atrasadas</span></button>
            <button type="button" className={`amarelo${filtroDia === "urgentes" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "urgentes"} onClick={() => trocarFiltroDia("urgentes")}><b>{urgentes}</b><span>vencem em até 2h</span></button>
            <button type="button" className={`laranja${filtroDia === "hoje" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "hoje"} onClick={() => trocarFiltroDia("hoje")}><b>{vencemHoje}</b><span>para fazer hoje</span></button>
            <button type="button" className={`roxo${filtroDia === "novos" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "novos"} onClick={() => trocarFiltroDia("novos")}><b>{leadsNovos}</b><span>leads para chamar</span></button>
            <button type="button" className={`verde${filtroDia === "visitas" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "visitas"} onClick={() => trocarFiltroDia("visitas")}><b>{visitasHoje}</b><span>visitas do dia</span></button>
          </div>
          <div className="f2-como"><span><i>1</i><b>Siga a ordem</b><small>O primeiro item é o mais urgente.</small></span><span><i>2</i><b>Execute a ação</b><small>WhatsApp, visita, produto ou retorno.</small></span><span><i>3</i><b>Conclua no CRM</b><small>A Sara relê e prepara o próximo passo.</small></span></div>
        </section>
        <div className="f2-dia-cab"><div><span className="f2-eyebrow">{mostrandoVisitas ? "AGENDA DO DIA" : "OBRIGAÇÕES ORDENADAS"}</span><h2>Seu dia, sem adivinhação.</h2><p>{filtroDia === "atrasadas" ? "Só o que já passou do prazo, do mais antigo para o mais recente." : `Mostrando ${filtroAtivo.rotulo}. Toque em “ações atrasadas” para voltar.`}</p></div><b>{totalDoFiltro} {filtroAtivo.rotulo}</b></div>
        <div className="f2-dia-colunas">{mostrandoVisitas ? <><span>Cliente</span><span>Imóvel</span><span>Situação</span><span>Horário</span><span></span></> : <><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Tempo</span><span></span></>}</div>
        <div className="f2-dia-lista">
          {/* Visita entra na mesma lista, com as colunas trocadas: o corretor
              continua vendo uma fila só e clicando para abrir o cliente. */}
          {mostrandoVisitas && visitasDoDia.slice(0, limiteDia).map((visita, index) => {
            const leadDaVisita = leads.find((l) => l.id === visita.funil_lead_id);
            const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_OPERACAO, hour: "2-digit", minute: "2-digit" }).format(new Date(visita.inicio_em));
            const situacao: Record<string, string> = { agendada: "Agendada", confirmada: "Confirmada", realizada: "Realizada", cancelada: "Cancelada", nao_compareceu: "Não compareceu" };
            return <button key={visita.id} type="button" className="f2-dia-item" disabled={!leadDaVisita} onClick={() => leadDaVisita && setSelecionado(leadDaVisita.id)}>
              <span className="f2-dia-ordem">{index + 1}</span><div><strong>{leadDaVisita?.nome ?? "Lead removido"}</strong><small>{leadDaVisita?.corretor_nome ?? "Sem corretor"}</small></div><div><span>IMÓVEL</span><b>{visita.imovel || "—"}</b></div><div><span>SITUAÇÃO</span><b>{situacao[visita.status] ?? visita.status}</b></div><em className={visita.status === "cancelada" || visita.status === "nao_compareceu" ? "atrasado" : "no-prazo"}>{hora}</em><i>{leadDaVisita ? "Abrir cliente" : "Sem ficha"}</i>
            </button>;
          })}
          {mostrandoVisitas && visitasHoje > limiteDia && <button type="button" className="f2-dia-mais" onClick={() => setLimiteDia((atual) => atual + 50)}>Mostrar mais 50 · ainda faltam {visitasHoje - limiteDia}</button>}
          {aFazer.slice(0, limiteDia).map((item, index) => {
            const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
            const prazo = prazoDaAcao(item);
            const cadencia = rotuloCadencia(item);
            const tentativa = tentativaAtual(item);
            return <button key={item.id} type="button" className="f2-dia-item" onClick={() => setSelecionado(item.id)}>
              <span className="f2-dia-ordem">{index + 1}</span><div><strong>{item.nome}</strong><small>{item.corretor_nome ?? "Sem corretor"}{item.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${item.instancia_rotulo}`}> · {item.instancia_rotulo}</em> : null}</small><InteresseLead lead={item} /></div><div><span>ETAPA</span><b>{etapasAtivas.find((e) => e.codigo === item.etapa)?.rotulo}</b></div><div><span>{cadencia ? "MOMENTO · CADÊNCIA" : "MOMENTO"}</span><b>{momento?.rotulo}</b></div><em className={prazo.classe}>{prazo.rotulo}</em><i>{tentativa ? `Enviar tentativa ${tentativa}` : "Executar ação"}</i>
            </button>;
          })}
          {aFazer.length > limiteDia && <button type="button" className="f2-dia-mais" onClick={() => setLimiteDia((atual) => atual + 50)}>Mostrar mais 50 · ainda faltam {aFazer.length - limiteDia}</button>}
          {totalDoFiltro === 0 && <div className="f2-dia-vazio"><b>{filtroDia === "atrasadas" ? "Seu Meu Dia está em dia." : "Nada neste recorte."}</b><span>{filtroAtivo.vazio}</span></div>}
        </div>
      </main>}

      {!carregando && aba === "leads" && <TodosLeads leads={leads} momentos={momentosAtivos} etapas={etapasAtivas} accessToken={accessToken} busy={busy} onAbrir={(id) => setSelecionado(id)} onPescar={() => setModal("pescar")} onTrazer={(leadId, etapa, momento) => executar("trazerLeadAntigo", { leadId, etapa, momento })} />}
      {!carregando && aba === "visitas" && <PipeVisitas visitas={visitas} leads={leads} busy={busy} onNova={() => setModal("visita")} onSalvar={(visita) => void executar("salvarVisita", visita)} />}
      {/* Só a esteira. O CRM antigo inteiro (cabeçalho, barra de visões, filtros
          e funil) não entra aqui — o Funil 2.0 já é a navegação da operação. */}
      {!carregando && aba === "vendas" && <main className="f2-pagina f2-esteira-oficial"><CabecalhoPagina titulo="Esteira de Vendas 3.0" texto="A mesma estrutura oficial de contratos, documentação, responsáveis, prazos e valores — sem uma segunda esteira desconectada." /><SalesProcessView accessToken={accessToken} sessionRole="admin" /></main>}
      {!carregando && aba === "config" && <Configuracoes etapas={etapas} momentos={momentos} operacao={operacao} sara={sara} busy={busy} onEtapa={(dados) => executar("configurarEtapa", dados)} onMomento={(dados) => executar("configurarMomento", dados)} onOperacao={(dados) => executar("configurarOperacao", dados)} />}

      {modal === "pescar" && <ModalPescar candidatos={aquario} busy={busy} onFechar={() => setModal(null)} onPescar={(negocioId) => void executar("pescar", { negocioId })} />}
      {modal === "visita" && <ModalVisita leads={leads} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarVisita", dados)} />}
      {modal === "negociacao" && <ModalNegociacao leads={leads} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarNegociacao", dados)} />}
      {modal === "descartar" && lead && <ModalDescartar nome={lead.nome} busy={busy} onFechar={() => setModal(null)} onDescartar={(motivo, detalhe) => { void atualizar("descartar", { motivo, detalhe }).then((ok) => { if (ok) { setModal(null); setSelecionado(null); } }); }} />}

      {lead && momentoAtual && <Detalhe key={`${lead.id}:${lead.versao}`}
        accessToken={accessToken} lead={lead} momento={momentoAtual} momentos={momentosAtivos} etapas={etapasAtivas} eventos={eventosLead} notas={notasLead} tagCatalogo={tagCatalogo} busy={busy}
        abrirNoChat={abrirNoChat}
        onFechar={() => { setSelecionado(null); setAbrirNoChat(false); }}
        onMomento={(codigo, prazo, obs) => void atualizar("atualizarMomento", { momentoCodigo: codigo, prazoCombinado: prazo || null, observacao: obs })}
        onConfirmar={(fonte, obs) => void atualizar("confirmarAcao", { fonte, observacao: obs })}
        onAgendarVisita={() => setModal("visita")}
        onGerarNegociacao={() => setModal("negociacao")}
        onDescartar={() => setModal("descartar")}
        onSalvarNota={(texto) => executar("salvarNota", { leadId: lead.id, texto })}
        onTagSalva={() => void carregar()}
      />}
      <footer className="f2-rodape">Sessão: {profile.name} · somente administradores · origens dos pipes antigos preservadas</footer>
    </div>
  );
}

function MapaOperacao({ leads, etapas, momentos, etapaAtiva, onEtapa }: {
  leads: LeadFunil2[];
  etapas: EtapaConfigFunil2[];
  momentos: MomentoFunil2[];
  etapaAtiva: string;
  onEtapa: (etapa: string) => void;
}) {
  const etapaSelecionada = etapas.find((etapa) => etapa.codigo === etapaAtiva) ?? etapas[0];
  if (!etapaSelecionada) return null;

  const momentosDaEtapa = momentos
    .filter((momento) => momento.etapa === etapaSelecionada.codigo)
    .sort((a, b) => a.ordem - b.ordem);

  return <section className="f2-mapa" aria-label="Mapa da operação do Funil 2.0">
    <header className="f2-mapa-cabecalho">
      <div><span className="f2-eyebrow">MAPA DA OPERAÇÃO</span><h2>Etapa organiza. Momento explica. Ação e prazo movem o dia.</h2></div>
      <p>O corretor não precisa interpretar: o CRM mostra o que está acontecendo, o que fazer e até quando.</p>
    </header>

    <nav className="f2-mapa-etapas" aria-label="Etapas oficiais do funil">
      {etapas.map((etapa, indice) => {
        const ativa = etapa.codigo === etapaSelecionada.codigo;
        return <button key={etapa.codigo} type="button" className={ativa ? "ativa" : ""} aria-pressed={ativa} onClick={() => onEtapa(etapa.codigo)}>
          <small>ETAPA {indice + 1}</small><strong>{etapa.rotulo}</strong><b>{leads.filter((lead) => lead.etapa === etapa.codigo).length}</b>
        </button>;
      })}
    </nav>

    <div className="f2-mapa-detalhe">
      <div className="f2-mapa-intro"><span>VOCÊ ESTÁ VENDO</span><strong>{etapaSelecionada.rotulo}</strong><small>{etapaSelecionada.ajuda}</small></div>
      <div className="f2-mapa-momentos">
        {momentosDaEtapa.map((momento) => <article key={momento.codigo}>
          <i>{momento.ordem}</i>
          <div><span>MOMENTO</span><strong>{momento.rotulo}</strong><small>{momento.acao_rotulo}</small></div>
          <b>{momento.prazo_rotulo || (momento.prazo_minutos ? `até ${duracao(momento.prazo_minutos)}` : "data combinada")}</b>
        </article>)}
        {momentosDaEtapa.length === 0 && <p>Nenhum momento ativo nesta etapa.</p>}
      </div>
    </div>
  </section>;
}

function CentralAtencao({ leads, momentos, etapas, onAbrir, onMeuDia }: {
  leads: LeadFunil2[]; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[];
  onAbrir: (id: string) => void; onMeuDia: () => void;
}) {
  const ordenados = [...leads].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));
  const atrasados = ordenados.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "atrasado");
  const urgentes = ordenados.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "urgente");
  const hoje = ordenados.filter((lead) => venceHoje(lead));
  const novos = ordenados.filter((lead) => esperandoPrimeiraChamada(lead));
  return <div className="f2-avisos-pop">
    <span className="f2-eyebrow">CENTRAL DE ATENÇÃO</span><h3>O que pede ação agora</h3>
    <div className="f2-avisos-resumo"><article className="vermelho"><b>{atrasados.length}</b><span>atrasadas</span></article><article className="amarelo"><b>{urgentes.length}</b><span>até 2h</span></article><article className="roxo"><b>{novos.length}</b><span>para chamar</span></article><article className="verde"><b>{hoje.length}</b><span>para hoje</span></article></div>
    <div className="f2-avisos-lista">{ordenados.slice(0, 5).map((lead) => {
      const prazo = prazoDaAcao(lead);
      return <button type="button" key={lead.id} onClick={() => onAbrir(lead.id)}><span><b>{lead.nome}</b><small>{etapas.find((etapa) => etapa.codigo === lead.etapa)?.rotulo} · {momentos.find((momento) => momento.codigo === lead.momento_codigo)?.rotulo}</small></span><em className={prazo.classe}>{acaoVisivel(lead)} · {prazo.rotulo}</em></button>;
    })}</div>
    <button type="button" className="f2-avisos-dia" onClick={onMeuDia}>Abrir Meu Dia completo</button>
  </div>;
}

/* Um lead da carteira antiga: já foi trabalhado (tem dono) mas nunca virou
   card no Funil 2.0. Vem do endpoint /api/funil2/carteira, não do payload
   principal — são 1.515 e ninguém quer carregá-los a cada abertura de tela. */
type LeadCarteiraAntiga = {
  lead_id: number; negocio_id: number | null; nome: string | null; telefone: string | null;
  corretor_id: number | null; corretor_nome: string | null;
  criado_em: string; ultima_mensagem_em: string | null; mensagens: number;
};

function TodosLeads({ leads, momentos, etapas, accessToken, busy, onAbrir, onPescar, onTrazer }: { leads: LeadFunil2[]; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; accessToken: string; busy: boolean; onAbrir: (id: string) => void; onPescar: () => void; onTrazer: (leadId: number, etapa: string, momento: string) => Promise<boolean> }) {
  const [filtro, setFiltro] = useState("ativos");
  const [situacao, setSituacao] = useState("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 50;
  /* A carteira antiga entra no MESMO campo de busca, numa seção própria abaixo
     dos cards. O corretor não deveria precisar saber em qual base o cliente
     mora para conseguir achá-lo — mas precisa ver que aquele resultado ainda
     não está no funil, senão vai procurar a ação dele e não encontrar. */
  const [carteira, setCarteira] = useState<LeadCarteiraAntiga[]>([]);
  const [buscandoCarteira, setBuscandoCarteira] = useState(false);
  const [alvo, setAlvo] = useState<LeadCarteiraAntiga | null>(null);
  const atrasados = leads.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "atrasado").length;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtrados = leads.filter((lead) => {
    if (filtro === "ativos" && lead.etapa === "legado") return false;
    if (filtro !== "ativos" && lead.etapa !== filtro) return false;
    const prazo = situacaoPrazo(lead.proxima_acao_em).classe;
    if (situacao !== "todas" && prazo !== situacao) return false;
    if (!termo) return true;
    const telefone = (lead.telefone ?? "").replace(/\D/g, "");
    const termoNumerico = termo.replace(/\D/g, "");
    return lead.nome.toLocaleLowerCase("pt-BR").includes(termo)
      || (termoNumerico.length >= 3 && telefone.includes(termoNumerico));
  });
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const exibidos = filtrados.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  /* Espera 350ms depois da última tecla antes de ir ao banco: sem isso cada
     letra digitada vira uma consulta, e "Maria" custaria cinco.

     Todo setState acontece dentro do timer, nenhum no corpo do efeito: assim
     não há render em cascata a cada tecla. A limpeza cancela o timer e marca
     `vivo=false`, então resposta de busca antiga não sobrescreve a nova. */
  useEffect(() => {
    let vivo = true;
    const termoBusca = busca.trim();
    const t = window.setTimeout(() => {
      if (!vivo) return;
      if (termoBusca.length < 3) { setCarteira([]); setBuscandoCarteira(false); return; }
      setBuscandoCarteira(true);
      void fetch(`/api/funil2/carteira?q=${encodeURIComponent(termoBusca)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json() as Promise<{ leads?: LeadCarteiraAntiga[] }>)
        .then((json) => { if (vivo) setCarteira(json.leads ?? []); })
        /* Falha aqui não pode derrubar a tela: a lista do 2.0 continua
           funcionando, só a seção da carteira antiga fica vazia. */
        .catch(() => { if (vivo) setCarteira([]); })
        .finally(() => { if (vivo) setBuscandoCarteira(false); });
    }, 350);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [busca, accessToken]);
  return <main className="f2-pagina"><CabecalhoPagina titulo="Todos os Leads" texto="A mesma leitura operacional do Funil 2.0: cliente, etapa, momento, ação e prazo — sem informações soltas." acao="Pescar um lead" onAcao={onPescar} />
    <div className="f2-leads-busca"><label><span>Buscar lead</span><input value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} placeholder="Nome ou telefone" aria-label="Buscar lead por nome ou telefone" /></label><label><span>Situação do prazo</span><select value={situacao} onChange={(event) => { setSituacao(event.target.value); setPagina(1); }}><option value="todas">Todos os prazos</option><option value="atrasado">Atrasados</option><option value="urgente">Vencem em até 2h</option><option value="no-prazo">No prazo</option></select></label><b>{filtrados.length} encontrado(s)</b></div>
    <div className="f2-leads-filtros"><button type="button" className={filtro === "ativos" ? "ativo" : ""} onClick={() => { setFiltro("ativos"); setPagina(1); }}>Ativos · {leads.filter((lead) => lead.etapa !== "legado").length}</button>{etapas.map((etapa) => <button type="button" className={filtro === etapa.codigo ? "ativo" : ""} onClick={() => { setFiltro(etapa.codigo); setPagina(1); }} key={etapa.codigo}>{etapa.rotulo} · {leads.filter((lead) => lead.etapa === etapa.codigo).length}</button>)}<span>{atrasados} atrasado(s)</span></div>
    <div className="f2-tabela-cab"><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Próxima ação</span><span>Prazo</span><span></span></div>
    <div className="f2-tabela f2-tabela-compacta">{exibidos.map((lead) => { const prazo = prazoDaAcao(lead); const whatsapp = linkWhatsapp(lead.telefone); return <article key={lead.id} className={`f2-lead-linha prazo-${prazo.classe}`}><div className="f2-nome"><i>{iniciais(lead.nome)}</i><span><b>{lead.nome}</b><small>{lead.corretor_nome ?? "Responsável não definido"}{lead.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${lead.instancia_rotulo}`}> · {lead.instancia_rotulo}</em> : null}</small><InteresseLead lead={lead} /></span></div><span className="f2-lead-chip etapa"><i />{etapas.find((e) => e.codigo === lead.etapa)?.rotulo}</span><span className="f2-lead-chip momento">{momentos.find((m) => m.codigo === lead.momento_codigo)?.rotulo}</span><strong className="f2-lead-acao">{acaoVisivel(lead)}</strong><em className={prazo.classe}>{prazo.rotulo}</em><div className="f2-lead-acoes"><button type="button" onClick={() => onAbrir(lead.id)}>💬 Chat</button>{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}<button type="button" className="primario" onClick={() => onAbrir(lead.id)}>Abrir</button></div></article>; })}{filtrados.length === 0 && <div className="f2-sem-resultado"><b>Nenhum lead encontrado.</b><span>Revise a busca ou os filtros selecionados.</span></div>}</div>
    {filtrados.length > porPagina && <div className="f2-paginacao"><button type="button" disabled={paginaSegura === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))}>← Anterior</button><span>Página {paginaSegura} de {totalPaginas}</span><button type="button" disabled={paginaSegura === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}>Próxima →</button></div>}

    {/* Carteira antiga: mesma busca, seção separada. Só aparece quando há algo
        a mostrar — seção vazia permanente vira ruído que ninguém mais lê. */}
    {busca.trim().length >= 3 && (buscandoCarteira || carteira.length > 0) && <section className="f2-carteira-antiga">
      <header>
        <div><span className="f2-eyebrow">DA SUA CARTEIRA ANTIGA</span><h3>Fora do Funil 2.0</h3><p>Clientes que você já trabalhou e que nunca viraram card aqui. Traga para o funil quando voltar a atender.</p></div>
        <b>{buscandoCarteira ? "buscando…" : `${carteira.length} encontrado(s)`}</b>
      </header>
      {carteira.map((item) => <article key={item.lead_id} className="f2-carteira-linha">
        <div className="f2-nome"><i>{iniciais(item.nome ?? "?")}</i><span><b>{item.nome ?? "Sem nome"}</b><small>{item.corretor_nome ?? "Sem responsável"}{item.telefone ? ` · ${item.telefone}` : ""}</small></span></div>
        <span className="f2-carteira-hist">{item.mensagens > 0 ? `${item.mensagens} mensagem(ns) · último contato ${dataCurta(item.ultima_mensagem_em ?? item.criado_em)}` : "Sem conversa registrada"}</span>
        <div className="f2-lead-acoes">
          {linkWhatsapp(item.telefone) && <a href={linkWhatsapp(item.telefone)!} target="_blank" rel="noreferrer">WhatsApp</a>}
          <button type="button" className="primario" onClick={() => setAlvo(item)}>Trazer para o funil</button>
        </div>
      </article>)}
      {!buscandoCarteira && carteira.length === 0 && <div className="f2-sem-resultado"><b>Nada na carteira antiga.</b><span>Nenhum cliente seu fora do Funil 2.0 bate com essa busca.</span></div>}
    </section>}

    {alvo && <ModalTrazerLeadAntigo alvo={alvo} etapas={etapas} momentos={momentos} busy={busy} onFechar={() => setAlvo(null)} onConfirmar={async (etapa, momento) => { const ok = await onTrazer(alvo.lead_id, etapa, momento); if (ok) setAlvo(null); }} />}
  </main>;
}

/* Escolher etapa e momento na hora de trazer, e não cair sempre num padrão.
   Cliente que volta pode estar em qualquer ponto da conversa — quem sabe onde
   ele parou é o corretor que atendeu, não o sistema.

   A etapa "Lead novo" fica fora de propósito: seu único momento é a primeira
   abordagem, e cliente que já conversou não está em primeira abordagem. Deixar
   entrar assim faria o Meu Dia cobrar um contato que já aconteceu. A trava
   também existe no banco — aqui ela só evita oferecer o que vai ser recusado. */
function ModalTrazerLeadAntigo({ alvo, etapas, momentos, busy, onFechar, onConfirmar }: { alvo: LeadCarteiraAntiga; etapas: EtapaConfigFunil2[]; momentos: MomentoFunil2[]; busy: boolean; onFechar: () => void; onConfirmar: (etapa: string, momento: string) => void }) {
  const etapasPermitidas = etapas.filter((e) => e.codigo !== "novo");
  const [etapa, setEtapa] = useState(etapasPermitidas[0]?.codigo ?? "");
  const momentosDaEtapa = momentos.filter((m) => m.etapa === etapa && m.codigo !== "PRIMEIRA_ABORDAGEM");
  const [momento, setMomento] = useState(momentosDaEtapa[0]?.codigo ?? "");
  /* Trocar de etapa invalida o momento escolhido: cada etapa tem os seus. */
  const trocarEtapa = (codigo: string) => {
    setEtapa(codigo);
    const primeiro = momentos.find((m) => m.etapa === codigo && m.codigo !== "PRIMEIRA_ABORDAGEM");
    setMomento(primeiro?.codigo ?? "");
  };
  return <Modal titulo="Trazer para o Funil 2.0" texto={`${alvo.nome ?? "Este cliente"} volta a aparecer no seu funil na etapa que você escolher. O histórico completo da conversa fica visível na ficha.`} onFechar={onFechar}>
    <div className="f2-form-grid">
      <label>Etapa<select value={etapa} onChange={(event) => trocarEtapa(event.target.value)}>{etapasPermitidas.map((e) => <option value={e.codigo} key={e.codigo}>{e.rotulo}</option>)}</select></label>
      <label>Momento<select value={momento} onChange={(event) => setMomento(event.target.value)}>{momentosDaEtapa.map((m) => <option value={m.codigo} key={m.codigo}>{m.rotulo}</option>)}</select></label>
    </div>
    <p className="f2-nota-modal">“Lead novo” não aparece aqui: quem já conversou com você não está em primeira abordagem.</p>
    <button type="button" className="f2-modal-confirmar" disabled={busy || !etapa || !momento} onClick={() => onConfirmar(etapa, momento)}>{busy ? "Trazendo…" : "Trazer para o funil"}</button>
  </Modal>;
}

function PipeVisitas({ visitas, leads, busy, onNova, onSalvar }: { visitas: VisitaFunil2[]; leads: LeadFunil2[]; busy: boolean; onNova: () => void; onSalvar: (v: Record<string, unknown>) => void }) {
  const colunas = [
    { codigo: "agendada", rotulo: "Agendadas" }, { codigo: "confirmada", rotulo: "Confirmadas" },
    { codigo: "realizada", rotulo: "Realizadas" }, { codigo: "encerrada", rotulo: "Canceladas / faltou" },
  ];
  return <main className="f2-pagina"><CabecalhoPagina titulo="Pipe de Visitas" texto="Agendada fica no atendimento; realizada exige feedback; cancelada ou falta volta para tentativa de agendamento." acao="+ Nova visita" onAcao={onNova} />
    <section className="f2-visita-regra"><b>Fluxo automático</b><span>Agendada → confirmar 24h antes</span><span>Realizada → feedback em até 2h</span><span>Cancelada/faltou → remarcar em até 12h</span></section>
    <section className="f2-pipe">{colunas.map((coluna) => { const itens = visitas.filter((v) => coluna.codigo === "encerrada" ? ["cancelada","nao_compareceu"].includes(v.status) : v.status === coluna.codigo); return <div key={coluna.codigo}><header><h3>{coluna.rotulo}</h3><b>{itens.length}</b></header>{itens.map((visita) => <VisitaCard key={visita.id} visita={visita} lead={leads.find((l) => l.id === visita.funil_lead_id)} busy={busy} onSalvar={onSalvar} />)}{itens.length === 0 && <p className="f2-pipe-vazio">Nenhuma visita.</p>}</div>; })}</section>
  </main>;
}

/* VISITA SE CORRIGE NA PROPRIA VISITA.
   Ate aqui o cartao so deixava mudar o status e o feedback. Quem marcava a hora
   errada ou trocava o imovel nao tinha como consertar: criava uma segunda
   visita e o pipe passava a mostrar duas para o mesmo cliente. Como a API ja
   faz upsert por id, mandar data e imovel editados corrige a mesma visita. */
function VisitaCard({ visita, lead, busy, onSalvar }: { visita: VisitaFunil2; lead?: LeadFunil2; busy: boolean; onSalvar: (v: Record<string, unknown>) => void }) {
  const [status, setStatus] = useState(visita.status);
  const [feedback, setFeedback] = useState(visita.observacao ?? "");
  const [inicio, setInicio] = useState(paraCampoLocal(visita.inicio_em));
  const [imovel, setImovel] = useState(visita.imovel ?? "");
  const precisaFeedback = status === "realizada";
  return <article><span>{dataCurta(visita.inicio_em)}</span><h4>{lead?.nome ?? "Lead removido"}</h4><p>{visita.imovel}</p>
    <input type="datetime-local" style={CAMPO_VISITA} disabled={busy} value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Data e hora da visita" />
    <input type="text" style={CAMPO_VISITA} disabled={busy} value={imovel} onChange={(e) => setImovel(e.target.value)} maxLength={120} placeholder="Imóvel ou unidade" aria-label="Imóvel da visita" />
    <select disabled={busy} value={status} onChange={(e) => setStatus(e.target.value as VisitaFunil2["status"])}><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option><option value="nao_compareceu">Não compareceu</option></select>
    {precisaFeedback && <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback obrigatório: interesse, objeção e próximo passo" maxLength={500} />}
    <button type="button" disabled={busy || !inicio || (precisaFeedback && feedback.trim().length < 10)} onClick={() => onSalvar({ id: visita.id, leadId: visita.funil_lead_id, inicioEm: inicio, imovel: imovel.trim() || visita.imovel, status, observacao: feedback || null, empreendimentoId: visita.empreendimento_id ?? null, unidade: visita.unidade ?? null, comGerente: visita.com_gerente === true, gerenteId: visita.gerente_id ?? null, fimEm: visita.fim_em ?? null })}>{busy ? "Salvando…" : precisaFeedback && !visita.feedback_em ? "Registrar resultado" : "Salvar atualização"}</button>
    {visita.status === "realizada" && <small>{visita.feedback_em ? "Feedback concluído" : "Feedback pendente — novos leads podem ser bloqueados"}</small>}
  </article>;
}

function Configuracoes({ etapas, momentos, operacao, sara, busy, onEtapa, onMomento, onOperacao }: { etapas: EtapaConfigFunil2[]; momentos: MomentoFunil2[]; operacao: OperacaoConfigFunil2 | null; sara: SaraStatusFunil2; busy: boolean; onEtapa: (e: Record<string, unknown>) => Promise<boolean>; onMomento: (m: Record<string, unknown>) => Promise<boolean>; onOperacao: (o: Record<string, unknown>) => Promise<boolean> }) {
  const primeiraEtapa = etapas.find((e) => e.ativo)?.codigo ?? "";
  const ordemAntesDoPescado = etapas.find((e) => e.codigo === "pescado")?.ordem
    ?? Math.max(0, ...etapas.filter((e) => e.ativo).map((e) => e.ordem)) + 1;
  const proximaOrdemMomento = (codigoEtapa: string) => Math.max(0, ...momentos.filter((m) => m.etapa === codigoEtapa).map((m) => m.ordem)) + 1;
  const etapaVazia = { codigo:"",rotulo:"",ajuda:"",ordem:ordemAntesDoPescado,ativo:true };
  const momentoVazio = { codigo:"",etapa:primeiraEtapa,rotulo:"",descricao:"",acaoRotulo:"",prazoHoras:24,semPrazo:false,ordem:proximaOrdemMomento(primeiraEtapa),exigeDapi:true,ativo:true };
  const [editor, setEditor] = useState<"etapa" | "momento" | null>(null);
  const [filtroMomento, setFiltroMomento] = useState("todos");
  const [etapa, setEtapa] = useState(etapaVazia);
  const [momento, setMomento] = useState(momentoVazio);
  const [regra, setRegra] = useState({
    horarioInicio: operacao?.horario_inicio.slice(0,5) ?? "09:30", horarioFim: operacao?.horario_fim.slice(0,5) ?? "18:30",
    presencaTtlMin: operacao?.presenca_ttl_min ?? 15, primeiraAbordagemMin: operacao?.primeira_abordagem_min ?? 5,
    feedbackVisitaMin: operacao?.feedback_visita_min ?? 120, notificacaoUrgenteMin: operacao?.notificacao_urgente_min ?? 120,
    pesoPrimeiraAbordagem: operacao?.peso_primeira_abordagem ?? 30, pesoAcoesPrazo: operacao?.peso_acoes_prazo ?? 30,
    pesoFeedbackVisita: operacao?.peso_feedback_visita ?? 20, pesoPresencaDapi: operacao?.peso_presenca_dapi ?? 10,
    pesoCoerenciaSara: operacao?.peso_coerencia_sara ?? 10, suspensaoNivel1H: operacao?.suspensao_nivel_1_h ?? 24,
    suspensaoNivel2H: operacao?.suspensao_nivel_2_h ?? 48, suspensaoNivel3H: operacao?.suspensao_nivel_3_h ?? 72,
  });
  const momentosVisiveis = filtroMomento === "todos" ? momentos : momentos.filter((m) => m.etapa === filtroMomento);
  return <main className="f2-pagina f2-config-pagina"><CabecalhoPagina titulo="Configurações da operação" texto="Etapas, condutas, prazos e regras oficiais em uma única tela." />
    <section className="f2-sara-status f2-sara-status-compacto"><div><span className="f2-eyebrow">PAPEL DA SARA</span><h3>Ela lê, classifica e fiscaliza.</h3><details><summary>Como funciona</summary><p>Quando o D-API registra mensagem nova, a Sara relê a conversa, escolhe um momento oficial e recalcula ação e prazo. Ela está em <b>{sara.modo ?? "estado indisponível"}</b>; o runner está <b>{sara.runnerAtivo ? "ligado" : "desligado"}</b>. Ela não envia por você.</p></details></div><strong className={sara.reavaliacaoAutomaticaFunil2 ? "ativo" : "pendente"}>{sara.reavaliacaoAutomaticaFunil2 ? `Conectado · lote ${sara.loteFunil2 ?? "—"}` : "Reavaliação automática do Funil 2.0 ainda não conectada"}</strong></section>
    <section className="f2-config-grid">
      <div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">ETAPAS</span><h3>Colunas do funil</h3><small>{etapas.filter((e) => e.ativo).length} ativas</small></div><button type="button" onClick={() => { setEtapa(etapaVazia); setEditor("etapa"); }}>+ Criar</button></div>
        <div className="f2-config-lista">{etapas.map((e) => <article key={e.codigo} className={!e.ativo ? "inativo" : ""}><b>{e.ordem}</b><span><strong>{e.rotulo}</strong><small>{e.ajuda || "Sem descrição"}</small></span><button type="button" onClick={() => { setEtapa({...e}); setEditor("etapa"); }}>Editar</button><button type="button" disabled={busy || !e.ativo} title="Etapas com leads ou momentos ativos não podem ser desativadas" onClick={() => void onEtapa({...e,ativo:false})}>Desativar</button></article>)}</div>
      </div>
      <div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">MOMENTOS</span><h3>Condutas e prazos</h3><select aria-label="Filtrar momentos por etapa" value={filtroMomento} onChange={(e) => setFiltroMomento(e.target.value)}><option value="todos">Todas as etapas</option>{etapas.filter((e) => e.ativo).map((e) => <option key={e.codigo} value={e.codigo}>{e.rotulo}</option>)}</select></div><button type="button" onClick={() => { setMomento(momentoVazio); setEditor("momento"); }}>+ Criar</button></div>
        <div className="f2-config-lista">{momentosVisiveis.map((m) => <article key={m.codigo} className={m.ativo === false ? "inativo" : ""}><b>{m.ordem}</b><span><strong>{m.rotulo}</strong><small>{etapas.find((e) => e.codigo === m.etapa)?.rotulo ?? m.etapa} · {m.acao_rotulo} · {m.prazo_rotulo}</small></span><button type="button" onClick={() => { setMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoHoras:(m.prazo_minutos ?? 1440)/60,semPrazo:m.prazo_minutos == null,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:m.ativo !== false}); setEditor("momento"); }}>Editar</button><button type="button" disabled={busy || m.ativo === false} title="Momentos usados por leads não podem ser desativados" onClick={() => void onMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoMinutos:m.prazo_minutos,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:false})}>Desativar</button></article>)}</div>
      </div>
    </section>
    <details className="f2-config-operacao"><summary><span><span className="f2-eyebrow">REGRAS DA OPERAÇÃO</span><b>Horários, avisos e suspensões</b></span><em>Abrir configurações</em></summary><div className="f2-config-operacao-intro"><p><b>Automações executa a distribuição.</b> Aqui ficam os limites que CRM e aplicativo respeitam; esta tela nunca liga abordagem automática.</p><a href="/automacoes">Abrir distribuição em Automações →</a></div><form onSubmit={(event) => { event.preventDefault(); void onOperacao(regra); }}>
      <fieldset><legend>Distribuição manual</legend><label>Início oficial<input type="time" value={regra.horarioInicio} onChange={(e)=>setRegra({...regra,horarioInicio:e.target.value})}/></label><label>Fim oficial<input type="time" value={regra.horarioFim} onChange={(e)=>setRegra({...regra,horarioFim:e.target.value})}/></label><label>Presença válida (min)<input type="number" min="5" max="120" value={regra.presencaTtlMin} onChange={(e)=>setRegra({...regra,presencaTtlMin:Number(e.target.value)})}/></label><label>Primeira abordagem (min)<input type="number" min="1" max="30" value={regra.primeiraAbordagemMin} onChange={(e)=>setRegra({...regra,primeiraAbordagemMin:Number(e.target.value)})}/></label></fieldset>
      <fieldset><legend>Visitas e avisos</legend><label>Feedback da visita (min)<input type="number" min="30" max="1440" value={regra.feedbackVisitaMin} onChange={(e)=>setRegra({...regra,feedbackVisitaMin:Number(e.target.value)})}/></label><label>Aviso urgente (min)<input type="number" min="15" max="1440" value={regra.notificacaoUrgenteMin} onChange={(e)=>setRegra({...regra,notificacaoUrgenteMin:Number(e.target.value)})}/></label><label>Suspensão 1 (h)<input type="number" value={regra.suspensaoNivel1H} onChange={(e)=>setRegra({...regra,suspensaoNivel1H:Number(e.target.value)})}/></label><label>Suspensão 2 (h)<input type="number" value={regra.suspensaoNivel2H} onChange={(e)=>setRegra({...regra,suspensaoNivel2H:Number(e.target.value)})}/></label><label>Suspensão 3 (h)<input type="number" value={regra.suspensaoNivel3H} onChange={(e)=>setRegra({...regra,suspensaoNivel3H:Number(e.target.value)})}/></label></fieldset>
      <button type="submit" disabled={busy}>Salvar regras da operação</button>
    </form></details>
    {editor === "etapa" && <Modal titulo={etapa.codigo ? "Editar etapa" : "Nova etapa"} texto="A ordem reorganiza as demais colunas automaticamente, sem colisões." onFechar={() => setEditor(null)}><form className="f2-config-modal-form" onSubmit={(ev) => { ev.preventDefault(); void onEtapa(etapa).then((ok) => { if (ok) setEditor(null); }); }}><label>Código<input required disabled={Boolean(etapa.codigo)} value={etapa.codigo} onChange={(e) => setEtapa({...etapa,codigo:e.target.value.toLowerCase().replace(/\W+/g,"_")})}/></label><label>Nome<input required value={etapa.rotulo} onChange={(e) => setEtapa({...etapa,rotulo:e.target.value})}/></label><label className="largo">Descrição<input value={etapa.ajuda} onChange={(e) => setEtapa({...etapa,ajuda:e.target.value})}/></label><label>Posição no funil<input type="number" min="1" max="50" value={etapa.ordem} onChange={(e) => setEtapa({...etapa,ordem:Number(e.target.value)})}/></label><label className="f2-check"><input type="checkbox" checked={etapa.ativo} onChange={(e) => setEtapa({...etapa,ativo:e.target.checked})}/> Etapa ativa</label><button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar etapa"}</button></form></Modal>}
    {editor === "momento" && <Modal titulo={momento.codigo ? "Editar momento" : "Novo momento"} texto="Defina a conduta, a ação esperada e o prazo do corretor." onFechar={() => setEditor(null)}><form className="f2-config-modal-form" onSubmit={(ev) => { ev.preventDefault(); void onMomento({...momento,prazoMinutos:momento.semPrazo ? null : Math.round(momento.prazoHoras*60)}).then((ok) => { if (ok) setEditor(null); }); }}><label>Código<input required disabled={Boolean(momento.codigo)} value={momento.codigo} onChange={(e) => setMomento({...momento,codigo:e.target.value.toUpperCase().replace(/\W+/g,"_")})}/></label><label>Etapa<select value={momento.etapa} onChange={(e) => { const novaEtapa = e.target.value; setMomento({...momento,etapa:novaEtapa,ordem:momento.codigo ? momento.ordem : proximaOrdemMomento(novaEtapa)}); }}>{etapas.filter((e) => e.ativo).map((e) => <option key={e.codigo} value={e.codigo}>{e.rotulo}</option>)}</select></label><label>Nome<input required value={momento.rotulo} onChange={(e) => setMomento({...momento,rotulo:e.target.value})}/></label><label>Posição na etapa<input type="number" min="1" max="100" value={momento.ordem} onChange={(e) => setMomento({...momento,ordem:Number(e.target.value)})}/></label><label className="largo">O que significa<input required value={momento.descricao} onChange={(e) => setMomento({...momento,descricao:e.target.value})}/></label><label className="largo">Ação oficial<input required value={momento.acaoRotulo} onChange={(e) => setMomento({...momento,acaoRotulo:e.target.value})}/></label><label>Horas permitidas<input type="number" min="0.1" max="720" step="0.5" disabled={momento.semPrazo} value={momento.prazoHoras} onChange={(e) => setMomento({...momento,prazoHoras:Number(e.target.value)})}/></label><label className="f2-check"><input type="checkbox" checked={momento.semPrazo} onChange={(e) => setMomento({...momento,semPrazo:e.target.checked})}/> Sem prazo</label><label className="f2-check"><input type="checkbox" checked={momento.exigeDapi} onChange={(e) => setMomento({...momento,exigeDapi:e.target.checked})}/> Exige confirmação do D-API</label><label className="f2-check"><input type="checkbox" checked={momento.ativo} onChange={(e) => setMomento({...momento,ativo:e.target.checked})}/> Momento ativo</label><button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar momento e prazo"}</button></form></Modal>}
  </main>;
}

function CabecalhoPagina({ titulo, texto, acao, onAcao }: { titulo: string; texto: string; acao?: string; onAcao?: () => void }) { return <header className="f2-pagina-cab"><div><span className="f2-eyebrow">FUNIL 2.0</span><h2>{titulo}</h2><p>{texto}</p></div>{acao && <button type="button" onClick={onAcao}>{acao}</button>}</header>; }

function ModalPescar({ candidatos, busy, onFechar, onPescar }: { candidatos: CandidatoAquarioFunil2[]; busy: boolean; onFechar: () => void; onPescar: (negocioId: number) => void }) {
  const [negocio, setNegocio] = useState(String(candidatos[0]?.negocio_id ?? ""));
  return <Modal titulo="Pescar um lead do Aquário" texto="A lista abaixo vem somente da base real do Aquário: negócios abertos, sem corretor e disponíveis para pesca." onFechar={onFechar}>{candidatos.length > 0 ? <label>Lead disponível<select value={negocio} onChange={(e) => setNegocio(e.target.value)}>{candidatos.map((c) => <option key={c.negocio_id} value={c.negocio_id}>{c.nome} · #{c.negocio_id}</option>)}</select></label> : <div className="f2-sem-resultado"><b>Nenhum lead disponível no Aquário.</b><span>Novas importações aparecerão aqui sem nome de corretor.</span></div>}<div className="f2-pesca-destino"><span>DESTINO</span><b>Novo · Primeira abordagem</b><small>Prazo de 5 minutos. O histórico anterior fica oculto; o chat desta ficha começa exatamente no instante da pesca.</small></div><button type="button" className="f2-modal-primary" disabled={busy || !negocio} onClick={() => onPescar(Number(negocio))}>{busy ? "Pescando…" : "Pescar lead"}</button></Modal>;
}

/* DESCARTAR É UMA SAÍDA OFICIAL, NÃO UM SUMIÇO.
   Nenhum lead sai do funil sozinho, por silencio ou por tempo. Sempre tem
   alguem clicando e escolhendo o motivo. O motivo vem de lista fechada porque
   descarte sem motivo contavel vira desculpa no fim do mes; o detalhe fica
   opcional para o caso que a lista nao explica. O lead nao e apagado: sai da
   carteira e continua no banco com autor, data e motivo. */
function ModalDescartar({ nome, busy, onFechar, onDescartar }: { nome: string; busy: boolean; onFechar: () => void; onDescartar: (motivo: string, detalhe: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  return <Modal titulo="Descartar lead" texto={`${nome} sai da carteira com motivo registrado. Nada é apagado: o histórico e o negócio de origem continuam de pé.`} onFechar={onFechar}>
    <label>Motivo do descarte<select value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">— escolha o motivo —</option>{MOTIVOS_DESCARTE.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>Detalhe <small>(opcional)</small><textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="O que aconteceu? Ajuda quem for reabrir este lead depois." maxLength={500} /></label>
    <div className="f2-descarte-aviso"><b>O lead sai do seu Meu Dia na hora.</b><small>Se voltar a responder, a gestão consegue reabrir com todo o histórico.</small></div>
    <button type="button" className="f2-modal-primary" disabled={busy || !motivo} onClick={() => onDescartar(motivo, detalhe)}>{busy ? "Descartando…" : "Descartar lead"}</button>
  </Modal>;
}

/* AGENDAR VISITA — versao completa, igual a do CRM antigo.
   Antes: lead, data e um campo de texto livre para o imovel. Isso jogava fora o
   produto (que diz o que vai ser mostrado), a unidade e a presenca do gerente --
   campos que o historico prova que eram usados: de 140 visitas, 55 com gerente
   e 53 com produto. Sem gerente escolhido nao ha como checar conflito de
   agenda, e o choque so aparece no dia, com o cliente na porta. */
function ModalVisita({ leads, busy, onFechar, onSalvar }: { leads: LeadFunil2[]; busy: boolean; onFechar: () => void; onSalvar: (d: Record<string, unknown>) => void }) {
  const [leadId, setLeadId] = useState(leads[0]?.id ?? "");
  const [inicio, setInicio] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [comGerente, setComGerente] = useState(false);
  const [gerente, setGerente] = useState("");
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([]);
  const [equipe, setEquipe] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    void sb.from("empreendimentos").select("id,nome").order("nome").limit(200)
      .then(({ data }) => setProdutos((data ?? []) as { id: string; nome: string }[]));
    void sb.from("gerentes").select("id,nome").eq("ativo", true).order("geral", { ascending: false }).order("nome")
      .then(({ data }) => setEquipe((data ?? []) as { id: number; nome: string }[]));
  }, []);

  const podeSalvar = !busy && leadId && inicio && (empreendimento || unidade.trim().length >= 2) && (!comGerente || gerente);

  return <Modal titulo="Agendar visita" texto="A visita aparecerá no Pipe sem duplicar o lead." onFechar={onFechar}>
    <label>Lead
      <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
        {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
      </select>
    </label>
    <label>Produto
      <select value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)}>
        <option value="">— escolha o empreendimento —</option>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
    <label>Unidade <small>(opcional)</small>
      <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex.: apto 402" />
    </label>
    <label>Data e hora
      <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
    </label>
    <label className="f2-modal-check">
      <input type="checkbox" checked={comGerente} onChange={(e) => setComGerente(e.target.checked)} />
      Quero o gerente presente
    </label>
    {comGerente && <label>Qual gerente
      <select value={gerente} onChange={(e) => setGerente(e.target.value)}>
        <option value="">— escolha —</option>
        {equipe.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
    </label>}
    <button type="button" className="f2-modal-primary" disabled={!podeSalvar}
      onClick={() => onSalvar({
        leadId, inicioEm: inicio,
        imovel: unidade.trim() || "",
        empreendimentoId: empreendimento || null,
        unidade: unidade.trim() || null,
        comGerente, gerenteId: comGerente ? Number(gerente) : null,
        status: "agendada",
      })}>Criar visita</button>
  </Modal>;
}

function ModalNegociacao({ leads, busy, onFechar, onSalvar }: { leads: LeadFunil2[]; busy: boolean; onFechar: () => void; onSalvar: (d: Record<string, unknown>) => void }) { const [leadId,setLeadId]=useState(leads[0]?.id??""); const [titulo,setTitulo]=useState(""); const [valor,setValor]=useState(""); return <Modal titulo="Lançar negociação" texto="A negociação nasce ligada ao lead e avança na Esteira de Vendas." onFechar={onFechar}><label>Lead<select value={leadId} onChange={(e)=>setLeadId(e.target.value)}>{leads.map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><label>Negociação<input value={titulo} onChange={(e)=>setTitulo(e.target.value)} placeholder="Imóvel ou oportunidade"/></label><label>Valor estimado<input type="number" min="0" value={valor} onChange={(e)=>setValor(e.target.value)}/></label><button type="button" className="f2-modal-primary" disabled={busy||!leadId||titulo.length<2} onClick={()=>onSalvar({leadId,titulo,valor,etapa:"qualificacao"})}>Criar negociação</button></Modal>; }

function Modal({ titulo, texto, onFechar, children }: { titulo:string; texto:string; onFechar:()=>void; children:ReactNode }) { return <div className="f2-modal-overlay" onClick={onFechar}><div className="f2-modal" onClick={(e)=>e.stopPropagation()}><header><div><span className="f2-eyebrow">FUNIL 2.0</span><h2>{titulo}</h2><p>{texto}</p></div><button type="button" onClick={onFechar}>×</button></header>{children}</div></div>; }

function Detalhe({
  abrirNoChat, accessToken, lead, momento, momentos, etapas, eventos, notas, tagCatalogo, busy, onFechar, onMomento, onConfirmar, onAgendarVisita, onGerarNegociacao, onDescartar, onSalvarNota, onTagSalva }: {
  accessToken: string;
  lead: LeadFunil2; momento: MomentoFunil2; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; eventos: EventoFunil2[]; notas: NotaFunil2[]; tagCatalogo: TagCatalogoFunil2[]; busy: boolean;
  onFechar: () => void; onMomento: (codigo: string, prazo: string, obs: string) => void; onConfirmar: (fonte: "dapi" | "registro_operacional", obs: string) => void;
  onAgendarVisita: () => void; onGerarNegociacao: () => void;
  onDescartar: () => void; onSalvarNota: (texto: string) => Promise<boolean>;
  onTagSalva: () => void;
  abrirNoChat?: boolean;
}) {
  const [codigo, setCodigo] = useState(lead.momento_codigo);
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");
  const [nota, setNota] = useState("");
  const [chatAberto, setChatAberto] = useState(abrirNoChat === true);
  const config = momentos.find((m) => m.codigo === codigo) ?? momento;
  const situacao = prazoDaAcao(lead);
  const cadencia = rotuloCadencia(lead);
  const tentativa = tentativaAtual(lead);
  const whatsapp = linkWhatsapp(lead.telefone);

  return <div className="f2-overlay" onClick={onFechar}>
    <aside className="f2-detalhe" aria-label={`Detalhe de ${lead.nome}`} onClick={(e) => e.stopPropagation()}>
      <div className="f2-detalhe-topo"><div><span className="f2-eyebrow">LEAD-CÓPIA · #{lead.origem_negocio_id}</span><h2>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem corretor"}{lead.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${lead.instancia_rotulo}`}> · {lead.instancia_rotulo}</em> : null} · original protegido</p><InteresseLead lead={lead} detalhado /><AssociarTagLead leadId={lead.id} catalogo={tagCatalogo} accessToken={accessToken} onSalvo={onTagSalva} /></div><button type="button" onClick={onFechar} aria-label="Fechar detalhe">×</button></div>

      <div className="f2-atalhos" aria-label="Ações rápidas do lead">
        <button type="button" onClick={() => setChatAberto(true)}>💬 Chat</button>
        {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : <span>WhatsApp indisponível</span>}
        <button type="button" onClick={onAgendarVisita}>▣ Agendar visita</button>
        <button type="button" onClick={onGerarNegociacao}>↗ Gerar negociação</button>
        <button type="button" className="f2-descartar" onClick={onDescartar}>✖ Descartar lead</button>
      </div>

      <section className="f2-agora">
        <div className="f2-agora-cab"><span>O QUE FAZER AGORA</span><em className={situacao.classe}>{situacao.rotulo}</em></div>
        <div className="f2-agora-grid"><div className="etapa"><span>ETAPA</span><b>{etapas.find((e) => e.codigo === lead.etapa)?.rotulo}</b></div><div className="momento"><span>MOMENTO</span><b>{momento.rotulo}</b></div><div className="acao"><span>PRÓXIMA AÇÃO</span><b>{acaoVisivel(lead)}</b></div></div>
        {cadencia && <div className="f2-cadencia-dia"><span>CADÊNCIA OFICIAL</span><b>{tentativa ? `${tentativa}ª` : "Fim"}</b><small>{cadencia}. Este é o passo exato que deve ser executado agora.</small></div>}
        <span>FAÇA AGORA</span><h3>{acaoVisivel(lead)}</h3><p>{momento.descricao}</p>
        {whatsapp ? <a className="f2-principal f2-link" href={whatsapp} target="_blank" rel="noreferrer">{tentativa ? `Abrir WhatsApp · enviar tentativa ${tentativa}` : "Abrir WhatsApp e executar"}</a> : <button type="button" className="f2-principal" disabled>Telefone inválido · corrija o cadastro</button>}
        <button type="button" className="f2-chat-sec" onClick={() => setChatAberto(true)}>Ver conversa antes de agir</button>
        {momento.exige_dapi && <div className="f2-dapi"><i /> <span><b>A conclusão vem do D-API</b>O clique não conclui a tarefa. O envio confirmado no celular é a evidência.</span></div>}
        <div className="f2-evidencia"><div><span>Última ação confirmada</span><b>{dataCurta(lead.ultima_acao_confirmada_em)}</b></div><div><span>Sara reavaliou</span><b>{dataCurta(lead.ultima_reavaliacao_sara_em)}</b></div><div><span>Nota do atendimento</span><b>{lead.qualidade_atendimento_nota == null ? "Ainda não avaliado" : `${Number(lead.qualidade_atendimento_nota).toFixed(1)}/10`}</b></div></div>
      </section>

      <section className="f2-atualizar">
        <span className="f2-eyebrow">ATUALIZAR O MOMENTO</span>
        <h3>O cliente continua aqui ou mudou?</h3>
        <p className="f2-explica">Se nada mudou, confirme o mesmo momento. O prazo reinicia e a atualização fica registrada.</p>
        <label>Momento oficial<select value={codigo} onChange={(e) => setCodigo(e.target.value)}>{momentos.map((m) => <option key={m.codigo} value={m.codigo}>{etapas.find((e) => e.codigo === m.etapa)?.rotulo} · {m.rotulo}</option>)}</select></label>
        <div className="f2-preview"><span>Próxima ação</span><b>{config.acao_rotulo}</b><small>Prazo padrão: {config.prazo_rotulo}</small></div>
        {codigo === "RETORNO_PROGRAMADO" && <label>Data e hora combinadas<input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>}
        <label>Observação<textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Por que este é o momento correto?" maxLength={500} /></label>
        <button type="button" className="f2-secundario" disabled={busy} onClick={() => onMomento(codigo, prazo, obs)}>{busy ? "Atualizando…" : codigo === lead.momento_codigo ? "Continua neste momento · atualizar prazo" : "Salvar novo momento e prazo"}</button>
      </section>

      <section className="f2-sara-resumo">
        <span className="f2-eyebrow">RESUMO DA SARA</span>
        <h3>{lead.ultima_reavaliacao_resumo ?? "Ainda não existe uma leitura resumida."}</h3>
        {lead.qualidade_atendimento_resumo ? <p><b>Qualidade do atendimento:</b> {lead.qualidade_atendimento_resumo}</p> : null}
        <p>A Sara deve conferir o histórico, validar o momento oficial e gerar a próxima obrigação — sem criar classificações livres.</p>
      </section>

      {/* A conversa guarda mensagem, nao guarda combinado. A nota e o unico
          lugar onde cabe o que foi acertado por telefone, na visita ou no
          corredor -- e quem abrir este lead amanha precisa ler isso antes de
          falar com o cliente. */}
      <section className="f2-notas">
        <span className="f2-eyebrow">NOTAS DO ATENDIMENTO</span>
        <h3>O que ficou combinado</h3>
        <div className="f2-notas-lista">
          {notas.map((item) => <article key={item.id}><strong>{item.autor_nome ?? "Equipe"}</strong><small>{dataCurta(item.criado_em)}</small><span>{item.texto}</span></article>)}
          {notas.length === 0 && <p>Nenhuma nota escrita ainda.</p>}
        </div>
        <label>Nova nota<textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Combinado, objeção, contexto — o que o próximo a abrir precisa saber." maxLength={2000} /></label>
        <button type="button" className="f2-secundario" disabled={busy || nota.trim().length < 2} onClick={() => { void onSalvarNota(nota.trim()).then((ok) => { if (ok) setNota(""); }); }}>{busy ? "Salvando…" : "Salvar nota"}</button>
      </section>

      <section className="f2-historico">
        <div><Icone nome="historico" /><h3>Histórico de atualizações</h3></div>
        {eventos.map((evento) => <article key={evento.id}><i /><div><strong>{evento.titulo}</strong><span>{evento.detalhe}</span><small>{dataCurta(evento.criado_em)}</small></div></article>)}
        {eventos.length === 0 && <p>Nenhuma atualização registrada.</p>}
      </section>

      <details className="f2-lab-tools"><summary>Ferramentas do laboratório</summary><p>Somente para testar o avanço da cópia. No fluxo definitivo, o webhook do D-API executará esta confirmação.</p><button type="button" disabled={busy} onClick={() => onConfirmar(momento.exige_dapi ? "dapi" : "registro_operacional", obs)}>{busy ? "Atualizando…" : "Simular evidência confirmada"}</button></details>
    </aside>
    {chatAberto && lead.lead_id > 0 && <Funil2ConversationDrawer accessToken={accessToken} leadId={lead.id} nome={lead.nome} onClose={() => setChatAberto(false)} />}
  </div>;
}
