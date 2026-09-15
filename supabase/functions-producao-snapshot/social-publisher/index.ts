// Worker privado e idempotente da fila do apêcerto Studio.
// Inerte sem STUDIO_PUBLISHER_SECRET, META_GRAPH_API_VERSION e integração
// explicitamente configurada. Cada organização lê seu próprio token do Vault.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const workerSecret = Deno.env.get("STUDIO_PUBLISHER_SECRET") ?? "";
const apiVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "";
const graphHost = "graph.facebook.com";
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

type Json = Record<string, unknown>;
type MetaContext = { accessToken: string; igUserId: string; apiVersion: string; graphHost: "graph.facebook.com" };
class ProviderError extends Error { constructor(message: string, readonly code: string, readonly transient: boolean, readonly ambiguous = false) { super(message); } }

function sameSecret(received: string | null, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i); return diff === 0;
}
const response = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const safe = (value: unknown, max = 500, secret = "") => {
  const text = String(value ?? "");
  return (secret ? text.replaceAll(secret, "[redacted]") : text).replace(/[\r\n\0]/g, " ").slice(0, max);
};

async function graph(context: MetaContext, path: string, params?: Record<string, string>, method: "GET" | "POST" = "POST") {
  const endpoint = new URL(`https://${context.graphHost}/${context.apiVersion}/${path.replace(/^\//, "")}`);
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${context.accessToken}` }, signal: AbortSignal.timeout(30_000) };
  if (params && method === "GET") for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
  else if (params) { const body = new URLSearchParams(params); init.body = body; init.headers = { ...init.headers, "content-type": "application/x-www-form-urlencoded" }; }
  const result = await fetch(endpoint, init);
  const payload = await result.json().catch(() => ({})) as Json;
  if (!result.ok) {
    const error = payload.error && typeof payload.error === "object" ? payload.error as Json : {};
    const code = safe(error.code ?? result.status, 80, context.accessToken);
    throw new ProviderError(safe(error.message ?? "Meta recusou a operação.", 500, context.accessToken), code, result.status === 429 || result.status >= 500);
  }
  return payload;
}

async function waitContainer(context: MetaContext, containerId: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = await graph(context, containerId, { fields: "status_code,status" }, "GET");
    if (state.status_code === "FINISHED") return;
    if (state.status_code === "ERROR" || state.status_code === "EXPIRED") throw new ProviderError(safe(state.status ?? state.status_code), "container_failed", false);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new ProviderError("A mídia ainda está sendo processada pela Meta.", "container_processing", true);
}

async function publishContainer(context: MetaContext, containerId: string) {
  await waitContainer(context, containerId);
  try {
    const published = await graph(context, `${context.igUserId}/media_publish`, { creation_id: containerId });
    if (!published.id) throw new ProviderError("A Meta não confirmou o ID publicado.", "missing_media_id", true, true);
    const confirmation = await graph(context, String(published.id), { fields: "id,media_type,permalink,timestamp" }, "GET");
    if (confirmation.id !== published.id) throw new ProviderError("A confirmação remota ficou inconsistente.", "confirmation_mismatch", false, true);
    return { mediaId: String(published.id), confirmation };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("O resultado do envio ficou ambíguo e exige reconciliação manual.", "ambiguous_publish", false, true);
  }
}

async function processPublication(publication: Json) {
  const id = String(publication.id);
  const attempts = Number(publication.tentativas ?? 0) + 1;
  const organizationId = String(publication.organization_id ?? "");
  const { data: integration } = await db.from("social_integrations")
    .select("status,secret_ref,config_publica").eq("organization_id", organizationId)
    .eq("provider", "instagram").eq("status", "configurada").not("secret_ref", "is", null).maybeSingle();
  const { data: credential, error: credentialError } = integration
    ? await db.rpc("social_service_read_meta_token", { p_organization_id: organizationId })
    : { data: null, error: null };
  const credentialJson = credential && typeof credential === "object" ? credential as Json : {};
  const integrationConfig = integration?.config_publica && typeof integration.config_publica === "object"
    ? integration.config_publica as Json
    : {};
  const accessToken = safe(credentialJson.access_token, 4096);
  const igUserId = safe(integrationConfig.ig_user_id, 120);
  if (!integration || credentialError || !accessToken || !igUserId || integrationConfig.publishing_enabled !== true) {
    throw new ProviderError("A conexão Meta desta organização não está disponível.", "integration_disabled", false);
  }
  const context: MetaContext = { accessToken, igUserId, apiVersion, graphHost };
  const { data: version } = await db.from("social_piece_versions").select("id,piece_id,checksum,conteudo,output_manifest").eq("id", publication.piece_version_id).single();
  const { data: piece } = version ? await db.from("social_pieces").select("id,campaign_id,formato,current_version_id").eq("id", version.piece_id).single() : { data: null };
  const { data: campaign } = piece ? await db.from("social_campaigns").select("snapshot_atual_id,produto_alterado_em").eq("id", piece.campaign_id).single() : { data: null };
  const { data: approval } = version ? await db.from("social_approvals").select("id").eq("piece_version_id", version.id).eq("version_checksum", version.checksum).eq("decisao", "aprovada").limit(1).maybeSingle() : { data: null };
  if (!version || !piece || !campaign || piece.current_version_id !== version.id || campaign.produto_alterado_em || !approval) throw new ProviderError("A aprovação humana não é mais válida.", "approval_invalid", false);
  const manifest = version.output_manifest as Json; const files = Array.isArray(manifest?.files) ? manifest.files as Json[] : [];
  if (!files.length) throw new ProviderError("Arquivo final compatível não encontrado.", "final_file_missing", false);
  const signed: string[] = [];
  for (const file of files) {
    const expectedMime = piece.formato === "reel" ? "video/mp4" : "image/jpeg";
    if (file.mime_type !== expectedMime) throw new ProviderError(`A mídia final precisa ser ${expectedMime}.`, "invalid_media_type", false);
    const { data, error } = await db.storage.from(String(file.storage_bucket ?? "social-studio")).createSignedUrl(String(file.storage_path ?? ""), 3600);
    if (error || !data?.signedUrl) throw new ProviderError("Não foi possível assinar a mídia.", "signed_url_failed", true);
    signed.push(data.signedUrl);
  }
  const caption = safe((version.conteudo as Json)?.legenda, 2200);
  await db.from("social_publications").update({ status: "criando_container", tentativas: attempts, erro_codigo: null, erro_mensagem: null }).eq("id", id).in("status", ["pendente", "falhou"]);
  if (piece.formato === "story") {
    const containers: string[] = [];
    for (const imageUrl of signed) {
      const created = await graph(context, `${context.igUserId}/media`, { image_url: imageUrl, media_type: "STORIES" });
      if (!created.id) throw new ProviderError("Container de Story sem ID.", "container_missing", true);
      containers.push(String(created.id));
    }
    await db.from("social_publications").update({ remote_container_id: containers[0], status: "aguardando_confirmacao", resposta_sanitizada: { graph_host: context.graphHost, api_version: context.apiVersion, format: piece.formato, containers } }).eq("id", id);
    const mediaIds: string[] = [];
    for (const container of containers) {
      try { mediaIds.push((await publishContainer(context, container)).mediaId); }
      catch (error) {
        if (mediaIds.length) throw new ProviderError("Uma parte da sequência de Stories foi publicada; reconciliação manual obrigatória.", "partial_story_publish", false, true);
        throw error;
      }
    }
    await db.from("social_publications").update({ status: "publicado", remote_media_id: mediaIds[0], remote_media_ids: mediaIds, confirmado_em: new Date().toISOString(), resposta_sanitizada: { confirmed_ids: mediaIds }, erro_codigo: null, erro_mensagem: null }).eq("id", id);
    await db.from("social_schedules").update({ status: "publicado" }).eq("id", publication.schedule_id);
    await db.from("social_pieces").update({ status: "publicada" }).eq("id", piece.id).eq("current_version_id", version.id);
    return { id, status: "published", remoteMediaId: mediaIds[0], remoteMediaIds: mediaIds };
  }
  let containerId = String(publication.remote_container_id ?? "");
  if (!containerId) {
    if (piece.formato === "carousel") {
      const children: string[] = [];
      for (const imageUrl of signed) { const child = await graph(context, `${context.igUserId}/media`, { image_url: imageUrl, is_carousel_item: "true" }); if (!child.id) throw new ProviderError("Container filho sem ID.", "container_missing", true); children.push(String(child.id)); }
      const parent = await graph(context, `${context.igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }); containerId = String(parent.id ?? "");
    } else if (piece.formato === "reel") {
      const created = await graph(context, `${context.igUserId}/media`, { video_url: signed[0], media_type: "REELS", caption });
      containerId = String(created.id ?? "");
    } else { const created = await graph(context, `${context.igUserId}/media`, { image_url: signed[0], caption }); containerId = String(created.id ?? ""); }
    if (!containerId) throw new ProviderError("A Meta não devolveu o container.", "container_missing", true);
    await db.from("social_publications").update({ remote_container_id: containerId, status: "aguardando_confirmacao", resposta_sanitizada: { graph_host: context.graphHost, api_version: context.apiVersion, format: piece.formato } }).eq("id", id);
  }
  const result = await publishContainer(context, containerId);
  await db.from("social_publications").update({ status: "publicado", remote_media_id: result.mediaId, remote_media_ids: [result.mediaId], confirmado_em: new Date().toISOString(), resposta_sanitizada: result.confirmation, erro_codigo: null, erro_mensagem: null }).eq("id", id);
  await db.from("social_schedules").update({ status: "publicado" }).eq("id", publication.schedule_id);
  await db.from("social_pieces").update({ status: "publicada" }).eq("id", piece.id).eq("current_version_id", version.id);
  return { id, status: "published", remoteMediaId: result.mediaId };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405);
  if (!sameSecret(request.headers.get("x-studio-worker-secret"), workerSecret)) return response({ ok: false, error: "unauthorized" }, 401);
  if (!url || !serviceKey || !apiVersion || !/^v\d{1,2}\.\d{1,2}$/.test(apiVersion)) return response({ ok: false, error: "provider_not_configured" }, 503);
  const body = await request.json().catch(() => ({})) as Json;
  let query = db.from("social_publications").select("*").in("status", ["pendente", "falhou"]).lt("tentativas", 5).or(`proxima_tentativa_em.is.null,proxima_tentativa_em.lte.${new Date().toISOString()}`).order("criado_em").limit(5);
  if (body.publication_id) query = query.eq("id", String(body.publication_id));
  const { data: rows, error } = await query;
  if (error) return response({ ok: false, error: "queue_unavailable" }, 503);
  const results: Json[] = [];
  for (const publication of rows ?? []) {
    try { results.push(await processPublication(publication as Json)); }
    catch (reason) {
      const failure = reason instanceof ProviderError ? reason : new ProviderError("Falha inesperada no worker.", "worker_failed", true);
      const attempts = Number(publication.tentativas ?? 0) + 1;
      const delaySeconds = Math.min(900, 15 * 2 ** Math.max(0, attempts - 1));
      await db.from("social_publications").update({ status: "falhou", tentativas: attempts, erro_codigo: failure.code, erro_mensagem: safe(failure.message), proxima_tentativa_em: failure.transient && !failure.ambiguous && attempts < 5 ? new Date(Date.now() + delaySeconds * 1000).toISOString() : null, resposta_sanitizada: { transient: failure.transient, ambiguous: failure.ambiguous } }).eq("id", publication.id);
      await db.from("social_schedules").update({ status: "falhou" }).eq("id", publication.schedule_id);
      results.push({ id: publication.id, status: "failed", code: failure.code, retry: failure.transient && !failure.ambiguous && attempts < 5 });
    }
  }
  return response({ ok: true, processed: results.length, results });
});
