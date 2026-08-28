"use client";

// Rótulo operacional canônico mantido no contrato móvel: PRÓXIMA AÇÃO.

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

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BotaoWhatsApp } from "./BotaoWhatsApp";
import { AssociarTagLead } from "./AssociarTagLead";
import { Funil2ConversationDrawer } from "./Funil2ConversationDrawer";
import { AdicionarClienteModal } from "./AdicionarClienteModal";
import { IniciarNegociacaoModal } from "./IniciarNegociacaoModal";
import { LeadDataEditor } from "./LeadDataEditor";
import { ModalPescar } from "./Funil2Workspace";
import { SalesProcessView } from "../sales/SalesProcessWorkspace";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { prepararAberturaWhatsApp } from "../../lib/whatsappNativo";
import {
  acaoVisivel,
  erroAgendamentoVisita,
  esperandoPrimeiraChamada,
  rotuloTemperatura,
  situacaoPrazo,
  venceHoje,
  type ArquivoVinculadoFunil2,
  type AtividadeFunil2,
  type CandidatoAquarioFunil2,
  type EventoFunil2,
  type EtapaConfigFunil2,
  type ImovelVinculadoFunil2,
  type LeadFunil2,
  type MomentoFunil2,
  type NegociacaoFunil2,
  type NegocioVinculadoFunil2,
  type NotaFunil2,
  type TagCatalogoFunil2,
  type TemperaturaLead,
  type VisitaFunil2,
} from "./modelo";
import { combinarAtividades } from "./contratos.mjs";

type PayloadMobile = {
  leads?: LeadFunil2[];
  momentos?: MomentoFunil2[];
  eventos?: EventoFunil2[];
  notas?: NotaFunil2[];
  tagCatalogo?: TagCatalogoFunil2[];
  etapas?: EtapaConfigFunil2[];
  visitas?: VisitaFunil2[];
  atividades?: AtividadeFunil2[];
  negociacoes?: NegociacaoFunil2[];
  negociosVinculados?: NegocioVinculadoFunil2[];
  imoveisVinculados?: ImovelVinculadoFunil2[];
  arquivosVinculados?: ArquivoVinculadoFunil2[];
  aquario?: CandidatoAquarioFunil2[];
  podePescar?: boolean;
  fontes?: { arquivos?: "ok" | "sem_vinculo" | "erro"; conversas?: "ok" | "erro"; instanciasPadrao?: "ok" | "erro"; operacao?: "ok" | "erro"; sara?: "ok" | "erro" };
  error?: string;
};

type FiltroDia = "agora" | "novos" | "hoje" | "todos";
type TemperaturaFiltroMobile = TemperaturaLead | "aguardando" | "todas";
type AreaCrmMobile = "funil" | "leads" | "visitas" | "esteira";

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
function IconeAtualizar() { return <svg width="14" height="14" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 3.5v5h-5" /></svg>; }
function IconeBusca() { return <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.3-4.3" /></svg>; }
function IconeCheck({ tamanho = 30 }: { tamanho?: number }) { return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" {...tracos} strokeWidth={2.4} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>; }
function IconeAlerta() { return <svg width="28" height="28" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="M10.3 4 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4M12 17.2h.01" /></svg>; }
function IconeVoltar() { return <svg width="19" height="19" viewBox="0 0 24 24" {...tracos} aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>; }

function nomeEtapa(codigo: string) {
  return ETAPAS_FALLBACK.find(([chave]) => chave === codigo)?.[1] ?? codigo.replaceAll("_", " ");
}

function rotuloEtapaMobile(codigo: string, rotulo?: string) {
  if (codigo === "novo") return "Novo";
  return rotulo ?? nomeEtapa(codigo);
}

function acaoCompactaMobile(lead: LeadFunil2) {
  const acao = acaoVisivel(lead);
  return /whats/i.test(acao) ? acao : `WhatsApp · ${acao}`;
}

function valorCompacto(lead: LeadFunil2) {
  const valor = Number(lead.valor);
  if (!Number.isFinite(valor) || valor <= 0) return "Valor não informado";
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (valor >= 1_000) return `R$ ${Math.round(valor / 1_000).toLocaleString("pt-BR")} mil`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
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
  onAbrir,
  onConversa,
}: {
  lead: LeadFunil2;
  onAbrir: () => void;
  onConversa: (origem: HTMLButtonElement) => void;
}) {
  const prazo = situacaoPrazo(lead.proxima_acao_em);
  return <article className="ape-card" tabIndex={0} aria-label={`Abrir ficha de ${lead.nome}`} onClick={(evento) => { if (!(evento.target as HTMLElement).closest("button,a,input,select,textarea,summary,details")) onAbrir(); }} onKeyDown={(evento) => { if (evento.target === evento.currentTarget && ["Enter", " "].includes(evento.key)) { evento.preventDefault(); onAbrir(); } }}>
    <div className="ape-card-topo">
      <div className="ape-quem">
        <strong>{lead.nome}</strong>
        <span>{lead.interesse ?? lead.instancia_rotulo ?? nomeEtapa(lead.etapa)}</span>
      </div>
      <b className={`ape-momento temperatura-${temperaturaMobile(lead)}`}><i />{rotuloTemperatura(lead.temperatura) ?? "Aguardando leitura"}</b>
    </div>

    <div className="ape-card-resumo">
      <strong>{valorCompacto(lead)}</strong>
      <span><small className="sr-only">PRÓXIMA AÇÃO: </small>{acaoCompactaMobile(lead)}</span>
      <em className={prazo.classe}>{prazo.rotulo}</em>
    </div>

    <div className="ape-card-acoes-compactas">
      <button type="button" aria-label={`Abrir chat de ${lead.nome}`} onKeyDown={(evento) => evento.stopPropagation()} onClick={(evento) => { evento.stopPropagation(); onConversa(evento.currentTarget); }}>Conversa</button>
      <button type="button" onClick={(evento) => { evento.stopPropagation(); onAbrir(); }}>Abrir</button>
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

    <label>Data e hora
      <input type="datetime-local" value={quando} onChange={(e) => { setQuando(e.target.value); setErro(""); }} />
    </label>

    <label className="f2m-agendar-check">
      <input type="checkbox" checked={comGerente} onChange={(e) => { setComGerente(e.target.checked); setErro(""); }} />
      Quero o gerente presente
    </label>

    {comGerente && <label>Qual gerente
      <select value={gerente} onChange={(e) => { setGerente(e.target.value); setErro(""); }}>
        <option value="">— escolha —</option>
        {gerentes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
    </label>}

    {erro && <p className="f2m-agendar-erro" role="alert">{erro}</p>}
    <div className="f2m-agendar-acoes">
      <button type="button" className="f2m-agendar-nao" onClick={() => { setAberto(false); onFechar?.(); }} disabled={salvando}>Cancelar</button>
      <button type="button" className="f2m-agendar-ok" onClick={() => void salvar()} disabled={salvando}>
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
  abrirNoChat,
  lead,
  negocios,
  imoveis,
  arquivos,
  arquivosEstado,
  momento,
  momentos,
  etapas,
  eventos,
  notas,
  atividades,
  visitas,
  onFechar,
  accessToken,
  onSalvo,
  onRecarregar,
  onIniciarNegociacao,
  tagCatalogo,
}: {
  abrirNoChat: boolean;
  lead: LeadFunil2;
  negocios: NegocioVinculadoFunil2[];
  imoveis: ImovelVinculadoFunil2[];
  arquivos: ArquivoVinculadoFunil2[];
  arquivosEstado: "ok" | "sem_vinculo" | "erro";
  momento: MomentoFunil2 | null;
  momentos: MomentoFunil2[];
  etapas: EtapaConfigFunil2[];
  eventos: EventoFunil2[];
  notas: NotaFunil2[];
  atividades: AtividadeFunil2[];
  visitas: VisitaFunil2[];
  onFechar: () => void;
  accessToken: string;
  onSalvo: () => void;
  onRecarregar: () => void;
  onIniciarNegociacao: () => void;
  tagCatalogo: TagCatalogoFunil2[];
}) {
  const [aba, setAba] = useState<"atendimento" | "historico" | "atividades" | "negocios" | "imoveis" | "arquivos" | "dados">("atendimento");
  const [chatAberto, setChatAberto] = useState(abrirNoChat);
  const [maisAcoes, setMaisAcoes] = useState(false);
  const [acaoMais, setAcaoMais] = useState<"visita" | "tag" | "descarte" | null>(null);
  const [dadosSujos, setDadosSujos] = useState(false);
  const [temperaturaAberta, setTemperaturaAberta] = useState(false);
  const [salvandoTemperatura, setSalvandoTemperatura] = useState(false);
  const [erroTemperatura, setErroTemperatura] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const focoOrigemRef = useRef<HTMLElement | null>(null);
  const prazo = situacaoPrazo(lead.proxima_acao_em);
  const temperatura = lead.temperatura ?? null;
  const temperaturaRotulo = rotuloTemperatura(temperatura) ?? "Aguardando leitura";
  const whatsappPreparo = prepararAberturaWhatsApp(lead.telefone);
  const atividadesCompletas = combinarAtividades(atividades, visitas);
  const confirmarSaidaDados = useCallback(() => !dadosSujos || window.confirm("Há alterações não salvas nos dados do lead. Deseja descartá-las?"), [dadosSujos]);
  const fecharFicha = useCallback(() => { if (confirmarSaidaDados()) onFechar(); }, [confirmarSaidaDados, onFechar]);
  const trocarAba = useCallback((proxima: typeof aba) => { if (proxima === aba || confirmarSaidaDados()) setAba(proxima); }, [aba, confirmarSaidaDados]);
  useEffect(() => {
    focoOrigemRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const quadro = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(".ape-voltar")?.focus());
    return () => {
      cancelAnimationFrame(quadro);
      focoOrigemRef.current?.focus();
    };
  }, []);
  useEffect(() => {
    const fechar = (evento: KeyboardEvent) => {
      if (evento.key === "Tab") {
        const focaveis = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary') ?? []);
        if (focaveis.length > 0) {
          const primeiro = focaveis[0];
          const ultimo = focaveis[focaveis.length - 1];
          if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
          else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
        }
        return;
      }
      if (evento.key !== "Escape") return;
      if (chatAberto) setChatAberto(false);
      else if (acaoMais) setAcaoMais(null);
      else if (maisAcoes) setMaisAcoes(false);
      else if (temperaturaAberta) setTemperaturaAberta(false);
      else fecharFicha();
    };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [acaoMais, chatAberto, fecharFicha, maisAcoes, temperaturaAberta]);

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

  return <div ref={dialogRef} className="ape-folha" role="dialog" aria-modal="true" aria-label={`Atendimento de ${lead.nome}`} onMouseDown={(evento) => { if (evento.target === evento.currentTarget) fecharFicha(); }}>
    <section className="ape-ficha">
      <header className="ape-ficha-cabecalho-v3">
        <div className="ape-ficha-identidade-v3">
          <button type="button" className="ape-voltar" onClick={fecharFicha} aria-label="Voltar"><IconeVoltar /></button>
          <div><h2>{lead.nome}</h2><p>{lead.corretor_nome ?? "Sem responsável"} · negócio #{lead.origem_negocio_id}</p></div>
          <span className="ape-temperatura-controle"><button type="button" className={`ape-momento temperatura-${temperatura ?? "aguardando"}`} aria-expanded={temperaturaAberta} aria-label={`Alterar temperatura. Atual: ${temperaturaRotulo}`} disabled={salvandoTemperatura} onClick={() => setTemperaturaAberta((aberta) => !aberta)}><i />{temperaturaRotulo}<b>⌄</b></button>{temperaturaAberta && <span className="ape-temperatura-popover" role="dialog" aria-label="Alterar temperatura"><strong>Temperatura do lead</strong>{TEMPERATURAS_MOBILE.map((item) => <button type="button" key={item.codigo} disabled={salvandoTemperatura} className={`temperatura-${item.codigo}${temperaturaMobile(lead) === item.codigo ? " ativa" : ""}`} onClick={() => void atualizarTemperatura(item.codigo === "aguardando" ? null : item.codigo)}><i />{item.rotulo}</button>)}{erroTemperatura && <em role="alert">{erroTemperatura}</em>}</span>}</span>
          <button type="button" className="ape-ficha-mais" aria-label="Mais ações" aria-expanded={maisAcoes} onClick={() => setMaisAcoes(true)}>•••</button>
        </div>
        <nav className="ape-ficha-abas" role="tablist" aria-label="Áreas do atendimento" onKeyDown={(evento) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return; evento.preventDefault(); const abas = Array.from(evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const atual = Math.max(0, abas.indexOf(document.activeElement as HTMLButtonElement)); const proxima = evento.key === "Home" ? 0 : evento.key === "End" ? abas.length - 1 : evento.key === "ArrowRight" ? (atual + 1) % abas.length : (atual - 1 + abas.length) % abas.length; abas[proxima]?.click(); abas[proxima]?.focus(); }}>{([ ["atendimento", "Atendimento"], ["historico", "Histórico"], ["atividades", "Atividades"], ["negocios", "Negócios"], ["imoveis", "Imóveis"], ["arquivos", "Arquivos"], ["dados", "Dados do lead"] ] as const).map(([chave, rotulo]) => <button key={chave} type="button" role="tab" aria-selected={aba === chave} className={aba === chave ? "ativa" : ""} onClick={() => trocarAba(chave)}>{rotulo}</button>)}</nav>
      </header>

      <section className="ape-ordem ape-proxima-aprovada"><span className="ape-contexto-titulo">Próxima ação</span><h3>{acaoVisivel(lead)}</h3><p>{prazo.rotulo} · {momento?.rotulo ?? lead.momento_codigo}</p></section>

      {aba === "atendimento" && <div className="ape-ficha-painel"><section className="f2m-sara-resumo f2m-sara-aprovado"><span>SARA</span><strong className="f2m-sara-frase">{lead.ultima_reavaliacao_resumo ?? "Ainda não existe uma leitura resumida."}</strong>{lead.qualidade_atendimento_resumo && <details><summary>Ver avaliação do atendimento</summary><small>{lead.qualidade_atendimento_resumo}</small></details>}</section><section className="f2m-conversa-aprovada"><header><strong>Conversa</strong><button type="button" onClick={() => setChatAberto(true)}>Abrir conversa completa</button></header><p>As mensagens começam no instante da entrada no funil.</p><small>O envio e a conclusão dependem da confirmação real do D-API.</small></section><details className="f2m-operacao-secundaria"><summary>Atualizar atendimento</summary><div><details className="f2m-detalhes-atendimento"><summary>Detalhes do atendimento</summary><div><span><b>Última ação confirmada</b><strong>{lead.ultima_acao_confirmada_em ? new Date(lead.ultima_acao_confirmada_em).toLocaleString("pt-BR") : "Ainda não confirmada"}</strong></span><span><b>Sara reavaliou</b><strong>{lead.ultima_reavaliacao_sara_em ? new Date(lead.ultima_reavaliacao_sara_em).toLocaleString("pt-BR") : "Ainda não reavaliou"}</strong></span><span><b>Nota do atendimento</b><strong>{lead.qualidade_atendimento_nota == null ? "Ainda não avaliado" : `${Number(lead.qualidade_atendimento_nota).toFixed(1)}/10`}</strong></span><span><b>Telefone</b><strong>{lead.telefone || "Não informado"}</strong></span><span><b>Canal</b><strong>{lead.instancia_rotulo || "Não identificado"}</strong></span></div><ContextoDoLead lead={lead} completo /></details><AtualizarMomentoMobile lead={lead} momento={momento} momentos={momentos} etapas={etapas} accessToken={accessToken} onSalvo={onRecarregar} abertoInicial /></div></details></div>}

      {aba === "historico" && <div className="ape-ficha-painel"><section className="f2m-historico"><h3>Últimas atualizações</h3>{eventos.length === 0 ? <p>Ainda não há atualização registrada neste atendimento.</p> : eventos.slice(0, 8).map((evento) => <article key={evento.id}><i /><div><strong>{evento.titulo}</strong>{evento.detalhe && <span>{evento.detalhe}</span>}<small>{new Date(evento.criado_em).toLocaleString("pt-BR")}</small></div></article>)}</section><NotasMobile lead={lead} notas={notas} accessToken={accessToken} onSalvo={onRecarregar} /></div>}

      {aba === "atividades" && <div className="ape-ficha-painel ape-v3-secao"><header><h3>Atividades <small>{atividadesCompletas.length}</small></h3><Link href={`/agenda?lead=${encodeURIComponent(String(lead.lead_id || lead.id))}`}>Abrir agenda</Link></header>{atividadesCompletas.map((atividade) => <article key={`${atividade.tipo}:${atividade.id}`}><strong>{atividade.titulo}</strong><span>{atividade.data_em ? new Date(atividade.data_em).toLocaleString("pt-BR") : "Sem prazo"} · {atividade.status}</span>{atividade.tipo === "tarefa" && <small>{atividade.responsavel || "Responsável não identificado"}</small>}</article>)}{atividadesCompletas.length === 0 && <p>Nenhuma atividade vinculada a esta ficha.</p>}</div>}

      {aba === "negocios" && <div className="ape-ficha-painel ape-v3-secao"><h3>Negócios</h3><p>{negocios.length} negócio(s) canônico(s) visível(is) para este lead.</p>{negocios.map((negocio) => <article key={negocio.id}><strong>Negócio #{negocio.id}</strong><span>{negocio.pipeline || "Pipeline não identificado"} · {negocio.etapa || "Etapa não identificada"}</span><em>{negocio.status}</em></article>)}{negocios.length === 0 && <p>Nenhum negócio canônico visível foi retornado.</p>}<aside className="ape-contrato-pendente" role="note"><strong>Fechamento seguro na Esteira</strong><span>Ganho, perda, restauração e Desfazer ainda não possuem contrato transacional seguro no Funil. Nenhum sucesso é simulado.</span><small>Abra a Esteira no computador para consultar o processo canônico.</small></aside></div>}

      {aba === "imoveis" && <div className="ape-ficha-painel ape-v3-secao"><h3>Imóveis</h3>{imoveis.length ? imoveis.map((imovel) => <article key={`${imovel.negocio_id}:${imovel.unidade_id ?? imovel.empreendimento_id}`}><strong>{imovel.empreendimento || "Empreendimento sem nome"}</strong><span>{imovel.unidade ? `Unidade ${imovel.unidade}` : `Negócio #${imovel.negocio_id}`}</span></article>) : <p>Nenhum imóvel vinculado aos negócios visíveis.</p>}<dl><div><dt>Interesse declarado</dt><dd>{lead.interesse || "Sem dado cadastrado"}</dd></div></dl><a href="/produtos">Abrir Produtos</a></div>}

      {aba === "arquivos" && <div className="ape-ficha-painel ape-v3-secao"><h3>Arquivos</h3>{arquivosEstado === "erro" ? <p role="alert">A fonte canônica não pôde ser consultada com esta sessão.</p> : arquivos.length ? arquivos.map((arquivo) => <article key={arquivo.id}><strong>{arquivo.nome}</strong><span>{arquivo.status} · negócio #{arquivo.negocio_id}</span></article>) : <p>Nenhum arquivo acessível foi retornado pela Esteira.</p>}</div>}

      {aba === "dados" && <div className="ape-ficha-painel ape-v3-secao"><LeadDataEditor key={`${lead.id}:${lead.lead_atualizado_em ?? "sem-versao"}`} accessToken={accessToken} lead={lead} onSaved={async () => { onRecarregar(); }} onDirtyChange={setDadosSujos} /></div>}

      {!whatsappPreparo.ok && <div className="ape-ficha-alerta-contato" role="alert">WhatsApp indisponível: {whatsappPreparo.explicacao}</div>}
      <div className="ape-ficha-rodape-aprovado"><span className="ape-ficha-acao-whatsapp">{whatsappPreparo.ok ? <BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} rotulo="WhatsApp" compacto /> : <button type="button" disabled>WhatsApp</button>}</span><button type="button" onClick={() => setAcaoMais("visita")}>Visita</button><Link href={`/agenda?lead=${encodeURIComponent(String(lead.lead_id || lead.id))}`}>Atividade</Link></div>

      {chatAberto && (lead.lead_id > 0 ? <Funil2ConversationDrawer accessToken={accessToken} leadId={lead.id} nome={lead.nome} onClose={() => setChatAberto(false)} /> : <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setChatAberto(false); }}><section><button type="button" onClick={() => setChatAberto(false)}>×</button><p>Este cliente ainda não possui conversa vinculada.</p></section></div>)}

      {maisAcoes && <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setMaisAcoes(false); }}><section role="dialog" aria-label="Mais ações"><i /><button type="button" onClick={() => { setMaisAcoes(false); onIniciarNegociacao(); }}>Iniciar negociação</button><button type="button" onClick={() => { setMaisAcoes(false); setAcaoMais("tag"); }}>Adicionar tag</button><hr /><button type="button" className="risco" onClick={() => { setMaisAcoes(false); setAcaoMais("descarte"); }}>Descartar lead</button><p>O descarte pede motivo e confirmação antes de concluir.</p></section></div>}

      {acaoMais && <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setAcaoMais(null); }}><section role="dialog" aria-label={acaoMais === "visita" ? "Agendar visita" : acaoMais === "tag" ? "Adicionar tag" : "Descartar lead"}><i />{acaoMais === "visita" && <AgendarVisitaMobile lead={lead} accessToken={accessToken} onSalvo={onSalvo} abertoInicial onFechar={() => setAcaoMais(null)} />}{acaoMais === "tag" && <AssociarTagLead leadId={lead.id} catalogo={tagCatalogo} tagsAssociadas={(lead.tags ?? []).map((tag) => tag.nome)} accessToken={accessToken} onSalvo={onRecarregar} mobile abertoInicial onFechar={() => setAcaoMais(null)} />}{acaoMais === "descarte" && <DescartarMobile lead={lead} accessToken={accessToken} onDescartado={() => { onSalvo(); fecharFicha(); }} abertoInicial onFechar={() => setAcaoMais(null)} />}</section></div>}
    </section>
  </div>;
}

export function Funil2Mobile({
  accessToken,
  nome,
  role,
  modo,
  onIr,
}: {
  accessToken: string;
  nome: string;
  role?: string;
  modo: "inicio" | "crm";
  onIr: (destino: string) => void;
}) {
  const { dados, erro, recarregar } = useFunil2Mobile(accessToken);
  /* No Meu Dia a lista NAO e filtrada por chip: os tres grupos abaixo dao conta
     do recorte. "todos" aqui significa "deixe o agrupamento decidir". */
  const filtroDia: FiltroDia = "todos";
  const [etapa, setEtapa] = useState("novo");
  const [temperatura, setTemperatura] = useState<TemperaturaFiltroMobile>("todas");
  const [busca, setBusca] = useState("");
  const [areaCrm, setAreaCrm] = useState<AreaCrmMobile>("funil");
  const [maisAreas, setMaisAreas] = useState(false);
  const [novoNegocioAberto, setNovoNegocioAberto] = useState(false);
  const [adicionarClienteAberto, setAdicionarClienteAberto] = useState(false);
  const [negociacaoCanonicaLeadId, setNegociacaoCanonicaLeadId] = useState<string | null>(null);
  const [novoNegocioLeadId, setNovoNegocioLeadId] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [abrirNoChat, setAbrirNoChat] = useState(false);
  const [chatDireto, setChatDireto] = useState<LeadFunil2 | null>(null);
  const chatOrigemRef = useRef<HTMLButtonElement | null>(null);
  const [pescaAberta, setPescaAberta] = useState(false);
  const [pescaBusy, setPescaBusy] = useState(false);
  const [pescaErro, setPescaErro] = useState<string | null>(null);
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
      const cabeNaEtapa = areaCrm === "leads" ? lead.etapa !== "legado" : lead.etapa === etapa;
      const cabeNaTemperatura = temperatura === "todas" || temperaturaMobile(lead) === temperatura;
      const cabeNaBusca = !termo || `${lead.nome} ${lead.telefone ?? ""} ${lead.interesse ?? ""} ${(lead.tags ?? []).map((tag) => tag.nome).join(" ")}`.toLocaleLowerCase("pt-BR").includes(termo);
      return cabeNoDia && cabeNaEtapa && cabeNaTemperatura && cabeNaBusca;
    });
  }, [agora, areaCrm, busca, etapa, filtroDia, fimHoje, leads, temperatura]);

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
  const leadNovoNegocio = leads.find((lead) => lead.id === novoNegocioLeadId) ?? null;
  const leadNegociacaoCanonica = leads.find((lead) => lead.id === negociacaoCanonicaLeadId) ?? null;
  const aquario = dados?.aquario ?? [];
  const podePescar = dados?.podePescar === true;
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
    onAbrir={() => { setAbrirNoChat(false); setSelecionado(lead.id); }}
    onConversa={(origem) => { chatOrigemRef.current = origem; setChatDireto(lead); }}
  />;

  const fecharChatDireto = () => {
    setChatDireto(null); requestAnimationFrame(() => chatOrigemRef.current?.focus());
  };

  const pescar = async (negocioId: number) => {
    if (pescaBusy) return;
    setPescaBusy(true); setPescaErro(null);
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pescar", negocioId }),
      });
      const resultado = await resposta.json().catch(() => ({})) as { error?: string };
      if (!resposta.ok) { setPescaErro(resultado.error ?? "Não foi possível pescar este lead."); return; }
      setPescaAberta(false); recarregar();
    } catch {
      setPescaErro("Não foi possível falar com o servidor. Tente novamente.");
    } finally {
      setPescaBusy(false);
    }
  };

  return <main className={`ape-app modo-${modo} funil-oficial`} data-module="funil" aria-label={modo === "inicio" ? `Meu Dia de ${primeiroNome}` : "Funil"}>
    <header className="ape-abertura">
      {modo === "inicio" ? <>
        <span className="ape-sobrancelha">Meu Dia</span>
        <h1 className="ape-manchete">{esperandoAgora === 1 ? "1 pessoa espera você agora" : `${esperandoAgora} pessoas esperam você agora`}</h1>
      </> : <>
        <div className="ape-mobile-funil-titulo"><h1 className="ape-manchete">{areaCrm === "funil" ? "Funil" : areaCrm === "leads" ? "Leads" : areaCrm === "visitas" ? "Visitas" : "Esteira"}</h1><span><button type="button" aria-label="Mais áreas" aria-expanded={maisAreas} onClick={() => setMaisAreas((aberto) => !aberto)}>•••</button><button type="button" className="ape-sara-avatar" aria-label="Abrir a Sara" onClick={() => document.querySelector<HTMLButtonElement>("#sara-fab")?.click()}><i title={nome}>{iniciais(nome)}</i></button></span></div>
      </>}
      <div className="ape-atualizado">
        <span>Atualizado {horaAgora()}</span>
        <button type="button" className="ape-atualizar" onClick={recarregar}><IconeAtualizar />Atualizar</button>
      </div>
    </header>

    {modo === "crm" && maisAreas && <nav className="ape-mobile-mais-areas" aria-label="Mais áreas do Funil"><button type="button" onClick={() => { setAreaCrm("esteira"); setMaisAreas(false); }}>Esteira de vendas</button>{["admin", "gestor"].includes((role ?? "").toLowerCase()) && <><button type="button" onClick={() => onIr("/inteligencia")}>Painel gerencial</button><button type="button" onClick={() => onIr("/configuracoes")}>Configurações</button><button type="button" disabled={(role ?? "").toLowerCase() !== "admin"} title={(role ?? "").toLowerCase() === "admin" ? undefined : "Disponível para Admin"} onClick={() => { if ((role ?? "").toLowerCase() === "admin") onIr("/auditoria"); }}>Matriz de validação</button></>}</nav>}

    {sucesso && <div className="ape-visita-sucesso" role="status">
      <div><strong>Visita agendada com sucesso</strong><span>{sucesso}</span></div>
      <button type="button" onClick={() => { setSucesso(null); onIr("/agenda"); }}>Abrir Agenda</button>
      <button type="button" className="fechar" aria-label="Fechar confirmação" onClick={() => setSucesso(null)}>×</button>
    </div>}

    {dados?.fontes?.sara === "erro" && <div className="ape-aviso-fonte" role="status"><strong>Sara indisponível.</strong><span>A leitura automática pode estar desatualizada.</span></div>}

    {modo === "inicio" && <section className="ape-numeros" aria-label="Resumo do dia">
      <article><b>{contagens.agora}</b><span>aguardando</span></article>
      <article><b>{contagens.novos}</b><span>leads novos</span></article>
      <article><b>{contagens.hoje}</b><span>para hoje</span></article>
    </section>}

    {modo === "crm" && areaCrm !== "esteira" && <div className="ape-busca-linha"><label className="ape-busca">
      <IconeBusca />
      <input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar" />
    </label><details className="ape-filtros-menu"><summary>Filtros{temperatura !== "todas" ? " · 1" : ""}</summary><nav className="ape-temperatura-filtros" aria-label="Filtrar por temperatura">
      <span>TEMPERATURA</span>
      <button type="button" className={temperatura === "todas" ? "ativo" : ""} onClick={() => setTemperatura("todas")}>Todas</button>
      {TEMPERATURAS_MOBILE.map((item) => <button type="button" key={item.codigo} className={`${temperatura === item.codigo ? "ativo " : ""}temperatura-${item.codigo}`} onClick={() => setTemperatura(item.codigo)}><i />{item.rotulo}</button>)}
    </nav></details></div>}

    {modo === "crm" && areaCrm === "funil" && <nav className="ape-filtros" aria-label="Filtrar atendimentos">
      {etapas.filter(([chave]) => !["legado", "atualizar_manual"].includes(chave)).map(([chave, rotulo]) => <button key={chave} type="button" className={etapa === chave ? "ativo" : ""} onClick={() => setEtapa(chave)}>{rotuloEtapaMobile(chave, rotulo)} <b>{leads.filter((lead) => lead.etapa === chave).length}</b></button>)}
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
      <button type="button" onClick={() => { limparLeadDaUrl(); onIr("/crm"); }}>Voltar ao Funil</button>
    </div>}

    {dados && !erro && modo === "inicio" && totalNoDia === 0 && <div className="ape-estado">
      <span className="ape-estado-icone"><IconeCheck /></span>
      <strong>Fila zerada por agora</strong>
      <p>Você respondeu todo mundo que estava esperando hoje. O restante da carteira está no Funil.</p>
      <button type="button" onClick={() => onIr("/crm")}>Ver minha carteira</button>
    </div>}

    {dados && !erro && modo === "crm" && areaCrm !== "esteira" && visiveis.length === 0 && <div className="ape-estado">
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
      : areaCrm === "esteira"
        ? <section className="ape-mobile-esteira" aria-label="Esteira de vendas"><SalesProcessView accessToken={accessToken} sessionRole={role ?? "corretor"} /></section>
        : <section className="ape-lista" aria-label="Atendimentos">{visiveis.slice(0, 60).map(cartao)}</section>}

    {modo === "crm" && areaCrm === "funil" && !leadAberto && <div className="ape-funil-acoes-fixas">{podePescar && <button type="button" className="ape-pescar-lead" disabled={pescaBusy} onClick={() => { setPescaErro(null); setPescaAberta(true); }}>Pescar lead{aquario.length > 0 ? ` · ${aquario.length}` : ""}</button>}{["admin", "gestor", "corretor"].includes((role ?? "").toLowerCase()) && <button type="button" className="ape-adicionar-cliente" onClick={() => setAdicionarClienteAberto(true)}>Adicionar cliente</button>}<button type="button" className="ape-novo-negocio-fixo" onClick={() => setNovoNegocioAberto(true)}>Novo negócio</button></div>}

    {modo === "crm" && <nav className="ape-crm-v3-nav" aria-label="Navegação do Funil">
      <button type="button" onClick={() => onIr("/inicio")}>Meu Dia</button>
      <button type="button" className={areaCrm === "funil" ? "ativo" : ""} onClick={() => { setAreaCrm("funil"); setEtapa("novo"); }}>Funil</button>
      <button type="button" className={areaCrm === "leads" ? "ativo" : ""} onClick={() => { setAreaCrm("leads"); setEtapa("novo"); }}>Leads</button>
      <button type="button" onClick={() => onIr("/agenda")}>Agenda</button>
      <button type="button" className={areaCrm === "visitas" ? "ativo" : ""} onClick={() => { setAreaCrm("visitas"); setEtapa("visita"); }}>Visitas</button>
    </nav>}

    {modo === "inicio" && totalNoDia > 0 && <button type="button" className="ape-ver-carteira" onClick={() => onIr("/crm")}>
      Ver minha carteira ({leads.length})
    </button>}

    {novoNegocioAberto && !leadAberto && <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) { setNovoNegocioAberto(false); setNovoNegocioLeadId(""); } }}><section role="dialog" aria-label="Novo negócio"><i /><header className="ape-novo-negocio-cab"><div><h3>Novo negócio</h3><p>Escolha o lead para criar a oportunidade na Esteira.</p></div><button type="button" aria-label="Fechar novo negócio" onClick={() => { setNovoNegocioAberto(false); setNovoNegocioLeadId(""); }}>×</button></header><label className="ape-novo-negocio-lead">Lead<select value={novoNegocioLeadId} onChange={(evento) => setNovoNegocioLeadId(evento.target.value)}><option value="">Selecione o lead</option>{leads.map((item) => <option key={item.id} value={item.id}>{item.nome} · #{item.origem_negocio_id}</option>)}</select></label>{leadNovoNegocio && <GerarNegociacaoMobile lead={leadNovoNegocio} accessToken={accessToken} onSalvo={() => { void recarregar(); setNovoNegocioAberto(false); setNovoNegocioLeadId(""); }} abertoInicial onFechar={() => { setNovoNegocioAberto(false); setNovoNegocioLeadId(""); }} />}</section></div>}

    {adicionarClienteAberto && !leadAberto && <AdicionarClienteModal accessToken={accessToken} onClose={() => setAdicionarClienteAberto(false)} onCreated={(funilLeadId) => { setAdicionarClienteAberto(false); recarregar(); setSelecionado(funilLeadId); }} />}

    {leadNegociacaoCanonica && !leadAberto && <IniciarNegociacaoModal accessToken={accessToken} lead={leadNegociacaoCanonica} negocios={(dados?.negociosVinculados ?? []).filter((item) => item.funil_lead_id === leadNegociacaoCanonica.id)} onClose={() => setNegociacaoCanonicaLeadId(null)} onSent={async () => { recarregar(); }} onOpenEsteira={() => { setNegociacaoCanonicaLeadId(null); setAreaCrm("esteira"); }} />}

    {pescaAberta && !leadAberto && <ModalPescar candidatos={aquario} busy={pescaBusy} erro={pescaErro} onFechar={() => { if (!pescaBusy) { setPescaAberta(false); setPescaErro(null); } }} onPescar={(negocioId) => void pescar(negocioId)} />}

    {chatDireto && (chatDireto.lead_id > 0 ? <Funil2ConversationDrawer accessToken={accessToken} leadId={chatDireto.id} nome={chatDireto.nome} onClose={fecharChatDireto} /> : <div className="ape-ficha-sheet" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) fecharChatDireto(); }}><section role="dialog" aria-label={`Chat de ${chatDireto.nome}`}><button type="button" aria-label="Fechar chat" onClick={fecharChatDireto}>×</button><p>Este cliente ainda não possui conversa vinculada.</p></section></div>)}

    {leadAberto && <FichaLead
      abrirNoChat={abrirNoChat}
      lead={leadAberto}
      negocios={(dados?.negociosVinculados ?? []).filter((item) => item.funil_lead_id === leadAberto.id)}
      imoveis={(dados?.imoveisVinculados ?? []).filter((item) => item.funil_lead_id === leadAberto.id)}
      arquivos={(dados?.arquivosVinculados ?? []).filter((item) => item.funil_lead_id === leadAberto.id)}
      arquivosEstado={dados?.fontes?.arquivos ?? "sem_vinculo"}
      momento={momentos.find((momento) => momento.codigo === leadAberto.momento_codigo) ?? null}
      momentos={momentos}
      etapas={dados?.etapas ?? []}
      eventos={(historicoDetalhe?.leadId === leadAberto.id ? historicoDetalhe.eventos : eventos.filter((evento) => evento.funil_lead_id === leadAberto.id)).sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))}
      notas={historicoDetalhe?.leadId === leadAberto.id ? historicoDetalhe.notas : notas.filter((nota) => nota.funil_lead_id === leadAberto.id)}
      atividades={(dados?.atividades ?? []).filter((atividade) => atividade.funil_lead_id === leadAberto.id)}
      visitas={(dados?.visitas ?? []).filter((visita) => visita.funil_lead_id === leadAberto.id)}
      tagCatalogo={dados?.tagCatalogo ?? []}
      onFechar={() => { setSelecionado("__fechado__"); setAbrirNoChat(false); limparLeadDaUrl(); }}
      accessToken={accessToken}
      onSalvo={() => { setSucesso("Ela já está na Agenda, no horário escolhido."); void recarregar(); setSelecionado(null); }}
      onRecarregar={() => { void recarregar(); }}
      onIniciarNegociacao={() => { setSelecionado("__fechado__"); setNegociacaoCanonicaLeadId(leadAberto.id); limparLeadDaUrl(); }}
    />}
  </main>;
}
