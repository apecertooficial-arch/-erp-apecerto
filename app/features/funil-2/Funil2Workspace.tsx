"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { acaoVisivel, dataCurta, erroAgendamentoVisita, esperandoPrimeiraChamada, prazoDaAcao, rotuloCadencia, rotuloTemperatura, situacaoPrazo, tentativaAtual, venceHoje, type CandidatoAquarioFunil2, type EtapaConfigFunil2, type EventoFunil2, type LeadFunil2, type MomentoFunil2, type NegociacaoFunil2, type NotaFunil2, type OperacaoConfigFunil2, type SaraStatusFunil2, type TagCatalogoFunil2, type TemperaturaLead, type VisitaFunil2 } from "./modelo";
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

type TemperaturaFiltro = TemperaturaLead | "aguardando" | "todas";

const TEMPERATURAS: ReadonlyArray<{ codigo: Exclude<TemperaturaFiltro, "todas">; rotulo: string }> = [
  { codigo: "quente", rotulo: "Quente" },
  { codigo: "negociando", rotulo: "Negociando" },
  { codigo: "morno", rotulo: "Morno" },
  { codigo: "frio", rotulo: "Frio" },
  { codigo: "aguardando", rotulo: "Aguardando leitura" },
];

function temperaturaDoLead(lead: LeadFunil2): Exclude<TemperaturaFiltro, "todas"> {
  return lead.temperatura ?? "aguardando";
}

function ChipTemperatura({ lead, className = "", compacto = false }: { lead: LeadFunil2; className?: string; compacto?: boolean }) {
  const codigo = temperaturaDoLead(lead);
  const rotulo = rotuloTemperatura(lead.temperatura) ?? (compacto ? "Sem leitura" : "Aguardando leitura");
  return <span className={`f2-lead-chip temperatura temperatura-${codigo} ${className}`.trim()}><i />{rotulo}</span>;
}

function FiltrosTemperatura({ leads, valor, onChange, className = "" }: { leads: LeadFunil2[]; valor: TemperaturaFiltro; onChange: (valor: TemperaturaFiltro) => void; className?: string }) {
  return <div className={`f2-temperatura-filtros ${className}`.trim()} role="group" aria-label="Filtrar por temperatura">
    <span>TEMPERATURA</span>
    <button type="button" className={valor === "todas" ? "ativo" : ""} onClick={() => onChange("todas")}>Todas <b>{leads.length}</b></button>
    {TEMPERATURAS.map((item) => <button type="button" key={item.codigo} className={`${valor === item.codigo ? "ativo " : ""}temperatura-${item.codigo}`} onClick={() => onChange(item.codigo)}><i />{item.rotulo} <b>{leads.filter((lead) => temperaturaDoLead(lead) === item.codigo).length}</b></button>)}
  </div>;
}

/* O pipe de visitas nunca teve campo de data nem de imovel, entao nao existe
   regra de estilo para eles. Ate o CSS ganhar a sua, o campo copia a borda e o
   espacamento do select que ja mora dentro do mesmo cartao. */
const CAMPO_VISITA = { width: "100%", marginTop: "7px", padding: "8px", border: "1px solid var(--f2-line)", borderRadius: "9px", background: "#fff", fontSize: "12px" } as const;

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

function Icone({ nome }: { nome: "quadro" | "dia" | "historico" | "leads" | "visitas" | "vendas" | "atividades" | "painel" | "config" | "sino" }) {
  const paths = nome === "quadro"
    ? <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></>
    : nome === "dia"
      ? <><path d="M4 6h16M4 12h16M4 18h11" /><path d="m18 17 2 2 3-4" /></>
      : nome === "historico" ? <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>
      : nome === "leads" ? <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M17 7h4M19 5v4"/></>
      : nome === "visitas" ? <><path d="M4 10 12 4l8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z"/></>
      : nome === "vendas" ? <><path d="M4 18V9m6 9V5m6 13v-7m4 7H2"/></>
      : nome === "atividades" ? <><path d="M9 11l2 2 4-4"/><path d="M5 4h14v16H5z"/><path d="M8 4V2m8 2V2"/></>
      : nome === "painel" ? <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></>
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
  const [negociacoes, setNegociacoes] = useState<NegociacaoFunil2[]>([]);
  const [aquario, setAquario] = useState<CandidatoAquarioFunil2[]>([]);
  const [operacao, setOperacao] = useState<OperacaoConfigFunil2 | null>(null);
  const [sara, setSara] = useState<SaraStatusFunil2>({ modo: null, runnerAtivo: false, analisesNoLaboratorio: 0, reavaliacaoAutomaticaFunil2: false });
  const [aba, setAba] = useState<"quadro" | "dia" | "leads" | "visitas" | "vendas" | "config">("quadro");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  /* Quem clica em "Conversa" quer a conversa, nao a ficha com um botao de chat
     dentro. Guardamos a intencao para a ficha ja abrir no mini chat. */
  const [abrirNoChat, setAbrirNoChat] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"pescar" | "visita" | "negociacao" | "descartar" | null>(null);
  // Aviso nunca abre sozinho: no celular um painel automático encobria o CRM.
  // O corretor abre pelo sino quando quiser e fecha sem perder o contexto.
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [temperaturaQuadro, setTemperaturaQuadro] = useState<TemperaturaFiltro>("todas");
  const [buscaQuadro, setBuscaQuadro] = useState("");
  const [ordenacaoQuadro, setOrdenacaoQuadro] = useState<"urgente" | "nome">("urgente");
  const [visaoQuadro, setVisaoQuadro] = useState<"andamento" | "ganhos" | "perdidos" | "triagem">("andamento");
  const [periodoQuadro, setPeriodoQuadro] = useState<"30" | "90" | "todos">("30");
  const [agoraQuadro] = useState(() => Date.now());
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [destinoMassa, setDestinoMassa] = useState("");
  const [historicoDetalhe, setHistoricoDetalhe] = useState<{ leadId: string; eventos: EventoFunil2[]; notas: NotaFunil2[] } | null>(null);
  const [limiteDia, setLimiteDia] = useState(50);
  /* Filtro do Meu Dia. Começa em "atrasadas": é o que o corretor tem que
     resolver agora. Os outros recortes existem, mas por escolha dele. */
  const [filtroDia, setFiltroDia] = useState<"atrasadas" | "urgentes" | "hoje" | "novos" | "visitas">("atrasadas");
  const trocarFiltroDia = useCallback((qual: "atrasadas" | "urgentes" | "hoje" | "novos" | "visitas") => {
    setFiltroDia(qual); setLimiteDia(50); /* volta ao topo: a lista é outra */
  }, []);

  const trocarAba = useCallback((proxima: "quadro" | "dia" | "leads" | "visitas" | "vendas" | "config") => {
    setAba(proxima);
    setSelecionados([]);
    setModoSelecao(false);
    setDestinoMassa("");
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const resposta = await api(accessToken);
    setCarregando(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o Funil."); return; }
    setLeads(resposta.json.leads ?? []);
    setMomentos(resposta.json.momentos ?? []);
    setEventos(resposta.json.eventos ?? []);
    setNotas(resposta.json.notas ?? []);
    setTagCatalogo(resposta.json.tagCatalogo ?? []);
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
      if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível carregar o Funil."); return; }
      const leadsCarregados = resposta.json.leads ?? [];
      setLeads(leadsCarregados);
      setMomentos(resposta.json.momentos ?? []);
      setEventos(resposta.json.eventos ?? []);
      setNotas(resposta.json.notas ?? []);
      setTagCatalogo(resposta.json.tagCatalogo ?? []);
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
  const leadHistoricoId = lead?.id ?? null;
  const leadHistoricoVersao = lead?.versao ?? null;
  useEffect(() => {
    if (!leadHistoricoId) return;
    let ativo = true;
    void fetch(`/api/funil2?historicoLeadId=${encodeURIComponent(leadHistoricoId)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => ({ ok: response.ok, json: await response.json().catch(() => ({})) as Payload }))
      .then((resposta) => {
        if (!ativo || !resposta.ok) return;
        setHistoricoDetalhe({ leadId: leadHistoricoId, eventos: resposta.json.eventos ?? [], notas: resposta.json.notas ?? [] });
      });
    return () => { ativo = false; };
  }, [accessToken, leadHistoricoId, leadHistoricoVersao]);
  const eventosLead = lead ? (historicoDetalhe?.leadId === lead.id ? historicoDetalhe.eventos : eventos.filter((e) => e.funil_lead_id === lead.id)) : [];
  const notasLead = lead ? (historicoDetalhe?.leadId === lead.id ? historicoDetalhe.notas : notas.filter((n) => n.funil_lead_id === lead.id)) : [];
  const atrasados = leads.filter((l) => situacaoPrazo(l.proxima_acao_em).classe === "atrasado").length;
  const urgentes = leads.filter((l) => situacaoPrazo(l.proxima_acao_em).classe === "urgente").length;
  const vencemHoje = leads.filter((l) => venceHoje(l)).length;
  const leadsNovos = leads.filter((l) => esperandoPrimeiraChamada(l)).length;
  const hojeSaoPaulo = dataIsoSaoPaulo(new Date());
  const visitasDoDia = visitas
    .filter((v) => {
      const aindaExigeAtencao = v.status === "agendada" || v.status === "confirmada";
      const fichaExiste = leads.some((leadAtual) => leadAtual.id === v.funil_lead_id);
      return aindaExigeAtencao && fichaExiste && dataIsoSaoPaulo(v.inicio_em) === hojeSaoPaulo;
    })
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
  const etapasDoQuadro = etapasAtivas.filter((e) => !["atualizar_manual", "legado"].includes(e.codigo));
  const momentosAtivos = momentos.filter((m) => m.ativo !== false);

  async function executar(action: string, body: Record<string, unknown>) {
    setBusy(true); setErro(null); setSucesso(null);
    try {
      const resposta = await api(accessToken, { method: "POST", body: JSON.stringify({ action, ...body }) });
      if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível concluir a ação."); return false; }
      setModal(null);
      if (action === "salvarVisita") setSucesso("Visita agendada com sucesso. Ela já está na Agenda.");
      await carregar(); return true;
    } catch {
      setErro("Não foi possível falar com o servidor. Confira a conexão e tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function atualizar(action: string, body: Record<string, unknown>) {
    if (!lead) return false;
    setBusy(true); setErro(null);
    const resposta = await api(accessToken, { method: "PATCH", body: JSON.stringify({ action, id: lead.id, versao: lead.versao, ...body }) });
    setBusy(false);
    if (!resposta.ok) { setErro(resposta.json.error ?? "Não foi possível atualizar a cópia."); return false; }
    await carregar(); return true;
  }

  /* Menu, arrasto e ação em massa convergem aqui. A interface não altera a
     etapa por conta própria: cada item passa pelo mesmo RPC canônico de
     atualização de momento, com versão otimista, e a carteira é relida ao fim. */
  async function movimentar(ids: string[], etapaCodigo: string) {
    const destino = momentosAtivos
      .filter((momento) => momento.etapa === etapaCodigo)
      .sort((a, b) => a.ordem - b.ordem)[0];
    if (!destino || ids.length === 0) {
      setErro("A etapa escolhida ainda não possui um momento ativo para receber negócios.");
      return false;
    }
    const itens = ids.map((id) => leads.find((item) => item.id === id)).filter((item): item is LeadFunil2 => Boolean(item));
    if (itens.length !== ids.length) {
      setErro("A seleção mudou enquanto a ação era preparada. Atualize a carteira e tente novamente.");
      return false;
    }
    setBusy(true); setErro(null); setSucesso(null);
    try {
      const resultados = await Promise.all(itens.map((item) => api(accessToken, {
        method: "PATCH",
        body: JSON.stringify({ action: "atualizarMomento", id: item.id, versao: item.versao, momentoCodigo: destino.codigo, prazoCombinado: null, observacao: "Movido pelo Funil" }),
      })));
      const falha = resultados.find((resultado) => !resultado.ok);
      if (falha) {
        setErro(falha.json.error ?? "Não foi possível mover todos os negócios selecionados.");
        await carregar();
        return false;
      }
      setSelecionados([]); setModoSelecao(false); setDestinoMassa("");
      await carregar();
      return true;
    } catch {
      setErro("Não foi possível falar com o servidor. Nenhum sucesso foi presumido; confira a carteira antes de repetir.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function alternarSelecao(id: string) {
    setSelecionados((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]);
  }

  const rotulosAba = {
    quadro: ["Negócios", "Etapa, temperatura, próxima ação e prazo em uma leitura direta."],
    dia: ["Meu Dia", "O que exige ação agora, ordenado pelo prazo real."],
    leads: ["Leads", "Carteira atual e contatos preservados, sem duplicar dados."],
    visitas: ["Visitas", "Compromissos ligados à mesma ficha e à Agenda."],
    vendas: ["Esteira", "Pós-fechamento, documentos e etapas da venda real."],
    config: ["Configurações", "Etapas, momentos, prazos e regras da operação."],
  } as const;
  const podeGerir = ["admin", "gestor"].includes(profile.role.toLowerCase());
  const termoQuadro = buscaQuadro.trim().toLocaleLowerCase("pt-BR");
  const limitePeriodo = periodoQuadro === "todos" ? null : agoraQuadro - Number(periodoQuadro) * 24 * 60 * 60 * 1000;
  const leadsDoPeriodo = leads.filter((item) => limitePeriodo === null || +new Date(item.atualizado_em) >= limitePeriodo);
  const ganhos = negociacoes.filter((item) => item.etapa === "venda");
  const perdidos = negociacoes.filter((item) => item.etapa === "perdida");

  return (
    <div className="f2-root funil-oficial" data-module="funil">
      <nav className="f2-nav f2-v3-modulos" aria-label="Módulos do Funil">
        <button type="button" className={aba === "dia" ? "ativo" : ""} onClick={() => trocarAba("dia")}><Icone nome="dia" /> Meu Dia <b>{atrasados}</b></button>
        <button type="button" className={aba === "quadro" ? "ativo" : ""} onClick={() => trocarAba("quadro")}><Icone nome="quadro" /> Negócios <b>{leads.length}</b></button>
        <button type="button" className={aba === "leads" ? "ativo" : ""} onClick={() => trocarAba("leads")}><Icone nome="leads" /> Leads <b>{leads.length}</b></button>
        <Link href="/agenda"><Icone nome="atividades" /> Atividades</Link>
        <button type="button" className={aba === "visitas" ? "ativo" : ""} onClick={() => trocarAba("visitas")}><Icone nome="visitas" /> Visitas <b>{visitas.length}</b></button>
        <button type="button" className={aba === "vendas" ? "ativo" : ""} onClick={() => trocarAba("vendas")}><Icone nome="vendas" /> Esteira</button>
        {podeGerir && <a href="/inteligencia"><Icone nome="painel" /> Painel</a>}
        {podeGerir && <button type="button" className={aba === "config" ? "ativo" : ""} onClick={() => trocarAba("config")}><Icone nome="config" /> Configurações</button>}
      </nav>

      <header className="f2-topo">
        <div className="f2-marca">
          <span className="f2-eyebrow">Funil</span>
          <h1>{rotulosAba[aba][0]}</h1>
          <p>{rotulosAba[aba][1]}</p>
        </div>
        <div className="f2-topo-acoes">
          <div className="f2-sino-wrap">
            <button type="button" className="f2-sino" onClick={() => setAvisosAbertos((v) => !v)} aria-label="Abrir avisos"><span>Avisos</span><b>{atrasados + urgentes}</b></button>
            {avisosAbertos && <CentralAtencao leads={leads} momentos={momentosAtivos} etapas={etapasAtivas} onAbrir={(id) => { setSelecionado(id); setAvisosAbertos(false); }} onMeuDia={() => { trocarAba("dia"); setAvisosAbertos(false); }} />}
          </div>
          <button type="button" className="f2-pescar" onClick={() => setModal("negociacao")}>Novo negócio</button>
        </div>
      </header>

      {erro && <div className="f2-erro">{erro}</div>}
      {sucesso && <div className="f2-sucesso" role="status"><span>{sucesso}</span><button type="button" onClick={() => { setAba("visitas"); setSucesso(null); }}>Ver visitas</button><button type="button" className="fechar" aria-label="Fechar confirmação" onClick={() => setSucesso(null)}>×</button></div>}
      {carregando && <div className="f2-loading">Carregando o Funil…</div>}

      {!carregando && aba === "quadro" && <main className="f2-main">
        <section className="f2-v3-toolbar" aria-label="Busca, filtros e ações do quadro">
          <label className="f2-v3-pipeline"><span>Pipeline</span><select aria-label="Pipeline" value="comercial" onChange={() => undefined}><option value="comercial">Comercial</option></select></label>
          <span className="f2-v3-separador" aria-hidden="true" />
          <div className="f2-v3-visoes" role="group" aria-label="Situação dos negócios">
            <button type="button" className={visaoQuadro === "andamento" ? "ativo" : ""} onClick={() => setVisaoQuadro("andamento")}>Em andamento <b>{leadsDoPeriodo.length}</b></button>
            <button type="button" className={visaoQuadro === "ganhos" ? "ativo" : ""} onClick={() => setVisaoQuadro("ganhos")}>Ganhos <b>{ganhos.length}</b></button>
            <button type="button" className={visaoQuadro === "perdidos" ? "ativo" : ""} onClick={() => setVisaoQuadro("perdidos")}>Perdidos <b>{perdidos.length}</b></button>
            <button type="button" className={visaoQuadro === "triagem" ? "ativo" : ""} onClick={() => setVisaoQuadro("triagem")}>Triagem <b>{aquario.length}</b></button>
          </div>
          <label className="f2-v3-busca"><span>Buscar</span><input type="search" value={buscaQuadro} onChange={(evento) => setBuscaQuadro(evento.target.value)} placeholder="Lead, telefone, nº ou interesse" /></label>
          <details className="f2-v3-filtros"><summary>Filtros{temperaturaQuadro !== "todas" ? " · 1" : ""}</summary><FiltrosTemperatura leads={leads} valor={temperaturaQuadro} onChange={setTemperaturaQuadro} /></details>
          <span className="f2-v3-quebra" aria-hidden="true" />
          <label className="f2-v3-ordenacao"><span>Ordenação</span><select aria-label="Ordenar negócios" value={ordenacaoQuadro} onChange={(evento) => setOrdenacaoQuadro(evento.target.value as "urgente" | "nome")}><option value="urgente">Atividade mais urgente</option><option value="nome">Nome do lead</option></select></label>
          <label className="f2-v3-periodo"><span>Período</span><select aria-label="Período do quadro" value={periodoQuadro} onChange={(evento) => setPeriodoQuadro(evento.target.value as "30" | "90" | "todos")}><option value="30">Últimos 30 dias · movimentação</option><option value="90">Últimos 90 dias · movimentação</option><option value="todos">Todo o período</option></select></label>
          <span className="f2-v3-separador" aria-hidden="true" />
          <button type="button" className={modoSelecao ? "ativo" : ""} onClick={() => { setModoSelecao((valor) => !valor); setSelecionados([]); }}>Selecionar</button>
          <details className="f2-v3-mais"><summary aria-label="Mais ações do quadro">•••</summary><div><button type="button" onClick={(evento) => { evento.currentTarget.closest("details")?.removeAttribute("open"); setModal("pescar"); }}>Capturar lead da Triagem</button><button type="button" onClick={() => trocarAba("vendas")}>Abrir Esteira</button><button type="button" onClick={(evento) => { evento.currentTarget.closest("details")?.removeAttribute("open"); document.querySelector<HTMLButtonElement>("#sara-fab")?.click(); }}>Abrir Sara</button></div></details>
        </section>
        {selecionados.length > 0 && <section className="f2-v3-bulk" role="region" aria-label="Ações em massa">
          <strong>{selecionados.length} negócio(s) selecionado(s)</strong>
          <label>Destino<select value={destinoMassa} onChange={(evento) => setDestinoMassa(evento.target.value)}><option value="">Escolha a etapa</option>{etapasDoQuadro.map((etapa) => <option key={etapa.codigo} value={etapa.codigo}>{etapa.rotulo}</option>)}</select></label>
          <button type="button" disabled={busy || !destinoMassa} onClick={() => void movimentar(selecionados, destinoMassa)}>Mover selecionados</button>
          <button type="button" className="secundario" onClick={() => { setSelecionados([]); setDestinoMassa(""); }}>Cancelar</button>
        </section>}

        {visaoQuadro !== "andamento" && <section className="f2-v3-recorte" aria-live="polite"><div><span>{visaoQuadro === "ganhos" ? "GANHOS" : visaoQuadro === "perdidos" ? "PERDIDOS" : "TRIAGEM"}</span><h2>{visaoQuadro === "ganhos" ? `${ganhos.length} negócios ganhos` : visaoQuadro === "perdidos" ? `${perdidos.length} negócios perdidos` : `${aquario.length} leads aguardando análise`}</h2><p>Este recorte usa os registros canônicos do Funil. Abra a ficha ou a Esteira para consultar todos os detalhes.</p></div>{visaoQuadro === "triagem" && <button type="button" onClick={() => setModal("pescar")}>Capturar lead</button>}{visaoQuadro !== "triagem" && <button type="button" onClick={() => trocarAba("vendas")}>Abrir Esteira</button>}</section>}
        {visaoQuadro === "andamento" && <section className="f2-board" aria-label="Etapas do Funil">
          {etapasDoQuadro.map((etapa) => {
            const daEtapa = leadsDoPeriodo.filter((l) => l.etapa === etapa.codigo && (temperaturaQuadro === "todas" || temperaturaDoLead(l) === temperaturaQuadro) && (!termoQuadro || `${l.nome} ${l.telefone ?? ""} ${l.origem_negocio_id} ${l.interesse ?? ""}`.toLocaleLowerCase("pt-BR").includes(termoQuadro))).sort((a, b) => ordenacaoQuadro === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));
            const valorEtapa = daEtapa.reduce((total, item) => total + (Number(item.valor) || 0), 0);
            return <div key={etapa.codigo} className={`f2-coluna etapa-${etapa.codigo}`} onDragOver={(evento) => evento.preventDefault()} onDrop={(evento) => { evento.preventDefault(); const id = evento.dataTransfer.getData("text/funil2-lead"); if (id) void movimentar([id], etapa.codigo); }}>
              <div className="f2-coluna-topo"><span aria-hidden="true" /><div><h2>{etapa.rotulo}</h2><p>{daEtapa.length} negócios · {valorEtapa > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valorEtapa) : "valor não informado"}</p></div><button type="button" aria-label={`Criar negócio em ${etapa.rotulo}`} onClick={() => setModal("negociacao")}>＋</button><b>{daEtapa.length}</b><details><summary aria-label={`Mais opções de ${etapa.rotulo}`}>•••</summary><div><button type="button" onClick={() => setModal("negociacao")}>Novo negócio</button></div></details></div>
              <div className="f2-lista">
                {daEtapa.slice(0, 100).map((item) => {
                  const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
                  const prazo = prazoDaAcao(item);
                  const cadencia = rotuloCadencia(item);
                  const tentativa = tentativaAtual(item);
                  const marcado = selecionados.includes(item.id);
                  return <article key={item.id} role="button" tabIndex={0} draggable={!modoSelecao} aria-pressed={modoSelecao ? marcado : undefined} className={`f2-card ${selecionado === item.id || marcado ? "selecionado" : ""}`} onDragStart={(evento) => { evento.dataTransfer.setData("text/funil2-lead", item.id); evento.dataTransfer.effectAllowed = "move"; }} onClick={() => { if (modoSelecao) alternarSelecao(item.id); else setSelecionado(item.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (modoSelecao) alternarSelecao(item.id); else setSelecionado(item.id); } }}>
                    {modoSelecao && <button type="button" className="f2-v3-check" aria-label={`${marcado ? "Remover" : "Adicionar"} ${item.nome} da seleção`} aria-pressed={marcado} onClick={(evento) => { evento.stopPropagation(); alternarSelecao(item.id); }}>{marcado && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}</button>}
                    <div className="f2-card-ident">
                      <i>{iniciais(item.nome)}</i>
                      <div><strong>{item.nome}</strong><span>{item.instancia_rotulo ?? item.corretor_nome ?? "Sem origem identificada"}</span></div>
                      <ChipTemperatura lead={item} compacto />
                      <details className="f2-card-menu" onClick={(evento) => evento.stopPropagation()}>
                        <summary aria-label={`Ações de ${item.nome}`}>•••</summary>
                        <div>
                          <button type="button" onClick={() => { setAbrirNoChat(true); setSelecionado(item.id); }}>Abrir conversa</button>
                          <button type="button" onClick={() => setSelecionado(item.id)}>Abrir ficha</button>
                          <label><span>Mover para</span><select aria-label={`Mover ${item.nome} para outra etapa`} value="" disabled={busy} onChange={(evento) => { const destino = evento.target.value; evento.currentTarget.closest("details")?.removeAttribute("open"); if (destino) void movimentar([item.id], destino); }}><option value="">Escolha a etapa</option>{etapasDoQuadro.filter((alvo) => alvo.codigo !== item.etapa).map((alvo) => <option key={alvo.codigo} value={alvo.codigo}>{alvo.rotulo}</option>)}</select></label>
                        </div>
                      </details>
                    </div>
                    <div className="f2-card-linha momento"><span aria-hidden="true">◎</span><b><i />{momento?.rotulo ?? item.momento_codigo}</b></div>
                    <div className="f2-card-linha acao"><span aria-hidden="true">□</span><strong>{tentativa ? `WhatsApp · Tentativa ${tentativa}` : item.acao_rotulo || "Sem próxima atividade"}</strong><button type="button" onClick={(evento) => { evento.stopPropagation(); setAbrirNoChat(true); setSelecionado(item.id); }} aria-label={`Abrir conversa com ${item.nome}`}>○</button></div>
                    <div className="f2-card-linha prazo"><span aria-hidden="true">◷</span><em className={prazo.classe}>{prazo.rotulo}</em>{cadencia && <small>{cadencia}</small>}</div>
                    <div className="f2-card-tags"><span aria-hidden="true">◇</span><InteresseLead lead={item} /></div>
                  </article>;
                })}
                {daEtapa.length > 100 && <div className="f2-vazio">Mais {daEtapa.length - 100} lead(s) nesta etapa. Consulte “Todos os Leads”.</div>}
                {daEtapa.length === 0 && <div className="f2-vazio">Nenhum lead-cópia nesta etapa.</div>}
              </div>
            </div>;
          })}
        </section>}
      </main>}

      {!carregando && aba === "dia" && <main className="f2-dia">
        <section className="f2-dia-controles" aria-label="Filtros do Meu Dia">
          <div className="f2-indicadores">
            <button type="button" className={`vermelho${filtroDia === "atrasadas" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "atrasadas"} onClick={() => trocarFiltroDia("atrasadas")}><b>{atrasados}</b><span>ações atrasadas</span></button>
            <button type="button" className={`amarelo${filtroDia === "urgentes" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "urgentes"} onClick={() => trocarFiltroDia("urgentes")}><b>{urgentes}</b><span>vencem em até 2h</span></button>
            <button type="button" className={`laranja${filtroDia === "hoje" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "hoje"} onClick={() => trocarFiltroDia("hoje")}><b>{vencemHoje}</b><span>para fazer hoje</span></button>
            <button type="button" className={`roxo${filtroDia === "novos" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "novos"} onClick={() => trocarFiltroDia("novos")}><b>{leadsNovos}</b><span>leads para chamar</span></button>
            <button type="button" className={`verde${filtroDia === "visitas" ? " f2-ind-ativo" : ""}`} aria-pressed={filtroDia === "visitas"} onClick={() => trocarFiltroDia("visitas")}><b>{visitasHoje}</b><span>visitas do dia</span></button>
          </div>
          <details className="f2-como-recolhido"><summary>Como usar o Meu Dia</summary><div className="f2-como"><span><i>1</i><b>Siga a ordem</b><small>O primeiro item é o mais urgente.</small></span><span><i>2</i><b>Execute a ação</b><small>WhatsApp, visita, produto ou retorno.</small></span><span><i>3</i><b>Conclua no Funil</b><small>A Sara relê e prepara o próximo passo.</small></span></div></details>
        </section>
        {aFazer[0] && <section className="f2-proxima"><div><span>PRIMEIRO DA FILA</span><h3>{aFazer[0].nome}</h3><div className="f2-proxima-chips"><b>{etapasAtivas.find((e) => e.codigo === aFazer[0].etapa)?.rotulo}</b><b>{momentosAtivos.find((m) => m.codigo === aFazer[0].momento_codigo)?.rotulo}</b><ChipTemperatura lead={aFazer[0]} /><small>{prazoDaAcao(aFazer[0]).rotulo}</small></div><p>{acaoVisivel(aFazer[0])}</p></div><button type="button" onClick={() => setSelecionado(aFazer[0].id)}>Atender agora</button></section>}
        <div className="f2-dia-cab"><div><h2>{mostrandoVisitas ? "Agenda do dia" : "Do mais antigo para o mais recente"}</h2></div><b>{totalDoFiltro} {filtroAtivo.rotulo}</b></div>
        <div className={`f2-dia-colunas ${mostrandoVisitas ? "visitas" : "leads"}`}>{mostrandoVisitas ? <><span></span><span>Cliente</span><span>Imóvel</span><span>Situação</span><span>Horário</span><span></span></> : <><span></span><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Temperatura</span><span>Próxima ação</span><span>Tempo</span><span></span></>}</div>
        <div className="f2-dia-lista">
          {/* Visita entra na mesma lista, com as colunas trocadas: o corretor
              continua vendo uma fila só e clicando para abrir o cliente. */}
          {mostrandoVisitas && visitasDoDia.slice(0, limiteDia).map((visita, index) => {
            const leadDaVisita = leads.find((l) => l.id === visita.funil_lead_id);
            const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_OPERACAO, hour: "2-digit", minute: "2-digit" }).format(new Date(visita.inicio_em));
            const situacao: Record<string, string> = { agendada: "Agendada", confirmada: "Confirmada", realizada: "Realizada", cancelada: "Cancelada", nao_compareceu: "Não compareceu" };
            return <button key={visita.id} type="button" className="f2-dia-item visita" disabled={!leadDaVisita} onClick={() => leadDaVisita && setSelecionado(leadDaVisita.id)}>
              <span className="f2-dia-ordem">{index + 1}</span><div><strong>{leadDaVisita?.nome ?? "Lead removido"}</strong><small>{leadDaVisita?.corretor_nome ?? "Sem corretor"}</small></div><div><span>IMÓVEL</span><b>{visita.imovel || "—"}</b></div><div><span>SITUAÇÃO</span><b>{situacao[visita.status] ?? visita.status}</b></div><em className={visita.status === "cancelada" || visita.status === "nao_compareceu" ? "atrasado" : "no-prazo"}>{hora}</em><i>{leadDaVisita ? "Abrir cliente" : "Sem ficha"}</i>
            </button>;
          })}
          {mostrandoVisitas && visitasHoje > limiteDia && <button type="button" className="f2-dia-mais" onClick={() => setLimiteDia((atual) => atual + 50)}>Mostrar mais 50 · ainda faltam {visitasHoje - limiteDia}</button>}
          {aFazer.slice(0, limiteDia).map((item) => {
            const momento = momentosAtivos.find((m) => m.codigo === item.momento_codigo);
            const prazo = prazoDaAcao(item);
            const tentativa = tentativaAtual(item);
            return <button key={item.id} type="button" className="f2-dia-item lead" onClick={() => setSelecionado(item.id)}>
              <span className="f2-dia-ordem">{iniciais(item.nome)}</span><div><strong>{item.nome}</strong><small>{item.corretor_nome ?? "Sem corretor"}{item.instancia_rotulo ? <em className="f2-instancia" title={`Contato saindo por ${item.instancia_rotulo}`}> · {item.instancia_rotulo}</em> : null}</small></div><div><span>ETAPA</span><b>{etapasAtivas.find((e) => e.codigo === item.etapa)?.rotulo}</b></div><div><span>MOMENTO</span><b>{momento?.rotulo}</b></div><ChipTemperatura lead={item} /><div className="f2-dia-acao"><b>{acaoVisivel(item)}</b><InteresseLead lead={item} /></div><em className={prazo.classe}>{prazo.rotulo}</em><i>{tentativa ? `Enviar tentativa ${tentativa}` : "Executar ação"}</i>
            </button>;
          })}
          {aFazer.length > limiteDia && <button type="button" className="f2-dia-mais" onClick={() => setLimiteDia((atual) => atual + 50)}>Mostrar mais 50 · ainda faltam {aFazer.length - limiteDia}</button>}
          {totalDoFiltro === 0 && <div className="f2-dia-vazio"><b>{filtroDia === "atrasadas" ? "Seu Meu Dia está em dia." : "Nada neste recorte."}</b><span>{filtroAtivo.vazio}</span></div>}
        </div>
      </main>}

      {!carregando && aba === "leads" && <TodosLeads leads={leads} momentos={momentosAtivos} etapas={etapasAtivas} accessToken={accessToken} busy={busy} onAbrir={(id) => setSelecionado(id)} onTrazer={(leadId, etapa, momento) => executar("trazerLeadAntigo", { leadId, etapa, momento })} />}
      {!carregando && aba === "visitas" && <PipeVisitas visitas={visitas} leads={leads} momentos={momentosAtivos} busy={busy} onNova={() => setModal("visita")} onAbrir={setSelecionado} onSalvar={(visita) => void executar("salvarVisita", visita)} />}
      {/* A Esteira canônica entra como módulo funcional, sem duplicar o Funil. */}
      {!carregando && aba === "vendas" && <main className="f2-pagina f2-esteira-oficial"><SalesProcessView accessToken={accessToken} sessionRole={profile.role} /></main>}
      {!carregando && aba === "config" && <Configuracoes etapas={etapas} momentos={momentos} operacao={operacao} sara={sara} busy={busy} onEtapa={(dados) => executar("configurarEtapa", dados)} onMomento={(dados) => executar("configurarMomento", dados)} onOperacao={(dados) => executar("configurarOperacao", dados)} />}

      {modal === "pescar" && <ModalPescar candidatos={aquario} busy={busy} onFechar={() => setModal(null)} onPescar={(negocioId) => void executar("pescar", { negocioId })} />}
      {modal === "visita" && <ModalVisita key={lead?.id ?? "nova-visita"} leads={leads} leadFoco={lead} busy={busy} erroExterno={erro} onFechar={() => setModal(null)} onSalvar={(dados) => executar("salvarVisita", dados)} />}
      {modal === "negociacao" && <ModalNegociacao leads={leads} leadFoco={lead} busy={busy} onFechar={() => setModal(null)} onSalvar={(dados) => void executar("salvarNegociacao", dados)} />}
      {modal === "descartar" && lead && <ModalDescartar nome={lead.nome} busy={busy} onFechar={() => setModal(null)} onDescartar={(motivo, detalhe) => { void atualizar("descartar", { motivo, detalhe }).then((ok) => { if (ok) { setModal(null); setSelecionado(null); } }); }} />}

      {lead && momentoAtual && <Detalhe key={`${lead.id}:${lead.versao}`}
        accessToken={accessToken} lead={lead} momento={momentoAtual} momentos={momentosAtivos} etapas={etapasAtivas} eventos={eventosLead} notas={notasLead} visitas={visitas.filter((visita) => visita.funil_lead_id === lead.id)} tagCatalogo={tagCatalogo} busy={busy}
        abrirNoChat={abrirNoChat}
        onFechar={() => { setSelecionado(null); setAbrirNoChat(false); }}
        onMomento={(codigo, prazo, obs) => void atualizar("atualizarMomento", { momentoCodigo: codigo, prazoCombinado: prazo || null, observacao: obs })}
        onTemperatura={(temperatura) => atualizar("atualizarTemperatura", { temperatura })}
        onAgendarVisita={() => setModal("visita")}
        onGerarNegociacao={() => setModal("negociacao")}
        onAbrirEsteira={() => { setSelecionado(null); trocarAba("vendas"); }}
        onDescartar={() => setModal("descartar")}
        onSalvarNota={(texto) => executar("salvarNota", { leadId: lead.id, texto })}
        onTagSalva={() => void carregar()}
      />}
    </div>
  );
}

function CentralAtencao({ leads, momentos, etapas, onAbrir, onMeuDia }: {
  leads: LeadFunil2[]; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[];
  onAbrir: (id: string) => void; onMeuDia: () => void;
}) {
  const ordenados = [...leads].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));
  const atrasados = ordenados.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "atrasado");
  const urgentes = ordenados.filter((lead) => situacaoPrazo(lead.proxima_acao_em).classe === "urgente");
  const excecoes = [...atrasados, ...urgentes].sort((a, b) => +new Date(a.proxima_acao_em) - +new Date(b.proxima_acao_em));
  return <div className="f2-avisos-pop">
    <span className="f2-eyebrow">CENTRAL DE ATENÇÃO</span><h3>O que pede ação agora</h3>
    <div className="f2-avisos-resumo f2-avisos-resumo-excecoes"><article className="vermelho"><b>{atrasados.length}</b><span>atrasadas</span></article><article className="amarelo"><b>{urgentes.length}</b><span>até 2h</span></article></div>
    <div className="f2-avisos-lista">{excecoes.slice(0, 5).map((lead) => {
      const prazo = prazoDaAcao(lead);
      return <button type="button" key={lead.id} onClick={() => onAbrir(lead.id)}><span><b>{lead.nome}</b><small>{etapas.find((etapa) => etapa.codigo === lead.etapa)?.rotulo} · {momentos.find((momento) => momento.codigo === lead.momento_codigo)?.rotulo}</small></span><em className={prazo.classe}>{acaoVisivel(lead)} · {prazo.rotulo}</em></button>;
    })}</div>
    <button type="button" className="f2-avisos-dia" onClick={onMeuDia}>Abrir Meu Dia completo</button>
  </div>;
}

/* Um lead da carteira antiga: já foi trabalhado (tem dono) mas nunca virou
   card no Funil. Vem do endpoint /api/funil2/carteira, não do payload
   principal — são 1.515 e ninguém quer carregá-los a cada abertura de tela. */
type LeadCarteiraAntiga = {
  lead_id: number; negocio_id: number | null; nome: string | null; telefone: string | null;
  corretor_id: number | null; corretor_nome: string | null;
  criado_em: string; ultima_mensagem_em: string | null; mensagens: number;
};

function TodosLeads({ leads, momentos, etapas, accessToken, busy, onAbrir, onTrazer }: { leads: LeadFunil2[]; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; accessToken: string; busy: boolean; onAbrir: (id: string) => void; onTrazer: (leadId: number, etapa: string, momento: string) => Promise<boolean> }) {
  const [filtro, setFiltro] = useState("ativos");
  const [situacao, setSituacao] = useState("todas");
  const [temperatura, setTemperatura] = useState<TemperaturaFiltro>("todas");
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
    if (temperatura !== "todas" && temperaturaDoLead(lead) !== temperatura) return false;
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
  return <main className="f2-pagina"><CabecalhoPagina titulo="Todos os Leads" texto="Encontre e compare a carteira por cliente, etapa, momento, ação e prazo." />
    <div className="f2-leads-busca"><label><span>Buscar lead</span><input value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} placeholder="Nome ou telefone" aria-label="Buscar lead por nome ou telefone" /></label><label><span>Situação do prazo</span><select value={situacao} onChange={(event) => { setSituacao(event.target.value); setPagina(1); }}><option value="todas">Todos os prazos</option><option value="atrasado">Atrasados</option><option value="urgente">Vencem em até 2h</option><option value="no-prazo">No prazo</option></select></label><b>{filtrados.length} encontrado(s)</b></div>
    <details className="f2-filtros-avancados">
      <summary>Filtros de etapa e temperatura <b>{filtro === "ativos" && temperatura === "todas" ? "Sem filtros adicionais" : "Filtro ativo"}</b></summary>
      <div className="f2-leads-filtros"><button type="button" className={filtro === "ativos" ? "ativo" : ""} onClick={() => { setFiltro("ativos"); setPagina(1); }}>Ativos · {leads.filter((lead) => lead.etapa !== "legado").length}</button>{etapas.map((etapa) => <button type="button" className={filtro === etapa.codigo ? "ativo" : ""} onClick={() => { setFiltro(etapa.codigo); setPagina(1); }} key={etapa.codigo}>{etapa.rotulo} · {leads.filter((lead) => lead.etapa === etapa.codigo).length}</button>)}<span>{atrasados} atrasado(s)</span></div>
      <FiltrosTemperatura leads={leads.filter((lead) => filtro === "ativos" ? lead.etapa !== "legado" : lead.etapa === filtro)} valor={temperatura} onChange={(valor) => { setTemperatura(valor); setPagina(1); }} className="f2-temperatura-leads" />
    </details>
    <div className="f2-tabela-cab"><span>Cliente</span><span>Etapa</span><span>Momento</span><span>Temperatura</span><span>Próxima ação</span><span>Prazo</span><span></span></div>
    <div className="f2-tabela f2-tabela-compacta">{exibidos.map((lead) => { const prazo = prazoDaAcao(lead); return <article key={lead.id} role="button" tabIndex={0} onClick={() => onAbrir(lead.id)} onKeyDown={(evento) => { if (evento.key === "Enter" || evento.key === " ") onAbrir(lead.id); }} className={`f2-lead-linha prazo-${prazo.classe}`}><div className="f2-nome"><i>{iniciais(lead.nome)}</i><span><b>{lead.nome}</b><small>{lead.corretor_nome ?? "Responsável não definido"}{lead.interesse ? ` · ${lead.interesse}` : ""}</small></span></div><span className="f2-lead-chip etapa"><i />{etapas.find((e) => e.codigo === lead.etapa)?.rotulo ?? "Revisar etapa"}</span><span className="f2-lead-chip momento">{momentos.find((m) => m.codigo === lead.momento_codigo)?.rotulo ?? "Revisar momento"}</span><ChipTemperatura lead={lead} /><strong className="f2-lead-acao">{lead.acao_rotulo}</strong><em className={prazo.classe}>{prazo.rotulo}</em><div className="f2-lead-acoes">{linkWhatsapp(lead.telefone) && <a href={linkWhatsapp(lead.telefone)!} target="_blank" rel="noreferrer" onClick={(evento) => evento.stopPropagation()} aria-label={`Chamar ${lead.nome} no WhatsApp`}>☎</a>}<button type="button" className="primario" onClick={(evento) => { evento.stopPropagation(); onAbrir(lead.id); }}>Abrir ficha</button></div></article>; })}{filtrados.length === 0 && <div className="f2-sem-resultado"><b>Nenhum lead encontrado.</b><span>Revise a busca ou os filtros selecionados.</span></div>}</div>
    {filtrados.length > porPagina && <div className="f2-paginacao"><button type="button" disabled={paginaSegura === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))}>← Anterior</button><span>Página {paginaSegura} de {totalPaginas}</span><button type="button" disabled={paginaSegura === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}>Próxima →</button></div>}

    {/* Carteira antiga: mesma busca, seção separada. Só aparece quando há algo
        a mostrar — seção vazia permanente vira ruído que ninguém mais lê. */}
    {busca.trim().length >= 3 && (buscandoCarteira || carteira.length > 0) && <section className="f2-carteira-antiga">
      <header>
        <div><span className="f2-eyebrow">DA SUA CARTEIRA ANTIGA</span><h3>Fora do Funil</h3><p>Clientes que você já trabalhou e que nunca viraram card aqui. Traga para o Funil quando voltar a atender.</p></div>
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
      {!buscandoCarteira && carteira.length === 0 && <div className="f2-sem-resultado"><b>Nada na carteira antiga.</b><span>Nenhum cliente seu fora do Funil bate com essa busca.</span></div>}
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
  return <Modal titulo="Trazer para o Funil" texto={`${alvo.nome ?? "Este cliente"} volta a aparecer no Funil na etapa que você escolher. O histórico completo da conversa fica visível na ficha.`} onFechar={onFechar}>
    <div className="f2-form-grid">
      <label>Etapa<select value={etapa} onChange={(event) => trocarEtapa(event.target.value)}>{etapasPermitidas.map((e) => <option value={e.codigo} key={e.codigo}>{e.rotulo}</option>)}</select></label>
      <label>Momento<select value={momento} onChange={(event) => setMomento(event.target.value)}>{momentosDaEtapa.map((m) => <option value={m.codigo} key={m.codigo}>{m.rotulo}</option>)}</select></label>
    </div>
    <p className="f2-nota-modal">“Lead novo” não aparece aqui: quem já conversou com você não está em primeira abordagem.</p>
    <button type="button" className="f2-modal-confirmar" disabled={busy || !etapa || !momento} onClick={() => onConfirmar(etapa, momento)}>{busy ? "Trazendo…" : "Trazer para o funil"}</button>
  </Modal>;
}

function PipeVisitas({ visitas, leads, momentos, busy, onNova, onAbrir, onSalvar }: { visitas: VisitaFunil2[]; leads: LeadFunil2[]; momentos: MomentoFunil2[]; busy: boolean; onNova: () => void; onAbrir: (id: string) => void; onSalvar: (v: Record<string, unknown>) => void }) {
  const [modo, setModo] = useState<"agenda" | "quadro">("agenda");
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(relogio);
  }, []);
  const hoje = dataIsoSaoPaulo(new Date(agora));
  const ativas = visitas.filter((visita) => visita.status === "agendada" || visita.status === "confirmada");
  const gruposAgenda = [
    { codigo: "atrasadas", rotulo: "Atrasadas para atualizar", itens: ativas.filter((visita) => +new Date(visita.inicio_em) < agora) },
    { codigo: "hoje", rotulo: "Hoje", itens: ativas.filter((visita) => +new Date(visita.inicio_em) >= agora && dataIsoSaoPaulo(visita.inicio_em) === hoje) },
    { codigo: "proximas", rotulo: "Próximas", itens: ativas.filter((visita) => +new Date(visita.inicio_em) >= agora && dataIsoSaoPaulo(visita.inicio_em) !== hoje) },
  ];
  const colunas = [
    { codigo: "agendada", rotulo: "Agendadas" }, { codigo: "confirmada", rotulo: "Confirmadas" },
    { codigo: "realizada", rotulo: "Realizadas" }, { codigo: "encerrada", rotulo: "Canceladas / faltou" },
  ];
  const grupos = modo === "agenda" ? gruposAgenda : colunas.map((coluna) => ({ ...coluna, itens: visitas.filter((visita) => coluna.codigo === "encerrada" ? ["cancelada", "nao_compareceu"].includes(visita.status) : visita.status === coluna.codigo) }));
  const gruposVisiveis = grupos.filter((grupo) => grupo.itens.length > 0);
  return <main className="f2-pagina"><CabecalhoPagina titulo="Visitas" texto="Agenda e Pipe de Visitas no mesmo lugar: veja primeiro atrasos, compromissos de hoje e próximos horários." acao="+ Nova visita" onAcao={onNova} />
    <div className="f2-visitas-modos" role="group" aria-label="Modo de visualização das visitas"><button type="button" className={modo === "agenda" ? "ativo" : ""} onClick={() => setModo("agenda")}>Agenda</button><button type="button" className={modo === "quadro" ? "ativo" : ""} onClick={() => setModo("quadro")}>Quadro por status</button></div>
    <details className="f2-visita-regra"><summary>Entender o fluxo de visitas</summary><div><b>Fluxo automático</b><span>Agendada → confirmar 24h antes</span><span>Realizada → feedback em até 2h</span><span>Cancelada/faltou → remarcar em até 12h</span></div></details>
    <section className={`f2-pipe ${modo === "agenda" ? "f2-agenda-visitas" : ""}`}>{gruposVisiveis.map((grupo) => <div key={grupo.codigo}><header><h3>{grupo.rotulo}</h3><b>{grupo.itens.length}</b></header>{grupo.itens.map((visita) => { const lead = leads.find((item) => item.id === visita.funil_lead_id); return <VisitaCard key={visita.id} visita={visita} lead={lead} momentoRotulo={momentos.find((momento) => momento.codigo === lead?.momento_codigo)?.rotulo} agora={agora} busy={busy} onAbrir={onAbrir} onSalvar={onSalvar} />; })}</div>)}{gruposVisiveis.length === 0 && <div className="f2-sem-resultado"><b>Nenhuma visita neste recorte.</b><span>Não há pendência para mostrar agora.</span></div>}</section>
  </main>;
}

/* VISITA SE CORRIGE NA PROPRIA VISITA.
   Ate aqui o cartao so deixava mudar o status e o feedback. Quem marcava a hora
   errada ou trocava o imovel nao tinha como consertar: criava uma segunda
   visita e o pipe passava a mostrar duas para o mesmo cliente. Como a API ja
   faz upsert por id, mandar data e imovel editados corrige a mesma visita. */
function VisitaCard({ visita, lead, momentoRotulo, agora, busy, onAbrir, onSalvar }: { visita: VisitaFunil2; lead?: LeadFunil2; momentoRotulo?: string; agora: number; busy: boolean; onAbrir: (id: string) => void; onSalvar: (v: Record<string, unknown>) => void }) {
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState(visita.status);
  const [feedback, setFeedback] = useState(visita.observacao ?? "");
  const [inicio, setInicio] = useState(paraCampoLocal(visita.inicio_em));
  const [imovel, setImovel] = useState(visita.imovel ?? "");
  const precisaFeedback = status === "realizada";
  const precisaAtualizar = ["agendada", "confirmada"].includes(visita.status) && +new Date(visita.inicio_em) < agora;
  const rotulos: Record<VisitaFunil2["status"], string> = { agendada: "Agendada", confirmada: "Confirmada", realizada: "Realizada", cancelada: "Cancelada", nao_compareceu: "Não compareceu" };
  return <article className={!lead ? "f2-visita-vinculo-ausente" : precisaAtualizar ? "f2-visita-atrasada" : ""}><span>{dataCurta(visita.inicio_em)}</span><h4>{lead?.nome ?? "Correção administrativa"}</h4><p>{visita.imovel || "Imóvel não informado"}</p><em className={`f2-visita-status status-${visita.status}`}>{precisaAtualizar ? "Precisa atualizar" : rotulos[visita.status]}</em>
    {lead && <div className="f2-visita-contexto"><span><small>MOMENTO</small><b>{momentoRotulo ?? lead.momento_codigo}</b></span><span><small>TEMPERATURA</small><ChipTemperatura lead={lead} /></span></div>}
    {lead && <button type="button" className="f2-visita-abrir" onClick={() => onAbrir(lead.id)}>Abrir ficha de {lead.nome}</button>}
    {!lead && <small>A ficha vinculada não está ativa. Corrija o status da visita sem apagar o histórico.</small>}
    {!editando && <button type="button" className={`f2-visita-editar${precisaAtualizar || !lead ? " primario" : ""}`} onClick={() => setEditando(true)}>{precisaAtualizar || !lead ? "Atualizar situação" : "Editar visita"}</button>}
    {editando && <div className="f2-visita-form"><input type="datetime-local" style={CAMPO_VISITA} disabled={busy} value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Data e hora da visita" />
    <input type="text" style={CAMPO_VISITA} disabled={busy} value={imovel} onChange={(e) => setImovel(e.target.value)} maxLength={120} placeholder="Imóvel ou unidade" aria-label="Imóvel da visita" />
    <select disabled={busy} value={status} onChange={(e) => setStatus(e.target.value as VisitaFunil2["status"])}><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option><option value="nao_compareceu">Não compareceu</option></select>
    {precisaFeedback && <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback obrigatório: interesse, objeção e próximo passo" maxLength={500} />}
    <div className="f2-visita-form-acoes"><button type="button" onClick={() => setEditando(false)}>Cancelar</button><button type="button" disabled={busy || !inicio || (precisaFeedback && feedback.trim().length < 10)} onClick={() => onSalvar({ id: visita.id, leadId: visita.funil_lead_id, inicioEm: inicio, imovel: imovel.trim() || visita.imovel, status, observacao: feedback || null, empreendimentoId: visita.empreendimento_id ?? null, unidade: visita.unidade ?? null, comGerente: visita.com_gerente === true, gerenteId: visita.gerente_id ?? null, fimEm: visita.fim_em ?? null })}>{busy ? "Salvando…" : precisaFeedback && !visita.feedback_em ? "Registrar resultado" : "Salvar atualização"}</button></div></div>}
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
  const [secao, setSecao] = useState<"etapas" | "momentos" | "operacao">("etapas");
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
  return <main className="f2-pagina f2-config-pagina"><CabecalhoPagina titulo="Regras do CRM" texto="Configurações da operação: etapas, momentos, prazos, Sara e limites oficiais." />
    <section className="f2-sara-status f2-sara-status-compacto"><div><span className="f2-eyebrow">PAPEL DA SARA</span><h3>Ela lê, classifica e fiscaliza.</h3><small>O estado de cada função aparece separadamente, sem termos técnicos.</small>{!sara.reavaliacaoAutomaticaFunil2 && <p className="f2-sara-aviso">Reavaliação automática do Funil ainda não conectada.</p>}<details><summary>Como funciona</summary><p>Quando o D-API registra mensagem nova, a Sara relê a conversa, escolhe um momento oficial e recalcula ação e prazo. Ela está em <b>{sara.modo ?? "estado indisponível"}</b>; o runner está <b>{sara.runnerAtivo ? "ligado" : "desligado"}</b>. Ela não envia por você.</p></details></div><div className="f2-sara-estados"><span className="ativo"><b>Observação</b><small>Ativa</small></span><span className={sara.reavaliacaoAutomaticaFunil2 ? "ativo" : "pendente"}><b>Classificação</b><small>{sara.reavaliacaoAutomaticaFunil2 ? "Ativa" : "Inativa"}</small></span><span><b>Envio automático</b><small>Inativo</small></span></div></section>
    <nav className="f2-config-nav" aria-label="Seções das regras">
      <button type="button" className={secao === "etapas" ? "ativo" : ""} onClick={() => setSecao("etapas")}>Etapas</button>
      <button type="button" className={secao === "momentos" ? "ativo" : ""} onClick={() => setSecao("momentos")}>Momentos e prazos</button>
      <button type="button" className={secao === "operacao" ? "ativo" : ""} onClick={() => setSecao("operacao")}>Regras da operação</button>
    </nav>
    {secao === "etapas" && <section className="f2-config-grid uma-coluna">
      <div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">ETAPAS</span><h3>Colunas do funil</h3><small>{etapas.filter((e) => e.ativo).length} ativas</small></div><button type="button" onClick={() => { setEtapa(etapaVazia); setEditor("etapa"); }}>+ Criar</button></div>
        <div className="f2-config-lista">{etapas.map((e) => <article key={e.codigo} className={!e.ativo ? "inativo" : ""}><b>{e.ordem}</b><span><strong>{e.rotulo}</strong><small>{e.ajuda || "Sem descrição"}</small></span><button type="button" onClick={() => { setEtapa({...e}); setEditor("etapa"); }}>Editar</button><button type="button" disabled={busy || !e.ativo} title="Etapas com leads ou momentos ativos não podem ser desativadas" onClick={() => void onEtapa({...e,ativo:false})}>Desativar</button></article>)}</div>
      </div>
    </section>}
    {secao === "momentos" && <section className="f2-config-grid uma-coluna">
      <div className="f2-config-bloco"><div className="f2-config-titulo"><div><span className="f2-eyebrow">MOMENTOS</span><h3>Condutas e prazos</h3><select aria-label="Filtrar momentos por etapa" value={filtroMomento} onChange={(e) => setFiltroMomento(e.target.value)}><option value="todos">Todas as etapas</option>{etapas.filter((e) => e.ativo).map((e) => <option key={e.codigo} value={e.codigo}>{e.rotulo}</option>)}</select></div><button type="button" onClick={() => { setMomento(momentoVazio); setEditor("momento"); }}>+ Criar</button></div>
        <div className="f2-config-lista">{momentosVisiveis.map((m) => <article key={m.codigo} className={m.ativo === false ? "inativo" : ""}><b>{m.ordem}</b><span><strong>{m.rotulo}</strong><small>{etapas.find((e) => e.codigo === m.etapa)?.rotulo ?? m.etapa} · {m.acao_rotulo} · {m.prazo_rotulo}</small></span><button type="button" onClick={() => { setMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoHoras:(m.prazo_minutos ?? 1440)/60,semPrazo:m.prazo_minutos == null,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:m.ativo !== false}); setEditor("momento"); }}>Editar</button><button type="button" disabled={busy || m.ativo === false} title="Momentos usados por leads não podem ser desativados" onClick={() => void onMomento({codigo:m.codigo,etapa:m.etapa,rotulo:m.rotulo,descricao:m.descricao,acaoRotulo:m.acao_rotulo,prazoMinutos:m.prazo_minutos,ordem:m.ordem,exigeDapi:m.exige_dapi,ativo:false})}>Desativar</button></article>)}</div>
      </div>
    </section>}
    {secao === "operacao" && <details className="f2-config-operacao" open><summary><span><span className="f2-eyebrow">REGRAS DA OPERAÇÃO</span><b>Horários, avisos e suspensões</b></span></summary><div className="f2-config-operacao-intro"><p><b>Automações executa a distribuição.</b> Aqui ficam os limites que CRM e aplicativo respeitam; esta tela nunca liga abordagem automática.</p><a href="/automacoes">Abrir distribuição em Automações →</a></div><form onSubmit={(event) => { event.preventDefault(); void onOperacao(regra); }}>
      <fieldset><legend>Distribuição manual</legend><label>Início oficial<input type="time" value={regra.horarioInicio} onChange={(e)=>setRegra({...regra,horarioInicio:e.target.value})}/></label><label>Fim oficial<input type="time" value={regra.horarioFim} onChange={(e)=>setRegra({...regra,horarioFim:e.target.value})}/></label><label>Presença válida (min)<input type="number" min="5" max="120" value={regra.presencaTtlMin} onChange={(e)=>setRegra({...regra,presencaTtlMin:Number(e.target.value)})}/></label><label>Primeira abordagem (min)<input type="number" min="1" max="30" value={regra.primeiraAbordagemMin} onChange={(e)=>setRegra({...regra,primeiraAbordagemMin:Number(e.target.value)})}/></label></fieldset>
      <fieldset><legend>Visitas e avisos</legend><label>Feedback da visita (min)<input type="number" min="30" max="1440" value={regra.feedbackVisitaMin} onChange={(e)=>setRegra({...regra,feedbackVisitaMin:Number(e.target.value)})}/></label><label>Aviso urgente (min)<input type="number" min="15" max="1440" value={regra.notificacaoUrgenteMin} onChange={(e)=>setRegra({...regra,notificacaoUrgenteMin:Number(e.target.value)})}/></label><label>Suspensão 1 (h)<input type="number" value={regra.suspensaoNivel1H} onChange={(e)=>setRegra({...regra,suspensaoNivel1H:Number(e.target.value)})}/></label><label>Suspensão 2 (h)<input type="number" value={regra.suspensaoNivel2H} onChange={(e)=>setRegra({...regra,suspensaoNivel2H:Number(e.target.value)})}/></label><label>Suspensão 3 (h)<input type="number" value={regra.suspensaoNivel3H} onChange={(e)=>setRegra({...regra,suspensaoNivel3H:Number(e.target.value)})}/></label></fieldset>
      <button type="submit" disabled={busy}>Salvar regras da operação</button>
    </form></details>}
    {editor === "etapa" && <Modal titulo={etapa.codigo ? "Editar etapa" : "Nova etapa"} texto="A ordem reorganiza as demais colunas automaticamente, sem colisões." onFechar={() => setEditor(null)}><form className="f2-config-modal-form" onSubmit={(ev) => { ev.preventDefault(); void onEtapa(etapa).then((ok) => { if (ok) setEditor(null); }); }}><label>Código<input required disabled={Boolean(etapa.codigo)} value={etapa.codigo} onChange={(e) => setEtapa({...etapa,codigo:e.target.value.toLowerCase().replace(/\W+/g,"_")})}/></label><label>Nome<input required value={etapa.rotulo} onChange={(e) => setEtapa({...etapa,rotulo:e.target.value})}/></label><label className="largo">Descrição<input value={etapa.ajuda} onChange={(e) => setEtapa({...etapa,ajuda:e.target.value})}/></label><label>Posição no funil<input type="number" min="1" max="50" value={etapa.ordem} onChange={(e) => setEtapa({...etapa,ordem:Number(e.target.value)})}/></label><label className="f2-check"><input type="checkbox" checked={etapa.ativo} onChange={(e) => setEtapa({...etapa,ativo:e.target.checked})}/> Etapa ativa</label><button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar etapa"}</button></form></Modal>}
    {editor === "momento" && <Modal titulo={momento.codigo ? "Editar momento" : "Novo momento"} texto="Defina a conduta, a ação esperada e o prazo do corretor." onFechar={() => setEditor(null)}><form className="f2-config-modal-form" onSubmit={(ev) => { ev.preventDefault(); void onMomento({...momento,prazoMinutos:momento.semPrazo ? null : Math.round(momento.prazoHoras*60)}).then((ok) => { if (ok) setEditor(null); }); }}><label>Código<input required disabled={Boolean(momento.codigo)} value={momento.codigo} onChange={(e) => setMomento({...momento,codigo:e.target.value.toUpperCase().replace(/\W+/g,"_")})}/></label><label>Etapa<select value={momento.etapa} onChange={(e) => { const novaEtapa = e.target.value; setMomento({...momento,etapa:novaEtapa,ordem:momento.codigo ? momento.ordem : proximaOrdemMomento(novaEtapa)}); }}>{etapas.filter((e) => e.ativo).map((e) => <option key={e.codigo} value={e.codigo}>{e.rotulo}</option>)}</select></label><label>Nome<input required value={momento.rotulo} onChange={(e) => setMomento({...momento,rotulo:e.target.value})}/></label><label>Posição na etapa<input type="number" min="1" max="100" value={momento.ordem} onChange={(e) => setMomento({...momento,ordem:Number(e.target.value)})}/></label><label className="largo">O que significa<input required value={momento.descricao} onChange={(e) => setMomento({...momento,descricao:e.target.value})}/></label><label className="largo">Ação oficial<input required value={momento.acaoRotulo} onChange={(e) => setMomento({...momento,acaoRotulo:e.target.value})}/></label><label>Horas permitidas<input type="number" min="0.1" max="720" step="0.5" disabled={momento.semPrazo} value={momento.prazoHoras} onChange={(e) => setMomento({...momento,prazoHoras:Number(e.target.value)})}/></label><label className="f2-check"><input type="checkbox" checked={momento.semPrazo} onChange={(e) => setMomento({...momento,semPrazo:e.target.checked})}/> Sem prazo</label><label className="f2-check"><input type="checkbox" checked={momento.exigeDapi} onChange={(e) => setMomento({...momento,exigeDapi:e.target.checked})}/> Exige confirmação do D-API</label><label className="f2-check"><input type="checkbox" checked={momento.ativo} onChange={(e) => setMomento({...momento,ativo:e.target.checked})}/> Momento ativo</label><button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar momento e prazo"}</button></form></Modal>}
  </main>;
}

function CabecalhoPagina({ titulo, texto, acao, onAcao }: { titulo: string; texto: string; acao?: string; onAcao?: () => void }) { return <header className="f2-pagina-cab"><div><span className="f2-eyebrow">FUNIL</span><h2>{titulo}</h2><p>{texto}</p></div>{acao && <button type="button" onClick={onAcao}>{acao}</button>}</header>; }

function ModalPescar({ candidatos, busy, onFechar, onPescar }: { candidatos: CandidatoAquarioFunil2[]; busy: boolean; onFechar: () => void; onPescar: (negocioId: number) => void }) {
  const [negocio, setNegocio] = useState(String(candidatos[0]?.negocio_id ?? ""));
  return <Modal titulo="Capturar lead do Aquário" texto="Negócios abertos e sem corretor disponíveis para sua carteira." onFechar={onFechar}>{candidatos.length > 0 ? <label>Lead disponível<select value={negocio} onChange={(e) => setNegocio(e.target.value)}>{candidatos.map((c) => <option key={c.negocio_id} value={c.negocio_id}>{c.nome} · #{c.negocio_id}</option>)}</select></label> : <div className="f2-sem-resultado"><b>Nenhum lead disponível no Aquário.</b><span>Novas oportunidades aparecerão aqui assim que estiverem disponíveis.</span></div>}<div className="f2-pesca-destino"><span>DESTINO</span><b>Lead novo · Primeira abordagem</b><small>Prazo de 5 minutos. O histórico anterior fica oculto; a conversa começa no instante da captura.</small></div><button type="button" className="f2-modal-primary" disabled={busy || !negocio} onClick={() => onPescar(Number(negocio))}>{busy ? "Capturando…" : "Capturar lead"}</button></Modal>;
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
function SeletorLead({ leads, value, onChange }: { leads: LeadFunil2[]; value: string; onChange: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const escolhido = leads.find((lead) => lead.id === value) ?? null;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const resultados = termo.length >= 2
    ? leads.filter((lead) => `${lead.nome} ${lead.telefone ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo)).slice(0, 8)
    : [];

  if (escolhido) return <div className="f2-lead-escolhido"><span>CLIENTE</span><strong>{escolhido.nome}</strong><small>{escolhido.telefone || "Telefone não informado"}</small><button type="button" onClick={() => { onChange(""); setBusca(""); }}>Trocar cliente</button></div>;

  return <div className="f2-lead-picker">
    <label>Buscar cliente<input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Digite nome ou telefone" autoComplete="off" /></label>
    {termo.length < 2 ? <p>Digite pelo menos dois caracteres para localizar o cliente.</p> : <div className="f2-lead-resultados">
      {resultados.map((lead) => <button key={lead.id} type="button" onClick={() => onChange(lead.id)}><strong>{lead.nome}</strong><small>{lead.telefone || "Sem telefone"} · {lead.corretor_nome || "Sem responsável"}</small></button>)}
      {resultados.length === 0 && <p>Nenhum cliente encontrado.</p>}
    </div>}
  </div>;
}

function ModalVisita({ leads, leadFoco, busy, erroExterno, onFechar, onSalvar }: {
  leads: LeadFunil2[];
  leadFoco?: LeadFunil2 | null;
  busy: boolean;
  erroExterno: string | null;
  onFechar: () => void;
  onSalvar: (d: Record<string, unknown>) => Promise<boolean>;
}) {
  const [leadId, setLeadId] = useState(leadFoco?.id ?? "");
  const [inicio, setInicio] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [comGerente, setComGerente] = useState(false);
  const [gerente, setGerente] = useState("");
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([]);
  const [equipe, setEquipe] = useState<{ id: number; nome: string }[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [erroProdutos, setErroProdutos] = useState("");
  const [erroFormulario, setErroFormulario] = useState("");

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    void sb.from("empreendimentos").select("id,nome").order("nome").limit(200)
      .then(({ data, error }) => {
        setCarregandoProdutos(false);
        if (error) { setErroProdutos("Não foi possível carregar os produtos. Tente novamente em instantes."); return; }
        setProdutos((data ?? []) as { id: string; nome: string }[]);
      });
    void sb.from("gerentes").select("id,nome").eq("ativo", true).order("geral", { ascending: false }).order("nome")
      .then(({ data }) => setEquipe((data ?? []) as { id: number; nome: string }[]));
  }, []);

  async function salvar() {
    const mensagem = erroAgendamentoVisita({
      leadId,
      inicio,
      empreendimentoId: empreendimento,
      unidade,
      comGerente,
      gerenteId: gerente,
    });
    if (mensagem) { setErroFormulario(mensagem); return; }
    setErroFormulario("");
    await onSalvar({
      leadId, inicioEm: inicio,
      imovel: unidade.trim() || "",
      empreendimentoId: empreendimento || null,
      unidade: unidade.trim() || null,
      comGerente, gerenteId: gerente ? Number(gerente) : null,
      status: "agendada",
    });
  }

  return <Modal titulo="Agendar visita" texto="A visita aparecerá na Agenda sem duplicar o lead." onFechar={onFechar}>
    {leadFoco ? <div className="f2-lead-escolhido fixo"><span>CLIENTE DESTA VISITA</span><strong>{leadFoco.nome}</strong><small>{leadFoco.telefone || "Telefone não informado"}</small></div> : <SeletorLead leads={leads} value={leadId} onChange={(id) => { setLeadId(id); setErroFormulario(""); }} />}
    <label>Produto
      <select value={empreendimento} disabled={carregandoProdutos || Boolean(erroProdutos)} onChange={(e) => { setEmpreendimento(e.target.value); setErroFormulario(""); }}>
        <option value="">{carregandoProdutos ? "Carregando produtos…" : erroProdutos ? "Produtos indisponíveis" : produtos.length === 0 ? "Nenhum produto disponível" : "— escolha o empreendimento —"}</option>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
    {erroProdutos && <p className="f2-modal-erro" role="alert">{erroProdutos}</p>}
    <label>Unidade <small>(opcional)</small>
      <input value={unidade} onChange={(e) => { setUnidade(e.target.value); setErroFormulario(""); }} placeholder="Ex.: apto 402" />
    </label>
    <label>Data e hora
      <input type="datetime-local" value={inicio} onChange={(e) => { setInicio(e.target.value); setErroFormulario(""); }} />
    </label>
    <label>Gerente <small>(opcional)</small>
      <select value={gerente} onChange={(e) => { setGerente(e.target.value); setErroFormulario(""); }}>
        <option value="">— nenhum gerente selecionado —</option>
        {equipe.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
    </label>
    <label className="f2-modal-check">
      <input type="checkbox" checked={comGerente} onChange={(e) => { setComGerente(e.target.checked); setErroFormulario(""); }} />
      Gerente estará presente na visita
    </label>
    {erroFormulario && <p className="f2-modal-erro" role="alert">{erroFormulario}</p>}
    {erroExterno && <p className="f2-modal-erro" role="alert">{erroExterno}</p>}
    <button type="button" className="f2-modal-primary" disabled={busy} onClick={() => void salvar()}>
      {busy ? "Agendando…" : "Confirmar visita"}
    </button>
  </Modal>;
}

function ModalNegociacao({ leads, leadFoco, busy, onFechar, onSalvar }: { leads: LeadFunil2[]; leadFoco?: LeadFunil2 | null; busy: boolean; onFechar: () => void; onSalvar: (d: Record<string, unknown>) => void }) {
  const [leadId, setLeadId] = useState(leadFoco?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  return <Modal titulo="Lançar negociação" texto="A oportunidade nasce vinculada ao cliente e entra na etapa inicial da Esteira de Vendas." onFechar={onFechar}>
    {leadFoco ? <div className="f2-lead-escolhido fixo"><span>CLIENTE DESTA NEGOCIAÇÃO</span><strong>{leadFoco.nome}</strong><small>{leadFoco.telefone || "Telefone não informado"}</small></div> : <SeletorLead leads={leads} value={leadId} onChange={setLeadId} />}
    <label>Oportunidade<input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Apartamento no Centro" maxLength={120} /></label>
    <label>Valor estimado <small>(opcional)</small><input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
    <div className="f2-modal-destino"><span>DESTINO</span><b>Esteira · Qualificação</b><small>Responsável: {leadFoco?.corretor_nome || leads.find((item) => item.id === leadId)?.corretor_nome || "será definido pela equipe"}</small></div>
    <button type="button" className="f2-modal-primary" disabled={busy || !leadId || titulo.trim().length < 2} onClick={() => onSalvar({ leadId, titulo: titulo.trim(), valor: valor ? Number(valor) : null, etapa: "qualificacao" })}>{busy ? "Criando…" : "Criar negociação"}</button>
  </Modal>;
}

function Modal({ titulo, texto, onFechar, children }: { titulo:string; texto:string; onFechar:()=>void; children:ReactNode }) {
  const tituloId = useId();
  useEffect(() => {
    const fecharComEscape = (evento: KeyboardEvent) => { if (evento.key === "Escape") onFechar(); };
    document.addEventListener("keydown", fecharComEscape);
    return () => document.removeEventListener("keydown", fecharComEscape);
  }, [onFechar]);
  return <div className="f2-modal-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onFechar(); }}><div className="f2-modal" role="dialog" aria-modal="true" aria-labelledby={tituloId}><header><div><span className="f2-eyebrow">FUNIL 2.0</span><h2 id={tituloId}>{titulo}</h2><p>{texto}</p></div><button type="button" onClick={onFechar} aria-label={`Fechar ${titulo}`}>×</button></header>{children}</div></div>;
}

function Detalhe({
  abrirNoChat, accessToken, lead, momento, momentos, etapas, eventos, notas, visitas, tagCatalogo, busy, onFechar, onMomento, onTemperatura, onAgendarVisita, onGerarNegociacao, onAbrirEsteira, onDescartar, onSalvarNota, onTagSalva }: {
  accessToken: string;
  lead: LeadFunil2; momento: MomentoFunil2; momentos: MomentoFunil2[]; etapas: EtapaConfigFunil2[]; eventos: EventoFunil2[]; notas: NotaFunil2[]; visitas: VisitaFunil2[]; tagCatalogo: TagCatalogoFunil2[]; busy: boolean;
  onFechar: () => void; onMomento: (codigo: string, prazo: string, obs: string) => void;
  onTemperatura: (temperatura: TemperaturaLead | null) => Promise<boolean>;
  onAgendarVisita: () => void; onGerarNegociacao: () => void; onAbrirEsteira: () => void;
  onDescartar: () => void; onSalvarNota: (texto: string) => Promise<boolean>;
  onTagSalva: () => void;
  abrirNoChat?: boolean;
}) {
  const [codigo, setCodigo] = useState(lead.momento_codigo);
  const [prazo, setPrazo] = useState("");
  const [obs, setObs] = useState("");
  const [nota, setNota] = useState("");
  const [abaDetalhe, setAbaDetalhe] = useState<"atendimento" | "historico" | "atividades" | "negocios" | "imoveis" | "arquivos" | "dados">("atendimento");
  const [chatAberto, setChatAberto] = useState(Boolean(abrirNoChat));
  const [maisAcoes, setMaisAcoes] = useState(false);
  const [tagAberta, setTagAberta] = useState(false);
  const [temperaturaAberta, setTemperaturaAberta] = useState(false);
  const [saraAberta, setSaraAberta] = useState(false);
  const [comentarioAberto, setComentarioAberto] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState<"todos" | "humanos" | "automaticos">("todos");
  const tituloFichaId = useId();
  const painelFichaId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const focoOrigemRef = useRef<HTMLElement | null>(null);
  const situacao = situacaoPrazo(lead.proxima_acao_em);
  const tentativa = tentativaAtual(lead);
  const whatsapp = linkWhatsapp(lead.telefone);
  const temperatura = lead.temperatura ?? null;
  const temperaturaRotulo = rotuloTemperatura(temperatura) ?? "Aguardando leitura";
  const etapaRotulo = etapas.find((e) => e.codigo === lead.etapa)?.rotulo ?? lead.etapa;
  const cadenciaRotulo = rotuloCadencia(lead) ?? "Sem cadência ativa";
  const contagemAtividades = visitas.length + eventos.length;
  const contagemNegocios = lead.origem_negocio_id ? 1 : 0;
  const eventosVisiveis = eventos.filter((evento) => {
    if (filtroHistorico === "todos") return true;
    const automatizado = /sara|automa|sistema/i.test(`${evento.titulo} ${evento.detalhe}`);
    return filtroHistorico === "automaticos" ? automatizado : !automatizado;
  });

  useEffect(() => {
    focoOrigemRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const quadro = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tituloFichaId)}`)?.focus());
    return () => {
      cancelAnimationFrame(quadro);
      focoOrigemRef.current?.focus();
    };
  }, [tituloFichaId]);

  useEffect(() => {
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Tab" && !document.querySelector(".f2-modal")) {
        const focaveis = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary') ?? []);
        if (focaveis.length > 0) {
          const primeiro = focaveis[0];
          const ultimo = focaveis[focaveis.length - 1];
          if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
          else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
        }
        return;
      }
      if (evento.key !== "Escape" || document.querySelector(".f2-modal")) return;
      if (chatAberto) setChatAberto(false);
      else if (tagAberta) setTagAberta(false);
      else if (maisAcoes) setMaisAcoes(false);
      else if (temperaturaAberta) setTemperaturaAberta(false);
      else onFechar();
    };
    document.addEventListener("keydown", fecharComEscape);
    return () => document.removeEventListener("keydown", fecharComEscape);
  }, [chatAberto, maisAcoes, onFechar, tagAberta, temperaturaAberta]);

  return <div className="f2-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onFechar(); }}>
    <aside ref={dialogRef} className="f2-detalhe" role="dialog" aria-modal="true" aria-labelledby={tituloFichaId} aria-label={`Atendimento de ${lead.nome}`}>
      <header className="f2-ficha-cabecalho">
        <div className="f2-ficha-linha-topo">
          <div className="f2-ficha-identidade"><i>{iniciais(lead.nome)}</i><span><h2 id={tituloFichaId} tabIndex={-1}>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem responsável"}{lead.instancia_rotulo ? ` · ${lead.instancia_rotulo}` : ""} · negócio #{lead.origem_negocio_id}</p></span></div>
          <div className="f2-ficha-chips">
          <span className="f2-temperatura-controle">
            <button type="button" className={`f2-chip-resumo temperatura temperatura-${temperatura ?? "aguardando"}`} aria-expanded={temperaturaAberta} aria-label={`Alterar temperatura. Atual: ${temperaturaRotulo}`} disabled={busy} onClick={() => setTemperaturaAberta((aberta) => !aberta)}><i />{temperaturaRotulo}<b>⌄</b></button>
            {temperaturaAberta && <div className="f2-temperatura-popover" role="dialog" aria-label="Alterar temperatura"><strong>Temperatura do lead</strong><p>Escolha a leitura que melhor representa a conversa atual.</p>{TEMPERATURAS.map((item) => <button type="button" key={item.codigo} className={`temperatura-${item.codigo}${temperaturaDoLead(lead) === item.codigo ? " ativa" : ""}`} disabled={busy} onClick={() => { const nova = item.codigo === "aguardando" ? null : item.codigo; void onTemperatura(nova).then((ok) => { if (ok) setTemperaturaAberta(false); }); }}><i />{item.rotulo}</button>)}</div>}
          </span>
          <span className="f2-chip-resumo momento">{momento.rotulo}</span>
          </div>
          <div className="f2-ficha-acoes-topo">
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : <button type="button" disabled>WhatsApp</button>}
            <button type="button" onClick={onAgendarVisita}>Agendar visita</button>
            <Link href={`/agenda?lead=${encodeURIComponent(String(lead.lead_id || lead.id))}`}>Nova atividade</Link>
            <span><button type="button" aria-expanded={maisAcoes} onClick={() => setMaisAcoes((valor) => !valor)}>Mais <b>⌄</b></button>{maisAcoes && <div className="f2-mais-menu" role="menu"><button type="button" onClick={() => { setMaisAcoes(false); onGerarNegociacao(); }}>Gerar negociação</button><button type="button" onClick={() => { setMaisAcoes(false); setTagAberta(true); }}>Adicionar tag</button><button type="button" disabled={busy} onClick={() => { setMaisAcoes(false); onMomento(lead.momento_codigo, "", "Momento revalidado pela ficha"); }}>Atualizar prazo do momento</button><hr /><button type="button" className="risco" onClick={() => { setMaisAcoes(false); onDescartar(); }}>Descartar lead</button></div>}</span>
            <button type="button" className="f2-ficha-fechar" onClick={onFechar} aria-label="Fechar ficha">×</button>
          </div>
        </div>

        <section className="f2-proxima-acao f2-ficha-proxima-faixa" aria-label="Próxima ação">
          <div><span>Próxima ação</span><strong>{acaoVisivel(lead)}</strong></div>
          <em className={situacao.classe}>{situacao.rotulo}</em>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer">{tentativa ? `Confirmar tentativa ${tentativa}` : "Confirmar ação"}</a> : <button type="button" disabled>Telefone inválido</button>}
          {momento.exige_dapi && <small>A conclusão vem do D-API — o envio confirmado no celular é a evidência.</small>}
        </section>

        <nav className="f2-detalhe-abas" aria-label="Áreas do atendimento" role="tablist" onKeyDown={(evento) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
          evento.preventDefault();
          const abas = Array.from(evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const atual = Math.max(0, abas.indexOf(document.activeElement as HTMLButtonElement));
          const proxima = evento.key === "Home" ? 0 : evento.key === "End" ? abas.length - 1 : evento.key === "ArrowRight" ? (atual + 1) % abas.length : (atual - 1 + abas.length) % abas.length;
          abas[proxima]?.click();
          abas[proxima]?.focus();
        }}>
          {([ ["atendimento", "Atendimento", ""], ["historico", "Histórico", ""], ["atividades", "Atividades", String(contagemAtividades)], ["negocios", "Negócios", String(contagemNegocios)], ["imoveis", "Imóveis", ""], ["arquivos", "Arquivos", "0"], ["dados", "Dados do lead", ""] ] as const).map(([chave, rotulo, contador]) => <button key={chave} id={`${painelFichaId}-${chave}-tab`} aria-controls={`${painelFichaId}-painel`} type="button" role="tab" aria-selected={abaDetalhe === chave} tabIndex={abaDetalhe === chave ? 0 : -1} className={abaDetalhe === chave ? "ativa" : ""} onClick={() => setAbaDetalhe(chave)}>{rotulo}{contador && <span>{contador}</span>}</button>)}
        </nav>
      </header>

      <div className="f2-ficha-grade">
        <aside className="f2-ficha-contexto" aria-label="Contexto do lead">
          <section><span>Identidade</span><dl><div><dt>Telefone</dt><dd>{lead.telefone || "Não informado"}</dd></div><div><dt>E-mail</dt><dd>Não informado</dd></div><div><dt>CPF/CNPJ</dt><dd>Não informado</dd></div><div><dt>Origem</dt><dd>{lead.instancia_rotulo || "Não identificada"}</dd></div><div><dt>Corretor</dt><dd>{lead.corretor_nome || "Não definido"}</dd></div><div><dt>Endereço</dt><dd>Não informado</dd></div></dl></section>
          <section><span>Interesse e tags</span><strong>{lead.interesse || "Ainda não identificado"}</strong><div className="f2-ficha-tags">{lead.tags?.map((tag) => <i key={tag.nome}>{tag.nome}</i>)}<button type="button" onClick={() => setTagAberta(true)}>+ tag</button></div></section>
          <section><span>Cadência</span><strong>{cadenciaRotulo}</strong><small>A data é calculada no banco em dias úteis; a tela mostra o rótulo.</small></section>
          <section><span>Atendimento</span><dl><div><dt>Etapa</dt><dd><span className="f2-chip-resumo etapa">{etapaRotulo}</span></dd></div><div><dt>Status</dt><dd>{momento.rotulo}</dd></div><div><dt>Última ação</dt><dd>{dataCurta(lead.ultima_acao_confirmada_em)}</dd></div><div><dt>Nota do atendimento</dt><dd>{lead.qualidade_atendimento_nota == null ? "Ainda não avaliado" : `${Number(lead.qualidade_atendimento_nota).toFixed(1)}/10`}</dd></div><div><dt>Canal</dt><dd>{lead.instancia_rotulo || "Não identificado"}</dd></div></dl><button type="button" onClick={() => setChatAberto(true)}>Abrir atendimento</button></section>
        </aside>

        <div id={`${painelFichaId}-painel`} className="f2-ficha-painel" role="tabpanel" aria-labelledby={`${painelFichaId}-${abaDetalhe}-tab`}>
          {abaDetalhe === "atendimento" && <>
            <section className="f2-ficha-bloco"><h3>Classificação do atendimento</h3><div className="f2-ficha-classificacao"><label>Momento<select value={codigo} disabled={busy} onChange={(e) => { const valor = e.target.value; setCodigo(valor); onMomento(valor, prazo, obs); }}>{momentos.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}</select></label><label>Temperatura<select value={temperatura ?? "aguardando"} disabled={busy} onChange={(e) => { const valor = e.target.value; void onTemperatura(valor === "aguardando" ? null : valor as TemperaturaLead); }}>{TEMPERATURAS.map((item) => <option key={item.codigo} value={item.codigo}>{item.rotulo}</option>)}</select></label><label>Prazo da ação<input readOnly value={situacao.rotulo} /></label></div>{codigo === "RETORNO_PROGRAMADO" && <label>Data e hora combinadas<input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>}<span className="f2-ficha-preserva-operacao">Prazo padrão: {momento.prazo_rotulo} · Continua neste momento · atualizar prazo</span></section>
            <section className="f2-ficha-bloco sara"><header><span>Sara</span><em>automático</em><button type="button" onClick={() => setSaraAberta((aberta) => !aberta)}>{saraAberta ? "ocultar evidências" : "por que isso?"}</button></header><p>{lead.ultima_reavaliacao_resumo ?? "Ainda não existe uma leitura resumida."}</p>{saraAberta && <div className="f2-ficha-sara-evidencias"><small>{lead.qualidade_atendimento_resumo ?? "A Sara só usa as evidências registradas depois da entrada do lead no Funil."}</small><small>A Sara nunca envia mensagem e não conclui tarefa sem confirmação.</small></div>}<div><button type="button" className="f2-secundario" disabled={busy} onClick={() => onMomento(codigo, prazo, obs)}>Aplicar momento sugerido</button><button type="button" onClick={() => { setCodigo(lead.momento_codigo); setObs(""); setSaraAberta(false); }}>Descartar sugestão</button></div></section>
            <section className="f2-ficha-bloco"><header><h3>Conversa</h3><small>começa no instante da entrada no funil</small><button type="button" className="f2-secundario" onClick={() => setChatAberto(true)}>Abrir conversa completa</button></header><div className="f2-ficha-resposta"><input aria-label="Responder pelo CRM" placeholder="Responder pelo CRM" readOnly onClick={() => setChatAberto(true)} /><button type="button" onClick={() => setChatAberto(true)}>Enviar</button></div><small>O envio registra a intenção; a conclusão da ação depende da confirmação do D-API.</small></section>
            <section className="f2-ficha-bloco"><header><h3>Comentários e notas</h3><button type="button" className="f2-secundario" onClick={() => setComentarioAberto((aberto) => !aberto)}>+ Comentário</button></header>{notas.slice(0, 2).map((item) => <article className="f2-ficha-nota" key={item.id}><span>{item.texto}</span><small>{item.autor_nome ?? "Equipe"} · {dataCurta(item.criado_em)} · nota interna</small></article>)}{notas.length === 0 && !comentarioAberto && <p>Nenhuma nota escrita ainda.</p>}{comentarioAberto && <div className="f2-ficha-comentario"><textarea aria-label="Novo comentário" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Combinado, objeção ou contexto importante." maxLength={2000} /><button type="button" disabled={busy || nota.trim().length < 2} onClick={() => { void onSalvarNota(nota.trim()).then((ok) => { if (ok) { setNota(""); setComentarioAberto(false); } }); }}>{busy ? "Salvando…" : "Salvar comentário"}</button></div>}</section>
          </>}

          {abaDetalhe === "historico" && <section className="f2-ficha-bloco"><header><h3>Linha do tempo única</h3><div className="f2-ficha-filtros">{([ ["todos", "Tudo"], ["humanos", "Humanos"], ["automaticos", "Automáticos"] ] as const).map(([valor, rotulo]) => <button type="button" className={filtroHistorico === valor ? "ativo" : ""} onClick={() => setFiltroHistorico(valor)} key={valor}>{rotulo}</button>)}</div></header><div className="f2-ficha-timeline">{eventosVisiveis.map((evento) => <article key={evento.id}><i /><div><header><strong>{evento.titulo}</strong><em>{/sara|automa|sistema/i.test(`${evento.titulo} ${evento.detalhe}`) ? "automático" : "humano"}</em><time>{dataCurta(evento.criado_em)}</time></header><span>{evento.detalhe}</span></div></article>)}{eventosVisiveis.length === 0 && <p>Nenhuma atualização neste filtro.</p>}</div></section>}

          {abaDetalhe === "atividades" && <section className="f2-ficha-bloco"><header><h3>Atividades do lead</h3><Link href={`/agenda?lead=${encodeURIComponent(String(lead.lead_id || lead.id))}`}>+ Nova atividade</Link></header><div className="f2-ficha-lista">{visitas.map((visita) => <article key={visita.id}><div><strong>Visita · {visita.imovel || "Imóvel a confirmar"}</strong><span>Visita · negócio #{lead.origem_negocio_id}</span></div><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: FUSO_OPERACAO }).format(new Date(visita.inicio_em))}</time><em>{visita.status}</em><Link href={`/agenda?lead=${encodeURIComponent(String(lead.lead_id || lead.id))}`}>Abrir na Agenda</Link></article>)}{eventos.slice(0, 8).map((evento) => <article key={evento.id}><div><strong>{evento.titulo}</strong><span>Atualização do lead</span></div><time>{dataCurta(evento.criado_em)}</time><em>registrada</em><button type="button" onClick={() => setAbaDetalhe("historico")}>Ver histórico</button></article>)}{visitas.length === 0 && eventos.length === 0 && <p>Nenhuma atividade vinculada a esta ficha.</p>}</div></section>}

          {abaDetalhe === "negocios" && <section className="f2-ficha-bloco"><header><h3>Negócios deste lead</h3><small>um lead pode ter vários negócios, em pipelines diferentes</small><button type="button" className="f2-secundario" onClick={onGerarNegociacao}>+ Novo negócio</button></header><div className="f2-ficha-negocios"><article><header><strong>Negócio de origem #{lead.origem_negocio_id}</strong><span>Em andamento</span></header><div><span>Comercial · {etapaRotulo}</span><strong>Valor não informado</strong><span>{lead.interesse || "Produto ainda não identificado"}</span><span>{acaoVisivel(lead)}</span></div><footer><button type="button" onClick={onFechar}>Focar</button><button type="button" onClick={() => setAbaDetalhe("atendimento")}>Atualizar</button></footer></article></div></section>}

          {abaDetalhe === "imoveis" && <section className="f2-ficha-bloco"><header><h3>Imóveis do negócio em foco</h3><small>valor do negócio: não informado</small><a href="/produtos">+ Vincular imóvel</a></header><div className="f2-ficha-vazio"><strong>Nenhum imóvel vinculado</strong><span>O interesse declarado do lead é {lead.interesse || "ainda não identificado"}. Vincule produtos no catálogo canônico.</span></div><small>Interesse declarado é do lead; imóvel vinculado é do negócio — as duas coisas não se misturam.</small></section>}

          {abaDetalhe === "arquivos" && <section className="f2-ficha-bloco"><header><h3>Arquivos</h3><button type="button" className="f2-secundario" onClick={onAbrirEsteira}>+ Adicionar arquivo</button></header><div className="f2-ficha-vazio"><strong>Nenhum arquivo vinculado</strong><span>Versão, permissão e revisão continuam controladas na Esteira canônica.</span></div></section>}

          {abaDetalhe === "dados" && <section className="f2-ficha-bloco"><h3>Dados do lead</h3><div className="f2-ficha-dados-form"><label>Nome<input readOnly value={lead.nome} /></label><label>Telefone<input readOnly value={lead.telefone || "Não informado"} /></label><label>E-mail<input readOnly value="Não informado" /></label><label>Responsável<input readOnly value={lead.corretor_nome || "Não definido"} /></label><label>Origem<input readOnly value={lead.instancia_rotulo || "Não identificada"} /></label><label>Negócio de origem<input readOnly value={`#${lead.origem_negocio_id}`} /></label></div><footer><button type="button" disabled>Salvar dados</button><button type="button" className="risco" onClick={onDescartar}>Descartar lead</button></footer></section>}
        </div>
      </div>

      {chatAberto && (lead.lead_id > 0 ? <Funil2ConversationDrawer accessToken={accessToken} leadId={lead.id} nome={lead.nome} onClose={() => setChatAberto(false)} /> : <div className="f2-acao-painel-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setChatAberto(false); }}><section className="f2-acao-painel"><header><strong>Conversa</strong><button type="button" onClick={() => setChatAberto(false)}>×</button></header><p>Este lead ainda não possui uma conversa vinculada.</p></section></div>)}
      {tagAberta && <div className="f2-acao-painel-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setTagAberta(false); }}><div className="f2-acao-painel"><AssociarTagLead leadId={lead.id} catalogo={tagCatalogo} tagsAssociadas={(lead.tags ?? []).map((tag) => tag.nome)} accessToken={accessToken} onSalvo={onTagSalva} abertoInicial onFechar={() => setTagAberta(false)} /></div></div>}
    </aside>
  </div>;
}
