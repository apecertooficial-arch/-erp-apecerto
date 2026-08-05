"use client";

import { useEffect } from "react";
import { liberarAudio, tocarSom } from "../lib/somAviso";

/* TOCA O SOM DO APÊCERTO QUANDO CHEGA AVISO.
 *
 * Push nao deixa escolher som (a API do navegador so tem silent: true/false).
 * A saida: o service worker recebe o push e manda um recado para as abas
 * abertas; aqui a aba toca o som proprio. Basta a ABA existir -- pode estar
 * atras de outras janelas -- e por isso funciona para quem deixa o CRM aberto.
 *
 * O navegador exige um gesto do usuario antes de liberar audio automatico.
 * Prendemos o primeiro clique/tecla da sessao so para destravar o contexto. */
export function SomDeAviso() {
  useEffect(() => {
    const destravar = () => liberarAudio();
    window.addEventListener("pointerdown", destravar, { once: true });
    window.addEventListener("keydown", destravar, { once: true });

    const aoReceber = (evento: MessageEvent) => {
      const dado = evento.data as { tipo?: string } | null;
      if (dado && dado.tipo === "aviso-apecerto") tocarSom();
    };
    navigator.serviceWorker?.addEventListener("message", aoReceber);

    return () => {
      window.removeEventListener("pointerdown", destravar);
      window.removeEventListener("keydown", destravar);
      navigator.serviceWorker?.removeEventListener("message", aoReceber);
    };
  }, []);

  return null;
}
