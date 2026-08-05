"use client";

import { useCallback, useEffect, useState } from "react";
import { liberarAudio, tocarSom } from "../lib/somAviso";

type Aviso = { id: number; titulo: string; corpo: string; url: string; urgente: boolean };

/* AVISO DENTRO DA TELA.
 *
 * A notificacao do sistema depende de o sistema operacional deixar passar --
 * macOS e Windows silenciam por aplicativo, acima da permissao do site, e foi
 * exatamente isso que segurou os avisos aqui. Se o corretor esta com o ApeCerto
 * aberto, o aviso tem de aparecer NA TELA, em qualquer modulo, sem depender de
 * ninguem ter configurado nada.
 *
 * Some sozinho em 8s. Clicar leva para o lead. */
export function AvisoNaTela() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const fechar = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const destravar = () => liberarAudio();
    window.addEventListener("pointerdown", destravar);
    window.addEventListener("keydown", destravar);

    const aoReceber = (evento: MessageEvent) => {
      const d = evento.data as { tipo?: string; titulo?: string; corpo?: string; url?: string; urgente?: boolean } | null;
      if (!d || d.tipo !== "aviso-apecerto") return;
      const aviso: Aviso = {
        id: Date.now() + Math.random(),
        titulo: typeof d.titulo === "string" && d.titulo ? d.titulo : "Novo aviso",
        corpo: typeof d.corpo === "string" ? d.corpo : "",
        url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/notificacoes",
        urgente: d.urgente !== false,
      };
      tocarSom();
      /* No maximo 3 na tela: chegando dez de uma vez, empilhar todos vira parede
         e o corretor perde justamente o mais recente. */
      setAvisos((atuais) => [aviso, ...atuais].slice(0, 3));
      window.setTimeout(() => fechar(aviso.id), 8000);
    };
    navigator.serviceWorker?.addEventListener("message", aoReceber);

    return () => {
      window.removeEventListener("pointerdown", destravar);
      window.removeEventListener("keydown", destravar);
      navigator.serviceWorker?.removeEventListener("message", aoReceber);
    };
  }, [fechar]);

  if (avisos.length === 0) return null;

  return (
    <div className="aviso-tela-pilha" role="status" aria-live="polite">
      {avisos.map((a) => (
        <button key={a.id} type="button" className="aviso-tela"
                onClick={() => { fechar(a.id); window.location.href = a.url; }}>
          <span className="aviso-tela-ico" aria-hidden="true">🔔</span>
          <span className="aviso-tela-txt">
            <strong>{a.titulo}</strong>
            {a.corpo && <small>{a.corpo}</small>}
          </span>
          <span className="aviso-tela-x" aria-hidden="true"
                onClick={(e) => { e.stopPropagation(); fechar(a.id); }}>×</span>
        </button>
      ))}
    </div>
  );
}
