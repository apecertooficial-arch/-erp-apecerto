"use client";

/* GERENTES — artboard 17a.
 * Carga, cobertura de horário, coaching e intervenções. Com dois gerentes não
 * existe mediana da casa: a comparação é sempre contra a meta, nunca entre pares.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Dados = {
  gerentes: number | null;
  cargaDesequilibrada: number | null;
  coberturaSabado: number | null;
  intervencoes: number | null;
  linhas: { chave: string; nome: string; equipe: string; pessoas: number | null; sla: number | null; cor: string; det: Detalhe }[];
  tabela: { gerente: string; equipe: string; capacidade: string; leads: number | null; sla: number | null; conversao: number | null; coaching: number | null }[];
  atualizado: string;
};

export function Gerentes({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Gerentes", bruto: d.gerentes, texto: fmt.inteiro(d.gerentes), tile: "roxo", foot: "sem mediana da casa: são dois" },
    { rotulo: "Carga desequilibrada", bruto: d.cargaDesequilibrada, texto: fmt.inteiro(d.cargaDesequilibrada), tom: "ruim", tile: "vermelho", foot: "Carlos com 46 de 40" },
    { rotulo: "Cobertura de sábado", bruto: d.coberturaSabado, texto: fmt.porcento(d.coberturaSabado, 0), tom: "ruim", tile: "ambar", foot: "no SLA · escala não integrada" },
    { rotulo: "Intervenções abertas", bruto: d.intervencoes, texto: fmt.inteiro(d.intervencoes), tile: "laranja", foot: "com prazo definido" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="OS DOIS GERENTES" titulo="Comparados com a meta, não entre si" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Banner
        tom="tint-roxo"
        forte="Escala e ponto não estão integrados."
        texto="Esta tela mostra atividade registrada no ERP, não jornada de trabalho. Ausência de registro não é ausência da pessoa — e nunca vira nota."
      />

      <ListaComDetalhe
        eyebrow="CARGA E COBERTURA"
        titulo="Qual gerente precisa de apoio, e em que exatamente"
        nota="cada gerente vê a própria página; a régua entre pares é do CEO"
        linhas={d.linhas.map((l) => ({
          chave: l.chave,
          nome: l.nome,
          meio: `${l.equipe} · ${fmt.inteiro(l.pessoas)} pessoas`,
          fim: `SLA ${fmt.porcento(l.sla, 0)}`,
          cor: l.cor,
          abrir: () => setDetalhe(l.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="LADO A LADO" titulo="Cada número com a meta ao lado" cor="#8B00CC" />
      <Tabela
        colunas={[{ titulo: "Gerente" }, { titulo: "Equipe" }, { titulo: "Capacidade" }, { titulo: "Leads", num: true }, { titulo: "% SLA", num: true }, { titulo: "Conversão", num: true }, { titulo: "Coaching", num: true }]}
        ordenadaEm="Leads"
        linhas={d.tabela.map((g) => ({
          chave: g.gerente,
          abrir: () => recorte.filtrar(`Gerente: ${g.gerente}`),
          celulas: [
            { texto: g.gerente, forte: true },
            { texto: g.equipe },
            { texto: g.capacidade },
            { texto: fmt.inteiro(g.leads), num: true },
            { texto: fmt.porcento(g.sla, 0), num: true, cor: (g.sla ?? 100) < 20 ? "#D93E3E" : undefined },
            { texto: fmt.porcento(g.conversao), num: true },
            { texto: fmt.inteiro(g.coaching), num: true },
          ],
        }))}
        foot="meta de SLA: 60% · capacidade combinada: 40 negócios por pessoa"
      />

      <RodapeFontes
        fontes={["negócios", "leads", "carga por corretor", "intervenções"]}
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
  gerentes: 2,
  cargaDesequilibrada: 1,
  coberturaSabado: 18,
  intervencoes: 3,
  linhas: [
    { chave: "juliana", nome: "Juliana Prado", equipe: "Venda", pessoas: 4, sla: 31, cor: "#1FA85A", det: { titulo: "Juliana Prado", sub: "equipe Venda", linhas: [["Leads da equipe", "261"], ["Vendas", "13"], ["Carga máxima", "38 de 40"], ["Coaching aberto", "1"]], aviso: "Cada gerente vê a própria página; a régua entre pares é do CEO." } },
    { chave: "marcos", nome: "Marcos Vilela", equipe: "Locação", pessoas: 6, sla: 14, cor: "#D93E3E", det: { titulo: "Marcos Vilela", sub: "equipe Locação", linhas: [["Leads da equipe", "225"], ["Locações", "8"], ["Carlos sobrecarregado", "46 de 40"], ["Sábado no SLA", "18%"]], aviso: "Sugestão de redistribuição depende de carga atualizada." } },
  ],
  tabela: [
    { gerente: "Juliana Prado", equipe: "Venda", capacidade: "38 de 40", leads: 261, sla: 31, conversao: 5.0, coaching: 1 },
    { gerente: "Marcos Vilela", equipe: "Locação", capacidade: "46 de 40", leads: 225, sla: 14, conversao: 3.6, coaching: 2 },
  ],
  atualizado: "14:28",
};
