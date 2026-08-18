"use client";

/* IMÓVEIS E PROCURA — artboard 6a.
 * Quais imóveis geram demanda e quais precisam de ajuste. Busca sem resultado
 * vira alvo de captação: a procura sem estoque é dado, não desperdício.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, Tabela, type Kpi } from "../pecas";

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

type Dados = { anunciados: number | null; semCodigo: number | null; buscasSemResultado: number | null; melhorConversao: number | null; imoveis: Imovel[]; atualizado: string };

const conversao = (i: Imovel) => (i.visualizacoes && i.leads !== null ? (i.leads / i.visualizacoes) * 100 : null);

export function ImoveisProcura({ recorte }: PropsTela) {
  const [imovel, setImovel] = useState<Imovel | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Imóveis anunciados", bruto: d.anunciados, texto: fmt.inteiro(d.anunciados), tile: "laranja", foot: "no site, no período" },
    { rotulo: "Melhor imóvel → lead", bruto: d.melhorConversao, texto: fmt.porcento(d.melhorConversao, 2), tom: "bom", tile: "verde", foot: "Apê Pavão 88" },
    { rotulo: "Buscas sem resultado", bruto: d.buscasSemResultado, texto: fmt.inteiro(d.buscasSemResultado), tom: "atencao", tile: "ambar", foot: "viram alvo de captação" },
    { rotulo: "Imóveis sem código", bruto: d.semCodigo, texto: fmt.inteiro(d.semCodigo), tom: "ruim", tile: "vermelho", foot: "eventos caem em “não identificado”" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="A PROCURA" titulo="O que a demanda está dizendo" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="TABELA PRINCIPAL" titulo="Cada imóvel, do acesso à visita" cor="#8B00CC" nota="clique na linha para abrir o detalhe" />
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
              { texto: fmt.dinheiro(i.preco), num: true },
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
        foot="imóvel sem código cadastrado entra como “não identificado” e fica fora do ranking — o evento não é descartado nem redistribuído"
      />

      {imovel ? (
        <CartoesLista
          colunas={2}
          cartoes={[
            {
              titulo: `${imovel.nome} · ${imovel.codigo}`,
              chip: imovel.status === "ativo" ? "ativo" : "pausado",
              chipTom: imovel.status === "ativo" ? "bom" : "neutro",
              linhas: [
                { l: "Bairro e finalidade", r: `${imovel.bairro} · ${imovel.finalidade}` },
                { l: "Visualizações · galeria", r: `${fmt.inteiro(imovel.visualizacoes)} · ${fmt.inteiro(imovel.galeria)}` },
                { l: "Intenção · leads · negócios", r: `${fmt.inteiro(imovel.intencao)} · ${fmt.inteiro(imovel.leads)} · ${fmt.inteiro(imovel.negocios)}` },
                { l: "Dias anunciado", r: fmt.inteiro(imovel.dias) },
              ],
              foot: "sem IP bruto e sem user agent — só o que serve para vender o imóvel",
              link: { rotulo: "Fechar detalhe", go: () => setImovel(null) },
            },
            {
              titulo: "Leitura deste anúncio",
              linhas: [
                { l: "Imóvel → lead", r: fmt.porcento(conversao(imovel), 2) },
                { l: "Galeria por visualização", r: imovel.visualizacoes && imovel.galeria !== null ? fmt.porcento((imovel.galeria / imovel.visualizacoes) * 100, 0) : "—" },
                { l: "Leads sem 1º contato", r: "—", sub: "depende da fila do CRM neste recorte" },
              ],
              foot: "galeria pouco aberta com acesso alto costuma ser problema de foto, não de preço",
              link: { rotulo: "Filtrar a página por este imóvel →", go: () => recorte.filtrar(`Imóvel: ${imovel.nome}`) },
            },
          ]}
        />
      ) : null}

      <Cabecalho eyebrow="LEITURAS COMPLEMENTARES" titulo="Demanda, estoque e o que precisa de ação" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Com intenção, sem atendimento", chip: "vira ação no CRM", chipTom: "ruim", linhas: [{ l: "Apê Sabiá 12", r: "4 leads sem 1º contato", sub: "mais antigo há 26 h" }, { l: "Apê Gaivota 402", r: "2 leads · 0 visitas", sub: "nenhuma tentativa registrada" }], link: { rotulo: "Abrir Conversão e CRM →", go: () => recorte.irPara("conversao") } },
          { titulo: "Buscas sem resultado", linhas: [{ l: "3 dorms · mobiliado · até R$ 6.500/mês", r: "74" }, { l: "cobertura · até R$ 1,5 mi", r: "41" }, { l: "aceita pets · 2 dorms", r: "38" }], foot: "combinações agregadas — nunca o texto digitado pela pessoa" },
          { titulo: "Demanda sem estoque", fundo: "tint-roxo", linhas: [{ l: "2 dorms mobiliado até R$ 6.500/mês em Moema Índios", r: "74 buscas", sub: "nenhuma captação do mês atende" }], link: { rotulo: "Virar alvo de captação →", go: () => recorte.irPara("proprietarios") } },
        ]}
      />

      <RodapeFontes
        fontes={["coleta própria", "cadastro de imóveis", "buscas agregadas", "CRM Funil 2.0"]}
        pendencias={["12 imóveis sem código (418 eventos em “não identificado”)"]}
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
  atualizado: "14:28",
};
