"use client";

/* 14 · QUALIDADE E DESENVOLVIMENTO — artboard 19a. Agora lê dado real via
 * /api/inteligencia/qualidade (RPC intel_qualidade). Nota geral e os critérios
 * vêm de ia_notas_atendimento (escala 0-100 no banco, convertida para 0-5).
 * Cobertura de avaliação e fila de contestação não têm fonte -> —. Abaixo de 8
 * avaliações a nota não é exibida. Demo virou fixture. */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { QualidadeCriterios, QualidadePayload } from "../../../lib/inteligencia/tipos";

type Criterio = { nome: string; nota: number | null; largura: number };
type Pessoa = { nome: string; nota: number | null; amostra: number | null; pior: string; melhor: string; tendencia: "sobe" | "estavel" | "cai" | "sem"; semClassificacao?: string };

type Dados = {
  notaEmpresa: number | null; amostra: number | null; cobertura: number | null; metaCobertura: number | null;
  contestadas: number | null; semClassificacao: number | null; semNomes: string;
  criterios: Criterio[]; pessoas: Pessoa[]; treino: { criterio: string; nota: number | null; texto: string }; atualizado: string;
};

const nota = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const seta = (t: Pessoa["tendencia"]) => (t === "sobe" ? "↗" : t === "cai" ? "↘" : t === "sem" ? "—" : "→");
const corSeta = (t: Pessoa["tendencia"]) => (t === "sobe" ? "#1E7A46" : t === "cai" ? "#D93E3E" : "#9A938B");

const ORDEM_CRIT = ["Cordialidade", "Clareza", "Escrita", "Condução", "Personalização", "Qualificação", "Objeções"];

export function QualidadeDesenvolvimento({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<QualidadePayload>("qualidade", accessToken, recorte);
  const d = mapearQualidade(leitura.payload);

  const kpis: Kpi[] = [
    { rotulo: "Nota geral da empresa", bruto: d.notaEmpresa, texto: nota(d.notaEmpresa), tile: "roxo", foot: `n = ${fmt.inteiro(d.amostra)} avaliações (escala 0–5)` },
    { rotulo: "Cobertura de avaliação", bruto: d.cobertura, texto: fmt.porcento(d.cobertura, 0), tom: "atencao", tile: "ambar", motivo: "amostra", detalhe: "sem total de atendimentos avaliáveis", foot: "dos atendimentos do período" },
    { rotulo: "Avaliações críticas", bruto: d.contestadas, texto: fmt.inteiro(d.contestadas), tom: "ruim", tile: "vermelho", foot: "classificadas como críticas pela IA" },
    { rotulo: "Sem classificação", bruto: d.semClassificacao, texto: fmt.inteiro(d.semClassificacao), tile: "laranja", foot: `${d.semNomes} — amostra abaixo de 8` },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="A CONVERSA COM O CLIENTE" titulo="Como estamos atendendo — e o que treinar em seguida" nota={`${recorte.periodo} · amostra declarada em cada critério`} />
      <GradeKpis itens={kpis} colunas={4} />

      <div className="intp-op-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Os 8 critérios · empresa</span>
          {d.criterios.map((c) => (
            <button key={c.nome} type="button" className="intp-crit-linha" onClick={() => recorte.filtrar(`Critério: ${c.nome}`)}>
              <span className="intp-crit">
                <span className="intp-crit-rot">{c.nome}</span>
                <span className="intp-crit-trilha"><span className="intp-crit-barra" style={{ width: `${c.largura}%` }} /></span>
                <b className="intp-crit-nota">{nota(c.nota)}</b>
              </span>
            </button>
          ))}
          <small className="intp-kpi-foot">notas de 0 a 5, convertidas da avaliação por IA · clicar abre os atendimentos do critério</small>
        </div>

        <Tabela
          colunas={[{ titulo: "Corretor" }, { titulo: "Nota", num: true }, { titulo: "Amostra", num: true }, { titulo: "Pior critério" }, { titulo: "Melhor critério" }, { titulo: "Tendência" }]}
          ordenadaEm="Nota"
          linhas={d.pessoas.map((p) => ({
            chave: p.nome,
            destaque: p.nota !== null && p.nota < 4.0,
            abrir: () => recorte.filtrar(`Pessoa: ${p.nome}`),
            celulas: [
              { texto: p.nome, forte: true },
              p.semClassificacao
                ? { texto: "", chip: p.semClassificacao, chipTom: "roxo" as const }
                : { texto: nota(p.nota), num: true, forte: true, cor: (p.nota ?? 5) < 4.0 ? "#B5700A" : undefined },
              { texto: p.amostra === null ? "—" : `n=${fmt.inteiro(p.amostra)}`, num: true },
              { texto: p.pior },
              { texto: p.melhor },
              { texto: seta(p.tendencia), cor: corSeta(p.tendencia) },
            ],
          }))}
          foot="a linha abre a aba Qualidade do perfil · sem score único opaco"
        />
      </div>

      <div className="intp-op-duas">
        <div className="intp-cartao" style={{ background: "#FBF6FE", boxShadow: "none", border: "1px solid #EBD1F5" }}>
          <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>Fila de revisão · {fmt.inteiro(d.contestadas)} críticas</span>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#66009A" }}>
            Avaliações automatizadas são revisíveis: o corretor contesta, o gestor revê com a conversa ao lado — só no drill, com permissão. A decisão substitui a nota e fica na Auditoria. (Fluxo de contestação ainda não registrado no banco.)
          </p>
          <button type="button" className="cop-acao" style={{ alignSelf: "flex-start" }} onClick={() => recorte.filtrar("Fila: revisão de avaliação")}>Abrir fila de revisão</button>
        </div>

        <div className="intp-cartao" style={{ background: "#FDF1D9", boxShadow: "none" }}>
          <span className="intp-cartao-titulo" style={{ color: "#7A5E12" }}>Treino sugerido do mês</span>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#7A5E12" }}>
            <b>{d.treino.criterio} ({nota(d.treino.nota)})</b> {d.treino.texto}
          </p>
        </div>
      </div>

      <div className="intp-cartao">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="intp-cartao-titulo">Método de avaliação</span>
          <span className="intp-cartao-chip tom-aviso">aguardando decisão</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#4D4842" }}>
          Quem avalia, quantas por semana e com que pesos é decisão sua. Esta tela funciona com qualquer método — mas não inventa nota antes de existir.
        </p>
      </div>

      <RodapeFontes
        fontes={["avaliações de conversa (IA)", "corretores"]}
        pendencias={["cobertura de avaliação (sem total de atendimentos)", "fluxo de contestação não registrado", "conversas fora do ERP não avaliadas"]}
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

function extremos(c: QualidadeCriterios): { pior: string; melhor: string; piorNome: string; piorNota: number | null } {
  const pares = ORDEM_CRIT.map((k) => [k, c[k]] as [string, number | null]).filter((p) => p[1] != null) as [string, number][];
  if (pares.length === 0) return { pior: "—", melhor: "—", piorNome: "—", piorNota: null };
  const ord = [...pares].sort((a, b) => a[1] - b[1]);
  const min = ord[0];
  const max = ord[ord.length - 1];
  const fmtC = (p: [string, number]) => `${p[0]} ${p[1].toFixed(1).replace(".", ",")}`;
  return { pior: fmtC(min), melhor: fmtC(max), piorNome: min[0], piorNota: min[1] };
}

const vazioQualidade: Dados = {
  notaEmpresa: null, amostra: null, cobertura: null, metaCobertura: null, contestadas: null, semClassificacao: null, semNomes: "—",
  criterios: [...ORDEM_CRIT, "Registro no ERP"].map((n) => ({ nome: n, nota: null, largura: 0 })),
  pessoas: [], treino: { criterio: "—", nota: null, texto: "aguardando avaliações." }, atualizado: "—",
};

function mapearQualidade(p: QualidadePayload | null): Dados {
  if (!p) return vazioQualidade;
  const criterios: Criterio[] = [
    ...ORDEM_CRIT.map((n) => {
      const v = p.criterios[n] ?? null;
      return { nome: n, nota: v, largura: v === null ? 0 : Math.round((v / 5) * 100) };
    }),
    { nome: "Registro no ERP", nota: null, largura: 0 },
  ];
  const semNomesArr = p.pessoas.filter((x) => x.amostra < 8).map((x) => x.nome);
  const empresaExtremos = extremos(p.criterios);

  return {
    notaEmpresa: p.nota_empresa,
    amostra: p.amostra,
    cobertura: null,
    metaCobertura: null,
    contestadas: p.criticas,
    semClassificacao: semNomesArr.length,
    semNomes: semNomesArr.length ? semNomesArr.join(", ") : "nenhum",
    criterios,
    pessoas: p.pessoas.map((x) => {
      const ex = extremos(x.criterios);
      const classif = x.amostra < 8;
      return {
        nome: x.nome,
        nota: classif ? null : x.nota,
        amostra: x.amostra,
        pior: classif ? "—" : ex.pior,
        melhor: classif ? "—" : ex.melhor,
        tendencia: classif ? "sem" : "estavel",
        semClassificacao: classif ? `sem classificação · ${x.amostra} de 8 avaliações` : undefined,
      };
    }),
    treino: {
      criterio: empresaExtremos.piorNome,
      nota: empresaExtremos.piorNota,
      texto: "é o critério mais baixo da empresa no período — priorizar no treino da semana.",
    },
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoQualidade: Dados = {
  notaEmpresa: 4.3, amostra: 182, cobertura: 37, metaCobertura: 50, contestadas: 6, semClassificacao: 2, semNomes: "Luiza e Pedro",
  criterios: [
    { nome: "Cordialidade", nota: 4.7, largura: 94 },
    { nome: "Objeções", nota: 3.8, largura: 76 },
    { nome: "Registro no ERP", nota: null, largura: 0 },
  ],
  pessoas: [
    { nome: "Ana Beatriz", nota: 4.6, amostra: 52, pior: "objeções 4,1", melhor: "cordialidade 4,9", tendencia: "sobe" },
    { nome: "Luiza Braga", nota: null, amostra: 3, pior: "—", melhor: "—", tendencia: "sem", semClassificacao: "sem classificação · 3 de 8 avaliações" },
  ],
  treino: { criterio: "Objeções", nota: 3.8, texto: "é o pior critério e caiu 0,2 no período." },
  atualizado: "14:32",
};
