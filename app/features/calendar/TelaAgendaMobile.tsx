"use client";
/* AGENDA NO CELULAR — desenho do print 05.
 *
 * Fonte: /api/ncrm/agenda (RPC ncrm_agenda_corretor).
 *
 * ESCOPO: mostra a agenda da IMOBILIÁRIA INTEIRA, com o nome de quem atende.
 * Sem isso, dois corretores saem para o mesmo empreendimento no mesmo horário
 * sem saber. O que é meu ganha marca laranja; o dos colegas fica neutro — dá
 * contexto sem competir com o próprio trabalho.
 *
 * Conversa, telefone e ficha do lead continuam escopados por carteira nas
 * outras telas. Agenda é compromisso, não é o cliente.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  diaPorExtenso, hojeISO, jaPassou, proximo, quandoComeca, resumoDoDia, somarDias,
  type Compromisso, type Periodo,
} from "./telaAgenda.logica";

export function TelaAgendaMobile({ accessToken, onAbrirLead }: {
  accessToken: string;
  onAbrirLead: (negocioId: number) => void;
}) {
  const [dia, setDia] = useState<string>(() => hojeISO());
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [itens, setItens] = useState<Compromisso[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch(`/api/ncrm/agenda?data=${dia}&periodo=${periodo}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.itens as Compromisso[]) ?? [];
  }, [accessToken, dia, periodo]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    setItens(null);
    carregar(ctrl.signal)
      .then((l) => { if (vivo) { setItens(l); setErro(false); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setItens([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const lista = itens ?? [];
  const prox = useMemo(() => proximo(lista), [lista]);

  /* Em semana e mês a lista precisa de cabeçalho por dia, senão vira um monte
     de horários sem data. No dia, um cabeçalho só já está acima. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, Compromisso[]>();
    for (const c of [...lista].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))) {
      const atual = mapa.get(c.data) ?? [];
      atual.push(c);
      mapa.set(c.data, atual);
    }
    return [...mapa.entries()];
  }, [lista]);

  const passo = periodo === "dia" ? 1 : periodo === "semana" ? 7 : 30;

  return (
    <div className="ag-wrap">
      {prox && (
        <section className="ag-proximo" aria-label="Próximo compromisso">
          <p className="ag-eyebrow">
            Próximo compromisso <span className="ag-quando">{quandoComeca(prox.faltam_min)}</span>
          </p>
          <p className="ag-prox-hora">{prox.hora} · {prox.tipo}</p>
          <p className="ag-prox-cliente">{prox.cliente}</p>
          {!prox.meu && <p className="ag-prox-dono">com {prox.corretor}</p>}
          {prox.local && <p className="ag-prox-local">📍 {prox.local}</p>}
          <div className="ag-prox-acoes">
            {/* Abre o app de mapas do aparelho. Sem mapa embutido: o corretor
                já confia no navegador dele mais do que confiaria no nosso. */}
            {prox.local ? (
              <a
                className="ag-btn-cheio"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prox.local)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no mapa
              </a>
            ) : (
              <span className="ag-sem-local">Sem endereço cadastrado</span>
            )}
            <button
              type="button"
              className="ag-btn-vazado"
              onClick={() => { if (prox.negocio_id) onAbrirLead(prox.negocio_id); }}
              disabled={!prox.negocio_id}
            >
              Ver ficha
            </button>
          </div>
        </section>
      )}

      <div className="ag-barra">
        <div className="ag-chips" role="tablist" aria-label="Período">
          {([["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([p, r]) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={periodo === p}
              className={`ag-chip${periodo === p ? " on" : ""}`}
              onClick={() => setPeriodo(p)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="ag-navega">
          <button type="button" aria-label="Anterior" onClick={() => setDia((d) => somarDias(d, -passo))}>‹</button>
          <button type="button" aria-label="Hoje" className="ag-hoje" onClick={() => setDia(hojeISO())}>Hoje</button>
          <button type="button" aria-label="Próximo" onClick={() => setDia((d) => somarDias(d, passo))}>›</button>
        </div>
      </div>

      <p className="ag-dia">
        {periodo === "dia" ? diaPorExtenso(dia) : `${periodo === "semana" ? "semana de" : "mês de"} ${diaPorExtenso(dia)}`}
        {" · "}
        {itens === null ? "carregando…" : resumoDoDia(lista.length)}
      </p>

      {itens === null && (
        <div className="ag-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="ag-erro" role="alert">
          <strong>Não foi possível carregar a agenda.</strong>
          <button type="button" onClick={() => { setErro(false); setTentativa((n) => n + 1); }}>
            Tentar de novo
          </button>
        </div>
      )}

      {itens !== null && !erro && lista.length === 0 && (
        <p className="ag-vazio">Nada marcado neste período.</p>
      )}

      {porDia.map(([data, doDia]) => (
        <div key={data}>
          {periodo !== "dia" && <p className="ag-subdia">{diaPorExtenso(data)}</p>}
          <ol className="ag-linha">
            {doDia.map((c) => (
              <li key={c.id} className={`ag-item${jaPassou(c) ? " passou" : ""}${c.meu ? " meu" : ""}`}>
                <span className="ag-hora">{c.hora}</span>
                <span className="ag-ponto" aria-hidden="true" />
                <button
                  type="button"
                  className="ag-cartao"
                  onClick={() => { if (c.negocio_id) onAbrirLead(c.negocio_id); }}
                >
                  <span className="ag-tipo">{c.tipo}</span>
                  <span className="ag-cliente">{c.cliente}</span>
                  {(c.local || c.produto) && <span className="ag-local">{c.local ?? c.produto}</span>}
                  {/* Só mostra o dono quando NÃO é meu: repetir o próprio nome
                      em toda linha seria ruído. */}
                  {!c.meu && <span className="ag-dono">{c.corretor}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
