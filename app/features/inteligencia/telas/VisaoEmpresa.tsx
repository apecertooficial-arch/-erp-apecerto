"use client";

/* 9 · VISÃO CEO — artboard 14b. Agora lê dado real do CRM via
 * /api/inteligencia/empresa (RPC intel_visao_ceo). Escopo do funil: Funil 2.0.
 * O que não tem fonte confiável (% no SLA de 5 min, previsão ponderada, valor de
 * pipeline) aparece como — com motivo. O demo virou fixture (demoVisaoCeo). */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, IconeInt, type Etapa, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { VisaoCeoPayload } from "../../../lib/inteligencia/tipos";

type Diagnostico = {
  chave: string;
  chip: string;
  tomChip: "bom" | "ruim" | "aviso" | "roxo";
  icone: "tendencia" | "alerta" | "dinheiro" | "relogio";
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

export function VisaoEmpresa({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<VisaoCeoPayload>("empresa", accessToken, recorte);
  const d = mapearVisaoCeo(leitura.payload);

  const kpis: Kpi[] = [
    { rotulo: "Leads recebidos", bruto: d.leads, texto: fmt.inteiro(d.leads), tile: "laranja", foot: `${fmt.inteiro(d.leadsDoSite)} vieram do site` },
    { rotulo: "% no SLA de 5 min", bruto: d.slaPercentual, texto: fmt.porcento(d.slaPercentual, 0), tom: "ruim", tile: "vermelho", motivo: "integracao", detalhe: "sem marco confiável de 1º contato — usamos o backlog de espera", foot: `espera mediana ${fmt.duracaoMin(d.slaMediana)} · P90 ${fmt.duracaoMin(d.slaP90)}` },
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
      <Cabecalho eyebrow="FUNIL DA EMPRESA" titulo="Do lead recebido à chave na mão" cor="#8B00CC" nota="escopo: Funil 2.0 (operação)" />
      <Funil etapas={etapas} foot="“detalhes” aplica o recorte da etapa · etapa sem dado aparece com “—”, nunca some" />

      <RodapeFontes
        fontes={["leads", "negócios (Funil 2.0)", "vendas", "comissões", "metas", "wa_mensagens (SLA)"]}
        pendencias={["% no SLA de 5 min (sem marco de 1º contato)", "previsão ponderada (sem probabilidade por etapa)", "valor de pipeline (campo ausente no CRM)"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO — lê a RPC via hook. */
function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

const CARREGANDO_DIAG: Diagnostico[] = [
  { chave: "d1", chip: "carregando", tomChip: "aviso", icone: "tendencia", tile: "verde", destaque: "Carregando…", texto: "", alvo: "empresa", rotulo: " " },
  { chave: "d2", chip: "carregando", tomChip: "aviso", icone: "relogio", tile: "vermelho", destaque: "Carregando…", texto: "", alvo: "empresa", rotulo: " " },
  { chave: "d3", chip: "carregando", tomChip: "aviso", icone: "dinheiro", tile: "ambar", destaque: "Carregando…", texto: "", alvo: "empresa", rotulo: " " },
  { chave: "d4", chip: "carregando", tomChip: "roxo", icone: "alerta", tile: "roxo", destaque: "Carregando…", texto: "", alvo: "empresa", rotulo: " " },
];

const vazioVisaoCeo: Dados = {
  diagnosticos: CARREGANDO_DIAG,
  leads: null, leadsDoSite: null, slaPercentual: null, slaMediana: null, slaP90: null,
  vendas: null, vgv: null, metaCobertura: null, previsaoPonderada: null, pipelineValor: null,
  funil: [],
  areas: [
    { titulo: "Atendimento", linhas: [{ l: "1º contato · mediana", r: "—" }, { l: "Aguardando resposta", r: "—" }, { l: "Follow-ups vencidos", r: "—" }], alvo: "atendimento", rotulo: "Abrir Atendimento e SLA →" },
    { titulo: "Comercial", linhas: [{ l: "Assinado (ano)", r: "—" }, { l: "Previsão ponderada", r: "—" }, { l: "Falta para a meta", r: "—" }], alvo: "vendas", rotulo: "Abrir Vendas e previsão →" },
    { titulo: "Financeiro", linhas: [{ l: "Receita bruta de comissão", r: "—" }, { l: "Comissões calculadas", r: "—" }, { l: "Contribuição estimada", r: "—" }], alvo: "financeiro", rotulo: "Abrir Financeiro →" },
    { titulo: "Digital", linhas: [{ l: "Leads do site", r: "—" }, { l: "Negócios (Funil 2.0)", r: "—" }, { l: "Melhor canal", r: "—" }], alvo: "digital", rotulo: "Abrir Visão do digital →" },
  ],
  atualizado: "—",
};

function mapearVisaoCeo(p: VisaoCeoPayload | null): Dados {
  if (!p) return vazioVisaoCeo;

  const cob = p.meta_vgv_ano > 0 ? Math.round((100 * p.vgv_ano) / p.meta_vgv_ano) : null;
  const abertos = p.funil.filter((f) => f.nome !== "Ganho" && f.nome !== "Perdido");
  const maior = [...abertos].sort((a, b) => b.volume - a.volume)[0];
  const maxV = Math.max(1, ...p.funil.map((f) => f.volume));
  const topo = abertos[0]?.volume ?? 0;

  const funil = p.funil.map((f, i) => ({
    nome: f.nome,
    volume: f.volume,
    largura: Math.round((100 * f.volume) / maxV),
    taxa: i === 0 ? "100%" : topo > 0 ? `${Math.round((100 * f.volume) / topo)}% do topo` : undefined,
    perdaFinal: f.nome === "Perdido",
  }));

  const faltaMeta = Math.max(0, p.meta_vgv_ano - p.vgv_ano);

  return {
    diagnosticos: [
      {
        chave: "meta", chip: "principal indicador", tomChip: cob !== null && cob >= 100 ? "bom" : "aviso",
        icone: "tendencia", tile: cob !== null && cob >= 100 ? "verde" : "ambar",
        destaque: `Meta do ano coberta em ${fmt.porcento(cob, 0)}`,
        texto: `— ${fmt.dinheiro(p.vgv_ano)} assinado em vendas pagas ou concluídas.`,
        alvo: "vendas", rotulo: "Investigar em Vendas e previsão →",
      },
      {
        chave: "atendimento", chip: "atenção no atendimento", tomChip: "ruim",
        icone: "relogio", tile: "vermelho",
        destaque: `${fmt.inteiro(p.sla.aguardando)} leads aguardando resposta`,
        texto: `; espera mediana de ${fmt.duracaoMin(p.sla.mediana_min)} (últimos 7 dias).`,
        alvo: "atendimento", rotulo: "Investigar em Atendimento e SLA →",
      },
      {
        chave: "financeiro", chip: "risco financeiro", tomChip: "aviso",
        icone: "dinheiro", tile: "ambar",
        destaque: `${fmt.inteiro(p.vendas_sem_comissao)} vendas sem % de comissão`,
        texto: "— sem esse campo a comissão não é calculada.",
        alvo: "financeiro", rotulo: "Investigar em Financeiro →",
      },
      {
        chave: "funil", chip: "gargalo do funil", tomChip: "roxo",
        icone: "alerta", tile: "roxo",
        destaque: maior ? `${fmt.inteiro(maior.volume)} negócios em “${maior.nome}”` : "Funil sem acúmulo",
        texto: "— maior concentração de abertos no Funil 2.0.",
        alvo: "vendas", rotulo: "Investigar em Vendas e previsão →",
      },
    ],
    leads: p.leads,
    leadsDoSite: p.leads_site,
    slaPercentual: null,
    slaMediana: p.sla.mediana_min,
    slaP90: p.sla.p90_min,
    vendas: p.vendas,
    vgv: p.vgv,
    metaCobertura: cob,
    previsaoPonderada: null,
    pipelineValor: p.pipeline_valor,
    funil,
    areas: [
      { titulo: "Atendimento", linhas: [{ l: "Espera · mediana", r: fmt.duracaoMin(p.sla.mediana_min), corR: "#D93E3E" }, { l: "Aguardando resposta", r: fmt.inteiro(p.sla.aguardando), corR: "#D93E3E" }, { l: "Follow-ups vencidos", r: "—" }], alvo: "atendimento", rotulo: "Abrir Atendimento e SLA →" },
      { titulo: "Comercial", linhas: [{ l: "Assinado (ano)", r: fmt.dinheiro(p.vgv_ano) }, { l: "Previsão ponderada", r: "—" }, { l: "Falta para a meta", r: fmt.dinheiro(faltaMeta), corR: "#B5700A" }], alvo: "vendas", rotulo: "Abrir Vendas e previsão →" },
      { titulo: "Financeiro", linhas: [{ l: "Receita bruta de comissão", r: "—" }, { l: "Comissões calculadas", r: fmt.dinheiro(p.comissoes_total) }, { l: "Contribuição estimada", r: "—" }], alvo: "financeiro", rotulo: "Abrir Financeiro →" },
      { titulo: "Digital", linhas: [{ l: "Leads do site", r: fmt.inteiro(p.leads_site) }, { l: "Negócios (Funil 2.0)", r: fmt.inteiro(p.negocios_f2_abertos) }, { l: "Melhor canal", r: "—" }], alvo: "digital", rotulo: "Abrir Visão do digital →" },
    ],
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só para Storybook/teste. NUNCA usado na rota de produção. */
export const demoVisaoCeo: Dados = {
  diagnosticos: [
    { chave: "oportunidade", chip: "principal oportunidade", tomChip: "bom", icone: "tendencia", tile: "verde", destaque: "O pipeline ponderado cobre 102% da meta", texto: "— faltam 9 visitas viradas em proposta para garantir o mês.", alvo: "vendas", rotulo: "Investigar em Vendas e previsão →" },
    { chave: "gargalo", chip: "maior gargalo", tomChip: "ruim", icone: "alerta", tile: "vermelho", destaque: "Qualificado → visita caiu de 61% para 52%", texto: ", concentrado na equipe do Carlos.", alvo: "gerentes", rotulo: "Investigar em Gerentes →" },
    { chave: "financeiro", chip: "risco financeiro", tomChip: "aviso", icone: "dinheiro", tile: "ambar", destaque: "3 vendas sem % de comissão válido", texto: "— R$ 2,9 mi de VGV sem cálculo.", alvo: "financeiro", rotulo: "Investigar em Financeiro →" },
    { chave: "atendimento", chip: "problema de atendimento", tomChip: "roxo", icone: "relogio", tile: "roxo", destaque: "O P90 da 1ª resposta subiu para 1 h 52", texto: "; 28 leads esperaram mais de 60 min.", alvo: "atendimento", rotulo: "Investigar em Atendimento e SLA →" },
  ],
  leads: 486, leadsDoSite: 312, slaPercentual: 22, slaMediana: 14, slaP90: 112,
  vendas: 21, vgv: 18_400_000, metaCobertura: 77, previsaoPonderada: 102, pipelineValor: null,
  funil: [
    { nome: "Lead recebido", volume: 486, largura: 100, taxa: "100%" },
    { nome: "Negócio criado", volume: 291, largura: 60, taxa: "59,9%", perda: "−195" },
    { nome: "Qualificado", volume: 128, largura: 41, taxa: "50,2%", perda: "−127" },
    { nome: "Visita agendada", volume: 96, largura: 31, taxa: "75,0%", perda: "−32" },
    { nome: "Venda ou locação", volume: 21, largura: 7, taxa: "45,7%", perda: "−25" },
    { nome: "Perdido", volume: 112, largura: 23, taxa: "38,5%", perdaFinal: true },
  ],
  areas: [
    { titulo: "Atendimento", linhas: [{ l: "1º contato · mediana", r: "14 min", corR: "#D93E3E" }, { l: "Sem resposta agora", r: "9", corR: "#D93E3E" }, { l: "Follow-ups vencidos", r: "57" }], alvo: "atendimento", rotulo: "Abrir Atendimento e SLA →" },
    { titulo: "Comercial", linhas: [{ l: "Assinado", r: "R$ 18,4 mi" }, { l: "Previsão ponderada", r: "R$ 6,1 mi" }, { l: "Falta para a meta", r: "R$ 5,6 mi", corR: "#B5700A" }], alvo: "vendas", rotulo: "Abrir Vendas e previsão →" },
    { titulo: "Financeiro", linhas: [{ l: "Receita bruta de comissão", r: "R$ 920 mil" }, { l: "Comissões calculadas", r: "R$ 488 mil" }, { l: "Contribuição estimada", r: "R$ 358 mil" }], alvo: "financeiro", rotulo: "Abrir Financeiro →" },
    { titulo: "Digital", linhas: [{ l: "Leads do site", r: "312" }, { l: "Negócios", r: "187" }, { l: "Melhor canal", r: "Meta Ads · 72%" }], alvo: "digital", rotulo: "Abrir Visão do digital →" },
  ],
  atualizado: "14:32",
};
