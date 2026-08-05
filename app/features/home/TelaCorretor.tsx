"use client";
/* TELA DO CORRETOR — desenho do protótipo (print 01).
 *
 * Cabeçalho com saudação e data, manchete com o número de pessoas esperando,
 * três cartões de número, chips de filtro e card com avatar, tags, bloco da
 * Sara e ação em pílula.
 *
 * DUAS AÇÕES, POR PAPEL. O corretor ATENDE: o botão dele abre o WhatsApp do
 * aparelho — verde, link `whatsapp://` com fallback wa.me, e o ERP continua
 * sem enviar nada. O gestor ACOMPANHA: o botão dele abre a conversa entre o
 * lead e o corretor dentro do ERP, em roxo. Gestor mandando mensagem pelo
 * próprio número é o começo de um atendimento sem dono e sem histórico.
 *
 * REGRAS DE PRODUTO PRESERVADAS:
 *   - clique no WhatsApp não confirma contato; só a integração confirma;
 *   - Sara orienta, nunca envia;
 *   - nada de vocabulário técnico na tela.
 *
 * As regras puras vivem em telaCorretor.logica.ts — é de lá que os testes leem.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROTULO_ETAPA } from "./meuDia.logica";
import {
  dataPorExtenso, ehVencida, espera, filtrar, iniciais, manchete, saudacaoHora,
  type Filtro, type ItemTela,
} from "./telaCorretor.logica";
import { marcarWhatsappAberto, whatsappAbertoEm, limparWhatsappAberto } from "../crm-nova-era/lib/whatsappAberto";
import { useErpSession } from "../system/ErpSession";

const ATUALIZA_MS = 60_000;

type Numeros = { leads_novos: number; acoes_hoje: number; leads_base: number };

/** Quem acompanha em vez de atender. Vem da sessão, não de prop. */
const PAPEIS_GESTAO = ["admin", "executivo", "diretor", "gerente"];

/* --------------------------------- card --------------------------------- */

function CardLead({ i, onAbrir, onConversa, ehGestao }: {
  i: ItemTela;
  onAbrir: (id: number) => void;
  onConversa: (id: number) => void;
  ehGestao: boolean;
}) {
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
        {ehGestao ? (
          /* GESTOR: lê a conversa entre lead e corretor dentro do ERP. Roxo,
             não verde — verde promete WhatsApp, e não é isso que abre. */
          <button type="button" className="tc-cta gestao" onClick={() => onConversa(i.negocio_id)}>
            Abrir conversa
          </button>
        ) : i.telefone_normalizado ? (
          /* CORRETOR: link REAL para o WhatsApp oficial. Sem texto, sem API,
             sem popup: quem envia é ele, do aparelho dele. O clique só
             registra a intenção local — não muda etapa, não confirma contato,
             não inicia SLA, não conclui tarefa. */
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

      {/* FALLBACK wa.me. O print não mostra este link, mas ele existe por
          motivo funcional: `whatsapp://` não abre em alguns aparelhos nem no
          navegador do desktop, e sem ele o corretor toca e não acontece nada.
          Não aparece para gestão — lá o botão não é WhatsApp. */}
      {!ehGestao && i.telefone_normalizado && (
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

      {aguardando && !ehGestao && (
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

  /* O papel vem da sessão, não de prop: quem monta a tela não precisa saber
     disso, e prop nova em HomeWorkspace seria mexer na tela mais crítica. */
  const { role } = useErpSession();
  const ehGestao = PAPEIS_GESTAO.includes(String(role ?? "").toLowerCase());

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

  /* O botão roxo abre a CONVERSA entre o lead e o corretor, para LER.
   *
   * `?chat=` é o único parâmetro que chega no mini chat: a página de CRM o
   * traduz em `initialChatDealId` e o CrmWorkspace monta o LeadChatDrawer.
   * `?lead=` abriria a ficha — outra tela, e o botão aqui promete conversa.
   *
   * `&ler=1` é o que faz valer a regra do topo deste arquivo. O drawer nasceu
   * para o corretor: vem com compositor, enviar, gravador de áudio e as
   * ferramentas de Documento/Agendar/Abordagem. Abri-lo inteiro para o gestor
   * entregava exatamente o que a regra proíbe. Com `ler=1` a página marca o
   * body e o CSS esconde tudo que escreve — sobra o histórico, que é o que a
   * D-API já grava e a Sara já lê.
   *
   * ISTO NÃO FUNCIONAVA NO CELULAR, e não era culpa desta linha: o
   * CrmNovaEraGate trocava a tela inteira pela TelaCrmMobile e o CrmWorkspace
   * nunca montava, então o parâmetro morria na URL. Corrigido no gate. */
  const abrirConversa = useCallback((negocioId: number) => onIr(`/crm?chat=${negocioId}&ler=1`), [onIr]);

  return (
    <div className="tc-wrap">
      <header className="tc-topo">
        <div>
          <p className="tc-ola">{saudacaoHora(new Date().getHours())}, {primeiro}</p>
          <p className="tc-data">{dataPorExtenso(new Date())}</p>
        </div>
        <div className="tc-topo-acoes">
          <button type="button" className="tc-sino" aria-label="Avisos" onClick={() => onIr("/notificacoes")}>
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

      <p className="tc-eyebrow">{ehGestao ? "Fila da equipe" : "Sua fila de hoje"}</p>
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
          {visiveis.map((i) => (
            <CardLead
              key={i.negocio_id}
              i={i}
              onAbrir={onAbrirLead}
              onConversa={abrirConversa}
              ehGestao={ehGestao}
            />
          ))}
        </ul>
      )}

      <p className="tc-rodape">Relatórios e histórico completos ficam no ERP pelo navegador.</p>
    </div>
  );
}
