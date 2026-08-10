"use client";

import { useEffect, useRef, useState } from "react";

import { FunnelRulesPanel } from "./FunnelRulesPanel";

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

type Aba = "construtor" | "funil";

export function AutomationsWorkspace({ accessToken }: { accessToken: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [aba, setAba] = useState<Aba>("construtor");

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

  /* O construtor legado é JavaScript puro montado num nó que ele mesmo governa.
     Trocar de aba não pode desmontá-lo: o usuário perderia o fluxo aberto no
     meio da edição. Por isso ele fica sempre no DOM e só some com `hidden`. */
  return (
    <div className="automations-shell">
      <style>{CSS_ABAS}</style>
      <nav className="automations-abas" role="tablist" aria-label="Seções de Automações">
        <button type="button" role="tab" aria-selected={aba === "construtor"}
          className={`automations-aba ${aba === "construtor" ? "automations-aba-ativa" : ""}`}
          onClick={() => setAba("construtor")}>
          Construtor de automações
        </button>
        <button type="button" role="tab" aria-selected={aba === "funil"}
          className={`automations-aba ${aba === "funil" ? "automations-aba-ativa" : ""}`}
          onClick={() => setAba("funil")}>
          Regras do funil
        </button>
      </nav>

      <div hidden={aba !== "construtor"}>
        <div className="original-automation-host" ref={hostRef} />
      </div>

      {aba === "funil" ? <FunnelRulesPanel accessToken={accessToken} /> : null}
    </div>
  );
}

const CSS_ABAS = `
.automations-abas{display:flex;gap:4px;border-bottom:1px solid #e3e6ec;margin-bottom:12px;flex-wrap:wrap}
.automations-aba{padding:10px 16px;border:0;background:none;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.automations-aba:hover{color:#1f2430}
.automations-aba-ativa{color:#1f2430;border-bottom-color:#1f2430}
`;
