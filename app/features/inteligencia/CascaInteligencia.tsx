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

import { Children, isValidElement, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

import { BarraFiltros } from "./BarraFiltros";
import { CopilotoInteligencia } from "./CopilotoInteligencia";
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

/* Navegação aprovada no arquivo mais recente do Design. A área digital é uma
 * leitura contínua: não existe uma tela intermediária de "grupos" entre o
 * clique do menu e o assunto escolhido. As telas executivas adicionais seguem
 * publicadas em suas rotas, mas não alteram esta sequência principal. */
export const ABAS_INTELIGENCIA_DIGITAL = [
  { slug: "", nome: "Visão executiva" },
  { slug: "aquisicao", nome: "Aquisição" },
  { slug: "comportamento", nome: "Comportamento" },
  { slug: "imoveis", nome: "Imóveis" },
  { slug: "conversao", nome: "Conversão e CRM" },
  { slug: "proprietarios", nome: "Proprietários" },
  { slug: "sara", nome: "Sara" },
  { slug: "privacidade", nome: "Privacidade e tracking" },
] as const;

const caminho = (slug: string) => (slug ? `/inteligencia/${slug}` : "/inteligencia");

export function CascaInteligencia({
  slug, titulo, apoio, grupo, periodo, onPeriodo, confirmados, atualizadoEm, fontes, accessToken, children,
}: {
  slug: string; titulo: string; apoio: string; grupo: Grupo;
  periodo: Periodo; onPeriodo: (p: Periodo) => void;
  confirmados: number; atualizadoEm?: string;
  accessToken: string;
  fontes?: FonteOpcoes;
  children: React.ReactNode;
}) {
  const filtros = useFiltros(periodo);
  /* A query é lida no render para que cada aba já nasça com os filtros atuais. */
  const query = queryAtual();

  return (
    <main className="ape-int-wrap" data-grupo={grupo}>
      <header className="ape-int-topo">
        <span className="ape-int-tile roxo" aria-hidden="true"><i className="ape-int-ic ic-radar" /></span>
        <div>
          <span>INTELIGÊNCIA DIGITAL</span>
          <h1>{titulo}</h1>
          <p>{apoio}</p>
        </div>
        <div className="ape-int-selos">
          {confirmados > 0
            ? <span className="ape-int-selo"><i />DADO REAL · {horaSp(atualizadoEm)}</span>
            : <span className="ape-int-selo aguardando"><i />aguardando dado</span>}
        </div>
      </header>

      <nav className="ape-int-abas ape-int-abas-principais" aria-label="Telas da Inteligência Digital">
        {ABAS_INTELIGENCIA_DIGITAL.map((t) => (
          <a key={t.slug || "visao"} href={`${caminho(t.slug)}${query}`} className={t.slug === slug ? "ativo" : ""} aria-current={t.slug === slug ? "page" : undefined}>{t.nome}</a>
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
      <CopilotoInteligencia accessToken={accessToken} titulo={titulo} atualizadoEm={atualizadoEm} />
    </main>
  );
}

/* Cartão de indicador. `valor === null` NÃO esconde nada: mostra o rótulo e um
   traço. `aguardando` troca a nota de baixo pelo aviso de integração pendente. */
export function Kpi({
  rotulo, valor, nota, tom, aguardando, definicao, comparacao, confianca, origem,
}: {
  rotulo: string; valor: string | null; nota: string; tom?: "bom" | "alerta"; aguardando?: boolean;
  definicao?: string;
  comparacao?: { valor: string; rotulo: string; direcao?: "subiu" | "caiu" | "neutra" } | null;
  confianca?: "alta" | "parcial" | "pendente";
  origem?: string;
}) {
  const vazio = valor === null;
  const nivel = confianca ?? (vazio ? "pendente" : "alta");
  return (
    <article className={vazio ? "ape-int-kpi vazio" : `ape-int-kpi${tom ? ` ${tom}` : ""}`}>
      <header className="ape-int-kpi-topo">
        <span>{rotulo}</span>
        <button
          type="button" className="ape-int-kpi-ajuda"
          aria-label={`Definição de ${rotulo}: ${definicao ?? nota}`}
          data-tooltip={definicao ?? nota}
        >?</button>
      </header>
      <strong>{vazio ? "—" : valor}</strong>
      <small>{vazio && aguardando ? "aguardando conexão" : nota}</small>
      <div className="ape-int-kpi-meta">
        {comparacao ? (
          <span className={`ape-int-comparacao ${comparacao.direcao ?? "neutra"}`}>
            <i aria-hidden="true" />{comparacao.valor}<small>{comparacao.rotulo}</small>
          </span>
        ) : <span className="ape-int-comparacao indisponivel">sem base comparável</span>}
        <span className={`ape-int-confianca ${nivel}`}>
          <i aria-hidden="true" />{nivel === "alta" ? "confirmado" : nivel === "parcial" ? "cobertura parcial" : "pendente"}
        </span>
      </div>
      {origem && <small className="ape-int-kpi-origem">Fonte: {origem}</small>}
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

/* ---------------------------------------------------------------------------
   TABELA — peças 09 e 14 do 30b.

   Duas coisas que faltavam nas oito tabelas da área, resolvidas aqui uma vez:

   1. ORDENAÇÃO SÓ ONDE A COMPARAÇÃO EXISTE. O cabeçalho vira botão apenas nas
      colunas cujos valores este componente consegue comparar de verdade. A
      leitura é feita do conteúdo já formatado (pt-BR: "1.234", "12,5%",
      "R$ 4.200"), e a coluna é recusada quando:
        • tem menos de dois valores comparáveis (só traços — nada a ordenar);
        • mistura número e texto na mesma coluna;
        • mistura UNIDADE na mesma coluna — o caso real de "45 min" ao lado de
          "1,2 h", em que ordenar pelo número cru mentiria (1,2 < 45).
      Cabeçalho que não ordena continua texto puro, sem botão morto e sem
      aria-sort. Promessa de ordenação que não cumpre é pior do que a ausência.

   2. CARTÃO ABAIXO DE 900px. Nenhuma tabela da área espreme ou rola de lado no
      celular: cada linha vira cartão branco raio 16, com o RÓTULO DA COLUNA ao
      lado de cada valor — os rótulos vêm daqui para o CSS em variáveis --c1..--c9,
      então nenhuma tela precisou repetir texto no markup. A linha clicável segue
      clicável como cartão (mouse, Enter e Espaço vindos de quem a montou), com
      chevron e alvo de 44px.

   Ordenar reordena os próprios elementos de linha recebidos como children: as
   props de cada <tr> (onClick, tabIndex, className, key) vêm intactas, e por isso
   os drawers de Imóveis e Corretores continuam funcionando sem saber que existe
   ordenação.
   --------------------------------------------------------------------------- */

const VAZIOS = new Set(["", "—", "-", "–", "n/d", "sem dado", "sem registro", "sem amostra", "nunca", "aguardando conexão"]);

function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === "boolean") return "";
  if (typeof no === "string") return no;
  if (typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map((filho) => textoDe(filho as ReactNode)).join(" ");
  if (isValidElement(no)) return textoDe((no.props as { children?: ReactNode }).children);
  return "";
}

/* Valor e unidade de uma célula já formatada em pt-BR. */
function medida(cru: string): { valor: number | null; unidade: string } {
  const txt = cru.replace(/\s+/g, " ").trim();
  if (!txt || VAZIOS.has(txt.toLowerCase())) return { valor: null, unidade: "" };
  const casado = txt.match(/-?\d[\d.,]*/);
  if (!casado) return { valor: null, unidade: "" };
  let bruto = casado[0];
  if (bruto.includes(".") && bruto.includes(",")) bruto = bruto.replace(/\./g, "").replace(",", ".");
  else if (bruto.includes(",")) bruto = bruto.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(bruto)) bruto = bruto.replace(/\./g, "");
  const valor = Number(bruto);
  const unidade = (txt.match(/[%$a-zA-Zà-úÀ-Úº°]+/g) ?? []).join("").toLowerCase();
  return { valor: Number.isFinite(valor) ? valor : null, unidade };
}

type Ordem = { coluna: number; dir: "asc" | "desc" };

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  const [ordem, setOrdem] = useState<Ordem | null>(null);

  const linhas = useMemo(
    () => Children.toArray(children).filter((no): no is ReactElement => isValidElement(no)),
    [children],
  );

  /* Texto de cada célula, por linha e por coluna. */
  const celulas = useMemo(
    () => linhas.map((linha) =>
      Children.toArray((linha.props as { children?: ReactNode }).children)
        .filter((no): no is ReactElement => isValidElement(no))
        .map((celula) => textoDe((celula.props as { children?: ReactNode }).children)),
    ),
    [linhas],
  );

  /* Uma coluna só vira botão quando a comparação é legítima. */
  const perfis = useMemo(() => colunas.map((_, i) => {
    const textos = celulas.map((linha) => (linha[i] ?? "").trim()).filter((t) => t && !VAZIOS.has(t.toLowerCase()));
    const medidas = textos.map(medida);
    const numeros = medidas.filter((m) => m.valor !== null);
    const unidades = new Set(numeros.map((m) => m.unidade));
    if (numeros.length >= 2 && numeros.length === textos.length && unidades.size <= 1) {
      return { ordenavel: true, numerica: true };
    }
    if (numeros.length === 0 && textos.length >= 2) return { ordenavel: true, numerica: false };
    return { ordenavel: false, numerica: false };
  }), [colunas, celulas]);

  const ordenadas = useMemo(() => {
    if (!ordem || !perfis[ordem.coluna]?.ordenavel) return linhas;
    const numerica = perfis[ordem.coluna].numerica;
    const fator = ordem.dir === "asc" ? 1 : -1;
    const chave = (indice: number): number | string | null => {
      const txt = (celulas[indice]?.[ordem.coluna] ?? "").trim();
      if (!txt || VAZIOS.has(txt.toLowerCase())) return null;
      return numerica ? medida(txt).valor : txt;
    };
    return linhas
      .map((linha, indice) => ({ linha, chave: chave(indice) }))
      .sort((a, b) => {
        /* Linha sem valor comparável fica no fim nas duas direções: ela não é
           "o menor", ela é desconhecida. */
        if (a.chave === null && b.chave === null) return 0;
        if (a.chave === null) return 1;
        if (b.chave === null) return -1;
        if (typeof a.chave === "number" && typeof b.chave === "number") return (a.chave - b.chave) * fator;
        return String(a.chave).localeCompare(String(b.chave), "pt-BR") * fator;
      })
      .map((item) => item.linha);
  }, [linhas, celulas, perfis, ordem]);

  const alternar = (coluna: number) => {
    setOrdem((atual) =>
      atual && atual.coluna === coluna
        ? { coluna, dir: atual.dir === "asc" ? "desc" : "asc" }
        : { coluna, dir: perfis[coluna]?.numerica ? "desc" : "asc" },
    );
  };

  /* Rótulos entregues ao CSS para o modo cartão (peça 14): --c1..--c9. */
  const rotulos = Object.fromEntries(
    colunas.slice(0, 9).map((rotulo, i) => [`--c${i + 1}`, JSON.stringify(rotulo)]),
  ) as unknown as CSSProperties;

  return (
    <div className="ape-int-tabela-wrap" style={rotulos}>
      <table className="ape-int-tabela">
        <thead>
          <tr>
            {colunas.map((c, i) => {
              const perfil = perfis[i];
              const ativa = ordem?.coluna === i;
              if (!perfil?.ordenavel) return <th key={c} scope="col">{c}</th>;
              return (
                <th key={c} scope="col" aria-sort={ativa ? (ordem.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className={ativa ? `ape-int-ord ${ordem.dir}` : "ape-int-ord"}
                    onClick={() => alternar(i)}
                  >
                    {c}
                    <i aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{ordenadas}</tbody>
      </table>
    </div>
  );
}
