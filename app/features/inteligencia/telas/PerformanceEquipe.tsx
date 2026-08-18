"use client";

/* PERFORMANCE DA EQUIPE — artboard 16a.
 * Quatro pilares (velocidade, qualidade, conversão, disciplina), duas equipes na
 * mesma régua e nenhuma nota geral: sem score opaco, por decisão de projeto.
 * Amostra mínima de 8 atendimentos para classificar — abaixo disso, não classifica.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Dados = {
  velocidade: number | null;
  qualidade: number | null;
  amostraQualidade: number | null;
  conversao: number | null;
  disciplina: number | null;
  equipes: { chave: string; nome: string; pessoas: number | null; leads: number | null; fechamentos: number | null; sla: number | null; cor: string; det: Detalhe }[];
  pilares: { pilar: string; venda: string; locacao: string; meta: string; leitura: string }[];
  atualizado: string;
};

export function PerformanceEquipe({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Velocidade", bruto: d.velocidade, texto: fmt.porcento(d.velocidade, 0), tom: "ruim", tile: "vermelho", foot: "no SLA de 5 min" },
    { rotulo: "Qualidade", bruto: d.qualidade, texto: d.qualidade === null ? "—" : d.qualidade.toFixed(1).replace(".", ","), tile: "roxo", motivo: "amostra", foot: `n=${fmt.inteiro(d.amostraQualidade)} conversas avaliadas` },
    { rotulo: "Conversão", bruto: d.conversao, texto: fmt.porcento(d.conversao), tile: "verde", foot: "lead → venda" },
    { rotulo: "Disciplina", bruto: d.disciplina, texto: fmt.inteiro(d.disciplina), tom: "atencao", tile: "ambar", foot: "follow-ups vencidos" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="OS QUATRO PILARES" titulo="Sem nota geral: cada pilar responde por si" nota={recorte.periodo} />
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
          abrir: () => setDetalhe(e.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="PILAR POR PILAR" titulo="Cada equipe contra a meta, não contra a outra" cor="#8B00CC" />
      <Tabela
        colunas={[{ titulo: "Pilar" }, { titulo: "Venda" }, { titulo: "Locação" }, { titulo: "Meta" }, { titulo: "Leitura" }]}
        linhas={d.pilares.map((p) => ({
          chave: p.pilar,
          abrir: () => recorte.filtrar(`Pilar: ${p.pilar}`),
          celulas: [{ texto: p.pilar, forte: true }, { texto: p.venda }, { texto: p.locacao }, { texto: p.meta }, { texto: p.leitura }],
        }))}
        foot="pilar sem amostra suficiente mostra “—” na coluna da equipe, e a linha continua na tabela"
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
    { pilar: "Qualidade · nota", venda: "4,1", locacao: "3,7", meta: "4,0", leitura: "objecão de preço puxa a Locação para baixo" },
    { pilar: "Conversão · lead → venda", venda: "5,0%", locacao: "3,6%", meta: "5,0%", leitura: "Venda na meta; Locação perde na etapa da visita" },
    { pilar: "Disciplina · vencidos", venda: "19", locacao: "38", meta: "0", leitura: "26 negócios sem próxima ação registrada" },
  ],
  atualizado: "14:28",
};
