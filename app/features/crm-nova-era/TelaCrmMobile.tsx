"use client";
/* CRM NO CELULAR — desenho do print 02.
 *
 * Componente novo, escrito a partir do print. Não substitui o CRM inteiro:
 * é a vista do celular, com a mesma fonte de dados de sempre
 * (/api/ncrm/fila-operacional), já escopada por carteira dentro do banco.
 *
 * O que o print manda e está aqui:
 *   - "CRM · seu dia, em ordem" no cabeçalho;
 *   - busca por cliente ou telefone;
 *   - abas Meu Dia / Funil / Leads / Visitas;
 *   - cartão roxo "SARA · BRIEFING DO DIA" com duas ações;
 *   - "AGORA · n" e o botão Filtros;
 *   - linha compacta: avatar, nome, motivo em laranja, tempo, chevron.
 *
 * ABRIR UM LEAD (print 06)
 * Tocar numa linha monta a `FichaLeadMobile` por cima desta tela. A lista
 * continua montada atrás, então voltar devolve a rolagem no ponto exato
 * em que estava — e nada é buscado de novo.
 *
 * DEEP LINK DO PUSH (?lead=N)
 * O aviso de lead novo no celular aponta para /crm?lead=N (via /negocio/N).
 * O parâmetro é lido UMA vez na montagem e guardado num ref; quando a fila
 * chega, a ficha do negócio pedido abre. A query é apagada no consumo — o
 * botão voltar não pode reabrir a mesma ficha. Lead que não está mais na
 * fila vira um aviso visível, nunca silêncio: falha muda foi exatamente o
 * defeito que fez "toquei e não aconteceu nada" existir.
 *
 * REGRAS DE PRODUTO, iguais às da tela de Início:
 *   - a Sara orienta, nunca envia;
 *   - abrir a ficha não confirma contato;
 *   - nada de vocabulário técnico.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  espera, filtrar, iniciais, type ItemTela,
} from "../home/telaCorretor.logica";
import { briefingDaSara, buscar, type Aba } from "./telaCrm.logica";
import { FichaLeadMobile } from "./FichaLeadMobile";

const ATUALIZA_MS = 60_000;

/* O negócio pedido na URL, lido uma vez. Número inválido é null — nunca NaN. */
function lerLeadDaUrl(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = new URLSearchParams(window.location.search).get("lead");
    if (!bruto) return null;
    const n = Number(bruto);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/* Consumir o deep link apaga a query, senão voltar/atualizar reabriria. */
function limparLeadDaUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("lead");
    window.history.replaceState(null, "", url.toString());
  } catch { /* a URL suja não quebra nada — só reabre no F5 */ }
}

export function TelaCrmMobile({ accessToken, nome, onAbrirLead, onIr }: {
  accessToken: string;
  nome: string;
  /* Escape para o CRM de desktop. Deixou de ser o caminho de abrir um
     lead e virou item de menu — por isso opcional. */
  onAbrirLead?: (negocioId: number) => void;
  onIr: (destino: string) => void;
}) {
  const [itens, setItens] = useState<ItemTela[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [aba, setAba] = useState<Aba>("meu_dia");
  const [termo, setTermo] = useState("");
  const [abertoSnap, setAbertoSnap] = useState<ItemTela | null>(null);
  const [leadForaDaFila, setLeadForaDaFila] = useState(false);

  /* Ref e não estado: o pedido do push é consumido UMA vez, na chegada da
     fila, dentro do próprio .then — setState síncrono em useEffect é
     proibido pelo lint dos hooks, e com razão: seria um re-render a mais
     para dizer uma coisa que o callback já sabia. */
  const leadPedido = useRef<number | null>(null);
  if (leadPedido.current === null && typeof window !== "undefined") {
    /* Preenchido no primeiro render do cliente; consumido e zerado abaixo. */
    const pedido = lerLeadDaUrl();
    if (pedido !== null) leadPedido.current = pedido;
  }

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch("/api/ncrm/fila-operacional", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.itens as ItemTela[]) ?? [];
  }, [accessToken]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    carregar(ctrl.signal)
      .then((l) => {
        if (!vivo) return;
        setItens(l);
        setErro(false);
        /* O pedido do push é atendido aqui, quando a fila chega — não num
           efeito próprio. Fora da fila = aviso na tela; o corretor decide
           se procura na busca ou segue o dia. */
        if (leadPedido.current !== null) {
          const alvo = l.find((x) => x.negocio_id === leadPedido.current);
          if (alvo) setAbertoSnap(alvo);
          else setLeadForaDaFila(true);
          leadPedido.current = null;
          limparLeadDaUrl();
        }
      })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setItens([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  useEffect(() => {
    const t = setInterval(() => setTentativa((n) => n + 1), ATUALIZA_MS);
    return () => clearInterval(t);
  }, []);

  const todos = useMemo(() => itens ?? [], [itens]);
  const agora = useMemo(() => filtrar(todos, "agora"), [todos]);
  const visiveis = useMemo(() => buscar(aba === "meu_dia" ? agora : todos, termo), [agora, todos, aba, termo]);
  const briefing = useMemo(() => briefingDaSara(agora), [agora]);
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "corretor";

  /* A ficha usa a versão MAIS NOVA do item quando a atualização de minuto
     em minuto ainda traz aquele negócio, e a cópia guardada quando ele já
     saiu da fila. Sem a cópia, atender o cliente faria a ficha se fechar
     sozinha na cara do corretor — que é exatamente quando ele ainda está
     olhando para ela. */
  const aberto = useMemo(() => {
    if (!abertoSnap) return null;
    return todos.find((x) => x.negocio_id === abertoSnap.negocio_id) ?? abertoSnap;
  }, [abertoSnap, todos]);

  const abrir = useCallback((item: ItemTela) => setAbertoSnap(item), []);
  const fechar = useCallback(() => setAbertoSnap(null), []);

  return (
    <>
      <div className="cm-wrap">
        <header className="cm-topo">
          <div>
            <p className="cm-titulo">CRM</p>
            <p className="cm-sub">seu dia, em ordem</p>
          </div>
          <div className="cm-topo-acoes">
            <button type="button" className="cm-sino" aria-label="Avisos" onClick={() => onIr("/notificacoes")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {agora.length > 0 && <b>{agora.length}</b>}
            </button>
            <button type="button" className="cm-perfil" aria-label="Seu perfil" onClick={() => onIr("/perfil")}>
              {primeiro.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="cm-busca">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            inputMode="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar cliente ou telefone"
            aria-label="Buscar cliente ou telefone"
          />
        </div>

        <div className="cm-abas" role="tablist" aria-label="Vistas do CRM">
          {([["meu_dia", "Meu Dia"], ["funil", "Funil"], ["leads", "Leads"], ["visitas", "Visitas"]] as const)
            .map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                role="tab"
                aria-selected={aba === chave}
                className={`cm-aba${aba === chave ? " on" : ""}`}
                onClick={() => {
                  /* Funil, Leads e Visitas continuam nas telas completas: a
                     vista do celular é a fila. Levar para lá é melhor do que
                     fingir uma versão pobre aqui. */
                  if (chave === "funil") onIr("/crm?vista=quadro");
                  else if (chave === "visitas") onIr("/agenda");
                  else setAba(chave);
                }}
              >
                {rotulo}
              </button>
            ))}
        </div>

        {/* CARTÃO ROXO DA SARA. Fica sempre no mesmo lugar — topo da lista —
            porque previsibilidade é o que faz o corretor confiar nela. Ela
            orienta por onde começar; não envia nada, não move nada. */}
        {briefing && (
          <section className="cm-briefing" aria-label="Briefing da Sara">
            <p className="cm-briefing-topo">Sara · briefing do dia</p>
            <p className="cm-briefing-texto">{briefing.texto}</p>
            <div className="cm-briefing-acoes">
              <button
                type="button"
                className="cm-btn-claro"
                onClick={() => {
                  const alvo = agora.find((x) => x.negocio_id === briefing.primeiroId);
                  if (alvo) abrir(alvo);
                }}
              >
                Atender agora
              </button>
              <button type="button" className="cm-btn-vazado" onClick={() => onIr("/notificacoes")}>
                Ver as {briefing.tarefas} tarefas
              </button>
            </div>
          </section>
        )}

        <div className="cm-secao">
          <span className="cm-eyebrow">
            {aba === "meu_dia" ? "Agora" : "Todos"} · {visiveis.length}
          </span>
          <button type="button" className="cm-filtros" onClick={() => onIr("/crm?vista=quadro")}>
            Filtros
          </button>
        </div>

        {/* O push prometeu um lead que a fila não tem mais (atendido por
            outro, saiu da carteira, aviso antigo). Dizer é obrigatório:
            o silêncio aqui já foi o pior defeito desta tela. */}
        {leadForaDaFila && (
          <div className="cm-erro" role="status">
            <strong>Esse cliente não está mais na sua fila.</strong>
            <button type="button" onClick={() => setLeadForaDaFila(false)}>
              Entendi
            </button>
          </div>
        )}

        {itens === null && (
          <div className="cm-esqueleto" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} />)}</div>
        )}

        {erro && (
          <div className="cm-erro" role="alert">
            <strong>Não foi possível carregar a lista.</strong>
            <button type="button" onClick={() => { setErro(false); setItens(null); setTentativa((n) => n + 1); }}>
              Tentar de novo
            </button>
          </div>
        )}

        {itens !== null && !erro && visiveis.length === 0 && (
          <p className="cm-vazio">
            {termo ? "Nenhum cliente com esse nome ou telefone." : "Nada por aqui agora."}
          </p>
        )}

        {visiveis.length > 0 && (
          <ul className="cm-lista">
            {visiveis.map((i) => (
              <li key={i.negocio_id}>
                <button type="button" className="cm-linha" onClick={() => abrir(i)}>
                  <span className="cm-avatar" aria-hidden="true">{iniciais(i.nome)}</span>
                  <span className="cm-quem">
                    <span className="cm-nome">{i.nome ?? `Negócio ${i.negocio_id}`}</span>
                    <span className="cm-motivo">{i.motivo_prioridade}</span>
                  </span>
                  <span className="cm-tempo">{espera(i.tempo_espera)}</span>
                  <span className="cm-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {aberto && (
        <FichaLeadMobile
          key={aberto.negocio_id}
          item={aberto}
          accessToken={accessToken}
          onVoltar={fechar}
          onAbrirNoCrm={onAbrirLead}
        />
      )}
    </>
  );
}
