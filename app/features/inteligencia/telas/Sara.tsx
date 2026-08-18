"use client";

/* SARA — artboard 8a.
 * A assistente de imóveis do site. Funil próprio, em roxo, para não se confundir
 * com o funil laranja do site. Texto digitado nunca aparece: só agregados.
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
  atualizado: string;
};

export function Sara({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Aberturas", bruto: d.aberturas, texto: fmt.inteiro(d.aberturas), chip: "▲ +18%", chipTom: "bom", tile: "roxo" },
    { rotulo: "Busca concluída", bruto: d.buscaConcluida, texto: fmt.porcento(d.buscaConcluida, 0), tile: "verde", foot: "com pelo menos 1 resultado" },
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

      <Cabecalho eyebrow="O PERÍODO" titulo="Conversa, resultado e erro" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="FUNIL DA SARA" titulo="Da conversa ao negócio" cor="#8B00CC" nota="roxo para não confundir com o funil do site" />
      <Funil etapas={etapas} foot="etapa sem evento coletado aparece com “—” · erro de conversa não é contado como abandono da pessoa" />

      <Cabecalho eyebrow="O QUE AS PESSOAS PEDEM" titulo="Sempre em agregado — nunca o texto digitado" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Temas e faixas", linhas: d.temas, foot: "combinações agregadas de filtro, não frases" },
          { titulo: "Bairros e finalidade", linhas: d.bairros },
          { titulo: "Resultados mais clicados", linhas: d.cliques.map((c) => ({ ...c, abrir: () => recorte.irPara("imoveis") })), foot: "clicar abre Imóveis e procura" },
        ]}
      />

      <RodapeFontes
        fontes={["eventos da Sara", "coleta própria", "CRM Funil 2.0"]}
        pendencias={["12 timeouts em investigação", "texto digitado não é armazenado (por decisão de privacidade)"]}
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
  atualizado: "14:28",
};
