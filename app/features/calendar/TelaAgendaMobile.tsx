"use client";
/* AGENDA NO CELULAR.
 *
 * Leitura: GET /api/agenda (RPC ncrm_agenda_corretor).
 * Escrita: PATCH /api/agenda — `updateVisitStatus` (realizada / cancelada),
 * `updateVisit` (remarcar) e `createVisit` (marcar visita nova). Sao as mesmas
 * acoes que o desktop usa; nada aqui grava direto em tabela.
 *
 * ESCOPO: a agenda da IMOBILIARIA INTEIRA, com o nome de quem atende. Sem isso,
 * dois corretores saem para o mesmo empreendimento no mesmo horario sem saber.
 * O que e meu aparece normal; o dos colegas mostra o nome -- e SO o meu pode ser
 * editado por aqui: remarcar a visita de um colega pelo celular, sem falar com
 * ele, e o tipo de poder que ninguem pediu.
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

type PeriodoAgenda = "dia" | "semana" | "mes";
type LeadAgenda = { id: number; nome: string };
type NegocioAgenda = { id: number; lead_id: number };
type ProdutoAgenda = { id: string; nome: string };
type Catalogo = { leads: LeadAgenda[]; deals: NegocioAgenda[]; products: ProdutoAgenda[] };

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
const podeEditarVisita = (c: Compromisso) => {
  const status = statusDaVisita(c);
  return ehVisita(c) && c.meu && status !== "cancelada" && status !== "realizada";
};

export function TelaAgendaMobile({ accessToken }: {
  accessToken: string;
}) {
  const [dia, setDia] = useState<string>(() => hojeISO());
  const [periodo, setPeriodo] = useState<PeriodoAgenda>("mes");
  const [itens, setItens] = useState<Compromisso[] | null>(null);
  const [erro, setErro] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);

  /* Folhas de escrita. `editando` guarda o compromisso tocado; `criando` abre a
     folha de visita nova. Uma por vez: duas folhas abertas no celular e um
     jeito de o dedo confirmar a errada. */
  const [editando, setEditando] = useState<Compromisso | null>(null);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroEscrita, setErroEscrita] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  /* Catalogo (clientes com negocio ativo e produtos) so e buscado quando a
     folha de visita nova abre: sao listas grandes e a agenda nao precisa delas
     para ser lida. */
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [leadEscolhido, setLeadEscolhido] = useState("");
  const [produtoEscolhido, setProdutoEscolhido] = useState("");

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
    /* NAO zeramos a lista aqui: manter o que ja esta na tela enquanto a nova
       chega evita o pisca-e-encolhe ao trocar de aba. */
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
        /* A mensagem do banco nao vai para a tela. */
        console.error("agenda: falha ao gravar", corpo.action, j.error);
        setErroEscrita("Não foi possível salvar. Tente de novo em instantes.");
        return false;
      }
      setEditando(null); setCriando(false); setConfirmandoCancelamento(false);
      setMotivo(""); setNovaData(""); setNovaHora("");
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
    setMotivo(""); setNovaData(c.data); setNovaHora(c.hora.slice(0, 5));
  }, []);

  const abrirNovaVisita = useCallback(() => {
    setCriando(true); setErroEscrita(""); setNovaData(dia); setNovaHora("10:00");
    setLeadEscolhido(""); setProdutoEscolhido("");
    if (catalogo) return;
    void fetch("/api/agenda?workspace=1", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json() as { leads?: LeadAgenda[]; deals?: NegocioAgenda[]; products?: ProdutoAgenda[] };
        setCatalogo({ leads: j.leads ?? [], deals: j.deals ?? [], products: j.products ?? [] });
      })
      .catch(() => setErroEscrita("Não foi possível carregar seus clientes agora."));
  }, [accessToken, catalogo, dia]);

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

  /* Cliente com negocio ativo: sem negocio, o endpoint recusa a visita. */
  const clientesDisponiveis = useMemo(() => {
    if (!catalogo) return [] as Array<{ leadId: number; dealId: number; nome: string }>;
    const nomePorLead = new Map(catalogo.leads.map((l) => [l.id, l.nome]));
    const vistos = new Set<number>();
    return catalogo.deals
      .filter((d) => nomePorLead.has(d.lead_id) && !vistos.has(d.lead_id) && vistos.add(d.lead_id) !== undefined)
      .map((d) => ({ leadId: d.lead_id, dealId: d.id, nome: nomePorLead.get(d.lead_id) as string }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [catalogo]);

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
            {podeEditarVisita(prox) && (
              <button
                type="button"
                className="ape-agenda-btn-vazado"
                onClick={() => abrirEdicao(prox)}
              >
                Editar visita
              </button>
            )}
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

      <div className="ape-agenda-acoes-dia">
        <button type="button" className="ape-agenda-nova" onClick={abrirNovaVisita}>+ Visita</button>
      </div>

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
              const editavel = podeEditarVisita(c);
              return (
                <li key={c.id} className={`ape-agenda-item${jaPassou(c) ? " passou" : ""}${c.meu ? " meu" : ""}${cancelada ? " cancelada" : ""}${realizada ? " realizada" : ""}`}>
                  <span className="ape-agenda-hora">{c.hora}</span>
                  <span className="ape-agenda-ponto" aria-hidden="true" />
                  <div className="ape-agenda-bloco">
                    <button
                      type="button"
                      className="ape-agenda-cartao"
                      onClick={() => { if (editavel) abrirEdicao(c); }}
                      disabled={!editavel}
                    >
                      <span className="ape-agenda-tipo">{c.tipo}</span>
                      <span className="ape-agenda-cliente">{c.cliente}</span>
                      {(c.local || c.produto) && <span className="ape-agenda-local">{c.local ?? c.produto}</span>}
                      {/* So mostra o dono quando NAO e meu: repetir o proprio
                          nome em toda linha seria ruido. */}
                      {!c.meu && <span className="ape-agenda-dono">{c.corretor}</span>}
                      {(realizada || cancelada) && <span className={`ape-agenda-status ${status}`}>{realizada ? "Realizada" : "Cancelada"}</span>}
                    </button>
                    {/* Editar so a MINHA visita, e so enquanto ela esta de pe. */}
                    {editavel && (
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
                <label>Nova data
                  <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                </label>
                <label>Novo horário
                  <input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
                </label>
                <div className="f2m-agendar-acoes">
                  <button
                    type="button"
                    className="f2m-agendar-ok"
                    disabled={salvando || !novaData || !novaHora}
                    onClick={() => void gravar(
                      { action: "updateVisit", visitId: editando.id, date: novaData, startTime: `${novaHora}:00` },
                      "Visita remarcada.",
                    )}
                  >
                    {salvando ? "Remarcando…" : "Remarcar"}
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

      {/* ---------- Folha: marcar visita nova ---------- */}
      {criando && (
        <div className="ape-folha" role="dialog" aria-modal="true" aria-label="Marcar visita">
          <section className="ape-ficha">
            <div className="ape-ficha-topo">
              <button type="button" className="ape-voltar" onClick={() => setCriando(false)}>‹ Agenda</button>
            </div>
            <div className="ape-ficha-nome">
              <h2>Marcar visita</h2>
              <p>O endereço vem do empreendimento escolhido.</p>
            </div>

            {erroEscrita && <p className="ape-agenda-erro-escrita" role="alert">{erroEscrita}</p>}

            <section className="f2m-agendar">
              <label>Com quem
                <select value={leadEscolhido} onChange={(e) => setLeadEscolhido(e.target.value)}>
                  <option value="">{catalogo ? "— escolha o cliente —" : "Carregando seus clientes…"}</option>
                  {clientesDisponiveis.map((c) => (
                    <option key={`${c.leadId}-${c.dealId}`} value={`${c.leadId}:${c.dealId}`}>{c.nome}</option>
                  ))}
                </select>
              </label>
              {catalogo && clientesDisponiveis.length === 0 && (
                <p className="ape-agenda-erro-escrita">Nenhum cliente com atendimento aberto. Abra o CRM para retomar um cliente antes de marcar a visita.</p>
              )}

              <label>Empreendimento <small>(opcional)</small>
                <select value={produtoEscolhido} onChange={(e) => setProdutoEscolhido(e.target.value)}>
                  <option value="">— sem empreendimento —</option>
                  {(catalogo?.products ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>

              <label>Dia
                <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </label>
              <label>Horário
                <input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
              </label>

              <div className="f2m-agendar-acoes">
                <button type="button" className="f2m-agendar-nao" disabled={salvando} onClick={() => setCriando(false)}>Cancelar</button>
                <button
                  type="button"
                  className="f2m-agendar-ok"
                  disabled={salvando || !leadEscolhido || !novaData || !novaHora}
                  onClick={() => {
                    const [leadId, dealId] = leadEscolhido.split(":").map(Number);
                    void gravar({
                      action: "createVisit", leadId, dealId,
                      date: novaData, startTime: `${novaHora}:00`,
                      productId: produtoEscolhido || null,
                    }, "Visita marcada.");
                  }}
                >
                  {salvando ? "Marcando…" : "Marcar visita"}
                </button>
              </div>
            </section>
          </section>
        </div>
      )}
    </div>
  );
}
