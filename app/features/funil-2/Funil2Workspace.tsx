"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { acaoVisivel, dataCurta, diaCadencia, prazoDaAcao, situacaoPrazo, venceHoje, type CandidatoAquarioFunil2, type EtapaConfigFunil2, type EventoFunil2, type LeadFunil2, type MomentoFunil2, type NegociacaoFunil2, type VisitaFunil2 } from "./modelo";
import { FUNIL2_CSS } from "./estilos";

type Perfil = { userId: string; role: string; name: string };
type Payload = {
  leads?: LeadFunil2[]; momentos?: MomentoFunil2[]; eventos?: EventoFunil2[]; etapas?: EtapaConfigFunil2[];
  visitas?: VisitaFunil2[]; negociacoes?: NegociacaoFunil2[]; aquario?: CandidatoAquarioFunil2[]; error?: string;
};
type Mensagem = { id: string; direcao: string; tipo: string; conteudo: string | null; transcricao: string | null; criado_em: string; enviado_em: string | null };

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

function mensagemDoCliente(direcao: string) {
  return ["recebida", "entrada", "in", "inbound", "received"].includes(direcao.toLowerCase());
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
  const [etapas, setEtapas] = useState<EtapaConfigFunil2[]>([]);
  const [visitas, setVisitas] = useState<VisitaFunil2[]>([]);
  const [negociacoes, setNegociacoes] = useState<NegociacaoFunil2[]>([]);
  const [aquario, setAquario] = useState<CandidatoAquarioFunil2[]>([]);
  const [aba, setAba] = useState<"quadro" | "dia" | "leads" | "visitas" | "vendas" | "config">("dia");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [abrirChatDireto, setAbrirChatDireto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"pescar" | "visita" | "negociacao" | null>(null);
  const [avisosAbertos, setAvisosAbertos] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const resposta = await api(accessToken);
    setCarregando(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o laboratório."); return; }
    setLeads(resposta.json.leads ?? []);
    setMomentos(resposta.json.momentos ?? []);
    setEventos(resposta.json.eventos ?? []);
    setEtapas(resposta.json.etapas ?? []);
    setVisitas(resposta.json.visitas ?? []);
    setNegociacoes(resposta.json.negociacoes ?? []);
    setAquario(resposta.json.aquario ?? []);
  }, [accessToken]);

  useEffect(() => {
    let ativo = true;
    void api(accessToken).then((resposta) => {
      if (!ativo) return;
      setCarregando(false);
      if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o laboratório."); return; }
      setLeads(resposta.json.leads ?? []);
      setMomentos(resposta.json.momentos ?? []);
      setEventos(resposta.json.eventos ?? []);
      setEtapas(resposta.json.etapas ?? []);
      setVisitas(resposta.json.visitas ?? []);
      setNegociacoes(resposta.json.negociacoes ?? []);
      setAquario(resposta.json.aquario ?? []);
    });
    return () => { ativo = false; };
  }, [accessToken]);

  const lead = leads.find((item) => item.id === selecionado) ?? null;
  const momentoAtual = lead ? momentos.find((m) => m.codigo === lead.momento_codigo) ?? null : null;
  const eventosLead = lead ? eventos.filter((e) => e.funil_lead_id === lead.id) : [];
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
    if (!lead) return;
    setBusy(true); setErro(null);
    const resposta = await api(accessToken, { method: "PATCH", body: JSON.stringify({ action, id: lead.id, versao: lead.versao, ...body }) });
    setBusy(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível atualizar a cópia."); return; }
    await carregar();
  }

  return (
    <div className="f2-root">
      <style>{FUNIL2_CSS}</style>
      <header className="f2-topo">
        <div className="f2-marca">
          <span className="f2-eyebrow">LABORATÓRIO ISOLADO</span>
          <h1>Funil 2.0</h1>
          <p>Dois leads-cópia para desenhar a operação antes da migração.</p>
        </div>
        <div className="f2-topo-acoes">
          <span className="f2-isolado"><i /> Originais intactos</span>
          <div className="f2-sino-wrap">
            <button type="button" className="f2-sino" onClick={() => setAvisosAbertos((v) => !v)} aria-label="Abrir notificações"><Icone nome="sino" /><b>{atrasados + urgentes}</b></button>
            {avisosAbertos && <div className="f2-avisos-pop"><span className="f2-eyebrow">CENTRAL DE ATENÇÃO</span><h3>O que pede ação agora</h3><article className="vermelho"><b>{atrasados}</b><span>ações atrasadas</span></article><article className="amarelo"><b>{urgentes}</b><span>vencem em até 2h</span></article><article className="verde"><b>{vencemHoje}</b><span>obrigações até hoje</span></article><button type="button" onClick={() => { setAba("dia"); setAvisosAbertos(false); }}>Abrir Meu Dia</button></div>}
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
        <button type="button" className={aba === "config" ? "ativo" : ""} onClick={() => setAba("config")}><Icone nome="config" /> Configurações</button>
        <span>Estrutura de teste · limite físico de 2 leads</span>
      </nav>

      {erro && <div className="f2-erro">{erro}</div>}
      {carregando && <div className="f2-loading">Carregando o Funil 2.0…</div>}

      {!carregando && aba === "quadro" && <main className="f2-main">
        <section className="f2-resumo" aria-label="Resumo do laboratório">
          <article><b>{leads.length}<small>/2</small></b><span>leads-cópia</span></article>
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
                {daEtapa.map((item) => {
                  const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
                  const prazo = prazoDaAcao(item);
                  const dia = diaCadencia(item);
                  return <article key={item.id} role="button" tabIndex={0} className={`f2-card ${selecionado === item.id ? "selecionado" : ""}`} onClick={() => { setAbrirChatDireto(false); setSelecionado(item.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setAbrirChatDireto(false); setSelecionado(item.id); } }}>
                    <div className="f2-card-ident"><i>{iniciais(item.nome)}</i><div><strong>{item.nome}</strong><span>{item.corretor_nome ?? "Sem corretor"}</span></div></div>
                    <div className="f2-card-regra"><span>MOMENTO</span><b>{momento?.rotulo ?? item.momento_codigo}</b><small>{momento?.descricao}</small></div>
                    <div className="f2-card-acao"><span>{dia ? `CADÊNCIA OFICIAL · DIA ${dia}` : "FAÇA AGORA"}</span><b>{acaoVisivel(item)}</b></div>
                    <div className={`f2-prazo ${prazo.classe}`}>{prazo.rotulo}</div>
                    <div className="f2-card-status"><span>✓ Última ação: {dataCurta(item.ultima_acao_confirmada_em)}</span><span>✦ Sara: {dataCurta(item.ultima_reavaliacao_sara_em)}</span></div>
                    <div className="f2-card-botoes"><button type="button" onClick={(e) => { e.stopPropagation(); setAbrirChatDireto(true); setSelecionado(item.id); }}>💬 Chat</button><button type="button" className="principal" onClick={(e) => { e.stopPropagation(); setAbrirChatDireto(false); setSelecionado(item.id); }}>{dia ? `Executar Dia ${dia}` : "Abrir ação"}</button></div>
                  </article>;
                })}
                {daEtapa.length === 0 && <div className="f2-vazio">Nenhum lead-cópia nesta etapa.</div>}
              </div>
            </div>;
          })}
        </section>
      </main>}

      {!carregando && aba === "dia" && <main className="f2-dia">
        <section className="f2-plano">
          <div className="f2-plano-titulo"><div><span className="f2-eyebrow">SEU PLANO DE TRABALHO</span><h2>O CRM colocou o dia na ordem certa.</h2><p>Veja o cliente, a etapa, o momento, a ação e o tempo restante. Execute de cima para baixo.</p></div><b>{aFazer.length}<small>obrigações</small></b></div>
          {aFazer[0] && <div className="f2-proxima"><div><span>SUA PRÓXIMA AÇÃO</span><h3>{aFazer[0].nome} · {momentosAtivos.find((m) => m.codigo === aFazer[0].momento_codigo)?.rotulo}</h3><b>{acaoVisivel(aFazer[0])}</b><small>{prazoDaAcao(aFazer[0]).rotulo}</small></div><button type="button" onClick={() => setSelecionado(aFazer[0].id)}>Atender agora</button></div>}
          <div className="f2-indicadores"><article className="vermelho"><b>{atrasados}</b><span>ações atrasadas</span></article><article className="amarelo"><b>{urgentes}</b><span>vencem em até 2h</span></article><article className="laranja"><b>{vencemHoje}</b><span>para fazer hoje</span></article><article className="roxo"><b>{leads.filter((l) => l.etapa === "novo").length}</b><span>leads novos</span></article><article className="verde"><b>{visitas.filter((v) => new Date(v.inicio_em).toDateString() === new Date().toDateString()).length}</b><span>visitas do dia</span></article></div>
          <div className="f2-como"><span><i>1</i><b>Siga a ordem</b><small>O primeiro item é o mais urgente.</small></span><span><i>2</i><b>Execute a ação</b><small>WhatsApp, visita, produto ou retorno.</small></span><span><i>3</i><b>Conclua no CRM</b><small>A Sara relê e prepara o próximo passo.</small></span></div>
        </section>
        <div className="f2-dia-cab"><div><span className="f2-eyebrow">OBRIGAÇÕES ORDENADAS</span><h2>Seu dia, sem adivinhação.</h2><p>Atrasadas primeiro; depois as que vencem mais cedo.</p></div><b>{atrasados} atrasadas</b></div>
        <div className="f2-dia-colunas"><span>Cliente</span><span>Etapa e momento</span><span>Ação oficial</span><span>Tempo</span><span></span></div>
        <div className="f2-dia-lista">
          {aFazer.map((item, index) => {
            const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
            const prazo = prazoDaAcao(item);
            const dia = diaCadencia(item);
            return <button key={item.id} type="button" className="f2-dia-item" onClick={() => { setAbrirChatDireto(false); setSelecionado(item.id); }}>
              <span className="f2-dia-ordem">{index + 1}</span><div><strong>{item.nome}</strong><small>{item.corretor_nome ?? "Sem corretor"}</small></div><div><span>{etapasAtivas.find((e) => e.codigo === item.etapa)?.rotulo}</span><b>{momento?.rotulo}</b></div><div><span>{dia ? `CADÊNCIA · DIA ${dia}` : "AÇÃO OFICIAL"}</span><b>{acaoVisivel(item)}</b></div><em className={prazo.classe}>{prazo.rotulo}</em><i>{dia ? `Enviar Dia ${dia}` : "Executar ação"}</i>
            </button>;
          })}
          {aFazer.length === 0 && <div className="f2-dia-vazio"><b>Seu Meu Dia está em dia.</b><span>Nenhuma obrigação venceu ou vence nas próximas duas horas.</span></div>}
        </div>
      </main>}

      {!carregando && aba === "leads" && <TodosLeads leads={leads} momentos={momentosAtivos} etapas={etapasAtivas} onAbrir={(id, chat) => { setAbrirChatDireto(chat); setSelecionado(id); }} onPescar={() => setModal("pescar")} />}
      {!carregando && aba === "visitas" && <PipeVisitas visitas={visitas} leads={leads} busy={busy} onNova={() => setModal("visita")} onSalvar={(visita) => void executar("salvarVisita", visita)} />}
      {!carregando && aba === "vendas" && <EsteiraVendas negociacoes={negociacoes} leads={leads} busy={busy} onNova={() => setModal("negociacao")} onSalvar={(negociacao) => void executar("salvarNegociacao", negociacao)} />}
      {!carregando && aba === "config" && <Configuracoes etapas={etapas} momentos={momentos} busy={busy} onEtapa={(dados) => void executar("configurarEtapa", dados)} onMomento={(dados) => void executar("configurarMomento", dados)} />}

      {modal === "pescar" && <ModalPescar leads={leads} candidatos={aquario} busy={busy} onFechar={() => setModal(null)} onPescar={(negocioId, substituirId) => void executar("pescar", { negocioId, substituirId })} />}
      {modal === "visita" && <ModalVisita leads={leads} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarVisita", dados)} />}
      {modal === "negociacao" && <ModalNegociacao leads={leads} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarNegociacao", dados)} />}

      {lead && momentoAtual && <Detalhe key={`${lead.id}:${lead.versao}`}
        accessToken={accessToken} abrirChatInicialmente={abrirChatDireto} lead={lead} momento={momentoAtual} momentos={momentosAtivos} etapas={etapasAtivas} eventos={eventosLead} busy={busy}
        onFechar={() => { setSelecionado(null); setAbrirChatDireto(false); }}
        onMomento={(codigo, prazo, obs) => void atualizar("atualizarMomento", { momentoCodigo: codigo, prazoCombinado: prazo || null, observacao: obs })}
        onConfirmar={(fonte, obs) => void atualizar("confirmarAcao", { fonte, observacao: obs })}
        onAgendarVisita={() => setModal("visita")}
        onGerarNegociacao={() => setModal("negociacao")}
      />}
      <footer className="f2-rodape">Sessão: {profile.name} · somente administradores · nenhum dado original é alterado</footer>
    </div>
  );
}

function TodosLeads({ leads, momentos, etapas, onAbrir, onPescar }: { leads: LeadFunil2[]; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; onAbrir: (id: string, chat: boolean) => void; onPescar: () => void }) {
  return <main className="f2-pagina"><CabecalhoPagina titulo="Todos os Leads" texto="Uma lista única das duas cópias do laboratório, com etapa, momento, obrigação e prazo." acao="Pescar um lead" onAcao={onPescar} />
    <div className="f2-tabela-cab"><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Próxima ação</span><span>Prazo</span><span></span></div>
    <div className="f2-tabela">{leads.map((lead) => { const prazo = prazoDaAcao(lead); return <article key={lead.id}><div className="f2-nome"><i>{iniciais(lead.nome)}</i><span><b>{lead.nome}</b><small>{lead.corretor_nome ?? "Sem corretor"}</small></span></div><span>{etapas.find((e) => e.codigo === lead.etapa)?.rotulo}</span><b>{momentos.find((m) => m.codigo === lead.momento_codigo)?.rotulo}</b><span>{acaoVisivel(lead)}</span><em className={prazo.classe}>{prazo.rotulo}</em><div><button type="button" onClick={() => onAbrir(lead.id, true)}>💬 Chat</button><button type="button" className="primario" onClick={() => onAbrir(lead.id, false)}>Abrir</button></div></article>; })}</div>
  </main>;
}

function PipeVisitas({ visitas, leads, busy, onNova, onSalvar }: { visitas: VisitaFunil2[]; leads: LeadFunil2[]; busy: boolean; onNova: () => void; onSalvar: (v: Record<string, unknown>) => void }) {
  const colunas = [
    { codigo: "agendada", rotulo: "Agendadas" }, { codigo: "confirmada", rotulo: "Confirmadas" },
    { codigo: "realizada", rotulo: "Realizadas" }, { codigo: "encerrada", rotulo: "Canceladas / faltou" },
  ];
  return <main className="f2-pagina"><CabecalhoPagina titulo="Pipe de Visitas" texto="O compromisso é único: agendar, confirmar, realizar e registrar o resultado." acao="+ Nova visita" onAcao={onNova} />
    <section className="f2-pipe">{colunas.map((coluna) => { const itens = visitas.filter((v) => coluna.codigo === "encerrada" ? ["cancelada","nao_compareceu"].includes(v.status) : v.status === coluna.codigo); return <div key={coluna.codigo}><header><h3>{coluna.rotulo}</h3><b>{itens.length}</b></header>{itens.map((visita) => { const lead = leads.find((l) => l.id === visita.funil_lead_id); return <article key={visita.id}><span>{dataCurta(visita.inicio_em)}</span><h4>{lead?.nome ?? "Lead removido"}</h4><p>{visita.imovel}</p><select disabled={busy} value={visita.status} onChange={(e) => onSalvar({ id: visita.id, leadId: visita.funil_lead_id, inicioEm: visita.inicio_em, imovel: visita.imovel, status: e.target.value, observacao: visita.observacao })}><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option><option value="nao_compareceu">Não compareceu</option></select></article>; })}{itens.length === 0 && <p className="f2-pipe-vazio">Nenhuma visita.</p>}</div>; })}</section>
  </main>;
}

function EsteiraVendas({ negociacoes, leads, busy, onNova, onSalvar }: { negociacoes: NegociacaoFunil2[]; leads: LeadFunil2[]; busy: boolean; onNova: () => void; onSalvar: (n: Record<string, unknown>) => void }) {
  const colunas = ["qualificacao","simulacao","proposta","documentacao","contrato","venda"] as const;
  const rotulos: Record<string,string> = { qualificacao:"Qualificação",simulacao:"Simulação",proposta:"Proposta",documentacao:"Documentação",contrato:"Contrato",venda:"Venda" };
  return <main className="f2-pagina"><CabecalhoPagina titulo="Esteira de Vendas" texto="A negociação nasce do lead, mas avança em um processo comercial próprio e mensurável." acao="+ Nova negociação" onAcao={onNova} />
    <section className="f2-pipe f2-pipe-vendas">{colunas.map((coluna) => { const itens = negociacoes.filter((n) => n.etapa === coluna); return <div key={coluna}><header><h3>{rotulos[coluna]}</h3><b>{itens.length}</b></header>{itens.map((negocio) => { const lead = leads.find((l) => l.id === negocio.funil_lead_id); return <article key={negocio.id}><span>{lead?.nome}</span><h4>{negocio.titulo}</h4><p>{negocio.valor == null ? "Valor a definir" : Number(negocio.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><select disabled={busy} value={negocio.etapa} onChange={(e) => onSalvar({ id: negocio.id, leadId: negocio.funil_lead_id, titulo: negocio.titulo, etapa: e.target.value, valor: negocio.valor, observacao: negocio.observacao })}>{colunas.map((c) => <option key={c} value={c}>{rotulos[c]}</option>)}<option value="perdida">Perdida</option></select></article>; })}{itens.length === 0 && <p className="f2-pipe-vazio">Nenhuma negociação.</p>}</div>; })}</section>
  </main>;
}

function Configuracoes({ etapas, momentos, busy, onEtapa, onMomento }: { etapas: EtapaConfigFunil2[]; momentos: MomentoFunil2[]; busy: boolean; onEtapa: (e: Record<string, unknown>) => void; onMomento: (m: Record<string, unknown>) => void }) {
  const etapaVazia = { codigo:"",rotulo:"",ajuda:"",ordem:etapas.length+1,ativo:true };
  const momentoVazio = { codigo:"",etapa:etapas.find((e) => e.ativo)?.codigo ?? "",rotulo:"",descricao:"",acaoRotulo:"",prazoHoras:24,ordem:momentos.length+1,exigeDapi:true,ativo:true };
  const [etapa, setEtapa] = useState(etapaVazia);
  const [momento, setMomento] = useState(momentoVazio);
  return <main className="f2-pagina"><CabecalhoPagina titulo="Configurações da operação" texto="Edite o vocabulário oficial. Etapas organizam o funil; momentos determinam ação e prazo." />
    <section className="f2-config-grid"><div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">ETAPAS</span><h3>Colunas do funil</h3></div><button type="button" onClick={() => setEtapa(etapaVazia)}>+ Criar</button></div>
      <div className="f2-config-lista">{etapas.map((e) => <article key={e.codigo} className={!e.ativo ? "inativo" : ""}><b>{e.ordem}</b><span><strong>{e.rotulo}</strong><small>{e.ajuda}</small></span><button type="button" onClick={() => setEtapa({...e})}>Editar</button><button type="button" disabled={busy || !e.ativo} onClick={() => onEtapa({...e,ativo:false})}>Excluir</button></article>)}</div>
      <form onSubmit={(ev) => { ev.preventDefault(); onEtapa(etapa); }}><h4>{etapa.codigo ? "Editar etapa" : "Nova etapa"}</h4><label>Código<input required disabled={Boolean(etapa.codigo)} value={etapa.codigo} onChange={(e) => setEtapa({...etapa,codigo:e.target.value.toLowerCase().replace(/\W+/g,"_")})}/></label><label>Nome<input required value={etapa.rotulo} onChange={(e) => setEtapa({...etapa,rotulo:e.target.value})}/></label><label>Descrição<input value={etapa.ajuda} onChange={(e) => setEtapa({...etapa,ajuda:e.target.value})}/></label><label>Ordem<input type="number" min="1" max="50" value={etapa.ordem} onChange={(e) => setEtapa({...etapa,ordem:Number(e.target.value)})}/></label><button type="submit" disabled={busy}>Salvar etapa</button></form>
    </div><div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">MOMENTOS</span><h3>Condutas, ações e horas</h3></div><button type="button" onClick={() => setMomento(momentoVazio)}>+ Criar</button></div>
      <div className="f2-config-lista">{momentos.map((m) => <article key={m.codigo} className={m.ativo === false ? "inativo" : ""}><b>{m.ordem}</b><span><strong>{m.rotulo}</strong><small>{m.acao_rotulo} · {m.prazo_rotulo}</small></span><button type="button" onClick={() => setMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoHoras:(m.prazo_minutos ?? 60)/60,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:m.ativo !== false})}>Editar</button><button type="button" disabled={busy || m.ativo === false} onClick={() => onMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoMinutos:m.prazo_minutos,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:false})}>Excluir</button></article>)}</div>
      <form onSubmit={(ev) => { ev.preventDefault(); onMomento({...momento,prazoMinutos:Math.round(momento.prazoHoras*60)}); }}><h4>{momento.codigo ? "Editar momento" : "Novo momento"}</h4><label>Código<input required disabled={Boolean(momento.codigo)} value={momento.codigo} onChange={(e) => setMomento({...momento,codigo:e.target.value.toUpperCase().replace(/\W+/g,"_")})}/></label><label>Etapa<select value={momento.etapa} onChange={(e) => setMomento({...momento,etapa:e.target.value})}>{etapas.filter((e) => e.ativo).map((e) => <option key={e.codigo} value={e.codigo}>{e.rotulo}</option>)}</select></label><label>Nome<input required value={momento.rotulo} onChange={(e) => setMomento({...momento,rotulo:e.target.value})}/></label><label>O que significa<input required value={momento.descricao} onChange={(e) => setMomento({...momento,descricao:e.target.value})}/></label><label>Ação oficial<input required value={momento.acaoRotulo} onChange={(e) => setMomento({...momento,acaoRotulo:e.target.value})}/></label><div className="f2-form-linha"><label>Horas permitidas<input type="number" min="0.1" max="720" step="0.5" value={momento.prazoHoras} onChange={(e) => setMomento({...momento,prazoHoras:Number(e.target.value)})}/></label><label>Ordem<input type="number" min="1" max="100" value={momento.ordem} onChange={(e) => setMomento({...momento,ordem:Number(e.target.value)})}/></label></div><label className="f2-check"><input type="checkbox" checked={momento.exigeDapi} onChange={(e) => setMomento({...momento,exigeDapi:e.target.checked})}/> Exige confirmação do D-API</label><button type="submit" disabled={busy}>Salvar momento e prazo</button></form>
    </div></section>
  </main>;
}

function CabecalhoPagina({ titulo, texto, acao, onAcao }: { titulo: string; texto: string; acao?: string; onAcao?: () => void }) { return <header className="f2-pagina-cab"><div><span className="f2-eyebrow">FUNIL 2.0</span><h2>{titulo}</h2><p>{texto}</p></div>{acao && <button type="button" onClick={onAcao}>{acao}</button>}</header>; }

function ModalPescar({ leads, candidatos, busy, onFechar, onPescar }: { leads: LeadFunil2[]; candidatos: CandidatoAquarioFunil2[]; busy: boolean; onFechar: () => void; onPescar: (negocioId: number, substituirId: string | null) => void }) {
  const [negocio, setNegocio] = useState(String(candidatos[0]?.negocio_id ?? "")); const [substituir, setSubstituir] = useState(leads[0]?.id ?? "");
  return <Modal titulo="Pescar um lead do Aquário" texto="Como o laboratório aceita só duas cópias, a pesca substitui uma cópia — nunca altera o lead original." onFechar={onFechar}><label>Lead disponível<select value={negocio} onChange={(e) => setNegocio(e.target.value)}>{candidatos.map((c) => <option key={c.negocio_id} value={c.negocio_id}>{c.nome} · #{c.negocio_id} · {c.corretor_nome ?? "sem corretor"}</option>)}</select></label><label>Cópia a substituir<select value={substituir} onChange={(e) => setSubstituir(e.target.value)}>{leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><button type="button" className="f2-modal-primary" disabled={busy || !negocio || !substituir} onClick={() => onPescar(Number(negocio),substituir)}>Substituir cópia e pescar</button></Modal>;
}

function ModalVisita({ leads, busy, onFechar, onSalvar }: { leads: LeadFunil2[]; busy: boolean; onFechar: () => void; onSalvar: (d: Record<string, unknown>) => void }) { const [leadId,setLeadId]=useState(leads[0]?.id??""); const [inicio,setInicio]=useState(""); const [imovel,setImovel]=useState(""); return <Modal titulo="Agendar visita" texto="A visita aparecerá no Pipe sem duplicar o lead." onFechar={onFechar}><label>Lead<select value={leadId} onChange={(e)=>setLeadId(e.target.value)}>{leads.map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><label>Data e hora<input type="datetime-local" value={inicio} onChange={(e)=>setInicio(e.target.value)}/></label><label>Imóvel<input value={imovel} onChange={(e)=>setImovel(e.target.value)} placeholder="Empreendimento ou endereço"/></label><button type="button" className="f2-modal-primary" disabled={busy||!leadId||!inicio||imovel.length<2} onClick={()=>onSalvar({leadId,inicioEm:inicio,imovel,status:"agendada"})}>Criar visita</button></Modal>; }

function ModalNegociacao({ leads, busy, onFechar, onSalvar }: { leads: LeadFunil2[]; busy: boolean; onFechar: () => void; onSalvar: (d: Record<string, unknown>) => void }) { const [leadId,setLeadId]=useState(leads[0]?.id??""); const [titulo,setTitulo]=useState(""); const [valor,setValor]=useState(""); return <Modal titulo="Lançar negociação" texto="A negociação nasce ligada ao lead e avança na Esteira de Vendas." onFechar={onFechar}><label>Lead<select value={leadId} onChange={(e)=>setLeadId(e.target.value)}>{leads.map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><label>Negociação<input value={titulo} onChange={(e)=>setTitulo(e.target.value)} placeholder="Imóvel ou oportunidade"/></label><label>Valor estimado<input type="number" min="0" value={valor} onChange={(e)=>setValor(e.target.value)}/></label><button type="button" className="f2-modal-primary" disabled={busy||!leadId||titulo.length<2} onClick={()=>onSalvar({leadId,titulo,valor,etapa:"qualificacao"})}>Criar negociação</button></Modal>; }

function Modal({ titulo, texto, onFechar, children }: { titulo:string; texto:string; onFechar:()=>void; children:ReactNode }) { return <div className="f2-modal-overlay" onClick={onFechar}><div className="f2-modal" onClick={(e)=>e.stopPropagation()}><header><div><span className="f2-eyebrow">LABORATÓRIO</span><h2>{titulo}</h2><p>{texto}</p></div><button type="button" onClick={onFechar}>×</button></header>{children}</div></div>; }

function Detalhe({ accessToken, abrirChatInicialmente, lead, momento, momentos, etapas, eventos, busy, onFechar, onMomento, onConfirmar, onAgendarVisita, onGerarNegociacao }: {
  accessToken: string;
  abrirChatInicialmente: boolean;
  lead: LeadFunil2; momento: MomentoFunil2; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; eventos: EventoFunil2[]; busy: boolean;
  onFechar: () => void; onMomento: (codigo: string, prazo: string, obs: string) => void; onConfirmar: (fonte: "dapi" | "registro_operacional", obs: string) => void;
  onAgendarVisita: () => void; onGerarNegociacao: () => void;
}) {
  const [codigo, setCodigo] = useState(lead.momento_codigo);
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");
  const [chatAberto, setChatAberto] = useState(abrirChatInicialmente);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [chatErro, setChatErro] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const config = momentos.find((m) => m.codigo === codigo) ?? momento;
  const situacao = prazoDaAcao(lead);
  const dia = diaCadencia(lead);
  const whatsapp = linkWhatsapp(lead.telefone);

  const carregarChat = useCallback(async () => {
    setChatLoading(true); setChatErro("");
    const response = await fetch(`/api/ncrm/conversa?negocio=${lead.origem_negocio_id}&limit=80`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await response.json().catch(() => ({})) as { mensagens?: Mensagem[]; error?: string };
    setChatLoading(false);
    if (!response.ok) { setChatErro(json.error ?? "Não foi possível carregar o histórico."); return; }
    setMensagens(json.mensagens ?? []);
  }, [accessToken, lead.origem_negocio_id]);

  useEffect(() => {
    if (!abrirChatInicialmente) return;
    const timer = window.setTimeout(() => void carregarChat(), 0);
    return () => window.clearTimeout(timer);
  }, [abrirChatInicialmente, carregarChat]);

  function abrirChat() {
    setChatAberto(true);
    if (mensagens.length === 0 && !chatLoading) void carregarChat();
  }
  return <div className="f2-overlay" onClick={onFechar}>
    <aside className="f2-detalhe" aria-label={`Detalhe de ${lead.nome}`} onClick={(e) => e.stopPropagation()}>
      <div className="f2-detalhe-topo"><div><span className="f2-eyebrow">LEAD-CÓPIA · #{lead.origem_negocio_id}</span><h2>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem corretor"} · original protegido</p></div><button type="button" onClick={onFechar} aria-label="Fechar detalhe">×</button></div>

      <div className="f2-atalhos" aria-label="Ações rápidas do lead">
        <button type="button" onClick={abrirChat}>💬 Chat</button>
        <button type="button" onClick={onAgendarVisita}>▣ Agendar visita</button>
        <button type="button" onClick={onGerarNegociacao}>↗ Gerar negociação</button>
      </div>

      <section className="f2-agora">
        <div className="f2-agora-cab"><span>O QUE FAZER AGORA</span><em className={situacao.classe}>{situacao.rotulo}</em></div>
        <div className="f2-agora-grid"><div><span>ETAPA</span><b>{etapas.find((e) => e.codigo === lead.etapa)?.rotulo}</b></div><div><span>MOMENTO</span><b>{momento.rotulo}</b></div></div>
        {dia && <div className="f2-cadencia-dia"><span>CADÊNCIA OFICIAL</span><b>DIA {dia}</b><small>Este é o passo exato que deve ser executado agora.</small></div>}
        <span>FAÇA AGORA</span><h3>{acaoVisivel(lead)}</h3><p>{momento.descricao}</p>
        {whatsapp ? <a className="f2-principal f2-link" href={whatsapp} target="_blank" rel="noreferrer">{dia ? `Abrir WhatsApp · enviar Dia ${dia}` : "Abrir WhatsApp e executar"}</a> : <button type="button" className="f2-principal" disabled>Telefone inválido · corrija o cadastro</button>}
        <button type="button" className="f2-chat-sec" onClick={abrirChat}>Ver conversa antes de agir</button>
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

      {chatAberto && <section className="f2-chat">
        <div className="f2-chat-topo"><div><span className="f2-eyebrow">CONVERSA REAL · SOMENTE LEITURA</span><h3>Histórico do WhatsApp</h3></div><div><button type="button" onClick={() => void carregarChat()}>↻</button><button type="button" onClick={() => setChatAberto(false)}>×</button></div></div>
        {chatLoading && <p>Carregando conversa…</p>}
        {chatErro && <p className="f2-chat-erro">{chatErro}</p>}
        <div className="f2-mensagens">
          {mensagens.map((msg) => { const cliente = mensagemDoCliente(msg.direcao); return <article key={msg.id} className={cliente ? "recebida" : "enviada"}><small>{cliente ? "Cliente" : "Corretor"} · {dataCurta(msg.enviado_em ?? msg.criado_em)}</small><span>{msg.transcricao || msg.conteudo || `[${msg.tipo}]`}</span></article>; })}
          {!chatLoading && !chatErro && mensagens.length === 0 && <p>Nenhuma mensagem encontrada para este lead.</p>}
        </div>
      </section>}

      <section className="f2-historico">
        <div><Icone nome="historico" /><h3>Histórico de atualizações</h3></div>
        {eventos.map((evento) => <article key={evento.id}><i /><div><strong>{evento.titulo}</strong><span>{evento.detalhe}</span><small>{dataCurta(evento.criado_em)}</small></div></article>)}
        {eventos.length === 0 && <p>Nenhuma atualização registrada.</p>}
      </section>

      <details className="f2-lab-tools"><summary>Ferramentas do laboratório</summary><p>Somente para testar o avanço da cópia. No fluxo definitivo, o webhook do D-API executará esta confirmação.</p><button type="button" disabled={busy} onClick={() => onConfirmar(momento.exige_dapi ? "dapi" : "registro_operacional", obs)}>{busy ? "Atualizando…" : "Simular evidência confirmada"}</button></details>
    </aside>
  </div>;
}
