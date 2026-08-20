"use client";

/* Marca d'Água — tela de escolha. Dois caminhos bem grandes e diretos, sem
 * meio-termo visual: uma foto (rápido, unitário) ou várias fotos de uma vez
 * (lote, com nome de leva e download em .zip no final). Publico do ERP tem
 * pouca familiaridade com informática -- por isso a escolha vem antes de
 * qualquer campo ou upload, em vez de esconder o modo lote atrás de uma
 * opção avançada.
 */

import { useState } from "react";
import { WatermarkRemoverSingle } from "./WatermarkRemoverSingle";
import { WatermarkRemoverBatch } from "./WatermarkRemoverBatch";
import "../../styles/marca-dagua.css";

type Modo = "escolha" | "unica" | "lote";

export function WatermarkRemoverWorkspace() {
  const [modo, setModo] = useState<Modo>("escolha");

  if (modo === "unica") return <WatermarkRemoverSingle onVoltar={() => setModo("escolha")} />;
  if (modo === "lote") return <WatermarkRemoverBatch onVoltar={() => setModo("escolha")} />;

  return (
    <div className="wm-workspace">
      <header>
        <div>
          <span>FERRAMENTAS · FOTOS</span>
          <h1>Marca d&apos;Água</h1>
          <p>Escolha como você quer remover a marca d&apos;água ou logo das suas fotos.</p>
        </div>
      </header>

      <div className="wm-escolha">
        <button type="button" className="wm-escolha-card" onClick={() => setModo("unica")}>
          <span className="wm-escolha-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-5 4 4 3-3 4 4" />
            </svg>
          </span>
          <strong>Uma foto</strong>
          <span>Sobe uma foto, remove a marca e já baixa limpa. O jeito mais rápido pra um caso só.</span>
        </button>

        <button type="button" className="wm-escolha-card" onClick={() => setModo("lote")}>
          <span className="wm-escolha-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="7" width="14" height="14" rx="2" /><path d="M4 4h14v3M4 4v14h3" />
            </svg>
          </span>
          <strong>Várias fotos (lote)</strong>
          <span>Dá um nome pra leva, sobe várias fotos de uma vez e baixa tudo limpo junto, num arquivo só.</span>
        </button>
      </div>
    </div>
  );
}
