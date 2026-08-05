"use client";

import { useEffect, useState } from "react";
import { SONS, escolherSom, escolherVolume, liberarAudio, somEscolhido,
         tocarSom, volumeEscolhido, type NomeSom } from "../lib/somAviso";

/* ESCOLHA DO SOM DE AVISO.
   Toca na hora ao selecionar: som se escolhe ouvindo, nao lendo o nome.
   A preferencia fica no proprio aparelho (localStorage) -- o corretor que usa
   celular e computador pode querer um em cada, e nao ha por que sincronizar. */
export function EscolherSom() {
  const [atual, setAtual] = useState<NomeSom>("sino");
  const [vol, setVol] = useState(0.9);
  const [pronto, setPronto] = useState(false);

  useEffect(() => { setAtual(somEscolhido()); setVol(volumeEscolhido()); setPronto(true); }, []);
  if (!pronto) return null;

  const selecionar = (id: NomeSom) => {
    liberarAudio(); escolherSom(id); setAtual(id); tocarSom(id, vol);
  };

  return (
    <section className="som-aviso">
      <h3>Som do aviso</h3>
      <p className="som-aviso-ajuda">
        Toca quando chega lead novo ou ação em atraso, com o aplicativo aberto —
        a aba pode estar atrás de outras janelas. Clique para ouvir.
      </p>

      <div className="som-aviso-lista">
        {SONS.map((s) => (
          <button key={s.id} type="button"
                  className={`som-aviso-item${atual === s.id ? " som-aviso-item-ativo" : ""}`}
                  onClick={() => selecionar(s.id)}>
            <span className="som-aviso-play" aria-hidden="true">▶</span>
            <span className="som-aviso-txt">
              <strong>{s.nome}</strong>
              <small>{s.descricao}</small>
            </span>
            {atual === s.id && <span className="som-aviso-check" aria-label="Escolhido">✓</span>}
          </button>
        ))}
      </div>

      <label className="som-aviso-volume">
        Volume
        <input type="range" min={0.2} max={1} step={0.05} value={vol}
               onChange={(e) => { const v = Number(e.target.value); setVol(v); escolherVolume(v); }}
               onMouseUp={() => tocarSom(atual, vol)}
               onTouchEnd={() => tocarSom(atual, vol)} />
        <b>{Math.round(vol * 100)}%</b>
      </label>

      <p className="som-aviso-nota">
        Com o aplicativo <b>fechado</b>, o aparelho toca o som padrão dele — o navegador
        não permite escolher o som de uma notificação de push. Este som vale para
        quem fica com o ApêCerto aberto.
      </p>
    </section>
  );
}
