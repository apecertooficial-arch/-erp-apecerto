"use client";

import { useEffect, useRef } from "react";

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

function ensureStyle() {
  if (document.getElementById(styleId)) return;
  const link = document.createElement("link");
  link.id = styleId;
  link.rel = "stylesheet";
  link.href = `/automation-builder-original.css?v=${Date.now()}`; // cache-buster: sempre a versão publicada
  document.head.appendChild(link);
}

function loadOriginalBuilder() {
  if (window.ApeCertoAutomationBuilder) return Promise.resolve(window.ApeCertoAutomationBuilder);

  return new Promise<OriginalAutomationBuilder>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.id = scriptId;
    script.src = `/automation-builder-original.js?v=${Date.now()}`; // cache-buster: sempre a versão publicada
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

  return <div className="original-automation-host" ref={hostRef} />;
}
