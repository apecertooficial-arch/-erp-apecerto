"use client";

/* CASCA DA INTELIGÊNCIA — cabeçalho, navegação e filtros como no protótipo.
 *
 * Primeiro nível: segmentado “Site e marketing / Performance”. Segundo nível: as
 * páginas da família ativa. Uma barra de filtros comum às 17, cujo recorte é da
 * área — trocar de família ou de página não limpa filtro.
 *
 * Correções desta rodada, vindas da comparação lado a lado com os artboards:
 *   · cada dimensão de filtro é um DROPDOWN (chevron), não uma pílula chapada;
 *   · filtro ativo virou chip roxo com ✕ e rótulo completo;
 *   · a barra ficou em uma faixa só, com a contagem e a nota de interação à direita;
 *   · o selo do topo declara a carga: “Atualizado 14:32 · dados até 14:15”, e “Ao
 *     vivo” nas telas de fila, que atualizam em tempo real.
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

/* Telas de fila mostram “Ao vivo”; as de análise, a carga fechada. */
const aoVivo = new Set(["atendimento", "alertas"]);
const conectadoAoBanco = new Set(["empresa"]);

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
  /* Dimensão com chip ativo aparece marcada no próprio dropdown. */
  const dimensaoAtiva = (f: string) => chips.some((c) => c.startsWith(`${f}:`));

  return (
    <div className="int-area">
      <header className="int-topo">
        <div>
          <span className="int-eyebrow">INTELIGÊNCIA DIGITAL · {familia?.rotulo.toUpperCase()}</span>
          <h1>{tela.titulo}</h1>
          <p>{tela.sub}</p>
        </div>
        <div className="int-topo-acoes">
          <span className={conectadoAoBanco.has(tela.chave) ? "int-selo-vivo" : "int-selo-pend"}>
            {conectadoAoBanco.has(tela.chave) ? "DADOS REAIS — site, CRM e financeiro" : "DEMONSTRAÇÃO — números ilustrativos"}
          </span>
          <span className="int-selo-vivo">
            <i />
            {conectadoAoBanco.has(tela.chave)
              ? "Atualização sob demanda"
              : aoVivo.has(tela.chave)
                ? "Ao vivo · atualizado 14:32"
                : "Atualizado 14:32 · dados até 14:15"}
          </span>
          <button type="button" className="int-btn">Exportar · CSV / PDF</button>
        </div>
      </header>

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
        <span className="int-familia-nota">{familia?.publico}</span>
      </div>

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
          <button type="button" className={`int-drop${comparar ? " ligado" : ""}`} onClick={() => setComparar((v) => !v)}>
            vs. período anterior
          </button>
          {tela.filtros.map((f) => (
            <button
              key={f}
              type="button"
              className={`int-drop${dimensaoAtiva(f) ? " ligado" : ""}`}
              onClick={() => recorte.filtrar(`${f}: todos`)}
            >
              {f}
            </button>
          ))}
          {chips.map((c) => (
            <button key={c} type="button" className="int-chip-ativo" onClick={() => setChips((atuais) => atuais.filter((x) => x !== c))} title={`Remover ${c}`}>
              {c}
              <span aria-hidden="true">✕</span>
            </button>
          ))}
          <span className="int-filtros-nota">clicar em uma série, barra ou linha da tabela filtra o resto da página</span>
        </div>
        <div className="int-filtros-rodape">
          <span className={chips.length ? "int-contagem-ativa" : ""}>
            {chips.length ? `${chips.length} ${chips.length === 1 ? "filtro ativo" : "filtros ativos"}` : "nenhum filtro ativo"}
          </span>
          {chips.length ? (
            <button type="button" className="int-link" onClick={() => setChips([])}>
              Limpar filtros
            </button>
          ) : null}
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
