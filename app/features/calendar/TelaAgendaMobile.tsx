"use client";
/* AGENDA NO CELULAR — desenho do print 05.
 *
 * Fonte: /api/agenda (RPC ncrm_agenda_corretor).
 *
 * ESCOPO: a agenda da IMOBILIÁRIA INTEIRA, com o nome de quem atende. Sem
 * isso, dois corretores saem para o mesmo empreendimento no mesmo horário sem
 * saber. O que é meu aparece normal; o dos colegas mostra o nome.
 *
 * ABRE NO MÊS. Marcar e conferir visita é trabalho de mês, não de dia: o
 * corretor precisa ver onde há espaço antes de combinar horário. Dia e Semana
 * continuam a um toque.
 *
 * O TOPO É ÂNCORA. O cartão do próximo compromisso fica igual em Mês, Semana e
 * Dia. Só o miolo muda — que é o que a aba promete mudar. Sumir com o topo ao
 * trocar de aba faz a tela pular e o corretor perde a referência.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  diaPorExtenso, gradeDoMes, hojeISO, jaPassou, proximo, quandoComeca,
  resumoDoDia, somarDias,
  type Compromisso,
} from "./telaAgenda.logica";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

type PeriodoAgenda = "dia" | "semana" | "mes";

/** "agosto de 2026" — minúscula, como o resto do app. */
function mesPorExtenso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toLowerCase();
}

/** Soma mês sem passar por fuso, e sem estourar para o mês seguinte: o dia 1
 *  é o âncora do período, não o dia visitado. */
function somarMeses(iso: string, meses: number): string {
  const [a, m] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1 + meses, 1));
  return base.toISOString().slice(0, 10);
}

export function TelaAgendaMobile({ accessToken, onAbrirLead }: {
  accessToken: string;
  onAbrirLead: (negocioId: number) => void;
}) {
  const [dia, setDia] = useState<string>(() => hojeISO());
  const [periodo, setPeriodo] = useState<PeriodoAgenda>("mes");
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

  /* No mês a lista de baixo é SOMENTE do dia tocado. Em dia e semana, tudo o
     que o período devolveu. */
  const paraListar = useMemo(
    () => (periodo === "mes" ? lista.filter((c) => c.data === dia) : lista),
    [lista, periodo, dia],
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, Compromisso[]>();
    for (const c of [...paraListar].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))) {
      const atual = mapa.get(c.data) ?? [];
      atual.push(c);
      mapa.set(c.data, atual);
    }
    return [...mapa.entries()];
  }, [paraListar]);

  const celulas = useMemo(() => (periodo === "mes" ? gradeDoMes(dia, lista) : []), [periodo, dia, lista]);

  const anterior = () => setDia((d) => (periodo === "mes" ? somarMeses(d, -1) : somarDias(d, periodo === "semana" ? -7 : -1)));
  const seguinte = () => setDia((d) => (periodo === "mes" ? somarMeses(d, 1) : somarDias(d, periodo === "semana" ? 7 : 1)));

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;

  return (
    <div className="ape-agenda">
      <AppMobileOffline atualizadoEm={atualizadoEm} />
      {/* TOPO FIXO — igual em Mês, Semana e Dia.
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
          {([["mes", "Mês"], ["semana", "Semana"], ["dia", "Dia"]] as const).map(([p, r]) => (
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
          <button type="button" aria-label="Anterior" onClick={anterior}>‹</button>
          <button type="button" className="ape-agenda-hoje" onClick={() => setDia(hojeISO())}>Hoje</button>
          <button type="button" aria-label="Próximo" onClick={seguinte}>›</button>
        </div>
      </div>

      {/* GRADE DO MÊS. Sempre 42 células: mês curto não muda a altura e a lista
          de baixo não sobe na cara de quem está tocando. */}
      {periodo === "mes" && (
        <section className="ape-cal" aria-label={`Calendário de ${mesPorExtenso(dia)}`}>
          <p className="ape-cal-mes">{mesPorExtenso(dia)}</p>
          <div className="ape-cal-semana" aria-hidden="true">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => <span key={`${d}${i}`} className={i > 4 ? "fds" : ""}>{d}</span>)}
          </div>
          <div className="ape-cal-grade">
            {celulas.map((c) => (
              <button
                key={c.iso}
                type="button"
                className={`ape-cal-dia${c.iso === dia ? " on" : ""}${c.foraDoMes ? " fora" : ""}`}
                onClick={() => setDia(c.iso)}
                aria-current={c.iso === dia ? "date" : undefined}
              >
                {c.numero}
                {c.total > 0 && c.iso !== dia && <i className={c.total > 2 ? "cheio" : ""} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="ape-cal-legenda">
            <span><i aria-hidden="true" />até 2 compromissos</span>
            <span><i className="cheio" aria-hidden="true" />3 ou mais</span>
          </p>
        </section>
      )}

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
          {periodo === "mes" ? "Nada marcado neste dia. Toque num dia com ponto." : "Nada marcado neste período."}{" "}
          <a href="/tarefas">Ver Tarefas da Sara</a>
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
