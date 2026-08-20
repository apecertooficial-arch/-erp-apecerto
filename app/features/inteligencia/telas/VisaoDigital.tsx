"use client";

import { useMemo } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt, RodapeFontes } from "../dado";
import { Cabecalho, Funil, GradeKpis, IconeInt, Tabela, type Etapa, type Kpi } from "../pecas";
import { useResumoInteligencia, type Tracking360Jornada } from "../usar-resumo";

function n(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(part: number | null, total: number | null) {
  return part !== null && total !== null && total > 0 ? (100 * part) / total : null;
}

function width(part: number | null, total: number | null) {
  const value = pct(part, total);
  return value === null ? null : Math.max(3, Math.min(100, Math.round(value)));
}

function conversion(leads: number, visits: number) {
  return visits > 0 ? fmt.porcento((100 * leads) / visits, 1) : "—";
}

function shortCampaign(value: string) {
  if (value === "(sem campanha)") return value;
  return value.length > 24 ? `${value.slice(0, 21)}…` : value;
}

function actions(journey: Tracking360Jornada) {
  const result: string[] = [];
  if (journey.products.length) result.push(`imóvel: ${journey.products[0]}`);
  if (journey.max_scroll) result.push(`rolou ${Math.round(journey.max_scroll)}%`);
  if (journey.started_form) result.push("começou formulário");
  if (journey.clicked_whatsapp) result.push("clicou WhatsApp");
  if (journey.clicked_phone) result.push("clicou telefone");
  if (journey.generated_lead) result.push("enviou lead");
  return result.join(" · ") || "visualizou a página";
}

export function VisaoDigital({ accessToken, recorte }: PropsTela) {
  const { data, loading, error } = useResumoInteligencia(accessToken, recorte.periodo);
  const journey = data?.digital_journey;
  const overview = journey?.overview;
  const behavior = journey?.behavior;
  const whatsapp = journey?.whatsapp;

  const visits = n(overview?.tracked_page_visits);
  const engaged = n(overview?.engaged_page_visits);
  const attributed = n(overview?.attributed_page_visits);
  const propertyViews = n(overview?.property_views);
  const intent = n(overview?.intent_clicks);
  const whatsappClicks = n(overview?.whatsapp_clicks);
  const formStarts = n(overview?.form_starts);
  const abandoned = n(behavior?.form_abandonments);
  const leads = n(overview?.generated_leads);

  const kpis: Kpi[] = [
    { rotulo: "Visitas rastreadas", bruto: visits, texto: fmt.inteiro(visits), tile: "laranja", foot: `${fmt.inteiro(n(overview?.page_views))} page views` },
    { rotulo: "Com origem identificada", bruto: attributed, texto: fmt.inteiro(attributed), tile: "roxo", foot: `${fmt.porcento(pct(attributed, visits), 1)} das visitas` },
    { rotulo: "Visitas com interação", bruto: engaged, texto: fmt.inteiro(engaged), tile: "verde", foot: `${fmt.porcento(pct(engaged, visits), 1)} das visitas` },
    { rotulo: "Imóveis visualizados", bruto: propertyViews, texto: fmt.inteiro(propertyViews), tile: "laranja", foot: `${fmt.inteiro(n(overview?.unique_properties))} imóveis diferentes` },
    { rotulo: "Cliques no WhatsApp", bruto: whatsappClicks, texto: fmt.inteiro(whatsappClicks), tile: "verde", foot: `${fmt.inteiro(intent)} ações de intenção no total` },
    { rotulo: "Começaram formulário", bruto: formStarts, texto: fmt.inteiro(formStarts), tile: "roxo", foot: "uma vez por visita à página" },
    { rotulo: "Abandonaram formulário", bruto: abandoned, texto: fmt.inteiro(abandoned), tile: abandoned && abandoned > 0 ? "vermelho" : "verde", foot: "começaram e não enviaram" },
    { rotulo: "Leads enviados", bruto: leads, texto: fmt.inteiro(leads), tile: leads && leads > 0 ? "verde" : "ambar", foot: `${fmt.porcento(pct(leads, visits), 2)} de conversão` },
  ];

  const funnel: Etapa[] = [
    { nome: "Página acessada", volume: visits, volumeTexto: fmt.inteiro(visits), largura: width(visits, visits), taxa: visits === null ? undefined : "100%" },
    { nome: "Imóvel visualizado", volume: propertyViews, volumeTexto: fmt.inteiro(propertyViews), largura: width(propertyViews, visits), taxa: fmt.porcento(pct(propertyViews, visits), 1) },
    { nome: "Ação de intenção", volume: intent, volumeTexto: fmt.inteiro(intent), largura: width(intent, visits), taxa: fmt.porcento(pct(intent, visits), 1) },
    { nome: "Formulário iniciado", volume: formStarts, volumeTexto: fmt.inteiro(formStarts), largura: width(formStarts, visits), taxa: fmt.porcento(pct(formStarts, visits), 1) },
    { nome: "Lead enviado", volume: leads, volumeTexto: fmt.inteiro(leads), largura: width(leads, visits), taxa: fmt.porcento(pct(leads, visits), 1) },
  ];

  const campaignRows = useMemo(() => (journey?.campaigns ?? [])
    .filter((row) => !row.source.startsWith("codex") && row.medium !== "validation")
    .map((row) => ({
      chave: `${row.source}-${row.medium}-${row.campaign}`,
      destaque: row.whatsapp_clicks > 0 || row.leads > 0,
      abrir: () => recorte.filtrar(`Campanha: ${row.campaign}`),
      celulas: [
        { texto: `${row.source} / ${row.medium}`, forte: true, sub: shortCampaign(row.campaign) },
        { texto: fmt.inteiro(row.page_views), num: true },
        { texto: fmt.inteiro(row.property_views), num: true },
        { texto: fmt.inteiro(row.whatsapp_clicks), num: true },
        { texto: fmt.inteiro(row.form_starts), num: true },
        { texto: fmt.inteiro(row.leads), num: true },
        { texto: conversion(row.leads, row.page_views), num: true },
      ],
    })), [journey?.campaigns, recorte]);

  const recentRows = useMemo(() => (journey?.recent_journeys ?? []).map((row) => ({
    chave: `${row.visit_ref}-${row.last_at}`,
    destaque: row.clicked_whatsapp || row.generated_lead,
    abrir: () => recorte.filtrar(`Visita: ${row.visit_ref}`),
    celulas: [
      { texto: new Date(row.last_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), forte: true, sub: `ref. ${row.visit_ref}` },
      { texto: `${row.source} / ${row.medium}`, sub: shortCampaign(row.campaign) },
      { texto: row.page_path || "/", sub: row.device ?? undefined },
      { texto: actions(row) },
      row.identified
        ? { texto: `${row.identified_first_name ?? "Lead"} ${row.masked_phone ?? ""}`.trim(), chip: "identificado", chipTom: "bom" as const }
        : { texto: "anônimo", chip: "anônimo", chipTom: row.clicked_whatsapp ? "aviso" as const : "neutro" as const },
    ],
  })), [journey?.recent_journeys, recorte]);

  const channelRows = (journey?.channels ?? []).filter((row) => !row.source.startsWith("codex") && row.medium !== "validation");
  const paid = channelRows.filter((row) => row.medium === "paid" || row.medium === "paid_social" || row.medium === "cpc");
  const paidClicks = paid.reduce((sum, row) => sum + row.whatsapp_clicks, 0);
  const paidVisits = paid.reduce((sum, row) => sum + row.page_views, 0);
  const maxDaily = Math.max(1, ...(journey?.daily ?? []).map((row) => row.page_views));

  if (loading || error || !journey) {
    return (
      <div className="int-secao">
        <BlocoSemDado
          titulo={loading ? "Consolidando a jornada digital real" : "A jornada digital não respondeu"}
          detalhe={loading ? "Canais, campanhas, páginas, imóveis e leads estão sendo reconciliados. Nenhum número demonstrativo será exibido." : error ?? "Tente novamente."}
        />
      </div>
    );
  }

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="RESPOSTA DIRETA" titulo="O que aconteceu com as campanhas e com o site" nota={`${recorte.periodo} · sem dados demonstrativos`} />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <DiagnosticCard
          tone="roxo"
          title="Tráfego pago detectado"
          value={`${fmt.inteiro(paidVisits)} visitas · ${fmt.inteiro(paidClicks)} cliques no WhatsApp`}
          detail={paid.length ? `Campanha ${paid[0].campaign}; origem ${paid.map((row) => row.source).join(" + ")}.` : "Nenhuma visita com mídia paga apareceu neste recorte."}
        />
        <DiagnosticCard
          tone={abandoned && abandoned > 0 ? "vermelho" : "verde"}
          title="Formulário"
          value={`${fmt.inteiro(formStarts)} começaram · ${fmt.inteiro(leads)} enviaram`}
          detail={`${fmt.inteiro(abandoned)} visitas iniciaram e não concluíram. Isso é abandono, não lead.`}
        />
        <DiagnosticCard
          tone={(whatsapp?.with_ad_source ?? 0) > 0 ? "verde" : "ambar"}
          title="WhatsApp e identidade"
          value={`${fmt.inteiro(whatsappClicks)} cliques no site · ${fmt.inteiro(whatsapp?.with_ad_source)} conversas atribuídas`}
          detail="O clique tem campanha e página. O nome só é comprovado após formulário ou quando o WhatsApp entrega a referência do anúncio."
        />
      </div>

      <Cabecalho eyebrow="INDICADORES" titulo="Da visita ao lead, em números verificáveis" cor="#8B00CC" />
      <GradeKpis itens={kpis} colunas={4} />

      <div className="int-duas">
        <div className="int-col">
          <Cabecalho eyebrow="EVOLUÇÃO" titulo="Volume real por dia" nota="barras = page views" />
          <div className="intp-cartao">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180 }}>
              {(journey.daily ?? []).map((row) => (
                <button
                  type="button"
                  key={row.day}
                  title={`${row.day}: ${row.page_views} page views · ${row.intent_clicks} intenções · ${row.leads} leads`}
                  onClick={() => recorte.filtrar(`Dia: ${row.day}`)}
                  style={{ flex: 1, minWidth: 18, height: "100%", border: 0, background: "transparent", padding: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "stretch", gap: 6, cursor: "pointer" }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#4D4842" }}>{row.page_views}</span>
                  <span style={{ minHeight: 4, height: `${Math.max(4, (145 * row.page_views) / maxDaily)}px`, borderRadius: "7px 7px 3px 3px", background: row.intent_clicks > 0 ? "linear-gradient(180deg,#8B00CC,#FF7000)" : "#FF9A4D" }} />
                  <small style={{ fontSize: 9, color: "#9A938B" }}>{new Date(`${row.day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small>
                </button>
              ))}
            </div>
            <small className="intp-kpi-foot">passe o mouse para ver page views, intenções e leads; clique para aplicar o dia ao recorte</small>
          </div>
        </div>
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL DIGITAL" titulo="Onde as pessoas param" cor="#8B00CC" />
          <Funil etapas={funnel} foot="as etapas são volumes de eventos do período; uma visita pode visualizar mais de um imóvel" />
        </div>
      </div>

      <Cabecalho eyebrow="CAMPANHAS" titulo="Qual anúncio trouxe visita, clique e lead" nota="custo e impressão entram quando as APIs de Ads forem conectadas" />
      <Tabela
        colunas={[
          { titulo: "Origem / campanha" }, { titulo: "Page views", num: true }, { titulo: "Imóveis", num: true },
          { titulo: "WhatsApp", num: true }, { titulo: "Formulários", num: true }, { titulo: "Leads", num: true }, { titulo: "Conversão", num: true },
        ]}
        linhas={campaignRows}
        ordenadaEm="Page views"
        foot="Meta/Google informam impressão, clique e custo; a coleta própria informa o que aconteceu depois que a pessoa chegou ao site."
      />

      <Cabecalho eyebrow="JORNADAS RECENTES" titulo="O caminho de cada visita rastreada" nota="anônimo até a pessoa se identificar voluntariamente" />
      <Tabela
        colunas={[{ titulo: "Quando" }, { titulo: "Origem" }, { titulo: "Página" }, { titulo: "O que fez" }, { titulo: "Identidade" }]}
        linhas={recentRows}
        ordenadaEm="Quando"
        foot="A referência é efêmera por página. Nome e telefone só aparecem após envio; não tentamos descobrir a pessoa escondida atrás de um clique."
      />

      <Cabecalho eyebrow="COMPORTAMENTO" titulo="Profundidade, páginas e produtos" />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Até onde rolaram</span>
          <MetricLine label="Chegaram a 25%" value={behavior?.scroll_25} />
          <MetricLine label="Chegaram a 50%" value={behavior?.scroll_50} />
          <MetricLine label="Chegaram a 75%" value={behavior?.scroll_75} />
          <MetricLine label="Chegaram a 90%" value={behavior?.scroll_90} />
          <small className="intp-kpi-foot">contagem por visita à página, não por disparo do evento</small>
        </div>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Páginas com mais ação</span>
          {(journey.pages ?? []).slice(0, 6).map((row) => (
            <MetricLine key={row.page_path} label={row.page_path || "/"} value={row.page_views} sub={`${row.whatsapp_clicks} WhatsApp · ${row.form_starts} formulários`} />
          ))}
        </div>
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Imóveis mais vistos</span>
          {(journey.products ?? []).slice(0, 6).map((row) => (
            <MetricLine key={row.item_id} label={row.item_name} value={row.views} sub={`${row.neighborhood ?? "bairro não informado"} · ${row.value ? fmt.dinheiro(row.value) : "preço não informado"}`} />
          ))}
        </div>
      </div>

      <Cabecalho eyebrow="COMO LER" titulo="Um painel, quatro fontes com papéis diferentes" cor="#8B00CC" />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <SourceCard title="ERP · coleta própria" status="conectado" text="Página, UTM, imóvel, rolagem, formulário, WhatsApp e vínculo com o CRM." tone="verde" />
        <SourceCard title="GA4 + Google Tag" status="coleta consentida" text="Sessões, canais e funis agregados. Só mede Analytics após consentimento." tone="roxo" />
        <SourceCard title="Microsoft Clarity" status="fora do ERP" text="Gravações e mapas de calor consentidos. O painel mostra o evento; a gravação continua no Clarity." tone="ambar" />
        <SourceCard title="Meta / Google Ads" status="API de mídia pendente" text="Impressões, gasto, CPM, CPC e criativo ainda precisam de conexão oficial das contas." tone="ambar" />
      </div>

      <RodapeFontes
        fontes={["site_events_anon", "site_leads", "wa_conversas", "CRM Funil 2.0"]}
        pendencias={["custos e impressões das plataformas de Ads", "referência de anúncio nas conversas atuais do WhatsApp", "atalho direto para gravação do Clarity"]}
        atualizado={journey.updated_at ? fmt.hora(journey.updated_at) : "—"}
      />
    </div>
  );
}

function DiagnosticCard({ tone, title, value, detail }: { tone: "roxo" | "verde" | "vermelho" | "ambar"; title: string; value: string; detail: string }) {
  const colors = { roxo: "#8B00CC", verde: "#1FA85A", vermelho: "#D93E3E", ambar: "#B5700A" };
  return (
    <div className="intp-cartao" style={{ borderTop: `3px solid ${colors[tone]}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span className={`intp-tile tile-${tone}`}><IconeInt nome={tone === "vermelho" ? "alerta" : tone === "ambar" ? "relogio" : tone === "verde" ? "check" : "faisca"} tamanho={15} /></span>
        <span className="intp-cartao-titulo">{title}</span>
      </div>
      <strong style={{ fontSize: 18, color: "#1F1C1A" }}>{value}</strong>
      <small className="intp-kpi-foot">{detail}</small>
    </div>
  );
}

function MetricLine({ label, value, sub }: { label: string; value: number | null | undefined; sub?: string }) {
  return (
    <div>
      <div className="intp-linha-kv"><span>{label}</span><b>{fmt.inteiro(n(value))}</b></div>
      {sub ? <small className="intp-linha-sub">{sub}</small> : null}
    </div>
  );
}

function SourceCard({ title, status, text, tone }: { title: string; status: string; text: string; tone: "verde" | "roxo" | "ambar" }) {
  return (
    <div className="intp-cartao">
      <span className="intp-cartao-titulo">{title}</span>
      <span className={`intp-cartao-chip tom-${tone === "verde" ? "bom" : tone === "roxo" ? "roxo" : "aviso"}`}>{status}</span>
      <small className="intp-kpi-foot">{text}</small>
    </div>
  );
}
