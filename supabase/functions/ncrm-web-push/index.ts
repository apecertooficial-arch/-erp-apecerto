// ncrm-web-push -- entrega de Web Push.
//
// KILL-SWITCH: `ncrm_push_config.ativo = false` para tudo, sem deploy nenhum.
//
// SEGREDOS. A chave privada VAPID vive no vault do Postgres, cifrada, e sai
// apenas por ncrm_push_credenciais(), que so responde ao service_role. Nao esta
// no Git, no aplicativo nem em Edge Secret, e nunca e impressa -- nem em erro.
// Esta funcao tambem nunca imprime endpoint, payload, p256dh ou auth.
//
// AUTENTICACAO service-to-service pelo token interno dos demais emissores.
// CLAIM/LEASE por ncrm_push_reservar (FOR UPDATE SKIP LOCKED por baixo).
//
// As RPCs chamadas sao as PUBLICAS (ncrm_push_reservar / ncrm_push_resultado),
// nao as de ncrm_private: o PostgREST so expoe o schema public, e chamar as
// privadas devolvia "falha_ao_reservar" em toda execucao.
//
// CIFRAGEM: RFC 8291 (ECDH P-256 + HKDF-SHA256 + AES-128-GCM), RFC 8188
// (aes128gcm) e RFC 8292 (VAPID, JWT ES256). Sem biblioteca de terceiros --
// web-push do npm arrasta polyfill de Node num servico que manipula chave
// privada. Conferida contra o vetor do Apendice A da RFC 8291: bate byte a byte.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LOTE_MAX = 50;
const TIMEOUT_MS = 8000;
const LEASE_SEG = 120;
const TTL_SEG = 600;
const REGISTRO_TAMANHO = 4096;

const WORKER_ID = `edge-${crypto.randomUUID().slice(0, 8)}`;

/* O que exige acao AGORA viaja com Urgency: high -- acorda radio e tela do
   aparelho. O resto espera o aparelho ser usado. A lista tem que casar com
   TAGS_URGENTES do sw.js: chegar rapido e chegar mudo seria meio aviso.
   `retorno_proximo` e o combinado vencendo (30 min antes); o nome vem do
   vocabulario fechado de ncrm_notificacao_tipo_check. */
const TIPOS_URGENTES = new Set([
  "primeira_abordagem_pendente",
  "cliente_respondeu",
  "retorno_proximo",
  "acao_vencida",
]);

/* ------------------------------ utilitarios ------------------------------ */

function b64urlParaBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesParaB64url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of partes) { out.set(p, off); off += p.length; }
  return out;
}

const texto = (s: string) => new TextEncoder().encode(s);

async function hmac(chave: Uint8Array, dados: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dados));
}

/* HKDF a mao: o WebPush faz o extract com o auth_secret como sal ANTES do
   expand normal, e encadear deriveBits para isso fica menos legivel. */
const hkdfExtract = (sal: Uint8Array, ikm: Uint8Array) => hmac(sal, ikm);

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, tamanho: number): Promise<Uint8Array> {
  const bloco = await hmac(prk, concat(info, new Uint8Array([1])));
  return bloco.slice(0, tamanho);
}

/* --------------------------- cifragem aes128gcm --------------------------- */

async function cifrar(payload: string, p256dhB64: string, authB64: string): Promise<Uint8Array> {
  const uaPublic = b64urlParaBytes(p256dhB64); // 65 bytes, ponto nao comprimido
  const authSecret = b64urlParaBytes(authB64); // 16 bytes

  // Par efemero por mensagem. Reaproveitar quebraria o sigilo das anteriores.
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const segredo = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, par.privateKey, 256),
  );

  const prkChave = await hkdfExtract(authSecret, segredo);
  const infoChave = concat(texto("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdfExpand(prkChave, infoChave, 32);

  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(sal, ikm);
  const cek = await hkdfExpand(prk, texto("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, texto("Content-Encoding: nonce\0"), 12);

  // 0x02 marca o ultimo registro. Sem esse byte o navegador descarta.
  const claro = concat(texto(payload), new Uint8Array([2]));

  const aes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, claro),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, REGISTRO_TAMANHO, false);

  return concat(sal, rs, new Uint8Array([asPublic.length]), asPublic, cifrado);
}

/* ------------------------------ VAPID (JWT) ------------------------------ */

let chaveAssinaturaCache: CryptoKey | null = null;

async function chaveDeAssinatura(pubB64: string, privB64: string): Promise<CryptoKey> {
  if (chaveAssinaturaCache) return chaveAssinaturaCache;
  const pub = b64urlParaBytes(pubB64);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("vapid_publica_invalida");
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    x: bytesParaB64url(pub.slice(1, 33)),
    y: bytesParaB64url(pub.slice(33, 65)),
    d: privB64, ext: false,
  };
  chaveAssinaturaCache = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  return chaveAssinaturaCache;
}

/* Um JWT por origem, valido 12h: assinar por mensagem custaria uma operacao de
   curva eliptica por item do lote sem ganho nenhum. */
const cacheJwt = new Map<string, { jwt: string; expira: number }>();

async function autorizacaoVapid(endpoint: string, pub: string, priv: string, sub: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const agora = Math.floor(Date.now() / 1000);
  const guardado = cacheJwt.get(aud);
  if (guardado && guardado.expira - 300 > agora) return `vapid t=${guardado.jwt}, k=${pub}`;

  const exp = agora + 12 * 60 * 60;
  const cabecalho = bytesParaB64url(texto(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = bytesParaB64url(texto(JSON.stringify({ aud, exp, sub })));
  const entrada = `${cabecalho}.${corpo}`;

  const chave = await chaveDeAssinatura(pub, priv);
  // WebCrypto ja devolve r||s (formato JOSE). Nao converter para DER.
  const assinatura = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, texto(entrada)),
  );

  const jwt = `${entrada}.${bytesParaB64url(assinatura)}`;
  cacheJwt.set(aud, { jwt, expira: exp });
  return `vapid t=${jwt}, k=${pub}`;
}

/* -------------------------------- handler -------------------------------- */

async function autorizado(req: Request): Promise<boolean> {
  const token = req.headers.get("x-envio-interno");
  if (!token) return false;
  const { data, error } = await admin.rpc("ncrm_envio_token_valido", { p_token: token });
  return !error && data === true;
}

Deno.serve(async (req) => {
  try {
    if (!(await autorizado(req))) {
      return Response.json({ erro: "nao_autorizado" }, { status: 401 });
    }

    // Credenciais do vault. Kill-switch e configuracao no mesmo lugar.
    const { data: cred, error: eCred } = await admin.rpc("ncrm_push_credenciais");
    if (eCred) return Response.json({ ok: false, erro: "falha_credenciais" }, { status: 500 });

    const c = (cred ?? {}) as { ok?: boolean; erro?: string; ativo?: boolean; public?: string; private?: string; subject?: string };
    if (c.ok !== true) {
      return Response.json({ ok: false, erro: c.erro ?? "sem_credenciais" }, { status: 503 });
    }
    if (c.ativo !== true) {
      return Response.json({ ok: true, dormente: true, motivo: "ncrm_push_config.ativo esta false" });
    }
    const vapidPub = c.public!, vapidPriv = c.private!, vapidSub = c.subject!;

    const { data: reserva, error: eRes } = await admin.rpc("ncrm_push_reservar", {
      p_worker_id: WORKER_ID, p_limite: LOTE_MAX, p_lease_seg: LEASE_SEG,
    });
    if (eRes) return Response.json({ ok: false, erro: "falha_ao_reservar" }, { status: 500 });

    // deno-lint-ignore no-explicit-any
    const r = (reserva ?? {}) as any;
    if (r.ok === false) return Response.json({ ok: false, erro: r.erro ?? "reserva_recusada" }, { status: 403 });

    const itens = r.itens ?? [];
    if (itens.length === 0) return Response.json({ ok: true, reservados: 0, entregues: 0 });

    let entregues = 0;
    let falhas = 0;

    for (const item of itens) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let status: number | null = null;
      let ok = false;
      let motivo = "falha_na_entrega";

      try {
        // A fila ja garante que nao ha nome, telefone nem conversa no payload.
        const payload = JSON.stringify({
          title: item.titulo,
          body: item.corpo ?? "",
          url: item.deep_link ?? "/notificacoes",
          tag: item.tipo ?? "ncrm",
        });

        const corpo = await cifrar(payload, item.p256dh, item.auth);
        const auth = await autorizacaoVapid(item.endpoint, vapidPub, vapidPriv, vapidSub);

        const resp = await fetch(item.endpoint, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Authorization": auth,
            "TTL": String(TTL_SEG),
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            // Lead novo, resposta de cliente e combinado vencendo/vencido
            // acordam a tela; o resto espera o aparelho ser usado.
            "Urgency": TIPOS_URGENTES.has(item.tipo) ? "high" : "normal",
          },
          body: corpo,
        });
        status = resp.status;
        ok = resp.ok;

        // 404/410 = inscricao morta. Separado para o banco revogar em vez de
        // tentar para sempre um endereco que nao existe mais.
        if (status === 404 || status === 410) motivo = "inscricao_expirada";
        else if (status === 413) motivo = "payload_grande";
        else if (status === 429) motivo = "limite_do_servico";
      } catch (_) {
        // Erro de rede pode conter a URL do endpoint, que identifica o aparelho.
        ok = false;
        status = null;
      } finally {
        clearTimeout(timer);
      }

      await admin.rpc("ncrm_push_resultado", {
        p_fila_id: item.fila_id,
        p_ok: ok,
        p_http_status: status,
        p_erro: ok ? null : motivo,
        p_tentativa_id: item.tentativa_id,
      });

      if (ok) entregues++; else falhas++;
    }

    return Response.json({ ok: true, reservados: itens.length, entregues, falhas });
  } catch (_) {
    return Response.json({ ok: false, erro: "falha_interna" }, { status: 500 });
  }
});
