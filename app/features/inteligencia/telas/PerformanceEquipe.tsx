"use client";

/* 11 · PERFORMANCE DA EQUIPE — artboard 16a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. os quatro pilares (velocidade, qualidade, conversão, disciplina)
 *   2. as duas equipes na mesma régua (lista + detalhe)
 *   3. tabela pilar por pilar, cada equipe contra a META — nunca entre si
 *   4. amostra e regra de justiça · o que a tela não faz
 *   5. rodapé de fontes
 *
 * Nenhuma nota geral: sem score opaco, por decisão de projeto. Amostra mínima de
 * 8 atendimentos para classificar.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Dados = {
  velocidade: number | null;
  qualidade: number | null;
  amostraQualidade: number | null;
  conversao: number | null;
  disciplina: number | null;
  equipes: { chave: string; nome: string; pessoas: number | null; leads: number | null; fechamentos: number | null; sla: number | null; cor: string; det: Detalhe }[];
  pilares: { pilar: string; venda: string; locacao: string; meta: string; leitura: string }[];
  amostra: { l: string; r: string; sub?: string }[];
  naoFaz: { l: string; r: string }[];
  atualizado: string;
};

export function PerformanceEquipe({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Velocidade", bruto: d.velocidade, texto: fmt.porcento(d.velocidade, 0), tom: "ruim", tile: "vermelho", foot: "no SLA de 5 min" },
    { rotulo: "Qualidade", bruto: d.qualidade, texto: d.qualidade === null ? "—" : d.qualidade.toFixed(1).replace(".", ","), tile: "roxo", foot: `n=${fmt.inteiro(d.amostraQualidade)} conversas avaliadas` },
    { rotulo: "Conversão", bruto: d.conversao, texto: fmt.porcento(d.conversao), tile: "verde", foot: "lead → venda" },
    { rotulo: "Disciplina", bruto: d.disciplina, texto: fmt.inteiro(d.disciplina), tom: "atencao", tile: "ambar", foot: "follow-ups vencidos" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="OS QUATRO PILARES" titulo="Sem nota geral: cada pilar responde por si" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      <ListaComDetalhe
        eyebrow="POR EQUIPE"
        titulo="As duas equipes na mesma régua"
        nota="amostra mínima de 8 atendimentos para classificar · novato fica fora de ranking, por regra de justiça"
        linhas={d.equipes.map((e) => ({
          chave: e.chave,
          nome: e.nome,
          meio: `${fmt.inteiro(e.leads)} leads · ${fmt.inteiro(e.pessoas)} pessoas`,
          fim: e.sla === null ? "sem amostra" : `SLA ${fmt.porcento(e.sla, 0)}`,
          cor: e.cor,
          ativa: detalhe?.titulo === e.det.titulo,
          abrir: () => setDetalhe(e.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="PILAR POR PILAR" titulo="Cada equipe contra a meta, não contra a outra" cor="#8B00CC" nota="clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Pilar" }, { titulo: "Venda" }, { titulo: "Locação" }, { titulo: "Meta" }, { titulo: "Leitura" }]}
        linhas={d.pilares.map((p) => ({
          chave: p.pilar,
          abrir: () => recorte.filtrar(`Pilar: ${p.pilar}`),
          celulas: [{ texto: p.pilar, forte: true }, { texto: p.venda }, { texto: p.locacao }, { texto: p.meta }, { texto: p.leitura }],
        }))}
        foot="pilar sem amostra suficiente mostra “—” na coluna da equipe, e a linha continua na tabela"
      />

      <Cabecalho eyebrow="REGRA DE JUSTIÇA" titulo="O que sustenta cada número — e o que a tela não faz" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Amostra declarada", linhas: d.amostra, foot: "abaixo do mínimo, a pessoa não é classificada nem recebe cor de alerta" },
          { titulo: "O que esta tela não faz", chip: "por decisão de projeto", chipTom: "roxo", linhas: d.naoFaz, foot: "ausência de registro nunca vira nota zero" },
        ]}
      />

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "avaliações de conversa"]}
        pendencias={["conversas fora do ERP não são avaliadas — buraco declarado", "escala/ponto não integrado"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  velocidade: 22,
  qualidade: 3.9,
  amostraQualidade: 182,
  conversao: 4.3,
  disciplina: 57,
  equipes: [
    { chave: "venda", nome: "Venda · Juliana Prado", pessoas: 4, leads: 261, fechamentos: 13, sla: 31, cor: "#1FA85A", det: { titulo: "Equipe Venda", sub: "Juliana Prado · 4 pessoas", linhas: [["Leads", "261"], ["Vendas", "13"], ["VGV", "R$ 11,2 mi"], ["% no SLA", "31%"]], aviso: "Comissão individual não aparece para o gerente." } },
    { chave: "locacao", nome: "Locação · Marcos Vilela", pessoas: 6, leads: 225, fechamentos: 8, sla: 14, cor: "#D93E3E", det: { titulo: "Equipe Locação", sub: "Marcos Vilela · 6 pessoas", linhas: [["Leads", "225"], ["Locações", "8"], ["VGV", "R$ 7,2 mi"], ["% no SLA", "14%"]], aviso: "Cobertura de sábado é o ponto crítico desta equipe." } },
    { chave: "novato", nome: "Pedro Costa · novato", pessoas: 1, leads: 18, fechamentos: null, sla: null, cor: "#8B00CC", det: { titulo: "Pedro Costa", sub: "admitido há 9 dias", linhas: [["Leads recebidos", "18"], ["Atendimentos", "6"], ["Classificação", "não se aplica"], ["Regra", "mínimo de 8"]], aviso: "Novato fica fora de ranking e de cor de alerta, por regra de justiça." } },
  ],
  pilares: [
    { pilar: "Velocidade · % no SLA", venda: "31%", locacao: "14%", meta: "60%", leitura: "as duas abaixo da meta; Locação é o gargalo" },
    { pilar: "Qualidade · nota", venda: "4,1", locacao: "3,7", meta: "4,0", leitura: "objeção de preço puxa a Locação para baixo" },
    { pilar: "Conversão · lead → venda", venda: "5,0%", locacao: "3,6%", meta: "5,0%", leitura: "Venda na meta; Locação perde na etapa da visita" },
    { pilar: "Disciplina · vencidos", venda: "19", locacao: "38", meta: "0", leitura: "26 negócios sem próxima ação registrada" },
  ],
  amostra: [
    { l: "Conversas avaliadas no período", r: "182" },
    { l: "Pessoas com amostra suficiente", r: "5 de 6", sub: "mínimo de 8 atendimentos" },
    { l: "Fora da régua por tempo de casa", r: "1", sub: "Pedro Costa · 9 dias" },
  ],
  naoFaz: [
    { l: "Nota geral única por pessoa", r: "não existe" },
    { l: "Ranking nominal entre corretores", r: "não exibido" },
    { l: "Medir jornada de trabalho", r: "não mede" },
    { l: "Estimar dado que faltou", r: "nunca" },
  ],
  atualizado: "14:28",
};
