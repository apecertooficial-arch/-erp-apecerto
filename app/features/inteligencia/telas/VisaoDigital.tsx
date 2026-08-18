"use client";

/* 1 · VISÃO DO DIGITAL — artboard 2a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. faixa de diagnóstico (3 cartões com ícone, chip e link)
 *   2. indicadores principais (12 KPIs em duas fileiras de 6)
 *   3. evolução do período (séries clicáveis que viram chip de filtro)
 *   4. funil principal, do acesso à chave na mão (7 etapas)
 *   5. leituras rápidas (origens, captação, Sara em cartão roxo)
 *   6. rodapé de fontes com as pendências declaradas
 *
 * CONTRATO DE DADO: 0 é dado real e aparece como 0; ausência aparece como “—” com
 * o motivo (dado.tsx). Nenhum bloco desaparece por falta de dado.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, IconeInt, type Etapa, type Kpi } from "../pecas";

type Serie = { rotulo: string; cor: string; chip: string };

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
  series: Serie[];
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
    { rotulo: "Tempo até 1º atendimento", bruto: d.tempoAtendimento, texto: fmt.duracaoMin(d.tempoAtendimento), chip: "▲ 6 min mais rápido", chipTom: "bom", foot: "mediana · meta 5 min" },
    { rotulo: "Pipeline atribuído ao site", bruto: d.pipelineAtribuido, texto: fmt.dinheiro(d.pipelineAtribuido), chip: "aguardando dado do CRM", chipTom: "aviso", motivo: "integracao", detalhe: "valor do negócio ausente no Funil 2.0", foot: "Aparece quando o valor do negócio existir no Funil 2.0." },
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
      {/* 1 · FAIXA DE DIAGNÓSTICO */}
      <Cabecalho eyebrow="FAIXA DE DIAGNÓSTICO" titulo="Três leituras do período, direto do dado" nota={recorte.periodo} />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="intp-cartao">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="intp-tile tile-verde"><IconeInt nome="tendencia" /></span>
            <span className="intp-cartao-chip tom-bom">maior crescimento</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            <b>Instagram orgânico</b> gerou <b>52 negócios</b>, 41% acima dos 30 dias anteriores.
          </p>
          <button type="button" className="int-link" style={{ fontWeight: 700 }} onClick={() => recorte.irPara("aquisicao")}>Ver análise em Aquisição →</button>
        </div>
        <div className="intp-cartao">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="intp-tile tile-vermelho"><IconeInt nome="alerta" /></span>
            <span className="intp-cartao-chip tom-ruim">maior perda do funil</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            <b>Intenção → lead</b> perdeu <b>1.998 pessoas</b> (86,5%); a mediana histórica é 78%.
          </p>
          <button type="button" className="int-link" style={{ fontWeight: 700 }} onClick={() => recorte.irPara("comportamento")}>Ver análise em Comportamento →</button>
        </div>
        <div className="intp-cartao">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="intp-tile tile-roxo"><IconeInt nome="faisca" /></span>
            <span className="intp-cartao-chip tom-roxo">merece atenção</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            <b>Apê Gaivota 402</b> (MO-118): 1.240 visualizações e 2 leads em 21 dias anunciado.
          </p>
          <button type="button" className="int-link" style={{ fontWeight: 700 }} onClick={() => recorte.irPara("imoveis")}>Ver análise em Imóveis →</button>
        </div>
      </div>

      {/* 2 · INDICADORES PRINCIPAIS — 12 KPIs, duas fileiras de 6 */}
      <Cabecalho eyebrow="INDICADORES PRINCIPAIS" titulo="Os números do período, com comparação" nota={recorte.compararAnterior ? "vs. período anterior" : "sem comparação"} />
      <GradeKpis itens={kpis} colunas={6} />

      {/* 3 · EVOLUÇÃO */}
      <Cabecalho eyebrow="EVOLUÇÃO" titulo="Como o período se moveu" cor="#8B00CC" nota="pontilhado = período anterior" />
      <div className="intp-cartao">
        <svg width="100%" height="190" viewBox="0 0 560 190" preserveAspectRatio="none" role="img" aria-label="Evolução do período">
          <line x1="0" y1="47" x2="560" y2="47" stroke="#F2EFEC" strokeWidth="1" />
          <line x1="0" y1="95" x2="560" y2="95" stroke="#F2EFEC" strokeWidth="1" />
          <line x1="0" y1="142" x2="560" y2="142" stroke="#F2EFEC" strokeWidth="1" />
          <polyline points="0,124 51,110 102,118 153,92 204,102 255,74 306,86 357,58 408,70 459,44 510,58 560,32" fill="none" stroke="#C9C2BA" strokeWidth="1.5" strokeDasharray="4 4" />
          <polyline points="0,114 51,100 102,108 153,82 204,94 255,64 306,78 357,50 408,62 459,36 510,50 560,26" fill="none" stroke="#FF7000" strokeWidth="2.5" />
          <polyline points="0,160 51,152 102,156 153,142 204,148 255,132 306,140 357,124 408,130 459,116 510,124 560,110" fill="none" stroke="#8B00CC" strokeWidth="2.5" />
          <polyline points="0,178 51,174 102,176 153,168 204,172 255,164 306,168 357,160 408,164 459,156 510,160 560,152" fill="none" stroke="#4D4842" strokeWidth="2" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {d.series.map((s) => (
            <button key={s.rotulo} type="button" className="int-chip-filtro" onClick={() => recorte.filtrar(s.chip)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.cor, flex: "none" }} />
              {s.rotulo}
            </button>
          ))}
        </div>
        <small className="intp-kpi-foot">cada série na própria escala · clicar numa série aplica o filtro à página inteira</small>
      </div>

      {/* 4 · FUNIL PRINCIPAL */}
      <Cabecalho eyebrow="FUNIL PRINCIPAL" titulo="Do acesso à chave na mão" cor="#8B00CC" nota="taxa sobre a etapa anterior" />
      <Funil etapas={etapas} foot="“detalhes” abre pessoas, campanhas, páginas e imóveis, conforme a sua permissão · etapa sem dado mostra “—” e continua na lista" />

      {/* 5 · LEITURAS RÁPIDAS */}
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
            foot: "clicar numa origem filtra a página",
            link: { rotulo: "Abrir Aquisição →", go: () => recorte.irPara("aquisicao") },
          },
          {
            titulo: "Captação de proprietários",
            linhas: [
              { l: "Captações recebidas", r: "23" },
              { l: "Contatados", r: "19" },
              { l: "Publicados", r: "6" },
            ],
            link: { rotulo: "Abrir Proprietários →", go: () => recorte.irPara("proprietarios") },
          },
          {
            titulo: "Sara · assistente de imóveis",
            fundo: "roxo",
            linhas: [
              { l: "Buscas", r: "1.482" },
              { l: "Leads", r: "47" },
              { l: "Sem resultado", r: "9%" },
            ],
            link: { rotulo: "Abrir Sara →", go: () => recorte.irPara("sara") },
          },
        ]}
      />

      {/* 6 · RODAPÉ DE FONTES */}
      <RodapeFontes
        fontes={["coleta própria", "Google Tag", "GA4 (consentimento 31%)", "CRM Funil 2.0"]}
        pendencias={["pipeline atribuído (campo de valor ausente no CRM)", "custo de mídia não conectado", "Clarity sem evento há 3 h"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* Ponto único de troca para a conexão com o banco. Campo que vier nulo cai no
   contrato de dado ausente sem mexer em uma linha de layout. */
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
  series: [
    { rotulo: "Visualizações", cor: "#FF7000", chip: "Série: Visualizações" },
    { rotulo: "Leads", cor: "#8B00CC", chip: "Série: Leads" },
    { rotulo: "Negócios", cor: "#4D4842", chip: "Série: Negócios" },
  ],
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
