"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AgentSummary = {
  id: number; slug: string; nome: string; tipo: string; categoria: string | null;
  modelo: string; status: string; versao_atual: number | null; ativo: boolean; missao: string | null;
};
type Agent = AgentSummary & { system_prompt: string | null };
type Fonte = {
  id: number; titulo: string; tipo: string | null; conteudo: string | null;
  versao: string | null; situacao: string; responsavel: string | null; validade: string | null;
};
type FonteEdit = {
  id: number | null; titulo: string; tipo: string; conteudo: string;
  responsavel: string; versao: string; validade: string; situacao: string;
};
type Ferramenta = { id: number; slug: string; nome: string; tipo: string; requer_confirmacao: boolean; ativo: boolean };
type Permissao = { ferramenta_id: number; habilitado: boolean; perfis_autorizados?: string[] | null };
type Cenario = { id: number; pergunta: string; categoria: string | null; peso: number | null };
type Avaliacao = { cenario_id: number; nota_auto: number | null; aprovado: boolean; regras_descumpridas: string[] | null };
type FerramentaAcionada = { ferramenta: string; encontrados?: number };
type Execucao = {
  id: number; status: string; criado_em: string; ferramentas_acionadas: FerramentaAcionada[] | null;
  fontes_consultadas: string[] | null; tokens_entrada: number | null; tokens_saida: number | null;
  custo_usd: number | null; latencia_ms: number | null;
};
type AgentDetail = {
  agente: Agent; fontes: Fonte[]; fonteLinks: number[]; ferramentas: Ferramenta[];
  permissoes: Permissao[]; cenarios: Cenario[]; avaliacoes: Avaliacao[]; execucoes: Execucao[];
};
type TestResult = {
  ferramentas?: FerramentaAcionada[]; fontes?: string[]; custo_usd?: number | null;
  ms?: number | null; resposta?: string; reason?: string;
};
type BatteryResult = {
  cenario_id: number; pergunta: string; categoria?: string | null; nota?: number | null;
  aprovado?: boolean; regras?: string[];
};
type BatteryResponse = {
  resultados?: BatteryResult[]; total_cenarios?: number; fim?: boolean; next_offset: number;
};
type AgentListResponse = { agentes: AgentSummary[] };

const mensagemErro = (error: unknown) => error instanceof Error ? error.message : "Falha na operação.";

const MODELOS = ["gpt-4o-mini", "gpt-4o"];
const STATUS = [
  { v: "rascunho", label: "Rascunho" },
  { v: "em_teste", label: "Em teste" },
  { v: "revisao", label: "Em revisão" },
  { v: "aprovado", label: "Aprovado" },
  { v: "publicado", label: "Publicado" },
  { v: "arquivado", label: "Arquivado" },
];
const usd6 = (n: number | null | undefined) => n == null ? "—" : "US$ " + Number(n).toFixed(6);

export function AgentTrainingWorkspace({ accessToken }: { accessToken: string }) {
  const [agentes, setAgentes] = useState<AgentSummary[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [tab, setTab] = useState("instrucao");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // editable fields
  const [form, setForm] = useState({ nome: "", missao: "", system_prompt: "", modelo: "gpt-4o-mini", status: "rascunho" });

  // playground
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // bateria
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [batResults, setBatResults] = useState<BatteryResult[]>([]);
  const [showArq, setShowArq] = useState(false);

  // editor de fontes
  const [fonteEdit, setFonteEdit] = useState<FonteEdit | null>(null);

  const api = useCallback(async <T,>(method: string, path: string, body?: Record<string, unknown>): Promise<T> => {
    const res = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || payload.detalhe || "Falha na operação.");
    return payload as T;
  }, [accessToken]);

  const loadList = useCallback(async () => {
    const p = await api<AgentListResponse>("GET", "/api/agentes");
    setAgentes(p.agentes || []);
    setSlug((atual) => {
      if (atual || !p.agentes?.length) return atual;
      return (p.agentes.find((a) => a.slug === "sara") || p.agentes.find((a) => a.ativo) || p.agentes[0]).slug;
    });
  }, [api]);

  const loadDetail = useCallback(async (s: string) => {
    const p = await api<AgentDetail>("GET", `/api/agentes?slug=${encodeURIComponent(s)}`);
    setDetail(p);
    setForm({
      nome: p.agente.nome || "",
      missao: p.agente.missao || "",
      system_prompt: p.agente.system_prompt || "",
      modelo: p.agente.modelo || "gpt-4o-mini",
      status: p.agente.status || "rascunho",
    });
    setBatResults([]); setProgress({ done: 0, total: 0 }); setTestResult(null);
  }, [api]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadList().catch((e) => setNotice(mensagemErro(e)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadList]);
  useEffect(() => {
    if (!slug) return;
    const timer = window.setTimeout(() => {
      void loadDetail(slug).catch((e) => setNotice(mensagemErro(e)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail, slug]);

  const salvar = async () => {
    if (!slug) return;
    setBusy(true); setNotice(null);
    try { await api("POST", "/api/agentes", { action: "salvar", slug, ...form }); await loadDetail(slug); await loadList(); setNotice("Alterações salvas."); }
    catch (e) { setNotice(mensagemErro(e)); } finally { setBusy(false); }
  };

  const toggleTool = async (ferramenta_id: number, habilitado: boolean) => {
    if (!detail || !slug) return;
    setBusy(true); setNotice(null);
    try { await api("POST", "/api/agentes", { action: "toggleFerramenta", agente_id: detail.agente.id, ferramenta_id, habilitado }); await loadDetail(slug); }
    catch (e) { setNotice(mensagemErro(e)); } finally { setBusy(false); }
  };

  const salvarFonte = async () => {
    if (!fonteEdit?.titulo.trim() || !detail || !slug) { setNotice("Informe o título da fonte."); return; }
    setBusy(true); setNotice(null);
    try {
      await api("POST", "/api/agentes", {
        action: "salvarFonte", agente_id: detail.agente.id, fonte_id: fonteEdit.id || undefined,
        titulo: fonteEdit.titulo, tipo: fonteEdit.tipo, conteudo: fonteEdit.conteudo,
        responsavel: fonteEdit.responsavel, versao: fonteEdit.versao, validade: fonteEdit.validade || null, situacao: fonteEdit.situacao,
      });
      setFonteEdit(null); await loadDetail(slug); setNotice("Fonte salva.");
    } catch (e) { setNotice(mensagemErro(e)); } finally { setBusy(false); }
  };

  const vincularFonte = async (fonteId: number, vincular: boolean) => {
    if (!detail || !slug) return;
    setBusy(true); setNotice(null);
    try { await api("POST", "/api/agentes", { action: "vincularFonte", agente_id: detail.agente.id, fonte_id: fonteId, vincular }); await loadDetail(slug); }
    catch (e) { setNotice(mensagemErro(e)); } finally { setBusy(false); }
  };

  const testar = async () => {
    if (!testInput.trim() || !slug) return;
    setTesting(true); setTestResult(null); setNotice(null);
    try { const r = await api<TestResult>("POST", "/api/agentes", { action: "testar", slug, input: testInput.trim() }); setTestResult(r); }
    catch (e) { setNotice(mensagemErro(e)); } finally { setTesting(false); }
  };

  const rodarBateria = async () => {
    if (!slug) return;
    setRunning(true); setNotice(null); setBatResults([]);
    const total = detail?.cenarios?.length || 0;
    setProgress({ done: 0, total });
    try {
      let offset = 0;
      let acc: BatteryResult[] = [];
      for (let guard = 0; guard < 40; guard++) {
        const r = await api<BatteryResponse>("POST", "/api/agentes", { action: "bateria", slug, offset, limit: 5 });
        acc = acc.concat(r.resultados || []);
        setBatResults([...acc]);
        setProgress({ done: acc.length, total: r.total_cenarios || total });
        if (r.fim || !(r.resultados || []).length) break;
        offset = r.next_offset;
      }
      await loadDetail(slug);
      setNotice("Bateria concluída.");
    } catch (e) { setNotice(mensagemErro(e)); } finally { setRunning(false); }
  };

  const resumo = useMemo(() => {
    const a = detail?.avaliacoes || [];
    if (!a.length) return null;
    const aprov = a.filter((x) => x.aprovado).length;
    const media = Math.round(a.reduce((s, x) => s + Number(x.nota_auto || 0), 0) / a.length);
    return { total: a.length, aprov, media, pct: Math.round((100 * aprov) / a.length) };
  }, [detail]);

  const permOf = (fid: number) => (detail?.permissoes || []).find((p) => p.ferramenta_id === fid);

  return (
    <div className="agents-lab">
      <header className="lab-head">
        <div>
          <span className="lab-kicker">TREINAMENTO DE AGENTES DE IA</span>
          <h1>Laboratório da Sara &amp; agentes</h1>
          <p>Treine instrução, conhecimento e ferramentas aqui. Na Central de Automações, escolha quando cada agente participa de um fluxo.</p>
        </div>
        <a className="lab-automation-link" href="/automacoes">Usar na Central de Automações →</a>
      </header>

      {notice && <button className="lab-notice" type="button" onClick={() => setNotice(null)}>{notice} ×</button>}

      <div className="lab-body">
        <aside className="lab-agents">
          {(() => {
            const ativos = agentes.filter((a) => a.ativo);
            const arquivados = agentes.filter((a) => !a.ativo);
            const item = (a: AgentSummary) => (
              <button key={a.slug} className={a.slug === slug ? "active" : ""} type="button" onClick={() => setSlug(a.slug)}>
                <b>{a.nome}</b>
                <em>
                  <span className={`st st-${a.status}`}>{STATUS.find((s) => s.v === a.status)?.label || a.status}</span>
                  <span className="ver">v{a.versao_atual ?? 1}</span>
                </em>
              </button>
            );
            return (
              <>
                <div className="lab-agents-head"><strong>Agentes ativos</strong><small>{ativos.length}</small></div>
                {ativos.map(item)}
                {arquivados.length > 0 && (
                  <>
                    <button className="lab-arq-toggle" type="button" onClick={() => setShowArq(!showArq)}>
                      {showArq ? "▾" : "▸"} Arquivados ({arquivados.length})
                    </button>
                    {showArq && arquivados.map(item)}
                  </>
                )}
              </>
            );
          })()}
        </aside>

        <section className="lab-main">
          {!detail ? <div className="lab-loading">Carregando agente…</div> : (
            <>
              <div className="lab-agent-top">
                <div>
                  <h2>{detail.agente.nome}</h2>
                  <p>{detail.agente.categoria || detail.agente.tipo} · modelo {detail.agente.modelo} · v{detail.agente.versao_atual ?? 1}</p>
                </div>
                {resumo && <div className={`lab-score ${resumo.pct >= 90 ? "ok" : resumo.pct >= 70 ? "warn" : "bad"}`}>
                  <strong>{resumo.pct}%</strong><span>{resumo.aprov}/{resumo.total} testes · nota {resumo.media}</span>
                </div>}
              </div>

              <nav className="lab-tabs">
                {[["instrucao", "Instrução"], ["conhecimento", `Conhecimento (${detail.fontes.length})`], ["ferramentas", `Ferramentas`], ["testes", `Laboratório de testes (${detail.cenarios.length})`], ["monitor", "Monitoramento"]].map(([k, label]) => (
                  <button key={k} className={tab === k ? "active" : ""} type="button" onClick={() => setTab(k)}>{label}</button>
                ))}
              </nav>

              {tab === "instrucao" && (
                <div className="lab-panel">
                  <label className="lab-field"><span>Nome</span><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
                  <label className="lab-field"><span>Missão (para que este agente existe)</span><textarea rows={2} value={form.missao} onChange={(e) => setForm({ ...form, missao: e.target.value })} placeholder="Ex.: ajudar o corretor a responder o cliente com dados reais do catálogo." /></label>
                  <label className="lab-field"><span>Instrução base (papel, regras, tom, o que NÃO fazer)</span><textarea className="lab-prompt" rows={12} value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} /></label>
                  <div className="lab-row">
                    <label className="lab-field small"><span>Modelo</span><select value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}>{MODELOS.map((m) => <option key={m}>{m}</option>)}</select></label>
                    <label className="lab-field small"><span>Situação</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></label>
                  </div>
                  <p className="lab-hint">O conhecimento e os dados reais (catálogo, cliente) entram por <b>fontes</b> e <b>ferramentas</b> — não devem ser colados aqui no prompt. A instrução define comportamento, não estoque.</p>
                  <div className="lab-actions"><button className="primary" type="button" disabled={busy} onClick={salvar}>Salvar alterações</button></div>
                </div>
              )}

              {tab === "conhecimento" && (
                <div className="lab-panel">
                  <div className="lab-battery-head">
                    <div><strong>Base de conhecimento</strong><small>{(detail.fonteLinks || []).length} vinculada(s) a este agente · {detail.fontes.length} na biblioteca</small></div>
                    <button className="primary" type="button" onClick={() => setFonteEdit({ id: null, titulo: "", tipo: "Playbook", conteudo: "", responsavel: "", versao: "1.0", validade: "", situacao: "rascunho" })}>＋ Nova fonte</button>
                  </div>
                  {detail.fontes.length ? detail.fontes.map((f) => {
                    const vinc = (detail.fonteLinks || []).includes(f.id);
                    return (
                      <article className={`lab-source ${vinc ? "linked" : ""}`} key={f.id}>
                        <div>
                          <strong>{f.titulo}</strong>
                          <small>{f.tipo || "documento"} · v{f.versao || "?"} · resp. {f.responsavel || "—"}{f.validade ? ` · vence ${new Date(f.validade).toLocaleDateString("pt-BR")}` : ""}</small>
                        </div>
                        <div className="lab-source-actions">
                          <span className={`badge ${f.situacao === "aprovada" ? "ok" : f.situacao === "arquivada" || f.situacao === "vencida" ? "bad" : "warn"}`}>{f.situacao}</span>
                          <button type="button" className="mini" disabled={busy} onClick={() => setFonteEdit({
                            id: f.id, titulo: f.titulo, tipo: f.tipo || "Documento", conteudo: f.conteudo || "",
                            responsavel: f.responsavel || "", versao: f.versao || "", validade: f.validade || "", situacao: f.situacao,
                          })}>Editar</button>
                          <button type="button" className={`toggle ${vinc ? "on" : ""}`} disabled={busy} onClick={() => vincularFonte(f.id, !vinc)}>{vinc ? "Vinculada" : "Vincular"}</button>
                        </div>
                      </article>
                    );
                  }) : <div className="lab-empty">Nenhuma fonte na biblioteca. Crie a primeira com “＋ Nova fonte”.</div>}
                  <p className="lab-hint">Só fontes com situação <b>aprovada</b> e <b>vinculadas</b> são injetadas nas respostas do agente como verdade. Rascunho, vencida ou arquivada ficam guardadas mas não entram.</p>
                </div>
              )}

              {tab === "ferramentas" && (
                <div className="lab-panel">
                  {detail.ferramentas.map((fr) => {
                    const p = permOf(fr.id);
                    const on = p?.habilitado === true;
                    return (
                      <article className="lab-tool" key={fr.id}>
                        <div>
                          <strong>{fr.nome}</strong>
                          <small>{fr.tipo}{fr.requer_confirmacao ? " · exige confirmação" : ""}</small>
                        </div>
                        <button type="button" className={`toggle ${on ? "on" : ""}`} disabled={busy} onClick={() => toggleTool(fr.id, !on)}>{on ? "Habilitada" : "Desligada"}</button>
                      </article>
                    );
                  })}
                  {!detail.ferramentas.length && <div className="lab-empty">Nenhuma ferramenta cadastrada.</div>}
                  <p className="lab-hint">Ferramentas de <b>leitura</b> consultam dados reais (catálogo, cliente). Ferramentas de <b>escrita</b> só agem com confirmação humana.</p>
                </div>
              )}

              {tab === "testes" && (
                <div className="lab-panel">
                  <div className="lab-playground">
                    <strong>Teste rápido</strong>
                    <div className="lab-row">
                      <input value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="Ex.: tem 2 dormitórios até 700 mil?" onKeyDown={(e) => e.key === "Enter" && testar()} />
                      <button className="primary" type="button" disabled={testing} onClick={testar}>{testing ? "Rodando…" : "Testar"}</button>
                    </div>
                    {testResult && (
                      <div className="lab-test-out">
                        <div className="lab-test-meta">
                          {(testResult.ferramentas || []).map((f, i) => <span key={i} className="chip tool">🔧 {f.ferramenta} ({f.encontrados})</span>)}
                          {(testResult.fontes || []).map((f, i) => <span key={i} className="chip src">📚 {f}</span>)}
                          <span className="chip cost">{usd6(testResult.custo_usd)}</span>
                          {testResult.ms != null && <span className="chip">{testResult.ms} ms</span>}
                        </div>
                        <p>{testResult.resposta || testResult.reason || "(sem resposta)"}</p>
                      </div>
                    )}
                  </div>

                  <div className="lab-battery-head">
                    <div><strong>Bateria de cenários</strong><small>{detail.cenarios.length} cenários cadastrados</small></div>
                    <button className="primary" type="button" disabled={running || !detail.cenarios.length} onClick={rodarBateria}>{running ? `Rodando ${progress.done}/${progress.total}…` : "Rodar bateria"}</button>
                  </div>
                  {running && <div className="lab-progress"><i style={{ width: `${progress.total ? (100 * progress.done) / progress.total : 0}%` }} /></div>}

                  <div className="lab-cenarios">
                    {(batResults.length ? batResults : detail.cenarios.map((c) => {
                      const av = (detail.avaliacoes || []).find((a) => a.cenario_id === c.id);
                      return { cenario_id: c.id, pergunta: c.pergunta, categoria: c.categoria, nota: av?.nota_auto, aprovado: av?.aprovado, regras: av?.regras_descumpridas || [] };
                    })).map((r) => (
                      <article className={`lab-cenario ${r.nota == null ? "" : r.aprovado ? "pass" : "fail"}`} key={r.cenario_id}>
                        <span className="dot" />
                        <div><b>{r.pergunta}</b>{r.regras?.length ? <small>{r.regras.join(" · ")}</small> : r.categoria ? <small>{r.categoria}</small> : null}</div>
                        <em>{r.nota == null ? "—" : `${r.nota}`}</em>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {tab === "monitor" && (
                <div className="lab-panel">
                  {detail.execucoes.length ? (
                    <table className="lab-table">
                      <thead><tr><th>Quando</th><th>Status</th><th>Ferramentas</th><th>Fontes</th><th>Tokens</th><th>Custo</th><th>Latência</th></tr></thead>
                      <tbody>
                        {detail.execucoes.map((e) => (
                          <tr key={e.id}>
                            <td>{new Date(e.criado_em).toLocaleString("pt-BR")}</td>
                            <td><span className={`badge ${e.status === "ok" ? "ok" : "bad"}`}>{e.status}</span></td>
                            <td>{(e.ferramentas_acionadas || []).map((f) => f.ferramenta).join(", ") || "—"}</td>
                            <td>{(e.fontes_consultadas || []).length}</td>
                            <td>{(e.tokens_entrada || 0) + (e.tokens_saida || 0)}</td>
                            <td>{usd6(e.custo_usd)}</td>
                            <td>{e.latencia_ms ? `${e.latencia_ms} ms` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="lab-empty">Sem execuções registradas ainda. Rode um teste ou a bateria.</div>}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {fonteEdit && (
        <div className="lab-drawer-scrim" onClick={() => setFonteEdit(null)}>
          <aside className="lab-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <div><span>{fonteEdit.id ? "EDITAR FONTE" : "NOVA FONTE"}</span><h3>Base de conhecimento</h3></div>
              <button type="button" onClick={() => setFonteEdit(null)}>×</button>
            </header>
            <div className="lab-drawer-body">
              <label className="lab-field"><span>Título</span><input value={fonteEdit.titulo} onChange={(e) => setFonteEdit({ ...fonteEdit, titulo: e.target.value })} placeholder="Ex.: Playbook de Atendimento Comercial" /></label>
              <div className="lab-row">
                <label className="lab-field small"><span>Tipo</span>
                  <input list="lab-fonte-tipos" value={fonteEdit.tipo} onChange={(e) => setFonteEdit({ ...fonteEdit, tipo: e.target.value })} />
                  <datalist id="lab-fonte-tipos"><option value="Playbook" /><option value="Política" /><option value="Tabela de preços" /><option value="Script" /><option value="FAQ" /><option value="Regras de financiamento" /><option value="Documento" /></datalist>
                </label>
                <label className="lab-field small"><span>Versão</span><input value={fonteEdit.versao} onChange={(e) => setFonteEdit({ ...fonteEdit, versao: e.target.value })} placeholder="1.0" /></label>
              </div>
              <div className="lab-row">
                <label className="lab-field small"><span>Responsável</span><input value={fonteEdit.responsavel || ""} onChange={(e) => setFonteEdit({ ...fonteEdit, responsavel: e.target.value })} placeholder="Quem mantém" /></label>
                <label className="lab-field small"><span>Validade (opcional)</span><input type="date" value={fonteEdit.validade || ""} onChange={(e) => setFonteEdit({ ...fonteEdit, validade: e.target.value })} /></label>
                <label className="lab-field small"><span>Situação</span><select value={fonteEdit.situacao} onChange={(e) => setFonteEdit({ ...fonteEdit, situacao: e.target.value })}>
                  <option value="rascunho">Rascunho</option><option value="aprovada">Aprovada</option><option value="vencida">Vencida</option><option value="arquivada">Arquivada</option>
                </select></label>
              </div>
              <label className="lab-field"><span>Conteúdo (o que o agente vai usar como verdade)</span><textarea className="lab-prompt" rows={16} value={fonteEdit.conteudo || ""} onChange={(e) => setFonteEdit({ ...fonteEdit, conteudo: e.target.value })} placeholder="Cole aqui o playbook, a política, a tabela ou as regras. Este texto é injetado nas respostas quando a fonte está aprovada e vinculada." /></label>
              <p className="lab-hint">Marque <b>Aprovada</b> só quando o conteúdo estiver revisado — é o que autoriza o agente a usá-lo.</p>
            </div>
            <footer>
              <button type="button" onClick={() => setFonteEdit(null)}>Cancelar</button>
              <button className="primary" type="button" disabled={busy || !fonteEdit.titulo?.trim()} onClick={salvarFonte}>{fonteEdit.id ? "Salvar fonte" : "Criar e vincular"}</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
