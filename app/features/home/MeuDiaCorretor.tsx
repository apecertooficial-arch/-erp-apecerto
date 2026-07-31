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
import { whatsappAbertoEm } from "../crm-nova-era/lib/whatsappAberto";

const ATUALIZA_MS = 60_000;

function CardLead({ c, onAbrir }: { c: Card; onAbrir: (id: number) => void }) {
  /* Se o corretor abriu o WhatsApp deste cliente e o outbound ainda nao voltou
     pelo D-API, dizemos exatamente isso. Nunca "contato realizado": o toque no
     botao nao prova que ele falou com ninguem. */
  const abertoEm = whatsappAbertoEm(c.negocioId);

  return (
    <li className={`md-card${c.vencida ? " vencida" : ""}`}>
      <button type="button" onClick={() => onAbrir(c.negocioId)}>
        <span className="md-linha1">
          <b className="md-nome">{c.nome}</b>
          <span className="md-espera">{c.espera}</span>
        </span>
        <span className="md-motivo">{c.motivo}</span>
        <span className="md-meta">
          <span className="md-etapa">{c.etapa}</span>
          {c.proximaAcao && <span className="md-proxima">{c.proximaAcao}</span>}
        </span>
        {abertoEm && (
          <span className="md-aguardando">
            WhatsApp aberto. Aguardando a mensagem aparecer no histórico.
          </span>
        )}
        <span className="md-acao">{ROTULO_ACAO[c.acao]}</span>
      </button>
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
    const r = await fetch("/api/ncrm/fila?filtro=agora", {
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
