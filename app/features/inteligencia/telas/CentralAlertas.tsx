"use client";

/* 17 · CENTRAL DE ALERTAS — artboard 21a. Agora lê dado real via
 * /api/inteligencia/alertas (RPC intel_alertas). A central é SINTETIZADA dos
 * sinais operacionais reais (SLA, follow-ups, negócios parados, visitas sem
 * feedback, vendas sem comissão, metas sem cadastro). O motor crm_lead_alertas
 * ainda é nascente; tipos sem fonte aparecem com —. Demo virou fixture. */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, IconeInt, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { AlertasPayload } from "../../../lib/inteligencia/tipos";

type Alerta = { chave: string; titulo: string; impacto: string; responsavel: string | null; acao: string; botao: string; alvo: string };

type Dados = {
  criticos: number | null; atencao: number | null; reconhecidos: number | null; resolvidos: number | null; totalAbertos: number | null;
  notaCriticos: string; notaAtencao: string; notaReconhecidos: string; notaResolvidos: string;
  alertas: Alerta[]; tipos: { l: string; r: string }[]; ciclo: { etapa: string; texto: string; cor: string }[]; atualizado: string;
};

const CICLO: Dados["ciclo"] = [
  { etapa: "Aberto", texto: "a regra dispara com evidência anexada e dono sugerido — nunca sem prova.", cor: "#D93E3E" },
  { etapa: "Atribuído", texto: "alguém assume. Sem dono, o alerta aparece como “ninguém atribuído” em vermelho.", cor: "#FF7000" },
  { etapa: "Reconhecido", texto: "registra quem viu e quando; continua na lista até ser resolvido.", cor: "#8B00CC" },
  { etapa: "Resolvido", texto: "sai da fila, entra no histórico e fica na Auditoria com o tempo até a resolução.", cor: "#1FA85A" },
  { etapa: "Reaberto", texto: "se a condição voltar no mesmo período, o alerta reabre com o histórico anterior à vista.", cor: "#B5700A" },
];

export function CentralAlertas({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<AlertasPayload>("alertas", accessToken, recorte);
  const d = mapearAlertas(leitura.payload);
  const [reconhecidos, setReconhecidos] = useState<string[]>([]);
  const [resolvidos, setResolvidos] = useState<string[]>([]);

  const kpis: Kpi[] = [
    { rotulo: "Críticos abertos", bruto: d.criticos, texto: fmt.inteiro(d.criticos), tom: "ruim", tile: "vermelho", foot: d.notaCriticos },
    { rotulo: "Atenção", bruto: d.atencao, texto: fmt.inteiro(d.atencao), tom: "atencao", tile: "ambar", foot: d.notaAtencao },
    { rotulo: "Reconhecidos", bruto: (d.reconhecidos ?? 0) + reconhecidos.length, texto: fmt.inteiro((d.reconhecidos ?? 0) + reconhecidos.length), tile: "roxo", foot: d.notaReconhecidos },
    { rotulo: "Resolvidos no período", bruto: (d.resolvidos ?? 0) + resolvidos.length, texto: fmt.inteiro((d.resolvidos ?? 0) + resolvidos.length), tom: "bom", tile: "verde", foot: d.notaResolvidos },
  ];

  const abertos = d.alertas.filter((a) => !resolvidos.includes(a.chave));

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="O QUE EXIGE AÇÃO HOJE" titulo="Tudo que exige ação, num lugar só — com dono, evidência e caminho para resolver" nota={`${fmt.inteiro(d.totalAbertos)} alertas no total`} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="FILA DE ALERTAS" titulo={`Os ${abertos.length} críticos abertos agora`} cor="#8B00CC" nota="ordenados por impacto · cada linha tem dono e ação" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {abertos.map((a) => (
          <div className="intp-cartao" key={a.chave} style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "78px 1fr 150px 168px auto", gap: 12, alignItems: "center" }}>
              <span className="intp-cartao-chip tom-ruim" style={{ justifySelf: "start" }}>crítico</span>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{a.titulo}</b>
                <small style={{ display: "block", fontSize: 11.5, color: "#9A938B", lineHeight: 1.45 }}>
                  impacto: {a.impacto} ·{" "}
                  <button type="button" className="int-link" style={{ fontSize: 11.5 }} onClick={() => recorte.filtrar(`Alerta: ${a.titulo}`)}>ver evidência</button>
                </small>
              </div>
              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#9A938B" }}>responsável</small>
                {a.responsavel === null ? <b style={{ fontSize: 12, color: "#D93E3E" }}>ninguém atribuído</b> : <b style={{ fontSize: 12 }}>{a.responsavel}</b>}
              </div>
              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#9A938B" }}>ação recomendada</small>
                <b style={{ fontSize: 12 }}>{a.acao}</b>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifySelf: "end" }}>
                <button type="button" className="cop-btn-primario" style={{ height: 34, padding: "0 14px", fontSize: 12, background: "#FF7000", boxShadow: "none" }} onClick={() => recorte.irPara(a.alvo)}>{a.botao}</button>
                <button type="button" className="cop-acao" onClick={() => setResolvidos((r) => (r.includes(a.chave) ? r : [...r, a.chave]))}>Resolver</button>
                <button type="button" className="cop-acao" style={reconhecidos.includes(a.chave) ? { borderColor: "#C9AEDC", color: "#66009A", fontWeight: 700 } : undefined} onClick={() => setReconhecidos((r) => (r.includes(a.chave) ? r : [...r, a.chave]))}>
                  {reconhecidos.includes(a.chave) ? "Reconhecido ✓" : "Reconhecer"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {abertos.length === 0 ? (
          <div className="intp-cartao" style={{ display: "flex", flexDirection: "row", gap: 10, alignItems: "center" }}>
            <span className="intp-tile tile-verde"><IconeInt nome="check" tamanho={15} /></span>
            <b style={{ fontSize: 13 }}>Nenhum crítico aberto agora — os resolvidos ficam registrados na Auditoria.</b>
          </div>
        ) : null}
      </div>
      <small className="intp-kpi-foot">resolver, atribuir e reconhecer ficam registrados na Auditoria · nada aqui altera dado do ERP sozinho</small>

      <Cabecalho eyebrow="COMO O ALERTA FUNCIONA" titulo="Os tipos e o ciclo de vida" />
      <div className="intp-op-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Os {d.tipos.length} tipos de alerta · abertos por tipo</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 14px" }}>
            {d.tipos.map((t) => (
              <div key={t.l} style={{ display: "flex", gap: 8, fontSize: 12, borderBottom: "1px solid #F7F5F2", paddingBottom: 4 }}>
                <span style={{ flex: 1, color: "#4D4842" }}>{t.l}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{t.r}</b>
              </div>
            ))}
          </div>
          <small className="intp-kpi-foot">tipo sem alerta aberto aparece com 0 · tipo sem fonte ainda aparece com —</small>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Ciclo de vida do alerta</span>
          {d.ciclo.map((c) => (
            <div key={c.etapa} style={{ display: "grid", gridTemplateColumns: "14px 108px 1fr", gap: 10, alignItems: "start", paddingBottom: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: c.cor, marginTop: 5 }} />
              <b style={{ fontSize: 12 }}>{c.etapa}</b>
              <small style={{ fontSize: 11.5, color: "#6E6760", lineHeight: 1.45 }}>{c.texto}</small>
            </div>
          ))}
        </div>
      </div>

      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Atendimento", linhas: [{ l: "Leads acima do SLA", r: "abrir →", abrir: () => recorte.irPara("atendimento") }, { l: "Mensagens sem retorno", r: "abrir →", abrir: () => recorte.irPara("atendimento") }], foot: "a ação acontece no Funil 2.0" },
          { titulo: "Financeiro e cadastro", linhas: [{ l: "Vendas sem % de comissão", r: "abrir →", abrir: () => recorte.irPara("financeiro") }, { l: "Metas sem cadastro", r: "abrir →", abrir: () => recorte.irPara("vendas") }], foot: "valores só para quem tem acesso financeiro" },
          { titulo: "Operação", linhas: [{ l: "Negócios parados", r: "abrir →", abrir: () => recorte.irPara("vendas") }, { l: "Visitas sem feedback", r: "abrir →", abrir: () => recorte.irPara("corretores") }], foot: "pessoa que pediu contato e ninguém viu é prioridade máxima" },
        ]}
      />

      <RodapeFontes
        fontes={["leads", "negócios", "vendas", "visitas", "wa_mensagens"]}
        pendencias={["motor de alertas (crm_lead_alertas) nascente", "cobertura de horário, repasses e sync sem fonte"]}
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

const vazioAlertas: Dados = {
  criticos: null, atencao: null, reconhecidos: null, resolvidos: null, totalAbertos: null,
  notaCriticos: "aguardando conexão", notaAtencao: "—", notaReconhecidos: "—", notaResolvidos: "—",
  alertas: [], tipos: [], ciclo: CICLO, atualizado: "—",
};

function mapearAlertas(p: AlertasPayload | null): Dados {
  if (!p) return vazioAlertas;
  const t = p.tipos;
  const criticos = t.sla_criticos + t.venda_sem_comissao;
  const atencao = t.followup + t.carga + t.meta_sem_cadastro;

  const candidatos: Alerta[] = [
    t.sla_criticos > 0 ? { chave: "sla", titulo: `${t.sla_criticos} leads acima do SLA sem resposta`, impacto: "leads esfriando · espera acima de 1 h", responsavel: null, acao: "atribuir e responder", botao: "Abrir Atendimento", alvo: "atendimento" } : null,
    t.venda_sem_comissao > 0 ? { chave: "com", titulo: `${t.venda_sem_comissao} vendas sem % de comissão`, impacto: "VGV sem cálculo de comissão nem contribuição", responsavel: "Financeiro", acao: "completar o cadastro", botao: "Abrir Financeiro", alvo: "financeiro" } : null,
    t.carga > 0 ? { chave: "carga", titulo: `${t.carga} corretores acima da capacidade`, impacto: "carteira acima do limite — risco de SLA", responsavel: null, acao: "redistribuir carteira", botao: "Abrir Corretores", alvo: "corretores" } : null,
    t.meta_sem_cadastro > 0 ? { chave: "meta", titulo: `${t.meta_sem_cadastro} corretores sem meta cadastrada`, impacto: "sem meta não há acompanhamento de resultado", responsavel: null, acao: "cadastrar metas", botao: "Abrir Vendas", alvo: "vendas" } : null,
    t.negocio_parado > 0 ? { chave: "parado", titulo: `${t.negocio_parado} negócios parados há mais de 7 dias`, impacto: "pipeline sem movimentação recente", responsavel: null, acao: "revisar e atualizar etapa", botao: "Abrir Vendas", alvo: "vendas" } : null,
  ].filter((a): a is Alerta => a !== null);

  return {
    criticos,
    atencao,
    reconhecidos: p.engine.reconhecidos,
    resolvidos: null,
    totalAbertos: criticos + atencao + t.negocio_parado,
    notaCriticos: `${t.sla_criticos} no SLA · ${t.venda_sem_comissao} de comissão`,
    notaAtencao: `${t.followup} follow-ups · ${t.carga} sobrecarga`,
    notaReconhecidos: "no motor de alertas",
    notaResolvidos: "resolvidos não são rastreados ainda",
    alertas: candidatos.slice(0, 5),
    tipos: [
      { l: "SLA de primeira resposta", r: fmt.inteiro(t.sla) },
      { l: "Follow-up vencido", r: fmt.inteiro(t.followup) },
      { l: "Mensagem sem retorno", r: fmt.inteiro(t.mensagem) },
      { l: "Negócio parado", r: fmt.inteiro(t.negocio_parado) },
      { l: "Visita sem feedback", r: fmt.inteiro(t.visita_sem_feedback) },
      { l: "Carga acima da capacidade", r: fmt.inteiro(t.carga) },
      { l: "Cobertura de horário", r: "—" },
      { l: "Queda de qualidade", r: "—" },
      { l: "Venda sem % de comissão", r: fmt.inteiro(t.venda_sem_comissao) },
      { l: "Repasse sem data", r: "—" },
      { l: "Lead sem sincronizar", r: "—" },
      { l: "UTM ausente em anúncio", r: "—" },
      { l: "Fonte de dado parada", r: fmt.inteiro(t.fonte_parada) },
      { l: "Meta sem cadastro", r: fmt.inteiro(t.meta_sem_cadastro) },
    ],
    ciclo: CICLO,
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoAlertas: Dados = {
  criticos: 5, atencao: 18, reconhecidos: 8, resolvidos: 23, totalAbertos: 31,
  notaCriticos: "o mais antigo há 4 h 10", notaAtencao: "sem prazo estourado ainda", notaReconhecidos: "alguém assumiu", notaResolvidos: "tempo médio 6 h",
  alertas: [
    { chave: "sla-sonia", titulo: "SLA excedido · lead sem responsável", impacto: "lead quente esfriando · aberto há 4 h 10", responsavel: null, acao: "ligar agora", botao: "Atribuir", alvo: "atendimento" },
  ],
  tipos: [
    { l: "SLA de primeira resposta", r: "9" },
    { l: "Follow-up vencido", r: "57" },
    { l: "Venda sem % de comissão", r: "3" },
  ],
  ciclo: CICLO,
  atualizado: "14:32",
};
