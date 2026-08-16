"use client";
/* AGENDA NO CELULAR — desenho do print 05.
 *
 * Fonte: /api/agenda (RPC ncrm_agenda_corretor).
 *
 * ESCOPO: a agenda da IMOBILIÁRIA INTEIRA, com o nome de quem atende. Sem
 * isso, dois corretores saem para o mesmo empreendimento no mesmo horário sem
 * saber. O que é meu aparece normal; o dos colegas mostra o nome.
 *
 * O TOPO É ÂNCORA. O cartão do próximo compromisso fica igual em Dia, Semana
 * e Semana. Só o miolo muda — que é o que a aba promete mudar. Sumir com o topo
 * ao trocar de aba faz a tela pular e o corretor perde a referência.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  diaPorExtenso, hojeISO, jaPassou, proximo, quandoComeca,
  resumoDoDia, somarDias,
  type Compromisso,
} from "./telaAgenda.logica";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

type PeriodoAgenda = "dia" | "semana";

export function TelaAgendaMobile({ accessToken, onAbrirLead }: {
  accessToken: string;
  onAbrirLead: (negocioId: number) => void;
}) {
  const [dia, setDia] = useState<string>(() => hojeISO());
  const [periodo, setPeriodo] = useState<PeriodoAgenda>("dia");
  const [itens, setItens] = useState<Compromisso[] | null>(null);
  const [erro, setErro] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch(`/api/agenda?data=${dia}&periodo=${periodo}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (r.status === 401) throw new Error("sessao_expirada");
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.itens as Compromisso[]) ?? [];
  }, [accessToken, dia, periodo]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    /* NÃO zeramos a lista aqui: manter o que já está na tela enquanto a nova
       chega evita o pisca-e-encolhe ao trocar de aba. O esqueleto só aparece
       no primeiro carregamento. */
    carregar(ctrl.signal)
      .then((l) => { if (vivo) { setItens(l); setErro(false); setSessaoExpirada(false); setAtualizadoEm(new Date()); } })
      .catch((e) => {
        if (!vivo || e?.name === "AbortError") return;
        if (e instanceof Error && e.message === "sessao_expirada") setSessaoExpirada(true);
        else setErro(true);
        setItens([]);
      });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const lista = useMemo(() => itens ?? [], [itens]);
  const prox = useMemo(() => proximo(lista), [lista]);
  const paraListar = lista;

  const porDia = useMemo(() => {
    const mapa = new Map<string, Compromisso[]>();
    for (const c of [...paraListar].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))) {
      const atual = mapa.get(c.data) ?? [];
      atual.push(c);
      mapa.set(c.data, atual);
    }
    return [...mapa.entries()];
  }, [paraListar]);

  const passo = periodo === "dia" ? 1 : 7;

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;

  return (
    <div className="ape-agenda">
      <AppMobileOffline atualizadoEm={atualizadoEm} />
      {/* TOPO FIXO — igual em Dia e Semana.
          Quando não há nada à frente, o espaço não some: vira uma linha
          discreta. Sumir o bloco inteiro faria a tela pular do mesmo jeito. */}
      {prox ? (
        <section className="ape-agenda-proximo" aria-label="Próximo compromisso">
          <p className="ape-agenda-eyebrow">
            Próximo compromisso <span className="ape-agenda-quando">{quandoComeca(prox.faltam_min)}</span>
          </p>
          <p className="ape-agenda-prox-hora">{prox.hora} · {prox.tipo}</p>
          <p className="ape-agenda-prox-cliente">{prox.cliente}</p>
          {!prox.meu && <p className="ape-agenda-prox-dono">com {prox.corretor}</p>}
          {prox.local && <p className="ape-agenda-prox-local">📍 {prox.local}</p>}
          <div className="ape-agenda-prox-acoes">
            {/* Abre o app de mapas do aparelho. Sem mapa embutido: o corretor
                já confia no navegador dele mais do que confiaria no nosso. */}
            {prox.local ? (
              <a
                className="ape-agenda-btn-cheio"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prox.local)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no mapa
              </a>
            ) : (
              <span className="ape-agenda-sem-local">Sem endereço cadastrado</span>
            )}
            <button
              type="button"
              className="ape-agenda-btn-vazado"
              onClick={() => { if (prox.negocio_id) onAbrirLead(prox.negocio_id); }}
              disabled={!prox.negocio_id}
            >
              Ver ficha
            </button>
          </div>
        </section>
      ) : (
        <section className="ape-agenda-proximo vazio" aria-label="Próximo compromisso">
          <p className="ape-agenda-eyebrow">Próximo compromisso</p>
          <p className="ape-agenda-prox-cliente">
            {itens === null ? "Carregando…" : "Nada à frente neste período."}
          </p>
        </section>
      )}

      <div className="ape-agenda-barra">
        <div className="ape-agenda-chips" role="tablist" aria-label="Período">
          {([["dia", "Dia"], ["semana", "Semana"]] as const).map(([p, r]) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={periodo === p}
              className={`ape-agenda-chip${periodo === p ? " on" : ""}`}
              onClick={() => setPeriodo(p)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="ape-agenda-navega">
          <button type="button" aria-label="Anterior" onClick={() => setDia((d) => somarDias(d, -passo))}>‹</button>
          <button type="button" className="ape-agenda-hoje" onClick={() => setDia(hojeISO())}>Hoje</button>
          <button type="button" aria-label="Próximo" onClick={() => setDia((d) => somarDias(d, passo))}>›</button>
        </div>
      </div>

      <p className="ape-agenda-dia">
        {periodo === "semana" ? `semana de ${diaPorExtenso(dia)}` : diaPorExtenso(dia)}
        {" · "}
        {itens === null ? "carregando…" : resumoDoDia(paraListar.length)}
      </p>

      {itens === null && (
        <div className="ape-agenda-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="ape-agenda-erro" role="alert">
          <strong>Não foi possível carregar a agenda.</strong>
          <button type="button" onClick={() => { setErro(false); setTentativa((n) => n + 1); }}>
            Tentar de novo
          </button>
        </div>
      )}

      {itens !== null && !erro && paraListar.length === 0 && (
        <p className="ape-agenda-vazio">
          Nada marcado neste período. <a href="/tarefas">Ver Tarefas da Sara</a>
        </p>
      )}

      {porDia.map(([data, doDia]) => (
        <div key={data}>
          {periodo === "semana" && <p className="ape-agenda-subdia">{diaPorExtenso(data)}</p>}
          <ol className="ape-agenda-linha">
            {doDia.map((c) => (
              <li key={c.id} className={`ape-agenda-item${jaPassou(c) ? " passou" : ""}${c.meu ? " meu" : ""}`}>
                <span className="ape-agenda-hora">{c.hora}</span>
                <span className="ape-agenda-ponto" aria-hidden="true" />
                <button
                  type="button"
                  className="ape-agenda-cartao"
                  onClick={() => { if (c.negocio_id) onAbrirLead(c.negocio_id); }}
                >
                  <span className="ape-agenda-tipo">{c.tipo}</span>
                  <span className="ape-agenda-cliente">{c.cliente}</span>
                  {(c.local || c.produto) && <span className="ape-agenda-local">{c.local ?? c.produto}</span>}
                  {/* Só mostra o dono quando NÃO é meu: repetir o próprio nome
                      em toda linha seria ruído. */}
                  {!c.meu && <span className="ape-agenda-dono">{c.corretor}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
