"use client";

/* 4 · IMÓVEIS E PROCURA — artboard 6a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. indicadores da procura (4 KPIs)
 *   2. tabela principal: cada imóvel, do acesso à visita (12 colunas)
 *   3. gaveta lateral de 420px ao clicar na linha
 *   4. leituras complementares: com intenção sem atendimento · buscas sem
 *      resultado · demanda sem estoque
 *   5. bairros e faixas de preço mais procurados
 *   6. rodapé de fontes
 *
 * Busca sem resultado vira alvo de captação: procura sem estoque é dado, não
 * desperdício. Imóvel sem código entra como “não identificado” e fica fora do
 * ranking — o evento não é descartado nem redistribuído.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GavetaLateral, GradeKpis, Tabela, type Kpi } from "../pecas";

type Imovel = {
  nome: string;
  codigo: string;
  bairro: string;
  finalidade: string;
  preco: number | null;
  visualizacoes: number | null;
  galeria: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  dias: number | null;
  status: "ativo" | "pausado";
};

type Dados = {
  anunciados: number | null;
  semCodigo: number | null;
  buscasSemResultado: number | null;
  melhorConversao: number | null;
  imoveis: Imovel[];
  bairros: { l: string; r: string }[];
  faixas: { l: string; r: string }[];
  atualizado: string;
};

const conversao = (i: Imovel) => (i.visualizacoes && i.leads !== null ? (i.leads / i.visualizacoes) * 100 : null);

export function ImoveisProcura({ recorte }: PropsTela) {
  const [imovel, setImovel] = useState<Imovel | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Imóveis anunciados", bruto: d.anunciados, texto: fmt.inteiro(d.anunciados), tile: "laranja", icone: "casa", foot: "no site, no período" },
    { rotulo: "Melhor imóvel → lead", bruto: d.melhorConversao, texto: fmt.porcento(d.melhorConversao, 2), tom: "bom", tile: "verde", foot: "Apê Pavão 88 · MO-097" },
    { rotulo: "Buscas sem resultado", bruto: d.buscasSemResultado, texto: fmt.inteiro(d.buscasSemResultado), tom: "atencao", tile: "ambar", foot: "viram alvo de captação" },
    { rotulo: "Imóveis sem código", bruto: d.semCodigo, texto: fmt.inteiro(d.semCodigo), tom: "ruim", tile: "vermelho", foot: "418 eventos em “não identificado”" },
  ];

  return (
    <div className="int-secao">
      {/* 1 · INDICADORES */}
      <Cabecalho eyebrow="A PROCURA" titulo="O que a demanda está dizendo" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      {/* 2 · TABELA PRINCIPAL */}
      <Cabecalho eyebrow="TABELA PRINCIPAL" titulo="Cada imóvel, do acesso à visita" cor="#8B00CC" nota="clique na linha para abrir a gaveta · clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Imóvel" }, { titulo: "Bairro" }, { titulo: "Finalidade" }, { titulo: "Preço", num: true }, { titulo: "Vis.", num: true }, { titulo: "Galeria", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Negócios", num: true }, { titulo: "Imóvel→lead", num: true }, { titulo: "Dias", num: true }, { titulo: "Status" }]}
        ordenadaEm="Leads"
        linhas={d.imoveis.map((i) => {
          const c = conversao(i);
          return {
            chave: i.codigo,
            destaque: c !== null && c < 0.5,
            abrir: () => setImovel(i),
            celulas: [
              { texto: i.nome, forte: true, sub: i.codigo },
              { texto: i.bairro },
              { texto: i.finalidade },
              { texto: i.finalidade === "Locação" && i.preco !== null ? `${fmt.dinheiro(i.preco)}/mês` : fmt.dinheiro(i.preco), num: true },
              { texto: fmt.inteiro(i.visualizacoes), num: true },
              { texto: fmt.inteiro(i.galeria), num: true, cor: (i.galeria ?? 999) < 300 ? "#B5700A" : undefined },
              { texto: fmt.inteiro(i.intencao), num: true },
              { texto: fmt.inteiro(i.leads), num: true, forte: true },
              { texto: fmt.inteiro(i.negocios), num: true },
              { texto: fmt.porcento(c, 2), num: true, cor: c === null ? undefined : c >= 2 ? "#1E7A46" : c < 0.5 ? "#D93E3E" : undefined },
              { texto: fmt.inteiro(i.dias), num: true },
              i.status === "ativo" ? { texto: "", chip: "ativo", chipTom: "bom" as const } : { texto: "", chip: "pausado", chipTom: "neutro" as const },
            ],
          };
        })}
        foot="mostrando 6 de 31 imóveis · imóvel sem código entra como “não identificado” e fica fora do ranking, sem descartar o evento"
        acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todos →</button>}
      />

      {/* 3 · GAVETA DO IMÓVEL */}
      <GavetaLateral
        aberta={!!imovel}
        titulo={imovel ? `${imovel.nome} · ${imovel.codigo}` : ""}
        sub={imovel ? `${imovel.bairro} · ${imovel.finalidade.toLowerCase()} · ${fmt.dinheiro(imovel.preco)}${imovel.finalidade === "Locação" ? "/mês" : ""} · ${fmt.inteiro(imovel.dias)} dias anunciado` : ""}
        selo={imovel?.status === "ativo" ? "ativo" : undefined}
        fechar={() => setImovel(null)}
        rodape={
          imovel ? (
            <>
              <button type="button" className="cop-acao" onClick={() => recorte.filtrar(`Imóvel: ${imovel.nome}`)}>Filtrar a página por este imóvel</button>
              <button type="button" className="cop-acao" onClick={() => recorte.irPara("conversao")}>Leads no CRM →</button>
            </>
          ) : null
        }
      >
        {imovel ? (
          <>
            <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <div className="intp-prova-gaveta"><small>visualizações</small><b>{fmt.inteiro(imovel.visualizacoes)}</b></div>
              <div className="intp-prova-gaveta"><small>leads</small><b>{fmt.inteiro(imovel.leads)}</b></div>
              <div className="intp-prova-gaveta"><small>negócios</small><b>{fmt.inteiro(imovel.negocios)}</b></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="intp-detalhe-linha"><span>Imóvel → lead</span><b>{fmt.porcento(conversao(imovel), 2)}</b></div>
              <div className="intp-detalhe-linha"><span>Galeria aberta por visualização</span><b>{imovel.visualizacoes && imovel.galeria !== null ? fmt.porcento((imovel.galeria / imovel.visualizacoes) * 100, 0) : "—"}</b></div>
              <div className="intp-detalhe-linha"><span>Ações de intenção</span><b>{fmt.inteiro(imovel.intencao)}</b></div>
              <div className="intp-detalhe-linha"><span>Leads sem primeiro contato</span><b>—</b></div>
              <div className="intp-detalhe-linha"><span>Origens que trouxeram acesso</span><b>—</b></div>
            </div>
            <div className="intp-detalhe-aviso">
              Sem IP bruto, sem user agent, sem identificador técnico — só o que serve para vender o imóvel. As duas últimas linhas dependem da fila do CRM e da atribuição neste recorte, e ficam com “—” enquanto não vierem.
            </div>
          </>
        ) : null}
      </GavetaLateral>

      {/* 4 · LEITURAS COMPLEMENTARES */}
      <Cabecalho eyebrow="LEITURAS COMPLEMENTARES" titulo="Demanda, estoque e o que precisa de ação" />
      <CartoesLista
        colunas={3}
        cartoes={[
          {
            titulo: "Com intenção, sem atendimento",
            chip: "vira ação no CRM",
            chipTom: "ruim",
            linhas: [
              { l: "Apê Sabiá 12", r: "4 leads sem 1º contato", sub: "mais antigo há 26 h", abrir: () => recorte.irPara("conversao") },
              { l: "Apê Gaivota 402", r: "2 leads · 0 visitas", sub: "nenhuma tentativa registrada", abrir: () => recorte.irPara("conversao") },
            ],
            link: { rotulo: "Abrir Conversão e CRM →", go: () => recorte.irPara("conversao") },
          },
          {
            titulo: "Buscas sem resultado",
            linhas: [
              { l: "3 dorms · mobiliado · até R$ 6.500/mês", r: "74" },
              { l: "cobertura · até R$ 1,5 mi", r: "41" },
              { l: "aceita pets · 2 dorms", r: "38" },
            ],
            foot: "combinações agregadas — nunca o texto digitado pela pessoa",
          },
          {
            titulo: "Demanda sem estoque",
            fundo: "tint-roxo",
            linhas: [{ l: "2 dorms mobiliado até R$ 6.500/mês em Moema Índios", r: "74 buscas", sub: "nenhuma captação do mês atende" }],
            link: { rotulo: "Virar alvo de captação →", go: () => recorte.irPara("proprietarios") },
          },
        ]}
      />

      {/* 5 · BAIRROS E FAIXAS */}
      <Cabecalho eyebrow="ONDE E POR QUANTO" titulo="Bairros e faixas mais procurados" cor="#8B00CC" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Bairros mais procurados", linhas: d.bairros.map((b) => ({ ...b, abrir: () => recorte.filtrar(`Bairro: ${b.l}`) })), foot: "clicar num bairro filtra a página" },
          { titulo: "Faixas de preço mais buscadas", linhas: d.faixas.map((f) => ({ ...f, abrir: () => recorte.filtrar(`Faixa: ${f.l}`) })), foot: "faixa declarada no filtro de busca do site" },
        ]}
      />

      {/* 6 · RODAPÉ */}
      <RodapeFontes
        fontes={["coleta própria", "cadastro de imóveis", "buscas agregadas", "CRM Funil 2.0"]}
        pendencias={["12 imóveis sem código (418 eventos em “não identificado”)", "origem do acesso por imóvel depende da atribuição"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  anunciados: 31,
  semCodigo: 12,
  buscasSemResultado: 133,
  melhorConversao: 2.81,
  imoveis: [
    { nome: "Apê Canário 71", codigo: "MO-104", bairro: "Moema Pássaros", finalidade: "Venda", preco: 890_000, visualizacoes: 1_486, galeria: 1_208, intencao: 312, leads: 38, negocios: 26, dias: 34, status: "ativo" },
    { nome: "Apê Pavão 88", codigo: "MO-097", bairro: "Moema Índios", finalidade: "Locação", preco: 5_200, visualizacoes: 1_104, galeria: 892, intencao: 264, leads: 31, negocios: 19, dias: 21, status: "ativo" },
    { nome: "Apê Sabiá 12", codigo: "MO-121", bairro: "Moema Pássaros", finalidade: "Venda", preco: 1_150_000, visualizacoes: 934, galeria: 706, intencao: 176, leads: 19, negocios: 12, dias: 45, status: "ativo" },
    { nome: "Apê Andorinha 55", codigo: "MO-092", bairro: "Moema Índios", finalidade: "Locação", preco: 4_200, visualizacoes: 812, galeria: 590, intencao: 148, leads: 16, negocios: 9, dias: 12, status: "ativo" },
    { nome: "Apê Gaivota 402", codigo: "MO-118", bairro: "Moema Pássaros", finalidade: "Venda", preco: 1_480_000, visualizacoes: 1_240, galeria: 214, intencao: 31, leads: 2, negocios: 1, dias: 21, status: "ativo" },
    { nome: "Apê Tuim 20", codigo: "MO-131", bairro: "Moema Pássaros", finalidade: "Locação", preco: 3_900, visualizacoes: 226, galeria: 118, intencao: 22, leads: 3, negocios: 1, dias: 58, status: "pausado" },
  ],
  bairros: [
    { l: "Moema Pássaros", r: "9.842 vis · 121 leads" },
    { l: "Moema Índios", r: "6.418 vis · 94 leads" },
    { l: "Campo Belo", r: "1.204 vis · 12 leads" },
    { l: "Vila Nova Conceição", r: "862 vis · 7 leads" },
  ],
  faixas: [
    { l: "Locação · R$ 4–6 mil/mês", r: "38% das buscas" },
    { l: "Locação · acima de R$ 6 mil/mês", r: "14%" },
    { l: "Venda · R$ 800 mil a R$ 1,2 mi", r: "31%" },
    { l: "Venda · acima de R$ 1,2 mi", r: "17%" },
  ],
  atualizado: "14:28",
};
