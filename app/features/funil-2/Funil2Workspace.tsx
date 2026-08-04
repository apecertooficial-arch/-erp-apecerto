"use client";

import { useCallback, useEffect, useState } from "react";
import { acaoVisivel, dataCurta, diaCadencia, entraNoMeuDia, ETAPAS_FUNIL2, prazoDaAcao, situacaoPrazo, type EventoFunil2, type LeadFunil2, type MomentoFunil2 } from "./modelo";
import { FUNIL2_CSS } from "./estilos";

type Perfil = { userId: string; role: string; name: string };
type Payload = { leads?: LeadFunil2[]; momentos?: MomentoFunil2[]; eventos?: EventoFunil2[]; error?: string };
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

function Icone({ nome }: { nome: "quadro" | "dia" | "historico" }) {
  const paths = nome === "quadro"
    ? <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></>
    : nome === "dia"
      ? <><path d="M4 6h16M4 12h16M4 18h11" /><path d="m18 17 2 2 3-4" /></>
      : <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>;
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}

export function Funil2Workspace({ accessToken, profile }: { accessToken: string; profile: Perfil }) {
  const [leads, setLeads] = useState<LeadFunil2[]>([]);
  const [momentos, setMomentos] = useState<MomentoFunil2[]>([]);
  const [eventos, setEventos] = useState<EventoFunil2[]>([]);
  const [aba, setAba] = useState<"quadro" | "dia">("quadro");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [abrirChatDireto, setAbrirChatDireto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const resposta = await api(accessToken);
    setCarregando(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o laboratório."); return; }
    setLeads(resposta.json.leads ?? []);
    setMomentos(resposta.json.momentos ?? []);
    setEventos(resposta.json.eventos ?? []);
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
    });
    return () => { ativo = false; };
  }, [accessToken]);

  const lead = leads.find((item) => item.id === selecionado) ?? null;
  const momentoAtual = lead ? momentos.find((m) => m.codigo === lead.momento_codigo) ?? null : null;
  const eventosLead = lead ? eventos.filter((e) => e.funil_lead_id === lead.id) : [];
  const atrasados = leads.filter((l) => situacaoPrazo(l.proxima_acao_em).classe === "atrasado").length;
  const atualizados = leads.filter((l) => l.ultima_acao_confirmada_em).length;
  const aFazer = leads.filter((l) => entraNoMeuDia(l)).sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));

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
          <button type="button" onClick={() => { window.location.href = "/crm?crm=nova-era&aba=funil"; }}>Voltar ao CRM 3.0</button>
        </div>
      </header>

      <nav className="f2-nav" aria-label="Visões do Funil 2.0">
        <button type="button" className={aba === "quadro" ? "ativo" : ""} onClick={() => setAba("quadro")}><Icone nome="quadro" /> Quadro</button>
        <button type="button" className={aba === "dia" ? "ativo" : ""} onClick={() => setAba("dia")}><Icone nome="dia" /> Meu Dia</button>
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
          {ETAPAS_FUNIL2.map((etapa, indice) => {
            const daEtapa = leads.filter((l) => l.etapa === etapa.codigo);
            return <div key={etapa.codigo} className={`f2-coluna etapa-${etapa.codigo}`}>
              <div className="f2-coluna-topo"><span>{indice + 1}</span><div><h2>{etapa.rotulo}</h2><p>{etapa.ajuda}</p></div><b>{daEtapa.length}</b></div>
              <div className="f2-lista">
                {daEtapa.map((item) => {
                  const momento = momentos.find((m) => m.codigo === item.momento_codigo);
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
        <div className="f2-dia-cab"><div><span className="f2-eyebrow">PLANO DE TRABALHO</span><h2>Faça somente o que venceu ou vence agora.</h2><p>Cada item mostra cliente, momento, ação oficial e o prazo daquela ação.</p></div><b>{aFazer.length} ações agora</b></div>
        <div className="f2-dia-lista">
          {aFazer.map((item, index) => {
            const momento = momentos.find((m) => m.codigo === item.momento_codigo);
            const prazo = prazoDaAcao(item);
            const dia = diaCadencia(item);
            return <button key={item.id} type="button" className="f2-dia-item" onClick={() => { setAbrirChatDireto(false); setSelecionado(item.id); }}>
              <span className="f2-dia-ordem">{index + 1}</span><div><strong>{item.nome}</strong><small>{momento?.rotulo}</small></div><div><span>{dia ? `CADÊNCIA · DIA ${dia}` : "FAÇA AGORA"}</span><b>{acaoVisivel(item)}</b></div><em className={prazo.classe}>{prazo.rotulo}</em><i>{dia ? `Enviar Dia ${dia}` : "Executar"}</i>
            </button>;
          })}
          {aFazer.length === 0 && <div className="f2-dia-vazio"><b>Seu Meu Dia está em dia.</b><span>Nenhuma obrigação venceu ou vence nas próximas duas horas.</span></div>}
        </div>
      </main>}

      {lead && momentoAtual && <Detalhe key={`${lead.id}:${lead.versao}`}
        accessToken={accessToken} abrirChatInicialmente={abrirChatDireto} lead={lead} momento={momentoAtual} momentos={momentos} eventos={eventosLead} busy={busy}
        onFechar={() => { setSelecionado(null); setAbrirChatDireto(false); }}
        onMomento={(codigo, prazo, obs) => void atualizar("atualizarMomento", { momentoCodigo: codigo, prazoCombinado: prazo || null, observacao: obs })}
        onConfirmar={(fonte, obs) => void atualizar("confirmarAcao", { fonte, observacao: obs })}
      />}
      <footer className="f2-rodape">Sessão: {profile.name} · somente administradores · nenhum dado original é alterado</footer>
    </div>
  );
}

function Detalhe({ accessToken, abrirChatInicialmente, lead, momento, momentos, eventos, busy, onFechar, onMomento, onConfirmar }: {
  accessToken: string;
  abrirChatInicialmente: boolean;
  lead: LeadFunil2; momento: MomentoFunil2; momentos: MomentoFunil2[]; eventos: EventoFunil2[]; busy: boolean;
  onFechar: () => void; onMomento: (codigo: string, prazo: string, obs: string) => void; onConfirmar: (fonte: "dapi" | "registro_operacional", obs: string) => void;
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
        <button type="button" onClick={() => window.location.assign(`/crm?lead=${lead.origem_negocio_id}&crm=atual`)}>▣ Agendar visita</button>
        <button type="button" onClick={() => window.location.assign(`/crm?lead=${lead.origem_negocio_id}&crm=atual`)}>↗ Gerar negociação</button>
      </div>

      <section className="f2-agora">
        <div className="f2-agora-cab"><span>O QUE FAZER AGORA</span><em className={situacao.classe}>{situacao.rotulo}</em></div>
        <div className="f2-agora-grid"><div><span>ETAPA</span><b>{ETAPAS_FUNIL2.find((e) => e.codigo === lead.etapa)?.rotulo}</b></div><div><span>MOMENTO</span><b>{momento.rotulo}</b></div></div>
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
        <label>Momento oficial<select value={codigo} onChange={(e) => setCodigo(e.target.value)}>{momentos.map((m) => <option key={m.codigo} value={m.codigo}>{ETAPAS_FUNIL2.find((e) => e.codigo === m.etapa)?.rotulo} · {m.rotulo}</option>)}</select></label>
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
