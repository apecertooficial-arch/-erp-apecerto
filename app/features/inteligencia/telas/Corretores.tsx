"use client";

/* 13 · CORRETORES — artboard 18a, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. LISTA GERENCIAL — tabela larga com as 13 colunas do artboard: gerente,
 *      carga, leads, % SLA, med/P90, visitas, propostas, vendas·VGV, qualidade,
 *      FU vencidos, parados, presença e tendência
 *   2. PERFIL INDIVIDUAL — o que o gestor vê, com as abas do desenho (Resumo,
 *      Atendimento, Funil, Qualidade, Atividade, Vendas e comissão, Metas)
 *   3. Funil do período · qualidade · vendas e comissão, mais O QUE O PRÓPRIO
 *      CORRETOR VÊ (indo bem, para melhorar, precisam de você, meta)
 *   4. atividade de hoje em linha do tempo, com o aviso de que isto não é
 *      “horas trabalhadas”
 *
 * Régua: verde ≤5 min · âmbar 5–15 · vermelho acima de 15. Novato não é
 * classificado e a tela diz por quê — ausência de amostra nunca vira nota zero.
 */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Tabela } from "../pecas";

type Corretor = {
  nome: string;
  gerente: string;
  carga: string;
  acima?: boolean;
  leads: number | null;
  sla: number | null;
  mediana: number | null;
  p90: number | null;
  visitas: number | null;
  propostas: number | null;
  vendas: number | null;
  vgv: number | null;
  qualidade: number | null;
  amostra: number | null;
  vencidos: number | null;
  parados: number | null;
  presenca: number | null;
  tendencia: "sobe" | "estavel" | "cai" | "nova";
  novato?: boolean;
};

type Dados = {
  corretores: Corretor[];
  totalLeads: number | null;
  totalVendas: number | null;
  perfil: {
    nome: string;
    equipe: string;
    funil: string;
    funilNota: string;
    qualidade: number | null;
    amostra: number | null;
    piorCriterio: string;
    vendas: string;
    comissao: string;
    proprio: { tom: "bom" | "aviso" | "acao" | "meta"; titulo: string; texto: string }[];
    metaPercentual: number | null;
  };
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

export function Corretores({ recorte }: PropsTela) {
  const d = usarDados();
  const [aba, setAba] = useState<string>("Resumo");

  const tomProprio: Record<string, { bg: string; fg: string }> = {
    bom: { bg: "#E4F6EC", fg: "#1E7A46" },
    aviso: { bg: "#FDF1D9", fg: "#8A6A15" },
    acao: { bg: "#F7ECFC", fg: "#66009A" },
    meta: { bg: "#FFE4D1", fg: "#CC5800" },
  };

  return (
    <div className="int-secao">
      {/* 1 · LISTA GERENCIAL */}
      <Cabecalho
        eyebrow="LISTA GERENCIAL"
        titulo={`Os ${d.corretores.length} corretores, na mesma régua`}
        nota="verde ≤5 min · âmbar 5–15 · vermelho acima de 15"
      />
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
        foot={`novatos não são classificados (mínimo 8 avaliações) · leads somam ${fmt.inteiro(d.totalLeads)} · vendas somam ${fmt.inteiro(d.totalVendas)} · a linha destacada está aberta abaixo · esta lista é só de gestão — corretores não veem uns aos outros`}
      />

      {/* 2 · PERFIL INDIVIDUAL */}
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

      {/* 3 · O QUE O PRÓPRIO CORRETOR VÊ */}
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
            Isto <b>não é “horas trabalhadas”</b>: são presença registrada, disponibilidade online e atividade observada no ERP. Jornada formal só entra com integração de ponto. Movimento de mouse não é produtividade.
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
          {
            titulo: "Precisa de ajuda",
            chip: "com o motivo",
            chipTom: "ruim",
            linhas: [
              { l: "Rafael Souza", r: "rotina de follow-up", sub: "41 min de mediana e 19 vencidos, com carteira dentro da capacidade", corR: "#D93E3E" },
              { l: "Carlos Mendes", r: "menos carteira", sub: "14 min de mediana com 46 de 40 — atraso por volume, não por ritmo", corR: "#B5700A" },
            ],
            link: { rotulo: "Ver carga em Gerentes →", go: () => recorte.irPara("gerentes") },
          },
          {
            titulo: "Referência utilizável",
            linhas: [
              { l: "Ana Beatriz", r: "8 min · 34% no SLA", sub: "melhor tempo da casa, ainda acima da meta de 5 min" },
              { l: "Luiza Braga", r: "5 min · 47% no SLA", sub: "nova, sem amostra de qualidade — fora de classificação" },
            ],
            foot: "referência não é ranking: é prática para copiar",
          },
        ]}
      />

      <RodapeFontes
        fontes={["negócios", "wa_mensagens", "visitas", "avaliações de conversa", "presença no ERP"]}
        pendencias={["integração de ponto (jornada formal)", "comissão individual restrita a CEO e Financeiro"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  totalLeads: 486,
  totalVendas: 21,
  corretores: [
    { nome: "Ana Beatriz", gerente: "Juliana P.", carga: "38/40", leads: 148, sla: 34, mediana: 8, p90: 42, visitas: 41, propostas: 17, vendas: 8, vgv: 6_800_000, qualidade: 4.6, amostra: 52, vencidos: 9, parados: 3, presenca: 98, tendencia: "sobe" },
    { nome: "Fernanda Lima", gerente: "Juliana P.", carga: "32/40", leads: 96, sla: 29, mediana: 11, p90: 65, visitas: 24, propostas: 9, vendas: 4, vgv: 3_600_000, qualidade: 4.4, amostra: 38, vencidos: 11, parados: 4, presenca: 96, tendencia: "estavel" },
    { nome: "Luiza Braga", gerente: "Juliana P.", carga: "10/40", leads: 17, sla: 47, mediana: 5, p90: 19, visitas: 4, propostas: 2, vendas: 1, vgv: 800_000, qualidade: null, amostra: 3, vencidos: 1, parados: 0, presenca: 97, tendencia: "nova", novato: true },
    { nome: "Carlos Mendes", gerente: "Marcos V.", carga: "46/40", acima: true, leads: 118, sla: 18, mediana: 14, p90: 118, visitas: 27, propostas: 11, vendas: 5, vgv: 4_400_000, qualidade: 4.2, amostra: 44, vencidos: 15, parados: 7, presenca: 94, tendencia: "cai" },
    { nome: "Rafael Souza", gerente: "Marcos V.", carga: "31/40", leads: 92, sla: 8, mediana: 41, p90: 200, visitas: 18, propostas: 6, vendas: 3, vgv: 2_800_000, qualidade: 3.9, amostra: 26, vencidos: 19, parados: 6, presenca: 89, tendencia: "cai" },
    { nome: "Pedro Costa", gerente: "Marcos V.", carga: "8/40", leads: 15, sla: 44, mediana: 6, p90: 22, visitas: 4, propostas: 2, vendas: 0, vgv: null, qualidade: null, amostra: 2, vencidos: 2, parados: 1, presenca: 95, tendencia: "nova", novato: true },
  ],
  perfil: {
    nome: "Rafael Souza",
    equipe: "Marcos Vilela",
    funil: "92 → 51 → 18 → 6 → 3",
    funilNota: "lead → negócio → visita → proposta → venda",
    qualidade: 3.9,
    amostra: 26,
    piorCriterio: "pior critério: objeções 3,4 · tendência ↘",
    vendas: "3 · R$ 2,8 mi",
    comissao: "comissão calculada R$ 34,2 mil · paga R$ 22,8 mil",
    metaPercentual: 56,
    proprio: [
      { tom: "bom", titulo: "Indo bem", texto: "quando você responde em até 15 min, 2 em cada 3 leads avançam — seu atendimento converte; o gargalo é começar rápido." },
      { tom: "aviso", titulo: "Para melhorar", texto: "a primeira resposta no sábado está levando horas. Combinar o plantão com o Marcos resolve a maior parte." },
      { tom: "acao", titulo: "Precisam de você agora", texto: "7 leads esperando ação — abrir a fila →" },
      { tom: "meta", titulo: "Meta", texto: "faltam R$ 2,2 mi (56% feita). No seu ritmo de conversão, são ~4 visitas por semana até o fim do mês." },
    ],
  },
  atualizado: "14:32",
};
