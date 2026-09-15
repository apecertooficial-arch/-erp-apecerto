// backfill-historico — puxa o historico do d-api e PERSISTE no banco.
//
// Por que existe: dapi-chat-history mostra a conversa na tela em tempo real mas
// nao salva nada ("NAO espelha mensagens no banco", diz o proprio arquivo).
// O corretor ve a conversa inteira; a Sara, que le o banco, ve so o que chegou
// por webhook DEPOIS que o lead entrou.
//
// Escopo: cards ativos do Funil 2.0, e SOMENTE nas instancias do dono atual do
// card. O historico pertence a quem atende hoje.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAPI_BASE = Deno.env.get("DAPI_BASE_URL") ?? "https://api.d-api.cloud";
const SECRET = "<REDACTED-rotacionar>";
const admin = createClient(SUPABASE_URL, SERVICE);

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (t: unknown) => String(t ?? "").replace(/\D/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function variantes(d: string): string[] {
  const s = new Set<string>();
  if (!d) return [];
  s.add(d);
  if (d.length === 13 && d.startsWith("55")) s.add(d.slice(0, 4) + d.slice(5));
  else if (d.length === 12 && d.startsWith("55")) s.add(d.slice(0, 4) + "9" + d.slice(4));
  if (d.startsWith("55") && d.length >= 12) s.add(d.slice(2));
  return [...s].filter((x) => x.length >= 8);
}

const mapTipo = (t: unknown) => (({ text: "texto", chat: "texto", image: "imagem", video: "video", audio: "audio", ptt: "audio", voice: "audio", document: "documento", sticker: "figurinha", reaction: "reacao" } as Record<string, string>)[String(t || "").toLowerCase()] || "texto");
const toIso = (ts: unknown) => { if (ts == null) return null; let n = Number(ts); if (!isNaN(n) && n > 0) { if (n < 1e12) n *= 1000; try { return new Date(n).toISOString(); } catch { return null; } } try { return new Date(ts as any).toISOString(); } catch { return null; } };
const mapMsg = (m: any) => ({ wa_message_id: m.message_id ?? (m.id != null ? String(m.id) : null), direcao: (m.from_me ?? m.fromMe) ? "enviada" : "recebida", tipo: mapTipo(m.type), conteudo: m.content ?? m.caption ?? "", media_url: m.s3_url ?? m.media_url ?? null, status: m.status ?? m.ack ?? null, criado_em: toIso(m.timestamp ?? m.createdAt) });

async function dapiGet(path: string, params: Record<string, string>, apikey: string) {
  const url = new URL(DAPI_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const r = await fetch(url.toString(), { headers: { Authorization: apikey, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    const t = await r.text(); let b: any; try { b = JSON.parse(t); } catch { b = t; }
    return { status: r.status, body: b };
  } catch (e) { return { status: 0, body: String(e) }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  if (body?.secret !== SECRET) return json({ error: "forbidden" }, 403);
  const limit = Math.min(Math.max(Number(body?.limit) || 15, 1), 40);
  const soEste = body?.telefone ? onlyDigits(body.telefone) : null;

  let leads: any[] = [];
  if (soEste) {
    const { data: f } = await admin.from("f2_lead").select("telefone,corretor_id,origem_negocio_id")
      .filter("telefone", "like", `%${soEste.slice(-8)}%`).limit(1).maybeSingle();
    if (!f) return json({ ok: true, motivo: "card_nao_encontrado" });
    const { data: n } = await admin.from("negocios").select("lead_id").eq("id", f.origem_negocio_id).maybeSingle();
    leads = [{ r_lead_id: n?.lead_id ?? null, r_telefone: f.telefone, r_corretor_id: f.corretor_id }];
  } else {
    const { data, error: selErr } = await admin.rpc("wa_backfill_funil2", { p_limit: limit });
    if (selErr) return json({ error: "select", detail: selErr.message }, 500);
    leads = data ?? [];
  }
  if (!leads.length) return json({ ok: true, fim: true, processados: 0 });

  const instCache: Record<string, { session: string; apikey: string }[]> = {};
  async function instanciasDe(corretorId: number) {
    const k = String(corretorId);
    if (instCache[k]) return instCache[k];
    const { data: insts } = await admin.from("instancias").select("id,instancia_dapi").eq("corretor_id", corretorId).eq("ativa", true);
    const out: { session: string; apikey: string }[] = [];
    for (const i of (insts ?? [])) {
      const { data: cred } = await admin.from("instancias_credenciais").select("apikey").eq("instancia_id", i.id).maybeSingle();
      if (i.instancia_dapi && cred?.apikey) out.push({ session: i.instancia_dapi, apikey: cred.apikey });
    }
    instCache[k] = out; return out;
  }

  let comHist = 0, semHist = 0, totalSalvas = 0;
  const detalhes: any[] = [];

  for (const lead of leads) {
    const tel = onlyDigits(lead.r_telefone);
    const cands = variantes(tel);
    // SOMENTE as instancias do dono atual do card
    const insts = await instanciasDe(lead.r_corretor_id);
    let achou = false, salvas = 0, ondeSession: string | null = null;

    outer:
    for (const inst of insts) {
      for (const cand of cands) {
        const chats = await dapiGet("/api/v1/chats/", { sessionId: inst.session, search: cand, limit: "1" }, inst.apikey);
        const chat = chats.status === 200 && chats.body?.data?.[0];
        if (!chat) continue;
        const msgsRes = await dapiGet(`/api/v1/chats/${chat.id}/messages`, { sessionId: inst.session, page: "1", limit: "100", sort_order: "desc" }, inst.apikey);
        const arr = (msgsRes.status === 200 && Array.isArray(msgsRes.body?.data)) ? msgsRes.body.data : [];
        if (!arr.length) continue;
        const mensagens = arr.map(mapMsg).filter((m: any) => m.wa_message_id);
        if (!mensagens.length) continue;
        await admin.rpc("wa_espelhar_historico", { p_session: inst.session, p_telefone: tel, p_msgs: mensagens });
        achou = true; salvas = mensagens.length; ondeSession = inst.session;
        break outer;
      }
    }

    if (achou) { comHist++; totalSalvas += salvas; } else { semHist++; }
    detalhes.push({ lead_id: lead.r_lead_id, telefone: tel, achou, salvas, session: ondeSession });
    if (lead.r_lead_id) {
      await admin.from("wa_backfill_log").upsert(
        { lead_id: lead.r_lead_id, tentado_em: new Date().toISOString(), achou, salvas, detalhe: ondeSession },
        { onConflict: "lead_id" });
    }
    await sleep(120);
  }

  return json({ ok: true, processados: leads.length, com_historico: comHist, sem_historico: semHist, msgs_salvas: totalSalvas, detalhes });
});
