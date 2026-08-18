"use client";

/* VENDAS E PREVISÃO — artboard 19b.
 * Pergunta da tela: vamos fechar a meta, e com o que já está assinado ou com o
 * que ainda depende de proposta.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Dados = {
  assinado: number | null;
  vendas: number | null;
  previsao: number | null;
  faltaMeta: number | null;
  meta: number | null;
  ticket: number | null;
  propostas: { nome: string; etapa: string; valor: number | null; probabilidade: number | null }[];
  semValor: number | null;
  atualizado: string;
};

export function VendasPrevisao({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "VGV assinado", bruto: d.assinado, texto: fmt.dinheiro(d.assinado), tile: "laranja", foot: `${fmt.inteiro(d.vendas)} vendas e locações` },
    { rotulo: "Previsão ponderada", bruto: d.previsao, texto: fmt.dinheiro(d.previsao), tile: "roxo", foot: "pipeline ponderado pela etapa" },
    { rotulo: "Falta para a meta", bruto: d.faltaMeta, texto: fmt.dinheiro(d.faltaMeta), tom: "ruim", tile: "vermelho", foot: `meta de ${fmt.dinheiro(d.meta)}` },
    { rotulo: "Ticket médio", bruto: d.ticket, texto: fmt.dinheiro(d.ticket), tile: "verde", foot: d.vendas === null ? "aguardando conexão" : `com ${fmt.inteiro(d.vendas)} vendas` },
  ];

  const linhas = [
    {
      chave: "assinado",
      nome: "Assinado",
      meio: "certo",
      fim: fmt.dinheiro(d.assinado),
      cor: "#1FA85A",
      abrir: () => setDetalhe({ titulo: "Vendas assinadas", sub: `${fmt.inteiro(d.vendas)} no período`, linhas: [["Venda", "13"], ["Locação", "8"], ["Atribuídas ao site", "9"], ["Sem etapa registrada", "3"]], aviso: "3 vendas entraram já fechadas e ficam fora da taxa de conversão." }),
    },
    {
      chave: "proposta",
      nome: "Proposta em aberto",
      meio: "ponderado",
      fim: "R$ 6,2 mi",
      cor: "#FF7000",
      abrir: () => setDetalhe({ titulo: "Propostas em aberto", sub: "6 negócios", linhas: [["Em negociação", "4"], ["Aguardando documentação", "2"], ["Probabilidade média", "48%"], ["Fechamento estimado", "8,5 dias"]], aviso: "A previsão sempre carrega a data do pipeline que a gerou." }),
    },
    {
      chave: "semvalor",
      nome: "Sem valor no negócio",
      meio: "bloqueia previsão",
      fim: fmt.inteiro(d.semValor),
      cor: "#B5700A",
      abrir: () => setDetalhe({ titulo: "Negócios sem valor", sub: "campo ausente no CRM", linhas: [["Negócios", fmt.inteiro(d.semValor)], ["Efeito", "fora da previsão"], ["Ação", "preencher no Funil 2.0"], ["Responsável", "Financeiro"]], aviso: "Comissão e previsão nunca são estimadas por média." }),
    },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="COBERTURA DA META" titulo="O que está assinado e o que ainda depende de proposta" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <ListaComDetalhe
        eyebrow="DE ONDE VEM O QUE FALTA"
        titulo="Assinado, proposta e o que está travado"
        nota="propostas ponderadas pela etapa do funil"
        linhas={linhas}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="PROPOSTAS EM ABERTO" titulo="Uma linha por negócio, com a probabilidade da etapa" cor="#8B00CC" />
      <Tabela
        colunas={[{ titulo: "Negócio" }, { titulo: "Etapa" }, { titulo: "Valor", num: true }, { titulo: "Probabilidade", num: true }, { titulo: "Ponderado", num: true }]}
        ordenadaEm="Valor"
        linhas={d.propostas.map((p) => ({
          chave: p.nome,
          abrir: () => recorte.filtrar(`Negócio: ${p.nome}`),
          celulas: [
            { texto: p.nome, forte: true },
            { texto: p.etapa },
            { texto: fmt.dinheiro(p.valor), num: true },
            { texto: fmt.porcento(p.probabilidade, 0), num: true },
            { texto: p.valor !== null && p.probabilidade !== null ? fmt.dinheiro((p.valor * p.probabilidade) / 100) : "—", num: true, forte: true },
          ],
        }))}
        foot="negócio sem valor cadastrado aparece com “—” e não entra no ponderado"
      />

      <RodapeFontes
        fontes={["negócios", "propostas", "metas", "vendas"]}
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
    { nome: "Claris · unidade 82", etapa: "Em negociação", valor: 1_180_000, probabilidade: 60 },
    { nome: "AP Moema · unidade 42", etapa: "Em negociação", valor: 890_000, probabilidade: 55 },
    { nome: "Key Moema · studio 11", etapa: "Aguardando documentação", valor: 640_000, probabilidade: 70 },
    { nome: "Composite · unidade 7", etapa: "Em negociação", valor: 1_020_000, probabilidade: 35 },
    { nome: "Apê Pavão 88 · locação", etapa: "Aguardando documentação", valor: 62_400, probabilidade: 80 },
    { nome: "Apê Sabiá 12", etapa: "Em negociação", valor: null, probabilidade: 40 },
  ],
  atualizado: "14:28",
};
