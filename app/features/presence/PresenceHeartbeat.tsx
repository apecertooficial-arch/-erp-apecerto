"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Batimento de presença do corretor.
   A cada ~20s consulta /api/presenca. Quando o servidor pede confirmação
   (a cada N min, dentro da janela configurada), mostra o pop-up com contagem
   regressiva. Se o corretor não clicar "Sim" no prazo, sai somente da fila. */
export function PresenceHeartbeat({ accessToken, initialOnline }: { accessToken: string; initialOnline: boolean }) {
  const [prompt, setPrompt] = useState(false);
  const [seconds, setSeconds] = useState(60);
  // `/api/session` traz o estado persistido do corretor. Assim, depois de um
  // refresh ou novo login, quem já estava fora da fila continua vendo como
  // voltar — o aviso não depende apenas da memória desta aba.
  const [foraDaFila, setForaDaFila] = useState(!initialOnline);
  const [actionError, setActionError] = useState("");
  const [returning, setReturning] = useState(false);
  const draining = useRef(false);

  /* V7.2 — deixar o prazo vencer NÃO desconecta mais a pessoa do ERP.
     Antes, perder uma janela de 60 segundos executava `auth.signOut()` e
     recarregava a página: a corretora era expulsa do sistema inteiro por causa
     de uma confirmação de presença. Disponibilidade para receber lead e sessão
     autenticada no ERP são coisas diferentes e agora são tratadas como tais.
     O que acontece agora: sai da distribuição, com aviso PERSISTENTE e um
     botão que devolve a disponibilidade em um clique. */
  const drop = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    setPrompt(false);
    setActionError("");
    try {
      const response = await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "drop" }) });
      if (!response.ok) throw new Error("drop_failed");
    } catch {
      setActionError("Não foi possível confirmar sua saída da fila. Sua sessão continua aberta; tente voltar a receber leads.");
    } finally {
      setForaDaFila(true);
      draining.current = false;
    }
  }, [accessToken]);

  const voltar = useCallback(async () => {
    setReturning(true);
    setActionError("");
    try {
      const response = await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
      const data = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (!response.ok || data?.ok === false) throw new Error("confirm_failed");
      setForaDaFila(false);
      setPrompt(false);
    } catch {
      setActionError("Não foi possível voltar para a fila. Tente novamente; o aviso permanecerá até a confirmação.");
    } finally {
      setReturning(false);
    }
  }, [accessToken]);

  // polling do status
  useEffect(() => {
    // Após o prazo vencer, o banco continua considerando a confirmação antiga
    // vencida. Sem esta trava, o prompt reabriria a cada 20 segundos e
    // esconderia o aviso persistente antes de a corretora voltar para a fila.
    if (foraDaFila) return;
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
  }, [accessToken, foraDaFila]);

  // contagem regressiva enquanto o pop-up está aberto
  useEffect(() => {
    if (!prompt) return;
    const id = window.setInterval(() => {
      setSeconds((s) => { if (s <= 1) { window.clearInterval(id); void drop(); return 0; } return s - 1; });
    }, 1000);
    return () => window.clearInterval(id);
  }, [prompt, drop]);

  const confirm = useCallback(async () => {
    setActionError("");
    try {
      const response = await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
      const data = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (!response.ok || data?.ok === false) throw new Error("confirm_failed");
      setPrompt(false);
    } catch {
      setActionError("Não foi possível confirmar sua presença. Tente novamente antes do prazo.");
    }
  }, [accessToken]);

  if (foraDaFila) return <div className="presence-offline-bar" role="status">
    <span>⚠</span>
    <div><strong>Você saiu da distribuição de leads</strong><p>{actionError || "A confirmação de presença expirou. Sua conta continua conectada — só a fila de novos leads foi pausada."}</p></div>
    <button type="button" className="presence-yes" disabled={returning} onClick={() => void voltar()}>{returning ? "Voltando…" : "Voltar a receber leads"}</button>
  </div>;

  if (!prompt) return null;
  return <div className="presence-scrim" role="dialog" aria-modal="true" aria-label="Confirmação de presença">
    <div className="presence-modal">
      <div className="presence-ring"><strong>{seconds}</strong><span>seg</span></div>
      <h2>Você ainda está conectado?</h2>
      <p>Confirme sua presença para continuar recebendo leads. Se não confirmar, você sai da fila em <b>{seconds}s</b> — sem perder o acesso ao sistema, e com um botão para voltar.</p>
      {actionError && <p role="alert">{actionError}</p>}
      <button type="button" className="presence-yes" onClick={() => void confirm()}>Sim, estou aqui</button>
    </div>
  </div>;
}
