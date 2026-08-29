"use client";
/* AGENDA NO CELULAR.
 *
 * Leitura: GET /api/agenda (RPC ncrm_agenda_corretor).
 * Escrita: PATCH /api/agenda — `updateVisitStatus` e `updateVisit`. Visitas
 * novas nascem exclusivamente no card do lead; as existentes podem ser
 * reagendadas aqui para atender o corretor que está na rua.
 *
 * ESCOPO: a gestão recebe a agenda da equipe; o corretor recebe apenas os seus
 * compromissos. Conflitos alheios nunca aparecem aqui: o CRM os converte em
 * horários indisponíveis anônimos no momento do agendamento.
 *
 * ABRE NO MES. Marcar e conferir visita e trabalho de mes, nao de dia: o
 * corretor precisa ver onde ha espaco antes de combinar horario. Dia e Semana
 * continuam a um toque.
 *
 * O TOPO E ANCORA. O cartao do proximo compromisso fica igual em Mes, Semana e
 * Dia. So o miolo muda -- que e o que a aba promete mudar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  diaPorExtenso, gradeDoMes, hojeISO, jaPassou, proximo, quandoComeca,
  resumoDoDia, somarDias,
  type Compromisso,
} from "./telaAgenda.logica";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";
import { HorariosVisita } from "../funil-2/HorariosVisita";

type PeriodoAgenda = "dia" | "semana" | "mes";

/** "agosto de 2026" - minuscula, como o resto do app. */
function mesPorExtenso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toLowerCase();
}

/** Soma mes sem passar por fuso: o dia 1 e a ancora do periodo. */
function somarMeses(iso: string, meses: number): string {
  const [a, m] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1 + meses, 1));
  return base.toISOString().slice(0, 10);
}

/* Tarefa e retorno prometido tambem chegam nesta lista, e nao sao visita: nao
   oferecem "realizada" nem "remarcar", porque o endpoint de visita nao os
   conhece e o toque terminaria em erro. */
const ehVisita = (c: Compromisso) => /visita/i.test(c.tipo);
const statusDaVisita = (c: Compromisso) => (c.status ?? "").toLowerCase();

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
  const [scope, setScope] = useState<"equipe" | "propria">("propria");

  /* A folha de escrita guarda apenas o compromisso tocado. Novas visitas são
     criadas no card do lead no CRM. */
  const [editando, setEditando] = useState<Compromisso | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroEscrita, setErroEscrita] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [novoHorario, setNovoHorario] = useState("");

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch(`/api/agenda?data=${dia}&periodo=${periodo}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (r.status === 401) throw new Error("sessao_expirada");
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return {
      itens: (j.itens as Compromisso[]) ?? [],
      scope: j.scope === "equipe" ? "equipe" as const : "propria" as const,
    };
  }, [accessToken, dia, periodo]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    /* NAO zeramos a lista aqui: manter o que ja esta na tela enquanto a nova
       chega evita o pisca-e-encolhe ao trocar de aba. */
    carregar(ctrl.signal)
      .then((resultado) => { if (vivo) { setItens(resultado.itens); setScope(resultado.scope); setErro(false); setSessaoExpirada(false); setAtualizadoEm(new Date()); } })
      .catch((e) => {
        if (!vivo || e?.name === "AbortError") return;
        if (e instanceof Error && e.message === "sessao_expirada") setSessaoExpirada(true);
        else setErro(true);
        setItens([]);
      });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  /** Toda escrita passa por aqui: uma porta, um tratamento de erro, um reload. */
  const gravar = useCallback(async (corpo: Record<string, unknown>, textoDoAviso: string) => {
    setSalvando(true); setErroEscrita("");
    try {
      const r = await fetch("/api/agenda", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (r.status === 401) { setSessaoExpirada(true); return false; }
      const j = await r.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!r.ok || !j.success) {
        /* A API converte conflitos e falhas do banco em mensagens seguras. */
        console.error("agenda: falha ao gravar", corpo.action, j.error);
        setErroEscrita(j.error ?? "Não foi possível salvar. Tente de novo em instantes.");
        return false;
      }
      setEditando(null); setConfirmandoCancelamento(false);
      setMotivo(""); setNovoHorario("");
      setAviso(textoDoAviso);
      recarregar();
      return true;
    } catch {
      setErroEscrita("Não foi possível salvar. Verifique a conexão e tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }, [accessToken, recarregar]);

  const abrirEdicao = useCallback((c: Compromisso) => {
    setEditando(c); setErroEscrita(""); setConfirmandoCancelamento(false);
    setMotivo(""); setNovoHorario("");
  }, []);

  const lista = useMemo(() => itens ?? [], [itens]);
  const prox = useMemo(() => proximo(lista), [lista]);

  /* No mes a lista de baixo e SOMENTE do dia tocado. */
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

      {/* GRADE DO MES. Sempre 42 celulas: mes curto nao muda a altura e a lista
          de baixo nao sobe na cara de quem esta tocando. */}
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

      {aviso && <p className="ape-agenda-aviso" role="status">{aviso}</p>}

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
          <button type="button" onClick={() => { setErro(false); recarregar(); }}>
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
            {doDia.map((c) => {
              const status = statusDaVisita(c);
              const cancelada = status === "cancelada";
              const realizada = status === "realizada";
              return (
                <li key={c.id} className={`ape-agenda-item${jaPassou(c) ? " passou" : ""}${c.meu ? " meu" : ""}${cancelada ? " cancelada" : ""}${realizada ? " realizada" : ""}`}>
                  <span className="ape-agenda-hora">{c.hora}</span>
                  <span className="ape-agenda-ponto" aria-hidden="true" />
                  <div className="ape-agenda-bloco">
                    <button
                      type="button"
                      className="ape-agenda-cartao"
                      onClick={() => { if (c.negocio_id) onAbrirLead(c.negocio_id); }}
                    >
                      <span className="ape-agenda-tipo">{c.tipo}</span>
                      <span className="ape-agenda-cliente">{c.cliente}</span>
                      {(c.local || c.produto) && <span className="ape-agenda-local">{c.local ?? c.produto}</span>}
                      {/* So mostra o dono quando NAO e meu: repetir o proprio
                          nome em toda linha seria ruido. */}
                      {!c.meu && <span className="ape-agenda-dono">{c.corretor}</span>}
                      {(realizada || cancelada) && <span className={`ape-agenda-status ${status}`}>{realizada ? "Realizada" : "Cancelada"}</span>}
                    </button>
                    {/* O corretor edita só a própria visita; a gestão pode
                        reagendar qualquer visita que aparece no seu escopo. */}
                    {ehVisita(c) && (c.meu || scope === "equipe") && !cancelada && !realizada && (
                      <button type="button" className="ape-agenda-editar" onClick={() => abrirEdicao(c)}>Editar visita ›</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      {/* ---------- Folha: editar visita ---------- */}
      {editando && (
        <div className="ape-folha" role="dialog" aria-modal="true" aria-label={`Visita de ${editando.cliente}`}>
          <section className="ape-ficha">
            <div className="ape-ficha-topo">
              <button type="button" className="ape-voltar" onClick={() => setEditando(null)}>‹ Agenda</button>
            </div>
            <div className="ape-ficha-nome">
              <h2>{editando.cliente}</h2>
              <p>{diaPorExtenso(editando.data)}, {editando.hora}{editando.local ? ` · ${editando.local}` : ""}</p>
            </div>

            {erroEscrita && <p className="ape-agenda-erro-escrita" role="alert">{erroEscrita}</p>}

            <div className="ape-agenda-editar-acoes">
              <button
                type="button"
                className="ape-agenda-realizada"
                disabled={salvando}
                onClick={() => void gravar(
                  { action: "updateVisitStatus", visitId: editando.id, status: "realizada" },
                  "Visita marcada como realizada.",
                )}
              >
                {salvando ? "Salvando…" : "Aconteceu — marcar como realizada"}
              </button>

              <section className="f2m-agendar">
                <h3>Remarcar</h3>
                <p>Escolha um horário disponível. Os compromissos de outros corretores permanecem anônimos.</p>
                <HorariosVisita
                  accessToken={accessToken}
                  visitId={editando.id}
                  comGerente={false}
                  gerenteId={null}
                  value={novoHorario}
                  initialDate={editando.data}
                  onChange={setNovoHorario}
                  disabled={salvando}
                />
                <div className="f2m-agendar-acoes">
                  <button
                    type="button"
                    className="f2m-agendar-ok"
                    disabled={salvando || !novoHorario}
                    onClick={() => void gravar(
                      { action: "updateVisit", visitId: editando.id, date: novoHorario.slice(0, 10), startTime: novoHorario.slice(11, 16) },
                      "Visita remarcada.",
                    )}
                  >
                    {salvando ? "Remarcando…" : "Remarcar visita"}
                  </button>
                </div>
              </section>

              {confirmandoCancelamento ? (
                <section className="f2m-agendar f2m-descartar">
                  <h3>Cancelar a visita</h3>
                  <p>Ela fica registrada como cancelada, com o motivo. Nada é apagado.</p>
                  <label>Motivo <small>(opcional)</small>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500}
                              placeholder="O cliente desmarcou? Remarcou por telefone?" />
                  </label>
                  <div className="f2m-agendar-acoes">
                    <button type="button" className="f2m-agendar-nao" disabled={salvando} onClick={() => setConfirmandoCancelamento(false)}>Voltar</button>
                    <button
                      type="button"
                      className="f2m-agendar-ok"
                      disabled={salvando}
                      onClick={() => void gravar(
                        { action: "updateVisitStatus", visitId: editando.id, status: "cancelada", reason: motivo.trim() || undefined },
                        "Visita cancelada.",
                      )}
                    >
                      {salvando ? "Cancelando…" : "Confirmar cancelamento"}
                    </button>
                  </div>
                </section>
              ) : (
                <button type="button" className="ape-agenda-cancelar" onClick={() => setConfirmandoCancelamento(true)}>Cancelar a visita</button>
              )}
            </div>

            <p className="ape-ficha-nota">Marcar como realizada vale para a agenda e para o relatório de visitas. Isso é diferente de contato pelo WhatsApp, que só conta quando a mensagem aparece no histórico.</p>
          </section>
        </div>
      )}

    </div>
  );
}
