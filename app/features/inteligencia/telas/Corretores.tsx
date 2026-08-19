"use client";

/* 13 · CORRETORES — artboard 18a. Agora lê dado real via
 * /api/inteligencia/corretores (RPC intel_corretores). Régua por corretor:
 * leads, carga (negócios Funil 2.0), vendas·VGV, visitas, espera (SLA do backlog)
 * e follow-ups vencidos — reais. Qualidade de conversa, propostas e presença não
 * têm fonte ligada -> — / "sem amostra". Demo virou fixture. */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Tabela } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { CorretoresPayload } from "../../../lib/inteligencia/tipos";

type Corretor = {
  nome: string; gerente: string; carga: string; acima?: boolean;
  leads: number | null; sla: number | null; mediana: number | null; p90: number | null;
  visitas: number | null; propostas: number | null; vendas: number | null; vgv: number | null;
  qualidade: number | null; amostra: number | null; vencidos: number | null; parados: number | null;
  presenca: number | null; tendencia: "sobe" | "estavel" | "cai" | "nova"; novato?: boolean;
};

type Dados = {
  corretores: Corretor[];
  totalLeads: number | null;
  totalVendas: number | null;
  perfil: {
    nome: string; equipe: string; funil: string; funilNota: string;
    qualidade: number | null; amostra: number | null; piorCriterio: string;
    vendas: string; comissao: string;
    proprio: { tom: "bom" | "aviso" | "acao" | "meta"; titulo: string; texto: string }[];
    metaPercentual: number | null;
  };
  ajuda: { l: string; r: string; sub: string; corR?: string }[];
  referencia: { l: string; r: string; sub: string }[];
  atualizado: string;
};

const corDoTempo = (min: number | null, novato?: boolean) => {
  if (novato || min === null) return "#8B00CC";
  if (min <= 5) return "#1FA85A";
  if (min <= 15) return "#B5700A";
  return "#D93E3E";
};
const corDoSla = (sla: number | null) => {
  if (sla === null) return undefined;
  if (sla >= 40) return "#1E7A46";
  if (sla >= 25) return "#B5700A";
  return "#D93E3E";
};
const seta = (t: Corretor["tendencia"]) => (t === "sobe" ? "↗" : t === "cai" ? "↘" : t === "nova" ? "—" : "→");
const corSeta = (t: Corretor["tendencia"]) => (t === "sobe" ? "#1E7A46" : t === "cai" ? "#D93E3E" : "#9A938B");

const abas = ["Resumo", "Atendimento", "Funil", "Qualidade", "Atividade", "Vendas e comissão", "Metas"] as const;

export function Corretores({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<CorretoresPayload>("corretores", accessToken, recorte);
  const d = mapearCorretores(leitura.payload);
  const [aba, setAba] = useState<string>("Resumo");

  const tomProprio: Record<string, { bg: string; fg: string }> = {
    bom: { bg: "#E4F6EC", fg: "#1E7A46" },
    aviso: { bg: "#FDF1D9", fg: "#8A6A15" },
    acao: { bg: "#F7ECFC", fg: "#66009A" },
    meta: { bg: "#FFE4D1", fg: "#CC5800" },
  };

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="LISTA GERENCIAL" titulo={`Os ${d.corretores.length} corretores, na mesma régua`} nota="espera do lead: verde ≤5 min · âmbar 5–15 · vermelho acima de 15" />
      <Tabela
        colunas={[
          { titulo: "Corretor" }, { titulo: "Gerente" }, { titulo: "Carga" }, { titulo: "Leads", num: true }, { titulo: "% SLA", num: true },
          { titulo: "med · P90" }, { titulo: "Visitas", num: true }, { titulo: "Propostas", num: true }, { titulo: "Vendas · VGV" },
          { titulo: "Qualidade" }, { titulo: "FU venc.", num: true }, { titulo: "Parados", num: true }, { titulo: "Presença", num: true }, { titulo: "Tend." },
        ]}
        ordenadaEm="Leads"
        linhas={d.corretores.map((c) => ({
          chave: c.nome,
          destaque: c.nome === d.perfil.nome,
          abrir: () => recorte.filtrar(`Corretor: ${c.nome}`),
          celulas: [
            { texto: c.nome, forte: true, sub: c.novato ? "nova" : undefined },
            { texto: c.gerente },
            { texto: c.carga, cor: c.acima ? "#D93E3E" : undefined, forte: c.acima },
            { texto: fmt.inteiro(c.leads), num: true },
            { texto: fmt.porcento(c.sla, 0), num: true, forte: true, cor: corDoSla(c.sla) },
            { texto: c.mediana === null ? "—" : `${fmt.duracaoMin(c.mediana)} · ${fmt.duracaoMin(c.p90)}`, cor: corDoTempo(c.mediana, c.novato) },
            { texto: fmt.inteiro(c.visitas), num: true },
            { texto: fmt.inteiro(c.propostas), num: true },
            { texto: c.vendas === null ? "—" : `${fmt.inteiro(c.vendas)} · ${fmt.dinheiro(c.vgv)}` },
            c.qualidade === null
              ? { texto: "", chip: `sem amostra (n=${fmt.inteiro(c.amostra)})`, chipTom: "roxo" as const }
              : { texto: `${c.qualidade.toFixed(1).replace(".", ",")} (n=${fmt.inteiro(c.amostra)})` },
            { texto: fmt.inteiro(c.vencidos), num: true, cor: (c.vencidos ?? 0) >= 15 ? "#D93E3E" : undefined, forte: (c.vencidos ?? 0) >= 15 },
            { texto: fmt.inteiro(c.parados), num: true },
            { texto: fmt.porcento(c.presenca, 0), num: true },
            { texto: seta(c.tendencia), cor: corSeta(c.tendencia) },
          ],
        }))}
        foot={`leads somam ${fmt.inteiro(d.totalLeads)} · vendas somam ${fmt.inteiro(d.totalVendas)} · a linha destacada está aberta abaixo · esta lista é só de gestão — corretores não veem uns aos outros`}
      />

      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span className="intp-cab-eyebrow" style={{ color: "#8B00CC" }}>PERFIL INDIVIDUAL · O QUE O GESTOR VÊ</span>
          <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {d.perfil.nome} · Equipe {d.perfil.equipe}
          </h2>
        </div>
        <div className="intp-cortes" style={{ marginLeft: "auto" }}>
          {abas.map((a) => (
            <button key={a} type="button" className={`intp-corte${a === aba ? " ativo" : ""}`} onClick={() => setAba(a)} aria-pressed={a === aba}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="intp-op-tres">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Funil do período</span>
          <strong style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{d.perfil.funil}</strong>
          <small className="intp-kpi-foot">{d.perfil.funilNota}</small>
        </div>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Qualidade</span>
          <strong style={{ fontSize: 20, fontWeight: 700 }}>
            {d.perfil.qualidade === null ? "—" : d.perfil.qualidade.toFixed(1).replace(".", ",")}{" "}
            <span style={{ fontSize: 12, fontWeight: 600, color: "#9A938B" }}>(n={fmt.inteiro(d.perfil.amostra)})</span>
          </strong>
          <small className="intp-kpi-foot">{d.perfil.piorCriterio}</small>
        </div>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Vendas e comissão</span>
          <strong style={{ fontSize: 20, fontWeight: 700 }}>{d.perfil.vendas}</strong>
          <small className="intp-kpi-foot">{d.perfil.comissao}</small>
        </div>
      </div>

      <div className="intp-op-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Atividade de hoje · linha do tempo</span>
          <span style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden" }}>
            <span style={{ width: "34%", background: "#1FA85A" }} />
            <span style={{ width: "14%", background: "#EFECE7" }} />
            <span style={{ width: "18%", background: "#8FD9AC" }} />
            <span style={{ width: "12%", background: "#8B00CC" }} />
            <span style={{ width: "22%", background: "#1FA85A" }} />
          </span>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#6E6760" }}>
            <span>● presença + disponível</span>
            <span>● atividade observada no ERP</span>
            <span>● visita</span>
            <span>● sem sinal</span>
          </div>
          <div className="intp-detalhe-aviso">
            Ilustração de presença — <b>não é “horas trabalhadas”</b>. Jornada formal só entra com integração de ponto; até lá, esta faixa é apenas conceitual.
          </div>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>O QUE O PRÓPRIO {d.perfil.nome.split(" ")[0].toUpperCase()} VÊ</span>
          <b style={{ fontSize: 15 }}>Olá, {d.perfil.nome.split(" ")[0]} — seu mês até aqui</b>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {d.perfil.proprio.map((p) => (
              <div key={p.titulo} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ flex: "none", fontSize: 10.5, fontWeight: 700, background: tomProprio[p.tom].bg, color: tomProprio[p.tom].fg, borderRadius: 999, padding: "3px 9px" }}>
                  {p.titulo}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#4D4842" }}>{p.texto}</span>
              </div>
            ))}
          </div>
          <span className="intp-casc-trilha" style={{ marginTop: 4 }}>
            <span className="intp-casc-barra entra" style={{ width: `${d.perfil.metaPercentual ?? 0}%` }} />
          </span>
          <small className="intp-kpi-foot">orientação prática, sem comparação nominal com colegas — o corretor só vê os próprios dados</small>
        </div>
      </div>

      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Precisa de ajuda", chip: "com o motivo", chipTom: "ruim", linhas: d.ajuda, link: { rotulo: "Ver carga em Gerentes →", go: () => recorte.irPara("gerentes") } },
          { titulo: "Referência utilizável", linhas: d.referencia, foot: "referência não é ranking: é prática para copiar" },
        ]}
      />

      <RodapeFontes
        fontes={["negócios", "wa_mensagens", "visitas", "vendas"]}
        pendencias={["qualidade de conversa (avaliação por IA)", "integração de ponto (jornada formal)", "comissão individual restrita a CEO e Financeiro"]}
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

const PERFIL_VAZIO: Dados["perfil"] = {
  nome: "—", equipe: "—", funil: "—", funilNota: "leads → negócios abertos → visitas → vendas",
  qualidade: null, amostra: null, piorCriterio: "—", vendas: "—", comissao: "—", metaPercentual: null,
  proprio: [],
};

const vazioCorretores: Dados = {
  corretores: [], totalLeads: null, totalVendas: null, perfil: PERFIL_VAZIO, ajuda: [], referencia: [], atualizado: "—",
};

function mapearCorretores(p: CorretoresPayload | null): Dados {
  if (!p) return vazioCorretores;
  const cs = p.corretores;
  const corretores: Corretor[] = cs.map((c) => ({
    nome: c.nome,
    gerente: c.gerente,
    carga: `${c.negocios}/${c.limite ?? "—"}`,
    acima: c.limite != null && c.negocios > c.limite,
    leads: c.leads,
    sla: null,
    mediana: c.mediana,
    p90: c.p90,
    visitas: c.visitas,
    propostas: null,
    vendas: c.vendas,
    vgv: c.vendas > 0 ? c.vgv : null,
    qualidade: null,
    amostra: null,
    vencidos: c.vencidos,
    parados: null,
    presenca: null,
    tendencia: "estavel",
    novato: c.leads < 20,
  }));

  const ajuda = [...cs].sort((a, b) => b.aguardando - a.aguardando).slice(0, 2).map((c) => ({
    l: c.nome,
    r: `${c.aguardando} aguardando`,
    sub: `espera mediana ${fmt.duracaoMin(c.mediana)} · ${c.vencidos} follow-ups vencidos`,
    corR: "#D93E3E",
  }));
  const referencia = [...cs].filter((c) => c.mediana != null).sort((a, b) => (a.mediana ?? 0) - (b.mediana ?? 0)).slice(0, 2).map((c) => ({
    l: c.nome,
    r: `espera ${fmt.duracaoMin(c.mediana)}`,
    sub: `${c.vendas} vendas · ${c.leads} leads`,
  }));

  const top = cs[0];
  const perfil: Dados["perfil"] = top ? {
    nome: top.nome,
    equipe: top.gerente,
    funil: `${top.leads} → ${top.negocios} → ${top.visitas} → ${top.vendas}`,
    funilNota: "leads → negócios abertos → visitas → vendas",
    qualidade: null,
    amostra: null,
    piorCriterio: "avaliação por IA ainda não ligada",
    vendas: `${top.vendas} · ${fmt.dinheiro(top.vendas > 0 ? top.vgv : null)}`,
    comissao: "comissão individual em Financeiro",
    metaPercentual: null,
    proprio: [
      { tom: "bom", titulo: "Indo bem", texto: `${top.leads} leads recebidos e ${top.visitas} visitas no período.` },
      { tom: "aviso", titulo: "Para melhorar", texto: top.vencidos > 0 ? `${top.vencidos} follow-ups vencidos para colocar em dia.` : "nenhum follow-up vencido — mantenha o ritmo." },
      { tom: "acao", titulo: "Precisam de você agora", texto: `${top.aguardando} leads aguardando resposta.` },
      { tom: "meta", titulo: "Meta", texto: "acompanhe sua meta em Vendas e previsão." },
    ],
  } : PERFIL_VAZIO;

  return { corretores, totalLeads: p.totais.leads, totalVendas: p.totais.vendas, perfil, ajuda, referencia, atualizado: hhmm(p.atualizado_em) };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoCorretores: Dados = {
  totalLeads: 486, totalVendas: 21,
  corretores: [
    { nome: "Ana Beatriz", gerente: "Juliana P.", carga: "38/40", leads: 148, sla: 34, mediana: 8, p90: 42, visitas: 41, propostas: 17, vendas: 8, vgv: 6_800_000, qualidade: 4.6, amostra: 52, vencidos: 9, parados: 3, presenca: 98, tendencia: "sobe" },
    { nome: "Rafael Souza", gerente: "Marcos V.", carga: "31/40", leads: 92, sla: 8, mediana: 41, p90: 200, visitas: 18, propostas: 6, vendas: 3, vgv: 2_800_000, qualidade: 3.9, amostra: 26, vencidos: 19, parados: 6, presenca: 89, tendencia: "cai" },
  ],
  perfil: {
    nome: "Rafael Souza", equipe: "Marcos Vilela", funil: "92 → 51 → 18 → 6 → 3", funilNota: "lead → negócio → visita → proposta → venda",
    qualidade: 3.9, amostra: 26, piorCriterio: "pior critério: objeções 3,4 · tendência ↘",
    vendas: "3 · R$ 2,8 mi", comissao: "comissão calculada R$ 34,2 mil · paga R$ 22,8 mil", metaPercentual: 56,
    proprio: [
      { tom: "bom", titulo: "Indo bem", texto: "quando você responde em até 15 min, 2 em cada 3 leads avançam." },
      { tom: "meta", titulo: "Meta", texto: "faltam R$ 2,2 mi (56% feita)." },
    ],
  },
  ajuda: [{ l: "Rafael Souza", r: "rotina de follow-up", sub: "41 min de mediana e 19 vencidos", corR: "#D93E3E" }],
  referencia: [{ l: "Ana Beatriz", r: "8 min · 34% no SLA", sub: "melhor tempo da casa" }],
  atualizado: "14:32",
};
