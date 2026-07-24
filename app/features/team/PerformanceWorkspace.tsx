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

export function PerformanceWorkspace({ accessToken }: { accessToken: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [corretores, setCorretores] = useState<Perf[]>([]);
  const [semResp, setSemResp] = useState(0);
  const [sel, setSel] = useState<number | "equipe">("equipe");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/performance?periodo=${periodo}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json() as Promise<ApiResp>)
      .then((json) => {
        if (!alive) return;
        if (json.error) { setError(json.error); return; }
        setCorretores(json.corretores ?? []);
        setSemResp(json.semResponsavel ?? 0);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Erro ao carregar."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accessToken, periodo]);

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
      <style>{CSS}</style>
      <header className="pn-top">
        <div>
          <h1>Central de Performance Comercial</h1>
          <p>{atual ? `Desempenho de ${String(atual.nome)}` : "Operação · visão da equipe"}</p>
        </div>
        <div className="pn-controls">
          <select value={String(sel)} onChange={(e) => setSel(e.target.value === "equipe" ? "equipe" : Number(e.target.value))}>
            <option value="equipe">Equipe (todos)</option>
            {corretores.map((c) => (
              <option key={c.corretor_id} value={c.corretor_id}>{String(c.nome)}</option>
            ))}
          </select>
          <div className="pn-periodo">
            {(["mes", "trimestre", "ano"] as Periodo[]).map((p) => (
              <button key={p} type="button" className={periodo === p ? "on" : ""} onClick={() => setPeriodo(p)}>
                {p === "mes" ? "Mês" : p === "trimestre" ? "Trimestre" : "Ano"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="pn-msg">Carregando performance…</div>
      ) : error ? (
        <div className="pn-msg erro">{error}</div>
      ) : corretores.length === 0 ? (
        <div className="pn-msg">Nenhum corretor no seu escopo de visão.</div>
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

const CSS = `
.pn-wrap{padding:22px 26px 60px;color:#1f2937;font-family:inherit;max-width:1180px}
.pn-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.pn-top h1{font-size:22px;margin:0 0 2px}
.pn-top p{margin:0;color:#6b7280;font-size:14px}
.pn-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pn-controls select{padding:8px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-size:14px;color:#1f2937}
.pn-periodo{display:inline-flex;background:#f3f4f6;border-radius:10px;padding:3px}
.pn-periodo button{border:0;background:transparent;padding:6px 14px;border-radius:8px;font-size:13px;color:#6b7280;cursor:pointer}
.pn-periodo button.on{background:#f97316;color:#fff;font-weight:600}
.pn-msg{padding:40px;text-align:center;color:#6b7280}
.pn-msg.erro{color:#dc2626}
.pn-score-row{display:grid;grid-template-columns:280px 1fr;gap:16px;margin-bottom:18px}
@media(max-width:820px){.pn-score-row{grid-template-columns:1fr}.pn-wrap{padding:16px}}
.pn-score-card,.pn-comp{background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:18px 20px}
.pn-score-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;font-weight:700}
.pn-score-nome{display:block;font-size:16px;margin:4px 0 8px}
.pn-score-num{font-size:52px;font-weight:800;line-height:1}
.pn-score-num em{font-size:18px;color:#9ca3af;font-weight:600;font-style:normal}
.pn-badge{display:inline-block;color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;margin-top:8px}
.pn-intro{background:#fff;border:1px solid #eef0f3;border-radius:12px;padding:12px 16px;margin:0 0 14px;font-size:13.5px;color:#4b5563;line-height:1.5}
.pn-leitura{background:#fff;border:1px solid #eef0f3;border-left:4px solid #94a3b8;border-radius:10px;padding:11px 15px;margin:0 0 14px;font-size:14px;color:#374151;line-height:1.5}
.pn-hero-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:20px}
.pn-hero{background:#fff;border:1px solid #eef0f3;border-top:3px solid #f97316;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-height:96px}
.pn-hero-r{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#9ca3af;font-weight:700}
.pn-hero-v{font-size:26px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pn-hero-v em{font-size:12px;font-weight:700;font-style:normal;margin-left:7px}
.pn-hero-v em.up{color:#16a34a}.pn-hero-v em.down{color:#dc2626}
.pn-hero-bar{height:6px;background:#f1f3f5;border-radius:6px;overflow:hidden;margin:3px 0 1px}
.pn-hero-bar i{display:block;height:100%;border-radius:6px}
.pn-hero-s{font-size:12px;color:#9ca3af}
.pn-dot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;vertical-align:middle}
.pn-help{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:10px;font-weight:700;margin-left:4px;cursor:help;vertical-align:middle}
.pn-faixas{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:14px;padding-top:12px;border-top:1px solid #f1f3f5}
.pn-faixas span{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#9ca3af;opacity:.6}
.pn-faixas span.on{opacity:1;color:#374151;font-weight:600}
.pn-faixas i{width:9px;height:9px;border-radius:2px;display:inline-block}
.pn-faixas em{font-style:normal;color:#b0b7c3}
.pn-comp-exp{font-size:12px;color:#9ca3af;margin:6px 0 0;line-height:1.45}
.pn-comp-item{cursor:help}
.pn-sec-desc{font-size:12.5px;color:#9ca3af;font-weight:400;margin-left:10px}
.pn-comp-t{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;font-weight:700}
.pn-comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 22px;margin-top:12px}
@media(max-width:640px){.pn-comp-grid{grid-template-columns:1fr}}
.pn-comp-head{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
.pn-comp-head em{color:#9ca3af;font-style:normal}
.pn-comp-head b{font-variant-numeric:tabular-nums}
.pn-bar{height:7px;background:#f1f3f5;border-radius:6px;overflow:hidden}
.pn-bar i{display:block;height:100%;background:linear-gradient(90deg,#f97316,#fb923c);border-radius:6px}
.pn-sec{margin-top:20px}
.pn-sec h3{font-size:14px;margin:0 0 10px;color:#374151;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.pn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.pn-kpi{background:#fff;border:1px solid #eef0f3;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:3px}
.pn-kpi-t{font-size:12px;color:#6b7280}
.pn-kpi-v{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
.pn-kpi-s{font-size:12px;color:#9ca3af}
.pn-semresp{font-size:11px;font-weight:600;color:#d97706;background:#fff7ed;border:1px solid #fed7aa;padding:2px 8px;border-radius:20px}
.pn-rank{background:#fff;border:1px solid #eef0f3;border-radius:14px;overflow:hidden}
.pn-rank-row{display:grid;grid-template-columns:44px 1fr auto auto;gap:14px;align-items:center;width:100%;text-align:left;border:0;border-bottom:1px solid #f3f4f6;background:#fff;padding:12px 16px;cursor:pointer;font-size:14px}
.pn-rank-row:hover{background:#fafafa}
.pn-rank-pos{color:#9ca3af;font-weight:700}
.pn-rank-nome{font-weight:600}
.pn-rank-score{font-weight:700;font-variant-numeric:tabular-nums}
.pn-rank-vgv{color:#111827;font-weight:700;font-variant-numeric:tabular-nums}
`;
