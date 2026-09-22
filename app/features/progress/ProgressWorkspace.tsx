"use client";

import { useEffect, useState } from "react";
import { useErpSession } from "../system/ErpSession";
import { PROJECT_PROGRESS, isProjectProgressState } from "./progress-state";

const REFRESH_MS = 15_000;
export const STALE_AFTER_MS = 10 * 60_000;

function ProgressBar({ label, value }: { label: string; value: number }) {
  return <div className="project-progress-bar">
    <div><span>{label}</span><strong>{value}%</strong></div>
    <div className="project-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <i style={{ width: `${value}%` }} />
    </div>
  </div>;
}

export function ProgressWorkspace() {
  const { accessToken, perfilCarregado, profile } = useErpSession();
  const [now, setNow] = useState(() => Date.now());
  const [build, setBuild] = useState(PROJECT_PROGRESS.productionCommit);

  useEffect(() => {
    if (!accessToken || profile?.role !== "admin") return;
    let active = true;
    const refresh = async () => {
      setNow(Date.now());
      try {
        const response = await fetch("/api/build", { cache: "no-store" });
        const payload = await response.json() as { build?: unknown };
        if (active && response.ok && typeof payload.build === "string") setBuild(payload.build);
      } catch {
        // O checkpoint continua visível; a tela apenas não confirma um hash novo.
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => { active = false; window.clearInterval(interval); };
  }, [accessToken, profile?.role]);

  if (!perfilCarregado || !accessToken) return <div className="workspace-loading"><span /><strong>Carregando progresso…</strong></div>;
  if (profile?.role !== "admin") return <div className="modulo-sem-acesso" role="alert"><strong>Acesso restrito ao administrador.</strong><p>Este painel contém apenas o andamento técnico do projeto.</p></div>;
  if (!isProjectProgressState(PROJECT_PROGRESS)) return <div className="modulo-sem-acesso" role="alert"><strong>Fonte de progresso inválida.</strong></div>;

  const stale = now - Date.parse(PROJECT_PROGRESS.lastCheckpointAt) > STALE_AFTER_MS;
  const updatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(now);

  return <div className="project-progress">
    <header>
      <div><span className="project-progress-eyebrow">Projeto ERP ApeCerto</span><h1>Progresso da reconstrução</h1><p>{PROJECT_PROGRESS.currentTask}</p></div>
      <div className={`project-progress-status ${stale ? "stale" : "fresh"}`} role="status"><strong>{stale ? "Desatualizado" : "Atualizado"}</strong><span>checado {updatedAt}</span></div>
    </header>

    <section className="project-progress-overall" aria-label="Progresso geral">
      <ProgressBar label="Transformação completa" value={PROJECT_PROGRESS.overallPercent} />
      <div className="project-progress-usage"><span>Uso semanal registrado</span><strong>{PROJECT_PROGRESS.weeklyUsagePercent}%</strong><small>teto atual {PROJECT_PROGRESS.weeklyUsageCeilingPercent}%</small></div>
    </section>

    <section className="project-progress-grid" aria-label="Progresso por frente">
      {PROJECT_PROGRESS.fronts.map((front) => <ProgressBar key={front.name} label={front.name} value={front.percent} />)}
    </section>

    <section className="project-progress-details">
      <article><span>Último checkpoint</span><strong>{PROJECT_PROGRESS.lastCheckpoint}</strong><small>{new Date(PROJECT_PROGRESS.lastCheckpointAt).toLocaleString("pt-BR")}</small></article>
      <article><span>Checkpoint-base</span><code>{PROJECT_PROGRESS.lastCommitSent.slice(0, 12)}</code><small>Produção confirmada: {build.slice(0, 12)}</small></article>
      <article><span>Próximo passo</span><strong>{PROJECT_PROGRESS.nextStep}</strong></article>
    </section>

    <section className="project-progress-lists">
      <article><h2>Últimas entregas</h2><ul>{PROJECT_PROGRESS.latestDeliveries.map((item) => <li key={item}>{item}</li>)}</ul></article>
      <article><h2>Bloqueios</h2>{PROJECT_PROGRESS.blockers.length ? <ul>{PROJECT_PROGRESS.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nenhum bloqueio registrado.</p>}</article>
    </section>
  </div>;
}
