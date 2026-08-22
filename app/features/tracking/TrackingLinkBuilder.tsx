"use client";

import { useMemo, useState } from "react";

const CHANNELS: Record<string, { source: string; medium: string }> = {
  meta: { source: "facebook", medium: "paid_social" },
  google: { source: "google", medium: "cpc" },
  instagram: { source: "instagram", medium: "social" },
  whatsapp: { source: "whatsapp", medium: "messaging" },
  portal: { source: "portal", medium: "referral" },
  parceiro: { source: "parceiro", medium: "partner" },
  formulario: { source: "facebook", medium: "lead_form" },
};

function slug(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

export function TrackingLinkBuilder() {
  const [channel, setChannel] = useState("meta");
  const [base, setBase] = useState("https://apecerto.com/");
  const [campaign, setCampaign] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [adsetId, setAdsetId] = useState("");
  const [adId, setAdId] = useState("");
  const [formId, setFormId] = useState("");
  const [copied, setCopied] = useState("");
  const [seed] = useState(() => Date.now().toString(36));
  const preset = CHANNELS[channel];

  const trackingRef = useMemo(() => `ac-${preset.source}-${slug(campaignId || campaign || "campanha")}-${seed}`, [preset.source, campaignId, campaign, seed]);
  const link = useMemo(() => {
    try {
      const url = new URL(base);
      url.searchParams.set("utm_source", preset.source);
      url.searchParams.set("utm_medium", preset.medium);
      url.searchParams.set("utm_campaign", campaign || "campanha-a-definir");
      if (campaignId) { url.searchParams.set("utm_id", campaignId); url.searchParams.set("campaign_id", campaignId); }
      if (adsetId) url.searchParams.set("adset_id", adsetId);
      if (adId) { url.searchParams.set("ad_id", adId); url.searchParams.set("utm_content", adId); }
      if (formId) url.searchParams.set("form_id", formId);
      url.searchParams.set("tracking_ref", trackingRef);
      return url.toString();
    } catch { return "Informe uma URL válida, começando com https://"; }
  }, [base, preset, campaign, campaignId, adsetId, adId, formId, trackingRef]);
  const whatsappMessage = `Olá! Vim pelo site da ApêCerto. Ref: ${trackingRef}`;
  const copy = async (value: string, type: string) => { await navigator.clipboard.writeText(value); setCopied(type); window.setTimeout(()=>setCopied(""),1600); };

  return <div className="t360-link-layout">
    <section className="t360-card">
      <header><div><p>PADRÃO DE ATRIBUIÇÃO</p><h2>Gerador de links rastreáveis</h2></div><span>não altera campanhas</span></header>
      <p className="t360-help">Crie um link diferente para cada campanha, anúncio, formulário, portal ou parceiro. Assim a mesma página do site passa a informar exatamente de onde a visita veio.</p>
      <div className="t360-link-form">
        <label>Canal<select value={channel} onChange={(event)=>setChannel(event.target.value)}>{Object.keys(CHANNELS).map(key=><option key={key} value={key}>{key[0].toUpperCase()+key.slice(1)}</option>)}</select></label>
        <label className="wide">Página de destino<input value={base} onChange={(event)=>setBase(event.target.value)} placeholder="https://apecerto.com/imovel/..."/></label>
        <label className="wide">Nome da campanha<input value={campaign} onChange={(event)=>setCampaign(event.target.value)} placeholder="Ex.: Miruna 449 · Form Lead · Ago/26"/></label>
        <label>ID da campanha<input value={campaignId} onChange={(event)=>setCampaignId(event.target.value)} placeholder="Meta ou Google"/></label>
        <label>ID do conjunto<input value={adsetId} onChange={(event)=>setAdsetId(event.target.value)} placeholder="opcional"/></label>
        <label>ID do anúncio<input value={adId} onChange={(event)=>setAdId(event.target.value)} placeholder="opcional"/></label>
        <label>ID do formulário<input value={formId} onChange={(event)=>setFormId(event.target.value)} placeholder="opcional"/></label>
      </div>
    </section>
    <section className="t360-card t360-link-result">
      <header><div><p>LINK FINAL</p><h2>Pronto para usar</h2></div></header>
      <code>{link}</code><button type="button" onClick={()=>void copy(link,"link")}>{copied==='link'?"Copiado":"Copiar link"}</button>
      <hr/><span>Referência humana</span><strong>{trackingRef}</strong>
      <small>Use esta referência na mensagem pré-preenchida do WhatsApp. Ela permite conferir visualmente qual link originou a conversa.</small>
      <code>{whatsappMessage}</code><button type="button" onClick={()=>void copy(whatsappMessage,"message")}>{copied==='message'?"Copiada":"Copiar mensagem"}</button>
    </section>
  </div>;
}

