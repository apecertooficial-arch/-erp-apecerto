"use client";

/* 12 · GERENTES — artboard 17a. Agora lê dado real via /api/inteligencia/gerentes
 * (RPC intel_gerentes). Lista de gerentes e página do gerente vêm do CRM
 * (Funil 2.0). Cobertura de horário, qualidade e propostas não têm fonte -> —.
 * */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, Tabela } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { GerentesPayload } from "../../../lib/inteligencia/tipos";

type Gerente = {
  nome: string; iniciais: string; corretores: number | null; capacidade: string; acima?: boolean;
  leads: number | null; sla: number | null; mediana: number | null; p90: number | null; leadVenda: number | null;
  visitas: number | null; propostas: number | null; vendas: number | null; vgv: number | null;
  qualidade: number | null; amostra: number | null; parados: number | null; alertas: number | null; evolucao: "sobe" | "cai";
};

type Dados = {
  lista: Gerente[];
  pagina: {
    nome: string; iniciais: string; equipe: number | null; selo: string;
    corretores: { nome: string; carga: string; acima?: boolean; leads: number | null; mediana: number | null; p90: number | null; sla: number | null; novato?: boolean }[];
    cobertura: { periodo: string; percentual: number | null; cor: string }[];
    funil: { rotulo: string; valor: string }[];
    metaPercentual: number | null; metaNota: string;
    coaching: { pessoa: string; texto: string }[];
    intervencao: { l: string; r: string }[];
  };
  atualizado: string;
};

const iniciaisDe = (nome: string) => nome.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function Gerentes({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<GerentesPayload>("gerentes", accessToken, recorte);
  const d = mapearGerentes(leitura.payload);
  const [aberto, setAberto] = useState<string>(d.pagina.nome);

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="LISTA" titulo="Os gerentes, na mesma régua" nota={`${recorte.periodo} · comparação contra a meta`} />
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
                <span style={{ fontWeight: 600 }}>{c.nome}{c.novato ? <small style={{ color: "#66009A", fontWeight: 700 }}> nova</small> : null}</span>
                <b style={{ textAlign: "right", color: c.acima ? "#D93E3E" : "#1F1C1A", fontVariantNumeric: "tabular-nums" }}>{c.carga}</b>
                <span style={{ textAlign: "right", color: "#6E6760", fontVariantNumeric: "tabular-nums" }}>{fmt.inteiro(c.leads)}</span>
                <span style={{ textAlign: "right", color: (c.mediana ?? 0) > 15 ? "#D93E3E" : "#6E6760" }}>{fmt.duracaoMin(c.mediana)} · {fmt.duracaoMin(c.p90)}</span>
                <b style={{ textAlign: "right", color: (c.sla ?? 100) < 20 ? "#D93E3E" : "#1E7A46", fontVariantNumeric: "tabular-nums" }}>{fmt.porcento(c.sla, 0)}</b>
              </div>
            ))}
          </div>
          <small className="intp-kpi-foot">carga acima da capacidade em vermelho · a distribuição de leads ainda não considera capacidade</small>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Cobertura de horários</span>
          {d.pagina.cobertura.map((c) => (
            <div className="intp-cob" key={c.periodo}>
              <span className="intp-cob-rot">{c.periodo}</span>
              <span className="intp-cob-trilha"><span className="intp-cob-barra" style={{ width: `${c.percentual ?? 0}%`, background: c.cor }} /></span>
              <b className="intp-cob-num">{fmt.porcento(c.percentual, 0)}</b>
            </div>
          ))}
          <small className="intp-kpi-foot">cobertura de horário depende de escala/ponto — ainda não integrado</small>
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
            <span className="intp-casc-trilha"><span className="intp-casc-barra entra" style={{ width: `${d.pagina.metaPercentual ?? 0}%` }} /></span>
            <small className="intp-kpi-foot">{d.pagina.metaNota}</small>
          </div>

          <div className="intp-cartao" style={{ background: "#FDF1D9", boxShadow: "none" }}>
            <span className="intp-cartao-titulo" style={{ color: "#7A5E12" }}>Coaching desta semana</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "#7A5E12", lineHeight: 1.5 }}>
              {d.pagina.coaching.map((c, i) => (<span key={c.pessoa}><b>{i + 1} · {c.pessoa}:</b> {c.texto}</span>))}
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
        fontes={["negócios", "leads", "carga por corretor", "wa_mensagens", "vendas"]}
        pendencias={["escala/ponto não integrado", "cobertura de horário e qualidade sem fonte"]}
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

const COBERTURA_PERIODOS = ["Manhã", "Tarde", "Almoço 12–14", "Noite", "Sábado", "Domingo"];
const coberturaVazia = () => COBERTURA_PERIODOS.map((p) => ({ periodo: p, percentual: null as number | null, cor: "#E4DFD9" }));

const PAGINA_VAZIA: Dados["pagina"] = {
  nome: "—", iniciais: "—", equipe: null, selo: "sem dados",
  corretores: [], cobertura: coberturaVazia(),
  funil: [{ rotulo: "Leads → negócios → visitas", valor: "—" }, { rotulo: "Vendas", valor: "—" }],
  metaPercentual: null, metaNota: "—", coaching: [], intervencao: [],
};

const vazioGerentes: Dados = { lista: [], pagina: PAGINA_VAZIA, atualizado: "—" };

function mapearGerentes(p: GerentesPayload | null): Dados {
  if (!p) return vazioGerentes;

  const lista: Gerente[] = p.lista.map((g) => ({
    nome: g.nome,
    iniciais: iniciaisDe(g.nome),
    corretores: g.corretores,
    capacidade: `${g.neg}/${g.lim ?? "—"}`,
    acima: g.lim != null && g.neg > g.lim,
    leads: g.leads,
    sla: null,
    mediana: g.mediana,
    p90: g.p90,
    leadVenda: g.lead_venda,
    visitas: g.visitas,
    propostas: null,
    vendas: g.vendas,
    vgv: g.vendas > 0 ? g.vgv : null,
    qualidade: null,
    amostra: null,
    parados: null,
    alertas: null,
    evolucao: "sobe",
  }));

  const pg = p.pagina;
  const metaPercentual = pg.meta_vgv > 0 ? Math.round((100 * pg.vgv) / pg.meta_vgv) : null;
  const pagina: Dados["pagina"] = {
    nome: pg.nome,
    iniciais: iniciaisDe(pg.nome),
    equipe: pg.equipe,
    selo: `${pg.intervencao.aguardando} aguardando · ${pg.intervencao.vencidos} vencidos`,
    corretores: pg.corretores.map((c) => ({
      nome: c.nome,
      carga: `${c.carga_neg}/${c.carga_lim ?? "—"}`,
      acima: c.carga_lim != null && c.carga_neg > c.carga_lim,
      leads: c.leads,
      mediana: c.mediana,
      p90: c.p90,
      sla: null,
      novato: c.leads < 20,
    })),
    cobertura: coberturaVazia(),
    funil: [
      { rotulo: "Leads → negócios → visitas", valor: `${pg.funil.leads} · ${pg.funil.negocios} · ${pg.funil.visitas}` },
      { rotulo: "Vendas", valor: `${pg.funil.vendas}` },
    ],
    metaPercentual,
    metaNota: `meta da equipe: ${fmt.dinheiro(pg.vgv)} de ${fmt.dinheiro(pg.meta_vgv)}${metaPercentual === null ? "" : ` (${metaPercentual}%)`}`,
    coaching: pg.corretores.slice(0, 2).map((c) => ({ pessoa: c.nome, texto: `espera mediana de ${fmt.duracaoMin(c.mediana)} — priorizar resposta rápida aos leads em aberto.` })),
    intervencao: [
      { l: "Leads aguardando resposta", r: String(pg.intervencao.aguardando) },
      { l: "Follow-ups vencidos", r: String(pg.intervencao.vencidos) },
    ],
  };

  return { lista, pagina, atualizado: hhmm(p.atualizado_em) };
}
