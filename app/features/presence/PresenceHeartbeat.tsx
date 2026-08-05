"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { liberarAudio, tocarSom } from "../../lib/somAviso";

/* Batimento de presença do corretor.
   A cada ~20s consulta /api/presenca. Quando o servidor pede confirmação,
   mostra o pop-up com contagem regressiva.

   O AVISO NÃO SAI DA TELA ATÉ O CORRETOR CLICAR — e o contador segue para o
   negativo. Antes, ao estourar os 60 segundos o modal fechava, ele saia da fila
   e só era perguntado de novo na rodada seguinte: perdia a vez E não ficava
   sabendo. Agora ele vê "-3:12" e entende sozinho que está fora e há quanto
   tempo. Clicou, volta na hora, sem esperar rodada nenhuma. */
export function PresenceHeartbeat({ accessToken, initialOnline }: { accessToken: string; initialOnline: boolean }) {
  const [prompt, setPrompt] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [foraDaFila, setForaDaFila] = useState(!initialOnline);
  const [actionError, setActionError] = useState("");
  const [returning, setReturning] = useState(false);
  const jaDerrubou = useRef(false);

  useEffect(() => {
    let stopped = false;
    void getBrowserSupabaseClient().rpc("wa_v7_minha_presenca").then(({ data, error }) => {
      if (stopped || error || !data) return;
      const estado = data as { na_distribuicao?: boolean };
      if (typeof estado.na_distribuicao === "boolean") setForaDaFila(!estado.na_distribuicao);
    });
    return () => { stopped = true; };
  }, [accessToken]);

  /* Deixar o prazo vencer NÃO desconecta do ERP: só tira da fila de leads.
     Disponibilidade para receber lead e sessão autenticada são coisas
     diferentes. O modal permanece aberto para ele voltar quando quiser. */
  const sairDaFila = useCallback(async () => {
    if (jaDerrubou.current) return;
    jaDerrubou.current = true;
    setActionError("");
    try {
      const response = await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "drop" }) });
      if (!response.ok) throw new Error("drop_failed");
    } catch { /* o aviso continua na tela de qualquer forma */ }
    setForaDaFila(true);
  }, [accessToken]);

  const confirmar = useCallback(async () => {
    setActionError("");
    setReturning(true);
    try {
      const response = await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" }) });
      const data = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (!response.ok || data?.ok === false) throw new Error("confirm_failed");
      jaDerrubou.current = false;
      setForaDaFila(false);
      setPrompt(false);
    } catch {
      setActionError("Não foi possível confirmar. O aviso continua aqui até dar certo.");
    } finally {
      setReturning(false);
    }
  }, [accessToken]);

  /* O polling NÃO para quando ele sai da fila: é o servidor que manda o atraso
     real, e é ele quem mantém o contador honesto entre abas e recarregamentos. */
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/presenca", { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json() as { prompt?: boolean; prazo_seg?: number; no_escritorio_ip?: boolean };
        if (stopped) return;
        /* Celular só pergunta no WiFi do escritório: presença serve para saber
           quem está LÁ, e confirmar do sofá não prova nada. */
        const ehCelular = window.matchMedia?.("(max-width: 900px)").matches ?? false;
        const vale = !ehCelular || data.no_escritorio_ip === true;
        if (data.prompt && vale) {
          setSeconds(Math.round(data.prazo_seg ?? 60));
          setPrompt(true);
        } else if (!data.prompt) {
          setPrompt(false);
          jaDerrubou.current = false;
        }
      } catch { /* rede oscila; a próxima volta resolve */ }
    };
    void poll();
    const id = window.setInterval(poll, 20000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [accessToken]);

  /* Som ao ABRIR a pergunta. Sem isso o corretor de costas para a tela perde os
     60 segundos e cai da fila sem nunca ter visto o aviso. */
  useEffect(() => {
    if (!prompt) return;
    liberarAudio();
    tocarSom();
  }, [prompt]);

  /* Contagem que atravessa o zero. Ao cruzar, tira da fila uma única vez e
     continua contando o atraso. */
  useEffect(() => {
    if (!prompt) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        const proximo = s - 1;
        if (proximo <= 0 && !jaDerrubou.current) void sairDaFila();
        return proximo;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [prompt, sairDaFila]);

  if (!prompt) {
    /* Sem pergunta aberta, mas fora da fila (ex.: recarregou a página): a barra
       persistente garante que ele nunca fique fora sem saber. */
    if (!foraDaFila) return null;
    return <div className="presence-offline-bar" role="status">
      <span>⚠</span>
      <div><strong>Você saiu da distribuição de leads</strong><p>{actionError || "A confirmação de presença expirou. Sua conta continua conectada — só a fila de novos leads foi pausada."}</p></div>
      <button type="button" className="presence-yes" disabled={returning} onClick={() => void confirmar()}>{returning ? "Voltando…" : "Voltar a receber leads"}</button>
    </div>;
  }

  const atrasado = seconds < 0;
  const atraso = Math.abs(seconds);
  const relogio = `${atrasado ? "-" : ""}${Math.floor(atraso / 60)}:${String(atraso % 60).padStart(2, "0")}`;

  return <div className="presence-scrim" role="dialog" aria-modal="true" aria-label="Confirmação de presença">
    <div className={`presence-modal${atrasado ? " atrasado" : ""}`}>
      <div className="presence-ring"><strong>{relogio}</strong><span>{atrasado ? "fora da fila" : "min"}</span></div>
      <h2>{atrasado ? "Você está fora da fila" : "Você ainda está conectado?"}</h2>
      <p>{atrasado
        ? <>Você não confirmou a tempo e parou de receber leads novos há <b>{relogio.replace("-", "")}</b>. Sua conta continua conectada. Clique abaixo para voltar agora — não precisa esperar a próxima rodada.</>
        : <>Confirme sua presença para continuar recebendo leads. Se não confirmar, você sai da fila em <b>{relogio}</b> — sem perder o acesso ao sistema.</>}</p>
      {actionError && <p role="alert">{actionError}</p>}
      <button type="button" className="presence-yes" disabled={returning} onClick={() => void confirmar()}>
        {returning ? "Confirmando…" : atrasado ? "Voltar a receber leads" : "Sim, estou aqui"}
      </button>
    </div>
  </div>;
}
