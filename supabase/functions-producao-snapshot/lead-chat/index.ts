// lead-chat v17 — abre do BANCO (instantâneo). NÃO espelha mais histórico antigo ao navegar
// (isso disparava notificação falsa de "cliente respondeu" para mensagens velhas). O histórico
// já vem do backfill + webhook em tempo real. dapi-hist ainda mostra histórico antigo do d-api,
// mas NÃO grava (evita broadcast de mensagem velha como se fosse nova).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (t) => String(t ?? "").replace(/\D/g, "");

let _admin = null;
function getAdmin() { if (!_admin) _admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")); return _admin; }
const DAPI_BASE = () => Deno.env.get("DAPI_BASE_URL") ?? "https://api.d-api.cloud";

async function dapiGet(path, params, apikey) {
  const url = new URL(DAPI_BASE() + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const r = await fetch(url.toString(), { headers: { Authorization: apikey, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
    return { status: r.status, body: b };
  } catch (e) { return { status: 0, body: String(e) }; }
}
const mapTipo = (t) => ({ text: "texto", chat: "texto", image: "imagem", video: "video", audio: "audio", ptt: "audio", voice: "audio", document: "documento", sticker: "figurinha", reaction: "reacao" }[String(t || "").toLowerCase()] || "texto");
const toIso = (ts) => { if (ts == null) return null; let n = Number(ts); if (!isNaN(n) && n > 0) { if (n < 1e12) n *= 1000; try { return new Date(n).toISOString(); } catch { return null; } } try { return new Date(ts).toISOString(); } catch { return null; } };
const mapMsg = (m) => ({ id: m.message_id ?? String(m.id ?? ""), wa_message_id: m.message_id ?? null, direcao: m.from_me ? "enviada" : "recebida", tipo: mapTipo(m.type), conteudo: m.content ?? m.caption ?? "", media_url: m.s3_url ?? null, status: m.status ?? m.ack ?? null, criado_em: toIso(m.timestamp), respondendo_wa_id: null });

async function credOf(big) {
  const admin = getAdmin();
  const { data: inst } = await admin.from("instancias").select("instancia_dapi").eq("id", big).maybeSingle();
  const { data: cred } = await admin.from("instancias_credenciais").select("apikey").eq("instancia_id", big).maybeSingle();
  return { dapi: inst?.instancia_dapi ?? null, apikey: cred?.apikey ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const admin = getAdmin();
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing_auth" }, 401);
    const { data: auth } = await admin.auth.getUser(jwt);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "invalid_jwt" }, 401);
    const { data: u } = await admin.from("usuarios").select("role").eq("id", uid).maybeSingle();
    const isAdmin = u?.role === "admin" || u?.role === "executivo";
    let corretorIds = [];
    if (!isAdmin) { const { data: cs } = await admin.from("corretores").select("id").eq("usuario_id", uid); corretorIds = (cs ?? []).map((c) => c.id); }

    let body = {}; try { body = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }
    const action = body.action ?? "list";

    if (action === "dapi-hist") {
      const to = digits(body.telefone); const big = Number(body.instancia_id);
      const page = Math.max(1, Number(body.page) || 1);
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
      if (!to || !big) return json({ mensagens: [] });
      if (!isAdmin) { const { data: inst } = await admin.from("instancias").select("corretor_id").eq("id", big).maybeSingle(); if (!inst || !corretorIds.includes(inst.corretor_id)) return json({ error: "forbidden" }, 403); }
      const { dapi, apikey } = await credOf(big);
      if (!dapi || !apikey) return json({ mensagens: [], erro: "sem_credencial" });
      const chats = await dapiGet("/api/v1/chats/", { sessionId: dapi, search: to, limit: "1" }, apikey);
      const chat = chats.status === 200 && chats.body?.data?.[0];
      if (!chat) return json({ mensagens: [], semChat: true });
      const msgs = await dapiGet(`/api/v1/chats/${chat.id}/messages`, { sessionId: dapi, page: String(page), limit: String(limit), sort_order: "desc" }, apikey);
      if (msgs.status !== 200 || !Array.isArray(msgs.body?.data)) return json({ mensagens: [], erro: "dapi_msgs", detail: msgs.body });
      const mensagens = msgs.body.data.map(mapMsg).reverse();
      // v17: apenas exibe (NÃO grava) — evita disparar notificação de "cliente respondeu" para mensagem antiga.
      return json({ mensagens, page, total: msgs.body.pagination?.total ?? null, hasMore: mensagens.length >= limit });
    }

    if (action === "messages") {
      let convIds = Array.isArray(body.conversaIds) ? body.conversaIds : (body.conversaId ? [body.conversaId] : []);
      if (!convIds.length) return json({ mensagens: [] });
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
      let q = admin.from("wa_mensagens").select("id,wa_message_id,conversa_id,direcao,tipo,conteudo,media_url,criado_em,enviado_em,respondendo_wa_id,status,status_detalhe").in("conversa_id", convIds).order("enviado_em", { ascending: false, nullsFirst: false }).limit(limit);
      if (body.before) q = q.lt("enviado_em", body.before);
      const { data, error } = await q;
      if (error) return json({ error: "db", detail: error.message }, 500);
      const mensagens = (data ?? []).map((m) => ({ ...m, criado_em: m.enviado_em ?? m.criado_em })).reverse();
      return json({ mensagens });
    }

    if (action === "media") {
      const to = digits(body.telefone); const big = Number(body.instancia_id);
      if (!to || !big) return json({ map: {} });
      const { dapi, apikey } = await credOf(big);
      if (!dapi || !apikey) return json({ map: {} });
      const chats = await dapiGet("/api/v1/chats/", { sessionId: dapi, search: to, limit: "1" }, apikey);
      const chatId = chats.status === 200 && chats.body?.data?.[0]?.id;
      if (!chatId) return json({ map: {} });
      const msgs = await dapiGet(`/api/v1/chats/${chatId}/messages`, { sessionId: dapi, page: "1", limit: "200", sort_order: "desc" }, apikey);
      const map = {};
      if (msgs.status === 200 && Array.isArray(msgs.body?.data)) for (const m of msgs.body.data) { const id = m.message_id ?? String(m.id ?? ""); if (id && m.s3_url) map[id] = m.s3_url; }
      return json({ map });
    }

    const to = digits(body.telefone);
    if (to.length < 8) return json({ error: "telefone_invalido" }, 400);
    const ownerId = Number(body.corretorId) || null;
    const alvo = to.slice(-8);
    let instQ = admin.from("instancias").select("id,nome,instancia_dapi,conectada,corretor_id,numero_conectado").order("nome");
    if (!isAdmin) instQ = instQ.in("corretor_id", corretorIds.length ? corretorIds : [-1]);
    let waQ = admin.from("wa_instancias").select("id,session_id,rotulo,corretor_id");
    if (!isAdmin) waQ = waQ.in("corretor_id", corretorIds.length ? corretorIds : [-1]);
    const [instRes, waRes, corrRes] = await Promise.all([instQ, waQ, admin.from("corretores").select("id,nome")]);
    const insts = instRes.data; const waInsts = waRes.data; const corr = corrRes.data;
    const bigBySession = {}; (insts ?? []).forEach((i) => { bigBySession[i.instancia_dapi] = i; });
    const corName = {}; (corr ?? []).forEach((c) => corName[c.id] = c.nome);
    const dapiById = {}; (insts ?? []).forEach((i) => dapiById[i.id] = i.instancia_dapi);
    const uuidInfo = {};
    (waInsts ?? []).forEach((w) => { const big = bigBySession[w.session_id]; uuidInfo[w.id] = { sendBig: big?.id ?? null, corretorId: big?.corretor_id ?? w.corretor_id ?? null, nome: big?.nome ?? w.rotulo ?? w.session_id, conectada: big?.conectada ?? null, corretor: corName[w.corretor_id] ?? "", numero: big?.numero_conectado ?? null }; });
    const { data: contatos } = await admin.from("wa_contatos").select("id").ilike("telefone", "%" + alvo);
    const cids = (contatos ?? []).map((c) => c.id);
    const convByUuid = {};
    if (cids.length) {
      const { data: cv } = await admin.from("wa_conversas").select("id,instancia_id,ultima_msg_em").in("contato_id", cids);
      const convIds = (cv ?? []).map((c) => c.id);
      const cnt = {};
      if (convIds.length) { const { data: mm } = await admin.from("wa_mensagens").select("conversa_id").in("conversa_id", convIds).limit(5000); (mm ?? []).forEach((m) => cnt[m.conversa_id] = (cnt[m.conversa_id] || 0) + 1); }
      (cv ?? []).forEach((c) => { const uuid = c.instancia_id; if (!uuid) return; const e = convByUuid[uuid] || (convByUuid[uuid] = { conversaIds: [], msgs: 0, ultima: "" }); e.conversaIds.push(c.id); e.msgs += (cnt[c.id] || 0); if ((c.ultima_msg_em || "") > e.ultima) e.ultima = c.ultima_msg_em || ""; });
    }
    const byKey = {};
    const keyOf = (uuid) => { const info = uuidInfo[uuid] || {}; return info.sendBig != null ? ("big:" + info.sendBig) : ("wa:" + uuid); };
    (insts ?? []).forEach((i) => { byKey["big:" + i.id] = { key: "big:" + i.id, sendBig: i.id, corretorId: i.corretor_id, nome: i.nome, conectada: i.conectada, corretor: corName[i.corretor_id] ?? "", numero: i.numero_conectado ?? null, conversaIds: [], msgs: 0, ultima: "", dIn: 0, dTot: 0 }; });
    Object.keys(convByUuid).forEach((uuid) => { const info = uuidInfo[uuid]; const c = convByUuid[uuid]; const key = keyOf(uuid);
      let e = byKey[key]; if (!e) { e = byKey[key] = { key, sendBig: info?.sendBig ?? null, corretorId: info?.corretorId ?? null, nome: info?.nome ?? "Instância", conectada: info?.conectada ?? null, corretor: info?.corretor ?? "", numero: info?.numero ?? null, conversaIds: [], msgs: 0, ultima: "", dIn: 0, dTot: 0 }; }
      e.conversaIds.push(...c.conversaIds); e.msgs += c.msgs; if (c.ultima > e.ultima) e.ultima = c.ultima; });

    let entries = Object.values(byKey);
    const owned = entries.filter((e) => e.sendBig != null);
    entries.forEach((e) => {
      if (e.sendBig != null || !e.corretorId || !(e.conversaIds.length || e.msgs)) return;
      const dest = owned.filter((o) => o.corretorId === e.corretorId)
        .sort((a, b) => ((b.conectada ? 1 : 0) - (a.conectada ? 1 : 0)) || ((b.msgs || 0) - (a.msgs || 0)))[0];
      if (!dest) return;
      dest.conversaIds.push(...e.conversaIds); dest.msgs += (e.msgs || 0); if ((e.ultima || "") > (dest.ultima || "")) dest.ultima = e.ultima;
      e._drop = true;
    });
    entries = entries.filter((e) => !e._drop);

    const rank = (e) => (((e.msgs || 0) > 0) ? 2 : 0) + ((e.sendBig != null && e.conectada) ? 1 : 0);
    const instancias = entries.sort((a, b) =>
      (rank(b) - rank(a)) ||
      ((b.msgs || 0) - (a.msgs || 0)) ||
      String(a.nome).localeCompare(String(b.nome)));
    const winner = instancias[0] || null;

    let primeiraPagina = [];
    let primeiraHasMore = false;
    if (winner && Array.isArray(winner.conversaIds) && winner.conversaIds.length) {
      const { data: dbmsgs } = await admin.from("wa_mensagens")
        .select("id,wa_message_id,conversa_id,direcao,tipo,conteudo,media_url,criado_em,enviado_em,respondendo_wa_id,status,status_detalhe")
        .in("conversa_id", winner.conversaIds)
        .order("enviado_em", { ascending: false, nullsFirst: false })
        .limit(100);
      const arr = dbmsgs ?? [];
      primeiraPagina = arr.map((m) => ({ ...m, criado_em: m.enviado_em ?? m.criado_em })).reverse();
      primeiraHasMore = arr.length >= 100;
    }
    return json({ instancias, isAdmin, melhorKey: winner?.key ?? null, primeiraPagina, primeiraHasMore });
  } catch (e) {
    return json({ error: "internal", detail: String(e && e.message || e) }, 500);
  }
});
