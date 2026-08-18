"use client";

/* CASCA DA INTELIGÊNCIA — arquitetura aprovada no print 23a.
 *
 * Uma entrada no menu, quatro grupos no primeiro nível, as páginas do grupo no
 * segundo, e UMA barra de filtros comum às 17 telas. Trocar de grupo não limpa
 * filtro: o recorte é da área, não da página.
 *
 * A casca não decide conteúdo. Cada tela é registrada em registro.tsx e recebe o
 * recorte atual. Enquanto uma tela não estiver publicada, a casca mostra o
 * cabeçalho real dela e um bloco honesto de pendência — nunca uma tela em
 * branco, nunca um item de menu que não abre nada (contrato de dado ausente, em
 * dado.tsx).
 */

import { useMemo, useState, type ReactNode } from "react";
import "../../styles/inteligencia.css";
import { grupos, periodos, primeiraDoGrupo, telaPorChave, telas, telasDoGrupo, type GrupoChave } from "./telas";
import { BlocoSemDado, RodapeFontes } from "./dado";
import { telasPublicadas } from "./registro";

export type Recorte = {
  periodo: string;
  compararAnterior: boolean;
  chips: string[];
  /** Adiciona um chip de recorte (vindo de um clique em série, linha ou etapa). */
  filtrar: (chip: string) => void;
  /** Navega para outra tela da área, mantendo o recorte. */
  irPara: (chave: string) => void;
};

export type PropsTela = { accessToken: string; recorte: Recorte };

function Icone({ grupo }: { grupo: GrupoChave }) {
  const c = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (grupo === "empresa") return <svg {...c}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
  if (grupo === "operacao") return <svg {...c}><path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87" /><circle cx="12" cy="8" r="3" /><path d="M4 21v-1a3 3 0 0 1 3-3M20 21v-1a3 3 0 0 0-3-3" /></svg>;
  if (grupo === "digital") return <svg {...c}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>;
  return <svg {...c}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

export function CascaInteligencia({ accessToken }: { accessToken: string }) {
  const [grupo, setGrupo] = useState<GrupoChave>("empresa");
  const [chave, setChave] = useState<string>(primeiraDoGrupo("empresa"));
  const [periodo, setPeriodo] = useState<string>("30 dias");
  const [comparar, setComparar] = useState(true);
  const [chips, setChips] = useState<string[]>([]);

  const tela = telaPorChave(chave) ?? telas[0];
  const doGrupo = telasDoGrupo(grupo);

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

  return (
    <div className="int-area">
      <header className="int-topo">
        <div>
          <span className="int-eyebrow">INTELIGÊNCIA · {grupos.find((g) => g.chave === grupo)?.rotulo.toUpperCase()}</span>
          <h1>{tela.titulo}</h1>
          <p>{tela.sub}</p>
        </div>
        <div className="int-topo-acoes">
          <span className="int-selo-pend">DADO EM CONEXÃO — valores ausentes aparecem como “—”</span>
          <button type="button" className="int-btn">Exportar · CSV / PDF</button>
        </div>
      </header>

      <nav className="int-grupos" aria-label="Grupos da Inteligência">
        {grupos.map((g) => (
          <button
            key={g.chave}
            type="button"
            className={`int-grupo${g.chave === grupo ? " ativo" : ""}`}
            aria-current={g.chave === grupo ? "true" : undefined}
            title={g.publico}
            onClick={() => {
              setGrupo(g.chave);
              setChave(primeiraDoGrupo(g.chave));
            }}
          >
            <Icone grupo={g.chave} />
            {g.rotulo}
          </button>
        ))}
      </nav>

      <div className="int-paginas" role="tablist" aria-label="Páginas do grupo">
        {doGrupo.map((t) => (
          <button
            key={t.chave}
            type="button"
            role="tab"
            aria-selected={t.chave === chave}
            className={`int-pagina${t.chave === chave ? " ativo" : ""}`}
            onClick={() => setChave(t.chave)}
          >
            {t.rotulo}
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
          <span className="int-filtros-nota">o recorte é da área: trocar de grupo ou de página não limpa filtro</span>
        </div>
      </div>

      {Publicada ? (
        Publicada({ accessToken, recorte })
      ) : (
        <section className="int-secao">
          <BlocoSemDado
            titulo={`${tela.titulo} entra no próximo lote de publicação`}
            detalhe={`A página existe, abre e mantém o recorte (${periodo}${chips.length ? ` · ${chips.length} filtro(s)` : ""}). O conteúdo aprovado no artboard ${tela.ref} sobe no lote seguinte — nenhuma tela desta área fica em branco nem desaparece do menu enquanto isso.`}
          />
          <RodapeFontes fontes={[]} pendencias={[`conteúdo do artboard ${tela.ref} em publicação`]} />
        </section>
      )}
    </div>
  );
}
