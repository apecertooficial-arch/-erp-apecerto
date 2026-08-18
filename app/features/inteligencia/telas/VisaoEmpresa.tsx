"use client";

/* VISÃO DA EMPRESA — artboard 14b.
 *
 * A pergunta da tela: o que melhorou e o que piorou na imobiliária inteira neste
 * período, e onde agir hoje.
 *
 * DADOS: ainda de demonstração, declarados em `demo` no fim do arquivo. Quando a
 * conexão com o banco entrar, só a função `usarDados` muda — a tela não. Campo
 * que vier ausente cai no contrato de dado.tsx: "—" com selo, sem esconder bloco.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, Funil, GradeKpis, ListaComDetalhe, CartoesLista, type Detalhe, type Etapa, type Kpi } from "../pecas";

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
  /** Pipeline em valor: campo que pode não existir no CRM — nasce ausente de propósito. */
  pipelineValor: number | null;
  funil: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string; perdaFinal?: boolean }[];
  atualizado: string;
};

export function VisaoEmpresa({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Leads recebidos", bruto: d.leads, texto: fmt.inteiro(d.leads), tile: "laranja", foot: d.leadsDoSite === null ? "origem do site aguardando conexão" : `${fmt.inteiro(d.leadsDoSite)} vieram do site` },
    { rotulo: "% no SLA de 5 min", bruto: d.slaPercentual, texto: fmt.porcento(d.slaPercentual, 0), tom: "ruim", tile: "vermelho", foot: `mediana ${fmt.duracaoMin(d.slaMediana)} · P90 ${fmt.duracaoMin(d.slaP90)}` },
    { rotulo: "Vendas e locações", bruto: d.vendas, texto: fmt.inteiro(d.vendas), tile: "verde", foot: `${fmt.dinheiro(d.vgv)} de VGV` },
    { rotulo: "Cobertura da meta", bruto: d.metaCobertura, texto: fmt.porcento(d.metaCobertura, 0), tile: "roxo", foot: `previsão ponderada ${fmt.porcento(d.previsaoPonderada, 0)}` },
    { rotulo: "Valor de pipeline", bruto: d.pipelineValor, texto: fmt.dinheiro(d.pipelineValor), tile: "ambar", motivo: "integracao", detalhe: "campo de valor ainda não existe no Funil 2.0", foot: "aparece sozinho quando o campo existir — nunca estimado por média" },
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

  const linhas = [
    {
      chave: "sla",
      nome: "Só 22% dentro do SLA",
      meio: "atendimento",
      fim: "379 leads",
      cor: "#D93E3E",
      abrir: () =>
        setDetalhe({
          titulo: "SLA de primeiro contato",
          sub: "486 leads · meta 5 min",
          linhas: [["Dentro de 5 min", "107"], ["5 a 15 min", "94"], ["15 a 60 min", "138"], ["Acima de 60 min", "147"]],
          aviso: "A lista de pessoas por trás deste número exige permissão de dados pessoais.",
        }),
    },
    {
      chave: "funil",
      nome: "Qualificado → visita cai 52%",
      meio: "funil",
      fim: "−32",
      cor: "#B5700A",
      abrir: () =>
        setDetalhe({
          titulo: "Etapa qualificado → visita",
          sub: "128 → 96",
          linhas: [["Perda absoluta", "32"], ["Equipe Venda", "−11"], ["Equipe Locação", "−21"], ["Motivo mais comum", "sem resposta"]],
          aviso: "Sem IP bruto, sem user agent: só o que serve para atender a pessoa.",
        }),
    },
    {
      chave: "aquisicao",
      nome: "Meta Ads converte 52 negócios",
      meio: "aquisição",
      fim: "72 leads",
      cor: "#1FA85A",
      abrir: () =>
        setDetalhe({
          titulo: "Meta Ads",
          sub: "melhor conversão do período",
          linhas: [["Leads", "72"], ["Negócios", "52"], ["Visitas", "31"], ["Custo por lead", "— não conectado"]],
          aviso: "Custos de mídia ainda não conectados: CPL e ROAS aparecem depois da integração.",
        }),
    },
    {
      chave: "comissao",
      nome: "R$ 127,0 mil de comissão pendente",
      meio: "financeiro",
      fim: "8 pessoas",
      cor: "#B5700A",
      abrir: () =>
        setDetalhe({
          titulo: "Comissões pendentes",
          sub: "fechamento do mês",
          linhas: [["Calculadas", "R$ 488,0 mil"], ["Pagas", "R$ 361,0 mil"], ["Pendentes", "R$ 127,0 mil"], ["Bloqueadas por % ausente", "2 vendas"]],
          aviso: "Valores financeiros só para CEO, diretoria e Financeiro.",
        }),
    },
  ].map((l) => ({ ...l, ativa: detalhe?.titulo === undefined ? false : undefined }));

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="INDICADORES DA EMPRESA" titulo="O período inteiro em cinco números" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. período anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={5} />

      <ListaComDetalhe
        eyebrow="DIAGNÓSTICO DO PERÍODO"
        titulo="Onde está o dinheiro e onde está o problema"
        nota="clique numa linha para abrir a evidência"
        linhas={linhas}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
        rodape={
          <CartoesLista
            colunas={1}
            cartoes={[
              {
                titulo: "Atalhos do diagnóstico",
                linhas: [
                  { l: "Fila de atendimento e SLA", r: "abrir →", abrir: () => recorte.irPara("atendimento") },
                  { l: "Vendas e previsão da meta", r: "abrir →", abrir: () => recorte.irPara("vendas") },
                  { l: "Financeiro e comissões", r: "abrir →", abrir: () => recorte.irPara("financeiro") },
                ],
                foot: "o recorte atual segue com você",
              },
            ]}
          />
        }
      />

      <Cabecalho eyebrow="FUNIL DA EMPRESA" titulo="Do lead recebido à chave na mão" cor="#8B00CC" nota="taxa sobre a etapa anterior" />
      <Funil etapas={etapas} foot="“detalhes” aplica o recorte da etapa à página · etapa sem dado aparece com “—”, nunca some" />

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "comissões", "metas"]}
        pendencias={["valor de pipeline (campo ausente no CRM)", "custo de mídia (Google Ads e Meta Ads não conectados)", "escala/ponto (não integrado)"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* Ponto único de troca para a conexão com o banco.
 *
 * Hoje devolve a demonstração aprovada no desenho. Amanhã devolve o que o
 * endpoint responder — e qualquer campo que vier nulo já cai no contrato de dado
 * ausente sem mexer em uma linha de layout. */
function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  leads: 486,
  leadsDoSite: 312,
  slaPercentual: 22,
  slaMediana: 18,
  slaP90: 130,
  vendas: 21,
  vgv: 18_400_000,
  metaCobertura: 77,
  previsaoPonderada: 92,
  pipelineValor: null,
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
