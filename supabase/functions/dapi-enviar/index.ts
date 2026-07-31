// dapi-enviar — envio real (texto/audio/imagem/documento/video) pela instancia escolhida.
//
// v13 (IDOR): a v12 fechou o acesso anonimo, mas um usuario autenticado ainda podia
// mandar instancia_id de outro corretor no body. Agora, quando quem chama e uma
// PESSOA, a instancia e resolvida no servidor por ncrm_resolver_envio_autorizado a
// partir de quem o usuario realmente e. O que vier no body e ignorado: corretor usa
// a propria instancia; admin, diretor e gerente respondem pela operacao.
//
// v12 (SEGURANCA): ate a v11 esta funcao era um endpoint PUBLICO de envio de WhatsApp.
// Qualquer POST na internet enviava mensagem por qualquer instancia da empresa.
// Duas identidades passam a ser aceitas:
//   1) MAQUINA — header x-envio-interno com o token de servico (Vault).
//   2) PESSOA  — Authorization: Bearer <JWT de usuario real>. A anon key, que esta em
//                texto puro nos HTML legados publicos, NAO serve: nao tem usuario.
//
// verify_jwt continua false porque o modo maquina nao usa JWT. A porta esta no codigo.
// A autoridade do piloto e consultada sempre: nem token interno nem service_role
// atravessam a abordagem humana.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAPI = "https://api.d-api.cloud/api/v1/messages/send/";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (t: unknown) => String(t ?? "").replace(/\D/g, "");

function normalizarBR(d: string): string {
  return (d.length === 10 || d.length === 11) ? "55" + d : d;
}

function aplicarVars(txt: string, corretorNome: string | null): string {
  if (!txt) return txt;
  const nome = (corretorNome ?? "").trim();
  const primeiro = nome.split(/\s+/)[0] ?? "";
  return txt
    .replaceAll("{corretor_primeiro_nome}", primeiro)
    .replaceAll("{corretor_nome}", nome)
    .replaceAll("{primeiro_nome_corretor}", primeiro);
}

function brVariants(to: string): string[] {
  if (/^55\d{11}$/.test(to) && to[4] === "9") return [to, to.slice(0, 4) + to.slice(5)];
  if (/^55\d{10}$/.test(to)) return [to, to.slice(0, 4) + "9" + to.slice(4)];
  return [to];
}

async function instByCorretor(cid: number) {
  const { data: rows } = await admin.from("instancias").select("id, instancia_dapi, status_dapi, conectada, instancias_credenciais(apikey)").eq("corretor_id", cid);
  const ok = (rows ?? []).find((r: any) => (r.conectada || r.status_dapi === "connected") && r.instancias_credenciais?.apikey);
  return ok ? { sess: ok.instancia_dapi, key: ok.instancias_credenciais.apikey, id: ok.id } : null;
}

async function credenciaisDaInstancia(instId: number) {
  const { data: i } = await admin.from("instancias").select("id, instancia_dapi").eq("id", instId).maybeSingle();
  const { data: c } = await admin.from("instancias_credenciais").select("apikey").eq("instancia_id", instId).maybeSingle();
  return i && c ? { sess: i.instancia_dapi as string, key: c.apikey as string, id: i.id as number } : null;
}

async function registrar(sess: string, to: string, m: { waId: string | null; status: string; detalhe: string | null; tipoCanon: string; conteudo: string | null; mediaUrl: string | null }) {
  try {
    let contatoId: any = null, convId: any = null, instUuid: any = null;
    const { data: wi } = await admin.from("wa_instancias").select("id").eq("session_id", sess).maybeSingle();
    instUuid = wi?.id ?? null;
    const { data: ct } = await admin.from("wa_contatos").select("id").eq("telefone", to).maybeSingle();
    if (ct) contatoId = ct.id; else { const { data: nc } = await admin.from("wa_contatos").insert({ telefone: to }).select("id").maybeSingle(); contatoId = nc?.id ?? null; }
    if (contatoId) {
      const { data: cv } = await admin.from("wa_conversas").select("id").eq("contato_id", contatoId).maybeSingle();
      if (cv) convId = cv.id; else { const { data: nv } = await admin.from("wa_conversas").insert({ contato_id: contatoId, instancia_id: instUuid, origem: "crm", ultima_msg_em: new Date().toISOString() }).select("id").maybeSingle(); convId = nv?.id ?? null; }
    }
    await admin.from("wa_mensagens").insert({ wa_message_id: m.waId, conversa_id: convId, instancia_id: instUuid, direcao: "enviada", tipo: m.tipoCanon, conteudo: m.conteudo, media_url: m.mediaUrl, enviado_em: new Date().toISOString(), status: m.status, status_detalhe: m.detalhe, status_em: new Date().toISOString(), raw: { via: "crm" } });
  } catch (_) {}
}

function motivoErro(httpStatus: number, resp: any): string {
  const t = JSON.stringify(resp ?? "").toLowerCase();
  if (t.includes("not on whatsapp") || t.includes("resolve phone") || t.includes("not_registered") || t.includes("not registered") || t.includes("no account") || t.includes("invalid number") || t.includes("nao existe") || t.includes("não existe")) return "Este número não foi encontrado no WhatsApp (verifique o 9º dígito e o DDD).";
  if (httpStatus === 401 || httpStatus === 403 || t.includes("disconnected") || t.includes("not connected") || t.includes("session not found") || t.includes("session closed") || t.includes("session_not_connected") || t.includes("scan qr") || t.includes("reconnect") || t.includes("unauthorized")) return "Instância desconectada — reconecte o WhatsApp pelo QR.";
  if (t.includes("timeout") || t.includes("aborted") || t.includes("timederror") || httpStatus === 0) return "Tempo esgotado ao falar com o WhatsApp — tente novamente.";
  return "Não foi possível enviar esta mensagem agora — tente novamente em instantes.";
}

type Identidade = { modo: "maquina" } | { modo: "pessoa"; userId: string } | null;

async function identificar(req: Request): Promise<Identidade> {
  const interno = req.headers.get("x-envio-interno");
  if (interno) {
    const { data, error } = await admin.rpc("ncrm_envio_token_valido", { p_token: interno });
    if (!error && data === true) return { modo: "maquina" };
    return null;
  }
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return null;
  try {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data?.user?.id) return null;
    return { modo: "pessoa", userId: data.user.id };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const quem = await identificar(req);
  if (!quem) return json({ error: "nao_autorizado" }, 401);

  let p: any = {};
  try { p = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }
  const to = normalizarBR(digits(p.to ?? p.telefone));
  const tipo = String(p.tipo ?? "text").toLowerCase();
  const corretorNome = typeof p.corretor_nome === "string" ? p.corretor_nome : null;
  if (!to || to.length < 8) return json({ error: "telefone_invalido" }, 400);

  let sess: string | null = null, key: string | null = null;
  let corretorResolvido: number | null = null;

  if (quem.modo === "pessoa") {
    // Servidor decide a instancia. instancia_id do body e apenas um pedido.
    const { data: aut } = await admin.rpc("ncrm_resolver_envio_autorizado", {
      p_user_id: quem.userId,
      p_telefone: to,
      p_instancia_id: p.instancia_id ? Number(p.instancia_id) : null,
    });
    const a: any = aut ?? {};
    if (a.decisao !== "permitir") {
      return json({ error: "sem_permissao", motivo: a.motivo ?? "nao_autorizado" }, 403);
    }
    corretorResolvido = a.corretor_id ?? null;
    if (a.instancia_id) {
      const cred = await credenciaisDaInstancia(Number(a.instancia_id));
      if (cred) { sess = cred.sess; key = cred.key; }
    }
    // Papel de gestao sem instancia definida cai na resolucao normal abaixo.
  }

  // Autoridade do piloto: vale para pessoa e para maquina.
  try {
    const { data: dec } = await admin.rpc("ncrm_pode_enviar_pelo_erp", {
      p_corretor_id: corretorResolvido ?? (p.corretor_id ? Number(p.corretor_id) : null),
      p_negocio_id: p.negocio_id ? Number(p.negocio_id) : null,
      p_lead_id: p.lead_id ? Number(p.lead_id) : null,
      p_telefone: to,
    });
    const decisao = (dec as any)?.decisao;
    if (decisao && decisao !== "permitir") {
      return json({ error: "envio_bloqueado", decisao, motivo: (dec as any)?.motivo ?? null }, 409);
    }
  } catch (_) { /* piloto indisponivel nao derruba o legado */ }

  // Resolucao para maquina, ou para gestao que nao fixou instancia.
  if (!sess || !key) {
    try {
      if (quem.modo === "maquina" && p.instancia_id) {
        const cred = await credenciaisDaInstancia(Number(p.instancia_id));
        if (cred) { sess = cred.sess; key = cred.key; }
      } else if (quem.modo === "maquina" && p.instancia_dapi) {
        const { data: i } = await admin.from("instancias").select("id, instancia_dapi").eq("instancia_dapi", p.instancia_dapi).maybeSingle();
        if (i) { const cred = await credenciaisDaInstancia(i.id); if (cred) { sess = cred.sess; key = cred.key; } }
      }
      if (!sess && p.corretor_id) { const x = await instByCorretor(Number(p.corretor_id)); if (x) { sess = x.sess; key = x.key; } }
      if (!sess && p.corretor_nome) {
        const { data: cor } = await admin.from("corretores").select("id").ilike("nome", String(p.corretor_nome).split(" ")[0] + "%").limit(1).maybeSingle();
        if (cor) { const x = await instByCorretor(cor.id); if (x) { sess = x.sess; key = x.key; } }
      }
      if (!sess) {
        const { data: ld } = await admin.from("leads").select("corretor_id").filter("telefone", "ilike", "%" + to.slice(-8)).limit(1).maybeSingle();
        if (ld?.corretor_id) { const x = await instByCorretor(ld.corretor_id); if (x) { sess = x.sess; key = x.key; } }
      }
    } catch (_) {}
  }
  if (!sess || !key) return json({ error: "instancia_nao_resolvida", motivo: "Nenhuma instância de WhatsApp conectada para este corretor — conecte em Configurações → Conexões." }, 422);

  let ep = "text"; const base: any = { sessionId: sess };
  if (tipo === "text" || tipo === "texto") { ep = "text"; base.text = aplicarVars(String(p.texto ?? p.text ?? ""), corretorNome); if (!base.text) return json({ error: "texto_vazio" }, 400); }
  else if (tipo === "audio") { ep = "audio"; base.audio = p.url; base.ptt = p.ptt !== false; if (!p.url) return json({ error: "url_audio_ausente" }, 400); }
  else if (tipo === "image" || tipo === "imagem") { ep = "image"; base.image = p.url; if (p.caption) base.caption = aplicarVars(String(p.caption), corretorNome); if (!p.url) return json({ error: "url_imagem_ausente" }, 400); }
  else if (tipo === "video") { ep = "video"; base.video = p.url; if (p.caption) base.caption = aplicarVars(String(p.caption), corretorNome); if (!p.url) return json({ error: "url_video_ausente" }, 400); }
  else if (tipo === "document" || tipo === "documento") { ep = "document"; base.document = p.url; if (p.fileName) base.fileName = p.fileName; if (p.mimetype) base.mimetype = p.mimetype; if (!p.url) return json({ error: "url_documento_ausente" }, 400); }
  else return json({ error: "tipo_invalido" }, 400);

  const tipoCanon = ep === "text" ? "texto" : ep === "image" ? "imagem" : ep === "document" ? "documento" : ep;
  const conteudoMsg = base.text ?? base.caption ?? null;
  const mediaUrl = p.url ?? null;

  const tentativas: { to: string; status: number; resp: any }[] = [];
  for (const dest of brVariants(to)) {
    let r: Response, resp: any;
    try {
      r = await fetch(DAPI + ep, { method: "POST", headers: { Authorization: key, "Content-Type": "application/json" }, body: JSON.stringify({ ...base, to: dest }), signal: AbortSignal.timeout(20000) });
      resp = await r.json().catch(() => ({}));
    } catch (e) {
      tentativas.push({ to: dest, status: 0, resp: String(e) });
      continue;
    }
    if (r.ok && resp?.success !== false) {
      await registrar(sess, to, { waId: resp?.messageId ? String(resp.messageId) : null, status: "enviado", detalhe: dest !== to ? ("entregue na forma " + dest + " (9º dígito)") : null, tipoCanon, conteudo: conteudoMsg, mediaUrl });
      return json({ ok: true, sessionId: sess, tipo, to: dest, messageId: resp?.messageId ?? null });
    }
    tentativas.push({ to: dest, status: r.status, resp });
  }

  const ult = tentativas[tentativas.length - 1] || { status: 0, resp: null };
  const motivo = motivoErro(ult.status, ult.resp);
  const cru = left(JSON.stringify(tentativas), 380);
  await registrar(sess, to, { waId: null, status: "erro", detalhe: motivo + " · " + cru, tipoCanon, conteudo: conteudoMsg, mediaUrl });
  return json({ error: "dapi_erro", motivo, status: ult.status, detalhe: tentativas }, 502);
});

function left(s: string, n: number) { return s.length > n ? s.slice(0, n) : s; }
