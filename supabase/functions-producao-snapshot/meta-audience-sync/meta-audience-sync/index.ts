import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildHashedBatches,
  isAcceptedReceipt,
  sha256Hex,
} from "../_shared/meta-audience.mjs";

const GRAPH = "https://graph.facebook.com/v25.0";
const AUDIENCE_ID = Deno.env.get("META_VISITA_REALIZADA_AUDIENCE_ID") ?? "120253580042080616";
const TOKEN = Deno.env.get("META_ADS_TOKEN") ?? Deno.env.get("META_CAPI_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

async function sameSecret(received: string | null, expected: string) {
  if (!received || !expected) return false;
  const [left, right] = await Promise.all([sha256Hex(received), sha256Hex(expected)]);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function safeMetaError(payload: any) {
  return String(payload?.error?.message ?? "Meta recusou a adição ao público")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 300);
}

async function audienceProbe() {
  const fields = "id,name,subtype,delivery_status,operation_status,approximate_count_lower_bound,approximate_count_upper_bound";
  const response = await fetch(`${GRAPH}/${AUDIENCE_ID}?fields=${fields}&access_token=${encodeURIComponent(TOKEN)}`);
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    id_ok: String(payload?.id ?? "") === AUDIENCE_ID,
    subtype: payload?.subtype ?? null,
    delivery_status: payload?.delivery_status ?? null,
    operation_status: payload?.operation_status ?? null,
    approximate_count_lower_bound: payload?.approximate_count_lower_bound ?? null,
    approximate_count_upper_bound: payload?.approximate_count_upper_bound ?? null,
    error: response.ok ? null : safeMetaError(payload),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!(await sameSecret(request.headers.get("x-cron-secret"), CRON_SECRET))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!TOKEN) return json({ ok: false, error: "meta_token_missing" }, 503);

  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (dryRun) {
    const probe = await audienceProbe();
    const { data: prepared, error: prepareError } = await supabase.rpc("meta_audience_sync_prepare", {
      p_audience_id: AUDIENCE_ID,
    });
    return json({
      ok: probe.ok,
      dry_run: true,
      audience: probe,
      queue: prepareError ? null : prepared,
      queue_status: prepareError ? "not_installed" : "ready",
    }, probe.ok ? 200 : 502);
  }

  const { error: prepareError } = await supabase.rpc("meta_audience_sync_prepare", {
    p_audience_id: AUDIENCE_ID,
  });
  if (prepareError) return json({ ok: false, error: "prepare_failed" }, 503);

  const { data: claimed, error: claimError } = await supabase.rpc("meta_audience_sync_claim", {
    p_audience_id: AUDIENCE_ID,
    p_limit: 500,
  });
  if (claimError) return json({ ok: false, error: "claim_failed" }, 503);
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return json({ ok: true, audience_id: AUDIENCE_ID, claimed: 0, delivered: 0, failed: 0 });
  }

  const batchId = String(claimed[0].batch_id);
  const batches = await buildHashedBatches(claimed);
  let delivered = 0;
  let failed = 0;
  const receipts: Array<Record<string, unknown>> = [];

  for (const batch of batches) {
    const leadIds = batch.rows.map((row: any) => row.lead_id);
    const metaResponse = await fetch(`${GRAPH}/${AUDIENCE_ID}/users?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        payload: JSON.stringify({ schema: batch.schema, data: batch.rows.map((row: any) => row.values) }),
      }),
    });
    const output = await metaResponse.json().catch(() => ({}));
    const numReceived = Number.isInteger(Number(output?.num_received))
      ? Number(output.num_received)
      : null;
    const invalid = Number(output?.num_invalid_entries ?? 0) || 0;
    const expectedRows = leadIds.length;
    const metaAccepted = isAcceptedReceipt(metaResponse.ok, numReceived, invalid, expectedRows);
    const metaError = metaAccepted
      ? null
      : (metaResponse.ok ? "meta_receipt_mismatch" : safeMetaError(output));
    const { error: finishError } = await supabase.rpc("meta_audience_sync_finish", {
      p_audience_id: AUDIENCE_ID,
      p_batch_id: batchId,
      p_lead_ids: leadIds,
      p_ok: metaAccepted,
      p_response_status: metaResponse.status,
      p_session_id: output?.session_id ? String(output.session_id).slice(0, 120) : null,
      p_num_received: numReceived,
      p_error: metaError,
    });
    const ledgerRecorded = !finishError;
    const deliveredAndRecorded = metaAccepted && ledgerRecorded;
    const error = ledgerRecorded ? metaError : "receipt_not_recorded";
    if (deliveredAndRecorded) delivered += leadIds.length;
    else failed += leadIds.length;
    receipts.push({
      schema: batch.schema,
      rows: expectedRows,
      status: metaResponse.status,
      meta_accepted: metaAccepted,
      ledger_recorded: ledgerRecorded,
      num_received: numReceived,
      num_invalid_entries: invalid,
      session_id_present: Boolean(output?.session_id),
      error,
    });
  }

  return json({
    ok: failed === 0,
    audience_id: AUDIENCE_ID,
    claimed: claimed.length,
    delivered,
    failed,
    receipts,
  }, failed === 0 ? 200 : 502);
});
