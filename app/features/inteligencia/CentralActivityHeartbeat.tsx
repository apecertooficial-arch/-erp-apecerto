"use client";

import { useEffect, useRef } from "react";
import { useErpSession } from "../system/ErpSession";

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export function CentralActivityHeartbeat() {
  const { accessToken, profile } = useErpSession();
  const lastInteraction = useRef(0);

  useEffect(() => {
    if (!accessToken || !profile?.brokerId) return;
    lastInteraction.current = Date.now();
    const touch = () => { lastInteraction.current = Date.now(); };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, touch, { passive: true }));

    let stopped = false;
    const send = async () => {
      if (stopped) return;
      const ativo = document.visibilityState === "visible" && Date.now() - lastInteraction.current <= ACTIVE_WINDOW_MS;
      await fetch("/api/central-activity", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
        cache: "no-store",
        keepalive: true,
      }).catch(() => null);
    };

    void send();
    const interval = window.setInterval(() => void send(), 30_000);
    const onVisibility = () => void send();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      events.forEach((event) => window.removeEventListener(event, touch));
    };
  }, [accessToken, profile?.brokerId]);

  return null;
}
