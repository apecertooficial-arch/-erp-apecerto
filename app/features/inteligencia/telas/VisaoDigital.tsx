"use client";

/* VISÃO DO DIGITAL — artboard 2a.
 * Do acesso no site até a venda no Funil 2.0. Faixa de diagnóstico, 12 KPIs com
 * comparação, funil de 7 etapas e as leituras rápidas.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, type Etapa, type Kpi } from "../pecas";

type Dados = {
  visualizacoes: number | null;
  engajadas: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  visitas: number | null;
  fechamentos: number | null;
  conversaoPagina: number | null;
  conversaoLead: number | null;
  tempoAtendimento: number | null;
  pipelineAtribuido: number | null;
  sessoesGa4: string | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  atualizado: string;
};

export function VisaoDigital({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: d.visualizacoes, texto: fmt.inteiro(d.visualizacoes), chip: "▲ +12,4%", chipTom: "bom" },
    { rotulo: "Páginas com engajamento", bruto: d.engajadas, texto: fmt.inteiro(d.engajadas), chip: "▲ +8,1%", chipTom: "bom" },
    { rotulo: "Cliques de intenção", bruto: d.intencao, texto: fmt.inteiro(d.intencao), chip: "▲ +15,2%", chipTom: "bom", foot: "WhatsApp 1.294 · tel. 412 · agenda 233 · form. 371" },
    { rotulo: "Leads do site", bruto: d.leads, texto: fmt.inteiro(d.leads), chip: "▲ +9,5%", chipTom: "bom" },
    { rotulo: "Negócios no Funil 2.0", bruto: d.negocios, texto: fmt.inteiro(d.negocios), chip: "▲ +6,3%", chipTom: "bom" },
    { rotulo: "Visitas agendadas", bruto: d.visitas, texto: fmt.inteiro(d.visitas), chip: "▼ −4,0%", chipTom: "ruim" },
    { rotulo: "Vendas e locações", bruto: d.fechamentos, texto: fmt.inteiro(d.fechamentos), chip: "▲ +2 vs. anterior", chipTom: "bom", foot: "9 vendas · 5 locações" },
    { rotulo: "Conversão página → lead", bruto: d.conversaoPagina, texto: fmt.porcento(d.conversaoPagina, 2), chip: "▲ +0,11 pp", chipTom: "bom" },
    { rotulo: "Conversão lead → negócio", bruto: d.conversaoLead, texto: fmt.porcento(d.conversaoLead), chip: "▼ −1,8 pp", chipTom: "ruim" },
    { rotulo: "Tempo até 1º atendimento", bruto: d.tempoAtendimento, texto: fmt.duracaoMin(d.tempoAtendimento), foot: "mediana · meta 5 min" },
    { rotulo: "Pipeline atribuído ao site", bruto: d.pipelineAtribuido, texto: fmt.dinheiro(d.pipelineAtribuido), motivo: "integracao", detalhe: "valor do negócio ausente no CRM", foot: "aparece quando o campo existir no Funil 2.0" },
    { rotulo: "Sessões e usuários · GA4", bruto: d.sessoesGa4, chip: "só consentimento Analytics · 31%", chipTom: "roxo" },
  ];

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    detalhes: () => recorte.filtrar(`Etapa do site: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="FAIXA DE DIAGNÓSTICO" titulo="Três leituras do período, direto do dado" nota={recorte.periodo} />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Maior crescimento", chip: "Instagram orgânico", chipTom: "bom", linhas: [{ l: "Negócios gerados", r: "52" }, { l: "vs. 30 dias anteriores", r: "+41%" }, { l: "Leads", r: "84" }], link: { rotulo: "Ver análise em Aquisição →", go: () => recorte.irPara("aquisicao") } },
          { titulo: "Maior perda do funil", chip: "intenção → lead", chipTom: "ruim", linhas: [{ l: "Pessoas perdidas", r: "1.998" }, { l: "Taxa da etapa", r: "13,5%" }, { l: "Mediana histórica", r: "22%" }], link: { rotulo: "Ver análise em Comportamento →", go: () => recorte.irPara("comportamento") } },
          { titulo: "Merece atenção", chip: "Apê Gaivota 402", chipTom: "roxo", linhas: [{ l: "Visualizações", r: "1.240" }, { l: "Leads", r: "2" }, { l: "Dias anunciado", r: "21" }], link: { rotulo: "Ver análise em Imóveis →", go: () => recorte.irPara("imoveis") } },
        ]}
      />

      <Cabecalho eyebrow="INDICADORES PRINCIPAIS" titulo="Os números do período, com comparação" nota={recorte.compararAnterior ? "vs. período anterior" : "sem comparação"} />
      <GradeKpis itens={kpis} colunas={6} />

      <Cabecalho eyebrow="FUNIL PRINCIPAL" titulo="Do acesso à chave na mão" cor="#8B00CC" nota="taxa sobre a etapa anterior" />
      <Funil etapas={etapas} foot="“detalhes” aplica o recorte da etapa · sem consentimento Analytics, a etapa continua contada pela coleta própria" />

      <Cabecalho eyebrow="LEITURAS RÁPIDAS" titulo="O que está puxando o resultado" />
      <CartoesLista
        colunas={3}
        cartoes={[
          {
            titulo: "Origens que mais geram negócio",
            linhas: [
              { l: "Instagram orgânico", r: "52", abrir: () => recorte.filtrar("Origem: Instagram orgânico") },
              { l: "Google orgânico", r: "41", abrir: () => recorte.filtrar("Origem: Google orgânico") },
              { l: "Meta Ads", r: "38", abrir: () => recorte.filtrar("Origem: Meta Ads") },
              { l: "Não atribuído", r: "27", corR: "#66009A" },
            ],
            foot: "clicar numa origem filtra a página · não atribuído aparece sempre, nunca é redistribuído",
            link: { rotulo: "Abrir Aquisição →", go: () => recorte.irPara("aquisicao") },
          },
          { titulo: "Captação de proprietários", linhas: [{ l: "Captações recebidas", r: "23" }, { l: "Contatados", r: "19" }, { l: "Publicados", r: "6" }], link: { rotulo: "Abrir Proprietários →", go: () => recorte.irPara("proprietarios") } },
          { titulo: "Sara · assistente de imóveis", fundo: "roxo", linhas: [{ l: "Buscas", r: "1.482" }, { l: "Leads", r: "47" }, { l: "Sem resultado", r: "9%" }], link: { rotulo: "Abrir Sara →", go: () => recorte.irPara("sara") } },
        ]}
      />

      <RodapeFontes
        fontes={["coleta própria", "Google Tag", "GA4 (consentimento 31%)", "CRM Funil 2.0"]}
        pendencias={["valor de pipeline (campo ausente no CRM)", "custo de mídia não conectado", "Clarity sem evento há 3 h"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  visualizacoes: 24_618,
  engajadas: 11_480,
  intencao: 2_310,
  leads: 312,
  negocios: 187,
  visitas: 96,
  fechamentos: 14,
  conversaoPagina: 1.27,
  conversaoLead: 59.9,
  tempoAtendimento: 18,
  pipelineAtribuido: null,
  sessoesGa4: "8.412 · 5.930",
  etapas: [
    { nome: "1 · Página acessada", volume: 24_618, largura: 100, taxa: "100%" },
    { nome: "2 · Imóvel visualizado", volume: 15_204, largura: 62, taxa: "61,8%", perda: "−9.414" },
    { nome: "3 · Ação de intenção", volume: 2_310, largura: 34, taxa: "15,2%", perda: "−12.894" },
    { nome: "4 · Lead enviado", volume: 312, largura: 20, taxa: "13,5%", perda: "−1.998" },
    { nome: "5 · Negócio criado", volume: 187, largura: 15, taxa: "59,9%", perda: "−125" },
    { nome: "6 · Visita agendada", volume: 96, largura: 10, taxa: "51,3%", perda: "−91" },
    { nome: "7 · Venda ou locação", volume: 14, largura: 6, taxa: "14,6%", perda: "−82" },
  ],
  atualizado: "14:28",
};
