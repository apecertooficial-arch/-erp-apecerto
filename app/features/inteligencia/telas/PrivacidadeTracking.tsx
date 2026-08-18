"use client";

/* PRIVACIDADE E QUALIDADE DO TRACKING — artboard 9a.
 * A única tela que pode responder “não confie ainda”. Consentimento, saúde das
 * fontes, qualidade dos eventos e a lista fechada do que é coletado.
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
  qualidade: { l: string; r: string; corR?: string }[];
  atribuicao: { l: string; r: string }[];
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
      <Cabecalho eyebrow="CONSENTIMENTO" titulo="O que as pessoas escolheram" nota={recorte.periodo} />
      <GradeKpis itens={consentimento} colunas={3} />

      <Cabecalho eyebrow="SAÚDE TÉCNICA" titulo="A coleta está de pé?" cor="#8B00CC" nota="fonte parada aparece como atenção, nunca como zero" />
      <GradeKpis itens={saude} colunas={4} />

      <Banner
        tom="aviso"
        forte="7 leads não sincronizaram com o CRM desde 14 de agosto."
        texto="São pessoas que pediram contato pelo site e não apareceram para ninguém. É o pior tipo de erro de dado, porque não faz ruído."
        botao={{ rotulo: "Abrir na Central de alertas", go: () => recorte.irPara("alertas") }}
      />

      <Cabecalho eyebrow="QUALIDADE E ATRIBUIÇÃO" titulo="O que está furando a medição" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Qualidade dos eventos", linhas: d.qualidade, foot: "evento inválido não é corrigido no escuro: entra na contagem de rejeitados" },
          { titulo: "Atribuição", linhas: d.atribuicao, foot: "volume não atribuído nunca é redistribuído entre canais", link: { rotulo: "Ver o não atribuído em Aquisição →", go: () => recorte.irPara("aquisicao") } },
        ]}
      />

      <ChipsEventos titulo={`Eventos coletados · ${d.eventos.length}`} itens={d.eventos} foot="lista fechada: nada fora dela aparece no painel como se já existisse" />

      <Banner
        tom="tint-roxo"
        forte="Regras garantidas:"
        texto="essencial sem cookies · sem fingerprinting · sem IP bruto · sem user agent bruto · retenção de 90 dias · hash antifraude 48 h · acesso restrito. A revisão jurídica final é do responsável da empresa."
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
    { l: "Páginas sem tracking", r: "2", corR: "#B5700A" },
    { l: "Eventos rejeitados ou inválidos", r: "118 (0,3%)" },
    { l: "Possíveis duplicidades", r: "42" },
    { l: "Leads sem sincronização com o CRM", r: "7", corR: "#D93E3E" },
  ],
  atribuicao: [
    { l: "Cobertura de UTMs", r: "74%" },
    { l: "Volume não atribuído", r: "11%" },
    { l: "Erros de sincronização · 24 h", r: "2" },
    { l: "Última verificação", r: "hoje, 14:30" },
  ],
  atualizado: "14:30",
};
