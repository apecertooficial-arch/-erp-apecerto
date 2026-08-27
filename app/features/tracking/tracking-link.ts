export const TRACKING_CHANNELS = {
  meta: { source: "facebook", medium: "paid_social" },
  google: { source: "google", medium: "cpc" },
  instagram: { source: "instagram", medium: "social" },
  organico: { source: "apecerto", medium: "organic" },
  whatsapp: { source: "whatsapp", medium: "messaging" },
  portal: { source: "portal", medium: "referral" },
  parceiro: { source: "parceiro", medium: "partner" },
  formulario: { source: "facebook", medium: "lead_form" },
} as const;

export type TrackingChannel = keyof typeof TRACKING_CHANNELS;

type TrackingLinkInput = {
  channel: TrackingChannel;
  base: string;
  campaign: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  formId?: string;
  trackingRef: string;
};

export type TrackingLinkResult =
  | { ok: true; link: string }
  | { ok: false; error: string };

export function slug(value: string, max = 80) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

function optionalNumericId(value: string | undefined, label: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return { ok: true as const, value: "" };
  if (!/^\d{6,25}$/.test(normalized)) {
    return { ok: false as const, error: `${label} deve conter somente números.` };
  }
  return { ok: true as const, value: normalized };
}

export function buildTrackingLink(input: TrackingLinkInput): TrackingLinkResult {
  const campaign = slug(input.campaign);
  if (!campaign) return { ok: false, error: "Informe o nome real da campanha antes de gerar o link." };

  const campaignId = optionalNumericId(input.campaignId, "ID da campanha");
  if (!campaignId.ok) return campaignId;
  const adsetId = optionalNumericId(input.adsetId, "ID do conjunto");
  if (!adsetId.ok) return adsetId;
  const adId = optionalNumericId(input.adId, "ID do anúncio");
  if (!adId.ok) return adId;
  const formId = optionalNumericId(input.formId, "ID do formulário");
  if (!formId.ok) return formId;

  try {
    const url = new URL(input.base.trim());
    if (url.protocol !== "https:") return { ok: false, error: "A página de destino precisa começar com https://" };
    const preset = TRACKING_CHANNELS[input.channel];
    url.searchParams.set("utm_source", preset.source);
    url.searchParams.set("utm_medium", preset.medium);
    url.searchParams.set("utm_campaign", campaign);
    if (campaignId.value) {
      url.searchParams.set("utm_id", campaignId.value);
      url.searchParams.set("campaign_id", campaignId.value);
    }
    if (adsetId.value) url.searchParams.set("adset_id", adsetId.value);
    if (adId.value) {
      url.searchParams.set("ad_id", adId.value);
      url.searchParams.set("utm_content", adId.value);
    }
    if (formId.value) url.searchParams.set("form_id", formId.value);
    url.searchParams.set("tracking_ref", input.trackingRef);
    return { ok: true, link: url.toString() };
  } catch {
    return { ok: false, error: "Informe uma URL válida, começando com https://" };
  }
}
