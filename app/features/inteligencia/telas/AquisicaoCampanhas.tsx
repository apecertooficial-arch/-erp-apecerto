"use client";

/* 2 · AQUISIÇÃO E CAMPANHAS — artboard 3a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. banner de custo não conectado (com o botão de conectar contas)
 *   2. indicadores do período (4 KPIs)
 *   3. evolução por canal, com as séries clicáveis
 *   4. atribuição: primeiro toque · toque atual · não atribuído
 *   5. tabela detalhada por origem / mídia / campanha
 *   6. rodapé de fontes
 *
 * A linha “não atribuído” aparece SEMPRE e nunca é redistribuída entre canais.
 * CPL e ROAS existem como coluna e ficam com “—” até as contas de mídia entrarem.
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

type Dados = {
  visualizacoes: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  visitas: number | null;
  vendas: number | null;
  linhas: Linha[];
  series: { rotulo: string; cor: string; chip: string }[];
  atualizado: string;
};

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
      {/* 1 · BANNER DE CUSTO */}
      <Banner
        tom="aviso"
        forte="Custos de mídia ainda não conectados."
        texto="Conecte Google Ads e Meta Ads para visualizar CPL, custo por negócio e ROAS. As colunas existem e ficam com “—” — nenhum número é estimado enquanto isso."
        botao={{ rotulo: "Conectar contas", go: () => recorte.irPara("privacidade") }}
      />

      {/* 2 · INDICADORES */}
      <Cabecalho eyebrow="O PERÍODO" titulo="Do clique ao negócio" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      {/* 3 · EVOLUÇÃO POR CANAL */}
      <Cabecalho eyebrow="EVOLUÇÃO POR CANAL" titulo="Leads por origem ao longo do período" cor="#8B00CC" nota="pontilhado = período anterior" />
      <div className="intp-cartao">
        <svg width="100%" height="190" viewBox="0 0 560 190" preserveAspectRatio="none" role="img" aria-label="Leads por origem ao longo do período">
          <line x1="0" y1="47" x2="560" y2="47" stroke="#F2EFEC" strokeWidth="1" />
          <line x1="0" y1="95" x2="560" y2="95" stroke="#F2EFEC" strokeWidth="1" />
          <line x1="0" y1="142" x2="560" y2="142" stroke="#F2EFEC" strokeWidth="1" />
          <polyline points="0,132 51,120 102,126 153,104 204,112 255,88 306,98 357,74 408,84 459,60 510,72 560,50" fill="none" stroke="#C9C2BA" strokeWidth="1.5" strokeDasharray="4 4" />
          <polyline points="0,120 51,108 102,114 153,90 204,100 255,74 306,86 357,60 408,70 459,46 510,58 560,36" fill="none" stroke="#FF7000" strokeWidth="2.5" />
          <polyline points="0,148 51,142 102,146 153,132 204,138 255,124 306,132 357,116 408,124 459,110 510,118 560,104" fill="none" stroke="#8B00CC" strokeWidth="2.5" />
          <polyline points="0,164 51,160 102,162 153,152 204,158 255,146 306,152 357,140 408,146 459,134 510,140 560,128" fill="none" stroke="#B24DDD" strokeWidth="2" />
          <polyline points="0,178 51,175 102,177 153,170 204,173 255,166 306,170 357,163 408,167 459,159 510,163 560,156" fill="none" stroke="#4D4842" strokeWidth="2" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {d.series.map((s) => (
            <button key={s.rotulo} type="button" className="int-chip-filtro" onClick={() => recorte.filtrar(s.chip)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.cor, flex: "none" }} />
              {s.rotulo}
            </button>
          ))}
        </div>
        <small className="intp-kpi-foot">clicar em uma série aplica o filtro de origem à página inteira</small>
      </div>

      {/* 4 · ATRIBUIÇÃO */}
      <Cabecalho eyebrow="ATRIBUIÇÃO" titulo="Primeiro toque vs. toque atual" cor="#8B00CC" />
      <CartoesLista
        colunas={3}
        cartoes={[
          {
            titulo: "Primeira origem conhecida",
            linhas: [
              { l: "Instagram", r: "96 leads", abrir: () => recorte.filtrar("Primeiro toque: Instagram") },
              { l: "Google orgânico", r: "74", abrir: () => recorte.filtrar("Primeiro toque: Google orgânico") },
              { l: "Meta Ads", r: "52", abrir: () => recorte.filtrar("Primeiro toque: Meta Ads") },
            ],
            foot: "primeira atribuição persistida após consentimento",
          },
          {
            titulo: "Origem atual · último toque",
            linhas: [
              { l: "Direto", r: "88 leads", abrir: () => recorte.filtrar("Último toque: Direto") },
              { l: "Instagram", r: "71", abrir: () => recorte.filtrar("Último toque: Instagram") },
              { l: "Google orgânico", r: "60", abrir: () => recorte.filtrar("Último toque: Google orgânico") },
            ],
            foot: "atribuição da visita que gerou o lead",
          },
          {
            titulo: "Não atribuído — mostrado, nunca escondido",
            fundo: "tint-roxo",
            linhas: [
              { l: "Visualizações", r: "4.372" },
              { l: "Leads", r: "56" },
              { l: "Negócios", r: "27" },
            ],
            foot: "motivos: sem UTM 48% · sem consentimento 39% · referência perdida 13%. Nunca redistribuído entre canais.",
          },
        ]}
      />

      {/* 5 · TABELA DETALHADA */}
      <Cabecalho eyebrow="TABELA DETALHADA" titulo="Origem, mídia e campanha, lado a lado" nota="clique na linha para filtrar · clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Origem" }, { titulo: "Mídia" }, { titulo: "Campanha" }, { titulo: "Vis.", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Negócios", num: true }, { titulo: "Pág→lead", num: true }, { titulo: "Lead→neg.", num: true }, { titulo: "CPL · ROAS", num: true }]}
        ordenadaEm="Negócios"
        linhas={d.linhas.map((l) => ({
          chave: `${l.origem}-${l.campanha}`,
          destaque: !!l.naoAtribuido,
          abrir: () => recorte.filtrar(`Origem: ${l.origem}${l.campanha !== "—" ? ` · ${l.campanha}` : ""}`),
          celulas: [
            { texto: l.origem, forte: true, cor: l.naoAtribuido ? "#66009A" : undefined },
            { texto: l.midia },
            { texto: l.campanha, forte: l.midia === "pago" },
            { texto: fmt.inteiro(l.visualizacoes), num: true },
            { texto: fmt.inteiro(l.intencao), num: true },
            { texto: fmt.inteiro(l.leads), num: true },
            { texto: fmt.inteiro(l.negocios), num: true, forte: true },
            { texto: fmt.porcento(l.paginaLead, 2), num: true },
            { texto: fmt.porcento(l.leadNegocio, 0), num: true, cor: (l.leadNegocio ?? 0) >= 70 ? "#1E7A46" : undefined },
            { texto: l.cpl === null ? (l.midia === "pago" ? "não conectado" : "—") : fmt.dinheiro(l.cpl), num: true, cor: "#C9C2BA" },
          ],
        }))}
        foot="mostrando 6 de 24 linhas · CPL e ROAS ficam com “—” até as contas de mídia serem conectadas"
        acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todas →</button>}
      />

      {/* 6 · RODAPÉ */}
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
  series: [
    { rotulo: "Instagram", cor: "#FF7000", chip: "Origem: Instagram orgânico" },
    { rotulo: "Google orgânico", cor: "#8B00CC", chip: "Origem: Google orgânico" },
    { rotulo: "Meta Ads", cor: "#B24DDD", chip: "Origem: Meta Ads" },
    { rotulo: "Direto", cor: "#4D4842", chip: "Origem: Direto" },
  ],
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
