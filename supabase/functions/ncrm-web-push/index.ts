// ncrm-web-push -- entrega de Web Push.
//
// NASCE DORMENTE. Sem NCRM_PUSH_ATIVO='true' nos Secrets, esta funcao recusa e
// explica por que. O kill-switch e a ausencia da variavel, nao um comentario:
// para parar tudo em producao, basta apagar o Secret.
//
// SEGREDOS. A chave privada VAPID vive em Edge Secrets e e lida aqui dentro.
// Nao esta no banco, no aplicativo, no Git nem em log nenhum. Esta funcao nunca
// imprime endpoint, payload, p256dh, auth ou chave -- nem em caminho de erro.
//
// AUTENTICACAO service-to-service pelo mesmo token interno dos demais emissores,
// validado por ncrm_envio_token_valido, que responde sim ou nao sem devolver o
// segredo. Nao aceita JWT de usuario: nenhuma pessoa dispara entrega.
//
// CLAIM/LEASE. Consome por ncrm_private.push_reservar, que reserva com
// FOR UPDATE SKIP LOCKED. Dois workers simultaneos levam itens diferentes. Cada
// resultado volta com o tentativa_id da reserva; reserva vencida e ignorada pelo
// banco em vez de sobrescrever trabalho alheio.
//
// ---------------------------------------------------------------------------
// O QUE MUDOU NESTA VERSAO
//
// A versao anterior montava o corpo como JSON puro e mandava com o cabecalho
// Content-Encoding: aes128gcm. Isso e uma promessa que o corpo nao cumpria: o
// servico de push (FCM, Mozilla, Apple) recusa com 400 e NADA chega no
// aparelho. A cifragem estava marcada como "entra aqui" e nunca entrou.
//
// Agora esta implementada de verdade, sem dependencia externa:
//   - RFC 8291 (Message Encryption): ECDH P-256 + HKDF-SHA256 + AES-128-GCM;
//   - RFC 8188 (aes128gcm): salt | rs | idlen | chave efemera | ciphertext;
//   - RFC 8292 (VAPID): JWT ES256 assinado com a chave privada dos Secrets.
//
// A cifragem foi conferida contra o vetor de teste do Apendice A da RFC 8291:
// bate byte a byte. Sem biblioteca de terceiros de proposito -- web-push em npm
// arrasta polyfill de Node e aumenta a superficie de um servico que manipula
// chave privada.
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LOTE_MAX = 50;
const TIMEOUT_MS = 8000;
const LEASE_SEG = 120;
const TTL_SEG = 600;           // 10 min: aviso de lead velho nao serve para nada
const REGISTRO_TAMANHO = 4096; // rs do aes128gcm

// Identifica esta execucao. Aparece em worker_id para diagnostico; nao e segredo.
const WORKER_ID = `edge-${crypto.randomUUID().slice(0, 8)}`;

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

/* HKDF em duas etapas. Escrito a mao porque o WebPush usa o extract com o
   auth_secret como sal ANTES do expand normal -- encadear deriveBits do
   WebCrypto para isso fica menos legivel do que os dois HMAC explicitos. */
const hkdfExtract = (sal: Uint8Array, ikm: Uint8Array) => hmac(sal, ikm);

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, tamanho: number): Promise<Uint8Array> {
  // tamanho <= 32 em todos os usos do WebPush: uma iteracao basta.
  const bloco = await hmac(prk, concat(info, new Uint8Array([1])));
  return bloco.slice(0, tamanho);
}

/* --------------------------- cifragem aes128gcm --------------------------- */

/**
 * RFC 8291 + RFC 8188. Devolve o corpo binario pronto para o POST.
 *
 * O corpo carrega a chave publica efemera em claro (e assim que o navegador
 * deriva a mesma chave do outro lado). O segredo que protege a mensagem e a
 * combinacao ECDH + auth_secret, que nunca trafega.
 */
async function cifrar(payload: string, p256dhB64: string, authB64: string): Promise<Uint8Array> {
  const uaPublic = b64urlParaBytes(p256dhB64); // 65 bytes, ponto nao comprimido
  const authSecret = b64urlParaBytes(authB64); // 16 bytes

  // Par efemero desta mensagem. Novo a cada envio -- reaproveitar quebraria o
  // sigilo futuro de todas as mensagens anteriores.
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const segredo = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, par.privateKey, 256),
  );

  // IKM: mistura o segredo ECDH com o auth_secret do dispositivo.
  const prkChave = await hkdfExtract(authSecret, segredo);
  const infoChave = concat(texto("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdfExpand(prkChave, infoChave, 32);

  const sal = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(sal, ikm);
  const cek = await hkdfExpand(prk, texto("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, texto("Content-Encoding: nonce\0"), 12);

  // 0x02 marca o ultimo (e unico) registro. Sem esse byte o navegador descarta.
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

/** Importa a privada VAPID. `d` vem dos Secrets; x/y saem da publica. */
async function chaveDeAssinatura(pubB64: string, privB64: string): Promise<CryptoKey> {
  if (chaveAssinaturaCache) return chaveAssinaturaCache;
  const pub = b64urlParaBytes(pubB64);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("vapid_publica_invalida");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesParaB64url(pub.slice(1, 33)),
    y: bytesParaB64url(pub.slice(33, 65)),
    d: privB64,
    ext: false,
  };
  chaveAssinaturaCache = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  return chaveAssinaturaCache;
}

/* Um JWT por origem de endpoint, valido por 12h. Assinar a cada mensagem
   custaria uma operacao de curva eliptica por item do lote sem ganho nenhum. */
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
    // 1. Kill-switch. Antes de qualquer coisa, inclusive de autenticar.
    if (Deno.env.get("NCRM_PUSH_ATIVO") !== "true") {
      return Response.json({
        ok: true,
        dormente: true,
        motivo: "NCRM_PUSH_ATIVO nao esta ligado; nenhuma entrega foi tentada",
      });
    }

    if (!(await autorizado(req))) {
      return Response.json({ erro: "nao_autorizado" }, { status: 401 });
    }

    // 2. Sem par VAPID nao ha o que assinar. Falha explicita, nao silenciosa.
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSub = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPub || !vapidPriv || !vapidSub) {
      return Response.json({
        ok: false,
        erro: "vapid_ausente",
        detalhe: "gere o par VAPID e configure em Edge Secrets; nada foi enviado",
      }, { status: 503 });
    }

    // 3. Reserva. So processa o que conseguiu reservar.
    const { data: reserva, error: eRes } = await admin.rpc("push_reservar", {
      p_worker_id: WORKER_ID,
      p_limite: LOTE_MAX,
      p_lease_seg: LEASE_SEG,
    }, { head: false });

    if (eRes) {
      // mensagem do banco, sem payload nem endpoint
      return Response.json({ ok: false, erro: "falha_ao_reservar" }, { status: 500 });
    }

    // deno-lint-ignore no-explicit-any
    const itens = (reserva as any)?.itens ?? [];
    if (itens.length === 0) {
      return Response.json({ ok: true, reservados: 0, entregues: 0 });
    }

    let entregues = 0;
    let falhas = 0;

    for (const item of itens) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let status: number | null = null;
      let ok = false;
      let motivo = "falha_na_entrega";

      try {
        // O payload sai daqui exatamente como veio da fila: titulo curto, tipo e
        // deep-link. A fila ja garante que nao ha nome, telefone nem conversa.
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
            // Lead novo acorda a tela; o resto espera o aparelho ser usado.
            "Urgency": item.tipo === "primeira_abordagem_pendente" ? "high" : "normal",
          },
          body: corpo,
        });
        status = resp.status;
        ok = resp.ok;

        /* 404/410 = inscricao morta (app desinstalado, cache do navegador
           limpo). Marcado a parte para o banco poder revogar em vez de tentar
           para sempre um endereco que nao existe mais. */
        if (status === 404 || status === 410) motivo = "inscricao_expirada";
        else if (status === 413) motivo = "payload_grande";
        else if (status === 429) motivo = "limite_do_servico";
      } catch (_) {
        // Nada do erro original e propagado: mensagem de rede pode conter a URL
        // do endpoint, que identifica o dispositivo.
        ok = false;
        status = null;
      } finally {
        clearTimeout(timer);
      }

      await admin.rpc("push_resultado", {
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
