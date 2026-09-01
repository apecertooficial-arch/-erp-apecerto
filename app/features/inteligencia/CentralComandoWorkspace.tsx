"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useErpSession } from "../system/ErpSession";

export function CentralComandoWorkspace({ accessToken }: { accessToken: string }) {
  const { profile } = useErpSession();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const authorize = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      {
        type: "apecerto:central:auth",
        accessToken,
        userName: profile?.name || "Gestão apêcerto",
        profileLabel: profile?.role === "admin" ? "CEO / admin" : "Gestor comercial",
      },
      window.location.origin,
    );
  }, [accessToken, profile?.name, profile?.role]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const payload = event.data as { type?: string } | null;
      if (payload?.type !== "apecerto:central:ready") return;
      setReady(true);
      authorize();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [authorize]);

  return (
    <section className="central-prototype-embed" aria-label="Central de Comando">
      {!ready && <div className="central-prototype-boot"><span /><strong>Carregando a Central de Comando…</strong></div>}
      <iframe
        ref={frame}
        src="/central-comando/prototype.html?v=20260901-1"
        title="Central de Comando"
        onLoad={authorize}
      />
    </section>
  );
}
