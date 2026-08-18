"use client";

/* 14 · QUALIDADE E DESENVOLVIMENTO — artboard 19a, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. quatro números: nota geral da empresa, cobertura de avaliação, avaliações
 *      contestadas e sem classificação
 *   2. OS 8 CRITÉRIOS em barras roxas, ao lado da tabela por corretor com pior e
 *      melhor critério e tendência
 *   3. FILA DE REVISÃO (avaliação contestada é revisível) e TREINO SUGERIDO do mês
 *   4. MÉTODO DE AVALIAÇÃO — quem avalia e com que pesos é decisão do Romulo
 *
 * Abaixo de 8 avaliações a nota NÃO é exibida: ausência de amostra nunca vira
 * nota zero, e a tela não inventa nota antes de existir.
 */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";

type Criterio = { nome: string; nota: number | null; largura: number };
type Pessoa = {
  nome: string;
  nota: number | null;
  amostra: number | null;
  pior: string;
  melhor: string;
  tendencia: "sobe" | "estavel" | "cai" | "sem";
  semClassificacao?: string;
};

type Dados = {
  notaEmpresa: number | null;
  amostra: number | null;
  cobertura: number | null;
  metaCobertura: number | null;
  contestadas: number | null;
  semClassificacao: number | null;
  semNomes: string;
  criterios: Criterio[];
  pessoas: Pessoa[];
  treino: { criterio: string; nota: number | null; texto: string };
  atualizado: string;
};

const nota = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const seta = (t: Pessoa["tendencia"]) => (t === "sobe" ? "↗" : t === "cai" ? "↘" : t === "sem" ? "—" : "→");
const corSeta = (t: Pessoa["tendencia"]) => (t === "sobe" ? "#1E7A46" : t === "cai" ? "#D93E3E" : "#9A938B");

export function QualidadeDesenvolvimento({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Nota geral da empresa", bruto: d.notaEmpresa, texto: nota(d.notaEmpresa), tile: "roxo", foot: `n = ${fmt.inteiro(d.amostra)} avaliações · tendência estável` },
    { rotulo: "Cobertura de avaliação", bruto: d.cobertura, texto: fmt.porcento(d.cobertura, 0), tom: "atencao", tile: "ambar", foot: `dos atendimentos do período · meta ${fmt.porcento(d.metaCobertura, 0)}` },
    { rotulo: "Avaliações contestadas", bruto: d.contestadas, texto: fmt.inteiro(d.contestadas), tom: "ruim", tile: "vermelho", foot: "abrir fila de revisão →" },
    { rotulo: "Sem classificação", bruto: d.semClassificacao, texto: fmt.inteiro(d.semClassificacao), tile: "laranja", foot: `${d.semNomes} — amostra abaixo de 8` },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="A CONVERSA COM O CLIENTE" titulo="Como estamos atendendo — e o que treinar em seguida" nota={`${recorte.periodo} · amostra declarada em cada critério`} />
      <GradeKpis itens={kpis} colunas={4} />

      {/* OS 8 CRITÉRIOS + TABELA POR PESSOA */}
      <div className="intp-op-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Os 8 critérios · empresa</span>
          {d.criterios.map((c) => (
            <button key={c.nome} type="button" className="intp-crit-linha" onClick={() => recorte.filtrar(`Critério: ${c.nome}`)}>
              <span className="intp-crit">
                <span className="intp-crit-rot">{c.nome}</span>
                <span className="intp-crit-trilha">
                  <span className="intp-crit-barra" style={{ width: `${c.largura}%` }} />
                </span>
                <b className="intp-crit-nota">{nota(c.nota)}</b>
              </span>
            </button>
          ))}
          <small className="intp-kpi-foot">clicar num critério abre os atendimentos avaliados nele, conforme permissão</small>
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
              { texto: p.pior, cor: p.pior.includes("caiu") ? "#B5700A" : undefined },
              { texto: p.melhor },
              { texto: seta(p.tendencia), cor: corSeta(p.tendencia) },
            ],
          }))}
          foot="a linha abre a aba Qualidade do perfil · a comparação considera origem e tipo dos leads de cada um · sem score único opaco"
        />
      </div>

      {/* FILA DE REVISÃO + TREINO */}
      <div className="intp-op-duas">
        <div className="intp-cartao" style={{ background: "#FBF6FE", boxShadow: "none", border: "1px solid #EBD1F5" }}>
          <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>
            Fila de revisão · {fmt.inteiro(d.contestadas)} contestadas
          </span>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#66009A" }}>
            Avaliações automatizadas são revisíveis: o corretor contesta, o gestor revê com a conversa ao lado — só no drill, com permissão; nunca em páginas gerais. A decisão substitui a nota e fica na Auditoria.
          </p>
          <button type="button" className="cop-acao" style={{ alignSelf: "flex-start" }} onClick={() => recorte.filtrar("Fila: revisão de avaliação")}>
            Abrir fila de revisão
          </button>
        </div>

        <div className="intp-cartao" style={{ background: "#FDF1D9", boxShadow: "none" }}>
          <span className="intp-cartao-titulo" style={{ color: "#7A5E12" }}>Treino sugerido do mês</span>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#7A5E12" }}>
            <b>{d.treino.criterio} ({nota(d.treino.nota)})</b> {d.treino.texto}
          </p>
        </div>
      </div>

      {/* MÉTODO DE AVALIAÇÃO */}
      <div className="intp-cartao">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="intp-cartao-titulo">Método de avaliação</span>
          <span className="intp-cartao-chip tom-aviso">aguardando decisão</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#4D4842" }}>
          Quem avalia, quantas por semana e com que pesos é decisão sua (Fase 9). Esta tela funciona com qualquer método — mas não inventa nota antes de existir.
        </p>
      </div>

      <RodapeFontes
        fontes={["avaliações de conversa", "wa_mensagens", "negócios"]}
        pendencias={["conversas fora do ERP não avaliadas", "método de avaliação aguardando decisão", "2 pessoas com amostra abaixo de 8"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  notaEmpresa: 4.3,
  amostra: 182,
  cobertura: 37,
  metaCobertura: 50,
  contestadas: 6,
  semClassificacao: 2,
  semNomes: "Luiza e Pedro",
  criterios: [
    { nome: "Cordialidade", nota: 4.7, largura: 94 },
    { nome: "Clareza", nota: 4.5, largura: 90 },
    { nome: "Escrita", nota: 4.4, largura: 88 },
    { nome: "Condução", nota: 4.2, largura: 84 },
    { nome: "Personalização", nota: 4.1, largura: 82 },
    { nome: "Qualificação", nota: 3.9, largura: 78 },
    { nome: "Objeções", nota: 3.8, largura: 76 },
    { nome: "Registro no ERP", nota: null, largura: 0 },
  ],
  pessoas: [
    { nome: "Ana Beatriz", nota: 4.6, amostra: 52, pior: "objeções 4,1", melhor: "cordialidade 4,9", tendencia: "sobe" },
    { nome: "Fernanda Lima", nota: 4.4, amostra: 38, pior: "qualificação 4,0", melhor: "escrita 4,7", tendencia: "estavel" },
    { nome: "Carlos Mendes", nota: 4.2, amostra: 44, pior: "qualificação 3,8", melhor: "clareza 4,6", tendencia: "cai" },
    { nome: "Rafael Souza", nota: 3.9, amostra: 26, pior: "objeções 3,4 · caiu 0,4", melhor: "cordialidade 4,5", tendencia: "cai" },
    { nome: "Luiza Braga", nota: null, amostra: 3, pior: "—", melhor: "—", tendencia: "sem", semClassificacao: "ainda sem classificação · 3 de 8 avaliações" },
    { nome: "Pedro Costa", nota: null, amostra: 2, pior: "—", melhor: "—", tendencia: "sem", semClassificacao: "ainda sem classificação · 2 de 8 avaliações" },
  ],
  treino: {
    criterio: "Objeções",
    nota: 3.8,
    texto: "é o pior critério e caiu 0,2 no período — concentrado na equipe Marcos (3,6). Sugerido por regra, com 12 atendimentos-exemplo anexados.",
  },
  atualizado: "14:32",
};
