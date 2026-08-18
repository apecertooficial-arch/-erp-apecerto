"use client";

/* CASCA DA INTELIGÊNCIA — navegação idêntica ao protótipo aprovado.
 *
 * Primeiro nível: o SEGMENTADO “Site e marketing / Performance”, do mesmo jeito
 * que nos artboards — duas metades dentro de uma única cápsula, não quatro
 * pílulas soltas. Segundo nível: a fileira de pílulas da família ativa (8 no site
 * e marketing, 9 na performance). Uma barra de filtros comum às 17.
 *
 * Trocar de família ou de página não limpa filtro: o recorte é da área.
 *
 * O Copiloto (32a) fica entre a barra de filtros e o conteúdo, nas 17 páginas.
 * O briefing (32f) aparece na Visão CEO.
 */

import { useMemo, useState } from "react";
import "../../styles/inteligencia.css";
import { grupos, periodos, primeiraDoGrupo, telaPorChave, telas, telasDoGrupo, type GrupoChave } from "./telas";
import { BlocoSemDado, RodapeFontes } from "./dado";
import { telasPublicadas } from "./registro";
import { Copiloto, type PerfilCopiloto } from "./Copiloto";
import { useErpSession } from "../system/ErpSession";

export type Recorte = {
  periodo: string;
  compararAnterior: boolean;
  chips: string[];
  filtrar: (chip: string) => void;
  irPara: (chave: string) => void;
};

export type PropsTela = { accessToken: string; recorte: Recorte };

export function CascaInteligencia({ accessToken }: { accessToken: string }) {
  const [grupo, setGrupo] = useState<GrupoChave>("performance");
  const [chave, setChave] = useState<string>(primeiraDoGrupo("performance"));
  const [periodo, setPeriodo] = useState<string>("30 dias");
  const [comparar, setComparar] = useState(true);
  const [chips, setChips] = useState<string[]>([]);
  const { role, isManager } = useErpSession();

  const perfilCopiloto: PerfilCopiloto = role === "admin" ? "CEO" : role === "gestor" || isManager ? "Gerente" : "Corretor";

  const tela = telaPorChave(chave) ?? telas[0];
  const daFamilia = telasDoGrupo(grupo);

  const recorte: Recorte = useMemo(
    () => ({
      periodo,
      compararAnterior: comparar,
      chips,
      filtrar: (chip: string) => setChips((atuais) => (atuais.includes(chip) ? atuais : [...atuais, chip])),
      irPara: (destino: string) => {
        const alvo = telaPorChave(destino);
        if (!alvo) return;
        setGrupo(alvo.grupo);
        setChave(alvo.chave);
      },
    }),
    [periodo, comparar, chips],
  );

  const Publicada = telasPublicadas[tela.chave];
  const familia = grupos.find((g) => g.chave === grupo);

  return (
    <div className="int-area">
      <header className="int-topo">
        <div>
          <span className="int-eyebrow">INTELIGÊNCIA DIGITAL{grupo === "performance" ? " · PERFORMANCE" : ""}</span>
          <h1>{tela.titulo}</h1>
          <p>{tela.sub}</p>
        </div>
        <div className="int-topo-acoes">
          <span className="int-selo-pend">DEMONSTRAÇÃO — valores ausentes aparecem como “—”</span>
          <button type="button" className="int-btn">Exportar · CSV / PDF</button>
        </div>
      </header>

      {/* PRIMEIRO NÍVEL — segmentado de duas metades, como no protótipo. */}
      <div className="int-nivel1">
        <span className="int-segmentado" role="tablist" aria-label="Famílias da Inteligência">
          {grupos.map((g) => (
            <button
              key={g.chave}
              type="button"
              role="tab"
              aria-selected={g.chave === grupo}
              title={g.publico}
              className={g.chave === grupo ? "ativo" : ""}
              onClick={() => {
                setGrupo(g.chave);
                setChave(primeiraDoGrupo(g.chave));
              }}
            >
              {g.rotulo}
            </button>
          ))}
        </span>
        <span className="int-divisor" />
        <span className="int-familia-nota">{familia?.publico}</span>
      </div>

      {/* SEGUNDO NÍVEL — as páginas da família ativa. */}
      <div className="int-paginas" role="tablist" aria-label="Páginas da família">
        {daFamilia.map((t) => (
          <button
            key={t.chave}
            type="button"
            role="tab"
            aria-selected={t.chave === chave}
            className={`int-pagina${t.chave === chave ? " ativo" : ""}`}
            onClick={() => setChave(t.chave)}
          >
            {t.rotulo}
            {t.badge ? <small className="int-pagina-badge">{t.badge}</small> : null}
          </button>
        ))}
      </div>

      <div className="int-filtros">
        <div className="int-filtros-linha">
          <span className="int-periodo">
            {periodos.map((p) => (
              <button key={p} type="button" className={p === periodo ? "ativo" : ""} onClick={() => setPeriodo(p)}>
                {p}
              </button>
            ))}
          </span>
          <button type="button" className={`int-chip-filtro${comparar ? " ligado" : ""}`} onClick={() => setComparar((v) => !v)}>
            vs. período anterior
          </button>
          <span className="int-divisor" />
          {tela.filtros.map((f) => (
            <button key={f} type="button" className="int-chip-filtro" onClick={() => recorte.filtrar(`${f}: todos`)}>
              {f}
            </button>
          ))}
          {chips.map((c) => (
            <button key={c} type="button" className="int-chip-ativo" onClick={() => setChips((atuais) => atuais.filter((x) => x !== c))}>
              {c} ✕
            </button>
          ))}
        </div>
        <div className="int-filtros-rodape">
          <span className={chips.length ? "int-contagem-ativa" : ""}>
            {chips.length ? `${chips.length} ${chips.length === 1 ? "filtro ativo" : "filtros ativos"} ·` : "nenhum filtro ativo ·"}
          </span>
          <button type="button" className="int-link" onClick={() => setChips([])}>
            Limpar filtros
          </button>
          <span className="int-filtros-nota">o recorte é da área: trocar de família ou de página não limpa filtro</span>
        </div>
      </div>

      <Copiloto tela={tela.chave} recorte={recorte} perfil={perfilCopiloto} briefing={tela.chave === "empresa"} />

      {Publicada ? (
        Publicada({ accessToken, recorte })
      ) : (
        <section className="int-secao">
          <BlocoSemDado titulo={`${tela.titulo} em publicação`} detalhe={`A página abre e mantém o recorte (${periodo}). O conteúdo do artboard ${tela.ref} sobe no lote seguinte.`} />
          <RodapeFontes fontes={[]} pendencias={[`artboard ${tela.ref} em publicação`]} />
        </section>
      )}
    </div>
  );
}
