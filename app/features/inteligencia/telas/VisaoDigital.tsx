"use client";

/* 1 · VISÃO DO DIGITAL — artboard 2a. Agora lê a telemetria real do site via
 * /api/inteligencia/digital (RPC intel_visao_digital). É uma tela CROSS-SOURCE:
 * a metade de site é real; os KPIs de negócio (negócios, visitas, vendas,
 * conversão lead→negócio, pipeline, GA4) dependem do CRM/GA4 e seguem — com
 * motivo até serem ligados. Demo virou fixture. */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, Funil, GradeKpis, IconeInt, type Etapa, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { VisaoDigitalPayload } from "../../../lib/inteligencia/tipos";

type Dados = {
  visualizacoes: number | null;
  engajadas: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  visitas: number | null;
  fechamentos: number | null;
  conversaoPagina: number | null;
  conversaoLead: number | null;
  tempoAtendimento: number | null;
  pipelineAtribuido: number | null;
  sessoesGa4: string | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  series: { rotulo: string; cor: string; chip: string }[];
  origens: { l: string; r: string; largura: number; cor: string }[];
  campanhas: { l: string; r: string }[];
  paginas: { l: string; r: string }[];
  fracas: { l: string; r: string; sub: string }[];
  tracking: { l: string; r: string; cor: string }[];
  atualizado: string;
};

export function VisaoDigital({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<VisaoDigitalPayload>("digital", accessToken, recorte);
  const d = mapearVisaoDigital(leitura.payload);

  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: d.visualizacoes, texto: fmt.inteiro(d.visualizacoes), tile: "laranja" },
    { rotulo: "Páginas com engajamento", bruto: d.engajadas, texto: fmt.inteiro(d.engajadas), motivo: "fonte", detalhe: "engajamento depende do GA4" },
    { rotulo: "Cliques de intenção", bruto: d.intencao, texto: fmt.inteiro(d.intencao), foot: "WhatsApp, telefone, formulário e CTAs do site" },
    { rotulo: "Leads do site", bruto: d.leads, texto: fmt.inteiro(d.leads) },
    { rotulo: "Negócios no Funil 2.0", bruto: d.negocios, texto: fmt.inteiro(d.negocios), motivo: "integracao", detalhe: "atribuição site→CRM ainda não ligada" },
    { rotulo: "Visitas agendadas", bruto: d.visitas, texto: fmt.inteiro(d.visitas), motivo: "integracao", detalhe: "vem do CRM, ainda não ligado à Inteligência" },
    { rotulo: "Vendas e locações", bruto: d.fechamentos, texto: fmt.inteiro(d.fechamentos), motivo: "integracao", detalhe: "atribuição site→venda ainda não ligada" },
    { rotulo: "Conversão página → lead", bruto: d.conversaoPagina, texto: fmt.porcento(d.conversaoPagina, 2) },
    { rotulo: "Conversão lead → negócio", bruto: d.conversaoLead, texto: fmt.porcento(d.conversaoLead), motivo: "integracao", detalhe: "precisa do vínculo lead do site ↔ negócio" },
    { rotulo: "Tempo até 1º atendimento", bruto: d.tempoAtendimento, texto: fmt.duracaoMin(d.tempoAtendimento), motivo: "integracao", detalhe: "medido em Atendimento e SLA", foot: "mediana · meta 5 min" },
    { rotulo: "Pipeline atribuído ao site", bruto: d.pipelineAtribuido, texto: fmt.dinheiro(d.pipelineAtribuido), tile: "ambar", icone: "dinheiro", motivo: "integracao", detalhe: "valor do negócio ausente no Funil 2.0", foot: "nunca estimado por média" },
    { rotulo: "Sessões e usuários · GA4", bruto: d.sessoesGa4, motivo: "integracao", detalhe: "GA4 não conectado (GA4_PROPERTY_ID)" },
  ];

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    detalhes: () => recorte.filtrar(`Etapa do site: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <GradeKpis itens={kpis} colunas={6} />

      {/* EVOLUÇÃO + FUNIL, lado a lado */}
      <div className="int-duas">
        <div className="int-col">
          <Cabecalho eyebrow="EVOLUÇÃO" titulo="Como o período se moveu" cor="#8B00CC" nota="tendência ilustrativa — série temporal por dia entra no próximo lote" />
          <div className="intp-cartao">
            <svg width="100%" height="196" viewBox="0 0 560 196" preserveAspectRatio="none" role="img" aria-label="Evolução do período (ilustrativa)">
              <line x1="0" y1="49" x2="560" y2="49" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="98" x2="560" y2="98" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="147" x2="560" y2="147" stroke="#F2EFEC" strokeWidth="1" />
              <polyline points="0,124 51,110 102,118 153,92 204,102 255,74 306,86 357,58 408,70 459,44 510,58 560,32" fill="none" stroke="#C9C2BA" strokeWidth="1.5" strokeDasharray="4 4" />
              <polyline points="0,114 51,100 102,108 153,82 204,94 255,64 306,78 357,50 408,62 459,36 510,50 560,26" fill="none" stroke="#FF7000" strokeWidth="2.5" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {d.series.map((s) => (
                <button key={s.rotulo} type="button" className="int-chip-filtro" onClick={() => recorte.filtrar(s.chip)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.cor, flex: "none" }} />
                  {s.rotulo}
                </button>
              ))}
            </div>
            <small className="intp-kpi-foot">a linha é ilustrativa; os números dos cartões acima são reais</small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="FUNIL DO SITE" titulo="Do acesso à ação de intenção" cor="#8B00CC" />
          <Funil etapas={etapas} foot="funil do site (telemetria) · do negócio em diante é o Funil 2.0, ainda não atribuído ao site" />
        </div>
      </div>

      {/* LEITURAS RÁPIDAS — quatro cartões */}
      <Cabecalho eyebrow="LEITURAS RÁPIDAS" titulo="O que está puxando o acesso" />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Origens que mais trazem acesso</span>
          {d.origens.map((o) => (
            <button key={o.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Origem: ${o.l}`)}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 84px 26px", gap: 8, alignItems: "center", fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "#4D4842" }}>{o.l}</span>
                <span className="intp-casc-trilha" style={{ height: 8 }}>
                  <span className="intp-casc-barra" style={{ height: 8, width: `${o.largura}%`, background: o.cor }} />
                </span>
                <b style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.r}</b>
              </div>
            </button>
          ))}
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("aquisicao")}>Abrir Aquisição →</button>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Campanhas com melhor conversão</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {d.campanhas.map((c) => (
              <div key={c.l} className="intp-linha-kv">
                <span>{c.l}</span>
                <b>{c.r}</b>
              </div>
            ))}
          </div>
          <small className="intp-kpi-foot">precisa de UTM nas campanhas — cobertura hoje é baixa</small>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("aquisicao")}>Abrir Aquisição →</button>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Páginas mais acessadas</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {d.paginas.map((p) => (
              <div key={p.l} className="intp-linha-kv">
                <span>{p.l}</span>
                <b>{p.r}</b>
              </div>
            ))}
          </div>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("imoveis")}>Abrir Imóveis →</button>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Muito acesso, pouca conversão</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {d.fracas.map((f) => (
              <div key={f.l}>
                <div className="intp-linha-kv">
                  <span>{f.l}</span>
                  <b>{f.r}</b>
                </div>
                <small className="intp-linha-sub">{f.sub}</small>
              </div>
            ))}
          </div>
          <small className="intp-kpi-foot">precisa de conversão por página (vínculo com o CRM)</small>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("comportamento")}>Abrir Comportamento →</button>
        </div>
      </div>

      {/* FAIXA FINAL — captação · Sara · saúde do tracking */}
      <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="intp-cartao">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="intp-tile tile-laranja"><IconeInt nome="casa" tamanho={15} /></span>
            <span className="intp-cartao-titulo">Captação de proprietários</span>
          </div>
          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>—</strong><br /><small className="intp-kpi-foot">captações</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>—</strong><br /><small className="intp-kpi-foot">contatados</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>—</strong><br /><small className="intp-kpi-foot">publicados</small></div>
          </div>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("proprietarios")}>Abrir Proprietários →</button>
        </div>

        <div className="intp-cartao" style={{ background: "#8B00CC", color: "#fff", boxShadow: "0 12px 28px rgba(139,0,204,0.24)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="intp-tile" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}><IconeInt nome="faisca" tamanho={15} /></span>
            <span className="intp-cartao-titulo" style={{ color: "#fff" }}>Sara · assistente de imóveis</span>
          </div>
          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>—</strong><br /><small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>buscas</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>—</strong><br /><small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>leads</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>—</strong><br /><small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>sem resultado</small></div>
          </div>
          <button type="button" className="int-link" style={{ fontWeight: 700, color: "#fff", marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("sara")}>Abrir Sara →</button>
        </div>

        <div className="intp-cartao">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="intp-tile tile-verde"><IconeInt nome="check" tamanho={15} /></span>
            <span className="intp-cartao-titulo">Saúde do tracking</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {d.tracking.map((t) => (
              <div key={t.l} style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center" }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: t.cor, flex: "none" }} />
                <span style={{ flex: 1, color: "#4D4842", fontWeight: 600 }}>{t.l}</span>
                <b style={{ color: t.cor === "#D93E3E" || t.cor === "#B5700A" ? t.cor : "#6E6760", fontWeight: 600 }}>{t.r}</b>
              </div>
            ))}
          </div>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("privacidade")}>Abrir Privacidade e tracking →</button>
        </div>
      </div>

      <RodapeFontes
        fontes={["coleta própria (site-track)"]}
        pendencias={["GA4 não conectado", "atribuição site→CRM (leads do site ≈ 0)", "custo de mídia não conectado"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO — lê a RPC via hook. */
function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function minutosDesde(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 60_000));
}

const CORES_ORIGEM = ["#FF7000", "#FF9A4D", "#FFB570", "#C9C2BA", "#EFECE7"];
const SERIES: Dados["series"] = [
  { rotulo: "Visualizações", cor: "#FF7000", chip: "Série: Visualizações" },
  { rotulo: "Intenção", cor: "#8B00CC", chip: "Série: Intenção" },
];

const vazioVisaoDigital: Dados = {
  visualizacoes: null, engajadas: null, intencao: null, leads: null, negocios: null, visitas: null, fechamentos: null,
  conversaoPagina: null, conversaoLead: null, tempoAtendimento: null, pipelineAtribuido: null, sessoesGa4: null,
  etapas: [], series: SERIES, origens: [], campanhas: [{ l: "sem campanha com UTM no período", r: "—" }],
  paginas: [], fracas: [{ l: "aguardando conexão", r: "—", sub: "" }],
  tracking: [
    { l: "Coleta própria", r: "aguardando", cor: "#B5700A" },
    { l: "GA4", r: "não conectado", cor: "#B5700A" },
    { l: "Microsoft Clarity", r: "não conectado", cor: "#B5700A" },
    { l: "Cobertura de UTMs", r: "—", cor: "#6E6760" },
  ],
  atualizado: "—",
};

function mapearVisaoDigital(p: VisaoDigitalPayload | null): Dados {
  if (!p) return vazioVisaoDigital;
  const pv = p.total_pageviews;
  const maxOrig = Math.max(1, ...p.origens.map((o) => o.pageviews));
  const min = minutosDesde(p.ultimo_evento_em);
  const coletaBoa = min !== null && min <= 30;

  return {
    visualizacoes: pv,
    engajadas: null,
    intencao: p.intencao,
    leads: p.leads_site,
    negocios: null,
    visitas: null,
    fechamentos: null,
    conversaoPagina: pv > 0 ? (100 * p.leads_site) / pv : null,
    conversaoLead: null,
    tempoAtendimento: null,
    pipelineAtribuido: null,
    sessoesGa4: null,
    etapas: [
      { nome: "1 · Página acessada", volume: pv, largura: 100, taxa: "100%" },
      { nome: "2 · Imóvel visualizado", volume: p.visualizacoes_item, largura: pv > 0 ? Math.round((100 * p.visualizacoes_item) / pv) : 0, taxa: pv > 0 ? `${((100 * p.visualizacoes_item) / pv).toFixed(1).replace(".", ",")}%` : undefined },
      { nome: "3 · Ação de intenção", volume: p.intencao, largura: pv > 0 ? Math.round((100 * p.intencao) / pv) : 0 },
      { nome: "4 · Lead do site", volume: p.leads_site, largura: pv > 0 ? Math.round((100 * p.leads_site) / pv) : 0 },
    ],
    series: SERIES,
    origens: p.origens.slice(0, 5).map((o, i) => ({ l: o.origem, r: fmt.inteiro(o.pageviews), largura: Math.round((100 * o.pageviews) / maxOrig), cor: CORES_ORIGEM[i] ?? "#EFECE7" })),
    campanhas: [{ l: "sem campanha com UTM no período", r: "—" }],
    paginas: p.paginas.slice(0, 4).map((pg) => ({ l: pg.pagina, r: fmt.inteiro(pg.pageviews) })),
    fracas: [{ l: "conversão por página", r: "—", sub: "precisa do vínculo com o CRM" }],
    tracking: [
      { l: "Coleta própria", r: min === null ? "sem eventos" : `há ${min} min`, cor: coletaBoa ? "#1FA85A" : "#B5700A" },
      { l: "GA4", r: "não conectado", cor: "#B5700A" },
      { l: "Microsoft Clarity", r: "não conectado", cor: "#B5700A" },
      { l: "Cobertura de UTMs", r: p.cobertura_utm === null ? "—" : `${String(p.cobertura_utm).replace(".", ",")}%`, cor: "#6E6760" },
    ],
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoVisaoDigital: Dados = {
  visualizacoes: 24_618, engajadas: 11_480, intencao: 2_310, leads: 312, negocios: 187, visitas: 96, fechamentos: 14,
  conversaoPagina: 1.27, conversaoLead: 59.9, tempoAtendimento: 14, pipelineAtribuido: null, sessoesGa4: "8.412 · 5.930",
  series: SERIES,
  etapas: [
    { nome: "1 · Página acessada", volume: 24_618, largura: 100, taxa: "100%" },
    { nome: "2 · Imóvel visualizado", volume: 15_204, largura: 62, taxa: "61,8%" },
    { nome: "3 · Ação de intenção", volume: 2_310, largura: 34, taxa: "15,2%" },
    { nome: "4 · Lead do site", volume: 312, largura: 20, taxa: "13,5%" },
  ],
  origens: [
    { l: "Instagram orgânico", r: "52", largura: 100, cor: "#FF7000" },
    { l: "Google orgânico", r: "41", largura: 79, cor: "#FF9A4D" },
    { l: "Meta Ads", r: "38", largura: 73, cor: "#FFB570" },
  ],
  campanhas: [{ l: "meta · moema-prontos-ago", r: "72%" }],
  paginas: [{ l: "/imoveis (busca)", r: "6.912" }, { l: "Apê Canário 71", r: "1.486" }],
  fracas: [{ l: "/blog/guia-moema", r: "2.180 vis. · 0 leads", sub: "sem CTA de imóvel" }],
  tracking: [
    { l: "Coleta própria", r: "há 2 min", cor: "#1FA85A" },
    { l: "GA4", r: "ok", cor: "#1FA85A" },
    { l: "Cobertura de UTMs", r: "74%", cor: "#1FA85A" },
  ],
  atualizado: "14:32",
};
