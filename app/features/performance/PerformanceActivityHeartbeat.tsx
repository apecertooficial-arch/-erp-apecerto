"use client";

import { useEffect, useRef } from "react";

const OCIOSO_APOS_MS = 5 * 60 * 1000;

/**
 * Mede uso real do ERP, não o botão "online" da distribuição.
 *
 * Só envia sinal com a aba visível e após atividade recente. O banco deduplica
 * múltiplas abas no mesmo bloco de cinco minutos, portanto abrir duas telas não
 * dobra as horas do corretor.
 */
export function PerformanceActivityHeartbeat({ accessToken }: { accessToken: string }) {
  const ultimaAtividade = useRef(0);

  useEffect(() => {
    let parado = false;
    ultimaAtividade.current = Date.now();
    const marcarAtividade = () => { ultimaAtividade.current = Date.now(); };
    const enviar = async () => {
      if (parado || document.visibilityState !== "visible") return;
      if (Date.now() - ultimaAtividade.current > OCIOSO_APOS_MS) return;
      try {
        await fetch("/api/performance/atividade", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          keepalive: true,
        });
      } catch {
        // Uma oscilação de rede não deve interromper o ERP; o próximo minuto
        // tenta de novo e a lacuna permanece visível nos dados.
      }
    };

    const eventos: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    eventos.forEach((evento) => window.addEventListener(evento, marcarAtividade, { passive: true }));
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") {
        marcarAtividade();
        void enviar();
      }
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    void enviar();
    const intervalo = window.setInterval(() => { void enviar(); }, 60_000);
    return () => {
      parado = true;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      eventos.forEach((evento) => window.removeEventListener(evento, marcarAtividade));
    };
  }, [accessToken]);

  return null;
}
