"use client";

import { useEffect, useRef } from "react";

import { ExplicadorAutomacoes } from "./ExplicadorAutomacoes";

type OriginalAutomationBuilder = {
  mount: (host: HTMLDivElement, context: { authToken: string }) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

declare global {
  interface Window {
    ApeCertoAutomationBuilder?: OriginalAutomationBuilder;
  }
}

const scriptId = "apecerto-original-automation-builder";
const styleId = "apecerto-original-automation-styles";
const assetVersion = "20260814-1";

function ensureStyle() {
  if (document.getElementById(styleId)) return;
  const link = document.createElement("link");
  link.id = styleId;
  link.rel = "stylesheet";
  link.href = `/automation-builder-original.css?v=${assetVersion}`;
  document.head.appendChild(link);
}

function loadOriginalBuilder() {
  if (window.ApeCertoAutomationBuilder) return Promise.resolve(window.ApeCertoAutomationBuilder);

  return new Promise<OriginalAutomationBuilder>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.id = scriptId;
    script.src = `/automation-builder-original.js?v=${assetVersion}`;
    script.async = true;
    script.onload = () => window.ApeCertoAutomationBuilder
      ? resolve(window.ApeCertoAutomationBuilder)
      : reject(new Error("O construtor original não foi inicializado."));
    script.onerror = () => reject(new Error("Não foi possível carregar o construtor original."));
    if (!existing) document.body.appendChild(script);
  });
}

export function AutomationsWorkspace({ accessToken }: { accessToken: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    ensureStyle();

    void loadOriginalBuilder().then((builder) => {
      if (!active || !hostRef.current) return;
      builder.mount(hostRef.current, { authToken: accessToken });
    }).catch((error: unknown) => {
      if (!active || !hostRef.current) return;
      hostRef.current.innerHTML = `<div class="original-automation-error">${error instanceof Error ? error.message : "Erro ao carregar Automações."}</div>`;
    });

    return () => {
      active = false;
      window.ApeCertoAutomationBuilder?.unmount();
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
