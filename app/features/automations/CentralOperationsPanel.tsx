"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Contrato = { nome: string; ok: boolean };
type Quarentena = {
  id: number;
  automacao: string;
  bloco_id: string;
  tentativas: number;
  erro: string;
  criado_em: string;
};
type Revisao = {
  analise_id: number;
  funil_lead_id: string;
  nome: string;
  momento_codigo: string;
  resumo: string | null;
  confianca: number | null;
  analisado_em: string;
};
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

function numero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function data(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function CentralOperationsPanel({ accessToken }: { accessToken: string }) {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<number | "abordagem" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/automacoes-operacao", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({})) as Saude & { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar a Central.");
      setSaude(body);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar a Central.");
    } finally {
      setCarregando(false);
    }
  }, [accessToken]);

  useEffect(() => { void carregar(); }, [carregar]);

  const contratos = saude?.contratos ?? [];
  const contratosOk = contratos.filter((item) => item.ok).length;
  const totalCritico = numero(saude?.automacoes?.invalidas)
    + numero(saude?.fila?.quarentena)
    + numero(saude?.integridade?.negocio_funil2_sem_card)
    + contratos.length - contratosOk;
  const estado = !saude ? "carregando" : totalCritico === 0 ? "saudavel" : "atencao";

  const executar = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/automacoes-operacao", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "A operação não foi concluída.");
    await carregar();
  }, [accessToken, carregar]);

  const reprocessar = useCallback(async (id: number) => {
    setProcessando(id); setErro(null);
    try { await executar({ action: "reprocessar", fila_id: id }); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível reprocessar."); }
    finally { setProcessando(null); }
  }, [executar]);

  const alternarAbordagem = useCallback(async () => {
    if (!saude) return;
    const liberar = !saude.abordagem_automatica;
    const mensagem = liberar
      ? "Liberar abordagens automáticas? Somente automações publicadas que tenham um bloco explícito de mensagem poderão enviar."
      : "Bloquear imediatamente todas as abordagens automáticas?";
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
    { rotulo: "Presença elegível", valor: `${numero(saude?.presenca?.elegiveis)}/${numero(saude?.presenca?.ativos)}`, ajuda: "apurada no instante da distribuição" },
  ], [saude]);

  return (
    <details className={`central-ops central-ops-${estado}`}>
      <summary>
        <span className="central-ops-pulso" aria-hidden="true" />
        <span><b>Saúde da Central</b><small>{carregando ? "Consultando produção…" : `${contratosOk}/${contratos.length} contratos confirmados`}</small></span>
        <em>{estado === "saudavel" ? "Operação íntegra" : estado === "atencao" ? "Requer atenção" : "Carregando"}</em>
      </summary>
      <div className="central-ops-corpo">
        <div className="central-ops-acoes">
          <div>
            <span className="central-ops-eyebrow">PARADA DE EMERGÊNCIA</span>
            <b>{saude?.abordagem_automatica ? "Abordagens automáticas liberadas" : "Abordagens automáticas bloqueadas"}</b>
            <p>Esse freio não cria regra comercial. Ele apenas impede qualquer bloco de mensagem de enviar.</p>
          </div>
          <button type="button" className={saude?.abordagem_automatica ? "central-stop" : "central-release"} onClick={() => void alternarAbordagem()} disabled={!saude || processando === "abordagem"}>
            {processando === "abordagem" ? "Aplicando…" : saude?.abordagem_automatica ? "Bloquear agora" : "Liberar abordagens"}
          </button>
          <button type="button" className="central-refresh" onClick={() => void carregar()} disabled={carregando}>Atualizar</button>
        </div>

        {erro ? <div className="central-ops-erro">{erro}</div> : null}

        <div className="central-ops-grid">
          {indicadores.map((item) => <article key={item.rotulo}><span>{item.rotulo}</span><b>{item.valor}</b><small>{item.ajuda}</small></article>)}
        </div>

        <section className="central-ops-secao">
          <header><div><span className="central-ops-eyebrow">CONTRATOS</span><h3>O que a Central consegue provar agora</h3></div></header>
          <div className="central-contratos">
            {contratos.map((item) => <span key={item.nome} className={item.ok ? "ok" : "falha"}>{item.ok ? "✓" : "!"} {item.nome}</span>)}
          </div>
        </section>

        <section className="central-ops-secao">
          <header><div><span className="central-ops-eyebrow">QUARENTENA</span><h3>Falhou sem continuar nem presumir sucesso</h3></div><small>{numero(saude?.fila?.quarentena)} item(ns)</small></header>
          {(saude?.quarentena ?? []).length ? <div className="central-lista">
            {(saude?.quarentena ?? []).map((item) => <article key={item.id}>
              <div><b>#{item.id} · {item.automacao}</b><span>Bloco {item.bloco_id} · {data(item.criado_em)}</span><p>{item.erro}</p></div>
              <button type="button" onClick={() => void reprocessar(item.id)} disabled={processando === item.id}>{processando === item.id ? "Enviando…" : "Reprocessar com segurança"}</button>
            </article>)}
          </div> : <p className="central-vazio">Nenhuma falha aguardando decisão.</p>}
        </section>

        <section className="central-ops-secao">
          <header><div><span className="central-ops-eyebrow">SARA</span><h3>Análises que não podem ser aplicadas sem uma pessoa</h3></div><small>{numero(saude?.sara?.qualidade_pendente)} sem nota fora do legado</small></header>
          {(saude?.revisoes ?? []).length ? <div className="central-lista central-revisoes">
            {(saude?.revisoes ?? []).map((item) => <article key={item.analise_id}>
              <div><b>{item.nome || "Lead"} · {item.momento_codigo}</b><span>{data(item.analisado_em)} · confiança {item.confianca == null ? "—" : `${Math.round(Number(item.confianca) * 100)}%`}</span><p>{item.resumo || "A Sara pediu revisão sem inventar uma conclusão."}</p></div>
            </article>)}
          </div> : <p className="central-vazio">Nenhuma análise aguardando revisão humana.</p>}
        </section>

        <footer className="central-ops-rodape">
          <span>Negócios recentes sem card: <b>{numero(saude?.integridade?.negocio_funil2_sem_card)}</b></span>
          <span>Leads recentes sem negócio: <b>{numero(saude?.integridade?.lead_recente_sem_negocio)}</b></span>
          <span>Fila antiga da Sara: <b>{numero(saude?.sara?.fila_legada)}</b></span>
          <span>Atualizado em {data(saude?.agora)}</span>
        </footer>
      </div>
    </details>
  );
}
