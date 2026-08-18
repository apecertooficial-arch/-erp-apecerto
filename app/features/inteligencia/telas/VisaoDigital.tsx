"use client";

/* 1 · VISÃO DO DIGITAL — artboard 2a, com o layout de DUAS COLUNAS do protótipo.
 *
 * Estrutura do desenho (era coluna única na publicação):
 *   · 12 KPIs em duas fileiras de 6, com chip de comparação
 *   · EVOLUÇÃO (esquerda, mais larga) ao lado do FUNIL PRINCIPAL (direita)
 *   · LEITURAS RÁPIDAS em quatro cartões: origens · campanhas · páginas e imóveis ·
 *     muito acesso, pouca conversão
 *   · faixa final: captação · Sara (roxo) · saúde do tracking
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GradeKpis, IconeInt, type Etapa, type Kpi } from "../pecas";

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

export function VisaoDigital({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: d.visualizacoes, texto: fmt.inteiro(d.visualizacoes), chip: "▲ +12,4%", chipTom: "bom" },
    { rotulo: "Páginas com engajamento", bruto: d.engajadas, texto: fmt.inteiro(d.engajadas), chip: "▲ +8,1%", chipTom: "bom" },
    { rotulo: "Cliques de intenção", bruto: d.intencao, texto: fmt.inteiro(d.intencao), chip: "▲ +15,2%", chipTom: "bom", foot: "WhatsApp 1.294 · tel. 412 · agenda 233 · form. 371" },
    { rotulo: "Leads do site", bruto: d.leads, texto: fmt.inteiro(d.leads), chip: "▲ +9,5%", chipTom: "bom" },
    { rotulo: "Negócios no Funil 2.0", bruto: d.negocios, texto: fmt.inteiro(d.negocios), chip: "▲ +6,3%", chipTom: "bom" },
    { rotulo: "Visitas agendadas", bruto: d.visitas, texto: fmt.inteiro(d.visitas), chip: "▼ −4,0%", chipTom: "ruim" },
    { rotulo: "Vendas e locações", bruto: d.fechamentos, texto: fmt.inteiro(d.fechamentos), chip: "▲ +2 vs. anterior", chipTom: "bom", foot: "9 vendas · 5 locações" },
    { rotulo: "Conversão página → lead", bruto: d.conversaoPagina, texto: fmt.porcento(d.conversaoPagina, 2), chip: "▲ +0,11 pp", chipTom: "bom" },
    { rotulo: "Conversão lead → negócio", bruto: d.conversaoLead, texto: fmt.porcento(d.conversaoLead), chip: "▼ −1,8 pp", chipTom: "ruim" },
    { rotulo: "Tempo até 1º atendimento", bruto: d.tempoAtendimento, texto: fmt.duracaoMin(d.tempoAtendimento), chip: "▲ 6 min mais rápido", chipTom: "bom", foot: "mediana · meta 5 min" },
    { rotulo: "Pipeline atribuído ao site", bruto: d.pipelineAtribuido, texto: fmt.dinheiro(d.pipelineAtribuido), chip: "aguardando dado do CRM", chipTom: "aviso", motivo: "integracao", detalhe: "valor do negócio ausente no Funil 2.0", foot: "Sem campo confiável, não mostramos número." },
    { rotulo: "Sessões e usuários · GA4", bruto: d.sessoesGa4, chip: "só consentimento Analytics · 31% das visitas", chipTom: "roxo" },
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
          <Cabecalho eyebrow="EVOLUÇÃO" titulo="Como o período se moveu" cor="#8B00CC" />
          <div className="intp-cartao">
            <svg width="100%" height="196" viewBox="0 0 560 196" preserveAspectRatio="none" role="img" aria-label="Evolução do período">
              <line x1="0" y1="49" x2="560" y2="49" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="98" x2="560" y2="98" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="147" x2="560" y2="147" stroke="#F2EFEC" strokeWidth="1" />
              {/* anotações do artboard: campanha nova e correção do tracking */}
              <line x1="306" y1="8" x2="306" y2="170" stroke="#C9AEDC" strokeWidth="1" strokeDasharray="3 4" />
              <line x1="459" y1="8" x2="459" y2="170" stroke="#C9AEDC" strokeWidth="1" strokeDasharray="3 4" />
              <polygon points="306,176 302,183 310,183" fill="#8B00CC" />
              <polygon points="459,176 455,183 463,183" fill="#8B00CC" />
              <polyline points="0,124 51,110 102,118 153,92 204,102 255,74 306,86 357,58 408,70 459,44 510,58 560,32" fill="none" stroke="#C9C2BA" strokeWidth="1.5" strokeDasharray="4 4" />
              <polyline points="0,114 51,100 102,108 153,82 204,94 255,64 306,78 357,50 408,62 459,36 510,50 560,26" fill="none" stroke="#FF7000" strokeWidth="2.5" />
              <polyline points="0,160 51,152 102,156 153,142 204,148 255,132 306,140 357,124 408,130 459,116 510,124 560,110" fill="none" stroke="#8B00CC" strokeWidth="2.5" />
              <polyline points="0,178 51,174 102,176 153,168 204,172 255,164 306,168 357,160 408,164 459,156 510,160 560,152" fill="none" stroke="#4D4842" strokeWidth="2" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {d.series.map((s) => (
                <button key={s.rotulo} type="button" className="int-chip-filtro" onClick={() => recorte.filtrar(s.chip)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.cor, flex: "none" }} />
                  {s.rotulo}
                </button>
              ))}
              <button type="button" className="int-drop" style={{ opacity: 0.55 }}>Intenção</button>
              <button type="button" className="int-drop" style={{ opacity: 0.55 }}>Visitas</button>
            </div>
            <small className="intp-kpi-foot">
              pontilhado = período anterior · cada série na própria escala · ▲ anotações: 4 ago campanha nova no Meta · 12 ago correção do tracking
            </small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="FUNIL PRINCIPAL" titulo="Do acesso à chave na mão" cor="#8B00CC" />
          <Funil etapas={etapas} foot="taxa sobre a etapa anterior · “detalhes” abre pessoas, campanhas, páginas e imóveis da etapa, conforme a sua permissão" />
        </div>
      </div>

      {/* LEITURAS RÁPIDAS — quatro cartões */}
      <Cabecalho eyebrow="LEITURAS RÁPIDAS" titulo="O que está puxando o resultado" />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Origens que mais geram negócio</span>
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
          <small className="intp-kpi-foot">ordenado por lead → negócio, não por cliques</small>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("aquisicao")}>Abrir Aquisição →</button>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Páginas e imóveis mais procurados</span>
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
          <small className="intp-kpi-foot">fila de correção, sempre com o motivo ao lado</small>
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
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>23</strong><br /><small className="intp-kpi-foot">captações</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>19</strong><br /><small className="intp-kpi-foot">contatados</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>6</strong><br /><small className="intp-kpi-foot">publicados</small></div>
          </div>
          <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("proprietarios")}>Abrir Proprietários →</button>
        </div>

        <div className="intp-cartao" style={{ background: "#8B00CC", color: "#fff", boxShadow: "0 12px 28px rgba(139,0,204,0.24)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="intp-tile" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}><IconeInt nome="faisca" tamanho={15} /></span>
            <span className="intp-cartao-titulo" style={{ color: "#fff" }}>Sara · assistente de imóveis</span>
          </div>
          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>1.482</strong><br /><small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>buscas</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>47</strong><br /><small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>leads</small></div>
            <div><strong style={{ fontSize: 22, fontWeight: 700 }}>9%</strong><br /><small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>sem resultado</small></div>
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
        fontes={["coleta própria", "Google Tag", "GA4 (consentimento 31%)", "CRM Funil 2.0"]}
        pendencias={["pipeline atribuído (campo de valor ausente no CRM)", "custo de mídia não conectado", "Clarity sem evento há 3 h"]}
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
  engajadas: 11_480,
  intencao: 2_310,
  leads: 312,
  negocios: 187,
  visitas: 96,
  fechamentos: 14,
  conversaoPagina: 1.27,
  conversaoLead: 59.9,
  tempoAtendimento: 14,
  pipelineAtribuido: null,
  sessoesGa4: "8.412 · 5.930",
  series: [
    { rotulo: "Visualizações", cor: "#FF7000", chip: "Série: Visualizações" },
    { rotulo: "Leads", cor: "#8B00CC", chip: "Série: Leads" },
    { rotulo: "Negócios", cor: "#4D4842", chip: "Série: Negócios" },
  ],
  etapas: [
    { nome: "1 · Página acessada", volume: 24_618, largura: 100, taxa: "100%" },
    { nome: "2 · Imóvel visualizado", volume: 15_204, largura: 62, taxa: "61,8%", perda: "−9.414" },
    { nome: "3 · Ação de intenção", volume: 2_310, largura: 34, taxa: "15,2%", perda: "−12.894" },
    { nome: "4 · Lead enviado", volume: 312, largura: 20, taxa: "13,5%", perda: "−1.998" },
    { nome: "5 · Negócio criado", volume: 187, largura: 15, taxa: "59,9%", perda: "−125" },
    { nome: "6 · Visita agendada", volume: 96, largura: 10, taxa: "51,3%", perda: "−91" },
    { nome: "7 · Venda ou locação", volume: 14, largura: 6, taxa: "14,6%", perda: "−82" },
  ],
  origens: [
    { l: "Instagram orgânico", r: "52", largura: 100, cor: "#FF7000" },
    { l: "Google orgânico", r: "41", largura: 79, cor: "#FF9A4D" },
    { l: "Meta Ads", r: "38", largura: 73, cor: "#FFB570" },
    { l: "Direto", r: "29", largura: 56, cor: "#C9C2BA" },
    { l: "Não atribuído", r: "27", largura: 52, cor: "#EFECE7" },
  ],
  campanhas: [
    { l: "meta · moema-prontos-ago", r: "72%" },
    { l: "google · apartamento-moema", r: "67%" },
    { l: "meta · locacao-mobiliado", r: "60%" },
  ],
  paginas: [
    { l: "/imoveis (busca)", r: "6.912" },
    { l: "Apê Canário 71 · MO-104", r: "1.486" },
    { l: "Apê Gaivota 402 · MO-118", r: "1.240" },
    { l: "bairro Moema Pássaros", r: "3.913" },
  ],
  fracas: [
    { l: "Apê Gaivota 402 · MO-118", r: "1.240 vis. · 2 leads", sub: "galeria pouco aberta — revisar fotos" },
    { l: "/blog/guia-moema", r: "2.180 vis. · 0 leads", sub: "sem CTA de imóvel na página" },
  ],
  tracking: [
    { l: "Coleta própria", r: "último evento há 2 min", cor: "#1FA85A" },
    { l: "Google Tag", r: "ok", cor: "#1FA85A" },
    { l: "Microsoft Clarity", r: "sem evento há 3h", cor: "#B5700A" },
    { l: "Cobertura de UTMs", r: "74% · não atribuído 11%", cor: "#1FA85A" },
  ],
  atualizado: "14:32",
};
