"use client";

import { useSyncExternalStore } from "react";
import { SONS, assinarPreferencia, escolherSom, escolherSomLead, escolherVolume, liberarAudio,
         preferenciaAtual, preferenciaPadrao, tocarSom, type NomeSom } from "../lib/somAviso";

/* ESCOLHA DO SOM DE AVISO.
   Toca na hora ao selecionar: som se escolhe ouvindo, nao lendo o nome.
   A preferencia fica no proprio aparelho (localStorage) -- quem usa celular e
   computador pode querer um em cada, e nao ha por que sincronizar.

   Le com useSyncExternalStore, nao com efeito + setState: o localStorage e uma
   fonte externa, e setState em efeito dispara render em cascata (o lint barra). */
export function EscolherSom() {
  const pref = useSyncExternalStore(assinarPreferencia, preferenciaAtual, preferenciaPadrao);
  const { som: atual, somLead, volume: vol } = pref;

  const selecionar = (id: NomeSom) => { liberarAudio(); escolherSom(id); tocarSom(id, vol); };
  const selecionarLead = (id: NomeSom) => { liberarAudio(); escolherSomLead(id); tocarSom(id, vol); };

  /* Duas listas do mesmo conjunto: o que muda é qual preferência cada uma
     grava. Escrever o item duas vezes seria a mesma marcação divergindo na
     próxima mudança — por isso vira função. */
  const lista = (escolhido: NomeSom, aoEscolher: (id: NomeSom) => void) => (
    <div className="som-aviso-lista">
      {SONS.map((s) => (
        <button key={s.id} type="button"
                className={`som-aviso-item${escolhido === s.id ? " som-aviso-item-ativo" : ""}`}
                onClick={() => aoEscolher(s.id)}>
          <span className="som-aviso-play" aria-hidden="true">▶</span>
          <span className="som-aviso-txt">
            <strong>{s.nome}</strong>
            <small>{s.descricao}</small>
          </span>
          {escolhido === s.id && <span className="som-aviso-check" aria-label="Escolhido">✓</span>}
        </button>
      ))}
    </div>
  );

  return (
    <section className="som-aviso">
      <h3>Som do aviso</h3>
      <p className="som-aviso-ajuda">
        Toca com o aplicativo aberto — a aba pode estar atrás de outras janelas.
        Clique para ouvir. <b>Lead novo tem som próprio</b>, para você reconhecer
        sem olhar a tela.
      </p>

      <h4 className="som-aviso-grupo">Lead novo</h4>
      {lista(somLead, selecionarLead)}

      <h4 className="som-aviso-grupo">Demais avisos</h4>
      <p className="som-aviso-ajuda">Ação vencida, retorno programado, cliente que respondeu.</p>
      {lista(atual, selecionar)}

      <label className="som-aviso-volume">
        Volume
        <input type="range" min={0.2} max={1} step={0.05} value={vol}
               onChange={(e) => escolherVolume(Number(e.target.value))}
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
