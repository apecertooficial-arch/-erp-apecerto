// dapi-qr — conexão de instância por QR code pelo próprio corretor.
// actions: 'list' (instâncias do corretor), 'qr' (QR + status), 'restart' (gera QR novo).
// Ao detectar 'connected': marca conectada, configura o webhook e registra.

import { createClient } from "jsr:@supabase/supabase-js@2";

const DAPI = Deno.env.get("DAPI_BASE_URL") ?? "https://api.d-api.cloud";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/dapi-webhook?s=<REDACTED-rotacionar>`;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const enc = (s: string) => s.replace(/ /g, "%20").replace(/\|/g, "%7C");

async function dapi(method: string, path: string, apikey: string, body?: unknown) {
  const r = await fetch(`${DAPI}${path}`, {
    method,
    headers: { Authorization: apikey, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const t = await r.text(); let b: any; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "missing_auth" }, 401);
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
    const { data: auth } = await userClient.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "invalid_jwt" }, 401);

    const { data: usuario } = await admin.from("usuarios").select("role").eq("id", uid).maybeSingle();
    const isAdmin = usuario?.role === "admin" || usuario?.role === "administrador" || usuario?.role === "executivo";
    const { data: cor } = await admin.from("corretores").select("id, nome").eq("usuario_id", uid).maybeSingle();
    const corretorId = cor?.id ?? null;

    const { action = "list", instanciaId } = await req.json().catch(() => ({}));

    // instâncias visíveis
    let q = admin.from("instancias").select("id, nome, instancia_dapi, conectada, status_dapi, corretor_id, numero_conectado").order("nome");
    if (!isAdmin) { if (!corretorId) return json({ error: "usuario_sem_corretor" }, 403); q = q.eq("corretor_id", corretorId); }
    const { data: insts } = await q;

    if (action === "list") return json({ isAdmin, corretorId, instancias: insts ?? [] });

    // resolve instância alvo + apikey
    const inst = (insts ?? []).find((x: any) => x.id === instanciaId);
    if (!inst) return json({ error: "instancia_nao_encontrada_ou_sem_acesso" }, 404);
    const { data: credRow } = await admin.from("instancias_credenciais").select("apikey").eq("instancia_id", inst.id).maybeSingle();
    const apikey = credRow?.apikey;
    if (!apikey) return json({ error: "instancia_sem_apikey", detalhe: "Cadastre a apikey desta instância para conectar." }, 422);
    const sess = enc(inst.instancia_dapi);

    if (action === "restart") { await dapi("POST", `/api/v1/sessions/${sess}/restart`, apikey, {}); }

    // pega QR + status
    const qr = await dapi("GET", `/api/v1/sessions/${sess}/qr`, apikey);
    const status = qr.body?.status ?? "desconhecido";
    const qrImg = qr.body?.qrCodeImage ?? null;

    // ao conectar: marca, configura webhook, garante registro
    if (status === "connected") {
      await admin.from("instancias").update({ conectada: true, status_dapi: "connected", conectada_em: new Date().toISOString() }).eq("id", inst.id);
      await dapi("POST", `/api/v1/sessions/${sess}/webhook`, apikey, { webhookUrl: WEBHOOK_URL });
    } else {
      await admin.from("instancias").update({ status_dapi: status }).eq("id", inst.id);
    }

    return json({ instanciaId: inst.id, nome: inst.nome, status, qrCodeImage: status === "connected" ? null : qrImg, conectada: status === "connected" });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});
