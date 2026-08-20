"use client";

/* CASCA DA INTELIGÊNCIA — cabeçalho, navegação e filtros como no protótipo.
 *
 * Primeiro nível: segmentado “Site e marketing / Performance”. Segundo nível: as
 * páginas da família ativa. Uma barra de filtros comum às 17, cujo recorte é da
 * área — trocar de família ou de página não limpa filtro.
 *
 * O selo do topo agora depende do estado de conexão da tela (estado-conexao):
 * tela real não mostra selo; parcial mostra “DADOS PARCIAIS”. */

import { useMemo, useState } from "react";
import "../../styles/inteligencia.css";
import { grupos, periodos, primeiraDoGrupo, telaPorChave, telas, telasDoGrupo, type GrupoChave } from "./telas";
import { BlocoSemDado, RodapeFontes } from "./dado";
import { telasPublicadas } from "./registro";
import { estadoConexaoDe } from "./estado-conexao";
import { opcoesReaisPorTela } from "./filtros";

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

export function CascaInteligencia({ accessToken }: { accessToken: string }) {
  const [grupo, setGrupo] = useState<GrupoChave>("performance");
  const [chave, setChave] = useState<string>(primeiraDoGrupo("performance"));
  const [periodo, setPeriodo] = useState<string>("30 dias");
  const [chips, setChips] = useState<string[]>([]);

  const tela = telaPorChave(chave) ?? telas[0];
  const daFamilia = telasDoGrupo(grupo);

  const recorte: Recorte = useMemo(
    () => ({
      periodo,
      compararAnterior: false,
      chips,
      filtrar: (chip: string) => setChips((atuais) => (atuais.includes(chip) ? atuais : [...atuais, chip])),
      irPara: (destino: string) => {
        const alvo = telaPorChave(destino);
        if (!alvo) return;
        setGrupo(alvo.grupo);
        setChave(alvo.chave);
      },
    }),
    [periodo, chips],
  );

  const Publicada = telasPublicadas[tela.chave];
  const familia = grupos.find((g) => g.chave === grupo);
  const conexao = estadoConexaoDe(tela.chave);
  const filtrosDisponiveis = tela.filtros.filter((f) => Boolean(opcoesReaisPorTela[tela.chave]?.[f]));
  /* Dimensão com chip ativo aparece marcada no próprio dropdown. */
  const dimensaoAtiva = (f: string) => chips.some((c) => c.startsWith(`${f}:`));
  const selecionarDimensao = (dimensao: string, valor: string) => {
    setChips((atuais) => {
      const semDimensao = atuais.filter((chip) => !chip.startsWith(`${dimensao}:`));
      return valor === "__todos__" ? semDimensao : [...semDimensao, `${dimensao}: ${valor}`];
    });
  };

  return (
    <div className="int-area">
      <header className="int-topo">
        <div>
          <span className="int-eyebrow">CENTRAL DE INTELIGÊNCIA · {familia?.rotulo.toUpperCase()}</span>
          <h1>{tela.titulo}</h1>
          <p>{tela.sub}</p>
        </div>
        <div className="int-topo-acoes">
          {conexao === "parcial" ? <span className="int-selo-pend">DADOS PARCIAIS — parte em conexão</span> : null}
          <span className="int-selo-vivo">
            <i />
            {aoVivo.has(tela.chave) ? "Situação atual" : "Dados reais"}
          </span>
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
          {filtrosDisponiveis.map((f) => {
            const opcoes = opcoesReaisPorTela[tela.chave]?.[f];
            return (
              <label
                key={f}
                className={`int-drop-select${dimensaoAtiva(f) ? " ligado" : ""}`}
                title={opcoes ? `Filtrar por ${f.toLowerCase()}` : `${f}: valores ainda sem fonte ligada nesta tela`}
              >
                <select
                  aria-label={`Filtrar por ${f}`}
                  value=""
                  onChange={(event) => selecionarDimensao(f, event.target.value)}
                >
                  <option value="" disabled>{f}</option>
                  {opcoes ? (
                    <>
                      <option value="__todos__">Todos</option>
                      {opcoes.map((opcao) => <option key={opcao.parametro} value={opcao.rotulo}>{opcao.rotulo}</option>)}
                    </>
                  ) : null}
                </select>
              </label>
            );
          })}
          {chips.map((c) => (
            <button key={c} type="button" className="int-chip-ativo" onClick={() => setChips((atuais) => atuais.filter((x) => x !== c))} title={`Remover ${c}`}>
              {c}
              <span aria-hidden="true">✕</span>
            </button>
          ))}
          <span className="int-filtros-nota">cada indicador informa se representa período, ano ou situação atual</span>
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
          <span className="int-filtros-nota">só aparecem filtros efetivamente ligados à fonte desta tela</span>
        </div>
      </div>

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
