"use client";

/* ESQUELETO NA FORMA DO CONTEÚDO — exigência dos artboards de estado.
 *
 * Carregar NÃO apaga a página. O cabeçalho, a navegação e a barra de filtros
 * continuam de pé; o que pulsa é apenas o bloco que ainda está chegando, e ele
 * pulsa NA FORMA do que vai aparecer: KPI com tile e duas linhas, tabela com
 * cabeçalho e linhas, funil com etapas, cartão de lista com pares.
 *
 * Regra que isto protege: o layout é sempre completo. Nem carregando, nem sem
 * dado, nem sem permissão o bloco desaparece.
 */

import "../../styles/inteligencia-esqueleto.css";

function Barra({ largura = "100%", altura = 12 }: { largura?: string; altura?: number }) {
  return <span className="intp-sk-barra" style={{ width: largura, height: altura }} />;
}

export function EsqueletoKpis({ colunas = 4, tile = true }: { colunas?: number; tile?: boolean }) {
  return (
    <div className="intp-grade" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: colunas }).map((_, i) => (
        <div className="intp-kpi intp-sk" key={i}>
          <div className="intp-kpi-topo">
            {tile ? <span className="intp-tile intp-sk-tile" /> : null}
            <Barra largura="58%" altura={10} />
          </div>
          <Barra largura="46%" altura={22} />
          <Barra largura="72%" altura={10} />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoTabela({ colunas = 6, linhas = 5 }: { colunas?: number; linhas?: number }) {
  return (
    <div className="intp-tabela-caixa intp-sk" aria-hidden="true">
      <div className="intp-sk-linha intp-sk-cabecalho" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {Array.from({ length: colunas }).map((_, i) => (
          <Barra key={i} largura={i === 0 ? "70%" : "48%"} altura={9} />
        ))}
      </div>
      {Array.from({ length: linhas }).map((_, l) => (
        <div className="intp-sk-linha" key={l} style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
          {Array.from({ length: colunas }).map((_, i) => (
            <Barra key={i} largura={i === 0 ? "86%" : "54%"} altura={11} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EsqueletoFunil({ etapas = 7 }: { etapas?: number }) {
  return (
    <div className="intp-funil intp-sk" aria-hidden="true">
      {Array.from({ length: etapas }).map((_, i) => (
        <div className="intp-etapa" key={i}>
          <Barra largura="84%" altura={11} />
          <span>
            <span className="intp-sk-barra intp-sk-etapa" style={{ width: `${Math.max(12, 100 - i * 13)}%` }} />
          </span>
          <Barra largura="70%" altura={11} />
          <Barra largura="60%" altura={11} />
          <Barra largura="50%" altura={10} />
          <span />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoCartoes({ colunas = 3, linhas = 4 }: { colunas?: number; linhas?: number }) {
  return (
    <div className="intp-grade" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: colunas }).map((_, c) => (
        <div className="intp-cartao intp-sk" key={c}>
          <Barra largura="52%" altura={12} />
          {Array.from({ length: linhas }).map((_, l) => (
            <div className="intp-sk-par" key={l}>
              <Barra largura="58%" altura={10} />
              <Barra largura="22%" altura={10} />
            </div>
          ))}
          <Barra largura="66%" altura={9} />
        </div>
      ))}
    </div>
  );
}

/* Aviso de acompanhamento do esqueleto. Fica fora do aria-hidden porque é a
   única parte que o leitor de tela precisa ouvir enquanto o bloco carrega. */
export function EsqueletoAviso({ texto = "Carregando este bloco. A página continua utilizável; o que está chegando aparece no lugar." }: { texto?: string }) {
  return (
    <p className="intp-sk-aviso" role="status" aria-live="polite">
      {texto}
    </p>
  );
}
