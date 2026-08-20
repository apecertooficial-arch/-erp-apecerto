"use client";

import { useState } from "react";
import "../../styles/inteligencia.css";
import "../../styles/inteligencia-nivel1.css";
import "../../styles/inteligencia-blocos.css";
import { grupos, periodos, type GrupoChave } from "./telas";
import { VisaoDigital } from "./telas/VisaoDigital";
import { VisaoEmpresa } from "./telas/VisaoEmpresa";

export type Recorte = { periodo: string };
export type PropsTela = { accessToken: string; recorte: Recorte };

export function CascaInteligencia({ accessToken }: { accessToken: string }) {
  const [grupo, setGrupo] = useState<GrupoChave>("performance");
  const [periodo, setPeriodo] = useState("30 dias");
  const atual = grupos.find((item) => item.chave === grupo) ?? grupos[1];

  return (
    <div className="int-area int-decisao">
      <header className="int-topo">
        <div>
          <span className="int-eyebrow">CENTRAL DE INTELIGÊNCIA</span>
          <h1>{atual.titulo}</h1>
          <p>{atual.sub}</p>
        </div>
        <span className="int-selo-vivo"><i /> Atualização em tempo real</span>
      </header>

      <div className="int-comando">
        <span className="int-segmentado int-areas" role="tablist" aria-label="Áreas da Inteligência">
          {grupos.map((item) => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={item.chave === grupo}
              className={item.chave === grupo ? "ativo" : ""}
              onClick={() => setGrupo(item.chave)}
            >
              {item.rotulo}
            </button>
          ))}
        </span>
        <div className="int-recorte">
          <span>PERÍODO</span>
          <span className="int-periodo" aria-label="Período analisado">
            {periodos.map((item) => (
              <button key={item} type="button" className={item === periodo ? "ativo" : ""} onClick={() => setPeriodo(item)}>
                {item}
              </button>
            ))}
          </span>
        </div>
      </div>

      {grupo === "site"
        ? <VisaoDigital accessToken={accessToken} recorte={{ periodo }} />
        : <VisaoEmpresa accessToken={accessToken} recorte={{ periodo }} />}
    </div>
  );
}
