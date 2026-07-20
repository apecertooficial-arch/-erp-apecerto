"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModuleName } from "./module-map";

const legacyScreen: Partial<Record<ModuleName, string>> = {
  "Início": "inicio",
  CRM: "crm",
  Performance: "performance",
  Produtos: "produtos",
  Financeiro: "financeiro",
  Abordagens: "abordagens",
  Automações: "automacoes",
  Financiamento: "financiamento",
  "Chat ao Vivo": "chat",
  Disparos: "disparos",
  Calendário: "calendario",
  "Agentes de IA": "agentes",
  Usuários: "corretores",
  Notificações: "notificacoes",
  "Base de conhecimento": "conhecimento",
  Auditoria: "auditoria",
  Configurações: "config",
  Ajuda: "ajuda",
};

function tokenIdentity(token: string) {
  try {
    const part = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(window.atob(part.padEnd(Math.ceil(part.length / 4) * 4, "="))) as {
      sub?: string;
      email?: string;
      user_metadata?: { name?: string; full_name?: string };
      app_metadata?: { role?: string };
    };
    return {
      userId: payload.sub ?? "",
      email: payload.email ?? "",
      name: payload.user_metadata?.full_name ?? payload.user_metadata?.name ?? "Samuel",
      profile: payload.app_metadata?.role ?? "Admin",
    };
  } catch {
    return { userId: "", email: "", name: "Samuel", profile: "Admin" };
  }
}

type SessionIdentity = { userId: string; name: string; email: string; role: "admin" | "gestor" | "corretor" };

export function LegacyModuleWorkspace({ moduleName, accessToken, session }: { moduleName: ModuleName; accessToken: string; session?: SessionIdentity | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [opened, setOpened] = useState(false);
  const identity = useMemo(() => session ? {
    userId: session.userId,
    name: session.name,
    email: session.email,
    profile: session.role === "corretor" ? "Corretor" : session.role === "gestor" ? "Gestor" : "Admin",
  } : tokenIdentity(accessToken), [accessToken, session]);
  const screen = legacyScreen[moduleName] ?? "inicio";

  const openOriginalScreen = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "apecerto:open-legacy",
      token: accessToken,
      screen,
      ...identity,
    }, window.location.origin);
  }, [accessToken, identity, screen]);

  useEffect(() => {
    let retry = 0;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "apecerto:legacy-ready") openOriginalScreen();
      if (event.data?.type === "apecerto:legacy-opened" && event.data.screen === screen) {
        setOpened(true);
        if (retry) window.clearInterval(retry);
      }
    };
    window.addEventListener("message", onMessage);
    retry = window.setInterval(openOriginalScreen, 600);
    const stop = window.setTimeout(() => window.clearInterval(retry), 18_000);
    openOriginalScreen();
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(retry);
      window.clearTimeout(stop);
    };
  }, [openOriginalScreen, screen]);

  return (
    <div className="legacy-module-workspace">
      {!opened && <div className="legacy-module-loading"><span />Restaurando {moduleName} exatamente do HTML original…</div>}
      <iframe
        ref={iframeRef}
        src="/legacy-runtime.html?v=perf-total-20260720-3"
        title={`${moduleName} · estrutura original`}
        onLoad={openOriginalScreen}
      />
    </div>
  );
}
