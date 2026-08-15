"use client";

import { useEffect, useRef } from "react";

import { ExplicadorAutomacoes } from "./ExplicadorAutomacoes";
import "../../styles/automation-builder.css";

type OriginalAutomationBuilder = {
  mount: (host: HTMLDivElement, context: { authToken: string }) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

export function AutomationsWorkspace({ accessToken }: { accessToken: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let mountedBuilder: OriginalAutomationBuilder | null = null;

    void import("./automationBuilderRuntime.js").then(({ default: builder }) => {
      if (!active || !hostRef.current) return;
      mountedBuilder = builder as OriginalAutomationBuilder;
      mountedBuilder.mount(hostRef.current, { authToken: accessToken });
    }).catch((error: unknown) => {
      if (!active || !hostRef.current) return;
      hostRef.current.innerHTML = `<div class="original-automation-error">${error instanceof Error ? error.message : "Erro ao carregar Automações."}</div>`;
    });

    return () => {
      active = false;
      mountedBuilder?.unmount();
    };
  }, [accessToken]);

  /* O explicador fica ao lado do construtor, nunca dentro dele: o construtor é
     um arquivo fechado de 202 KB e qualquer coisa que precise entrar lá vira
     risco. Aqui ele é um botão flutuante, independente. */
  return (
    <div className="automations-v2-shell">
      <header className="automations-v2-context">
        <div><span>CENTRAL DE AUTOMAÇÕES</span><h1>Motor independente</h1></div>
        <div className="automations-v2-context-copy">
          <p>Cada fluxo conecta somente o que você escolher nos blocos: evento, agente, funil, etapa e ação. Criar um novo funil não exige reconstruir o motor.</p>
          <a href="/agentes-ia">Treinar Sara e agentes →</a>
        </div>
      </header>
      <div className="original-automation-host" ref={hostRef} />
      <ExplicadorAutomacoes accessToken={accessToken} />
    </div>
  );
}
