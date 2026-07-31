"use client";

/* Convite para instalar o ERP na tela de inicio.
 *
 * Os dois sistemas fazem isso de formas diferentes, e o codigo nao finge que
 * sao iguais:
 *
 * Android/Chrome dispara 'beforeinstallprompt'. So AI existe botao -- guardamos
 * o evento e chamamos prompt() no clique da pessoa. Se o navegador nunca
 * disparar (criterio nao atendido, ja instalado, navegador sem suporte), nao
 * aparece botao nenhum. Nao ha como forcar, e prometer instalacao que nao
 * acontece e pior do que nao oferecer.
 *
 * iOS/Safari nao tem esse evento e nao permite instalacao por script. O unico
 * caminho e a pessoa usar Compartilhar > Adicionar a Tela de Inicio. Entao ali
 * mostramos INSTRUCAO, nao botao.
 *
 * Ja instalado (display-mode: standalone) nao mostra nada.
 */

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CHAVE_DISPENSADO = "apecerto-instalar-dispensado";

function ehIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS moderno se anuncia como Mac; a diferenca e ter toque.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function jaInstalado() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function ConviteInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [dispensado, setDispensado] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem(CHAVE_DISPENSADO) === "1" || jaInstalado(); } catch { return false; }
  });

  useEffect(() => {
    const aoPoder = (e: Event) => {
      e.preventDefault(); // sem isso o Chrome mostra a barra dele na hora que quiser
      setEvento(e as EventoInstalar);
    };
    const aoInstalar = () => { setEvento(null); setDispensado(true); };
    window.addEventListener("beforeinstallprompt", aoPoder);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoder);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  const dispensar = () => {
    setDispensado(true);
    try { localStorage.setItem(CHAVE_DISPENSADO, "1"); } catch { /* modo privado */ }
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    // Quem decide e a pessoa, no dialogo do sistema. So limpamos o evento:
    // ele so pode ser usado uma vez.
    setEvento(null);
  };

  if (dispensado) return null;

  const ios = ehIOS();
  if (!evento && !ios) return null; // nada a oferecer neste navegador

  return (
    <div className="convite-instalar">
      <div>
        <strong>Deixe o ApêCerto na tela de início</strong>
        {ios ? (
          <p>
            No iPhone, toque em <b>Compartilhar</b> na barra do Safari e escolha{" "}
            <b>Adicionar à Tela de Início</b>.
          </p>
        ) : (
          <p>Abre direto, em tela cheia, sem passar pelo navegador.</p>
        )}
      </div>
      <div className="convite-instalar-acoes">
        {evento && <button type="button" className="convite-instalar-ok" onClick={() => void instalar()}>Instalar</button>}
        <button type="button" className="convite-instalar-nao" onClick={dispensar}>Agora não</button>
      </div>
    </div>
  );
}
