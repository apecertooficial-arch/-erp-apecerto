"use client";

/* AQUISIÇÃO E CAMPANHAS — artboard 3a.
 * Qual canal traz negócio, não só clique. As colunas de custo existem e ficam
 * vazias enquanto Google Ads e Meta Ads não estiverem conectados — nada estimado.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, GradeKpis, Tabela, type Kpi } from "../pecas";

type Linha = {
  origem: string;
  midia: string;
  campanha: string;
  visualizacoes: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  paginaLead: number | null;
  leadNegocio: number | null;
  cpl: number | null;
  naoAtribuido?: boolean;
};

type Dados = { visualizacoes: number | null; intencao: number | null; leads: number | null; negocios: number | null; visitas: number | null; vendas: number | null; linhas: Linha[]; atualizado: string };

export function AquisicaoCampanhas({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: d.visualizacoes, texto: fmt.inteiro(d.visualizacoes), chip: "▲ +12,4%", chipTom: "bom" },
    { rotulo: "Ações de intenção", bruto: d.intencao, texto: fmt.inteiro(d.intencao), chip: "▲ +15,2%", chipTom: "bom" },
    { rotulo: "Leads", bruto: d.leads, texto: fmt.inteiro(d.leads), chip: "▲ +9,5%", chipTom: "bom" },
    { rotulo: "Negócios · visitas · vendas", bruto: d.negocios, texto: `${fmt.inteiro(d.negocios)} · ${fmt.inteiro(d.visitas)} · ${fmt.inteiro(d.vendas)}`, chip: "▲ +6,3% em negócios", chipTom: "bom" },
  ];

  return (
    <div className="int-secao">
      <Banner
        tom="aviso"
        forte="Custos de mídia ainda não conectados."
        texto="Conecte Google Ads e Meta Ads para ver CPL, custo por negócio e ROAS. As colunas existem e ficam com “—” — nenhum número é estimado enquanto isso."
        botao={{ rotulo: "Conectar contas", go: () => recorte.irPara("privacidade") }}
      />

      <Cabecalho eyebrow="O PERÍODO" titulo="Do clique ao negócio" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="ATRIBUIÇÃO" titulo="Primeiro toque, toque atual e o que não dá para atribuir" cor="#8B00CC" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Primeira origem conhecida", linhas: [{ l: "Instagram", r: "96 leads" }, { l: "Google orgânico", r: "74" }, { l: "Meta Ads", r: "52" }], foot: "primeira atribuição persistida após consentimento" },
          { titulo: "Origem atual · último toque", linhas: [{ l: "Direto", r: "88 leads" }, { l: "Instagram", r: "71" }, { l: "Google orgânico", r: "60" }], foot: "atribuição da visita que gerou o lead" },
          { titulo: "Não atribuído — mostrado, nunca escondido", fundo: "tint-roxo", linhas: [{ l: "Visualizações", r: "4.372" }, { l: "Leads", r: "56" }, { l: "Negócios", r: "27" }], foot: "sem UTM 48% · sem consentimento 39% · referência perdida 13%. Nunca redistribuído entre canais." },
        ]}
      />

      <Cabecalho eyebrow="TABELA DETALHADA" titulo="Origem, mídia e campanha, lado a lado" nota="clique numa linha para filtrar a página" />
      <Tabela
        colunas={[{ titulo: "Origem" }, { titulo: "Mídia" }, { titulo: "Campanha" }, { titulo: "Vis.", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Negócios", num: true }, { titulo: "Pág→lead", num: true }, { titulo: "Lead→neg.", num: true }, { titulo: "CPL", num: true }]}
        ordenadaEm="Negócios"
        linhas={d.linhas.map((l) => ({
          chave: `${l.origem}-${l.campanha}`,
          destaque: !!l.naoAtribuido,
          abrir: () => recorte.filtrar(`Origem: ${l.origem}${l.campanha !== "—" ? ` · ${l.campanha}` : ""}`),
          celulas: [
            { texto: l.origem, forte: true, cor: l.naoAtribuido ? "#66009A" : undefined },
            { texto: l.midia },
            { texto: l.campanha },
            { texto: fmt.inteiro(l.visualizacoes), num: true },
            { texto: fmt.inteiro(l.intencao), num: true },
            { texto: fmt.inteiro(l.leads), num: true },
            { texto: fmt.inteiro(l.negocios), num: true, forte: true },
            { texto: fmt.porcento(l.paginaLead, 2), num: true },
            { texto: fmt.porcento(l.leadNegocio, 0), num: true, cor: (l.leadNegocio ?? 0) >= 70 ? "#1E7A46" : undefined },
            { texto: fmt.dinheiro(l.cpl), num: true, cor: "#C9C2BA" },
          ],
        }))}
        foot="CPL e ROAS ficam com “—” até as contas de mídia serem conectadas · linha “não atribuído” nunca é diluida nas outras"
      />

      <RodapeFontes
        fontes={["coleta própria", "UTMs", "CRM Funil 2.0"]}
        pendencias={["Google Ads e Meta Ads não conectados (CPL, custo por negócio, ROAS)", "UTMs ausentes em 3 anúncios"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  visualizacoes: 24_618,
  intencao: 2_310,
  leads: 312,
  negocios: 187,
  visitas: 96,
  vendas: 14,
  linhas: [
    { origem: "Instagram orgânico", midia: "orgânico", campanha: "perfil-bio", visualizacoes: 5_204, intencao: 612, leads: 84, negocios: 52, paginaLead: 1.61, leadNegocio: 62, cpl: null },
    { origem: "Google orgânico", midia: "orgânico", campanha: "—", visualizacoes: 6_120, intencao: 488, leads: 66, negocios: 41, paginaLead: 1.08, leadNegocio: 62, cpl: null },
    { origem: "Direto", midia: "—", campanha: "—", visualizacoes: 3_208, intencao: 342, leads: 44, negocios: 29, paginaLead: 1.37, leadNegocio: 66, cpl: null },
    { origem: "Meta Ads", midia: "pago", campanha: "moema-prontos-ago", visualizacoes: 2_860, intencao: 296, leads: 32, negocios: 23, paginaLead: 1.12, leadNegocio: 72, cpl: null },
    { origem: "Meta Ads", midia: "pago", campanha: "locacao-mobiliado", visualizacoes: 1_526, intencao: 132, leads: 15, negocios: 9, paginaLead: 0.98, leadNegocio: 60, cpl: null },
    { origem: "Não atribuído", midia: "—", campanha: "sem UTM · sem consentimento", visualizacoes: 4_372, intencao: 318, leads: 56, negocios: 27, paginaLead: 1.28, leadNegocio: 48, cpl: null, naoAtribuido: true },
  ],
  atualizado: "14:28",
};
