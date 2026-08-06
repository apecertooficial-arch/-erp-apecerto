"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { acaoVisivel, dataCurta, duracao, prazoDaAcao, rotuloCadencia, situacaoPrazo, tentativaAtual, venceHoje, type CandidatoAquarioFunil2, type EtapaConfigFunil2, type EventoFunil2, type LeadFunil2, type MomentoFunil2, type NegociacaoFunil2, type NotaFunil2, type OperacaoConfigFunil2, type SaraStatusFunil2, type VisitaFunil2 } from "./modelo";
import { FUNIL2_CSS } from "./estilos";
import { SalesProcessView, LeadChatDrawer, type Lead as LeadLegado, type Deal as DealLegado } from "../crm/CrmWorkspace";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type Perfil = { userId: string; role: string; name: string };
type Payload = {
  leads?: LeadFunil2[]; momentos?: MomentoFunil2[]; eventos?: EventoFunil2[]; etapas?: EtapaConfigFunil2[];
  visitas?: VisitaFunil2[]; negociacoes?: NegociacaoFunil2[]; notas?: NotaFunil2[]; aquario?: CandidatoAquarioFunil2[]; operacao?: OperacaoConfigFunil2 | null; sara?: SaraStatusFunil2; error?: string;
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

/* O input datetime-local so entende hora local sem fuso. Sem esta conversao o
   corretor abre a visita das 14h, ve 17h e remarca sem querer. */
function paraCampoLocal(data: string) {
  const quando = new Date(data);
  if (Number.isNaN(quando.getTime())) return "";
  return new Date(quando.getTime() - quando.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
  const [etapas, setEtapas] = useState<EtapaConfigFunil2[]>([]);
  const [visitas, setVisitas] = useState<VisitaFunil2[]>([]);
  const [negociacoes, setNegociacoes] = useState<NegociacaoFunil2[]>([]);
  const [aquario, setAquario] = useState<CandidatoAquarioFunil2[]>([]);
  const [operacao, setOperacao] = useState<OperacaoConfigFunil2 | null>(null);
  const [sara, setSara] = useState<SaraStatusFunil2>({ modo: null, runnerAtivo: false, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: false });
  const [aba, setAba] = useState<"quadro" | "dia" | "leads" | "visitas" | "vendas" | "performance" | "config">("dia");
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

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const resposta = await api(accessToken);
    setCarregando(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o Funil 2.0."); return; }
    setLeads(resposta.json.leads ?? []);
    setMomentos(resposta.json.momentos ?? []);
    setEventos(resposta.json.eventos ?? []);
    setNotas(resposta.json.notas ?? []);
    setEtapas(resposta.json.etapas ?? []);
    setVisitas(resposta.json.visitas ?? []);
    setNegociacoes(resposta.json.negociacoes ?? []);
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
      setEtapas(resposta.json.etapas ?? []);
      setVisitas(resposta.json.visitas ?? []);
      setNegociacoes(resposta.json.negociacoes ?? []);
      setAquario(resposta.json.aquario ?? []);
      setOperacao(resposta.json.operacao ?? null);
      setSara(resposta.json.sara ?? { modo: null, runnerAtivo: false, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: false });

      /* O push usa o endereço canônico /negocio/N, que chega aqui como
         ?lead=N. Consumimos o parâmetro no retorno assíncrono da carteira para
         abrir diretamente a ficha, sem um segundo efeito e sem render em
         cascata. */
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const negocioId = Number(url.searchParams.get("lead"));
        const destino = Number.isFinite(negocioId) && negocioId > 0
          ? leadsCarregados.find((item) => item.origem_negocio_id === negocioId)
          : null;
        if (destino) {
          setSelecionado(destino.id);
          setAba("dia");
          url.searchParams.delete("lead");
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
  const aFazer = [...leads].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));
  const urgentes = leads.filter((l) => situacaoPrazo(l.proxima_acao_em).classe === "urgente").length;
  const vencemHoje = leads.filter((l) => venceHoje(l)).length;
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
      <style>{FUNIL2_CSS}</style>
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
          <button type="button" onClick={() => { window.location.href = "/crm?crm=nova-era&aba=funil"; }}>Voltar ao CRM 3.0</button>
        </div>
      </header>

      <nav className="f2-nav" aria-label="Visões do Funil 2.0">
        <button type="button" className={aba === "dia" ? "ativo" : ""} onClick={() => setAba("dia")}><Icone nome="dia" /> Meu Dia</button>
        <button type="button" className={aba === "quadro" ? "ativo" : ""} onClick={() => setAba("quadro")}><Icone nome="quadro" /> Funil</button>
        <button type="button" className={aba === "leads" ? "ativo" : ""} onClick={() => setAba("leads")}><Icone nome="leads" /> Todos os Leads</button>
        <button type="button" className={aba === "visitas" ? "ativo" : ""} onClick={() => setAba("visitas")}><Icone nome="visitas" /> Visitas</button>
        <button type="button" className={aba === "vendas" ? "ativo" : ""} onClick={() => setAba("vendas")}><Icone nome="vendas" /> Esteira</button>
        <button type="button" className={aba === "performance" ? "ativo" : ""} onClick={() => setAba("performance")}><Icone nome="vendas" /> Performance</button>
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
                    <div className="f2-card-ident"><i>{iniciais(item.nome)}</i><div><strong>{item.nome}</strong><span>{item.corretor_nome ?? "Sem corretor"}{item.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${item.instancia_rotulo}`}> · {item.instancia_rotulo}</em> : null}</span></div></div>
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
          <div className="f2-plano-titulo"><div><span className="f2-eyebrow">SEU PLANO DE TRABALHO</span><h2>O CRM colocou o dia na ordem certa.</h2><p>Veja o cliente, a etapa, o momento, a ação e o tempo restante. Execute de cima para baixo.</p></div><b>{aFazer.length}<small>obrigações</small></b></div>
          {aFazer[0] && <div className="f2-proxima"><div><span>PRIMEIRO DA FILA</span><h3>{aFazer[0].nome}</h3><b>{etapasAtivas.find((e) => e.codigo === aFazer[0].etapa)?.rotulo} · {momentosAtivos.find((m) => m.codigo === aFazer[0].momento_codigo)?.rotulo}</b><small>{prazoDaAcao(aFazer[0]).rotulo}</small></div><button type="button" onClick={() => setSelecionado(aFazer[0].id)}>Atender agora</button></div>}
          <div className="f2-indicadores"><article className="vermelho"><b>{atrasados}</b><span>ações atrasadas</span></article><article className="amarelo"><b>{urgentes}</b><span>vencem em até 2h</span></article><article className="laranja"><b>{vencemHoje}</b><span>para fazer hoje</span></article><article className="roxo"><b>{leads.filter((l) => l.etapa === "novo").length}</b><span>leads novos</span></article><article className="verde"><b>{visitas.filter((v) => new Date(v.inicio_em).toDateString() === new Date().toDateString()).length}</b><span>visitas do dia</span></article></div>
          <div className="f2-como"><span><i>1</i><b>Siga a ordem</b><small>O primeiro item é o mais urgente.</small></span><span><i>2</i><b>Execute a ação</b><small>WhatsApp, visita, produto ou retorno.</small></span><span><i>3</i><b>Conclua no CRM</b><small>A Sara relê e prepara o próximo passo.</small></span></div>
        </section>
        <div className="f2-dia-cab"><div><span className="f2-eyebrow">OBRIGAÇÕES ORDENADAS</span><h2>Seu dia, sem adivinhação.</h2><p>Atrasadas primeiro; depois as que vencem mais cedo.</p></div><b>{atrasados} atrasadas</b></div>
        <div className="f2-dia-colunas"><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Tempo</span><span></span></div>
        <div className="f2-dia-lista">
          {aFazer.slice(0, limiteDia).map((item, index) => {
            const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
            const prazo = prazoDaAcao(item);
            const cadencia = rotuloCadencia(item);
            const tentativa = tentativaAtual(item);
            return <button key={item.id} type="button" className="f2-dia-item" onClick={() => setSelecionado(item.id)}>
              <span className="f2-dia-ordem">{index + 1}</span><div><strong>{item.nome}</strong><small>{item.corretor_nome ?? "Sem corretor"}{item.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${item.instancia_rotulo}`}> · {item.instancia_rotulo}</em> : null}</small></div><div><span>ETAPA</span><b>{etapasAtivas.find((e) => e.codigo === item.etapa)?.rotulo}</b></div><div><span>{cadencia ? "MOMENTO · CADÊNCIA" : "MOMENTO"}</span><b>{momento?.rotulo}</b></div><em className={prazo.classe}>{prazo.rotulo}</em><i>{tentativa ? `Enviar tentativa ${tentativa}` : "Executar ação"}</i>
            </button>;
          })}
          {aFazer.length > limiteDia && <button type="button" className="f2-dia-mais" onClick={() => setLimiteDia((atual) => atual + 50)}>Mostrar mais 50 · ainda faltam {aFazer.length - limiteDia}</button>}
          {aFazer.length === 0 && <div className="f2-dia-vazio"><b>Seu Meu Dia está em dia.</b><span>Nenhuma obrigação venceu ou vence nas próximas duas horas.</span></div>}
        </div>
      </main>}

      {!carregando && aba === "leads" && <TodosLeads leads={leads} momentos={momentosAtivos} etapas={etapasAtivas} onAbrir={(id) => setSelecionado(id)} onPescar={() => setModal("pescar")} />}
      {!carregando && aba === "visitas" && <PipeVisitas visitas={visitas} leads={leads} busy={busy} onNova={() => setModal("visita")} onSalvar={(visita) => void executar("salvarVisita", visita)} />}
      {/* Só a esteira. O CRM antigo inteiro (cabeçalho, barra de visões, filtros
          e funil) não entra aqui — o Funil 2.0 já é a navegação da operação. */}
      {!carregando && aba === "vendas" && <main className="f2-pagina f2-esteira-oficial"><CabecalhoPagina titulo="Esteira de Vendas 3.0" texto="A mesma estrutura oficial de contratos, documentação, responsáveis, prazos e valores — sem uma segunda esteira desconectada." /><SalesProcessView accessToken={accessToken} sessionRole="admin" /></main>}
      {!carregando && aba === "performance" && <PerformanceFunil2 leads={leads} eventos={eventos} visitas={visitas} negociacoes={negociacoes} operacao={operacao} />}
      {!carregando && aba === "config" && <Configuracoes etapas={etapas} momentos={momentos} operacao={operacao} sara={sara} busy={busy} onEtapa={(dados) => void executar("configurarEtapa", dados)} onMomento={(dados) => void executar("configurarMomento", dados)} onOperacao={(dados) => void executar("configurarOperacao", dados)} />}

      {modal === "pescar" && <ModalPescar candidatos={aquario} busy={busy} onFechar={() => setModal(null)} onPescar={(negocioId) => void executar("pescar", { negocioId })} />}
      {modal === "visita" && <ModalVisita leads={leads} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarVisita", dados)} />}
      {modal === "negociacao" && <ModalNegociacao leads={leads} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarNegociacao", dados)} />}
      {modal === "descartar" && lead && <ModalDescartar nome={lead.nome} busy={busy} onFechar={() => setModal(null)} onDescartar={(motivo, detalhe) => { void atualizar("descartar", { motivo, detalhe }).then((ok) => { if (ok) { setModal(null); setSelecionado(null); } }); }} />}

      {lead && momentoAtual && <Detalhe key={`${lead.id}:${lead.versao}`}
        accessToken={accessToken} lead={lead} momento={momentoAtual} momentos={momentosAtivos} etapas={etapasAtivas} eventos={eventosLead} notas={notasLead} busy={busy}
        abrirNoChat={abrirNoChat}
        onFechar={() => { setSelecionado(null); setAbrirNoChat(false); }}
        onMomento={(codigo, prazo, obs) => void atualizar("atualizarMomento", { momentoCodigo: codigo, prazoCombinado: prazo || null, observacao: obs })}
        onConfirmar={(fonte, obs) => void atualizar("confirmarAcao", { fonte, observacao: obs })}
        onAgendarVisita={() => setModal("visita")}
        onGerarNegociacao={() => setModal("negociacao")}
        onDescartar={() => setModal("descartar")}
        onSalvarNota={(texto) => executar("salvarNota", { leadId: lead.id, texto })}
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
  const novos = ordenados.filter((lead) => lead.etapa === "novo");
  return <div className="f2-avisos-pop">
    <span className="f2-eyebrow">CENTRAL DE ATENÇÃO</span><h3>O que pede ação agora</h3>
    <div className="f2-avisos-resumo"><article className="vermelho"><b>{atrasados.length}</b><span>atrasadas</span></article><article className="amarelo"><b>{urgentes.length}</b><span>até 2h</span></article><article className="roxo"><b>{novos.length}</b><span>leads novos</span></article><article className="verde"><b>{hoje.length}</b><span>para hoje</span></article></div>
    <div className="f2-avisos-lista">{ordenados.slice(0, 5).map((lead) => {
      const prazo = prazoDaAcao(lead);
      return <button type="button" key={lead.id} onClick={() => onAbrir(lead.id)}><span><b>{lead.nome}</b><small>{etapas.find((etapa) => etapa.codigo === lead.etapa)?.rotulo} · {momentos.find((momento) => momento.codigo === lead.momento_codigo)?.rotulo}</small></span><em className={prazo.classe}>{acaoVisivel(lead)} · {prazo.rotulo}</em></button>;
    })}</div>
    <button type="button" className="f2-avisos-dia" onClick={onMeuDia}>Abrir Meu Dia completo</button>
  </div>;
}

function TodosLeads({ leads, momentos, etapas, onAbrir, onPescar }: { leads: LeadFunil2[]; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; onAbrir: (id: string) => void; onPescar: () => void }) {
  const [filtro, setFiltro] = useState("todos");
  const [situacao, setSituacao] = useState("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 50;
  const atrasados = leads.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "atrasado").length;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtrados = leads.filter((lead) => {
    if (filtro !== "todos" && lead.etapa !== filtro) return false;
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
  return <main className="f2-pagina"><CabecalhoPagina titulo="Todos os Leads" texto="A mesma leitura operacional do Funil 2.0: cliente, etapa, momento, ação e prazo — sem informações soltas." acao="Pescar um lead" onAcao={onPescar} />
    <div className="f2-leads-busca"><label><span>Buscar lead</span><input value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} placeholder="Nome ou telefone" aria-label="Buscar lead por nome ou telefone" /></label><label><span>Situação do prazo</span><select value={situacao} onChange={(event) => { setSituacao(event.target.value); setPagina(1); }}><option value="todas">Todos os prazos</option><option value="atrasado">Atrasados</option><option value="urgente">Vencem em até 2h</option><option value="no-prazo">No prazo</option></select></label><b>{filtrados.length} encontrado(s)</b></div>
    <div className="f2-leads-filtros"><button type="button" className={filtro === "todos" ? "ativo" : ""} onClick={() => { setFiltro("todos"); setPagina(1); }}>Todos · {leads.length}</button>{etapas.map((etapa) => <button type="button" className={filtro === etapa.codigo ? "ativo" : ""} onClick={() => { setFiltro(etapa.codigo); setPagina(1); }} key={etapa.codigo}>{etapa.rotulo} · {leads.filter((lead) => lead.etapa === etapa.codigo).length}</button>)}<span>{atrasados} atrasado(s)</span></div>
    <div className="f2-tabela-cab"><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Próxima ação</span><span>Prazo</span><span></span></div>
    <div className="f2-tabela f2-tabela-compacta">{exibidos.map((lead) => { const prazo = prazoDaAcao(lead); const whatsapp = linkWhatsapp(lead.telefone); return <article key={lead.id} className={`f2-lead-linha prazo-${prazo.classe}`}><div className="f2-nome"><i>{iniciais(lead.nome)}</i><span><b>{lead.nome}</b><small>{lead.corretor_nome ?? "Responsável não definido"}{lead.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${lead.instancia_rotulo}`}> · {lead.instancia_rotulo}</em> : null}</small></span></div><span className="f2-lead-chip etapa"><i />{etapas.find((e) => e.codigo === lead.etapa)?.rotulo}</span><span className="f2-lead-chip momento">{momentos.find((m) => m.codigo === lead.momento_codigo)?.rotulo}</span><strong className="f2-lead-acao">{acaoVisivel(lead)}</strong><em className={prazo.classe}>{prazo.rotulo}</em><div className="f2-lead-acoes"><button type="button" onClick={() => onAbrir(lead.id)}>💬 Chat</button>{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}<button type="button" className="primario" onClick={() => onAbrir(lead.id)}>Abrir</button></div></article>; })}{filtrados.length === 0 && <div className="f2-sem-resultado"><b>Nenhum lead encontrado.</b><span>Revise a busca ou os filtros selecionados.</span></div>}</div>
    {filtrados.length > porPagina && <div className="f2-paginacao"><button type="button" disabled={paginaSegura === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))}>← Anterior</button><span>Página {paginaSegura} de {totalPaginas}</span><button type="button" disabled={paginaSegura === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}>Próxima →</button></div>}
  </main>;
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
    <button type="button" disabled={busy || !inicio || (precisaFeedback && feedback.trim().length < 10)} onClick={() => onSalvar({ id: visita.id, leadId: visita.funil_lead_id, inicioEm: new Date(inicio).toISOString(), imovel: imovel.trim() || visita.imovel, status, observacao: feedback || null, empreendimentoId: visita.empreendimento_id ?? null, unidade: visita.unidade ?? null, comGerente: visita.com_gerente === true, gerenteId: visita.gerente_id ?? null, fimEm: visita.fim_em ?? null })}>{busy ? "Salvando…" : precisaFeedback && !visita.feedback_em ? "Registrar resultado" : "Salvar atualização"}</button>
    {visita.status === "realizada" && <small>{visita.feedback_em ? "Feedback concluído" : "Feedback pendente — novos leads podem ser bloqueados"}</small>}
  </article>;
}

function EsteiraVendas({ negociacoes, leads, busy, onNova, onSalvar }: { negociacoes: NegociacaoFunil2[]; leads: LeadFunil2[]; busy: boolean; onNova: () => void; onSalvar: (n: Record<string, unknown>) => void }) {
  const colunas = ["qualificacao","simulacao","proposta","documentacao","contrato","venda"] as const;
  const rotulos: Record<string,string> = { qualificacao:"Qualificação",simulacao:"Simulação",proposta:"Proposta",documentacao:"Documentação",contrato:"Contrato",venda:"Venda" };
  const valor = negociacoes.filter((item) => item.etapa !== "perdida").reduce((total, item) => total + Number(item.valor ?? 0), 0);
  const concluidas = negociacoes.filter((item) => item.etapa === "venda").length;
  return <main className="f2-pagina"><CabecalhoPagina titulo="Esteira de Vendas" texto="Estrutura visual do funil antigo, agora ligada ao lead, ao responsável, ao valor e à etapa comercial." acao="+ Nova negociação" onAcao={onNova} />
    <section className="f2-vendas-kpis"><article><b>{negociacoes.length}</b><span>negociações</span></article><article><b>{negociacoes.filter((item) => item.etapa === "proposta").length}</b><span>propostas</span></article><article><b>{concluidas}</b><span>vendas concluídas</span></article><article><b>{valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b><span>valor em acompanhamento</span></article></section>
    <section className="f2-pipe f2-pipe-vendas">{colunas.map((coluna) => { const itens = negociacoes.filter((n) => n.etapa === coluna); return <div key={coluna}><header><h3>{rotulos[coluna]}</h3><b>{itens.length}</b></header>{itens.map((negocio) => { const lead = leads.find((l) => l.id === negocio.funil_lead_id); return <article key={negocio.id}><span>{lead?.nome}</span><h4>{negocio.titulo}</h4><p>{negocio.valor == null ? "Valor a definir" : Number(negocio.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><select disabled={busy} value={negocio.etapa} onChange={(e) => onSalvar({ id: negocio.id, leadId: negocio.funil_lead_id, titulo: negocio.titulo, etapa: e.target.value, valor: negocio.valor, observacao: negocio.observacao })}>{colunas.map((c) => <option key={c} value={c}>{rotulos[c]}</option>)}<option value="perdida">Perdida</option></select></article>; })}{itens.length === 0 && <p className="f2-pipe-vazio">Nenhuma negociação.</p>}</div>; })}</section>
  </main>;
}

function PerformanceFunil2({ leads, eventos, visitas, negociacoes, operacao }: { leads: LeadFunil2[]; eventos: EventoFunil2[]; visitas: VisitaFunil2[]; negociacoes: NegociacaoFunil2[]; operacao: OperacaoConfigFunil2 | null }) {
  const pct = (parte: number, total: number) => total > 0 ? Math.round(parte / total * 100) : null;
  const mostrarPct = (valor: number | null) => valor === null ? "Sem amostra" : `${valor}%`;
  const prazoInicial = operacao?.primeira_abordagem_min ?? 5;
  const pesos = {
    primeira: operacao?.peso_primeira_abordagem ?? 30,
    prazo: operacao?.peso_acoes_prazo ?? 30,
    feedback: operacao?.peso_feedback_visita ?? 20,
    dapi: operacao?.peso_presenca_dapi ?? 10,
    sara: operacao?.peso_coerencia_sara ?? 10,
  };

  const calcular = (carteira: LeadFunil2[]) => {
    const ids = new Set(carteira.map((lead) => lead.id));
    const eventosCarteira = eventos.filter((evento) => ids.has(evento.funil_lead_id));
    const confirmacoes = eventosCarteira.filter((evento) => evento.tipo === "acao_confirmada");
    const confirmacoesDapi = confirmacoes.filter((evento) => /D-API/i.test(evento.titulo));
    const primeiras = carteira.flatMap((lead) => {
      const corte = new Date(lead.corte_conversa_em).getTime();
      const primeira = eventosCarteira
        .filter((evento) => evento.funil_lead_id === lead.id && evento.tipo === "acao_confirmada" && new Date(evento.criado_em).getTime() >= corte)
        .sort((a, b) => a.criado_em.localeCompare(b.criado_em))[0];
      return primeira ? [{ minutos: Math.max(0, Math.round((new Date(primeira.criado_em).getTime() - corte) / 60000)) }] : [];
    });
    const noPrazo = carteira.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe !== "atrasado").length;
    const atrasadas = carteira.length - noPrazo;
    const visitasCarteira = visitas.filter((visita) => ids.has(visita.funil_lead_id));
    const visitasEncerradas = visitasCarteira.filter((visita) => ["realizada", "cancelada", "nao_compareceu"].includes(visita.status));
    const feedbacks = visitasEncerradas.filter((visita) => Boolean(visita.observacao?.trim()));
    const negociacoesCarteira = negociacoes.filter((negociacao) => ids.has(negociacao.funil_lead_id));
    const propostas = negociacoesCarteira.filter((negociacao) => ["proposta", "documentacao", "contrato", "venda"].includes(negociacao.etapa));
    const vendas = negociacoesCarteira.filter((negociacao) => negociacao.etapa === "venda");
    const saraCobertos = carteira.filter((lead) => lead.ultima_reavaliacao_sara_em && lead.ultima_reavaliacao_resumo && !lead.ultima_reavaliacao_resumo.startsWith("Cópia criada")).length;
    const metricas = [
      { valor: pct(primeiras.filter((item) => item.minutos <= prazoInicial).length, primeiras.length), peso: pesos.primeira },
      { valor: pct(noPrazo, carteira.length), peso: pesos.prazo },
      { valor: pct(feedbacks.length, visitasEncerradas.length), peso: pesos.feedback },
      { valor: pct(confirmacoesDapi.length, confirmacoes.length), peso: pesos.dapi },
      { valor: pct(saraCobertos, carteira.length), peso: pesos.sara },
    ];
    const disponiveis = metricas.filter((metrica): metrica is { valor: number; peso: number } => metrica.valor !== null);
    const pesoDisponivel = disponiveis.reduce((total, metrica) => total + metrica.peso, 0);
    const nota = pesoDisponivel > 0 ? Math.round(disponiveis.reduce((total, metrica) => total + metrica.valor * metrica.peso, 0) / pesoDisponivel) : null;
    const motivos = [
      atrasadas > 0 ? `${atrasadas} ação(ões) atrasada(s)` : null,
      primeiras.some((item) => item.minutos > prazoInicial) ? "primeira abordagem fora do SLA" : null,
      visitasEncerradas.length > feedbacks.length ? `${visitasEncerradas.length - feedbacks.length} visita(s) sem feedback` : null,
      carteira.length > saraCobertos ? `${carteira.length - saraCobertos} lead(s) sem leitura recente da Sara` : null,
    ].filter((motivo): motivo is string => Boolean(motivo));
    return {
      carteira: carteira.length, noPrazo, atrasadas, primeiras, confirmacoes, confirmacoesDapi, visitas: visitasCarteira,
      visitasEncerradas, feedbacks, negociacoes: negociacoesCarteira, propostas, vendas, saraCobertos, nota, motivos,
      primeiraPct: pct(primeiras.filter((item) => item.minutos <= prazoInicial).length, primeiras.length),
      prazoPct: pct(noPrazo, carteira.length), feedbackPct: pct(feedbacks.length, visitasEncerradas.length),
      dapiPct: pct(confirmacoesDapi.length, confirmacoes.length), saraPct: pct(saraCobertos, carteira.length),
    };
  };

  const total = calcular(leads);
  const porCorretor = [...new Set(leads.map((lead) => lead.corretor_nome ?? "Sem responsável"))]
    .map((nome) => ({ nome, ...calcular(leads.filter((lead) => (lead.corretor_nome ?? "Sem responsável") === nome)) }))
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
  const classeNota = (nota: number | null) => nota === null ? "sem-amostra" : nota >= 90 ? "excelente" : nota >= 80 ? "bom" : nota >= 70 ? "atencao" : "critico";
  const rotuloNota = (nota: number | null) => nota === null ? "Sem amostra" : nota >= 90 ? "Excelente" : nota >= 80 ? "Bom" : nota >= 70 ? "Atenção" : "Crítico";
  const pipeline = negociacoes.filter((item) => item.etapa !== "perdida").reduce((soma, item) => soma + Number(item.valor ?? 0), 0);
  const visitasRealizadas = visitas.filter((item) => item.status === "realizada").length;
  const intervencoes = porCorretor.filter((item) => item.motivos.length > 0).sort((a, b) => b.atrasadas - a.atrasadas || (a.nota ?? 101) - (b.nota ?? 101));

  return <main className="f2-pagina"><CabecalhoPagina titulo="Performance de Atendimento" texto="O painel do dono: mostra disciplina, carteira, qualidade e conversão sem misturar esforço controlável com resultado de venda." />
    <section className="f2-performance-hero"><div><span className="f2-eyebrow">PAINEL DO DONO</span><h2>A operação está trabalhando os leads?</h2><p>A nota mede apenas aquilo que o corretor controla. Vendas e conversão aparecem separadas para orientar gestão e treinamento.</p></div><div className={`f2-nota ${classeNota(total.nota)}`}><small>NOTA DE EXECUÇÃO</small><strong>{total.nota ?? "—"}</strong><span>{rotuloNota(total.nota)}</span></div></section>

    <section className="f2-performance-kpis f2-performance-kpis-dono"><article><span>Carteira em dia</span><b>{mostrarPct(total.prazoPct)}</b><small>{total.noPrazo}/{total.carteira} obrigações no prazo agora</small></article><article><span>Atenção imediata</span><b>{total.atrasadas}</b><small>leads com ação vencida</small></article><article><span>Primeira abordagem no SLA</span><b>{mostrarPct(total.primeiraPct)}</b><small>{total.primeiras.length} caso(s) com evidência após a entrada</small></article><article><span>Evidência D-API</span><b>{mostrarPct(total.dapiPct)}</b><small>{total.confirmacoesDapi.length}/{total.confirmacoes.length} ações confirmadas pelo celular</small></article><article><span>Feedback de visitas</span><b>{mostrarPct(total.feedbackPct)}</b><small>{total.feedbacks.length}/{total.visitasEncerradas.length} visitas encerradas documentadas</small></article><article><span>Coerência Sara</span><b>{mostrarPct(total.saraPct)}</b><small>{total.saraCobertos}/{total.carteira} leads reavaliados</small></article></section>

    <section className="f2-performance-blocos"><article><span className="f2-eyebrow">SAÚDE DA CARTEIRA</span><h3>Onde o atendimento está travando</h3><div className="f2-saude-lista"><p><b>{total.atrasadas}</b><span>ações vencidas</span></p><p><b>{leads.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "urgente").length}</b><span>vencem em até 2h</span></p><p><b>{total.carteira - total.saraCobertos}</b><span>sem leitura recente da Sara</span></p><p><b>{total.visitasEncerradas.length - total.feedbacks.length}</b><span>visitas sem feedback</span></p></div></article><article><span className="f2-eyebrow">CONVERSÃO COMERCIAL</span><h3>O trabalho está virando oportunidade?</h3><div className="f2-conversao"><p><b>{visitas.length}</b><span>visitas agendadas</span></p><i>→</i><p><b>{visitasRealizadas}</b><span>realizadas</span></p><i>→</i><p><b>{total.propostas.length}</b><span>propostas</span></p><i>→</i><p><b>{total.vendas.length}</b><span>vendas</span></p></div><small>Pipeline aberto: <b>{pipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b>. Resultado comercial não altera a nota disciplinar.</small></article></section>

    <section className="f2-performance-atencao"><div><span className="f2-eyebrow">QUEM PRECISA DE INTERVENÇÃO</span><h3>Motivo claro, sem adivinhação</h3><p>Prioriza atraso, SLA, falta de feedback e ausência de reavaliação.</p></div>{intervencoes.length ? <div className="f2-intervencoes">{intervencoes.slice(0, 5).map((item) => <article key={item.nome}><div><b>{item.nome}</b><span className={classeNota(item.nota)}>Nota {item.nota ?? "—"} · {rotuloNota(item.nota)}</span></div><p>{item.motivos.join(" · ")}</p></article>)}</div> : <div className="f2-tudo-certo"><b>Nenhuma intervenção imediata.</b><span>A carteira está dentro da conduta disponível.</span></div>}</section>

    <section className="f2-performance-time"><div><span className="f2-eyebrow">PLACAR POR CORRETOR</span><h3>Disciplina e resultado na mesma linha — sem misturar as notas</h3><p>Percentuais sem casos válidos aparecem como “—”. Nesta fase, a amostra considera somente os leads do Funil 2.0.</p></div><div className="f2-performance-cab f2-performance-cab-dono"><span>Corretor</span><span>Nota</span><span>Carteira em dia</span><span>SLA inicial</span><span>D-API</span><span>Feedback</span><span>Sara</span><span>Visitas</span><span>Propostas</span><span>Vendas</span></div>{porCorretor.map((item) => <div className="f2-performance-linha f2-performance-linha-dono" key={item.nome}><b>{item.nome}</b><span><strong className={classeNota(item.nota)}>{item.nota ?? "—"}</strong><small>{rotuloNota(item.nota)}</small></span><span className={(item.prazoPct ?? 100) < 70 ? "ruim" : "bom"}>{mostrarPct(item.prazoPct)}</span><span>{mostrarPct(item.primeiraPct)}</span><span>{mostrarPct(item.dapiPct)}</span><span>{mostrarPct(item.feedbackPct)}</span><span>{mostrarPct(item.saraPct)}</span><span>{item.visitas.length}</span><span>{item.propostas.length}</span><span>{item.vendas.length}</span></div>)}</section>

    <details className="f2-performance-regra"><summary>Como a nota é calculada</summary><div className="f2-pesos"><p><b>{pesos.primeira}%</b> primeira abordagem em até {prazoInicial} min</p><p><b>{pesos.prazo}%</b> carteira com ações no prazo</p><p><b>{pesos.feedback}%</b> feedback das visitas encerradas</p><p><b>{pesos.dapi}%</b> ações comprovadas pelo D-API</p><p><b>{pesos.sara}%</b> leads reavaliados pela Sara</p></div><p>Uma métrica sem amostra é retirada do cálculo e os demais pesos são redistribuídos. Assim, ausência de casos não vira nota zero.</p></details>
  </main>;
}

function Configuracoes({ etapas, momentos, operacao, sara, busy, onEtapa, onMomento, onOperacao }: { etapas: EtapaConfigFunil2[]; momentos: MomentoFunil2[]; operacao: OperacaoConfigFunil2 | null; sara: SaraStatusFunil2; busy: boolean; onEtapa: (e: Record<string, unknown>) => void; onMomento: (m: Record<string, unknown>) => void; onOperacao: (o: Record<string, unknown>) => void }) {
  const etapaVazia = { codigo:"",rotulo:"",ajuda:"",ordem:etapas.length+1,ativo:true };
  const momentoVazio = { codigo:"",etapa:etapas.find((e) => e.ativo)?.codigo ?? "",rotulo:"",descricao:"",acaoRotulo:"",prazoHoras:24,ordem:momentos.length+1,exigeDapi:true,ativo:true };
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
  return <main className="f2-pagina"><CabecalhoPagina titulo="Configurações da operação" texto="Edite o vocabulário oficial. Etapas organizam o funil; momentos determinam ação e prazo." />
    <section className="f2-sara-status"><div><span className="f2-eyebrow">PAPEL DA SARA</span><h3>Ela lê, classifica e fiscaliza. Ela não envia por você.</h3><p>Quando o D-API registra uma mensagem nova, a Sara relê a conversa, escolhe somente um momento oficial e recalcula ação e prazo. Sem histórico suficiente, ela preserva a classificação existente e sinaliza a ausência de evidência. A Sara do CRM está em <b>{sara.modo ?? "estado indisponível"}</b> e o runner principal está <b>{sara.runnerAtivo ? "ligado" : "desligado"}</b>.</p></div><strong className={sara.reavaliacaoAutomaticaFunil2 ? "ativo" : "pendente"}>{sara.reavaliacaoAutomaticaFunil2 ? `Funil 2.0 conectado · lote ${sara.loteFunil2 ?? "—"}` : "Reavaliação automática do Funil 2.0 ainda não conectada"}</strong></section>
    <section className="f2-config-grid"><div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">ETAPAS</span><h3>Colunas do funil</h3></div><button type="button" onClick={() => setEtapa(etapaVazia)}>+ Criar</button></div>
      <div className="f2-config-lista">{etapas.map((e) => <article key={e.codigo} className={!e.ativo ? "inativo" : ""}><b>{e.ordem}</b><span><strong>{e.rotulo}</strong><small>{e.ajuda}</small></span><button type="button" onClick={() => setEtapa({...e})}>Editar</button><button type="button" disabled={busy || !e.ativo} onClick={() => onEtapa({...e,ativo:false})}>Excluir</button></article>)}</div>
      <form onSubmit={(ev) => { ev.preventDefault(); onEtapa(etapa); }}><h4>{etapa.codigo ? "Editar etapa" : "Nova etapa"}</h4><label>Código<input required disabled={Boolean(etapa.codigo)} value={etapa.codigo} onChange={(e) => setEtapa({...etapa,codigo:e.target.value.toLowerCase().replace(/\W+/g,"_")})}/></label><label>Nome<input required value={etapa.rotulo} onChange={(e) => setEtapa({...etapa,rotulo:e.target.value})}/></label><label>Descrição<input value={etapa.ajuda} onChange={(e) => setEtapa({...etapa,ajuda:e.target.value})}/></label><label>Ordem<input type="number" min="1" max="50" value={etapa.ordem} onChange={(e) => setEtapa({...etapa,ordem:Number(e.target.value)})}/></label><button type="submit" disabled={busy}>Salvar etapa</button></form>
    </div><div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">MOMENTOS</span><h3>Condutas, ações e horas</h3></div><button type="button" onClick={() => setMomento(momentoVazio)}>+ Criar</button></div>
      <div className="f2-config-lista">{momentos.map((m) => <article key={m.codigo} className={m.ativo === false ? "inativo" : ""}><b>{m.ordem}</b><span><strong>{m.rotulo}</strong><small>{m.acao_rotulo} · {m.prazo_rotulo}</small></span><button type="button" onClick={() => setMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoHoras:(m.prazo_minutos ?? 60)/60,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:m.ativo !== false})}>Editar</button><button type="button" disabled={busy || m.ativo === false} onClick={() => onMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoMinutos:m.prazo_minutos,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:false})}>Excluir</button></article>)}</div>
      <form onSubmit={(ev) => { ev.preventDefault(); onMomento({...momento,prazoMinutos:Math.round(momento.prazoHoras*60)}); }}><h4>{momento.codigo ? "Editar momento" : "Novo momento"}</h4><label>Código<input required disabled={Boolean(momento.codigo)} value={momento.codigo} onChange={(e) => setMomento({...momento,codigo:e.target.value.toUpperCase().replace(/\W+/g,"_")})}/></label><label>Etapa<select value={momento.etapa} onChange={(e) => setMomento({...momento,etapa:e.target.value})}>{etapas.filter((e) => e.ativo).map((e) => <option key={e.codigo} value={e.codigo}>{e.rotulo}</option>)}</select></label><label>Nome<input required value={momento.rotulo} onChange={(e) => setMomento({...momento,rotulo:e.target.value})}/></label><label>O que significa<input required value={momento.descricao} onChange={(e) => setMomento({...momento,descricao:e.target.value})}/></label><label>Ação oficial<input required value={momento.acaoRotulo} onChange={(e) => setMomento({...momento,acaoRotulo:e.target.value})}/></label><div className="f2-form-linha"><label>Horas permitidas<input type="number" min="0.1" max="720" step="0.5" value={momento.prazoHoras} onChange={(e) => setMomento({...momento,prazoHoras:Number(e.target.value)})}/></label><label>Ordem<input type="number" min="1" max="100" value={momento.ordem} onChange={(e) => setMomento({...momento,ordem:Number(e.target.value)})}/></label></div><label className="f2-check"><input type="checkbox" checked={momento.exigeDapi} onChange={(e) => setMomento({...momento,exigeDapi:e.target.checked})}/> Exige confirmação do D-API</label><button type="submit" disabled={busy}>Salvar momento e prazo</button></form>
    </div></section>
    <section className="f2-config-operacao"><div className="f2-config-operacao-intro"><div><span className="f2-eyebrow">REGRAS DA OPERAÇÃO</span><h3>Uma regra para Automação, CRM e aplicativo</h3><p><b>Automações executa a distribuição.</b> Esta tela define quem está apto, os horários, os prazos e os pesos que a distribuição deve respeitar. Ela nunca liga abordagem automática.</p></div><a href="/automacoes">Abrir distribuição em Automações →</a></div><form onSubmit={(event) => { event.preventDefault(); onOperacao(regra); }}>
      <fieldset><legend>Distribuição manual</legend><label>Início oficial<input type="time" value={regra.horarioInicio} onChange={(e)=>setRegra({...regra,horarioInicio:e.target.value})}/></label><label>Fim oficial<input type="time" value={regra.horarioFim} onChange={(e)=>setRegra({...regra,horarioFim:e.target.value})}/></label><label>Presença válida (min)<input type="number" min="5" max="120" value={regra.presencaTtlMin} onChange={(e)=>setRegra({...regra,presencaTtlMin:Number(e.target.value)})}/></label><label>Primeira abordagem (min)<input type="number" min="1" max="30" value={regra.primeiraAbordagemMin} onChange={(e)=>setRegra({...regra,primeiraAbordagemMin:Number(e.target.value)})}/></label></fieldset>
      <fieldset><legend>Visitas e avisos</legend><label>Feedback da visita (min)<input type="number" min="30" max="1440" value={regra.feedbackVisitaMin} onChange={(e)=>setRegra({...regra,feedbackVisitaMin:Number(e.target.value)})}/></label><label>Aviso urgente (min)<input type="number" min="15" max="1440" value={regra.notificacaoUrgenteMin} onChange={(e)=>setRegra({...regra,notificacaoUrgenteMin:Number(e.target.value)})}/></label><label>Suspensão 1 (h)<input type="number" value={regra.suspensaoNivel1H} onChange={(e)=>setRegra({...regra,suspensaoNivel1H:Number(e.target.value)})}/></label><label>Suspensão 2 (h)<input type="number" value={regra.suspensaoNivel2H} onChange={(e)=>setRegra({...regra,suspensaoNivel2H:Number(e.target.value)})}/></label><label>Suspensão 3 (h)<input type="number" value={regra.suspensaoNivel3H} onChange={(e)=>setRegra({...regra,suspensaoNivel3H:Number(e.target.value)})}/></label></fieldset>
      <fieldset><legend>Pesos de Performance (total 100%)</legend><label>Primeira abordagem<input type="number" min="0" max="100" value={regra.pesoPrimeiraAbordagem} onChange={(e)=>setRegra({...regra,pesoPrimeiraAbordagem:Number(e.target.value)})}/></label><label>Ações no prazo<input type="number" min="0" max="100" value={regra.pesoAcoesPrazo} onChange={(e)=>setRegra({...regra,pesoAcoesPrazo:Number(e.target.value)})}/></label><label>Feedback de visitas<input type="number" min="0" max="100" value={regra.pesoFeedbackVisita} onChange={(e)=>setRegra({...regra,pesoFeedbackVisita:Number(e.target.value)})}/></label><label>Presença + D-API<input type="number" min="0" max="100" value={regra.pesoPresencaDapi} onChange={(e)=>setRegra({...regra,pesoPresencaDapi:Number(e.target.value)})}/></label><label>Coerência Sara<input type="number" min="0" max="100" value={regra.pesoCoerenciaSara} onChange={(e)=>setRegra({...regra,pesoCoerenciaSara:Number(e.target.value)})}/></label></fieldset>
      <button type="submit" disabled={busy}>Salvar regras da operação</button>
    </form></section>
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
  abrirNoChat, accessToken, lead, momento, momentos, etapas, eventos, notas, busy, onFechar, onMomento, onConfirmar, onAgendarVisita, onGerarNegociacao, onDescartar, onSalvarNota }: {
  accessToken: string;
  lead: LeadFunil2; momento: MomentoFunil2; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; eventos: EventoFunil2[]; notas: NotaFunil2[]; busy: boolean;
  onFechar: () => void; onMomento: (codigo: string, prazo: string, obs: string) => void; onConfirmar: (fonte: "dapi" | "registro_operacional", obs: string) => void;
  onAgendarVisita: () => void; onGerarNegociacao: () => void;
  onDescartar: () => void; onSalvarNota: (texto: string) => Promise<boolean>;
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

  const leadChat: LeadLegado = {
    id: lead.lead_id, nome: lead.nome, telefone: lead.telefone, email: null, instagram: null,
    corretor_id: lead.corretor_id, pipeline_id: null, status: "ativo", origem: "funil_2",
    tags: null, extras: null, criado_em: lead.corte_conversa_em, atualizado_em: lead.atualizado_em,
    disparo_optout: false,
  };
  const negocioChat: DealLegado = {
    id: lead.origem_negocio_id, lead_id: lead.lead_id, corretor_id: lead.corretor_id,
    pipeline_id: 0, stage_id: null, empreendimento_id: null, valor: null, status: "aberto",
    motivo_perda: null, criado_em: lead.corte_conversa_em, ultima_movimentacao: lead.atualizado_em,
    estagio_desde: null, tentativa: null, max_tentativas: null,
  };
  return <div className="f2-overlay" onClick={onFechar}>
    <aside className="f2-detalhe" aria-label={`Detalhe de ${lead.nome}`} onClick={(e) => e.stopPropagation()}>
      <div className="f2-detalhe-topo"><div><span className="f2-eyebrow">LEAD-CÓPIA · #{lead.origem_negocio_id}</span><h2>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem corretor"}{lead.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${lead.instancia_rotulo}`}> · {lead.instancia_rotulo}</em> : null} · original protegido</p></div><button type="button" onClick={onFechar} aria-label="Fechar detalhe">×</button></div>

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
        <div className="f2-evidencia"><div><span>Última ação confirmada</span><b>{dataCurta(lead.ultima_acao_confirmada_em)}</b></div><div><span>Sara reavaliou</span><b>{dataCurta(lead.ultima_reavaliacao_sara_em)}</b></div></div>
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
    {chatAberto && lead.lead_id > 0 && <div style={{ display: "contents" }} onClick={(event) => event.stopPropagation()}><LeadChatDrawer accessToken={accessToken} lead={leadChat} deal={negocioChat} corretorNome={lead.corretor_nome ?? undefined} onClose={() => setChatAberto(false)} onResponse={async () => {}} readOnly desde={lead.historico_completo ? undefined : lead.corte_conversa_em} /></div>}
  </div>;
}
