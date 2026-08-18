"use client";

/* 12 · GERENTES — artboard 17a, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. LISTA — tabela dos gerentes com capacidade, leads, % SLA, 1ª resp. med/P90,
 *      lead→venda, visitas, propostas, vendas·VGV, qualidade, parados, alertas e
 *      evolução
 *   2. PÁGINA DO GERENTE — carga e SLA por corretor, cobertura de horários (manhã,
 *      tarde, almoço, noite, sábado, domingo), funil e meta da equipe
 *   3. COACHING DA SEMANA e PRECISA DE INTERVENÇÃO AGORA
 *   4. rodapé de fontes
 *
 * Com dois gerentes não existe mediana da casa: a comparação é sempre contra a
 * meta. Escala não integrada — a tela mostra atividade, nunca ausência.
 */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, Tabela } from "../pecas";

type Gerente = {
  nome: string;
  iniciais: string;
  corretores: number | null;
  capacidade: string;
  acima?: boolean;
  leads: number | null;
  sla: number | null;
  mediana: number | null;
  p90: number | null;
  leadVenda: number | null;
  visitas: number | null;
  propostas: number | null;
  vendas: number | null;
  vgv: number | null;
  qualidade: number | null;
  amostra: number | null;
  parados: number | null;
  alertas: number | null;
  evolucao: "sobe" | "cai";
};

type Dados = {
  lista: Gerente[];
  pagina: {
    nome: string;
    iniciais: string;
    equipe: number | null;
    selo: string;
    corretores: { nome: string; carga: string; acima?: boolean; leads: number | null; mediana: number | null; p90: number | null; sla: number | null; novato?: boolean }[];
    cobertura: { periodo: string; percentual: number | null; cor: string }[];
    funil: { rotulo: string; valor: string }[];
    metaPercentual: number | null;
    metaNota: string;
    coaching: { pessoa: string; texto: string }[];
    intervencao: { l: string; r: string }[];
  };
  atualizado: string;
};

export function Gerentes({ recorte }: PropsTela) {
  const d = usarDados();
  const [aberto, setAberto] = useState<string>(d.pagina.nome);

  return (
    <div className="int-secao">
      {/* 1 · LISTA */}
      <Cabecalho eyebrow="LISTA" titulo="Os gerentes, na mesma régua" nota={`${recorte.periodo} · sem mediana da casa: são dois`} />
      <Tabela
        colunas={[
          { titulo: "Gerente" }, { titulo: "Equipe" }, { titulo: "Capacidade" }, { titulo: "Leads", num: true }, { titulo: "% SLA", num: true },
          { titulo: "1ª resp. med · P90" }, { titulo: "Lead→venda", num: true }, { titulo: "Visitas", num: true }, { titulo: "Propostas", num: true },
          { titulo: "Vendas · VGV" }, { titulo: "Qualidade" }, { titulo: "Parados", num: true }, { titulo: "Alertas", num: true }, { titulo: "Evolução" },
        ]}
        ordenadaEm="Leads"
        linhas={d.lista.map((g) => ({
          chave: g.nome,
          destaque: g.nome === aberto,
          abrir: () => setAberto(g.nome),
          celulas: [
            { texto: g.nome, forte: true },
            { texto: `${fmt.inteiro(g.corretores)} corretores` },
            { texto: g.capacidade, cor: g.acima ? "#D93E3E" : undefined, forte: g.acima },
            { texto: fmt.inteiro(g.leads), num: true },
            { texto: fmt.porcento(g.sla, 0), num: true, forte: true, cor: (g.sla ?? 100) < 20 ? "#D93E3E" : "#B5700A" },
            { texto: `${fmt.duracaoMin(g.mediana)} · ${fmt.duracaoMin(g.p90)}`, cor: (g.p90 ?? 0) > 120 ? "#D93E3E" : undefined },
            { texto: fmt.porcento(g.leadVenda), num: true, forte: true },
            { texto: fmt.inteiro(g.visitas), num: true },
            { texto: fmt.inteiro(g.propostas), num: true },
            { texto: `${fmt.inteiro(g.vendas)} · ${fmt.dinheiro(g.vgv)}` },
            { texto: g.qualidade === null ? "—" : `${g.qualidade.toFixed(1).replace(".", ",")} (n=${fmt.inteiro(g.amostra)})` },
            { texto: fmt.inteiro(g.parados), num: true },
            { texto: "", chip: fmt.inteiro(g.alertas), chipTom: (g.alertas ?? 0) >= 3 ? ("ruim" as const) : ("aviso" as const) },
            { texto: g.evolucao === "sobe" ? "↗" : "↘", cor: g.evolucao === "sobe" ? "#1E7A46" : "#D93E3E" },
          ],
        }))}
        foot="a linha destacada está aberta abaixo · comparação considera origem e qualidade dos leads de cada equipe"
      />

      {/* 2 · PÁGINA DO GERENTE */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span className="intp-cab-eyebrow" style={{ color: "#8B00CC" }}>PÁGINA DO GERENTE</span>
          <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {d.pagina.nome} · Equipe de {fmt.inteiro(d.pagina.equipe)}
          </h2>
        </div>
        <span className="intp-cartao-chip tom-ruim" style={{ marginLeft: "auto" }}>{d.pagina.selo}</span>
      </div>

      <div className="intp-op-tres">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Carga e SLA por corretor</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
            {d.pagina.corretores.map((c) => (
              <div key={c.nome} style={{ display: "grid", gridTemplateColumns: "1fr 56px 46px 88px 44px", gap: 8, alignItems: "center", borderBottom: "1px solid #F7F5F2", paddingBottom: 5 }}>
                <span style={{ fontWeight: 600 }}>
                  {c.nome}
                  {c.novato ? <small style={{ color: "#66009A", fontWeight: 700 }}> nova</small> : null}
                </span>
                <b style={{ textAlign: "right", color: c.acima ? "#D93E3E" : "#1F1C1A", fontVariantNumeric: "tabular-nums" }}>{c.carga}</b>
                <span style={{ textAlign: "right", color: "#6E6760", fontVariantNumeric: "tabular-nums" }}>{fmt.inteiro(c.leads)}</span>
                <span style={{ textAlign: "right", color: (c.mediana ?? 0) > 15 ? "#D93E3E" : "#6E6760" }}>
                  {fmt.duracaoMin(c.mediana)} · {fmt.duracaoMin(c.p90)}
                </span>
                <b style={{ textAlign: "right", color: (c.sla ?? 100) < 20 ? "#D93E3E" : "#1E7A46", fontVariantNumeric: "tabular-nums" }}>{fmt.porcento(c.sla, 0)}</b>
              </div>
            ))}
          </div>
          <small className="intp-kpi-foot">carga acima da capacidade em âmbar · a distribuição de leads não considera capacidade hoje — sugestão: redistribuir 6 leads do Carlos para o Pedro</small>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Cobertura de horários</span>
          {d.pagina.cobertura.map((c) => (
            <div className="intp-cob" key={c.periodo}>
              <span className="intp-cob-rot">{c.periodo}</span>
              <span className="intp-cob-trilha">
                <span className="intp-cob-barra" style={{ width: `${c.percentual ?? 0}%`, background: c.cor }} />
              </span>
              <b className="intp-cob-num">{fmt.porcento(c.percentual, 0)}</b>
            </div>
          ))}
          <small className="intp-kpi-foot">% do horário com pelo menos 1 corretor disponível · os buracos batem com o padrão de atraso do almoço visto em Atendimento e SLA</small>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Funil e meta da equipe</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              {d.pagina.funil.map((f) => (
                <div key={f.rotulo} style={{ display: "flex", gap: 8 }}>
                  <span style={{ flex: 1, color: "#4D4842", fontWeight: 600 }}>{f.rotulo}</span>
                  <b style={{ fontVariantNumeric: "tabular-nums" }}>{f.valor}</b>
                </div>
              ))}
            </div>
            <span className="intp-casc-trilha">
              <span className="intp-casc-barra entra" style={{ width: `${d.pagina.metaPercentual ?? 0}%` }} />
            </span>
            <small className="intp-kpi-foot">{d.pagina.metaNota}</small>
          </div>

          <div className="intp-cartao" style={{ background: "#FDF1D9", boxShadow: "none" }}>
            <span className="intp-cartao-titulo" style={{ color: "#7A5E12" }}>Coaching desta semana</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "#7A5E12", lineHeight: 1.5 }}>
              {d.pagina.coaching.map((c, i) => (
                <span key={c.pessoa}>
                  <b>{i + 1} · {c.pessoa}:</b> {c.texto}
                </span>
              ))}
            </div>
          </div>

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Precisa de intervenção agora</span>
            <div className="intp-fila" style={{ boxShadow: "none", padding: 0 }}>
              {d.pagina.intervencao.map((i) => (
                <button key={i.l} type="button" className="intp-fila-item" onClick={() => recorte.irPara("atendimento")}>
                  <span className="intp-fila-dot" style={{ background: "#D93E3E" }} />
                  <span className="intp-fila-nome">{i.l}</span>
                  <span className="intp-fila-num">{i.r}</span>
                  <span className="intp-fila-seta">›</span>
                </button>
              ))}
            </div>
            <small className="intp-kpi-foot">cada linha abre a fila em Atendimento e SLA, onde a ação acontece</small>
          </div>
        </div>
      </div>

      <div className="intp-detalhe-aviso">
        Escala e ponto não estão integrados. Esta tela mostra atividade registrada no ERP, não jornada de trabalho. Ausência de registro não é ausência da pessoa — e nunca vira nota.
      </div>

      <RodapeFontes
        fontes={["negócios", "leads", "carga por corretor", "intervenções", "disponibilidade no ERP"]}
        pendencias={["escala/ponto não integrado", "mediana da casa não se aplica com dois gerentes"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  lista: [
    { nome: "Juliana Prado", iniciais: "JP", corretores: 3, capacidade: "96/120", leads: 261, sla: 31, mediana: 9, p90: 58, leadVenda: 4.9, visitas: 69, propostas: 28, vendas: 13, vgv: 11_200_000, qualidade: 4.5, amostra: 104, parados: 8, alertas: 2, evolucao: "sobe" },
    { nome: "Marcos Vilela", iniciais: "MV", corretores: 3, capacidade: "85/120", acima: true, leads: 225, sla: 14, mediana: 22, p90: 161, leadVenda: 3.6, visitas: 49, propostas: 19, vendas: 8, vgv: 7_200_000, qualidade: 4.1, amostra: 78, parados: 13, alertas: 3, evolucao: "cai" },
  ],
  pagina: {
    nome: "Marcos Vilela",
    iniciais: "MV",
    equipe: 3,
    selo: "evolução ↘ · 3 alertas críticos",
    corretores: [
      { nome: "Carlos Mendes", carga: "46/40", acima: true, leads: 118, mediana: 14, p90: 118, sla: 18 },
      { nome: "Rafael Souza", carga: "31/40", leads: 92, mediana: 41, p90: 200, sla: 8 },
      { nome: "Pedro Costa", carga: "8/40", leads: 15, mediana: 6, p90: 22, sla: 44, novato: true },
    ],
    cobertura: [
      { periodo: "Manhã", percentual: 90, cor: "#1FA85A" },
      { periodo: "Tarde", percentual: 82, cor: "#1FA85A" },
      { periodo: "Almoço 12–14", percentual: 34, cor: "#D93E3E" },
      { periodo: "Noite", percentual: 38, cor: "#FF9A4D" },
      { periodo: "Sábado", percentual: 12, cor: "#D93E3E" },
      { periodo: "Domingo", percentual: 8, cor: "#D93E3E" },
    ],
    funil: [
      { rotulo: "Leads → negócios → visitas", valor: "225 · 126 · 49" },
      { rotulo: "Propostas → vendas", valor: "19 · 8" },
      { rotulo: "Qualificado → visita", valor: "52% (era 61%)" },
    ],
    metaPercentual: 72,
    metaNota: "meta da equipe: R$ 7,2 mi de R$ 10 mi (72%)",
    coaching: [
      { pessoa: "Rafael", texto: "P90 de 3 h 20 concentrado no sábado — revisar o plantão." },
      { pessoa: "Carlos", texto: "sobrecarregado (46/40) e o gargalo qualificado→visita é dele — redistribuir e acompanhar 3 atendimentos juntos." },
    ],
    intervencao: [
      { l: "Leads acima do SLA", r: "18" },
      { l: "Negócios parados", r: "13" },
      { l: "Follow-ups vencidos", r: "34" },
    ],
  },
  atualizado: "14:32",
};
