"use client";
/* TELA DO CORRETOR — desenho do protótipo (print 01).
 *
 * Reconstrução da tela, não repintura: cabeçalho com saudação e data, manchete
 * grande com o número de pessoas esperando, três cartões de número, chips de
 * filtro e card com avatar, tags, bloco da Sara e ação em pílula.
 *
 * CTA LARANJA, NÃO VERDE. O LEIA-ME do pacote deixou isso em aberto
 * ("confirmar se o CTA fica verde ou laranja") e o print decide: laranja da
 * marca. Nada muda no comportamento — continua sendo link `whatsapp://` com
 * fallback wa.me, o ERP não envia nada.
 *
 * REGRAS DE PRODUTO PRESERVADAS, as mesmas do pacote:
 *   - clique no WhatsApp não confirma contato; só a integração confirma;
 *   - Sara orienta, nunca envia;
 *   - nada de vocabulário técnico na tela do corretor.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROTULO_ETAPA } from "./meuDia.logica";
import { marcarWhatsappAberto, whatsappAbertoEm, limparWhatsappAberto } from "../crm-nova-era/lib/whatsappAberto";
import { AvisoNotificacoes } from "./AvisoNotificacoes";

const ATUALIZA_MS = 60_000;

/* Payload de /api/ncrm/fila-operacional. Tipado aqui, e não importado, para
   esta tela não depender de detalhe interno de outro módulo. */
type Item = {
  negocio_id: number;
  nome: string | null;
  telefone_normalizado: string | null;
  interesse_resumo: string | null;
  motivo_prioridade: string;
  prioridade: number;
  respondeu: boolean;
  etapa: string;
  tempo_espera: number;
  sara_orientacao_curta: string | null;
  proxima_acao_prazo: string | null;
  outbound_real_confirmado: boolean;
  aguardando_sincronizacao: boolean;
};

type Numeros = { leads_novos: number; acoes_hoje: number; leads_base: number };
type Filtro = "agora" | "hoje" | "todos";

/* ------------------------------ formatação ------------------------------ */

/** Duas iniciais. Nome de uma palavra usa as duas primeiras letras. */
export function iniciais(nome: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** "24h", "12 min", "3 d". Minuto cheio não interessa depois de 1 hora. */
export function espera(minutos: number): string {
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)} d`;
}

/** "sexta, 31 de julho" — em minúscula, como no protótipo. */
export function dataPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace("-feira", "")
    .toLowerCase();
}

export function saudacaoHora(h: number): string {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Hoje no fuso de São Paulo — o corretor pensa no dia dele, não em UTC. */
function ehHoje(iso: string | null): boolean {
  if (!iso) return false;
  const fuso = "America/Sao_Paulo";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: fuso });
  return fmt(d) === fmt(new Date());
}

/** Prioridade 1 e 2 é quem espera AGORA: respondeu, ou lead novo sem atuação. */
const ehAgora = (i: Item) => i.prioridade <= 2;

export function filtrar(itens: Item[], f: Filtro): Item[] {
  if (f === "agora") return itens.filter(ehAgora);
  if (f === "hoje") return itens.filter((i) => ehHoje(i.proxima_acao_prazo) || ehAgora(i));
  return itens;
}

/* --------------------------------- card --------------------------------- */

function CardLead({ i, onAbrir }: { i: Item; onAbrir: (id: number) => void }) {
  /* sessionStorage não é reativo; este tick força o re-render para o aviso
     aparecer NA HORA em que o corretor volta do WhatsApp. */
  const [, setTick] = useState(0);
  const marcou = () => { marcarWhatsappAberto(i.negocio_id); setTick((t) => t + 1); };

  const abriuLocal = whatsappAbertoEm(i.negocio_id) != null;
  if (i.outbound_real_confirmado && abriuLocal) limparWhatsappAberto(i.negocio_id);
  const aguardando = !i.outbound_real_confirmado && (i.aguardando_sincronizacao || abriuLocal);

  const vencida = i.prioridade === 3 || i.prioridade === 5;

  return (
    <li className={`tc-card${vencida ? " vencida" : ""}`}>
      {/* O corpo abre a ficha. A ação principal fica FORA dele: <a> dentro de
          <button> é HTML inválido e quebra leitor de tela. */}
      <button type="button" className="tc-card-corpo" onClick={() => onAbrir(i.negocio_id)}>
        <span className="tc-linha1">
          <span className="tc-avatar" aria-hidden="true">{iniciais(i.nome)}</span>
          <span className="tc-quem">
            <span className="tc-nome">{i.nome ?? `Negócio ${i.negocio_id}`}</span>
            {i.interesse_resumo && <span className="tc-sub">{i.interesse_resumo}</span>}
          </span>
          <span className="tc-tempo">{espera(i.tempo_espera)}</span>
        </span>

        <span className="tc-tags">
          <span className="tc-tag motivo">{i.motivo_prioridade}</span>
          <span className="tc-tag">{ROTULO_ETAPA[i.etapa] ?? i.etapa}</span>
        </span>

        {i.sara_orientacao_curta && (
          <span className="tc-sara">
            <span className="tc-sara-topo">Sara · o que fazer</span>
            <p>{i.sara_orientacao_curta}</p>
          </span>
        )}
      </button>

      <div className="tc-acoes">
        {i.telefone_normalizado ? (
          /* Link REAL para o WhatsApp oficial. Sem texto, sem API, sem popup:
             quem envia é o corretor, do aparelho dele. O clique só registra a
             intenção local — não muda etapa, não confirma contato, não inicia
             SLA, não conclui tarefa. */
          <a
            className="tc-cta"
            href={`whatsapp://send?phone=${i.telefone_normalizado}`}
            data-e164={i.telefone_normalizado}
            onClick={marcou}
          >
            Chamar no WhatsApp
          </a>
        ) : (
          <button type="button" className="tc-cta" onClick={() => onAbrir(i.negocio_id)}>
            Abrir atendimento
          </button>
        )}
        <button
          type="button"
          className="tc-mais"
          aria-label={`Abrir ficha de ${i.nome ?? "lead"}`}
          onClick={() => onAbrir(i.negocio_id)}
        >
          ⋯
        </button>
      </div>

      {aguardando && (
        <p className="tc-aguardando">WhatsApp aberto — aguardando sincronização.</p>
      )}
      {i.outbound_real_confirmado && !aguardando && (
        <p className="tc-confirmado">Mensagem confirmada pela integração.</p>
      )}
    </li>
  );
}

/* -------------------------------- tela -------------------------------- */

export function TelaCorretor({ accessToken, nome, onAbrirLead, onIr }: {
  accessToken: string;
  nome: string;
  onAbrirLead: (negocioId: number) => void;
  onIr: (destino: string) => void;
}) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [numeros, setNumeros] = useState<Numeros | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("agora");

  const carregar = useCallback(async (sinal: AbortSignal) => {
    /* Fila e números em paralelo: são duas rotas independentes e serializar
       dobraria o tempo de abertura da tela em rede ruim. */
    const [rf, rn] = await Promise.all([
      fetch("/api/ncrm/fila-operacional", { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal }),
      fetch("/api/ncrm/painel", { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal }),
    ]);
    if (!rf.ok) throw new Error(String(rf.status));
    const jf = await rf.json();
    /* Os números são acessórios: se falharem, a fila ainda serve para trabalhar. */
    const jn = rn.ok ? await rn.json() : null;
    return { itens: (jf.itens as Item[]) ?? [], numeros: jn as Numeros | null };
  }, [accessToken]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    carregar(ctrl.signal)
      .then((d) => { if (vivo) { setItens(d.itens); setNumeros(d.numeros); setErro(false); setAtualizadoEm(new Date()); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setItens([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  useEffect(() => {
    const t = setInterval(() => setTentativa((n) => n + 1), ATUALIZA_MS);
    return () => clearInterval(t);
  }, []);

  const todos = itens ?? [];
  const agora = useMemo(() => filtrar(todos, "agora"), [todos]);
  const hoje = useMemo(() => filtrar(todos, "hoje"), [todos]);
  const visiveis = useMemo(() => filtrar(todos, filtro), [todos, filtro]);

  const primeiro = (nome || "").trim().split(/\s+/)[0] || "corretor";
  const agoraQtd = agora.length;

  return (
    <div className="tc-wrap">
      <header className="tc-topo">
        <div>
          <p className="tc-ola">{saudacaoHora(new Date().getHours())}, {primeiro}</p>
          <p className="tc-data">{dataPorExtenso(new Date())}</p>
        </div>
        <div className="tc-topo-acoes">
          <button type="button" className="tc-sino" aria-label="Avisos" onClick={() => onIr("/notificacoes")}>
            {/* Sino em SVG inline: um ícone não justifica uma dependência. */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {agoraQtd > 0 && <b>{agoraQtd}</b>}
          </button>
          <button type="button" className="tc-perfil" aria-label="Seu perfil" onClick={() => onIr("/perfil")}>
            {primeiro.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <p className="tc-eyebrow">Sua fila de hoje</p>
      <h1 className="tc-manchete">
        {itens === null ? "Carregando sua fila…"
          : agoraQtd === 0 ? "Ninguém esperando agora"
          : `${agoraQtd} ${agoraQtd === 1 ? "pessoa espera" : "pessoas esperam"} você agora`}
      </h1>

      {atualizadoEm && (
        <p className="tc-atualizado">
          Atualizado {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          <button type="button" onClick={() => setTentativa((n) => n + 1)}>↻ Atualizar</button>
        </p>
      )}

      {numeros && (
        <div className="tc-numeros">
          <button type="button" className="tc-num" onClick={() => setFiltro("todos")}>
            <b>{numeros.leads_base}</b><span>aguardando</span>
          </button>
          <button type="button" className="tc-num" onClick={() => setFiltro("agora")}>
            <b>{numeros.leads_novos}</b><span>leads novos</span>
          </button>
          <button type="button" className="tc-num" onClick={() => setFiltro("hoje")}>
            <b>{numeros.acoes_hoje}</b><span>retornos</span>
          </button>
        </div>
      )}

      <AvisoNotificacoes accessToken={accessToken} />

      <div className="tc-chips" role="tablist" aria-label="Filtro da fila">
        {([["agora", "Agora", agora.length], ["hoje", "Hoje", hoje.length], ["todos", "Todos", todos.length]] as const)
          .map(([chave, rotulo, qtd]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={filtro === chave}
              className={`tc-chip${filtro === chave ? " on" : ""}`}
              onClick={() => setFiltro(chave)}
            >
              {rotulo} · {qtd}
            </button>
          ))}
      </div>

      {itens === null && (
        <div className="tc-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="tc-erro" role="alert">
          <strong>Não foi possível carregar sua fila.</strong>
          <button type="button" onClick={() => { setErro(false); setItens(null); setTentativa((n) => n + 1); }}>
            Tentar de novo
          </button>
        </div>
      )}

      {itens !== null && !erro && visiveis.length === 0 && (
        <p className="tc-vazio">
          {filtro === "agora"
            ? "Ninguém esperando agora. Quando um cliente responder, aparece aqui."
            : "Nada neste filtro."}
        </p>
      )}

      {visiveis.length > 0 && (
        <ul className="tc-lista">
          {visiveis.map((i) => <CardLead key={i.negocio_id} i={i} onAbrir={onAbrirLead} />)}
        </ul>
      )}

      <p className="tc-rodape">Relatórios e histórico completos ficam no ERP pelo navegador.</p>
    </div>
  );
}
