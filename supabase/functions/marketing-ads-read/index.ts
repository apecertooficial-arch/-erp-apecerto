import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createServiceAccountAssertion, GOOGLE_TOKEN_URI } from "../_shared/google-service-account.ts";

const GRAPH = "https://graph.facebook.com/v25.0";
const GOOGLE_ADS = "https://googleads.googleapis.com/v25";
const GESTAO = new Set(["admin", "gerente", "diretor", "executivo"]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" },
});

function erroSeguro(prefixo: string, status?: number) {
  return `${prefixo}${status ? ` (HTTP ${status})` : ""}`;
}

async function googleServiceAccountAccessToken(rawCredentials: string) {
  const credentials = await createServiceAccountAssertion(rawCredentials);
  if (!credentials) return { access: "", status: 0 };
  const response = await fetch(credentials.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: credentials.assertion,
    }),
  });
  const access = (await response.json().catch(() => ({})))?.access_token ?? "";
  return { access: String(access), status: response.status };
}

async function meta(days: number) {
  const token = Deno.env.get("META_ADS_TOKEN") ?? Deno.env.get("META_CAPI_TOKEN") ?? "";
  const configuredAccount = (Deno.env.get("META_AD_ACCOUNT_ID") ?? "").replace(/^act_/, "");
  if (!token) return { status: "nao_configurado", motivo: "Token da Meta ausente.", contas: [], anuncios: [] };

  let accountId = configuredAccount;
  let accountName = "Conta Meta";
  let currency = "BRL";
  if (!accountId) {
    const accountsResponse = await fetch(`${GRAPH}/me/adaccounts?fields=id,name,currency,account_status&limit=25&access_token=${encodeURIComponent(token)}`);
    if (!accountsResponse.ok) return { status: "sem_permissao", motivo: erroSeguro("O token existente envia conversões, mas não possui leitura do Meta Ads", accountsResponse.status), contas: [], anuncios: [] };
    const accounts = (await accountsResponse.json().catch(() => ({})))?.data ?? [];
    const active = accounts.find((item: any) => item.account_status === 1) ?? accounts[0];
    accountId = String(active?.id ?? "").replace(/^act_/, "");
    accountName = active?.name ?? accountName;
    currency = active?.currency ?? currency;
  }
  if (!accountId) return { status: "sem_conta", motivo: "Nenhuma conta de anúncios acessível pelo token existente.", contas: [], anuncios: [] };

  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const fields = ["campaign_id","campaign_name","adset_id","adset_name","ad_id","ad_name","objective","spend","impressions","reach","clicks","inline_link_clicks","ctr","cpc","actions","cost_per_action_type"].join(",");
  const filter = encodeURIComponent(JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: ["ACTIVE"] }]));
  const url = `${GRAPH}/act_${accountId}/insights?level=ad&fields=${fields}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&filtering=${filter}&limit=500&access_token=${encodeURIComponent(token)}`;
  const insightsResponse = await fetch(url);
  if (!insightsResponse.ok) {
    const semPermissao = insightsResponse.status === 401 || insightsResponse.status === 403;
    return {
      status: semPermissao ? "sem_permissao" : "erro",
      motivo: semPermissao
        ? "A conta de anúncios foi identificada, mas o token atual não possui ads_read e acesso a esse ativo da empresa."
        : erroSeguro("A Meta recusou a leitura das métricas", insightsResponse.status),
      contas: [{ id: accountId, nome: accountName, moeda: currency }],
      anuncios: [],
    };
  }
  const data = (await insightsResponse.json().catch(() => ({})))?.data ?? [];
  const action = (items: any[], keys: string[]) => Number(items?.find((a: any) => keys.includes(a.action_type))?.value ?? 0) || 0;
  const cost = (items: any[], keys: string[]) => Number(items?.find((a: any) => keys.includes(a.action_type))?.value ?? 0) || null;
  return {
    status: "conectado",
    motivo: null,
    contas: [{ id: accountId, nome: accountName, moeda: currency }],
    anuncios: data.map((row: any) => ({
      plataforma: "Meta", campanha_id: row.campaign_id, campanha: row.campaign_name,
      conjunto_id: row.adset_id, conjunto: row.adset_name, anuncio_id: row.ad_id, anuncio: row.ad_name,
      objetivo: row.objective ?? null, status: "ACTIVE", investimento: Number(row.spend ?? 0),
      impressoes: Number(row.impressions ?? 0), alcance: Number(row.reach ?? 0),
      cliques: Number(row.inline_link_clicks ?? row.clicks ?? 0), ctr: Number(row.ctr ?? 0), cpc: Number(row.cpc ?? 0),
      leads_plataforma: action(row.actions, ["lead","onsite_conversion.lead_grouped"]),
      cpl_plataforma: cost(row.cost_per_action_type, ["lead","onsite_conversion.lead_grouped"]),
    })),
  };
}

async function google(days: number) {
  const developer = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
  const serviceAccount = Deno.env.get("GOOGLE_ADS_SERVICE_ACCOUNT_JSON") ?? "";
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") ?? "";
  const refreshToken = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN") ?? "";
  const customer = (Deno.env.get("GOOGLE_ADS_CUSTOMER_ID") ?? "").replace(/-/g, "");
  const login = (Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") ?? "").replace(/-/g, "");
  const faltando = [
    !developer && "developer token",
    !serviceAccount && !clientId && "OAuth client ID ou conta de serviço",
    !serviceAccount && !clientSecret && "OAuth client secret",
    !serviceAccount && !refreshToken && "OAuth refresh token",
    !customer && "customer ID",
  ].filter(Boolean);
  if (faltando.length) {
    return { status: "nao_configurado", motivo: `Google Ads ainda precisa de: ${faltando.join(", ")}.`, faltando, anuncios: [] };
  }
  let access = "";
  let tokenStatus = 0;
  if (serviceAccount) {
    const token = await googleServiceAccountAccessToken(serviceAccount);
    access = token.access;
    tokenStatus = token.status;
  } else {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URI, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    });
    access = String((await tokenResponse.json().catch(() => ({})))?.access_token ?? "");
    tokenStatus = tokenResponse.status;
  }
  if (!access) return { status: "erro", motivo: erroSeguro("Falha na autorização do Google Ads", tokenStatus), anuncios: [] };
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const query = `SELECT campaign.id,campaign.name,campaign.status,ad_group.id,ad_group.name,ad_group.status,ad_group_ad.ad.id,ad_group_ad.ad.name,ad_group_ad.status,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.ctr,metrics.average_cpc,metrics.conversions,metrics.cost_per_conversion FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'`;
  const headers: Record<string,string> = { Authorization: `Bearer ${access}`, "developer-token": developer, "Content-Type": "application/json" };
  if (login) headers["login-customer-id"] = login;
  const adsResponse = await fetch(`${GOOGLE_ADS}/customers/${customer}/googleAds:searchStream`, { method: "POST", headers, body: JSON.stringify({ query }) });
  if (!adsResponse.ok) return { status: "erro", motivo: erroSeguro("O Google Ads recusou a leitura das métricas", adsResponse.status), anuncios: [] };
  const streams = await adsResponse.json().catch(() => []);
  const rows = (Array.isArray(streams) ? streams : []).flatMap((part: any) => part.results ?? []);
  return { status: "conectado", motivo: null, anuncios: rows.map((row: any) => ({
    plataforma: "Google", campanha_id: row.campaign?.id, campanha: row.campaign?.name,
    conjunto_id: row.adGroup?.id, conjunto: row.adGroup?.name, anuncio_id: row.adGroupAd?.ad?.id,
    anuncio: row.adGroupAd?.ad?.name ?? `Anúncio ${row.adGroupAd?.ad?.id ?? ""}`, status: "ENABLED",
    investimento: Number(row.metrics?.costMicros ?? 0)/1e6, impressoes: Number(row.metrics?.impressions ?? 0),
    cliques: Number(row.metrics?.clicks ?? 0), ctr: Number(row.metrics?.ctr ?? 0)*100,
    cpc: Number(row.metrics?.averageCpc ?? 0)/1e6, leads_plataforma: Number(row.metrics?.conversions ?? 0),
    cpl_plataforma: Number(row.metrics?.costPerConversion ?? 0)/1e6 || null,
  })) };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const auth = request.headers.get("authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!userData.user) return json({ ok: false, error: "unauthorized" }, 401);
  const { data: me } = await supabase.from("usuarios").select("role,ativo").eq("id", userData.user.id).maybeSingle();
  if (!me?.ativo || !GESTAO.has(String(me.role))) return json({ ok: false, error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  const days = Math.max(1, Math.min(Number(body?.days ?? 30) || 30, 365));
  const [metaAds, googleAds] = await Promise.all([meta(days), google(days)]);
  return json({ ok: true, periodo_dias: days, meta: metaAds, google: googleAds, atualizado_em: new Date().toISOString() });
});
