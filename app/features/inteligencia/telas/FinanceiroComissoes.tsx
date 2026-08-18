"use client";

/* 16 · FINANCEIRO E COMISSÕES — artboard 20a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. cinco números do período
 *   2. banner das vendas travadas por percentual ausente
 *   3. a cascata (lista + detalhe): VGV → receita → comissões → contribuição
 *   4. tabela por participante
 *   5. a receber · o que trava o fechamento
 *   6. rodapé de fontes
 *
 * Nunca lucro líquido: sem custos fixos integrados, a cascata para na
 * contribuição — por decisão de projeto.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Dados = {
  vgv: number | null;
  receita: number | null;
  comissoes: number | null;
  contribuicao: number | null;
  pagas: number | null;
  pendentes: number | null;
  semPercentual: number | null;
  custosFixos: number | null;
  participantes: { nome: string; equipe: string; calculada: number | null; paga: number | null; pendente: number | null; travada: boolean }[];
  aReceber: { l: string; r: string; sub?: string }[];
  trava: { l: string; r: string; sub?: string }[];
  atualizado: string;
};

export function FinanceiroComissoes({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "VGV assinado", bruto: d.vgv, texto: fmt.dinheiro(d.vgv), tile: "laranja", icone: "dinheiro", foot: "não é receita" },
    { rotulo: "Receita reconhecida", bruto: d.receita, texto: fmt.dinheiro(d.receita), tile: "verde", foot: "repasses do período · 4,4% do VGV" },
    { rotulo: "Comissões", bruto: d.comissoes, texto: fmt.dinheiro(d.comissoes), tile: "roxo", foot: `60% da receita · ${d.participantes.length} participantes` },
    { rotulo: "Contribuição estimada", bruto: d.contribuicao, texto: fmt.dinheiro(d.contribuicao), tile: "ambar", foot: "antes dos custos fixos — não é lucro" },
    { rotulo: "Custos fixos", bruto: d.custosFixos, texto: fmt.dinheiro(d.custosFixos), tom: "ruim", tile: "vermelho", chip: "não integrado", chipTom: "aviso", motivo: "integracao", detalhe: "custos fixos não integrados", foot: "a cascata para na contribuição" },
  ];

  const cascata = [
    { chave: "vgv", nome: "VGV assinado", meio: "100%", fim: fmt.dinheiro(d.vgv), cor: "#FF7000", det: { titulo: "VGV assinado", sub: "21 contratos", linhas: [["Venda", "R$ 15,1 mi"], ["Locação (12 meses)", "R$ 3,3 mi"], ["Maior contrato", "R$ 1,18 mi"], ["Atribuído ao site", "R$ 7,9 mi"]] as [string, string][], aviso: "Atribuição ao digital é parcial; o total da empresa é completo." } },
    { chave: "receita", nome: "Receita reconhecida", meio: "4,4% do VGV", fim: fmt.dinheiro(d.receita), cor: "#FF9A4D", det: { titulo: "Receita", sub: "o que entrou no caixa", linhas: [["Comissão de venda", "R$ 604,0 mil"], ["Taxa de locação", "R$ 208,0 mil"], ["A receber", "R$ 291,0 mil"], ["Repasse sem data", "1"]] as [string, string][], aviso: "Repasse sem data não entra em nenhum mês até ser corrigido." } },
    { chave: "comissoes", nome: "− Comissões da equipe", meio: "60% da receita", fim: fmt.dinheiro(d.comissoes), cor: "#B24DDD", det: { titulo: "Comissões", sub: `${d.participantes.length} participantes`, linhas: [["Calculadas", fmt.dinheiro(d.comissoes)], ["Pagas", fmt.dinheiro(d.pagas)], ["Pendentes", fmt.dinheiro(d.pendentes)], ["Sem % definido", `${fmt.inteiro(d.semPercentual)} vendas`]] as [string, string][], aviso: "Comissão individual só para CEO, diretoria e Financeiro." } },
    { chave: "contribuicao", nome: "Contribuição estimada", meio: "antes dos fixos", fim: fmt.dinheiro(d.contribuicao), cor: "#8B00CC", det: { titulo: "Contribuição estimada", sub: "não é lucro líquido", linhas: [["Receita", fmt.dinheiro(d.receita)], ["− Comissões", fmt.dinheiro(d.comissoes)], ["= Contribuição", fmt.dinheiro(d.contribuicao)], ["Custos fixos", "— não integrados"]] as [string, string][], aviso: "Sem custos fixos integrados, a cascata para aqui — por decisão de projeto." } },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="O PERÍODO EM CINCO NÚMEROS" titulo="Do assinado ao que sobra" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={5} />

      {d.semPercentual !== null && d.semPercentual > 0 ? (
        <Banner
          tom="aviso"
          forte={`${fmt.inteiro(d.semPercentual)} vendas sem percentual de comissão.`}
          texto="O cálculo fica suspenso nelas, envolvendo R$ 1,9 mi: comissão nunca é estimada por média. Preencher o percentual no Funil 2.0 libera o valor sozinho."
          botao={{ rotulo: "Ver as vendas travadas", go: () => recorte.filtrar("Comissão: sem percentual") }}
        />
      ) : null}

      <ListaComDetalhe
        eyebrow="A CASCATA"
        titulo="Cada degrau abre a composição"
        nota="VGV não é receita, e contribuição não é lucro"
        linhas={cascata.map((c) => ({ chave: c.chave, nome: c.nome, meio: c.meio, fim: c.fim, cor: c.cor, ativa: detalhe?.titulo === c.det.titulo, abrir: () => setDetalhe(c.det) }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="COMISSÃO POR PARTICIPANTE" titulo="Quem tem valor calculado, pago e pendente" cor="#8B00CC" nota="visível para CEO, diretoria e Financeiro" />
      <Tabela
        colunas={[{ titulo: "Pessoa" }, { titulo: "Equipe" }, { titulo: "Calculada", num: true }, { titulo: "Paga", num: true }, { titulo: "Pendente", num: true }, { titulo: "Situação" }]}
        ordenadaEm="Pendente"
        linhas={d.participantes.map((p) => ({
          chave: p.nome,
          destaque: p.travada,
          abrir: () => recorte.filtrar(`Pessoa: ${p.nome}`),
          celulas: [
            { texto: p.nome, forte: true },
            { texto: p.equipe },
            { texto: fmt.dinheiro(p.calculada), num: true },
            { texto: fmt.dinheiro(p.paga), num: true },
            { texto: fmt.dinheiro(p.pendente), num: true, forte: true },
            p.travada ? { texto: "", chip: "travada por % ausente", chipTom: "aviso" as const } : { texto: "", chip: "em fechamento", chipTom: "neutro" as const },
          ],
        }))}
        foot="pessoa sem percentual definido aparece com “—” na calculada, com o motivo ao lado"
      />

      <Cabecalho eyebrow="FECHAMENTO DO MÊS" titulo="O que ainda entra e o que está travando" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "A receber", linhas: d.aReceber, foot: "repasse sem data não entra em nenhum mês até ser corrigido" },
          { titulo: "O que trava o fechamento", chip: "ação do Financeiro", chipTom: "aviso", linhas: d.trava, foot: "nada aqui é estimado — o valor aparece quando o cadastro estiver completo", link: { rotulo: "Abrir Central de alertas →", go: () => recorte.irPara("alertas") } },
        ]}
      />

      <RodapeFontes
        fontes={["contratos", "repasses", "comissões", "vendas"]}
        pendencias={["custos fixos não integrados", "1 repasse sem data", `${fmt.inteiro(d.semPercentual)} vendas sem percentual`]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  vgv: 18_400_000,
  receita: 812_000,
  comissoes: 488_000,
  contribuicao: 324_000,
  pagas: 361_000,
  pendentes: 127_000,
  semPercentual: 2,
  custosFixos: null,
  participantes: [
    { nome: "Ana Beatriz", equipe: "Venda", calculada: 128_000, paga: 96_000, pendente: 32_000, travada: false },
    { nome: "Carlos Mendes", equipe: "Locação", calculada: 74_000, paga: 44_000, pendente: 30_000, travada: false },
    { nome: "Juliana Prado", equipe: "Venda · gerente", calculada: 96_000, paga: 78_000, pendente: 18_000, travada: false },
    { nome: "Fernanda Lima", equipe: "Venda", calculada: 62_000, paga: 46_000, pendente: 16_000, travada: false },
    { nome: "Rafael Souza", equipe: "Locação", calculada: null, paga: null, pendente: null, travada: true },
    { nome: "Marcos Vilela", equipe: "Locação · gerente", calculada: 128_000, paga: 97_000, pendente: 31_000, travada: false },
  ],
  aReceber: [
    { l: "Repasses previstos no mês", r: "R$ 291,0 mil", sub: "6 contratos" },
    { l: "Repasse sem data", r: "1", sub: "fora de qualquer mês até ser datado" },
    { l: "Taxa de locação recorrente", r: "R$ 208,0 mil", sub: "8 contratos ativos" },
  ],
  trava: [
    { l: "2 vendas sem percentual de comissão", r: "R$ 1,9 mi", sub: "cálculo suspenso · dono Financeiro" },
    { l: "1 repasse sem data", r: "—", sub: "não entra em nenhum mês" },
    { l: "Comissões calculadas a pagar", r: "R$ 127,0 mil", sub: "8 participantes aguardando" },
  ],
  atualizado: "14:28",
};
