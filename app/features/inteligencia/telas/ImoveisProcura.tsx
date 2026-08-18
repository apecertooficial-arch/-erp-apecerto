"use client";

/* 4 · IMÓVEIS E PROCURA — artboard 6a, com o DRAWER AO LADO da tabela.
 *
 * Estrutura do desenho:
 *   1. indicadores da procura (4 KPIs)
 *   2. TABELA PRINCIPAL “cada imóvel, do acesso à visita” com as 16 colunas do
 *      artboard (Fav., Lead→visita, Resp. incluídas), “Escolher colunas” e
 *      “Ordenar: leads”; a linha aberta fica destacada
 *   3. faixa 1,5fr / 1fr: LEITURAS COMPLEMENTARES à esquerda (muito acesso pouca
 *      intenção · com intenção sem atendimento · bairros e faixas · venda vs.
 *      locação · filtros de busca mais usados · buscas sem resultado · demanda sem
 *      estoque) e o DRAWER DO IMÓVEL à direita, ao lado da tabela e não abaixo,
 *      com “Mais eficientes em gerar lead” embaixo dele
 *   4. rodapé de fontes
 *
 * Busca sem resultado vira alvo de captação: procura sem estoque é dado, não
 * desperdício. Imóvel sem código entra como “não identificado” e fica fora do
 * ranking — o evento não é descartado nem redistribuído. Origem por imóvel e
 * próxima visita nascem “—” quando a atribuição do recorte não responde.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, TRACO } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, Tabela, type Celula, type Kpi } from "../pecas";

type Imovel = {
  nome: string;
  codigo: string;
  bairro: string;
  finalidade: string;
  preco: number | null;
  visualizacoes: number | null;
  galeria: number | null;
  favoritos: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  visitas: number | null;
  imovelLead: number | null;
  leadVisita: number | null;
  dias: number | null;
  resp: string;
  respNome: string;
  status: "ativo" | "pausado";
  atencao?: boolean;
  origens: string | null;
  proximaVisita: string | null;
};

type Dados = {
  anunciados: number | null;
  semCodigo: number | null;
  buscasSemResultado: number | null;
  melhorConversao: number | null;
  imoveis: Imovel[];
  bairros: { l: string; pct: number | null; largura: number }[];
  faixasNota: string;
  finalidades: { nome: string; vis: number | null; leads: number | null; negocios: number | null; imovelLead: number | null; melhor?: boolean }[];
  filtros: { l: string; r: string }[];
  semResultado: { l: string; r: string }[];
  eficientes: { l: string; r: string; bom?: boolean }[];
  atualizado: string;
};

type Coluna = { chave: string; titulo: string; num?: boolean };

/* As 16 colunas do artboard, na ordem do desenho. */
const COLUNAS: Coluna[] = [
  { chave: "imovel", titulo: "Imóvel" },
  { chave: "bairro", titulo: "Bairro" },
  { chave: "finalidade", titulo: "Finalidade" },
  { chave: "preco", titulo: "Preço", num: true },
  { chave: "vis", titulo: "Vis.", num: true },
  { chave: "galeria", titulo: "Galeria", num: true },
  { chave: "fav", titulo: "Fav.", num: true },
  { chave: "intencao", titulo: "Intenção", num: true },
  { chave: "leads", titulo: "Leads", num: true },
  { chave: "negocios", titulo: "Negócios", num: true },
  { chave: "visitas", titulo: "Visitas", num: true },
  { chave: "imovelLead", titulo: "Imóvel→lead", num: true },
  { chave: "leadVisita", titulo: "Lead→visita", num: true },
  { chave: "dias", titulo: "Dias", num: true },
  { chave: "resp", titulo: "Resp." },
  { chave: "status", titulo: "Status" },
];

/* Preço cheio, como no artboard: R$ 890.000 · R$ 5.200/mês. */
function preco(i: Imovel): string {
  if (i.preco === null) return TRACO;
  const v = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(i.preco);
  return i.finalidade === "Locação" ? `${v}/mês` : v;
}

function celula(i: Imovel, c: Coluna): Celula {
  switch (c.chave) {
    case "imovel":
      return { texto: i.nome, forte: true, sub: i.atencao ? `${i.codigo} · atenção` : i.codigo };
    case "bairro":
      return { texto: i.bairro };
    case "finalidade":
      return { texto: i.finalidade };
    case "preco":
      return { texto: preco(i), num: true };
    case "vis":
      return { texto: fmt.inteiro(i.visualizacoes), num: true };
    case "galeria":
      return { texto: fmt.inteiro(i.galeria), num: true, forte: (i.galeria ?? 999) < 300, cor: (i.galeria ?? 999) < 300 ? "#B5700A" : undefined };
    case "fav":
      return { texto: fmt.inteiro(i.favoritos), num: true };
    case "intencao":
      return { texto: fmt.inteiro(i.intencao), num: true };
    case "leads":
      return { texto: fmt.inteiro(i.leads), num: true, forte: true };
    case "negocios":
      return { texto: fmt.inteiro(i.negocios), num: true };
    case "visitas":
      return { texto: fmt.inteiro(i.visitas), num: true };
    case "imovelLead": {
      const v = i.imovelLead;
      return { texto: fmt.porcento(v, 2), num: true, forte: v !== null && (v >= 2 || v < 0.5), cor: v === null ? undefined : v >= 2 ? "#1E7A46" : v < 0.5 ? "#D93E3E" : undefined };
    }
    case "leadVisita":
      return { texto: fmt.porcento(i.leadVisita, 0), num: true };
    case "dias":
      return { texto: fmt.inteiro(i.dias), num: true };
    case "resp":
      return { texto: i.respNome, chip: i.resp, chipTom: "roxo" };
    default:
      return i.status === "ativo" ? { texto: "", chip: "ativo", chipTom: "bom" } : { texto: "", chip: "pausado", chipTom: "neutro" };
  }
}

export function ImoveisProcura({ recorte }: PropsTela) {
  const d = usarDados();
  const [aberto, setAberto] = useState<string>(d.imoveis[0]?.codigo ?? "");
  const [visiveis, setVisiveis] = useState<string[]>(COLUNAS.map((c) => c.chave));
  const [menu, setMenu] = useState<"colunas" | "ordem" | null>(null);
  const [ordem, setOrdem] = useState("Leads");

  const colunas = COLUNAS.filter((c) => visiveis.includes(c.chave));
  const imovel = d.imoveis.find((i) => i.codigo === aberto) ?? null;

  const kpis: Kpi[] = [
    { rotulo: "Imóveis anunciados", bruto: d.anunciados, texto: fmt.inteiro(d.anunciados), tile: "laranja", icone: "casa", foot: "no site, no período" },
    { rotulo: "Melhor imóvel → lead", bruto: d.melhorConversao, texto: fmt.porcento(d.melhorConversao, 2), tom: "bom", tile: "verde", foot: "Apê Pavão 88 · MO-097" },
    { rotulo: "Buscas sem resultado", bruto: d.buscasSemResultado, texto: fmt.inteiro(d.buscasSemResultado), tom: "atencao", tile: "ambar", foot: "viram alvo de captação" },
    { rotulo: "Imóveis sem código", bruto: d.semCodigo, texto: fmt.inteiro(d.semCodigo), tom: "ruim", tile: "vermelho", foot: "418 eventos em “não identificado”" },
  ];

  const alternarColuna = (chave: string) => {
    setVisiveis((v) => (v.includes(chave) ? (v.length > 1 ? v.filter((x) => x !== chave) : v) : COLUNAS.map((c) => c.chave).filter((c) => v.includes(c) || c === chave)));
  };

  const botaoMenu = { minHeight: 32, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #E4DFD9", borderRadius: 999, background: "#fff", color: "#4D4842", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" } as const;
  const caixaMenu = { position: "absolute" as const, top: 38, right: 0, zIndex: 20, minWidth: 220, background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(31,28,26,0.16)", padding: 10, display: "flex", flexDirection: "column" as const, gap: 2 };
  const acao = { minHeight: 36, flex: 1, minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid #E4DFD9", borderRadius: 999, background: "#fff", color: "#4D4842", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" } as const;

  return (
    <div className="int-secao">
      {/* 1 · INDICADORES */}
      <Cabecalho eyebrow="A PROCURA" titulo="O que a demanda está dizendo" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      {/* 2 · TABELA PRINCIPAL */}
      <div className="intp-cab" style={{ alignItems: "flex-end" }}>
        <div>
          <span className="intp-cab-eyebrow" style={{ color: "#FF7000" }}>TABELA PRINCIPAL</span>
          <h2>Cada imóvel, do acesso à visita</h2>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, position: "relative" }}>
          <button type="button" style={botaoMenu} onClick={() => setMenu((m) => (m === "colunas" ? null : "colunas"))} aria-expanded={menu === "colunas"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16M15 4v16" />
            </svg>
            Escolher colunas
          </button>
          <button type="button" style={botaoMenu} onClick={() => setMenu((m) => (m === "ordem" ? null : "ordem"))} aria-expanded={menu === "ordem"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h13M4 12h9M4 18h5" />
              <path d="m17 14 3 3 3-3" />
            </svg>
            Ordenar: {ordem.toLocaleLowerCase("pt-BR")}
          </button>

          {menu === "colunas" ? (
            <div style={caixaMenu} role="group" aria-label="Escolher colunas">
              {COLUNAS.map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  onClick={() => alternarColuna(c.chave)}
                  style={{ minHeight: 32, display: "flex", alignItems: "center", gap: 9, border: 0, background: "none", padding: "4px 6px", borderRadius: 9, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#4D4842", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ width: 15, height: 15, borderRadius: 5, flex: "none", display: "grid", placeItems: "center", border: visiveis.includes(c.chave) ? "1.5px solid #FF7000" : "1.5px solid #E4DFD9", background: visiveis.includes(c.chave) ? "#FF7000" : "#fff", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                    {visiveis.includes(c.chave) ? "✓" : ""}
                  </span>
                  {c.titulo}
                </button>
              ))}
              <small className="intp-kpi-foot" style={{ padding: "4px 6px" }}>colunas desligadas continuam existindo no dado — nada é apagado</small>
            </div>
          ) : null}

          {menu === "ordem" ? (
            <div style={caixaMenu} role="group" aria-label="Ordenar por">
              {COLUNAS.filter((c) => c.num).map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  onClick={() => {
                    setOrdem(c.titulo);
                    setMenu(null);
                  }}
                  style={{ minHeight: 32, display: "flex", alignItems: "center", border: 0, background: ordem === c.titulo ? "#FFF3EA" : "none", padding: "4px 8px", borderRadius: 9, fontFamily: "inherit", fontSize: 12, fontWeight: ordem === c.titulo ? 700 : 600, color: ordem === c.titulo ? "#CC5800" : "#4D4842", cursor: "pointer", textAlign: "left" }}
                >
                  {c.titulo}
                </button>
              ))}
              <small className="intp-kpi-foot" style={{ padding: "4px 6px" }}>o cabeçalho da tabela também ordena, com um clique</small>
            </div>
          ) : null}
        </div>
      </div>

      <Tabela
        key={`${ordem}-${visiveis.join(",")}`}
        colunas={colunas.map((c) => ({ titulo: c.titulo, num: c.num }))}
        ordenadaEm={colunas.some((c) => c.titulo === ordem) ? ordem : undefined}
        linhas={d.imoveis.map((i) => ({
          chave: i.codigo,
          destaque: i.codigo === aberto,
          abrir: () => setAberto(i.codigo),
          celulas: colunas.map((c) => celula(i, c)),
        }))}
        foot="mostrando 6 de 31 imóveis · a linha destacada está aberta no drawer ao lado · verde/vermelho = melhor e pior conversão do período"
        acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todos →</button>}
      />

      {/* 3 · LEITURAS COMPLEMENTARES + DRAWER DO IMÓVEL, lado a lado */}
      <div className="int-duas par-150">
        <div className="int-col">
          <Cabecalho eyebrow="LEITURAS COMPLEMENTARES" titulo="O que a procura está dizendo" cor="#8B00CC" />
          <CartoesLista
            colunas={2}
            cartoes={[
              {
                titulo: "Muito acesso, pouca intenção",
                chip: "ajustar anúncio",
                chipTom: "aviso",
                linhas: [
                  { l: "Apê Gaivota 402 · MO-118", r: "1.240 vis. · 31 intenções", sub: "só 17% abrem a galeria — revisar fotos e preço", abrir: () => setAberto("MO-118") },
                  { l: "Apê Tuim 20 · MO-131", r: "226 vis. · 22 intenções", sub: "58 dias anunciado — comparar preço com a região", abrir: () => setAberto("MO-131") },
                ],
              },
              {
                titulo: "Com intenção, sem atendimento",
                chip: "vira ação no CRM",
                chipTom: "ruim",
                linhas: [
                  { l: "Apê Sabiá 12 · MO-121", r: "4 leads sem 1º contato", sub: "mais antigo há 26h", abrir: () => recorte.irPara("conversao") },
                  { l: "Apê Gaivota 402 · MO-118", r: "2 leads · 0 visitas", sub: "nenhuma tentativa registrada", abrir: () => recorte.irPara("conversao") },
                ],
                link: { rotulo: "Abrir em Conversão e CRM →", go: () => recorte.irPara("conversao") },
              },
            ]}
          />

          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Bairros e faixas mais procurados</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {d.bairros.map((b) => (
                  <button key={b.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Bairro: ${b.l}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ width: 150, fontWeight: 600, color: "#4D4842" }}>{b.l}</span>
                      <span style={{ flex: 1, height: 8, borderRadius: 999, background: "#F2EFEC" }}>
                        <span style={{ display: "block", height: "100%", borderRadius: 999, background: "#FF9A4D", width: `${b.largura}%` }} />
                      </span>
                      <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmt.porcento(b.pct, 0)}</b>
                    </div>
                  </button>
                ))}
              </div>
              <small className="intp-kpi-foot">{d.faixasNota}</small>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Venda vs. locação</span>
              <table className="intp-tabela">
                <thead>
                  <tr>
                    <th>&nbsp;</th>
                    <th className="num">Vis.</th>
                    <th className="num">Leads</th>
                    <th className="num">Negócios</th>
                    <th className="num">Imóvel→lead</th>
                  </tr>
                </thead>
                <tbody>
                  {d.finalidades.map((f) => (
                    <tr key={f.nome} onClick={() => recorte.filtrar(`Finalidade: ${f.nome}`)}>
                      <td data-rotulo="Finalidade" className="forte">{f.nome}</td>
                      <td data-rotulo="Vis." className="num">{fmt.inteiro(f.vis)}</td>
                      <td data-rotulo="Leads" className="num">{fmt.inteiro(f.leads)}</td>
                      <td data-rotulo="Negócios" className="num">{fmt.inteiro(f.negocios)}</td>
                      <td data-rotulo="Imóvel→lead" className={f.melhor ? "num forte" : "num"}>{fmt.porcento(f.imovelLead, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>soma só páginas de imóvel — busca e conteúdo ficam em Comportamento</small>
            </div>
          </div>

          <CartoesLista
            colunas={3}
            cartoes={[
              { titulo: "Filtros de busca mais usados", linhas: d.filtros.map((f) => ({ ...f, abrir: () => recorte.filtrar(`Filtro de busca: ${f.l}`) })) },
              { titulo: "Buscas sem resultado", linhas: d.semResultado, foot: "combinações agregadas — nunca o texto digitado" },
              {
                titulo: "Demanda sem estoque",
                fundo: "tint-roxo",
                linhas: [{ l: "2 dorms mobiliado até R$ 6.500/mês em Moema Índios", r: "74 buscas", sub: "74 buscas sem resultado no mês. Ninguém no estoque atende." }],
                link: { rotulo: "Virar alvo de captação →", go: () => recorte.irPara("proprietarios") },
              },
            ]}
          />
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="DRAWER DO IMÓVEL" titulo="Abre pela linha da tabela" cor="#8B00CC" />
          {imovel ? (
            <div className="intp-cartao" style={{ boxShadow: "0 8px 24px rgba(31,28,26,0.10)", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 46, height: 46, borderRadius: 12, background: "#FFE4D1", color: "#CC5800", display: "grid", placeItems: "center", flex: "none" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="3" width="10" height="18" rx="1.5" />
                    <path d="M14 8h5a1 1 0 0 1 1 1v12M7 7h4M7 11h4M7 15h4M17 12h.01M17 16h.01" />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{imovel.nome}</b> <small style={{ color: "#9A938B" }}>{imovel.codigo}</small>
                  <small style={{ display: "block", fontSize: 11, color: "#9A938B" }}>
                    {imovel.bairro} · {imovel.finalidade.toLocaleLowerCase("pt-BR")} · {preco(imovel)} · {fmt.inteiro(imovel.dias)} dias anunciado
                  </small>
                </div>
                <span className={`intp-cartao-chip ${imovel.status === "ativo" ? "tom-bom" : "tom-neutro"}`} style={{ flex: "none" }}>{imovel.status}</span>
              </div>

              <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {[
                  { v: fmt.inteiro(imovel.visualizacoes), l: "visualizações" },
                  { v: fmt.inteiro(imovel.leads), l: "leads" },
                  { v: fmt.inteiro(imovel.negocios), l: "negócios" },
                ].map((t) => (
                  <div key={t.l} style={{ background: "#FAF8F6", borderRadius: 12, padding: "10px 12px" }}>
                    <strong style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{t.v}</strong>
                    <br />
                    <small className="intp-kpi-foot">{t.l}</small>
                  </div>
                ))}
              </div>

              <div>
                <small style={{ fontSize: 11, fontWeight: 700, color: "#6E6760" }}>EVOLUÇÃO DO INTERESSE</small>
                <svg width="100%" height="56" viewBox="0 0 300 56" preserveAspectRatio="none" style={{ marginTop: 4 }} role="img" aria-label="Evolução do interesse no imóvel">
                  <polyline points="0,42 27,36 54,40 81,28 108,34 135,22 162,28 189,16 216,24 243,12 270,20 300,8" fill="none" stroke="#FF7000" strokeWidth="2" />
                </svg>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="intp-linha-kv">
                  <span>Origens que trouxeram acesso</span>
                  <b>{imovel.origens ?? TRACO}</b>
                </div>
                <div className="intp-linha-kv">
                  <span>Jornada típica antes do lead</span>
                  <button type="button" className="int-link" style={{ fontWeight: 700 }} onClick={() => recorte.irPara("comportamento")}>ver</button>
                </div>
                <div className="intp-linha-kv">
                  <span>Favoritos · aberturas de galeria</span>
                  <b>{fmt.inteiro(imovel.favoritos)} · {fmt.inteiro(imovel.galeria)}</b>
                </div>
                <div className="intp-linha-kv">
                  <span>Visitas agendadas</span>
                  <b>{fmt.inteiro(imovel.visitas)} · {imovel.proximaVisita ?? TRACO}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={acao} onClick={() => recorte.filtrar(`Imóvel: ${imovel.nome} · ${imovel.codigo}`)}>Ficha em Produtos</button>
                <button type="button" style={acao} onClick={() => recorte.irPara("conversao")}>Leads no CRM</button>
                <button type="button" className="int-link" style={{ fontWeight: 700 }} onClick={() => recorte.filtrar(`Imóvel: ${imovel.nome}`)}>Filtrar a página por este imóvel</button>
              </div>

              {imovel.origens === null ? (
                <div className="intp-detalhe-aviso">
                  Origem do acesso e próxima visita deste imóvel dependem da atribuição no recorte atual e ficam com “—” enquanto não vierem. Nenhum valor é estimado. Sem IP bruto, sem user agent — só o que serve para vender o imóvel.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Mais eficientes em gerar lead</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {d.eficientes.map((e) => (
                <div className="intp-linha-kv" key={e.l}>
                  <span>{e.l}</span>
                  <b style={e.bom ? { color: "#1E7A46" } : undefined}>{e.r}</b>
                </div>
              ))}
            </div>
            <small className="intp-kpi-foot">imóvel→lead · mínimo de 200 visualizações para entrar no ranking</small>
          </div>
        </div>
      </div>

      {/* 4 · RODAPÉ */}
      <RodapeFontes
        fontes={["coleta própria", "cadastro de imóveis", "buscas agregadas", "CRM Funil 2.0"]}
        pendencias={["12 imóveis sem código (418 eventos em “não identificado”)", "origem do acesso por imóvel depende da atribuição"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO. */
function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  anunciados: 31,
  semCodigo: 12,
  buscasSemResultado: 133,
  melhorConversao: 2.81,
  imoveis: [
    { nome: "Apê Canário 71", codigo: "MO-104", bairro: "Moema Pássaros", finalidade: "Venda", preco: 890_000, visualizacoes: 1_486, galeria: 1_208, favoritos: 96, intencao: 312, leads: 38, negocios: 26, visitas: 14, imovelLead: 2.56, leadVisita: 37, dias: 34, resp: "AB", respNome: "Ana Beatriz", status: "ativo", origens: "Instagram 41% · busca 33% · Meta 18%", proximaVisita: "próxima sáb 10h" },
    { nome: "Apê Pavão 88", codigo: "MO-097", bairro: "Moema Índios", finalidade: "Locação", preco: 5_200, visualizacoes: 1_104, galeria: 892, favoritos: 71, intencao: 264, leads: 31, negocios: 19, visitas: 11, imovelLead: 2.81, leadVisita: 35, dias: 21, resp: "CM", respNome: "Carlos Mendes", status: "ativo", origens: null, proximaVisita: null },
    { nome: "Apê Sabiá 12", codigo: "MO-121", bairro: "Moema Pássaros", finalidade: "Venda", preco: 1_150_000, visualizacoes: 934, galeria: 706, favoritos: 54, intencao: 176, leads: 19, negocios: 12, visitas: 7, imovelLead: 2.03, leadVisita: 37, dias: 45, resp: "FL", respNome: "Fernanda Lima", status: "ativo", origens: null, proximaVisita: null },
    { nome: "Apê Andorinha 55", codigo: "MO-092", bairro: "Moema Índios", finalidade: "Locação", preco: 4_200, visualizacoes: 812, galeria: 590, favoritos: 42, intencao: 148, leads: 16, negocios: 9, visitas: 5, imovelLead: 1.97, leadVisita: 31, dias: 12, resp: "AB", respNome: "Ana Beatriz", status: "ativo", origens: null, proximaVisita: null },
    { nome: "Apê Gaivota 402", codigo: "MO-118", bairro: "Moema Pássaros", finalidade: "Venda", preco: 1_480_000, visualizacoes: 1_240, galeria: 214, favoritos: 18, intencao: 31, leads: 2, negocios: 1, visitas: 0, imovelLead: 0.16, leadVisita: 0, dias: 21, resp: "RS", respNome: "Rafael Souza", status: "ativo", atencao: true, origens: null, proximaVisita: null },
    { nome: "Apê Tuim 20", codigo: "MO-131", bairro: "Moema Pássaros", finalidade: "Locação", preco: 3_900, visualizacoes: 226, galeria: 118, favoritos: 8, intencao: 22, leads: 3, negocios: 1, visitas: 1, imovelLead: 1.33, leadVisita: 33, dias: 58, resp: "CM", respNome: "Carlos Mendes", status: "pausado", origens: null, proximaVisita: null },
  ],
  bairros: [
    { l: "Moema Pássaros", pct: 42, largura: 100 },
    { l: "Moema Índios", pct: 31, largura: 74 },
    { l: "Vila Nova Conceição", pct: 12, largura: 29 },
    { l: "Campo Belo", pct: 9, largura: 21 },
  ],
  faixasNota: "faixas mais buscadas: R$ 4–6 mil/mês (locação) · R$ 800 mil–1,2 mi (venda)",
  finalidades: [
    { nome: "Venda", vis: 6_980, leads: 96, negocios: 61, imovelLead: 1.38 },
    { nome: "Locação", vis: 5_010, leads: 78, negocios: 47, imovelLead: 1.56, melhor: true },
  ],
  filtros: [
    { l: "2 dormitórios", r: "1.812" },
    { l: "até R$ 6.000/mês", r: "1.394" },
    { l: "mobiliado", r: "1.286" },
    { l: "vaga de garagem", r: "918" },
  ],
  semResultado: [
    { l: "3 dorms · mobiliado · até R$ 6.500/mês", r: "74" },
    { l: "cobertura · até R$ 1,5 mi", r: "41" },
    { l: "aceita pets · 2 dorms", r: "38" },
  ],
  eficientes: [
    { l: "Apê Pavão 88 · MO-097", r: "2,81%", bom: true },
    { l: "Apê Canário 71 · MO-104", r: "2,56%", bom: true },
    { l: "Apê Sabiá 12 · MO-121", r: "2,03%" },
  ],
  atualizado: "14:28",
};
