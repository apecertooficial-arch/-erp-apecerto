"use client";

/* INTELIGÊNCIA — barra global de filtros (artboards 11a e 1b).
 *
 * Uma barra só, no início do conteúdo, igual nas 16 páginas: a página esconde o
 * que não se aplica a ela em vez de desabilitar sem explicar.
 *
 * DUAS REGRAS DE COR, do design system: laranja é navegação (período, aba ativa),
 * roxo é seleção de dado (chip de filtro ativo). Nunca um encostado no outro.
 *
 * HONESTIDADE DO ESTADO: controle sem fonte no ERP não fica selecionável — abre e
 * explica o que falta conectar. E seleção que nenhuma tela consome ainda aparece
 * declarada no aviso roxo: guardar não é aplicar, e a barra não deixa parecer que é.
 */

import { useEffect, useRef, useState } from "react";

import {
  APLICAVEIS, CONSUMIDOS_PELAS_TELAS, CONTROLES, opcoesAbertas,
  type ChaveFiltro, type EstadoFiltros, type FonteOpcoes,
} from "./filtros";

type Periodo = { id: string; nome: string };

export function BarraFiltros({
  slug, periodo, periodos, onPeriodo, estado, fontes, atualizado,
}: {
  slug: string;
  periodo: string;
  periodos: readonly Periodo[];
  onPeriodo: (p: string) => void;
  estado: EstadoFiltros;
  fontes?: FonteOpcoes;
  atualizado?: string;
}) {
  const [aberto, setAberto] = useState<ChaveFiltro | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);

  /* Fecha no clique fora e no Esc — mesmo par de gestos do drawer, para a área
     inteira responder igual. */
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(null);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(null); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const daPagina = APLICAVEIS[slug] ?? [];
  const controles = CONTROLES.filter((c) => daPagina.includes(c.chave));
  const guardados = estado.ativos.filter((a) => !CONSUMIDOS_PELAS_TELAS.includes(a.chave));

  return (
    <section className="ape-int-barra" aria-label="Filtros da área Inteligência">
      <div className="ape-int-barra-linha">
        <span className="ape-int-tile laranja" aria-hidden="true"><i className="ape-int-ic ic-filtro" /></span>

        <div className="ape-int-periodos" role="group" aria-label="Período">
          {periodos.map((p) => (
            <button
              key={p.id} type="button"
              className={periodo === p.id ? "ativo" : ""}
              aria-pressed={periodo === p.id}
              onClick={() => onPeriodo(p.id)}
            >{p.nome}</button>
          ))}
        </div>

        <div className="ape-int-controles" ref={caixa}>
          {controles.map((c) => {
            const opcoes = c.origem === "vocabulario" ? (c.opcoes ?? []) : opcoesAbertas(c.chave, fontes);
            const valor = estado.filtros[c.chave];
            const estaAberto = aberto === c.chave;
            return (
              <div className="ape-int-controle" key={c.chave}>
                <button
                  type="button"
                  className={valor ? "ape-int-filtro escolhido" : "ape-int-filtro"}
                  aria-expanded={estaAberto}
                  onClick={() => setAberto(estaAberto ? null : c.chave)}
                >
                  {c.rotulo}{valor ? `: ${valor}` : ""}
                </button>
                {estaAberto && (
                  <div className="ape-int-menu" role="listbox">
                    {c.origem === "pendente" && <p className="ape-int-menu-nota">{c.pendencia}</p>}
                    {c.origem !== "pendente" && !opcoes.length && (
                      <p className="ape-int-menu-nota">
                        Nenhuma opção nesta leitura. A lista vem do dado agregado do período — sem dado, sem opção inventada.
                      </p>
                    )}
                    {opcoes.map((o) => (
                      <button
                        key={o} type="button" role="option" aria-selected={valor === o}
                        className={valor === o ? "escolhido" : ""}
                        onClick={() => { estado.definir(c.chave, valor === o ? null : o); setAberto(null); }}
                      >{o}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {atualizado && (
          <span className="ape-int-procedencia">
            <i className="ape-int-ic ic-relogio" aria-hidden="true" />
            Atualizado {atualizado} · America/Sao_Paulo
          </span>
        )}
      </div>

      {estado.ativos.length > 0 ? (
        <div className="ape-int-chips">
          <span className="ape-int-contador">{estado.ativos.length} filtro{estado.ativos.length > 1 ? "s" : ""} ativo{estado.ativos.length > 1 ? "s" : ""}</span>
          {estado.ativos.map((a) => (
            <button
              key={a.chave} type="button" className="ape-int-chip-ativo"
              onClick={() => estado.definir(a.chave, null)}
              aria-label={`Remover filtro ${a.rotulo}: ${a.valor}`}
            >
              {a.valor}<i className="ape-int-ic ic-x" aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="ape-int-limpar" onClick={estado.limpar}>
            <i className="ape-int-ic ic-voltar" aria-hidden="true" />Limpar filtros
          </button>
        </div>
      ) : (
        <p className="ape-int-sem-filtro">Nenhum filtro ativo — a leitura é do período inteiro. O período não é limpo pelo “Limpar filtros”.</p>
      )}

      {guardados.length > 0 && (
        <div className="ape-int-aviso">
          <b>Seleção guardada, ainda não aplicada aos números.</b>{" "}
          {guardados.map((g) => g.rotulo).join(" · ")} {guardados.length > 1 ? "vivem" : "vive"} na URL e sobrevive{guardados.length > 1 ? "m" : ""} à troca de página,
          mas as telas desta área ainda leem o período como único corte. Guardar não é aplicar — quando cada grupo de telas passar a consumir o filtro, este aviso desaparece sozinho.
        </div>
      )}
    </section>
  );
}
