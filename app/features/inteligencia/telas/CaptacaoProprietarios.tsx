"use client";

/* CAPTAÇÃO DE PROPRIETÁRIOS — artboard 7a.
 * Etapas 1–4 vêm do site; 5–8 vêm do CRM. O cruzamento com a demanda sem estoque
 * é o que transforma a tela em alvo de captação, não em relatório.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, Funil, GradeKpis, type Etapa, type Kpi } from "../pecas";

type Dados = {
  recebidas: number | null;
  tempoContato: number | null;
  publicados: number | null;
  custoPorCaptacao: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  origens: { l: string; r: string; corR?: string }[];
  ofertados: { l: string; r: string }[];
  perdas: { l: string; r: string }[];
  atualizado: string;
};

export function CaptacaoProprietarios({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Captações recebidas", bruto: d.recebidas, texto: fmt.inteiro(d.recebidas), chip: "▲ +5 vs. anterior", chipTom: "bom", tile: "laranja" },
    { rotulo: "Tempo até contato", bruto: d.tempoContato, texto: fmt.duracaoMin(d.tempoContato), tile: "verde", foot: "mediana · meta 24 h" },
    { rotulo: "Imóveis publicados", bruto: d.publicados, texto: fmt.inteiro(d.publicados), tile: "roxo", foot: "26% do total captado" },
    { rotulo: "Custo por captação", bruto: d.custoPorCaptacao, texto: fmt.dinheiro(d.custoPorCaptacao), tile: "ambar", motivo: "integracao", detalhe: "mídias não conectadas", foot: "aparece quando Google Ads e Meta Ads estiverem conectados" },
  ];

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    detalhes: () => recorte.filtrar(`Etapa da captação: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="O PERÍODO" titulo="Do clique ao anúncio publicado" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="FUNIL DO PROPRIETÁRIO" titulo="Oito etapas, duas fontes" cor="#8B00CC" nota="1 a 4 do site · 5 a 8 do CRM" />
      <Funil etapas={etapas} foot="etapa do CRM sem registro aparece com “—” — não herdamos o número da etapa anterior" />

      <Banner
        tom="tint-roxo"
        forte="Cruzamento com a demanda sem estoque:"
        texto="74 buscas por 2 dorms mobiliado até R$ 6.500/mês em Moema Índios, e nenhuma das 23 captações do mês atende. É o alvo número 1 da captação ativa."
        botao={{ rotulo: "Ver em Imóveis", go: () => recorte.irPara("imoveis") }}
      />

      <Cabecalho eyebrow="CORTES" titulo="De onde vêm e o que oferecem" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Origem e campanha", linhas: d.origens, foot: "não atribuído aparece, nunca é diluido" },
          { titulo: "Bairros e tipos ofertados", linhas: d.ofertados, foot: "declarado pelo proprietário no formulário" },
          { titulo: `Motivos de perda · ${fmt.inteiro(7)}`, linhas: d.perdas, foot: "captação sem motivo registrado entra como “sem motivo”, não desaparece" },
        ]}
      />

      <RodapeFontes
        fontes={["coleta própria", "captações do portal", "CRM Funil 2.0"]}
        pendencias={["custo por captação (mídias não conectadas)"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  recebidas: 23,
  tempoContato: 192,
  publicados: 6,
  custoPorCaptacao: null,
  etapas: [
    { nome: "1 · Página de captação acessada", volume: 1_108, largura: 100, taxa: "100%" },
    { nome: "2 · Clique em “Anunciar meu apê”", volume: 74, largura: 52, taxa: "6,7%", perda: "−1.034" },
    { nome: "3 · Formulário iniciado", volume: 41, largura: 38, taxa: "55,4%", perda: "−33" },
    { nome: "4 · Captação enviada", volume: 23, largura: 28, taxa: "56,1%", perda: "−18" },
    { nome: "5 · Proprietário contatado", volume: 19, largura: 24, taxa: "82,6%", perda: "−4" },
    { nome: "6 · Imóvel avaliado", volume: 12, largura: 16, taxa: "63,2%", perda: "−7" },
    { nome: "7 · Autorização / contrato", volume: 8, largura: 11, taxa: "66,7%", perda: "−4" },
    { nome: "8 · Imóvel publicado", volume: 6, largura: 8, taxa: "75,0%", perda: "−2" },
  ],
  origens: [
    { l: "Instagram orgânico", r: "8" },
    { l: "Google orgânico", r: "6" },
    { l: "Meta Ads · anuncie-seu-ape", r: "5" },
    { l: "Não atribuído", r: "1", corR: "#66009A" },
  ],
  ofertados: [
    { l: "Moema Pássaros", r: "9" },
    { l: "Moema Índios", r: "6" },
    { l: "Apartamento · venda / locação", r: "8 / 10" },
    { l: "Cobertura · studio", r: "2 · 3" },
  ],
  perdas: [
    { l: "Preferiu exclusividade em outra", r: "3" },
    { l: "Avaliação abaixo do esperado", r: "2" },
    { l: "Desistiu de anunciar", r: "2" },
  ],
  atualizado: "14:28",
};
