"use client";

/* 9 · VISÃO CEO — artboard 14b, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. o período inteiro em cinco números
 *   2. diagnóstico: onde está o dinheiro e onde está o problema (lista + detalhe)
 *   3. as quatro áreas em uma linha cada (atendimento, comercial, financeiro, digital)
 *   4. funil da empresa
 *   5. rodapé de fontes
 *
 * O briefing do Copiloto entra acima disto, montado pela casca.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, ListaComDetalhe, type Detalhe, type Etapa, type Kpi } from "../pecas";

type Dados = {
  leads: number | null;
  leadsDoSite: number | null;
  slaPercentual: number | null;
  slaMediana: number | null;
  slaP90: number | null;
  vendas: number | null;
  vgv: number | null;
  metaCobertura: number | null;
  previsaoPonderada: number | null;
  pipelineValor: number | null;
  funil: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string; perdaFinal?: boolean }[];
  areas: { titulo: string; linhas: { l: string; r: string; corR?: string }[]; alvo: string; rotulo: string }[];
  atualizado: string;
};

export function VisaoEmpresa({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Leads recebidos", bruto: d.leads, texto: fmt.inteiro(d.leads), tile: "laranja", foot: `${fmt.inteiro(d.leadsDoSite)} vieram do site` },
    { rotulo: "% no SLA de 5 min", bruto: d.slaPercentual, texto: fmt.porcento(d.slaPercentual, 0), tom: "ruim", tile: "vermelho", foot: `mediana ${fmt.duracaoMin(d.slaMediana)} · P90 ${fmt.duracaoMin(d.slaP90)}` },
    { rotulo: "Vendas e locações", bruto: d.vendas, texto: fmt.inteiro(d.vendas), tile: "verde", foot: `${fmt.dinheiro(d.vgv)} de VGV` },
    { rotulo: "Cobertura da meta", bruto: d.metaCobertura, texto: fmt.porcento(d.metaCobertura, 0), tile: "roxo", foot: `previsão ponderada ${fmt.porcento(d.previsaoPonderada, 0)}` },
    { rotulo: "Valor de pipeline", bruto: d.pipelineValor, texto: fmt.dinheiro(d.pipelineValor), tile: "ambar", icone: "dinheiro", chip: "aguardando dado do CRM", chipTom: "aviso", motivo: "integracao", detalhe: "campo de valor ausente no Funil 2.0", foot: "nunca estimado por média" },
  ];

  const linhas = [
    {
      chave: "sla",
      nome: "Só 22% dentro do SLA",
      meio: "atendimento",
      fim: "379 leads",
      cor: "#D93E3E",
      det: { titulo: "SLA de primeiro contato", sub: "486 leads · meta 5 min", linhas: [["Dentro de 5 min", "107"], ["5 a 15 min", "94"], ["15 a 60 min", "138"], ["Acima de 60 min", "147"]] as [string, string][], aviso: "A lista de pessoas por trás deste número exige permissão de dados pessoais." },
    },
    {
      chave: "funil",
      nome: "Qualificado → visita cai 52%",
      meio: "funil",
      fim: "−32",
      cor: "#B5700A",
      det: { titulo: "Etapa qualificado → visita", sub: "128 → 96", linhas: [["Perda absoluta", "32"], ["Equipe Venda", "−11"], ["Equipe Locação", "−21"], ["Motivo mais comum", "sem resposta"]] as [string, string][], aviso: "Sem IP bruto, sem user agent: só o que serve para atender a pessoa." },
    },
    {
      chave: "aquisicao",
      nome: "Meta Ads converte 72% em negócio",
      meio: "aquisição",
      fim: "23 negócios",
      cor: "#1FA85A",
      det: { titulo: "Meta Ads", sub: "melhor conversão do período", linhas: [["Leads", "32"], ["Negócios", "23"], ["Lead → negócio", "72%"], ["Custo por lead", "— não conectado"]] as [string, string][], aviso: "Custos de mídia não conectados: CPL e ROAS aparecem depois da integração." },
    },
    {
      chave: "comissao",
      nome: "R$ 127,0 mil de comissão pendente",
      meio: "financeiro",
      fim: "8 pessoas",
      cor: "#B5700A",
      det: { titulo: "Comissões pendentes", sub: "fechamento do mês", linhas: [["Calculadas", "R$ 488,0 mil"], ["Pagas", "R$ 361,0 mil"], ["Pendentes", "R$ 127,0 mil"], ["Bloqueadas por % ausente", "2 vendas"]] as [string, string][], aviso: "Valores financeiros só para CEO, diretoria e Financeiro." },
    },
    {
      chave: "meta",
      nome: "Meta do mês em 77%",
      meio: "comercial",
      fim: "R$ 5,6 mi",
      cor: "#B5700A",
      det: { titulo: "Cobertura da meta", sub: "meta de R$ 24 mi", linhas: [["Assinado", "R$ 18,4 mi"], ["Proposta ponderada", "R$ 6,2 mi"], ["Falta", "R$ 5,6 mi"], ["Previsão ponderada", "92%"]] as [string, string][], aviso: "Previsão carrega sempre a data do pipeline que a gerou." },
    },
  ];

  const etapas: Etapa[] = d.funil.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    perdaFinal: e.perdaFinal,
    detalhes: () => recorte.filtrar(`Etapa: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="INDICADORES DA EMPRESA" titulo="O período inteiro em cinco números" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. período anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={5} />

      <ListaComDetalhe
        eyebrow="DIAGNÓSTICO DO PERÍODO"
        titulo="Onde está o dinheiro e onde está o problema"
        nota="clique numa linha para abrir a evidência"
        linhas={linhas.map((l) => ({ chave: l.chave, nome: l.nome, meio: l.meio, fim: l.fim, cor: l.cor, ativa: detalhe?.titulo === l.det.titulo, abrir: () => setDetalhe(l.det) }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="AS QUATRO ÁREAS" titulo="Uma linha por frente, com o caminho para a página" cor="#8B00CC" />
      <CartoesLista
        colunas={4}
        cartoes={d.areas.map((a) => ({
          titulo: a.titulo,
          linhas: a.linhas,
          link: { rotulo: a.rotulo, go: () => recorte.irPara(a.alvo) },
        }))}
      />

      <Cabecalho eyebrow="FUNIL DA EMPRESA" titulo="Do lead recebido à chave na mão" cor="#8B00CC" nota="todos os leads, não só os do site" />
      <Funil etapas={etapas} foot="“detalhes” aplica o recorte da etapa · etapa sem dado aparece com “—”, nunca some" />

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "comissões", "metas", "CRM Funil 2.0"]}
        pendencias={["valor de pipeline (campo ausente no CRM)", "custo de mídia não conectado", "escala/ponto não integrado"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  leads: 486,
  leadsDoSite: 312,
  slaPercentual: 22,
  slaMediana: 21,
  slaP90: 130,
  vendas: 21,
  vgv: 18_400_000,
  metaCobertura: 77,
  previsaoPonderada: 92,
  pipelineValor: null,
  areas: [
    { titulo: "Atendimento", linhas: [{ l: "1º contato · mediana", r: "21 min", corR: "#D93E3E" }, { l: "Sem resposta agora", r: "9", corR: "#D93E3E" }, { l: "Follow-ups vencidos", r: "57" }], alvo: "atendimento", rotulo: "Abrir Atendimento e SLA →" },
    { titulo: "Comercial", linhas: [{ l: "Assinado", r: "R$ 18,4 mi" }, { l: "Proposta ponderada", r: "R$ 6,2 mi" }, { l: "Falta para a meta", r: "R$ 5,6 mi", corR: "#B5700A" }], alvo: "vendas", rotulo: "Abrir Vendas e previsão →" },
    { titulo: "Financeiro", linhas: [{ l: "Receita reconhecida", r: "R$ 812,0 mil" }, { l: "Comissões", r: "R$ 488,0 mil" }, { l: "Pendente", r: "R$ 127,0 mil", corR: "#B5700A" }], alvo: "financeiro", rotulo: "Abrir Financeiro →" },
    { titulo: "Digital", linhas: [{ l: "Leads do site", r: "312" }, { l: "Negócios", r: "187" }, { l: "Melhor canal", r: "Meta Ads · 72%" }], alvo: "digital", rotulo: "Abrir Visão do digital →" },
  ],
  funil: [
    { nome: "Lead recebido", volume: 486, largura: 100, taxa: "100%" },
    { nome: "Negócio criado", volume: 291, largura: 60, taxa: "59,9%", perda: "−195" },
    { nome: "Primeiro contato", volume: 255, largura: 53, taxa: "87,6%", perda: "−36" },
    { nome: "Qualificado", volume: 128, largura: 41, taxa: "50,2%", perda: "−127" },
    { nome: "Visita agendada", volume: 96, largura: 31, taxa: "75,0%", perda: "−32" },
    { nome: "Proposta", volume: 46, largura: 15, taxa: "47,9%", perda: "−50" },
    { nome: "Venda ou locação", volume: 21, largura: 7, taxa: "45,7%", perda: "−25" },
    { nome: "Perdido", volume: 112, largura: 23, taxa: "38,5%", perdaFinal: true },
  ],
  atualizado: "14:28",
};
