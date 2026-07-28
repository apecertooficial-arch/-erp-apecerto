// ncrm-ingest — Edge Function (Deno) do backend de ENTRADA do CRM Nova Era.
// -----------------------------------------------------------------------------
// Roda com SERVICE_ROLE (privilégio seguro já usado para operar WhatsApp/automação).
// NUNCA é chamada pelo frontend. É o ponto onde o motor/automação e o webhook de
// inbound do WhatsApp informam eventos REAIS; aqui garantimos o estado ncrm_ e
// registramos a automação/resposta de forma idempotente pelo ID real da mensagem.
//
// Segurança:
//  - Exige o header X-NCRM-Ingest-Secret === env NCRM_INGEST_SECRET (segredo do webhook).
//  - Usa SUPABASE_SERVICE_ROLE_KEY (só no servidor). Não muda distribuição/WhatsApp.
//  - Idempotência: as RPCs deduplicam pelo message_id; retries do webhook não duplicam.
//
// Deploy (quando autorizado): `supabase functions deploy ncrm-ingest` + secrets
//   NCRM_INGEST_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// @ts-nocheck  (ambiente Deno; tipos resolvidos no deploy)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { planejarIngest, interpretarRetornoRpc } from "./logic.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const segredo = Deno.env.get("NCRM_INGEST_SECRET");
  if (!segredo || req.headers.get("x-ncrm-ingest-secret") !== segredo) {
    return new Response(JSON.stringify({ ok: false, erro: "nao_autorizado" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  let evento: Record<string, unknown>;
  try { evento = await req.json(); } catch { return new Response(JSON.stringify({ ok: false, erro: "json_invalido" }), { status: 400 }); }

  const plano = planejarIngest(evento as any, new Date().toISOString());
  if (!plano.ok) return new Response(JSON.stringify(plano), { status: 422, headers: { "content-type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc(plano.rpc, plano.args);
  if (error) return new Response(JSON.stringify({ ok: false, erro: error.message }), { status: 502, headers: { "content-type": "application/json" } });

  const out = interpretarRetornoRpc(data);
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json" } });
});
