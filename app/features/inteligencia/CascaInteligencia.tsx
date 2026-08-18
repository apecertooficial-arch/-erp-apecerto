"use client";

/* Casca comum das telas da área: título, selo de procedência do dado, barra global
 * de filtros, os grupos e as abas do grupo.
 *
 * Os quatro grupos são os aprovados no canvas (23a): Empresa · Operação comercial
 * · Mercado e digital · Governança. Cada item é um <a href> real — rota de
 * verdade, sem estado escondido, para o navegador voltar e recarregar como
 * qualquer tela. Cada href leva a query atual: é assim que o filtro sobrevive à
 * troca de página (11a).
 *
 * LAYOUT SEMPRE COMPLETO (regra do Romulo): nenhuma seção e nenhum cartão some
 * por falta de dado. Métrica sem dado mostra o rótulo normal e um traço "—" no
 * lugar do número, com "aguardando conexão" pequeno embaixo quando o furo é de
 * integração. Esconder cartão faz a tela mentir por omissão.
 */

import { Children, cloneElement, isValidElement, useMemo, useState, type ReactElement, type ReactNode } from "react";

import { BarraFiltros } from "./BarraFiltros";
import { PERIODOS, horaSp, type Periodo } from "./dados";
import { queryAtual, useFiltros, type FonteOpcoes } from "./filtros";

export type Grupo = "empresa" | "operacao" | "digital" | "governanca";

export const GRUPOS: Array<{ id: Grupo; nome: string }> = [
  { id: "empresa", nome: "Empresa" },
  { id: "operacao", nome: "Operação comercial" },
  { id: "digital", nome: "Mercado e digital" },
  { id: "governanca", nome: "Governança" },
];

export const TELAS: Array<{ slug: string; nome: string; grupo: Grupo }> = [
  { slug: "", nome: "Visão da empresa", grupo: "empresa" },
  { slug: "vendas", nome: "Vendas e previsão", grupo: "empresa" },
  { slug: "financeiro", nome: "Financeiro e comissões", grupo: "empresa" },
  { slug: "proprietarios", nome: "Captação de proprietários", grupo: "empresa" },
  { slug: "atendimento", nome: "Atendimento e SLA", grupo: "operacao" },
  { slug: "equipe", nome: "Performance da equipe", grupo: "operacao" },
  { slug: "gerentes", nome: "Gerentes", grupo: "operacao" },
  { slug: "corretores", nome: "Corretores", grupo: "operacao" },
  { slug: "conversao", nome: "Conversão e CRM", grupo: "operacao" },
  { slug: "qualidade", nome: "Qualidade e desenvolvimento", grupo: "operacao" },
  { slug: "aquisicao", nome: "Aquisição e campanhas", grupo: "digital" },
  { slug: "comportamento", nome: "Comportamento e conteúdo", grupo: "digital" },
  { slug: "imoveis", nome: "Imóveis e procura", grupo: "digital" },
  { slug: "sara", nome: "Sara", grupo: "digital" },
  { slug: "alertas", nome: "Central de alertas", grupo: "governanca" },
  { slug: "privacidade", nome: "Privacidade e tracking", grupo: "governanca" },
];

const caminho = (slug: string) => (slug ? `/inteligencia/${slug}` : "/inteligencia");

export function CascaInteligencia({
  slug, titulo, apoio, grupo, periodo, onPeriodo, confirmados, atualizadoEm, fontes, children,
}: {
  slug: string; titulo: string; apoio: string; grupo: Grupo;
  periodo: Periodo; onPeriodo: (p: Periodo) => void;
  confirmados: number; atualizadoEm?: string;
  fontes?: FonteOpcoes;
  children: React.ReactNode;
}) {
  const grupoAtual = GRUPOS.find((g) => g.id === grupo);
  const filtros = useFiltros(periodo);
  /* A query é lida no render para que cada aba já nasça com os filtros atuais. */
  const query = queryAtual();

  return (
    <main className="ape-int-wrap">
      <header className="ape-int-topo">
        <span className="ape-int-tile roxo" aria-hidden="true"><i className="ape-int-ic ic-radar" /></span>
        <div>
          <span>INTELIGÊNCIA · {(grupoAtual?.nome ?? "").toUpperCase()}</span>
          <h1>{titulo}</h1>
          <p>{apoio}</p>
        </div>
        <div className="ape-int-selos">
          {confirmados > 0
            ? <span className="ape-int-selo"><i />DADO REAL · {horaSp(atualizadoEm)}</span>
            : <span className="ape-int-selo aguardando"><i />aguardando dado</span>}
        </div>
      </header>

      <nav className="ape-int-grupos" aria-label="Grupos da área Inteligência">
        {GRUPOS.map((g) => {
          const primeira = TELAS.find((t) => t.grupo === g.id);
          return (
            <a key={g.id} href={`${caminho(primeira?.slug ?? "")}${query}`} className={g.id === grupo ? "ativo" : ""}>{g.nome}</a>
          );
        })}
      </nav>

      <nav className="ape-int-abas" aria-label="Telas do grupo">
        {TELAS.filter((t) => t.grupo === grupo).map((t) => (
          <a key={t.slug || "visao"} href={`${caminho(t.slug)}${query}`} className={t.slug === slug ? "ativo" : ""}>{t.nome}</a>
        ))}
      </nav>

      <BarraFiltros
        slug={slug}
        periodo={periodo}
        periodos={PERIODOS}
        onPeriodo={(p) => onPeriodo(p as Periodo)}
        estado={filtros}
        fontes={fontes}
        atualizado={horaSp(atualizadoEm)}
      />

      {children}
    </main>
  );
}

/* Cartão de indicador. `valor === null` NÃO esconde nada: mostra o rótulo e um
   traço. `aguardando` troca a nota de baixo pelo aviso de integração pendente. */
export function Kpi({
  rotulo, valor, nota, tom, aguardando,
}: { rotulo: string; valor: string | null; nota: string; tom?: "bom" | "alerta"; aguardando?: boolean }) {
  const vazio = valor === null;
  return (
    <article className={vazio ? "ape-int-kpi vazio" : `ape-int-kpi${tom ? ` ${tom}` : ""}`}>
      <span>{rotulo}</span>
      <strong>{vazio ? "—" : valor}</strong>
      <small>{vazio && aguardando ? "aguardando conexão" : nota}</small>
    </article>
  );
}

/* Tile de ícone do 30b (peça 03): 34px, raio 10, tint da cor + ícone por máscara
   CSS — mesmo mecanismo do menu lateral, sem dependência nova no pacote. */
export function Tile({ icone, cor }: { icone: "radar" | "filtro" | "relogio" | "alerta" | "ok"; cor?: "laranja" | "roxo" | "verde" | "vermelho" | "ambar" }) {
  return (
    <span className={`ape-int-tile ${cor ?? "laranja"}`} aria-hidden="true">
      <i className={`ape-int-ic ic-${icone}`} />
    </span>
  );
}

/* Esqueleto na forma do conteúdo real (30b, peça 13): grade de KPI, linhas de
   funil ou tabela. Três barras genéricas para tudo prometem a tela errada. */
export function Esqueleto({ forma }: { forma: "kpis" | "linhas" | "tabela" }) {
  if (forma === "kpis") {
    return (
      <div className="ape-int-kpis" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div className="ape-int-esq-kpi" key={i}><i style={{ width: "58%" }} /><i className="alto" /><i style={{ width: "40%" }} /></div>
        ))}
      </div>
    );
  }
  if (forma === "tabela") {
    return (
      <div className="ape-int-esq-tabela" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="ape-int-esq-linha" key={i}><i style={{ width: "26%" }} /><i style={{ width: "14%" }} /><i style={{ width: "14%" }} /><i style={{ width: "10%" }} /></div>
        ))}
      </div>
    );
  }
  return (
    <div className="ape-int-esq-linhas" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="ape-int-esq-funil" key={i}><i style={{ width: "22%" }} /><i className="barra" style={{ width: `${72 - i * 12}%` }} /><i style={{ width: "9%" }} /></div>
      ))}
    </div>
  );
}

export function Estados({
  estado, temDado, onTentar, forma,
}: { estado: "carregando" | "pronto" | "falhou"; temDado: boolean; onTentar: () => void; forma?: "kpis" | "linhas" | "tabela" }) {
  return (
    <>
      {estado === "falhou" && (
        <div className="ape-int-erro" role="alert">
          <div>
            <b>Não foi possível confirmar os dados agora.</b>{" "}
            <span>{temDado ? "A última consulta válida continua visível." : "Nenhum número foi exibido sem confirmação."}</span>
          </div>
          <button type="button" onClick={onTentar}>Tentar novamente</button>
        </div>
      )}
      {estado === "carregando" && !temDado && <Esqueleto forma={forma ?? "kpis"} />}
    </>
  );
}

export function Pendencias({ lista }: { lista: Array<{ chave: string; texto: string }> }) {
  if (!lista.length) return null;
  return (
    <section className="ape-int-secao">
      <span>O QUE AINDA NÃO ESTÁ LIGADO</span>
      <h2>Aguardando conexão</h2>
      <div className="ape-int-pendencias">
        {lista.map((p) => (
          <article className="ape-int-pendencia" key={p.chave}>
            <b>{p.chave}</b>
            <span>{p.texto}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Vazio({ titulo, apoio }: { titulo: string; apoio: string }) {
  return <div className="ape-int-vazio"><b>{titulo}</b><span>{apoio}</span></div>;
}

/* Linha de lista com traço quando o número não existe — a linha continua na tela. */
export function Linha({
  nome, valor, extra, roxa, largura,
}: { nome: string; valor: string | null; extra?: string | null; roxa?: boolean; largura?: number }) {
  return (
    <div className="ape-int-linha">
      <span>{nome}</span>
      <span className={roxa ? "ape-int-barra roxa" : "ape-int-barra"}><i style={{ width: `${Math.max(0, Math.min(100, largura ?? 0))}%` }} /></span>
      <b>{valor ?? "—"}</b>
      <em>{extra ?? "—"}</em>
    </div>
  );
}

type OrdemTabela = { coluna: number; direcao: "ascending" | "descending" } | null;

function textoDaCelula(no: ReactNode): string {
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDaCelula).join(" ");
  if (isValidElement(no)) return textoDaCelula((no.props as { children?: ReactNode }).children);
  return "";
}

function numeroDaCelula(texto: string): number | null {
  const limpo = texto.trim().toLowerCase();
  if (!limpo || limpo === "—" || limpo.includes("sem amostra") || limpo.includes("aguardando")) return null;
  const tempo = limpo.match(/(-?\d+(?:[.,]\d+)?)\s*(min|h|d)/);
  if (tempo) {
    const valor = Number(tempo[1].replace(",", "."));
    return tempo[2] === "d" ? valor * 1440 : tempo[2] === "h" ? valor * 60 : valor;
  }
  const moeda = limpo.replace(/r\$\s*/g, "").replace(/\./g, "").replace(",", ".");
  const achou = moeda.match(/-?\d+(?:\.\d+)?/);
  return achou ? Number(achou[0]) : null;
}

function compararCelulas(a: ReactNode, b: ReactNode): number {
  const textoA = textoDaCelula(a);
  const textoB = textoDaCelula(b);
  const numeroA = numeroDaCelula(textoA);
  const numeroB = numeroDaCelula(textoB);
  if (numeroA !== null && numeroB !== null) return numeroA - numeroB;
  if (numeroA !== null) return -1;
  if (numeroB !== null) return 1;
  return textoA.localeCompare(textoB, "pt-BR", { numeric: true, sensitivity: "base" });
}

function celulasDaLinha(linha: ReactElement<{ children?: ReactNode }>): ReactElement<{ children?: ReactNode }>[] {
  return Children.toArray(linha.props.children).filter(isValidElement) as ReactElement<{ children?: ReactNode }>[];
}

export function Tabela({
  colunas, ordenaveis = [], children,
}: { colunas: string[]; ordenaveis?: number[]; children: React.ReactNode }) {
  const [ordem, setOrdem] = useState<OrdemTabela>(null);
  const linhas = useMemo(
    () => Children.toArray(children).filter(isValidElement) as ReactElement<{ children?: ReactNode }>[],
    [children],
  );
  const linhasOrdenadas = useMemo(() => {
    if (!ordem) return linhas;
    return [...linhas].sort((a, b) => {
      const celulasA = celulasDaLinha(a);
      const celulasB = celulasDaLinha(b);
      const resultado = compararCelulas(celulasA[ordem.coluna]?.props.children, celulasB[ordem.coluna]?.props.children);
      return ordem.direcao === "ascending" ? resultado : -resultado;
    });
  }, [linhas, ordem]);

  const alternar = (coluna: number) => setOrdem((atual) => (
    atual?.coluna === coluna
      ? { coluna, direcao: atual.direcao === "ascending" ? "descending" : "ascending" }
      : { coluna, direcao: "ascending" }
  ));

  return (
    <div className="ape-int-tabela-wrap">
      <table className="ape-int-tabela">
        <thead>
          <tr>{colunas.map((coluna, indice) => {
            const podeOrdenar = ordenaveis.includes(indice);
            const ativa = ordem?.coluna === indice;
            return (
              <th key={coluna} aria-sort={ativa ? ordem.direcao : undefined}>
                {podeOrdenar ? (
                  <button type="button" className="ape-int-ordenar" onClick={() => alternar(indice)}>
                    {coluna}<i aria-hidden="true" className={ativa ? ordem.direcao : "neutra"} />
                  </button>
                ) : coluna}
              </th>
            );
          })}</tr>
        </thead>
        <tbody>{linhasOrdenadas.map((linha, indiceLinha) => cloneElement(
          linha,
          { key: linha.key ?? `linha-${indiceLinha}` },
          celulasDaLinha(linha).map((celula, indiceCelula) => cloneElement(celula, {
            key: celula.key ?? `${indiceLinha}-${indiceCelula}`,
            "data-label": colunas[indiceCelula] ?? "Dado",
          } as Record<string, unknown>)),
        ))}</tbody>
      </table>
    </div>
  );
}
