"use client";

/* 14 · QUALIDADE E DESENVOLVIMENTO — artboard 19a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. quatro números da qualidade
 *   2. aviso de que conversa fora do ERP não é avaliada
 *   3. os oito critérios (lista + detalhe)
 *   4. tabela por critério, com amostra declarada
 *   5. planos de desenvolvimento · o que treinar primeiro
 *   6. rodapé de fontes
 *
 * Abaixo de 8 conversas a nota NÃO é exibida: ausência de amostra nunca vira
 * nota zero.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Criterio = { nome: string; nota: number | null; amostra: number | null; abaixo: number | null; plano: string; det: Detalhe };
type Dados = {
  geral: number | null;
  amostra: number | null;
  maisFraco: number | null;
  avaliadas: string;
  planos: number | null;
  criterios: Criterio[];
  planosAbertos: { l: string; r: string; sub?: string }[];
  treinar: { l: string; r: string; sub?: string }[];
  atualizado: string;
};

const nota = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));

export function QualidadeDesenvolvimento({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Nota geral", bruto: d.geral, texto: nota(d.geral), tile: "roxo", foot: `n=${fmt.inteiro(d.amostra)} conversas avaliadas` },
    { rotulo: "Critério mais fraco", bruto: d.maisFraco, texto: nota(d.maisFraco), tom: "ruim", tile: "vermelho", foot: "contorno de objeção" },
    { rotulo: "Pessoas avaliadas", bruto: d.avaliadas, tile: "verde", foot: "1 sem amostra suficiente" },
    { rotulo: "Planos abertos", bruto: d.planos, texto: fmt.inteiro(d.planos), tom: "atencao", tile: "ambar", foot: "com responsável e prazo" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="A CONVERSA COM O CLIENTE" titulo="O que treinar primeiro" nota={`${recorte.periodo} · amostra declarada em cada critério`} />
      <GradeKpis itens={kpis} colunas={4} />

      <Banner
        tom="aviso"
        forte="Conversa fora do ERP não é avaliada."
        texto="Ligação pelo celular pessoal e conversa presencial ficam fora da amostra. O buraco é declarado aqui em vez de virar nota baixa para quem trabalha fora do sistema."
      />

      <ListaComDetalhe
        eyebrow="OS OITO CRITÉRIOS"
        titulo="Onde a conversa perde força"
        nota="abaixo de 8 conversas avaliadas a nota não é exibida"
        linhas={d.criterios.map((c) => ({
          chave: c.nome,
          nome: c.nome,
          meio: c.amostra === null ? "sem amostra" : `n=${fmt.inteiro(c.amostra)}`,
          fim: nota(c.nota),
          cor: c.nota === null ? "#9A938B" : c.nota >= 4.2 ? "#1FA85A" : c.nota >= 3.9 ? "#B5700A" : "#D93E3E",
          ativa: detalhe?.titulo === c.det.titulo,
          abrir: () => setDetalhe(c.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="CRITÉRIO POR CRITÉRIO" titulo="Nota só quando existe amostra" cor="#8B00CC" nota="clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Critério" }, { titulo: "Nota", num: true }, { titulo: "Amostra", num: true }, { titulo: "Abaixo de 3,5", num: true }, { titulo: "Plano" }]}
        ordenadaEm="Nota"
        linhas={d.criterios.map((c) => ({
          chave: `t-${c.nome}`,
          destaque: c.nota !== null && c.nota < 3.9,
          abrir: () => recorte.filtrar(`Critério: ${c.nome}`),
          celulas: [
            { texto: c.nome, forte: true },
            { texto: nota(c.nota), num: true },
            { texto: c.amostra === null ? "—" : fmt.inteiro(c.amostra), num: true },
            { texto: c.abaixo === null ? "—" : fmt.inteiro(c.abaixo), num: true },
            { texto: c.plano },
          ],
        }))}
        foot="critério sem amostra continua na tabela com “—” · nunca preenchemos nota pela média dos outros"
      />

      <Cabecalho eyebrow="DESENVOLVIMENTO" titulo="Planos abertos e a ordem do treino" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Planos de desenvolvimento", chip: "visível para a própria pessoa", chipTom: "roxo", linhas: d.planosAbertos, foot: "plano sem responsável não entra na lista — apareceria como pendência", link: { rotulo: "Abrir Corretores →", go: () => recorte.irPara("corretores") } },
          { titulo: "O que treinar primeiro", linhas: d.treinar, foot: "um treino atinge o critério mais fraco de quase todo o time" },
        ]}
      />

      <RodapeFontes
        fontes={["avaliações de conversa", "wa_mensagens", "negócios"]}
        pendencias={["conversas fora do ERP não avaliadas", "1 pessoa com amostra abaixo de 8"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  geral: 3.9,
  amostra: 182,
  maisFraco: 3.8,
  avaliadas: "5 de 6",
  planos: 2,
  criterios: [
    { nome: "Clareza", nota: 4.4, amostra: 182, abaixo: 0, plano: "—", det: { titulo: "Clareza", sub: "média 4,4", linhas: [["Melhor", "Ana (4,8)"], ["Pior", "Rafael (3,9)"], ["Amostra", "182"], ["Tendência", "estável"]], aviso: "Avaliação é interna: não depende de consentimento do visitante." } },
    { nome: "Cordialidade", nota: 4.3, amostra: 182, abaixo: 0, plano: "—", det: { titulo: "Cordialidade", sub: "média 4,3", linhas: [["Amostra", "182"], ["Abaixo de 3,5", "0"], ["Tendência", "estável"], ["Plano", "não necessário"]], aviso: "Critério acima da meta: sem plano aberto." } },
    { nome: "Descoberta da necessidade", nota: 4.1, amostra: 182, abaixo: 1, plano: "—", det: { titulo: "Descoberta", sub: "média 4,1", linhas: [["Amostra", "182"], ["Abaixo de 3,5", "1"], ["Efeito", "visita sem fit"], ["Plano", "em análise"]], aviso: "Uma pessoa abaixo do corte não abre plano coletivo." } },
    { nome: "Apresentação do imóvel", nota: 4.0, amostra: 182, abaixo: 1, plano: "—", det: { titulo: "Apresentação", sub: "média 4,0", linhas: [["Amostra", "182"], ["Abaixo de 3,5", "1"], ["Melhor equipe", "Venda"], ["Plano", "não aberto"]], aviso: "Critério na meta — acompanhamento simples." } },
    { nome: "Qualificação de orçamento", nota: 3.9, amostra: 182, abaixo: 3, plano: "aberto · 2 semanas", det: { titulo: "Qualificação", sub: "média 3,9", linhas: [["Pessoas abaixo de 3,5", "3"], ["Plano aberto", "sim"], ["Prazo", "2 semanas"], ["Responsável", "Juliana"]], aviso: "Plano de desenvolvimento é visível para a própria pessoa." } },
    { nome: "Contorno de objeção", nota: 3.8, amostra: 182, abaixo: 2, plano: "aberto · 3 semanas", det: { titulo: "Objeções", sub: "média 3,8", linhas: [["Objeção mais comum", "preço"], ["Pessoas abaixo de 3,5", "2"], ["Plano aberto", "sim"], ["Prazo", "3 semanas"]], aviso: "Conversas fora do ERP não são avaliadas — o buraco é declarado." } },
    { nome: "Fechamento e próximo passo", nota: 3.9, amostra: 182, abaixo: 2, plano: "em análise", det: { titulo: "Fechamento", sub: "média 3,9", linhas: [["Sem próximo passo", "26 negócios"], ["Pessoas abaixo de 3,5", "2"], ["Ligação com disciplina", "direta"], ["Plano", "em análise"]], aviso: "Cruza com follow-up vencido em Atendimento e SLA." } },
    { nome: "Registro no ERP", nota: null, amostra: null, abaixo: null, plano: "sem amostra", det: { titulo: "Registro no ERP", sub: "amostra insuficiente", linhas: [["Conversas avaliadas", "5"], ["Mínimo", "8"], ["Nota", "— não exibida"], ["Próxima avaliação", "semana que vem"]], aviso: "Ausência de amostra nunca vira nota zero." } },
  ],
  planosAbertos: [
    { l: "Qualificação de orçamento", r: "2 semanas", sub: "responsável Juliana · 3 pessoas abaixo de 3,5" },
    { l: "Contorno de objeção", r: "3 semanas", sub: "responsável Marcos · 2 pessoas abaixo de 3,5" },
  ],
  treinar: [
    { l: "1. Objeção de preço", r: "3,8", sub: "preço é o 2º motivo de perda, com 18 casos" },
    { l: "2. Qualificação de orçamento", r: "3,9", sub: "evita visita sem fit" },
    { l: "3. Fechamento e próximo passo", r: "3,9", sub: "26 negócios sem próxima ação registrada" },
  ],
  atualizado: "14:28",
};
