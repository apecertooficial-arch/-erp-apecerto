"use client";

/* 8 · PRIVACIDADE E QUALIDADE DO TRACKING — artboard 9a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. consentimento em três níveis
 *   2. saúde técnica das quatro fontes
 *   3. banner dos leads sem sincronizar
 *   4. qualidade dos eventos · atribuição
 *   5. lista fechada dos 20 eventos coletados
 *   6. regras garantidas
 *   7. rodapé de fontes
 *
 * É a única tela autorizada a dizer “não confie ainda”. Fonte parada aparece como
 * atenção, nunca como zero.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, ChipsEventos, GradeKpis, type Kpi } from "../pecas";

type Dados = {
  essenciais: number | null;
  analytics: number | null;
  marketing: number | null;
  coletaPropria: string | null;
  googleTag: string | null;
  clarity: string | null;
  sincronizacao: string | null;
  eventos: string[];
  qualidade: { l: string; r: string; corR?: string; sub?: string }[];
  atribuicao: { l: string; r: string; sub?: string }[];
  atualizado: string;
};

export function PrivacidadeTracking({ recorte }: PropsTela) {
  const d = usarDados();

  const consentimento: Kpi[] = [
    { rotulo: "Somente essenciais", bruto: d.essenciais, texto: fmt.porcento(d.essenciais, 0), tile: "laranja", foot: "15.017 visualizações" },
    { rotulo: "Analytics", bruto: d.analytics, texto: fmt.porcento(d.analytics, 0), tile: "roxo", foot: "7.632 visualizações · habilita GA4 e gravação" },
    { rotulo: "Marketing", bruto: d.marketing, texto: fmt.porcento(d.marketing, 0), tile: "verde", foot: "1.969 visualizações" },
  ];

  const saude: Kpi[] = [
    { rotulo: "Coleta própria", bruto: d.coletaPropria, chip: "● operando", chipTom: "bom", tile: "verde", foot: "último evento há 2 min" },
    { rotulo: "Google Tag", bruto: d.googleTag, chip: "● operando", chipTom: "bom", tile: "verde", foot: "último evento há 6 min" },
    { rotulo: "Microsoft Clarity", bruto: d.clarity, chip: "● atenção", chipTom: "aviso", tile: "ambar", motivo: "fonte", detalhe: "sem evento há 3 h", foot: "mapas e gravações parciais neste período" },
    { rotulo: "Sincronização com CRM", bruto: d.sincronizacao, chip: "● 7 pendentes", chipTom: "ruim", tile: "vermelho", foot: "desde 14 ago · pessoas que pediram contato" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="CONSENTIMENTO" titulo="O que as pessoas escolheram" nota={`${recorte.periodo} · 24.618 visualizações no total`} />
      <GradeKpis itens={consentimento} colunas={3} />

      <Cabecalho eyebrow="SAÚDE TÉCNICA" titulo="A coleta está de pé?" cor="#8B00CC" nota="fonte parada aparece como atenção, nunca como zero" />
      <GradeKpis itens={saude} colunas={4} />

      <Banner
        tom="aviso"
        forte="7 leads não sincronizaram com o CRM desde 14 de agosto."
        texto="São pessoas que pediram contato pelo site e não apareceram para ninguém. É o pior tipo de erro de dado, porque não faz ruído — e por isso vira alerta crítico com dono."
        botao={{ rotulo: "Abrir na Central de alertas", go: () => recorte.irPara("alertas") }}
      />

      <Cabecalho eyebrow="QUALIDADE E ATRIBUIÇÃO" titulo="O que está furando a medição" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Qualidade dos eventos", linhas: d.qualidade, foot: "evento inválido não é corrigido no escuro: entra na contagem de rejeitados", link: { rotulo: "Ver diagnóstico na Central de alertas →", go: () => recorte.irPara("alertas") } },
          { titulo: "Atribuição", linhas: d.atribuicao, foot: "volume não atribuído nunca é redistribuído entre canais", link: { rotulo: "Ver o não atribuído em Aquisição →", go: () => recorte.irPara("aquisicao") } },
        ]}
      />

      <Cabecalho eyebrow="O QUE É COLETADO" titulo="Lista fechada, declarada nesta tela" cor="#8B00CC" />
      <ChipsEventos titulo={`Eventos coletados hoje · ${d.eventos.length}`} itens={d.eventos} foot="nada fora desta lista aparece no painel como se já existisse" />

      <Banner
        tom="tint-roxo"
        forte="Regras garantidas:"
        texto="essencial sem cookies · sem fingerprinting · sem IP bruto · sem user agent bruto · retenção de 90 dias · hash antifraude 48 h · acesso restrito por perfil. A revisão jurídica final é do responsável da empresa."
      />

      <RodapeFontes
        fontes={["coleta própria", "Google Tag", "fila de sincronização", "registro de consentimento"]}
        pendencias={["Clarity sem evento há 3 h", "2 páginas sem tracking", "12 imóveis sem código", "UTMs ausentes em 3 anúncios"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  essenciais: 61,
  analytics: 31,
  marketing: 8,
  coletaPropria: "ativa",
  googleTag: "ativo",
  clarity: null,
  sincronizacao: "7 pendentes",
  eventos: [
    "page_view", "consent_update", "view_item", "view_inventory", "generate_lead", "whatsapp_click", "phone_click", "social_click",
    "sara_open", "sara_search", "sara_results", "sara_error", "favorite_toggle", "gallery_interaction", "property_search", "cta_click",
    "owner_cta_click", "form_start", "filter_change", "scroll_depth",
  ],
  qualidade: [
    { l: "Páginas sem tracking", r: "2", corR: "#B5700A", sub: "o que não é medido não alerta" },
    { l: "Eventos rejeitados ou inválidos", r: "118 (0,3%)" },
    { l: "Possíveis duplicidades", r: "42" },
    { l: "Imóveis sem código", r: "12", sub: "418 eventos em “não identificado”" },
    { l: "Leads sem sincronização com o CRM", r: "7", corR: "#D93E3E", sub: "desde 14 ago · crítico" },
  ],
  atribuicao: [
    { l: "Cobertura de UTMs", r: "74%" },
    { l: "Volume não atribuído", r: "11%", sub: "sem UTM 48% · sem consentimento 39% · referência perdida 13%" },
    { l: "UTMs ausentes em anúncios ativos", r: "3", sub: "41 leads sem origem por mês" },
    { l: "Erros de sincronização · 24 h", r: "2" },
    { l: "Última verificação", r: "hoje, 14:30" },
  ],
  atualizado: "14:30",
};
