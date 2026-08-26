"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Contrato = { nome: string; ok: boolean };
type Quarentena = { id: number; automacao: string; bloco_id: string; tentativas: number; erro: string; criado_em: string };
type Revisao = { analise_id: number; funil_lead_id: string; nome: string; momento_codigo: string; resumo: string | null; confianca: number | null; analisado_em: string };
type Saude = {
  agora: string;
  abordagem_automatica: boolean;
  automacoes?: { ativas?: number; invalidas?: number };
  execucoes_24h?: Record<string, number>;
  fila?: { pendentes?: number; quarentena?: number; mais_antiga?: string | null };
  sara?: { fila_legada?: number; revisao_humana?: number; sem_evidencia?: number; qualidade_pendente?: number };
  integridade?: { lead_recente_sem_negocio?: number; negocio_funil2_sem_card?: number };
  presenca?: { elegiveis?: number; ativos?: number };
  contratos?: Contrato[];
  quarentena?: Quarentena[];
  revisoes?: Revisao[];
};

type View = "overview" | "executions" | "exceptions";

function numero(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function data(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}
function rotuloExecucao(chave: string) {
  return chave.replaceAll("_", " ").replace(/\b\w/g, (letra) => letra.toLocaleUpperCase("pt-BR"));
}

async function consultarSaude(accessToken: string, signal?: AbortSignal) {
  const response = await fetch("/api/automacoes-operacao", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal });
  const body = await response.json().catch(() => ({})) as Saude & { error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível consultar a Central.");
  return body;
}

export function CentralOperationsPanel({ accessToken, view = "overview" }: { accessToken: string; view?: View }) {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<number | "abordagem" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setSaude(await consultarSaude(accessToken)); setErro(null); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível consultar a Central."); }
    finally { setCarregando(false); }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    void consultarSaude(accessToken, controller.signal)
      .then((body) => { setSaude(body); setErro(null); })
      .catch((e) => { if (e instanceof DOMException && e.name === "AbortError") return; setErro(e instanceof Error ? e.message : "Não foi possível consultar a Central."); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [accessToken]);

  const contratos = saude?.contratos ?? [];
  const contratosOk = contratos.filter((item) => item.ok).length;
  const totalCritico = numero(saude?.automacoes?.invalidas) + numero(saude?.fila?.quarentena) + numero(saude?.integridade?.negocio_funil2_sem_card) + contratos.length - contratosOk;
  const estado = !saude ? "carregando" : totalCritico === 0 ? "saudavel" : "atencao";

  const executar = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/automacoes-operacao", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "A operação não foi concluída.");
    await carregar();
  }, [accessToken, carregar]);

  const reprocessar = useCallback(async (id: number, publicada = false) => {
    if (publicada && !window.confirm("A troca para a versão publicada ficará registrada e só ocorrerá se o contrato for seguro. Continuar?")) return;
    setProcessando(id); setErro(null);
    try { await executar({ action: publicada ? "reprocessar_versao_publicada" : "reprocessar", fila_id: id }); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível reprocessar."); }
    finally { setProcessando(null); }
  }, [executar]);

  const alternarAbordagem = useCallback(async () => {
    if (!saude) return;
    const liberar = !saude.abordagem_automatica;
    const mensagem = liberar ? "Liberar abordagens automáticas somente para blocos publicados e explícitos?" : "Bloquear imediatamente todas as abordagens automáticas?";
    if (!window.confirm(mensagem)) return;
    setProcessando("abordagem"); setErro(null);
    try { await executar({ action: "abordagem", liberar }); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar o freio."); }
    finally { setProcessando(null); }
  }, [executar, saude]);

  const indicadores = useMemo(() => [
    { rotulo: "Automações rodando", valor: numero(saude?.automacoes?.ativas), ajuda: `${numero(saude?.automacoes?.invalidas)} inválidas` },
    { rotulo: "Fila para processar", valor: numero(saude?.fila?.pendentes), ajuda: `${numero(saude?.fila?.quarentena)} em quarentena` },
    { rotulo: "Revisão humana", valor: numero(saude?.sara?.revisao_humana), ajuda: `${numero(saude?.sara?.sem_evidencia)} sem evidência em 7 dias` },
    { rotulo: "Presença elegível", valor: `${numero(saude?.presenca?.elegiveis)}/${numero(saude?.presenca?.ativos)}`, ajuda: "apurada na distribuição" },
  ], [saude]);

  const cabecalho = <header className="central-ops-header"><div className="central-ops-state"><span className={`central-ops-pulso ${estado}`} aria-hidden="true" /><div>{view === "overview" ? <span className="central-ops-context">Saúde da Central</span> : null}<b>{carregando ? "Consultando operação…" : estado === "saudavel" ? "Operação íntegra" : "Requer atenção"}</b><small>{contratosOk}/{contratos.length} contratos confirmados · atualizado em {data(saude?.agora)}</small></div></div><button type="button" className="central-refresh" onClick={() => void carregar()} disabled={carregando}>Atualizar dados</button></header>;

  if (erro && !saude) return <section className="central-ops-page"><div className="central-ops-erro" role="alert">{erro}<button type="button" onClick={() => void carregar()}>Tentar novamente</button></div></section>;

  return <section className={`central-ops-page central-ops-${view}`}>
    {cabecalho}
    {erro ? <div className="central-ops-erro" role="alert">{erro}</div> : null}

    {view === "overview" ? <>
      <div className="central-ops-grid">{indicadores.map((item) => <article key={item.rotulo}><span>{item.rotulo}</span><b>{item.valor}</b><small>{item.ajuda}</small></article>)}</div>
      <div className="central-ops-columns">
        <section className="central-ops-secao"><header><div><span className="central-ops-eyebrow">CONTRATOS</span><h3>O que a Central consegue provar</h3></div></header><div className="central-contratos">{contratos.length ? contratos.map((item) => <span key={item.nome} className={item.ok ? "ok" : "falha"}>{item.ok ? "✓" : "!"} {item.nome}</span>) : <p className="central-vazio">Nenhum contrato retornado.</p>}</div></section>
        <section className="central-ops-secao central-emergency"><header><div><span className="central-ops-eyebrow">PARADA DE EMERGÊNCIA</span><h3>{saude?.abordagem_automatica ? "Abordagens liberadas" : "Abordagens bloqueadas"}</h3></div></header><p>O freio só impede envio. Ele não cria caminho, regra comercial ou sucesso presumido.</p><button type="button" className={saude?.abordagem_automatica ? "central-stop" : "central-release"} onClick={() => void alternarAbordagem()} disabled={!saude || processando === "abordagem"}>{processando === "abordagem" ? "Aplicando…" : saude?.abordagem_automatica ? "Bloquear agora" : "Liberar abordagens"}</button></section>
      </div>
      <footer className="central-ops-rodape"><span>Negócios recentes sem card: <b>{numero(saude?.integridade?.negocio_funil2_sem_card)}</b></span><span>Leads recentes sem negócio: <b>{numero(saude?.integridade?.lead_recente_sem_negocio)}</b></span><span>Fila antiga da Sara: <b>{numero(saude?.sara?.fila_legada)}</b></span></footer>
    </> : null}

    {view === "executions" ? <section className="central-ops-secao"><header><div><span className="central-ops-eyebrow">ÚLTIMAS 24 HORAS</span><h3>Execuções por resultado</h3></div><small>Dados agregados reais</small></header><div className="central-execution-list">{Object.entries(saude?.execucoes_24h ?? {}).length ? Object.entries(saude?.execucoes_24h ?? {}).map(([chave, valor]) => <article key={chave}><span>{rotuloExecucao(chave)}</span><strong>{numero(valor)}</strong></article>) : <p className="central-vazio">Nenhuma execução registrada nas últimas 24 horas.</p>}</div><p className="central-data-note">O detalhe por bloco permanece acessível pelos contadores de cada módulo. Esta visão não mistura dados de teste com produção.</p></section> : null}

    {view === "exceptions" ? <div className="central-exception-columns">
      <section className="central-ops-secao"><header><div><span className="central-ops-eyebrow">QUARENTENA</span><h3>Falhou sem continuar</h3></div><small>{numero(saude?.fila?.quarentena)} item(ns)</small></header>{(saude?.quarentena ?? []).length ? <div className="central-lista">{(saude?.quarentena ?? []).map((item) => { const incompatibilidade = item.erro.includes("AUTOMATION_RUNTIME_CONTRACT_INVALID"); return <article key={item.id}><div><b>#{item.id} · {item.automacao}</b><span>Bloco {item.bloco_id} · {data(item.criado_em)} · {item.tentativas} tentativa(s)</span><p>{item.erro}</p></div><button type="button" onClick={() => void reprocessar(item.id, incompatibilidade)} disabled={processando === item.id}>{processando === item.id ? "Verificando…" : incompatibilidade ? "Migrar versão e reprocessar" : "Reprocessar com segurança"}</button></article>; })}</div> : <p className="central-vazio">Nenhuma falha aguardando decisão.</p>}</section>
      <section className="central-ops-secao"><header><div><span className="central-ops-eyebrow">SARA</span><h3>Revisão humana</h3></div><small>{numero(saude?.sara?.qualidade_pendente)} sem nota</small></header>{(saude?.revisoes ?? []).length ? <div className="central-lista central-revisoes">{(saude?.revisoes ?? []).map((item) => <article key={item.analise_id}><div><b>{item.nome || "Lead"} · {item.momento_codigo}</b><span>{data(item.analisado_em)} · confiança {item.confianca == null ? "—" : `${Math.round(Number(item.confianca) * 100)}%`}</span><p>{item.resumo || "A Sara pediu revisão sem inventar uma conclusão."}</p></div></article>)}</div> : <p className="central-vazio">Nenhuma análise aguardando revisão humana.</p>}</section>
    </div> : null}
  </section>;
}
