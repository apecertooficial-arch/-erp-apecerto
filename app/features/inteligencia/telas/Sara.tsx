"use client";

/* 7 · SARA — artboard 8a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. banner roxo com a leitura do período e as três estatísticas
 *   2. funil da Sara, 7 etapas — EM ROXO, para não confundir com o funil do site
 *   3. indicadores da conversa (4 KPIs)
 *   4. o que as pessoas pedem: temas · bairros · resultados mais clicados
 *   5. erros da Sara, detalhados
 *   6. rodapé de fontes
 *
 * Texto digitado nunca aparece: só combinações agregadas de filtro.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, Funil, GradeKpis, type Etapa, type Kpi } from "../pecas";

type Dados = {
  aberturas: number | null;
  buscaConcluida: number | null;
  semResultado: number | null;
  erros: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  temas: { l: string; r: string }[];
  bairros: { l: string; r: string }[];
  cliques: { l: string; r: string }[];
  errosDetalhe: { l: string; r: string; sub?: string }[];
  atualizado: string;
};

export function Sara({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Aberturas", bruto: d.aberturas, texto: fmt.inteiro(d.aberturas), chip: "▲ +18%", chipTom: "bom", tile: "roxo" },
    { rotulo: "Busca concluída", bruto: d.buscaConcluida, texto: fmt.porcento(d.buscaConcluida, 0), tom: "bom", tile: "verde", foot: "com pelo menos 1 resultado" },
    { rotulo: "Buscas sem resultado", bruto: d.semResultado, texto: fmt.inteiro(d.semResultado), tom: "ruim", tile: "ambar", foot: "viram demanda sem estoque" },
    { rotulo: "Erros da Sara", bruto: d.erros, texto: fmt.inteiro(d.erros), tom: "atencao", tile: "vermelho", foot: "timeout 12 · sem resposta 6 · outros 3" },
  ];

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    roxo: true,
    detalhes: () => recorte.filtrar(`Etapa da Sara: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <Banner
        tom="roxo"
        forte="A Sara respondeu 91% das buscas e gerou 47 leads e 28 negócios."
        texto="O gargalo está depois: quem abre o imóvel raramente age dentro da conversa — 476 pessoas saíram entre ver e agir."
        stats={[{ v: "1.482", l: "buscas" }, { v: "47", l: "leads" }, { v: "28", l: "negócios" }]}
      />

      <Cabecalho eyebrow="FUNIL DA SARA" titulo="Da conversa ao negócio" cor="#8B00CC" nota="roxo = funil da Sara, para não confundir com o funil laranja do site" />
      <Funil etapas={etapas} foot="etapa sem evento coletado aparece com “—” · erro de conversa não é contado como abandono da pessoa" />

      <Cabecalho eyebrow="A CONVERSA" titulo="Volume, resultado e erro" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="O QUE AS PESSOAS PEDEM" titulo="Sempre em agregado — nunca o texto digitado" cor="#8B00CC" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Temas e faixas", linhas: d.temas.map((t) => ({ ...t, abrir: () => recorte.filtrar(`Tema: ${t.l}`) })), foot: "combinações agregadas de filtro, não frases" },
          { titulo: "Bairros e finalidade", linhas: d.bairros.map((b) => ({ ...b, abrir: () => recorte.filtrar(`Bairro: ${b.l}`) })) },
          { titulo: "Resultados mais clicados", linhas: d.cliques.map((c) => ({ ...c, abrir: () => recorte.irPara("imoveis") })), foot: "clicar abre Imóveis e procura" },
        ]}
      />

      <Cabecalho eyebrow="QUANDO A SARA FALHA" titulo="Cada erro é uma conversa interrompida no pico de interesse" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Erros por tipo", linhas: d.errosDetalhe, foot: "erro não é contado como abandono da pessoa" },
          {
            titulo: "Buscas sem resultado viram captação",
            fundo: "tint-roxo",
            linhas: [{ l: "133 buscas sem nenhum imóvel compatível", r: "9% do total", sub: "alimentam o alvo de captação ativa" }],
            link: { rotulo: "Abrir Proprietários →", go: () => recorte.irPara("proprietarios") },
          },
        ]}
      />

      <RodapeFontes
        fontes={["eventos da Sara", "coleta própria", "CRM Funil 2.0"]}
        pendencias={["12 timeouts em investigação", "texto digitado não é armazenado (decisão de privacidade)"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  aberturas: 2_104,
  buscaConcluida: 91,
  semResultado: 133,
  erros: 21,
  etapas: [
    { nome: "1 · Sara aberta", volume: 2_104, largura: 100, taxa: "100%" },
    { nome: "2 · Busca enviada", volume: 1_482, largura: 70, taxa: "70,4%", perda: "−622" },
    { nome: "3 · Resultados apresentados", volume: 1_349, largura: 64, taxa: "91,0%", perda: "−133" },
    { nome: "4 · Imóvel aberto", volume: 864, largura: 41, taxa: "64,0%", perda: "−485" },
    { nome: "5 · Ação de intenção", volume: 388, largura: 18, taxa: "44,9%", perda: "−476" },
    { nome: "6 · Lead gerado", volume: 47, largura: 6, taxa: "12,1%", perda: "−341" },
    { nome: "7 · Negócio criado", volume: 28, largura: 4, taxa: "59,6%", perda: "−19" },
  ],
  temas: [
    { l: "2 dormitórios", r: "512" },
    { l: "mobiliado", r: "448" },
    { l: "perto do metrô", r: "302" },
    { l: "R$ 4–6 mil/mês", r: "38%" },
  ],
  bairros: [
    { l: "Moema Pássaros", r: "44%" },
    { l: "Moema Índios", r: "30%" },
    { l: "Locação · Venda", r: "58% · 42%" },
  ],
  cliques: [
    { l: "Apê Canário 71", r: "186 cliques · 12 leads" },
    { l: "Apê Pavão 88", r: "152 · 9" },
    { l: "Apê Andorinha 55", r: "104 · 6" },
  ],
  errosDetalhe: [
    { l: "Timeout na resposta", r: "12", sub: "acontece no pico de interesse" },
    { l: "Sem resposta da assistente", r: "6" },
    { l: "Outros", r: "3" },
  ],
  atualizado: "14:28",
};
