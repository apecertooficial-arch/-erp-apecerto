"use client";

/* 9 · VISÃO CEO — artboard 14b, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. DIAGNÓSTICOS — quatro leituras, cada uma com impacto e ação (principal
 *      oportunidade, maior gargalo, risco financeiro, problema de atendimento)
 *   2. os números da empresa em cinco cartões
 *   3. as quatro áreas, uma linha por frente, com o caminho para a página
 *   4. funil da empresa
 *   5. rodapé de fontes
 *
 * O briefing do Copiloto entra acima disto, montado pela casca.
 */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, IconeInt, type Etapa, type Kpi, type NomeIcone } from "../pecas";

type Diagnostico = {
  chave: string;
  chip: string;
  tomChip: "bom" | "ruim" | "aviso" | "roxo";
  icone: NomeIcone;
  tile: "laranja" | "roxo" | "verde" | "vermelho" | "ambar";
  texto: string;
  destaque: string;
  alvo: string;
  rotulo: string;
};

type Dados = {
  diagnosticos: Diagnostico[];
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
  const d = usarDados();
  const [aberto, setAberto] = useState<string | null>(null);

  const kpis: Kpi[] = [
    { rotulo: "Leads recebidos", bruto: d.leads, texto: fmt.inteiro(d.leads), tile: "laranja", foot: `${fmt.inteiro(d.leadsDoSite)} vieram do site` },
    { rotulo: "% no SLA de 5 min", bruto: d.slaPercentual, texto: fmt.porcento(d.slaPercentual, 0), tom: "ruim", tile: "vermelho", foot: `mediana ${fmt.duracaoMin(d.slaMediana)} · P90 ${fmt.duracaoMin(d.slaP90)}` },
    { rotulo: "Vendas e locações", bruto: d.vendas, texto: fmt.inteiro(d.vendas), tile: "verde", foot: `${fmt.dinheiro(d.vgv)} de VGV` },
    { rotulo: "Cobertura da meta", bruto: d.metaCobertura, texto: fmt.porcento(d.metaCobertura, 0), tile: "roxo", foot: `previsão ponderada ${fmt.porcento(d.previsaoPonderada, 0)}` },
    { rotulo: "Valor de pipeline", bruto: d.pipelineValor, texto: fmt.dinheiro(d.pipelineValor), tile: "ambar", icone: "dinheiro", chip: "aguardando dado do CRM", chipTom: "aviso", motivo: "integracao", detalhe: "campo de valor ausente no Funil 2.0", foot: "nunca estimado por média" },
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
      {/* 1 · DIAGNÓSTICOS */}
      <Cabecalho eyebrow="DIAGNÓSTICOS" titulo="Quatro leituras, cada uma com impacto e ação" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {d.diagnosticos.map((g) => (
          <div className="intp-cartao" key={g.chave} style={{ borderTop: `3px solid ${g.tomChip === "bom" ? "#1FA85A" : g.tomChip === "ruim" ? "#D93E3E" : g.tomChip === "aviso" ? "#B5700A" : "#8B00CC"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className={`intp-tile tile-${g.tile}`}>
                <IconeInt nome={g.icone} tamanho={15} />
              </span>
              <span className={`intp-cartao-chip tom-${g.tomChip}`}>{g.chip}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#4D4842" }}>
              <b style={{ color: "#1F1C1A" }}>{g.destaque}</b> {g.texto}
            </p>
            <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto" }} onClick={() => recorte.irPara(g.alvo)}>
              {g.rotulo}
            </button>
          </div>
        ))}
      </div>

      {/* 2 · OS NÚMEROS */}
      <Cabecalho eyebrow="INDICADORES DA EMPRESA" titulo="O período inteiro em cinco números" cor="#8B00CC" />
      <GradeKpis itens={kpis} colunas={5} />

      {/* 3 · AS QUATRO ÁREAS */}
      <Cabecalho eyebrow="AS QUATRO ÁREAS" titulo="Uma linha por frente, com o caminho para a página" />
      <CartoesLista
        colunas={4}
        cartoes={d.areas.map((a) => ({
          titulo: a.titulo,
          linhas: a.linhas,
          link: { rotulo: a.rotulo, go: () => recorte.irPara(a.alvo) },
        }))}
      />

      {/* 4 · FUNIL */}
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
  diagnosticos: [
    {
      chave: "oportunidade",
      chip: "principal oportunidade",
      tomChip: "bom",
      icone: "tendencia",
      tile: "verde",
      destaque: "O pipeline ponderado cobre 102% da meta",
      texto: "— faltam 9 visitas viradas em proposta para garantir o mês.",
      alvo: "vendas",
      rotulo: "Investigar em Vendas e previsão →",
    },
    {
      chave: "gargalo",
      chip: "maior gargalo",
      tomChip: "ruim",
      icone: "alerta",
      tile: "vermelho",
      destaque: "Qualificado → visita caiu de 61% para 52%",
      texto: ", concentrado na equipe do Carlos — custa ~6 visitas por mês.",
      alvo: "gerentes",
      rotulo: "Investigar em Gerentes →",
    },
    {
      chave: "financeiro",
      chip: "risco financeiro",
      tomChip: "aviso",
      icone: "dinheiro",
      tile: "ambar",
      destaque: "3 vendas sem % de comissão válido",
      texto: "— R$ 2,9 mi de VGV sem cálculo de comissão nem contribuição.",
      alvo: "financeiro",
      rotulo: "Investigar em Financeiro →",
    },
    {
      chave: "atendimento",
      chip: "problema de atendimento",
      tomChip: "roxo",
      icone: "relogio",
      tile: "roxo",
      destaque: "O P90 da 1ª resposta subiu para 1 h 52",
      texto: "; 28 leads esperaram mais de 60 min — quase todos no fim de semana.",
      alvo: "atendimento",
      rotulo: "Investigar em Atendimento e SLA →",
    },
  ],
  leads: 486,
  leadsDoSite: 312,
  slaPercentual: 22,
  slaMediana: 14,
  slaP90: 112,
  vendas: 21,
  vgv: 18_400_000,
  metaCobertura: 77,
  previsaoPonderada: 102,
  pipelineValor: null,
  areas: [
    { titulo: "Atendimento", linhas: [{ l: "1º contato · mediana", r: "14 min", corR: "#D93E3E" }, { l: "Sem resposta agora", r: "9", corR: "#D93E3E" }, { l: "Follow-ups vencidos", r: "57" }], alvo: "atendimento", rotulo: "Abrir Atendimento e SLA →" },
    { titulo: "Comercial", linhas: [{ l: "Assinado", r: "R$ 18,4 mi" }, { l: "Previsão ponderada", r: "R$ 6,1 mi" }, { l: "Falta para a meta", r: "R$ 5,6 mi", corR: "#B5700A" }], alvo: "vendas", rotulo: "Abrir Vendas e previsão →" },
    { titulo: "Financeiro", linhas: [{ l: "Receita bruta de comissão", r: "R$ 920 mil" }, { l: "Comissões calculadas", r: "R$ 488 mil" }, { l: "Contribuição estimada", r: "R$ 358 mil" }], alvo: "financeiro", rotulo: "Abrir Financeiro →" },
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
  atualizado: "14:32",
};
