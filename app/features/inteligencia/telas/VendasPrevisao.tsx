"use client";

/* 15 · VENDAS E PREVISÃO — artboard 19b, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. cobertura da meta em quatro números
 *   2. de onde vem o que falta (lista + detalhe)
 *   3. tabela de propostas em aberto, com o ponderado por linha
 *   4. por equipe · por empreendimento — os dois cortes do artboard
 *   5. rodapé de fontes
 *
 * Negócio sem valor cadastrado fica fora do ponderado e aparece com “—”: previsão
 * nunca é estimada por média.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Dados = {
  assinado: number | null;
  vendas: number | null;
  previsao: number | null;
  faltaMeta: number | null;
  meta: number | null;
  ticket: number | null;
  propostas: { nome: string; etapa: string; valor: number | null; probabilidade: number | null; fechamento: string }[];
  semValor: number | null;
  porEquipe: { l: string; r: string; sub?: string }[];
  porEmpreendimento: { l: string; r: string; sub?: string }[];
  atualizado: string;
};

export function VendasPrevisao({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "VGV assinado", bruto: d.assinado, texto: fmt.dinheiro(d.assinado), tile: "laranja", icone: "dinheiro", foot: `${fmt.inteiro(d.vendas)} vendas e locações` },
    { rotulo: "Previsão ponderada", bruto: d.previsao, texto: fmt.dinheiro(d.previsao), tile: "roxo", foot: "pipeline ponderado pela etapa" },
    { rotulo: "Falta para a meta", bruto: d.faltaMeta, texto: fmt.dinheiro(d.faltaMeta), tom: "ruim", tile: "vermelho", foot: `meta de ${fmt.dinheiro(d.meta)} · cobertura 77%` },
    { rotulo: "Ticket médio", bruto: d.ticket, texto: fmt.dinheiro(d.ticket), tile: "verde", foot: "estável — crescimento veio de volume" },
  ];

  const linhas = [
    {
      chave: "assinado",
      nome: "Assinado",
      meio: "certo",
      fim: fmt.dinheiro(d.assinado),
      cor: "#1FA85A",
      det: { titulo: "Vendas assinadas", sub: `${fmt.inteiro(d.vendas)} no período`, linhas: [["Venda", "13"], ["Locação", "8"], ["Atribuídas ao site", "9"], ["Sem etapa registrada", "3"]] as [string, string][], aviso: "3 vendas entraram já fechadas e ficam fora da taxa de conversão." },
    },
    {
      chave: "proposta",
      nome: "Proposta em aberto",
      meio: "ponderado",
      fim: "R$ 6,2 mi",
      cor: "#FF7000",
      det: { titulo: "Propostas em aberto", sub: "6 negócios", linhas: [["Em negociação", "4"], ["Aguardando documentação", "2"], ["Probabilidade média", "48%"], ["Fechamento estimado", "8,5 dias"]] as [string, string][], aviso: "A previsão sempre carrega a data do pipeline que a gerou." },
    },
    {
      chave: "semvalor",
      nome: "Sem valor no negócio",
      meio: "bloqueia previsão",
      fim: fmt.inteiro(d.semValor),
      cor: "#B5700A",
      det: { titulo: "Negócios sem valor", sub: "campo ausente no CRM", linhas: [["Negócios", fmt.inteiro(d.semValor)], ["Efeito", "fora da previsão"], ["Ação", "preencher no Funil 2.0"], ["Responsável", "Financeiro"]] as [string, string][], aviso: "Comissão e previsão nunca são estimadas por média." },
    },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="COBERTURA DA META" titulo="O que está assinado e o que ainda depende de proposta" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      <ListaComDetalhe
        eyebrow="DE ONDE VEM O QUE FALTA"
        titulo="Assinado, proposta e o que está travado"
        nota="propostas ponderadas pela etapa do funil"
        linhas={linhas.map((l) => ({ chave: l.chave, nome: l.nome, meio: l.meio, fim: l.fim, cor: l.cor, ativa: detalhe?.titulo === l.det.titulo, abrir: () => setDetalhe(l.det) }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="PROPOSTAS EM ABERTO" titulo="Uma linha por negócio, com a probabilidade da etapa" cor="#8B00CC" nota="clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Negócio" }, { titulo: "Etapa" }, { titulo: "Valor", num: true }, { titulo: "Probabilidade", num: true }, { titulo: "Ponderado", num: true }, { titulo: "Fechamento" }]}
        ordenadaEm="Valor"
        linhas={d.propostas.map((p) => ({
          chave: p.nome,
          destaque: p.valor === null,
          abrir: () => recorte.filtrar(`Negócio: ${p.nome}`),
          celulas: [
            { texto: p.nome, forte: true },
            { texto: p.etapa },
            { texto: fmt.dinheiro(p.valor), num: true },
            { texto: fmt.porcento(p.probabilidade, 0), num: true },
            { texto: p.valor !== null && p.probabilidade !== null ? fmt.dinheiro((p.valor * p.probabilidade) / 100) : "—", num: true, forte: true },
            { texto: p.fechamento },
          ],
        }))}
        foot="negócio sem valor cadastrado aparece com “—” e não entra no ponderado — previsão nunca é estimada por média"
      />

      <Cabecalho eyebrow="OS DOIS CORTES" titulo="Por equipe e por empreendimento" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Por equipe", linhas: d.porEquipe.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Equipe: ${x.l}`) })), foot: "meta por equipe ainda não cadastrada — só o total da casa tem meta", link: { rotulo: "Abrir Equipe →", go: () => recorte.irPara("equipe") } },
          { titulo: "Por empreendimento", linhas: d.porEmpreendimento.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Empreendimento: ${x.l}`) })), foot: "clicar filtra a página pelo empreendimento" },
        ]}
      />

      <RodapeFontes
        fontes={["negócios", "propostas", "metas cadastradas", "vendas"]}
        pendencias={["metas por equipe (cadastro pendente)", "2 negócios sem valor no CRM"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  assinado: 18_400_000,
  vendas: 21,
  previsao: 22_100_000,
  faltaMeta: 5_600_000,
  meta: 24_000_000,
  ticket: 876_000,
  semValor: 2,
  propostas: [
    { nome: "Claris · unidade 82", etapa: "Em negociação", valor: 1_180_000, probabilidade: 60, fechamento: "22 ago" },
    { nome: "AP Moema · unidade 42", etapa: "Em negociação", valor: 890_000, probabilidade: 55, fechamento: "25 ago" },
    { nome: "Key Moema · studio 11", etapa: "Aguardando documentação", valor: 640_000, probabilidade: 70, fechamento: "20 ago" },
    { nome: "Composite · unidade 7", etapa: "Em negociação", valor: 1_020_000, probabilidade: 35, fechamento: "29 ago" },
    { nome: "Apê Pavão 88 · locação", etapa: "Aguardando documentação", valor: 62_400, probabilidade: 80, fechamento: "19 ago" },
    { nome: "Apê Sabiá 12", etapa: "Em negociação", valor: null, probabilidade: 40, fechamento: "—" },
  ],
  porEquipe: [
    { l: "Venda · Juliana Prado", r: "R$ 11,2 mi", sub: "13 vendas · 4 propostas em aberto" },
    { l: "Locação · Marcos Vilela", r: "R$ 7,2 mi", sub: "8 locações · 2 propostas em aberto" },
    { l: "Meta por equipe", r: "—", sub: "cadastro pendente" },
  ],
  porEmpreendimento: [
    { l: "Claris", r: "R$ 4,8 mi", sub: "4 vendas" },
    { l: "AP Moema", r: "R$ 3,9 mi", sub: "3 vendas" },
    { l: "Key Moema", r: "R$ 2,6 mi", sub: "4 vendas" },
    { l: "Avulsos e locação", r: "R$ 7,1 mi", sub: "10 contratos" },
  ],
  atualizado: "14:28",
};
