"use client";

/* 17 · CENTRAL DE ALERTAS — artboard 21a, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. quatro números por gravidade, cada um com a nota do artboard (o mais antigo
 *      há 4 h 10 · sem prazo estourado ainda · alguém assumiu, ainda não resolveu ·
 *      de 31 abertos, tempo médio 6 h)
 *   2. FILA DE ALERTAS — os 5 críticos abertos agora, uma linha por alerta com
 *      chip de gravidade, impacto + “ver evidência”, responsável, ação recomendada
 *      e os três botões (ação em laranja, Resolver, Reconhecer)
 *   3. os 14 TIPOS DE ALERTA e o CICLO DE VIDA do alerta
 *   4. rodapé de fontes
 *
 * Alerta sem dono é alerta perdido: a tela exige o responsável na própria linha, e
 * quando ninguém assumiu, diz “ninguém atribuído” em vermelho — nunca em branco.
 */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, IconeInt, type Kpi } from "../pecas";

type Alerta = {
  chave: string;
  titulo: string;
  impacto: string;
  responsavel: string | null;
  acao: string;
  botao: string;
  alvo: string;
};

type Dados = {
  criticos: number | null;
  atencao: number | null;
  reconhecidos: number | null;
  resolvidos: number | null;
  totalAbertos: number | null;
  notaCriticos: string;
  notaAtencao: string;
  notaReconhecidos: string;
  notaResolvidos: string;
  alertas: Alerta[];
  tipos: { l: string; r: string }[];
  ciclo: { etapa: string; texto: string; cor: string }[];
  atualizado: string;
};

export function CentralAlertas({ recorte }: PropsTela) {
  const d = usarDados();
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

      {/* FILA DE ALERTAS — uma linha por alerta, com as três ações */}
      <Cabecalho
        eyebrow="FILA DE ALERTAS"
        titulo={`Os ${abertos.length} críticos abertos agora`}
        cor="#8B00CC"
        nota="ordenados por impacto × tempo aberto · cada linha tem dono e ação"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {abertos.map((a) => (
          <div className="intp-cartao" key={a.chave} style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "78px 1fr 150px 168px auto", gap: 12, alignItems: "center" }}>
              <span className="intp-cartao-chip tom-ruim" style={{ justifySelf: "start" }}>crítico</span>

              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{a.titulo}</b>
                <small style={{ display: "block", fontSize: 11.5, color: "#9A938B", lineHeight: 1.45 }}>
                  impacto: {a.impacto} ·{" "}
                  <button type="button" className="int-link" style={{ fontSize: 11.5 }} onClick={() => recorte.filtrar(`Alerta: ${a.titulo}`)}>
                    ver evidência
                  </button>
                </small>
              </div>

              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#9A938B" }}>responsável</small>
                {a.responsavel === null ? (
                  <b style={{ fontSize: 12, color: "#D93E3E" }}>ninguém atribuído</b>
                ) : (
                  <b style={{ fontSize: 12 }}>{a.responsavel}</b>
                )}
              </div>

              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#9A938B" }}>ação recomendada</small>
                <b style={{ fontSize: 12 }}>{a.acao}</b>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifySelf: "end" }}>
                <button type="button" className="cop-btn-primario" style={{ height: 34, padding: "0 14px", fontSize: 12, background: "#FF7000", boxShadow: "none" }} onClick={() => recorte.irPara(a.alvo)}>
                  {a.botao}
                </button>
                <button type="button" className="cop-acao" onClick={() => setResolvidos((r) => (r.includes(a.chave) ? r : [...r, a.chave]))}>
                  Resolver
                </button>
                <button
                  type="button"
                  className="cop-acao"
                  style={reconhecidos.includes(a.chave) ? { borderColor: "#C9AEDC", color: "#66009A", fontWeight: 700 } : undefined}
                  onClick={() => setReconhecidos((r) => (r.includes(a.chave) ? r : [...r, a.chave]))}
                >
                  {reconhecidos.includes(a.chave) ? "Reconhecido ✓" : "Reconhecer"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {abertos.length === 0 ? (
          <div className="intp-cartao" style={{ display: "flex", flexDirection: "row", gap: 10, alignItems: "center" }}>
            <span className="intp-tile tile-verde">
              <IconeInt nome="check" tamanho={15} />
            </span>
            <b style={{ fontSize: 13 }}>Nenhum crítico aberto agora — os resolvidos ficam registrados na Auditoria.</b>
          </div>
        ) : null}
      </div>
      <small className="intp-kpi-foot">
        resolver, atribuir e reconhecer ficam registrados na Auditoria · alerta reconhecido continua na lista até ser resolvido · nada aqui altera dado do ERP sozinho
      </small>

      {/* TIPOS E CICLO DE VIDA */}
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
          <small className="intp-kpi-foot">tipo sem alerta aberto aparece com 0, porque zero é dado — e não sai da lista</small>
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
          { titulo: "Financeiro e cadastro", linhas: [{ l: "Vendas sem % de comissão", r: "abrir →", abrir: () => recorte.irPara("financeiro") }, { l: "Repasse sem data", r: "abrir →", abrir: () => recorte.irPara("financeiro") }], foot: "valores só para quem tem acesso financeiro" },
          { titulo: "Dado e tracking", linhas: [{ l: "Leads sem sincronizar", r: "abrir →", abrir: () => recorte.irPara("privacidade") }, { l: "UTMs ausentes", r: "abrir →", abrir: () => recorte.irPara("aquisicao") }], foot: "pessoa que pediu contato e ninguém viu é prioridade máxima" },
        ]}
      />

      <RodapeFontes
        fontes={["motor de regras", "leads", "negócios", "fila de sincronização", "comissões"]}
        pendencias={["escala não integrada — cobertura de sábado é inferida por atividade"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  criticos: 5,
  atencao: 18,
  reconhecidos: 8,
  resolvidos: 23,
  totalAbertos: 31,
  notaCriticos: "o mais antigo há 4 h 10",
  notaAtencao: "sem prazo estourado ainda",
  notaReconhecidos: "alguém assumiu, ainda não resolveu",
  notaResolvidos: "de 31 abertos · tempo médio 6 h",
  alertas: [
    {
      chave: "sla-sonia",
      titulo: "SLA excedido · lead Sônia R. sem responsável",
      impacto: "lead quente esfriando · Instagram orgânico · aberto há 4 h 10",
      responsavel: null,
      acao: "ligar agora",
      botao: "Atribuir",
      alvo: "atendimento",
    },
    {
      chave: "comissao",
      titulo: "Venda sem % de comissão válido · Apê Colibri 90",
      impacto: "R$ 1,45 mi de VGV sem cálculo · aberto há 3 dias",
      responsavel: "Financeiro · gerente Marcos V.",
      acao: "completar o cadastro",
      botao: "Abrir a venda",
      alvo: "financeiro",
    },
    {
      chave: "sabado",
      titulo: "Falta de cobertura · sábado sem plantão na equipe Marcos",
      impacto: "19 dos 31 atrasos do mês · cobertura 12% no sábado",
      responsavel: "Marcos Vilela",
      acao: "montar escala",
      botao: "Abrir gerente",
      alvo: "gerentes",
    },
    {
      chave: "carga",
      titulo: "Corretor sobrecarregado · Carlos Mendes 46/40",
      impacto: "SLA 18% e o gargalo qualificado→visita é dele · aberto há 6 dias",
      responsavel: "Marcos Vilela",
      acao: "redistribuir 6 leads",
      botao: "Redistribuir",
      alvo: "corretores",
    },
    {
      chave: "qualidade",
      titulo: "Queda de qualidade · Rafael Souza",
      impacto: "objeções 3,4 (−0,4 em 2 semanas) · amostra n=26",
      responsavel: "Marcos Vilela",
      acao: "coaching de objeções",
      botao: "Abrir perfil",
      alvo: "qualidade",
    },
  ],
  tipos: [
    { l: "SLA de primeira resposta", r: "9" },
    { l: "Follow-up vencido", r: "57" },
    { l: "Mensagem sem retorno", r: "44" },
    { l: "Negócio parado", r: "21" },
    { l: "Visita sem feedback", r: "12" },
    { l: "Carga acima da capacidade", r: "1" },
    { l: "Cobertura de horário", r: "2" },
    { l: "Queda de qualidade", r: "2" },
    { l: "Venda sem % de comissão", r: "3" },
    { l: "Repasse sem data", r: "1" },
    { l: "Lead sem sincronizar", r: "7" },
    { l: "UTM ausente em anúncio", r: "3" },
    { l: "Fonte de dado parada", r: "1" },
    { l: "Meta sem cadastro", r: "0" },
  ],
  ciclo: [
    { etapa: "Aberto", texto: "a regra dispara com evidência anexada e dono sugerido — nunca sem prova.", cor: "#D93E3E" },
    { etapa: "Atribuído", texto: "alguém assume. Sem dono, o alerta aparece como “ninguém atribuído” em vermelho.", cor: "#FF7000" },
    { etapa: "Reconhecido", texto: "registra quem viu e quando; continua na lista até ser resolvido.", cor: "#8B00CC" },
    { etapa: "Resolvido", texto: "sai da fila, entra no histórico e fica na Auditoria com o tempo até a resolução.", cor: "#1FA85A" },
    { etapa: "Reaberto", texto: "se a condição voltar no mesmo período, o alerta reabre com o histórico anterior à vista.", cor: "#B5700A" },
  ],
  atualizado: "14:32",
};
