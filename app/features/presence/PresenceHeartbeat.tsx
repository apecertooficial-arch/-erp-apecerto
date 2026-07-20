"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

/* Batimento de presença do corretor.
   A cada ~20s consulta /api/presenca. Quando o servidor pede confirmação
   (a cada N min, dentro da janela configurada), mostra o pop-up com contagem
   regressiva. Se o corretor não clicar "Sim" no prazo, cai o online e faz logout. */
export function PresenceHeartbeat({ accessToken }: { accessToken: string }) {
  const [prompt, setPrompt] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const draining = useRef(false);

  const drop = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    setPrompt(false);
    try { await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "drop" }) }); } catch { /* ignore */ }
    try { await getBrowserSupabaseClient().auth.signOut(); } catch { /* ignore */ }
    window.location.reload();
  }, [accessToken]);

  // polling do status
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/presenca", { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json() as { prompt?: boolean; prazo_seg?: number };
        if (stopped || draining.current) return;
        if (data.prompt) { setSeconds(Math.max(5, Math.round(data.prazo_seg ?? 60))); setPrompt(true); }
        else setPrompt(false);
      } catch { /* ignore */ }
    };
    void poll();
    const id = window.setInterval(poll, 20000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [accessToken]);

  // contagem regressiva enquanto o pop-up está aberto
  useEffect(() => {
    if (!prompt) return;
    const id = window.setInterval(() => {
      setSeconds((s) => { if (s <= 1) { window.clearInterval(id); void drop(); return 0; } return s - 1; });
    }, 1000);
    return () => window.clearInterval(id);
  }, [prompt, drop]);

  const confirm = useCallback(async () => {
    setPrompt(false);
    try { await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) }); } catch { /* ignore */ }
  }, [accessToken]);

  if (!prompt) return null;
  return <div className="presence-scrim" role="dialog" aria-modal="true" aria-label="Confirmação de presença">
    <div className="presence-modal">
      <div className="presence-ring"><strong>{seconds}</strong><span>seg</span></div>
      <h2>Você ainda está conectado?</h2>
      <p>Confirme sua presença para continuar recebendo leads. Se não confirmar, você sai do ar em <b>{seconds}s</b> e só volta a receber ao entrar de novo.</p>
      <button type="button" className="presence-yes" onClick={() => void confirm()}>Sim, estou aqui</button>
    </div>
  </div>;
}
