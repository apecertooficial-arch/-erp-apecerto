"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ResumoGestao = {
  acoes_vencidas: number;
  clientes_aguardando: number;
  clientes_criticos: number;
  visitas_sem_feedback: number;
  corretores_ativos: number;
};

type CorretorGestao = {
  corretor_id: string | number;
  nome: string;
  online: boolean;
  no_escritorio: boolean;
  carteira_ativa: number;
  acoes_vencidas: number;
  clientes_aguardando: number;
  clientes_criticos: number;
  carteira_trabalhada: number;
  pct_carteira_trabalhada: number | null;
};

type DadosGestao = { summary: ResumoGestao; team: CorretorGestao[]; generated_at: string };

const CAMPOS_RESUMO: Array<keyof ResumoGestao> = [
  "acoes_vencidas",
  "clientes_aguardando",
  "clientes_criticos",
  "visitas_sem_feedback",
  "corretores_ativos",
];
const CAMPOS_EQUIPE: Array<keyof Pick<CorretorGestao, "carteira_ativa" | "acoes_vencidas" | "clientes_aguardando" | "clientes_criticos" | "carteira_trabalhada" | "pct_carteira_trabalhada">> = [
  "carteira_ativa",
  "acoes_vencidas",
  "clientes_aguardando",
  "clientes_criticos",
  "carteira_trabalhada",
];

function registro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeroValido(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function interpretar(value: unknown): DadosGestao | null {
  if (!registro(value)) return null;
  if (!registro(value.summary) || !Array.isArray(value.team) || typeof value.generated_at !== "string") return null;
  const summary = value.summary;
  if (!CAMPOS_RESUMO.every((campo) => numeroValido(summary[campo]))) return null;
  const team = value.team.filter(registro);
  if (team.length !== value.team.length) return null;
  for (const row of team) {
    if ((typeof row.corretor_id !== "string" && typeof row.corretor_id !== "number") || typeof row.nome !== "string" || !row.nome.trim()) return null;
    if (typeof row.online !== "boolean" || typeof row.no_escritorio !== "boolean") return null;
    if (!CAMPOS_EQUIPE.every((campo) => numeroValido(row[campo]))) return null;
    if (row.pct_carteira_trabalhada !== null && !numeroValido(row.pct_carteira_trabalhada)) return null;
    if (Number(row.carteira_ativa) > 0 && row.pct_carteira_trabalhada === null) return null;
  }
  return value as DadosGestao;
}

function inteiro(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || "Gestor";
}

export function InicioGestaoMobile({ accessToken, nome, onIr }: {
  accessToken: string;
  nome: string;
  onIr: (destino: string) => void;
}) {
  const [dados, setDados] = useState<DadosGestao | null>(null);
  const [estado, setEstado] = useState<"loading" | "live" | "error">("loading");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setEstado((atual) => atual === "live" ? atual : "loading");
    try {
      const response = await fetch("/api/central-comando?section=gestao-mobile&days=7", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal,
      });
      const body = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        const message = registro(body) && typeof body.error === "string" ? body.error : "Não foi possível carregar as prioridades da gestão.";
        throw new Error(message);
      }
      const payload = interpretar(body);
      if (!payload) throw new Error("Os indicadores chegaram incompletos. Tente novamente.");
      setDados(payload);
      setErro("");
      setEstado("live");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as prioridades da gestão.");
      setEstado("error");
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void carregar(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [carregar]);

  const equipe = useMemo(() => {
    const equipe = [...(dados?.team ?? [])];
    equipe.sort((a, b) => {
      const urgenciaA = a.acoes_vencidas + a.clientes_criticos;
      const urgenciaB = b.acoes_vencidas + b.clientes_criticos;
      return urgenciaB - urgenciaA || b.clientes_aguardando - a.clientes_aguardando || a.nome.localeCompare(b.nome, "pt-BR");
    });
    return equipe;
  }, [dados]);

  if (estado === "loading") {
    return <section className="ape-inicio-gestao" aria-label="Gestão do dia" aria-busy="true">
      <header><span>GESTÃO DO DIA</span><h1>Organizando as prioridades…</h1><p>Conferindo a operação por corretor.</p></header>
      <div className="ape-gestao-carregando" aria-label="Carregando indicadores"><i /><i /><i /></div>
    </section>;
  }

  if (estado === "error" || !dados) {
    return <section className="ape-inicio-gestao" aria-label="Gestão do dia">
      <header><span>GESTÃO DO DIA</span><h1>Não foi possível confirmar as prioridades.</h1><p>{erro}</p></header>
      <section className="ape-gestao-erro" role="alert">
        <strong>Nenhum número foi presumido.</strong>
        <span>Recarregue antes de cobrar a equipe.</span>
        <button type="button" onClick={() => void carregar()}>Tentar novamente</button>
      </section>
    </section>;
  }

  const resumo = dados.summary;
  const semPendencia = resumo.acoes_vencidas === 0 && resumo.clientes_criticos === 0 && resumo.visitas_sem_feedback === 0;

  return <section className="ape-inicio-gestao" aria-label="Gestão do dia">
    <header>
      <span>GESTÃO DO DIA</span>
      <h1>Bom dia, {primeiroNome(nome)}.</h1>
      <p>{semPendencia ? "A equipe não tem pendências críticas confirmadas agora." : "Estas são as cobranças que não podem se perder hoje."}</p>
    </header>

    <section className={`ape-gestao-pulso${semPendencia ? " ok" : ""}`} aria-label="Resumo das prioridades">
      <article><small>Ações vencidas</small><strong>{inteiro(resumo.acoes_vencidas)}</strong><span>prazo definido já ultrapassado</span></article>
      <article><small>Clientes críticos</small><strong>{inteiro(resumo.clientes_criticos)}</strong><span>aguardando primeira resposta</span></article>
      <article><small>Visitas sem feedback</small><strong>{inteiro(resumo.visitas_sem_feedback)}</strong><span>retorno pendente há mais de 48 h</span></article>
    </section>

    <div className="ape-gestao-atalhos">
      <button type="button" onClick={() => onIr("/notificacoes")}>Abrir avisos</button>
      <button type="button" onClick={() => onIr("/agenda")}>Ver visitas</button>
    </div>

    <section className="ape-gestao-equipe" aria-labelledby="titulo-equipe-prioridade">
      <header><div><span>EQUIPE</span><h2 id="titulo-equipe-prioridade">Quem precisa de cobrança</h2></div><b>{inteiro(resumo.corretores_ativos)} ativos</b></header>
      {equipe.length === 0 ? <p className="ape-gestao-vazio">Nenhum corretor ativo foi devolvido pela fonte operacional.</p> : equipe.map((corretor) => {
        const urgente = corretor.acoes_vencidas > 0 || corretor.clientes_criticos > 0;
        return <article className={urgente ? "urgente" : ""} key={String(corretor.corretor_id)}>
          <div className="ape-gestao-corretor-topo">
            <span className={`ape-gestao-presenca${corretor.online ? " online" : corretor.no_escritorio ? " escritorio" : ""}`} aria-hidden="true" />
            <div><strong>{corretor.nome}</strong><small>{corretor.online ? "online agora" : corretor.no_escritorio ? "no escritório" : "fora do escritório"}</small></div>
            <b>{urgente ? "Cobrar" : "Em dia"}</b>
          </div>
          <div className="ape-gestao-metricas">
            <span><strong>{inteiro(corretor.acoes_vencidas)}</strong> vencidas</span>
            <span><strong>{inteiro(corretor.clientes_criticos)}</strong> críticos</span>
            <span><strong>{inteiro(corretor.clientes_aguardando)}</strong> aguardando</span>
          </div>
          <div className="ape-gestao-progresso" aria-label={corretor.pct_carteira_trabalhada == null ? "Sem carteira ativa" : `${inteiro(corretor.pct_carteira_trabalhada)}% da carteira trabalhada`}>
            <span><i style={{ width: `${Math.min(100, corretor.pct_carteira_trabalhada ?? 0)}%` }} /></span>
            <small>{inteiro(corretor.carteira_trabalhada)} de {inteiro(corretor.carteira_ativa)} acompanhados em 7 dias</small>
          </div>
          <button type="button" onClick={() => onIr("/equipe")}>{urgente ? "Cobrar corretor" : "Ver desempenho"}</button>
        </article>;
      })}
    </section>
  </section>;
}
