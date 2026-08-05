"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";
import { liberarAudio, tocarSom } from "../lib/somAviso";

type Aviso = { id: number; titulo: string; corpo: string; url: string };
type Item = {
  id: number; tipo: string; titulo: string; detalhe: string | null;
  prioridade: number; deep_link: string | null; vista: boolean;
};

/* AVISO DE LEAD NA TELA — POR CONSULTA, NAO POR PUSH.
 *
 * O push depende de tres coisas fora do nosso alcance: a inscricao estar viva,
 * o servico da Apple/Google entregar, e o sistema operacional deixar aparecer.
 * Falhou nas tres hoje: 22 notificacoes na bandeja do Chrome e nenhuma na tela,
 * porque o macOS silencia por aplicativo ACIMA da permissao do site.
 *
 * A pergunta de presenca sempre funcionou -- inclusive com som, no celular --
 * justamente porque NAO usa push: ela pergunta ao servidor a cada 20s. Este
 * componente faz igual. Com o ApeCerto aberto, o aviso chega e toca, em
 * qualquer aparelho, sem depender de configuracao de ninguem.
 *
 * O push continua valendo para quando o aplicativo esta FECHADO. */
export function AvisoNaTela() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const vistos = useRef<Set<number> | null>(null);

  const fechar = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));
  }, []);

  const mostrar = useCallback((item: Item) => {
    const aviso: Aviso = {
      id: item.id,
      titulo: item.titulo || "Novo aviso",
      corpo: item.detalhe || "",
      url: item.deep_link && item.deep_link.startsWith("/") ? item.deep_link : "/notificacoes",
    };
    tocarSom();
    /* No maximo 3 na tela: dez de uma vez viram parede e o corretor perde
       justamente o mais recente. */
    setAvisos((atuais) => [aviso, ...atuais.filter((a) => a.id !== aviso.id)].slice(0, 3));
    window.setTimeout(() => fechar(aviso.id), 9000);
  }, [fechar]);

  useEffect(() => {
    const destravar = () => liberarAudio();
    window.addEventListener("pointerdown", destravar);
    window.addEventListener("keydown", destravar);
    window.addEventListener("focus", destravar);

    let parado = false;
    const consultar = async () => {
      try {
        const { data } = await getBrowserSupabaseClient().rpc("ncrm_notificacoes");
        if (parado || !data) return;
        const itens = ((data as { itens?: Item[] }).itens ?? [])
          .filter((i) => i.prioridade === 1 && !i.vista);

        /* Primeira volta so fotografa o que ja existia: quem abre o app com
           dez avisos velhos nao pode levar dez alarmes na cara. */
        if (vistos.current === null) {
          vistos.current = new Set(itens.map((i) => i.id));
          return;
        }
        for (const item of itens) {
          if (vistos.current.has(item.id)) continue;
          vistos.current.add(item.id);
          mostrar(item);
        }
      } catch { /* rede oscila; a proxima volta resolve */ }
    };

    void consultar();
    const id = window.setInterval(consultar, 20000);

    /* Push continua util com o app fechado; se chegar com a aba aberta,
       aproveitamos para consultar na hora em vez de esperar os 20s. */
    const aoReceberPush = (e: MessageEvent) => {
      const d = e.data as { tipo?: string } | null;
      if (d && d.tipo === "aviso-apecerto") void consultar();
    };
    navigator.serviceWorker?.addEventListener("message", aoReceberPush);

    return () => {
      parado = true;
      window.clearInterval(id);
      window.removeEventListener("pointerdown", destravar);
      window.removeEventListener("keydown", destravar);
      window.removeEventListener("focus", destravar);
      navigator.serviceWorker?.removeEventListener("message", aoReceberPush);
    };
  }, [mostrar]);

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
