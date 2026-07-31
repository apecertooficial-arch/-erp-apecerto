"use client";

/* MEU DIA — a tela do corretor no celular.
 *
 * Nao e o Inicio gerencial encolhido. Responde uma pergunta so: "quem eu atendo
 * agora, e por que?". Meta, VGV, funil e ranking nao aparecem antes da fila --
 * numero de gestao em cima de lista de trabalho nao ajuda ninguem a trabalhar.
 *
 * Fonte: /api/ncrm/fila (8 KB), prioridade calculada no banco e ja escopada por
 * carteira e papel. Nada e recalculado aqui.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  montarBlocos, paraAtender, saudacao, ROTULO_ACAO, type ItemFila, type Card,
} from "./meuDia.logica";
import { marcarWhatsappAberto, whatsappAbertoEm, limparWhatsappAberto } from "../crm-nova-era/lib/whatsappAberto";
import { AvisoNotificacoes } from "./AvisoNotificacoes";

const ATUALIZA_MS = 60_000;

function CardLead({ c, onAbrir }: { c: Card; onAbrir: (id: number) => void }) {
  /* O clique registra a intencao no sessionStorage, que nao e reativo. Este
     tick forca o re-render para o aviso aparecer NA HORA em que o corretor
     volta do WhatsApp -- nao no proximo ciclo de 60s. */
  const [, setTick] = useState(0);
  const marcou = () => { marcarWhatsappAberto(c.negocioId); setTick((t) => t + 1); };
  /* "Aguardando sincronizacao" tem duas fontes e nenhuma delas e envio:
     - servidor: ncrm_whatsapp_intencao ainda sem confirmacao da D-API;
     - local: o corretor abriu o WhatsApp NESTE aparelho (sessionStorage).
     Quando o outbound real chega, as duas se apagam. Nunca "contato realizado":
     o toque nao prova que ele falou com ninguem. */
  const abriuLocal = whatsappAbertoEm(c.negocioId) != null;
  if (c.outboundConfirmado && abriuLocal) limparWhatsappAberto(c.negocioId);
  const aguardando = !c.outboundConfirmado && (c.aguardandoServidor || abriuLocal);

  return (
    <li className={`md-card${c.vencida ? " vencida" : ""}`}>
      {/* O corpo abre a ficha; a acao principal vive FORA dele porque <a> dentro
          de <button> e HTML invalido e quebra leitor de tela. */}
      <button type="button" className="md-card-corpo" onClick={() => onAbrir(c.negocioId)}>
        <span className="md-linha1">
          <b className="md-nome">{c.nome}</b>
          <span className="md-espera">{c.espera}</span>
        </span>
        <span className="md-motivo">{c.motivo}</span>
        {c.interesse && <span className="md-interesse">{c.interesse}</span>}
        {c.orientacaoSara && <span className="md-sara">Sara: {c.orientacaoSara}</span>}
        <span className="md-meta"><span className="md-etapa">{c.etapa}</span></span>
      </button>

      {c.acao === "whatsapp" && c.telefone ? (
        <>
          {/* Link REAL para o WhatsApp oficial. Sem texto, sem API, sem popup:
              quem envia e o corretor, do aparelho dele. O clique so registra a
              intencao local -- nao muda etapa, nao confirma contato, nao inicia
              SLA, nao conclui tarefa. */}
          <a
            className="md-acao"
            href={`whatsapp://send?phone=${c.telefone}`}
            data-e164={c.telefone}
            onClick={marcou}
          >
            Chamar no WhatsApp
          </a>
          <a
            className="md-wa-fallback"
            href={`https://wa.me/${c.telefone}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={marcou}
          >
            Não abriu? Abrir pelo WhatsApp Web
          </a>
        </>
      ) : (
        <button type="button" className="md-acao" onClick={() => onAbrir(c.negocioId)}>
          {ROTULO_ACAO[c.acao]}
        </button>
      )}

      {aguardando && (
        <span className="md-aguardando">WhatsApp aberto — aguardando sincronização.</span>
      )}
    </li>
  );
}

export function MeuDiaCorretor({ accessToken, nome, onAbrirLead, onIr }: {
  accessToken: string;
  nome: string;
  onAbrirLead: (negocioId: number) => void;
  onIr: (destino: string) => void;
}) {
  const [itens, setItens] = useState<ItemFila[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch("/api/ncrm/fila-operacional", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.itens as ItemFila[]) ?? [];
  }, [accessToken]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    carregar(ctrl.signal)
      .then((l) => { if (vivo) { setItens(l); setErro(false); setAtualizadoEm(new Date()); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setItens([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  // Reatualiza sozinho: o corretor deixa o app aberto entre atendimentos.
  useEffect(() => {
    const t = setInterval(() => setTentativa((n) => n + 1), ATUALIZA_MS);
    return () => clearInterval(t);
  }, []);

  const blocos = useMemo(() => montarBlocos(itens ?? []), [itens]);
  const aAtender = useMemo(() => paraAtender(itens ?? []), [itens]);
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "corretor";
  const vazio = itens !== null && blocos.every((b) => b.total === 0);

  return (
    <div className="md-wrap">
      <header className="md-topo">
        <p className="md-ola">{saudacao(new Date().getHours())}, {primeiro}</p>
        <p className="md-chamada">
          {itens === null ? "Carregando sua fila…"
            : aAtender === 0 ? "Nenhum cliente esperando agora."
            : `Você tem ${aAtender} ${aAtender === 1 ? "cliente" : "clientes"} para atender`}
        </p>
        {atualizadoEm && (
          <p className="md-atualizado">
            Atualizado {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            <button type="button" onClick={() => setTentativa((n) => n + 1)}>Atualizar</button>
          </p>
        )}
      </header>

      {/* Depois do cabecalho e ANTES da fila: enquanto o aparelho nao recebe
          aviso, ligar isso e a coisa mais util da tela. Some sozinha quando
          o aparelho ja esta inscrito -- nao vira mais um banner permanente. */}
      <AvisoNotificacoes accessToken={accessToken} />

      {itens === null && (
        <div className="md-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="md-erro" role="alert">
          <strong>Não foi possível carregar sua fila.</strong>
          <button type="button" onClick={() => { setErro(false); setItens(null); setTentativa((n) => n + 1); }}>
            Tentar novamente
          </button>
        </div>
      )}

      {vazio && !erro && (
        <p className="md-vazio">Nada pendente agora. Quando um cliente responder ou uma ação vencer, aparece aqui.</p>
      )}

      {itens !== null && blocos.filter((b) => b.total > 0).map((b) => (
        <section key={b.chave} className={`md-bloco ${b.chave}`} aria-labelledby={`md-${b.chave}`}>
          <header>
            <h2 id={`md-${b.chave}`}>{b.titulo}</h2>
            <span className="md-contador">{b.total}</span>
          </header>
          <p className="md-ajuda">{b.ajuda}</p>
          <ul>{b.cards.map((c) => <CardLead key={c.id} c={c} onAbrir={onAbrirLead} />)}</ul>
          {b.total > b.cards.length && (
            <button type="button" className="md-ver-todos" onClick={() => onIr("/crm")}>
              Ver todos ({b.total})
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
