"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";

type Agent = { slug: string; name: string; role: string; objective: string; audience: string; tone: string; behavior: string; examples: string[]; expected: string[]; forbidden: string[]; active: boolean; version: string; color: string; symbol: string };
type DbAgent = { slug: string; nome: string; tipo: string; categoria: string | null; modelo: string; system_prompt: string | null; config: Record<string, unknown> | null; ativo: boolean };
type IaExec = { id: number; agente_slug: string | null; lead_id: number | null; modelo: string | null; tokens_entrada: number | null; tokens_saida: number | null; custo_usd: number | string | null; status: string | null; saida: unknown; criado_em: string | null };
type CenterData = { flags: { nome: string; ativo: boolean }[]; agents: DbAgent[]; iaExecutions: IaExec[]; error?: string };

const agents: Agent[] = [
  { slug: "assistente-sistema", name: "Assistente do Sistema", role: "Ensina a usar o ERP, explica campos e abre o módulo certo.", objective: "Reduzir dúvidas operacionais e acelerar o uso do sistema.", audience: "Toda a equipe", tone: "Didático e direto", behavior: "Responde com passo a passo e leva o usuário à tela certa.", examples: ["Como agendo uma visita?", "Onde vejo minha comissão?", "Como altero a etapa de um lead?"], expected: ["Passo a passo claro", "Link para a tela correta"], forbidden: ["Inventar telas que não existem", "Dar conselho financeiro"], active: true, version: "v3", color: "#2f6fed", symbol: "?" },
  { slug: "copiloto-atendimento", name: "Copiloto de Atendimento", role: "Sugere e melhora mensagens, responde objeções e qualifica no chat.", objective: "Elevar a qualidade e a velocidade do atendimento.", audience: "Corretores", tone: "Caloroso e comercial", behavior: "Personaliza pelo nome, faz perguntas e conduz para a visita.", examples: ["Sugira uma resposta", "Responda à objeção de preço", "Tente agendar visita"], expected: ["Mensagem personalizada", "Chamada para ação"], forbidden: ["Prometer desconto não autorizado", "Enviar apenas a tabela"], active: false, version: "v5", color: "#25a85a", symbol: "C" },
  { slug: "avaliador-atendimento", name: "Avaliador de Atendimento", role: "Analisa conversas, dá nota e aponta oportunidades de melhoria.", objective: "Medir e melhorar a qualidade do atendimento.", audience: "Gestores", tone: "Analítico e imparcial", behavior: "Pontua velocidade, clareza, condução e gera recomendações.", examples: ["Avalie esta conversa", "Quais erros mais comuns?", "Quem precisa de treino?"], expected: ["Nota com composição", "Recomendações objetivas"], forbidden: ["Julgar sem dados", "Expor o corretor publicamente"], active: false, version: "v2", color: "#8b00cc", symbol: "A" },
  { slug: "especialista-produtos", name: "Especialista em Produtos", role: "Busca imóveis, compara unidades e sugere argumentos.", objective: "Ajudar a encontrar e apresentar o imóvel certo.", audience: "Corretores", tone: "Consultivo", behavior: "Filtra pelo perfil do lead e indica alternativas semelhantes.", examples: ["2 dorms prontos até 700 mil", "Qual combina com este lead?", "Quais materiais enviar?"], expected: ["Lista com preço/m²", "Alternativa semelhante"], forbidden: ["Recomendar fora do orçamento", "Dado de estoque inventado"], active: false, version: "v4", color: "#ff7000", symbol: "P" },
  { slug: "gestor-carteira", name: "Gestor de Carteira", role: "Encontra leads atrasados, prioriza contatos e organiza o dia.", objective: "Aproveitar melhor a base e reduzir leads parados.", audience: "Corretores", tone: "Objetivo e prático", behavior: "Ranqueia por urgência e sugere a próxima tarefa.", examples: ["Quem está esperando resposta?", "Meu plano de hoje", "Leads quentes parados"], expected: ["Lista priorizada", "Próxima ação por lead"], forbidden: ["Ignorar SLA", "Sugerir spam"], active: false, version: "v2", color: "#cc5800", symbol: "G" },
  { slug: "especialista-financiamento", name: "Especialista em Financiamento", role: "Explica etapas, documentos e interpreta simulações.", objective: "Tornar o crédito imobiliário simples e guiado.", audience: "Corretores e clientes", tone: "Claro e tranquilizador", behavior: "Explica parcela e entrada e prepara mensagem para o cliente.", examples: ["Quais documentos faltam?", "Explique a simulação", "Qual o melhor banco?"], expected: ["Explicação simples", "Comparação de bancos"], forbidden: ["Garantir aprovação", "Aconselhar sonegação"], active: false, version: "v3", color: "#0e9488", symbol: "$" },
  { slug: "treinador-comercial", name: "Treinador Comercial", role: "Recomenda treinamentos e cria um plano de melhoria por corretor.", objective: "Desenvolver a equipe a partir dos pontos fracos.", audience: "Gestores e corretores", tone: "Encorajador", behavior: "Cruza esforço e resultado e sugere exercícios práticos.", examples: ["Plano de melhoria para o corretor", "Qual treino priorizar?"], expected: ["Plano acionável", "Exercícios simulados"], forbidden: ["Metas irreais", "Comparações desmotivadoras"], active: false, version: "v1", color: "#d49a00", symbol: "T" },
  { slug: "gestor-operacao", name: "Gestor da Operação", role: "Analisa corretores, prevê resultado e sugere decisões.", objective: "Dar ao gestor visão de risco e capacidade da equipe.", audience: "Gestores e diretores", tone: "Estratégico", behavior: "Identifica gargalos, risco de meta e sobrecarga.", examples: ["Quem corre risco de meta?", "Qual o gargalo do funil?", "Quem pode receber mais leads?"], expected: ["Diagnóstico com números", "Recomendação de ação"], forbidden: ["Decisão de RH", "Exposição indevida de dados"], active: false, version: "v4", color: "#66009a", symbol: "O" },
  { slug: "transcricao-visao", name: "Base de Transcrição e Visão", role: "Transcreve áudios e descreve imagens das conversas para dar contexto aos outros agentes.", objective: "Enxergar o que hoje é áudio/imagem em branco.", audience: "Fundação (uso interno)", tone: "Neutro", behavior: "Converte áudio em texto e descreve imagens, salvando junto da mensagem.", examples: ["Transcreva este áudio", "Descreva esta imagem"], expected: ["Texto fiel do áudio", "Descrição objetiva da imagem"], forbidden: ["Inventar conteúdo não presente"], active: false, version: "v1", color: "#334155", symbol: "B" },
  { slug: "sara-atualizadora", name: "Sara — Atualizadora", role: "Lê o contexto dos leads e sugere mover etapas e atualizar campos.", objective: "Organizar a carteira com a sua aprovação.", audience: "Corretores e gestores", tone: "Objetivo", behavior: "Sugere mudanças (não executa sozinha no início) e registra tudo em log.", examples: ["Sara, organiza meus leads", "Quais leads mover de etapa?"], expected: ["Sugestões com justificativa", "Log das mudanças"], forbidden: ["Mover lead sem aprovação", "Ultrapassar o limite diário"], active: false, version: "v1", color: "#7c3aed", symbol: "S" },
];

function money(v: number) { return `US$ ${v.toFixed(v < 0.01 ? 6 : 4)}`; }

export function AgentWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<CenterData>({ flags: [], agents: [], iaExecutions: [] });
  const [selected, setSelected] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [treino, setTreino] = useState("");
  const [saving, setSaving] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ texto: string; custo?: number; tokens?: { entrada: number; saida: number } } | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/ai-center", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json() as CenterData;
    setData(body);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [accessToken]);

  const dbMap = useMemo(() => new Map(data.agents.map((a) => [a.slug, a])), [data.agents]);
  const rendered = agents.map((agent) => {
    const db = dbMap.get(agent.slug);
    return { ...agent, active: db ? db.ativo : agent.active };
  });

  const totalCusto = useMemo(() => data.iaExecutions.reduce((sum, e) => sum + Number(e.custo_usd ?? 0), 0), [data.iaExecutions]);

  function openAgent(agent: Agent) {
    setSelected(agent);
    setTreino(dbMap.get(agent.slug)?.system_prompt ?? "");
    setTestInput("");
    setTestResult(null);
    setNotice("");
  }

  async function toggle(agent: Agent, active: boolean) {
    setNotice("");
    const response = await fetch("/api/ai-center", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggleAgent", slug: agent.slug, active }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setNotice(body.error ?? "Não foi possível salvar.");
    else { setNotice(`${agent.name} ${active ? "ativado" : "pausado"}.`); await load(); }
  }

  async function salvarTreino() {
    if (!selected) return;
    setSaving(true); setNotice("");
    const response = await fetch("/api/ai-center", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveAgent", slug: selected.slug, system_prompt: treino }) });
    const body = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) setNotice(body.error ?? "Não foi possível salvar o treino.");
    else { setNotice("Treino salvo."); await load(); }
  }

  async function testar() {
    if (!selected || !testInput.trim()) return;
    setTesting(true); setTestResult(null); setNotice("");
    const response = await fetch("/api/ai-center", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "runAgent", slug: selected.slug, input: testInput }) });
    const body = await response.json() as { ok?: boolean; reason?: string; detalhe?: string; saida?: unknown; custo_usd?: number; tokens?: { entrada: number; saida: number } };
    setTesting(false);
    if (!body.ok) {
      const motivo = body.reason === "sem_chave" ? "Chave de IA não configurada." : (body.detalhe || body.reason || "Falha no teste.");
      setTestResult({ texto: `⚠️ ${motivo}` });
      await load();
      return;
    }
    const texto = typeof body.saida === "string" ? body.saida : JSON.stringify(body.saida, null, 2);
    setTestResult({ texto, custo: body.custo_usd, tokens: body.tokens });
    await load();
  }

  return (
    <div className="agent-workspace">
      <header className="workspace-top">
        <div><h1>Agentes de IA</h1><p>Agentes especializados para apoiar a operação imobiliária</p></div>
        <span className="agent-total">{rendered.filter((a) => a.active).length} ativos · {money(totalCusto)} gastos</span>
      </header>
      {notice && <div className="agent-notice">{notice}</div>}
      {loading ? <div className="workspace-loading">Carregando agentes...</div> : data.error ? <div className="workspace-error">{data.error}</div> : (
        <main className="agent-grid">
          {rendered.map((agent) => {
            const execs = data.iaExecutions.filter((e) => e.agente_slug === agent.slug);
            return (
              <article className="agent-card" key={agent.slug}>
                <div className="agent-card-head">
                  <span style={{ background: agent.color }}>{agent.symbol}</span>
                  <div><h2>{agent.name}</h2><p>{agent.role}</p></div>
                  <label className="agent-switch"><input type="checkbox" checked={agent.active} onChange={(event) => void toggle(agent, event.target.checked)} /><i /></label>
                </div>
                <div className="agent-stats">
                  <span><b>{execs.length}</b> execuções</span>
                  <span><b>{money(execs.reduce((s, e) => s + Number(e.custo_usd ?? 0), 0))}</b></span>
                  <mark className={agent.active ? "active" : "paused"}>{agent.active ? "Ativo" : "Pausado"}</mark>
                </div>
                <footer><small>{agent.version}</small><button type="button" onClick={() => openAgent(agent)}>Configurar e testar</button></footer>
              </article>
            );
          })}
        </main>
      )}
      {selected && (
        <div className="agent-layer" onClick={() => setSelected(null)}>
          <aside className="agent-drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <span style={{ background: selected.color }}>{selected.symbol}</span>
              <div><h2>{selected.name}</h2><p>{selected.role}</p></div>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </header>
            <section>
              <div className="agent-definition">
                <small>OBJETIVO</small><p>{selected.objective}</p>
                <small>PÚBLICO</small><p>{selected.audience}</p>
                <small>TOM</small><p>{selected.tone}</p>
                <small>COMPORTAMENTO</small><p>{selected.behavior}</p>
              </div>

              <h3>Treino do agente</h3>
              <textarea value={treino} onChange={(e) => setTreino(e.target.value)} rows={6} placeholder="Escreva aqui a instrução que guia este agente..." style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d5d9e0", fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
              <button type="button" onClick={() => void salvarTreino()} disabled={saving} style={{ marginTop: 6 }}>{saving ? "Salvando..." : "Salvar treino"}</button>

              <h3>Testar agora</h3>
              <div className="agent-prompts">{selected.examples.map((item) => <button type="button" key={item} onClick={() => setTestInput(item)}>{item}</button>)}</div>
              <textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={3} placeholder="Digite ou escolha um exemplo acima..." style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d5d9e0", fontFamily: "inherit", fontSize: 13, resize: "vertical", marginTop: 6 }} />
              <button type="button" onClick={() => void testar()} disabled={testing} style={{ marginTop: 6 }}>{testing ? "Consultando a IA..." : "Testar com IA real"}</button>
              {testResult && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "#f5f7fb", border: "1px solid #e3e7ef" }}>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", fontSize: 13 }}>{testResult.texto}</pre>
                  {testResult.custo !== undefined && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#556" }}>Custo: {money(testResult.custo)} · {testResult.tokens?.entrada}+{testResult.tokens?.saida} tokens</p>}
                </div>
              )}

              <div className="agent-rules">
                <div><h3>Respostas esperadas</h3>{selected.expected.map((item) => <p key={item}>✓ {item}</p>)}</div>
                <div><h3>O agente não pode</h3>{selected.forbidden.map((item) => <p key={item}>× {item}</p>)}</div>
              </div>

              <h3>Execuções reais recentes</h3>
              <div className="agent-history">
                {data.iaExecutions.filter((e) => e.agente_slug === selected.slug).slice(0, 8).map((item) => (
                  <article key={item.id}>
                    <b>{item.status === "ok" ? "Execução" : "Erro"} · {money(Number(item.custo_usd ?? 0))}</b>
                    <span>{item.modelo || "—"} · {item.criado_em ? new Date(item.criado_em).toLocaleString("pt-BR") : "—"}</span>
                    <p>{typeof item.saida === "string" ? item.saida.slice(0, 160) : JSON.stringify(item.saida).slice(0, 160)}</p>
                  </article>
                ))}
                {!data.iaExecutions.filter((e) => e.agente_slug === selected.slug).length && <p>Nenhuma execução ainda. Use o teste acima.</p>}
              </div>
            </section>
            <footer>
              <label className="agent-switch-row">
                <span><b>{selected.active ? "Agente ativo" : "Agente pausado"}</b><small>O estado é salvo no Supabase.</small></span>
                <input type="checkbox" checked={selected.active} onChange={(event) => void toggle(selected, event.target.checked)} />
              </label>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
