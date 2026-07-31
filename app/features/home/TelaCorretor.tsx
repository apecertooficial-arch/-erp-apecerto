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
 *
 * As regras puras (iniciais, tempo, filtro, manchete) vivem em
 * telaCorretor.logica.ts — é de lá que os testes leem. Cópia em dois lugares é
 * o caminho mais curto para a tela e o teste discordarem sem ninguém perceber.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROTULO_ETAPA } from "./meuDia.logica";
import {
  dataPorExtenso, ehVencida, espera, filtrar, iniciais, manchete, saudacaoHora,
  type Filtro, type ItemTela,
} from "./telaCorretor.logica";
import { marcarWhatsappAberto, whatsappAbertoEm, limparWhatsappAberto } from "../crm-nova-era/lib/whatsappAberto";
import { AvisoNotificacoes } from "./AvisoNotificacoes";

const ATUALIZA_MS = 60_000;

type Numeros = { leads_novos: number; acoes_hoje: number; leads_base: number };

/* --------------------------------- card --------------------------------- */

function CardLead({ i, onAbrir }: { i: ItemTela; onAbrir: (id: number) => void }) {
  /* sessionStorage não é reativo; este tick força o re-render para o aviso
     aparecer NA HORA em que o corretor volta do WhatsApp. */
  const [, setTick] = useState(0);
  const marcou = () => { marcarWhatsappAberto(i.negocio_id); setTick((t) => t + 1); };

  const abriuLocal = whatsappAbertoEm(i.negocio_id) != null;
  if (i.outbound_real_confirmado && abriuLocal) limparWhatsappAberto(i.negocio_id);
  const aguardando = !i.outbound_real_confirmado && (i.aguardando_sincronizacao || abriuLocal);

  return (
    <li className={`tc-card${ehVencida(i) ? " vencida" : ""}`}>
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

      {/* FALLBACK wa.me. O print não mostra este link, e por isso ele quase
          saiu daqui — mas existe por motivo funcional, não estético:
          `whatsapp://` não abre em alguns aparelhos nem no navegador do
          desktop, e sem ele o corretor toca e não acontece nada. Fica
          discreto, embaixo da ação principal, sem competir com ela. */}
      {i.telefone_normalizado && (
        <a
          className="tc-fallback"
          href={`https://wa.me/${i.telefone_normalizado}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={marcou}
        >
          Não abriu? Abrir pelo WhatsApp Web
        </a>
      )}

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
  const [itens, setItens] = useState<ItemTela[] | null>(null);
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
    return { itens: (jf.itens as ItemTela[]) ?? [], numeros: jn as Numeros | null };
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
      <h1 className="tc-manchete">{manchete(agoraQtd, itens === null)}</h1>

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
