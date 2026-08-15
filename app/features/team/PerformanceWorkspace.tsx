"use client";

// Central de Performance — versão nativa (React), lendo /api/performance.
// Os números vêm por corretor_id (não há casamento por nome/instância como no
// dashboard legado), então a visão individual de cada corretor é sempre fiel.

import { useEffect, useMemo, useState } from "react";

type Periodo = "mes" | "trimestre" | "ano";

type Perf = Record<string, number | string | null | undefined> & { corretor_id: number; nome: string };

type ApiResp = { corretores?: Perf[]; semResponsavel?: number; error?: string };

const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? Number(v) || 0 : 0);
const brl = (v: unknown) => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlM = (v: unknown) => `R$ ${(num(v) / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
const min1 = (v: unknown) => `${num(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
const int = (v: unknown) => Math.round(num(v)).toLocaleString("pt-BR");

const PESOS: Array<{ key: string; label: string; peso: number; desc: string }> = [
  { key: "respScore", label: "Tempo de resposta", peso: 25, desc: "Rapidez da 1ª resposta no horário comercial (seg–sex, 9:30–18h). Nota cheia = 75%+ das respostas em até 15 min (ótimo ≤5 min)." },
  { key: "crmScore", label: "Atualização do CRM", peso: 25, desc: "Quanto da sua carteira aberta você mexeu nas últimas 24h. Nota cheia = 40%+ da carteira trabalhada por dia." },
  { key: "fupScore", label: "Follow-ups", peso: 20, desc: "Reinvestidas nos leads que ficaram sem resposta. Quanto mais follow-up ativo, maior a nota." },
  { key: "vendaScore", label: "Conversão em vendas", peso: 15, desc: "VGV de vendas fechadas (concluídas/pagas) no mês. Nota cheia = R$ 2,5 mi. Venda em esteira/pendente não conta." },
  { key: "visitaScore", label: "Conversão em visitas", peso: 10, desc: "Visitas realizadas no mês. Nota cheia = 15 visitas." },
  { key: "tarefaScore", label: "Cumprimento de tarefas", peso: 5, desc: "Tarefas do CRM concluídas no mês. Nota cheia = 8 tarefas." },
];

const FAIXAS = [
  { rotulo: "Crítico", cor: "#dc2626", faixa: "0–29" },
  { rotulo: "Atenção", cor: "#d97706", faixa: "30–49" },
  { rotulo: "Bom", cor: "#2563eb", faixa: "50–74" },
  { rotulo: "Excelente", cor: "#16a34a", faixa: "75–100" },
];

function classifica(score: number) {
  if (score >= 75) return { rotulo: "Excelente", cor: "#16a34a" };
  if (score >= 50) return { rotulo: "Bom", cor: "#2563eb" };
  if (score >= 30) return { rotulo: "Atenção", cor: "#d97706" };
  return { rotulo: "Crítico", cor: "#dc2626" };
}

// cor de status por valor 0–100 (verde/azul/âmbar/vermelho) — sempre acompanhada do número
function statusCor(v: number) {
  if (v >= 75) return "#16a34a";
  if (v >= 50) return "#2563eb";
  if (v >= 30) return "#d97706";
  return "#dc2626";
}

// card de destaque grande com barra de progresso opcional
function Hero({ rotulo, valor, sub, cor, pct, seta }: { rotulo: string; valor: string; sub?: string; cor?: string; pct?: number; seta?: number }) {
  return (
    <div className="pn-hero" style={cor ? { borderTopColor: cor } : undefined}>
      <span className="pn-hero-r">{rotulo}</span>
      <strong className="pn-hero-v" style={cor ? { color: cor } : undefined}>
        {valor}
        {typeof seta === "number" && seta !== 0 ? <em className={seta > 0 ? "up" : "down"}>{seta > 0 ? "▲" : "▼"}{Math.abs(seta)}</em> : null}
      </strong>
      {typeof pct === "number" ? <div className="pn-hero-bar"><i style={{ width: `${Math.min(100, Math.max(2, pct))}%`, background: cor ?? "#f97316" }} /></div> : null}
      {sub ? <small className="pn-hero-s">{sub}</small> : null}
    </div>
  );
}

function Kpi({ titulo, valor, sub, hint }: { titulo: string; valor: string; sub?: string; hint?: string }) {
  return (
    <div className="pn-kpi" title={hint}>
      <span className="pn-kpi-t">{titulo}{hint ? <span className="pn-help" aria-label={hint}>?</span> : null}</span>
      <strong className="pn-kpi-v">{valor}</strong>
      {sub ? <small className="pn-kpi-s">{sub}</small> : null}
    </div>
  );
}

function Secao({ titulo, desc, children }: { titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="pn-sec">
      <h3>{titulo}{desc ? <span className="pn-sec-desc">{desc}</span> : null}</h3>
      <div className="pn-grid">{children}</div>
    </section>
  );
}

type Col = { key: string; label: string; tipo: "score" | "num" | "min" | "pct" | "vgv" | "nota"; hint: string };
const COLS: Col[] = [
  { key: "score", label: "Score", tipo: "score", hint: "Score ApêCerto (0–100)" },
  { key: "tempoRespComercial", label: "1ª resp", tipo: "min", hint: "Mediana de 1ª resposta no horário comercial (min) — menor é melhor" },
  { key: "slaPct", label: "SLA", tipo: "pct", hint: "% de respostas em até 15 min (comercial)" },
  { key: "followups", label: "Follow-ups", tipo: "num", hint: "Follow-ups no período" },
  { key: "visitasReal", label: "Visitas", tipo: "num", hint: "Visitas realizadas no período" },
  { key: "leads", label: "Leads", tipo: "num", hint: "Leads recebidos no período" },
  { key: "leadsAtualizados", label: "Atualiz.", tipo: "num", hint: "Leads atualizados no período" },
  { key: "convLeadVenda", label: "Conv→Venda", tipo: "pct", hint: "Conversão sobre leads recebidos (%)" },
  { key: "convAgendRealizada", label: "Conv Visita", tipo: "pct", hint: "Visita agendada → realizada (%)" },
  { key: "diasAtivos", label: "Assiduid.", tipo: "num", hint: "Dias ativos no sistema no período" },
  { key: "notaGeralIa", label: "Nota IA", tipo: "nota", hint: "Nota média de atendimento (IA)" },
  { key: "onlineH", label: "Online", tipo: "num", hint: "Horas online no período" },
  { key: "vgv", label: "VGV", tipo: "vgv", hint: "VGV de vendas fechadas" },
];
const PERIODO_LABEL: Record<Periodo, string> = { mes: "Mês", trimestre: "Trimestre", ano: "Ano" };

function fmtCol(c: Perf, col: Col): string {
  const v = num(c[col.key]);
  if (col.tipo === "min") return v ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";
  if (col.tipo === "pct") return `${Math.round(v)}%`;
  if (col.tipo === "vgv") return brlM(v);
  if (col.tipo === "score" || col.tipo === "nota") return String(Math.round(v));
  return int(v);
}
function corCol(c: Perf, col: Col): string | undefined {
  const v = num(c[col.key]);
  if (col.tipo === "score" || col.tipo === "pct" || col.tipo === "nota") return statusCor(v);
  if (col.tipo === "min") return v <= 0 ? undefined : v <= 5 ? "#16a34a" : v <= 15 ? "#2563eb" : v <= 30 ? "#d97706" : "#dc2626";
  return undefined;
}

function Comparativo({ corretores, periodo, onAbrir }: { corretores: Perf[]; periodo: Periodo; onAbrir: (id: number) => void }) {
  const [sortKey, setSortKey] = useState("score");
  const [dir, setDir] = useState<1 | -1>(-1);
  const rows = useMemo(() => [...corretores].sort((a, b) => (num(a[sortKey]) - num(b[sortKey])) * dir), [corretores, sortKey, dir]);
  const setSort = (k: string) => {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setDir(k === "tempoRespComercial" ? 1 : -1); }
  };
  const exportCsv = () => {
    const header = ["Corretor", ...COLS.map((c) => c.label)];
    const linhas = rows.map((c) => [String(c.nome), ...COLS.map((col) => String(num(c[col.key])).replace(".", ","))]);
    const csv = [header, ...linhas].map((r) => r.map((cell) => `"${cell}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `performance_${PERIODO_LABEL[periodo].toLowerCase()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="pn-tbl-wrap">
      <div className="pn-tbl-top">
        <div><b>Ranking da equipe · {PERIODO_LABEL[periodo]}</b><span className="pn-tbl-sub">Clique num indicador para ordenar. Clique no corretor para ver o detalhe.</span></div>
        <button type="button" className="pn-export" onClick={exportCsv}>⬇ Exportar CSV</button>
      </div>
      <div className="pn-tbl-scroll">
        <table className="pn-tbl">
          <thead>
            <tr>
              <th className="pn-th-pos">#</th>
              <th className="pn-th-nome">Corretor</th>
              {COLS.map((col) => (
                <th key={col.key} title={col.hint} className={sortKey === col.key ? "on" : ""} onClick={() => setSort(col.key)}>
                  {col.label}{sortKey === col.key ? (dir === -1 ? " ▼" : " ▲") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.corretor_id} onClick={() => onAbrir(Number(c.corretor_id))}>
                <td className="pn-th-pos">{i + 1}</td>
                <td className="pn-th-nome">{String(c.nome)}</td>
                {COLS.map((col) => { const cor = corCol(c, col); return <td key={col.key} className={sortKey === col.key ? "on" : ""} style={cor ? { color: cor, fontWeight: 700 } : undefined}>{fmtCol(c, col)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PerformanceWorkspace({ accessToken }: { accessToken: string; sessionRole?: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [corretores, setCorretores] = useState<Perf[]>([]);
  const [semResp, setSemResp] = useState(0);
  const [sel, setSel] = useState<number | "equipe">("equipe");
  const [modo, setModo] = useState<"individual" | "comparar">("comparar");
  /* Nenhum setState sincrono dentro do efeito -- isso dispara render em cascata
     (react-hooks/set-state-in-effect). Em vez de MARCAR "carregando", guardamos
     a qual busca o resultado pertence e DERIVAMOS o resto: se o resultado na
     mao nao e o da busca atual, e porque ainda esta carregando. */
  const [tentativa, setTentativa] = useState(0);
  const chaveAtual = `${periodo}:${tentativa}`;
  const [resultado, setResultado] = useState<{ chave: string; ok: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const chave = `${periodo}:${tentativa}`;

    fetch(`/api/performance?periodo=${periodo}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: ctrl.signal,
    })
      .then((r) => r.json() as Promise<ApiResp>)
      .then((json) => {
        if (!alive) return;
        if (json.error) {
          /* O backend devolve coisas como "canceling statement due to statement
             timeout". Isso e diagnostico, nao recado para quem usa: fica no
             console. E NAO limpamos corretores -- se ja havia numero na tela,
             ele continua la, com o aviso por cima dizendo que nao atualizou.
             Sumir com o dado bom por causa de uma atualizacao que falhou e pior
             do que mostrar dado de um minuto atras, desde que fique dito. */
          console.error("[performance] /api/performance falhou:", json.error);
          setResultado({ chave, ok: false });
          return;
        }
        setCorretores(json.corretores ?? []);
        setSemResp(json.semResponsavel ?? 0);
        setResultado({ chave, ok: true });
      })
      .catch((e) => {
        if (!alive || ctrl.signal.aborted) return;
        console.error("[performance] /api/performance falhou:", e);
        setResultado({ chave, ok: false });
      });

    return () => { alive = false; ctrl.abort(); };
  }, [accessToken, periodo, tentativa]);

  const tentarDeNovo = () => setTentativa((n) => n + 1);
  const loading = resultado?.chave !== chaveAtual;
  const falhou = resultado?.chave === chaveAtual && !resultado.ok;
  const temDadoAnterior = corretores.length > 0;

  const equipe = useMemo(() => {
    const vgv = corretores.reduce((a, c) => a + num(c.vgv), 0);
    const vendas = corretores.reduce((a, c) => a + num(c.vendas), 0);
    const score = corretores.length ? Math.round(corretores.reduce((a, c) => a + num(c.score), 0) / corretores.length) : 0;
    const media = (key: string) => (corretores.length ? corretores.reduce((a, c) => a + num(c[key]), 0) / corretores.length : 0);
    return { vgv, vendas, score, media };
  }, [corretores]);

  const ranking = useMemo(
    () => [...corretores].sort((a, b) => num(b.vgv) - num(a.vgv) || num(b.score) - num(a.score)),
    [corretores],
  );
  const rankScore = useMemo(() => [...corretores].sort((a, b) => num(b.score) - num(a.score)), [corretores]);

  const atual = sel === "equipe" ? null : corretores.find((c) => Number(c.corretor_id) === sel) ?? null;

  return (
    <div className="pn-wrap">
      <header className="pn-top">
        <div>
          <h1>Central de Performance Comercial</h1>
          <p>{atual ? `Desempenho de ${String(atual.nome)}` : "Operação · visão da equipe"}</p>
        </div>
        <div className="pn-controls">
          <div className="pn-periodo">
            <button type="button" className={modo === "comparar" ? "on" : ""} onClick={() => setModo("comparar")}>Comparar equipe</button>
            <button type="button" className={modo === "individual" ? "on" : ""} onClick={() => setModo("individual")}>Individual</button>
          </div>
          {modo === "individual" && (
            <select value={String(sel)} onChange={(e) => setSel(e.target.value === "equipe" ? "equipe" : Number(e.target.value))}>
              <option value="equipe">Equipe (todos)</option>
              {corretores.map((c) => (
                <option key={c.corretor_id} value={c.corretor_id}>{String(c.nome)}</option>
              ))}
            </select>
          )}
          <div className="pn-periodo">
            {(["mes", "trimestre", "ano"] as Periodo[]).map((p) => (
              <button key={p} type="button" className={periodo === p ? "on" : ""} onClick={() => setPeriodo(p)}>
                {p === "mes" ? "Mês" : p === "trimestre" ? "Trimestre" : "Ano"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Falha COM dado anterior: mostra o aviso e mantem os numeros embaixo.
          Falha SEM dado: so o aviso -- nada de tela vazia fingindo sucesso. */}
      {falhou && (
        <div className="pn-msg erro" role="alert">
          <strong>Não foi possível carregar a performance agora.</strong>
          {temDadoAnterior && <span> Os números abaixo são da última atualização que deu certo.</span>}
          <button type="button" className="pn-retry" onClick={tentarDeNovo}>Tentar novamente</button>
        </div>
      )}

      {loading ? (
        <div className="pn-msg">Carregando performance…</div>
      ) : falhou && !temDadoAnterior ? null
        : corretores.length === 0 ? (
        <div className="pn-msg">Nenhum corretor no seu escopo de visão.</div>
      ) : modo === "comparar" ? (
        <Comparativo corretores={corretores} periodo={periodo} onAbrir={(id) => { setSel(id); setModo("individual"); }} />
      ) : (
        <>
          <p className="pn-intro">O <b>Score ApêCerto</b> (0–100) resume o desempenho a partir de 6 indicadores com pesos diferentes. Escolha um corretor ou veja a equipe, e passe o mouse nos <span className="pn-help">?</span> para entender cada número.</p>

          {(() => {
            const total = corretores.length;
            const isC = !!atual;
            const sc = num(atual ? atual.score : equipe.score);
            const cls = classifica(sc);
            const vals = PESOS.map((p) => ({ label: p.label, v: atual ? num(atual[p.key]) : Math.round(equipe.media(p.key)) }));
            const forte = vals.reduce((a, b) => (b.v > a.v ? b : a));
            const fraco = vals.reduce((a, b) => (b.v < a.v ? b : a));
            const pos = atual ? rankScore.findIndex((c) => Number(c.corretor_id) === Number(atual.corretor_id)) + 1 : 0;
            const trm = num(atual ? atual.tempoRespComercial : equipe.media("tempoRespComercial"));
            const respCor = trm > 0 && trm <= 5 ? "#16a34a" : trm <= 15 ? "#2563eb" : trm <= 30 ? "#d97706" : "#dc2626";
            return (
              <>
                <p className="pn-leitura" style={{ borderLeftColor: cls.cor }}>
                  <b style={{ color: cls.cor }}>{cls.rotulo} · {sc}/100.</b>{" "}
                  {isC ? <>{String(atual!.nome)} está em <b>#{pos} de {total}</b>. </> : <>Equipe com {total} corretores. </>}
                  Ponto forte: <b>{forte.label}</b> ({forte.v}). A melhorar: <b>{fraco.label}</b> ({fraco.v}).
                </p>
                <div className="pn-hero-row">
                  {isC ? (
                    <>
                      <Hero rotulo="Score ApêCerto" valor={`${sc}`} sub={cls.rotulo} cor={cls.cor} seta={num(atual!.evoScore)} />
                      <Hero rotulo="Posição no time" valor={`#${pos}`} sub={`de ${total} corretores`} />
                      <Hero rotulo="VGV do mês" valor={brlM(atual!.vgv)} sub="meta R$ 2,5M" pct={(num(atual!.vgv) / 2_500_000) * 100} cor={statusCor(Math.min(100, (num(atual!.vgv) / 2_500_000) * 100))} />
                      <Hero rotulo="Visitas realizadas" valor={`${int(atual!.visitasReal)}/15`} sub="meta do mês" pct={(num(atual!.visitasReal) / 15) * 100} cor={statusCor(Math.min(100, (num(atual!.visitasReal) / 15) * 100))} />
                      <Hero rotulo="1ª resposta" valor={min1(atual!.tempoRespComercial)} sub="comercial · ótimo ≤5 min" cor={respCor} />
                      <Hero rotulo="Qualidade (IA)" valor={`${int(atual!.notaGeralIa)}`} sub="nota das conversas" cor={statusCor(num(atual!.notaGeralIa))} />
                    </>
                  ) : (
                    <>
                      <Hero rotulo="Score médio" valor={`${sc}`} sub={cls.rotulo} cor={cls.cor} />
                      <Hero rotulo="VGV do time" valor={brlM(equipe.vgv)} sub={`${equipe.vendas} venda(s) no mês`} />
                      <Hero rotulo="Destaque do mês" valor={String(rankScore[0]?.nome ?? "—")} sub={`${num(rankScore[0]?.score)} pts`} cor="#16a34a" />
                      <Hero rotulo="Precisa de atenção" valor={String(rankScore[rankScore.length - 1]?.nome ?? "—")} sub={`${num(rankScore[rankScore.length - 1]?.score)} pts`} cor="#dc2626" />
                      <Hero rotulo="1ª resposta média" valor={min1(equipe.media("tempoRespComercial"))} sub="horário comercial" cor={respCor} />
                      <Hero rotulo="Visitas do time" valor={int(corretores.reduce((a, c) => a + num(c.visitasReal), 0))} sub="realizadas no mês" />
                    </>
                  )}
                </div>
              </>
            );
          })()}

          {/* Score */}
          <div className="pn-score-row">
            {(() => {
              const alvo = atual ?? { score: equipe.score, nome: "Equipe ApêCerto" };
              const sc = num(alvo.score);
              const cls = classifica(sc);
              return (
                <div className="pn-score-card">
                  <span className="pn-score-lbl">Score ApêCerto</span>
                  <strong className="pn-score-nome">{String(atual ? atual.nome : "Equipe ApêCerto")}</strong>
                  <div className="pn-score-num" style={{ color: cls.cor }}>{sc}<em>/100</em></div>
                  <span className="pn-badge" style={{ background: cls.cor }}>{cls.rotulo}</span>
                  <div className="pn-faixas">
                    {FAIXAS.map((f) => (
                      <span key={f.rotulo} className={f.rotulo === cls.rotulo ? "on" : ""}>
                        <i style={{ background: f.cor }} />{f.rotulo} <em>{f.faixa}</em>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="pn-comp">
              <span className="pn-comp-t">Composição do score · indicadores ponderados</span>
              <p className="pn-comp-exp">Cada indicador vale de 0 a 100. A nota final é a média ponderada pelos pesos (%). Passe o mouse em cada um para ver como pontua.</p>
              <div className="pn-comp-grid">
                {PESOS.map((p) => {
                  const v = atual ? num(atual[p.key]) : Math.round(equipe.media(p.key));
                  return (
                    <div key={p.key} className="pn-comp-item" title={p.desc}>
                      <div className="pn-comp-head"><span><i className="pn-dot" style={{ background: statusCor(v) }} />{p.label} <em>{p.peso}%</em> <span className="pn-help">?</span></span><b style={{ color: statusCor(v) }}>{v}/100</b></div>
                      <div className="pn-bar"><i style={{ width: `${Math.min(100, v)}%`, background: statusCor(v) }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KPIs principais */}
          <Secao titulo="Resultados" desc="Vendas fechadas no período. Meta de VGV: R$ 2,5 mi/mês por corretor.">
            <Kpi titulo="VGV" valor={brlM(atual ? atual.vgv : equipe.vgv)} sub={`${int(atual ? atual.vendas : equipe.vendas)} venda(s)`}
              hint="Valor Geral de Vendas fechadas (concluídas/pagas) no período. Venda em esteira ou pendente não entra aqui." />
            <Kpi titulo="Comissão gerada" valor={brl(atual ? atual.comissao : corretores.reduce((a, c) => a + num(c.comissao), 0))} />
            <Kpi titulo="Propostas" valor={int(atual ? atual.propEmit : corretores.reduce((a, c) => a + num(c.propEmit), 0))} sub={`${int(atual ? atual.propAceit : corretores.reduce((a, c) => a + num(c.propAceit), 0))} aceitas`} />
            <Kpi titulo="Contratos assinados" valor={int(atual ? atual.contratosAss : corretores.reduce((a, c) => a + num(c.contratosAss), 0))} />
          </Secao>

          <Secao titulo="Atendimento" desc="Velocidade e volume no atendimento aos leads.">
            <Kpi titulo="1ª resposta (comercial)" valor={min1(atual ? atual.tempoRespComercial : equipe.media("tempoRespComercial"))}
              sub={`mediana · ótimo ≤5 · bom ≤15 min`}
              hint={`Mediana do tempo de 1ª resposta dentro do horário comercial (seg–sex, 9:30–18h). Faixas: ótimo ≤5 min, bom ≤15, atenção 15–60, ruim >60. Média geral (24h): ${min1(atual ? atual.tempoResp : equipe.media("tempoResp"))} — puxada por leads de madrugada.`} />
            <Kpi titulo="SLA cumprido" valor={`${int(atual ? atual.slaPct : equipe.media("slaPct"))}%`} sub="≤15 min no comercial"
              hint="% das 1ªs respostas feitas em até 15 minutos, dentro do horário comercial. Meta da equipe: ≥75%." />
            <Kpi titulo="Fora do SLA" valor={int(atual ? atual.foraSla : corretores.reduce((a, c) => a + num(c.foraSla), 0))} />
            <Kpi titulo="Mensagens enviadas" valor={int(atual ? atual.msgsEnv : corretores.reduce((a, c) => a + num(c.msgsEnv), 0))} sub={`${int(atual ? atual.msgsRec : corretores.reduce((a, c) => a + num(c.msgsRec), 0))} recebidas`} />
            <Kpi titulo="Áudios enviados" valor={int(atual ? atual.audios : corretores.reduce((a, c) => a + num(c.audios), 0))} />
            <Kpi titulo="Follow-ups" valor={int(atual ? atual.followups : corretores.reduce((a, c) => a + num(c.followups), 0))} />
            <Kpi titulo="Reativações" valor={int(atual ? atual.reativacoes : corretores.reduce((a, c) => a + num(c.reativacoes), 0))} />
            <Kpi titulo="Tempo online" valor={`${int(atual ? atual.onlineH : equipe.media("onlineH"))}h`} />
          </Secao>

          <Secao titulo="CRM e carteira" desc="Tamanho da carteira e o quanto está sendo trabalhada. Ideal: manter poucos negócios parados e todos com próxima tarefa.">
            <Kpi titulo="Leads (período)" valor={int(atual ? atual.leads : corretores.reduce((a, c) => a + num(c.leads), 0))} sub={`${int(atual ? atual.leadsTotal : corretores.reduce((a, c) => a + num(c.leadsTotal), 0))} no total`} />
            <Kpi titulo="Negócios abertos" valor={int(atual ? atual.abertos : corretores.reduce((a, c) => a + num(c.abertos), 0))} />
            <Kpi titulo="Parados +24h" valor={int(atual ? atual.parados : corretores.reduce((a, c) => a + num(c.parados), 0))} sub={`${int(atual ? atual.parados72 : corretores.reduce((a, c) => a + num(c.parados72), 0))} há +72h`} />
            <Kpi titulo="Sem próxima tarefa" valor={int(atual ? atual.semTarefa : corretores.reduce((a, c) => a + num(c.semTarefa), 0))} />
            <Kpi titulo="Tarefas concluídas" valor={`${int(atual ? atual.tarefaPct : equipe.media("tarefaPct"))}%`} />
            <Kpi titulo="Cobertura da carteira" valor={`${int(atual ? atual.coberturaMomento : equipe.media("coberturaMomento"))}%`} sub="mexida hoje" />
          </Secao>

          <Secao titulo="Visitas" desc="Visitas do mês. O score conta as realizadas — meta cheia: 15/mês.">
            <Kpi titulo="Marcadas" valor={int(atual ? atual.visitasMarc : corretores.reduce((a, c) => a + num(c.visitasMarc), 0))} />
            <Kpi titulo="Realizadas" valor={int(atual ? atual.visitasReal : corretores.reduce((a, c) => a + num(c.visitasReal), 0))} />
            <Kpi titulo="Canceladas" valor={int(atual ? atual.visitasCanc : corretores.reduce((a, c) => a + num(c.visitasCanc), 0))} />
            <Kpi titulo="Ciclo até visita" valor={`${int(atual ? atual.cicloVisitaDias : equipe.media("cicloVisitaDias"))} dias`} />
          </Secao>

          <Secao titulo="Qualidade do atendimento (IA)" desc="Avaliação da Sara sobre as conversas: clareza, condução, objeções e nota geral (0–100).">
            <Kpi titulo="Nota geral IA" valor={`${int(atual ? atual.notaGeralIa : equipe.media("notaGeralIa"))}/100`} />
            <Kpi titulo="Clareza" valor={int(atual ? atual.notaClareza : equipe.media("notaClareza"))} />
            <Kpi titulo="Cordialidade" valor={int(atual ? atual.notaCordial : equipe.media("notaCordial"))} />
            <Kpi titulo="Qualificação" valor={int(atual ? atual.notaQualif : equipe.media("notaQualif"))} />
            <Kpi titulo="Condução" valor={int(atual ? atual.notaConducao : equipe.media("notaConducao"))} />
            <Kpi titulo="Objeções" valor={int(atual ? atual.notaObjecoes : equipe.media("notaObjecoes"))} />
            <Kpi titulo="Conversas avaliadas" valor={`${int(atual ? atual.convAvaliadasPct : equipe.media("convAvaliadasPct"))}%`} sub={`${int(atual ? atual.convExcelentes : corretores.reduce((a, c) => a + num(c.convExcelentes), 0))} excelentes`} />
            <Kpi titulo="Críticas" valor={int(atual ? atual.convCriticas : corretores.reduce((a, c) => a + num(c.convCriticas), 0))} />
          </Secao>

          <Secao titulo="Atualização e produtividade" desc="Quanto o corretor trabalha e mantém a carteira em dia.">
            <Kpi titulo="Leads atualizados" valor={int(atual ? atual.leadsAtualizados : corretores.reduce((a, c) => a + num(c.leadsAtualizados), 0))} hint="Nº de atualizações de lead no período." />
            <Kpi titulo="Cliques em 'atualizar momento'" valor={int(atual ? atual.cliquesMomento : corretores.reduce((a, c) => a + num(c.cliquesMomento), 0))} hint="Registros de momento feitos dentro do lead (Funil Inteligente)." />
            <Kpi titulo="Leads desatualizados" valor={int(atual ? atual.desatualizados : corretores.reduce((a, c) => a + num(c.desatualizados), 0))} sub={`${int(atual ? atual.desatualizadosPct : equipe.media("desatualizadosPct"))}% da carteira ativa`} hint="Leads no Funil Inteligente que entraram e ainda não tiveram o momento atualizado." />
            <Kpi titulo="Tempo até atualizar" valor={min1(atual ? atual.tempoAteAtualizar : equipe.media("tempoAteAtualizar"))} hint="Tempo médio entre o lead entrar e ter o 1º momento registrado." />
            <Kpi titulo="Assiduidade" valor={`${int(atual ? atual.diasAtivos : equipe.media("diasAtivos"))} dias`} sub="ativos no período" hint="Dias distintos em que o corretor teve atividade no sistema." />
          </Secao>

          <Secao titulo="Conversão do funil" desc="Da entrada do lead até a venda fechada.">
            <Kpi titulo="Conversão lead → venda" valor={`${int(atual ? atual.convLeadVenda : equipe.media("convLeadVenda"))}%`} hint="Vendas fechadas sobre leads recebidos no período." />
            <Kpi titulo="Agendada → realizada" valor={`${int(atual ? atual.convAgendRealizada : equipe.media("convAgendRealizada"))}%`} hint="Das visitas agendadas, quantas foram realizadas." />
            <Kpi titulo="Realizada → venda" valor={`${int(atual ? atual.convRealizadaVenda : equipe.media("convRealizadaVenda"))}%`} hint="Das visitas realizadas, quantas viraram venda fechada." />
            <Kpi titulo="Comissão média/venda" valor={brl(atual ? atual.comissaoMedia : equipe.media("comissaoMedia"))} hint="Retorno médio por venda — separa quem vende volume de quem vende com retorno alto." />
          </Secao>

          <Secao titulo="Distribuição e engajamento" desc="Recebimento de leads e uso das ferramentas.">
            <Kpi titulo="Leads recebidos" valor={int(atual ? atual.leadsRecebidos : corretores.reduce((a, c) => a + num(c.leadsRecebidos), 0))} hint="Leads que chegaram ao corretor no período." />
            <Kpi titulo="Pescados no aquário" valor={int(atual ? atual.pescados : corretores.reduce((a, c) => a + num(c.pescados), 0))} hint="Leads que o corretor puxou do aquário/pool. (passa a contar a partir de agora)" />
            <Kpi titulo="Perguntas à Sara" valor={int(atual ? atual.saraPerguntas : corretores.reduce((a, c) => a + num(c.saraPerguntas), 0))} hint="Consultas ao copiloto Sara no período. (passa a contar a partir de agora)" />
          </Secao>

          {/* Ranking (só na visão equipe) */}
          {!atual && (
            <section className="pn-sec">
              <h3>Ranking do período · VGV e Score {semResp ? <span className="pn-semresp">{semResp} lead(s) sem responsável</span> : null}</h3>
              <div className="pn-rank">
                {ranking.map((c, i) => {
                  const cls = classifica(num(c.score));
                  return (
                    <button type="button" className="pn-rank-row" key={c.corretor_id} onClick={() => setSel(Number(c.corretor_id))}>
                      <span className="pn-rank-pos">#{i + 1}</span>
                      <span className="pn-rank-nome">{String(c.nome)}</span>
                      <span className="pn-rank-score" style={{ color: cls.cor }}>{num(c.score)} pts</span>
                      <span className="pn-rank-vgv">{brlM(c.vgv)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
