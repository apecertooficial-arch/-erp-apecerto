"use client";

/* INTELIGÊNCIA — drawer compartilhado (peça 10 do artboard 30b, regras do 11b).
 *
 * Um componente só para os quatro drill-downs da área: imóvel, jornada do lead,
 * perfil do corretor e página do gerente. Regras que vieram do 11b, todas aqui e
 * não repetidas em cada tela:
 *
 *   · lateral direito, 420 px no desktop;
 *   · fecha no ✕, no Esc e no clique fora (scrim);
 *   · o estado vive na URL — link colado reabre o mesmo drawer;
 *   · os filtros da barra continuam intactos ao abrir e ao fechar;
 *   · foco entra no botão de fechar e VOLTA para quem abriu.
 *
 * No celular vira folha de baixo em tela quase cheia — 420 px fixos num aparelho
 * de 390 seria uma gaveta que não cabe.
 */

import { useEffect, useRef, useState } from "react";

import { gravarDrawerNaUrl, lerDrawerDaUrl } from "./filtros";

export type Alvo = string | null;

/* Valor guardado na URL: "tipo:parte:parte". A tela decide o que cada parte quer
   dizer; aqui só sabemos separar. */
export const partes = (alvo: Alvo): string[] => (alvo ? alvo.split(":") : []);

export function useDrawer() {
  const [alvo, setAlvo] = useState<Alvo>(() => lerDrawerDaUrl());
  useEffect(() => { gravarDrawerNaUrl(alvo); }, [alvo]);
  return { alvo, abrir: (valor: string) => setAlvo(valor), fechar: () => setAlvo(null) };
}

export function Drawer({
  titulo, codigo, apoio, selo, tomSelo, icone, cor, onFechar, children,
}: {
  titulo: string;
  codigo?: string;
  apoio?: string;
  selo?: string;
  tomSelo?: "bom" | "atencao" | "ruim" | "roxo";
  icone?: "radar" | "filtro" | "relogio" | "alerta" | "ok" | "pessoa" | "imovel";
  cor?: "laranja" | "roxo" | "verde" | "vermelho" | "ambar";
  onFechar: () => void;
  children: React.ReactNode;
}) {
  const fechar = useRef<HTMLButtonElement | null>(null);
  const anterior = useRef<Element | null>(null);

  useEffect(() => {
    anterior.current = document.activeElement;
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      /* Devolve o foco para a linha que abriu: quem navega por teclado não pode
         ser jogado no início da página ao fechar. */
      if (anterior.current instanceof HTMLElement) anterior.current.focus();
    };
  }, [onFechar]);

  return (
    <>
      <div className="ape-int-scrim" onClick={onFechar} aria-hidden="true" />
      <aside className="ape-int-drawer" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="ape-int-drawer-topo">
          <span className={`ape-int-tile grande ${cor ?? "laranja"}`} aria-hidden="true">
            <i className={`ape-int-ic ic-${icone ?? "radar"}`} />
          </span>
          <div className="ape-int-drawer-nome">
            <b>{titulo}</b>{codigo ? <small className="codigo">{codigo}</small> : null}
            {apoio ? <small>{apoio}</small> : null}
          </div>
          {selo ? <span className={`ape-int-chip ${tomSelo ?? "roxo"}`}>{selo}</span> : null}
          <button ref={fechar} type="button" className="ape-int-drawer-fecha" onClick={onFechar} aria-label="Fechar">
            <i className="ape-int-ic ic-x" aria-hidden="true" />
          </button>
        </header>
        <div className="ape-int-drawer-corpo">{children}</div>
      </aside>
    </>
  );
}

/* Três números no topo do drawer (6a). `null` mantém o quadro e mostra traço. */
export function DrawerNumeros({ itens }: { itens: Array<{ rotulo: string; valor: string | null }> }) {
  return (
    <div className="ape-int-drawer-numeros">
      {itens.map((i) => (
        <div key={i.rotulo}>
          <strong>{i.valor ?? "—"}</strong>
          <small>{i.rotulo}</small>
        </div>
      ))}
    </div>
  );
}

export function DrawerPar({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="ape-int-par">
      <span>{rotulo}</span>
      <b>{valor ?? "—"}</b>
    </div>
  );
}

/* Bloco que existe no desenho e ainda não tem fonte. Fica na tela, em âmbar, com
   o que falta conectar — esconder faria o drawer mentir por omissão. */
export function DrawerPendente({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="ape-int-pendencia">
      <b>{titulo}</b>
      <span>{texto}</span>
    </div>
  );
}

/* Cadeado do 11b: permissão barra o detalhe, o item continua visível e explicado. */
export function DrawerBloqueado({ texto }: { texto: string }) {
  return (
    <div className="ape-int-bloqueado">
      <i className="ape-int-ic ic-cadeado" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}
