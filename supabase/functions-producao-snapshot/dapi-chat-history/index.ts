// dapi-chat-history v5 — lazy-load por TELEFONE + cache leve de ponteiro + mídia robusta.
// NÃO espelha mensagens no banco. Cache: telefone->chatId+instancia (public.dapi_chat_cache).
// Contrato d-api: GET /api/v1/chats/?search=<digitos> -> id -> GET /api/v1/chats/<id>/messages.
// Mídia do endpoint /messages vem em attachments[0].url (fallbacks defensivos p/ outros formatos).

import { createClient } from "jsr:@supabase/supabase-js@2";

const DAPI_BASE_URL = Deno.env.get("DAPI_BASE_URL") ?? "https://api.d-api.cloud";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (t: string) => (t ?? "").replace(/\D/g, "");

async function dapiGet(path: string, params: Record<string, string>, apikey: string) {
  const url = new URL(`${DAPI_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), {
    headers: { Authorization: apikey, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

// resolve url + tipo de mídia cobrindo os formatos possíveis do /messages
function mapMensagem(m: any) {
  const atts = Array.isArray(m.attachments) ? m.attachments : (m.attachment ? [m.attachment] : []);
  const att = atts[0] ?? null;
  const media_url =
    m.s3_url ?? m.media_url ?? m.mediaUrl ?? m.url ??
    att?.url ?? att?.s3_url ?? att?.media_url ?? m.media?.url ?? null;
  const attType = String(att?.type ?? "").toLowerCase();
  let tipo = String(m.type ?? "").toLowerCase();
  if (!tipo || tipo === "media") {
    tipo = attType === "image" ? "image"
      : attType === "video" ? "video"
      : attType === "audio" ? "audio"
      : attType === "document" ? "document"
      : attType === "sticker" ? "sticker"
      : (media_url ? "media" : "text");
  }
  return {
    id: m.message_id ?? String(m.id ?? ""),
    direcao: (m.from_me ?? m.fromMe) ? "out" : "in",
    tipo,
    texto: m.content ?? m.body ?? m.message ?? "",
    media_url,
    mime: att?.mimeType ?? att?.mimetype ?? m.mimetype ?? null,
    filename: att?.fileName ?? att?.filename ?? null,
    status: m.status ?? null,
    timestamp: m.timestamp ?? m.createdAt ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "missing_auth" }, 401);

    const { telefone, corretorNome, page = 1, limit = 30, debug = false } = await req.json().catch(() => ({}));
    if (!telefone) return json({ error: "telefone_obrigatorio" }, 400);
    const digits = onlyDigits(telefone);
    if (digits.length < 8) return json({ error: "telefone_invalido" }, 400);
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "invalid_jwt" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: usuario } = await admin.from("usuarios").select("role").eq("id", uid).maybeSingle();
    const isAdmin = usuario?.role === "admin" || usuario?.role === "administrador";

    let instanciaIds: number[] = [];
    if (isAdmin) {
      if (corretorNome) {
        const first = String(corretorNome).trim().split(/\s+/)[0];
        const { data: cor } = await admin.from("corretores").select("id").ilike("nome", first + "%").limit(1).maybeSingle();
        if (cor) {
          const { data: cis } = await admin.from("corretor_instancias").select("instancia_id").eq("corretor_id", cor.id);
          instanciaIds = (cis ?? []).map((x: any) => x.instancia_id);
        }
      }
      if (instanciaIds.length === 0) {
        const { data: all } = await admin.from("instancias").select("id").eq("ativa", true);
        instanciaIds = (all ?? []).map((x: any) => x.id);
      }
    } else {
      const { data: cor } = await admin.from("corretores").select("id").eq("usuario_id", uid).maybeSingle();
      if (!cor) return json({ error: "usuario_sem_corretor" }, 403);
      const { data: cis } = await admin.from("corretor_instancias").select("instancia_id").eq("corretor_id", cor.id);
      instanciaIds = (cis ?? []).map((x: any) => x.instancia_id);
    }
    if (instanciaIds.length === 0) return json({ error: "sem_instancia" }, 422);

    async function instMeta(iid: number): Promise<{ session: string; apikey: string } | null> {
      const { data: inst } = await admin.from("instancias").select("instancia_dapi").eq("id", iid).maybeSingle();
      const { data: cred } = await admin.from("instancias_credenciais").select("apikey").eq("instancia_id", iid).maybeSingle();
      if (!inst?.instancia_dapi || !cred?.apikey) return null;
      return { session: inst.instancia_dapi, apikey: cred.apikey };
    }

    type Found = { sessionId: string; apikey: string; chatId: string; instanciaId: number; contatoNome: string | null };

    async function scan(): Promise<Found | null> {
      for (const iid of instanciaIds) {
        const meta = await instMeta(iid);
        if (!meta) continue;
        const chatsRes = await dapiGet("/api/v1/chats/", { sessionId: meta.session, search: digits, limit: "1" }, meta.apikey);
        if (chatsRes.status === 200 && chatsRes.body?.success && chatsRes.body.data?.[0]) {
          const chat = chatsRes.body.data[0];
          const nome = chat.chatName ?? chat.contact?.pushName ?? null;
          await admin.from("dapi_chat_cache").upsert({
            telefone: digits, chat_id: String(chat.id), instancia_id: iid,
            session_id: meta.session, contato_nome: nome, atualizado_em: new Date().toISOString(),
          });
          return { sessionId: meta.session, apikey: meta.apikey, chatId: String(chat.id), instanciaId: iid, contatoNome: nome };
        }
      }
      return null;
    }

    let found: Found | null = null;
    let fromCache = false;
    const { data: cache } = await admin.from("dapi_chat_cache").select("*").eq("telefone", digits).maybeSingle();
    if (cache && instanciaIds.includes(cache.instancia_id)) {
      const meta = await instMeta(cache.instancia_id);
      if (meta) {
        found = { sessionId: meta.session, apikey: meta.apikey, chatId: cache.chat_id, instanciaId: cache.instancia_id, contatoNome: cache.contato_nome };
        fromCache = true;
      }
    }
    if (!found) found = await scan();
    if (!found) return json({ chatId: null, page: safePage, limit: safeLimit, total: 0, count: 0, mensagens: [], cache: false });

    let msgRes = await dapiGet(
      `/api/v1/chats/${found.chatId}/messages`,
      { sessionId: found.sessionId, page: String(safePage), limit: String(safeLimit), sort_order: "desc" },
      found.apikey,
    );

    if (fromCache && (msgRes.status !== 200 || !msgRes.body?.success)) {
      await admin.from("dapi_chat_cache").delete().eq("telefone", digits);
      fromCache = false;
      found = await scan();
      if (!found) return json({ chatId: null, page: safePage, limit: safeLimit, total: 0, count: 0, mensagens: [], cache: false });
      msgRes = await dapiGet(
        `/api/v1/chats/${found.chatId}/messages`,
        { sessionId: found.sessionId, page: String(safePage), limit: String(safeLimit), sort_order: "desc" },
        found.apikey,
      );
    }

    if (msgRes.status !== 200 || !msgRes.body?.success) {
      return json({ error: "dapi_messages_error", status: msgRes.status, detail: msgRes.body }, 502);
    }

    const rawList = msgRes.body.data ?? [];
    if (debug && rawList[0]) {
      console.log("dapi-chat-history shape keys:", Object.keys(rawList[0]));
      const a0 = Array.isArray(rawList[0].attachments) ? rawList[0].attachments[0] : null;
      if (a0) console.log("attachment keys:", Object.keys(a0), "url?", !!a0.url);
    }
    const mensagens = rawList.map(mapMensagem);
    const comMidia = mensagens.filter((x: any) => x.media_url).length;
    console.log(`dapi-chat-history ok tel=${digits} chat=${found.chatId} count=${mensagens.length} midia=${comMidia} cache=${fromCache}`);

    return json({
      chatId: found.chatId,
      sessionId: found.sessionId,
      instancia: found.sessionId,
      contatoNome: found.contatoNome,
      page: safePage,
      limit: safeLimit,
      total: msgRes.body.pagination?.total ?? mensagens.length,
      count: mensagens.length,
      cache: fromCache,
      mensagens,
    });
  } catch (e) {
    return json({ error: "internal", detail: String(e) }, 500);
  }
});
