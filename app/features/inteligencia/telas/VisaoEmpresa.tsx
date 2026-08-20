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

import { useMemo } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, IconeInt, type Etapa, type Kpi, type NomeIcone } from "../pecas";
import { useResumoInteligencia, type Tracking360Resumo } from "../usar-resumo";

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

export function VisaoEmpresa({ accessToken, recorte }: PropsTela) {
  const d = useDados(accessToken, recorte.periodo);

  const kpis: Kpi[] = [
    { rotulo: "Leads recebidos", bruto: d.leads, texto: fmt.inteiro(d.leads), tile: "laranja", foot: `${fmt.inteiro(d.leadsDoSite)} vieram do site` },
    { rotulo: "% no SLA de 5 min", bruto: d.slaPercentual, texto: fmt.porcento(d.slaPercentual, 0), tom: "ruim", tile: "vermelho", foot: `mediana ${fmt.duracaoMin(d.slaMediana)} · P90 ${fmt.duracaoMin(d.slaP90)}` },
    { rotulo: "Vendas e locações", bruto: d.vendas, texto: fmt.inteiro(d.vendas), tile: "verde", foot: `${fmt.dinheiro(d.vgv)} de VGV` },
    { rotulo: "Cobertura da meta", bruto: d.metaCobertura, texto: fmt.porcento(d.metaCobertura, 0), tile: "roxo", foot: `previsão ponderada ${fmt.porcento(d.previsaoPonderada, 0)}` },
    {
      rotulo: "Valor de pipeline",
      bruto: d.pipelineValor,
      texto: fmt.dinheiro(d.pipelineValor),
      tile: "ambar",
      icone: "dinheiro",
      ...(d.pipelineValor === null
        ? { chip: "aguardando dado do CRM", chipTom: "aviso" as const, motivo: "integracao" as const, detalhe: "campo de valor ausente no Funil 2.0" }
        : {}),
      foot: "nunca estimado por média",
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

function useDados(accessToken: string, periodo: string): Dados {
  const { data, loading, error } = useResumoInteligencia(accessToken, periodo);
  return useMemo(() => montarDados(data, loading, error), [data, loading, error]);
}

function numero(valor: number | null | undefined) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function largura(volume: number | null, total: number | null) {
  if (volume === null || total === null || total <= 0) return null;
  return Math.max(3, Math.min(100, Math.round((100 * volume) / total)));
}

function taxa(volume: number | null, anterior: number | null) {
  if (volume === null || anterior === null || anterior <= 0) return undefined;
  return `${((100 * volume) / anterior).toFixed(1).replace(".", ",")}%`;
}

function montarDados(resumo: Tracking360Resumo | null, loading: boolean, error: string | null): Dados {
  const crm = resumo?.crm;
  const digital = resumo?.digital;
  const sla = resumo?.sla;
  const visitas = resumo?.visitas;
  const propostas = resumo?.propostas;
  const vendas = resumo?.vendas;
  const processo = resumo?.processo;
  const qualidade = resumo?.qualidade_dados;

  const leads = numero(crm?.leads);
  const negocios = numero(crm?.deals);
  const respondidos = numero(sla?.responded);
  const visitasTotal = numero(visitas?.total);
  const propostasTotal = numero(propostas?.total);
  const vendasTotal = numero(vendas?.total);
  const perdidos = numero(crm?.lost_deals);
  const validos = numero(sla?.valid);
  const dentro = numero(sla?.within_5);
  const slaPercentual = validos !== null && validos > 0 && dentro !== null ? (100 * dentro) / validos : null;
  const semValor = numero(qualidade?.negocios_abertos_sem_valor);
  const semFeedback = numero(qualidade?.visitas_realizadas_sem_resultado);
  const semResposta = numero(qualidade?.sla_sem_resposta);

  const diagnosticos: Diagnostico[] = loading || error || !resumo ? [
    {
      chave: "carga",
      chip: loading ? "carregando" : "fonte indisponível",
      tomChip: loading ? "aviso" : "ruim",
      icone: "relogio",
      tile: loading ? "ambar" : "vermelho",
      destaque: loading ? "Consolidando os dados reais da operação" : "A leitura executiva não respondeu",
      texto: loading ? " — o desenho permanece completo e nenhum número ilustrativo é usado." : ` — ${error ?? "tente novamente"}.`,
      alvo: "privacidade",
      rotulo: "Ver saúde dos dados →",
    },
  ] : [
    {
      chave: "meta",
      chip: "resultado do mês",
      tomChip: (vendas?.target_coverage_percent ?? 0) >= 100 ? "bom" : "aviso",
      icone: "tendencia",
      tile: (vendas?.target_coverage_percent ?? 0) >= 100 ? "verde" : "ambar",
      destaque: `A cobertura da meta está em ${fmt.porcento(numero(vendas?.target_coverage_percent), 1)}`,
      texto: ` — ${fmt.dinheiro(numero(vendas?.vgv))} de VGV realizado sobre ${fmt.dinheiro(numero(vendas?.target_vgv))}.`,
      alvo: "vendas",
      rotulo: "Investigar em Vendas e previsão →",
    },
    {
      chave: "sla",
      chip: "atendimento",
      tomChip: (slaPercentual ?? 0) >= 80 ? "bom" : "ruim",
      icone: "relogio",
      tile: (slaPercentual ?? 0) >= 80 ? "verde" : "vermelho",
      destaque: `${fmt.inteiro(semResposta)} leads estão sem primeira resposta medida`,
      texto: ` — ${fmt.porcento(slaPercentual, 1)} das respostas válidas ocorreram em até 5 minutos.`,
      alvo: "atendimento",
      rotulo: "Investigar em Atendimento e SLA →",
    },
    {
      chave: "processo",
      chip: "disciplina",
      tomChip: (processo?.overdue_actions ?? 0) > 0 ? "aviso" : "bom",
      icone: "alerta",
      tile: (processo?.overdue_actions ?? 0) > 0 ? "ambar" : "verde",
      destaque: `${fmt.inteiro(numero(processo?.overdue_actions))} próximas ações estão vencidas`,
      texto: ` — ${fmt.inteiro(numero(processo?.without_next_action))} leads ativos não têm próxima ação definida.`,
      alvo: "alertas",
      rotulo: "Abrir Central de alertas →",
    },
    {
      chave: "qualidade",
      chip: "qualidade do dado",
      tomChip: (semFeedback ?? 0) + (semValor ?? 0) > 0 ? "roxo" : "bom",
      icone: "faisca",
      tile: "roxo",
      destaque: `${fmt.inteiro(semFeedback)} visitas realizadas estão sem resultado`,
      texto: ` e ${fmt.inteiro(semValor)} negócios abertos não têm valor confiável de pipeline.`,
      alvo: "qualidade",
      rotulo: "Investigar em Qualidade →",
    },
  ];

  const funil = [
    { nome: "Lead recebido", volume: leads, largura: largura(leads, leads), taxa: leads === null ? undefined : "100%" },
    { nome: "Negócio criado", volume: negocios, largura: largura(negocios, leads), taxa: taxa(negocios, leads), perda: leads !== null && negocios !== null ? `−${Math.max(0, leads - negocios)}` : undefined },
    { nome: "Primeiro contato", volume: respondidos, largura: largura(respondidos, leads), taxa: taxa(respondidos, negocios), perda: negocios !== null && respondidos !== null ? `−${Math.max(0, negocios - respondidos)}` : undefined },
    { nome: "Qualificado", volume: null, largura: null },
    { nome: "Visita agendada", volume: visitasTotal, largura: largura(visitasTotal, leads), taxa: undefined },
    { nome: "Proposta", volume: propostasTotal, largura: largura(propostasTotal, leads), taxa: taxa(propostasTotal, visitasTotal) },
    { nome: "Venda ou locação", volume: vendasTotal, largura: largura(vendasTotal, leads), taxa: taxa(vendasTotal, propostasTotal) },
    { nome: "Perdido", volume: perdidos, largura: largura(perdidos, leads), taxa: taxa(perdidos, negocios), perdaFinal: true },
  ];

  return {
    diagnosticos,
    leads,
    leadsDoSite: numero(digital?.site_leads?.total),
    slaPercentual,
    slaMediana: numero(sla?.median_minutes),
    slaP90: numero(sla?.p90_minutes),
    vendas: vendasTotal,
    vgv: numero(vendas?.vgv),
    metaCobertura: numero(vendas?.target_coverage_percent),
    previsaoPonderada: null,
    pipelineValor: numero(crm?.pipeline_value),
    areas: [
      { titulo: "Atendimento", linhas: [{ l: "1º contato · mediana", r: fmt.duracaoMin(numero(sla?.median_minutes)), corR: "#D93E3E" }, { l: "Sem resposta medida", r: fmt.inteiro(semResposta), corR: "#D93E3E" }, { l: "Follow-ups vencidos", r: fmt.inteiro(numero(processo?.overdue_actions)) }], alvo: "atendimento", rotulo: "Abrir Atendimento e SLA →" },
      { titulo: "Comercial", linhas: [{ l: "VGV realizado", r: fmt.dinheiro(numero(vendas?.vgv)) }, { l: "Vendas", r: fmt.inteiro(vendasTotal) }, { l: "Cobertura da meta", r: fmt.porcento(numero(vendas?.target_coverage_percent), 1), corR: "#B5700A" }], alvo: "vendas", rotulo: "Abrir Vendas e previsão →" },
      { titulo: "Financeiro", linhas: [{ l: "Receita bruta de comissão", r: fmt.dinheiro(numero(vendas?.gross_commission)) }, { l: "Comissões calculadas", r: fmt.dinheiro(numero(vendas?.payouts)) }, { l: "Contribuição após custos", r: fmt.dinheiro(numero(vendas?.net_contribution)) }], alvo: "financeiro", rotulo: "Abrir Financeiro →" },
      { titulo: "Digital", linhas: [{ l: "Visualizações", r: fmt.inteiro(numero(digital?.page_views)) }, { l: "Leads do site", r: fmt.inteiro(numero(digital?.site_leads?.total)) }, { l: "Atribuições com origem", r: fmt.inteiro(numero(digital?.attribution?.with_source)) }], alvo: "digital", rotulo: "Abrir Visão do digital →" },
    ],
    funil,
    atualizado: resumo?.atualizado_em ? new Date(resumo.atualizado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—",
  };
}
