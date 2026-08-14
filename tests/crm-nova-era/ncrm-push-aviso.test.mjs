/* Aviso de lead novo no celular — regras que nao podem depender do navegador.
 *
 * O foco aqui e a trava de SSRF do endpoint: sem ela, um usuario logado faria o
 * servidor postar, autenticado, na URL que quisesse. Os casos abaixo reprovam
 * a versao permissiva.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { validarInscricao, endpointPermitido } from "../../app/api/ncrm/push/registrar/logica.ts";
import { chaveParaBytes, ehIosSemInstalar, lerEstado } from "../../app/features/notifications/pushCliente.ts";

const P256DH = "B".repeat(87);
const AUTH = "A".repeat(22);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

/* ------------------------- trava de endpoint (SSRF) ------------------------ */

test("endpointPermitido aceita apenas servicos de push conhecidos, em https", () => {
  for (const bom of [
    "https://fcm.googleapis.com/fcm/send/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/x",
    "https://abc-1.notify.windows.com/w/?token=x",
  ]) assert.equal(endpointPermitido(bom), true, `deveria aceitar ${bom}`);

  for (const ruim of [
    "http://fcm.googleapis.com/fcm/send/x",        // sem TLS
    "https://evil.com/fcm/send/x",                  // host arbitrario = SSRF
    "https://fcm.googleapis.com.evil.com/x",        // sufixo enganoso
    "https://127.0.0.1/x",                          // rede interna
    "https://169.254.169.254/latest/meta-data/",     // metadata da nuvem
    "file:///etc/passwd",
    "nao-e-url",
  ]) assert.equal(endpointPermitido(ruim), false, `deveria recusar ${ruim}`);
});

/* --------------------------- validacao do corpo --------------------------- */

test("validarInscricao exige as duas chaves no tamanho exato", () => {
  const ok = validarInscricao({ endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH });
  assert.equal(ok?.endpoint, ENDPOINT);
  assert.equal(ok?.userAgent, null);

  for (const ruim of [
    null, undefined, "texto", 42, [],
    { endpoint: ENDPOINT, p256dh: P256DH },                       // sem auth
    { endpoint: ENDPOINT, p256dh: P256DH, auth: "A".repeat(21) }, // auth curto
    { endpoint: ENDPOINT, p256dh: "B".repeat(86), auth: AUTH },   // p256dh curto
    { endpoint: ENDPOINT, p256dh: `${"B".repeat(86)}+`, auth: AUTH }, // base64 comum, nao url
    { endpoint: "https://evil.com/x", p256dh: P256DH, auth: AUTH },
    { endpoint: `https://fcm.googleapis.com/${"x".repeat(1200)}`, p256dh: P256DH, auth: AUTH },
  ]) assert.equal(validarInscricao(ruim), null, `deveria recusar ${JSON.stringify(ruim)?.slice(0, 60)}`);
});

test("validarInscricao corta user agent gigante em vez de recusar", () => {
  const r = validarInscricao({ endpoint: ENDPOINT, p256dh: P256DH, auth: AUTH, userAgent: "u".repeat(500) });
  assert.equal(r?.userAgent?.length, 200);
});

/* ---------------------------- chave e estados ---------------------------- */

test("chaveParaBytes devolve os 65 bytes do ponto P-256", () => {
  const chave = "BBnHTLPc6UMVFL810BH7oAqtybhq_HLJdsSJpLiasQDmTeUZSeTgEHRJy9YVmS8HTrUKIi8kpEoD2PMMHxqfXAc";
  const bytes = chaveParaBytes(chave);
  assert.equal(bytes.length, 65, "subscribe() rejeita qualquer coisa diferente de 65 bytes");
  assert.equal(bytes[0], 4, "ponto nao comprimido comeca com 0x04");
});

test("iPhone fora da tela inicial nao recebe push", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
  assert.equal(ehIosSemInstalar(iphone, false), true, "Safari comum: prometer aviso seria mentira");
  assert.equal(ehIosSemInstalar(iphone, true), false, "instalado na tela inicial: funciona");
  assert.equal(ehIosSemInstalar("Mozilla/5.0 (Linux; Android 14)", false), false);
});

test("lerEstado nunca oferece ligar quando nao da", () => {
  const base = { temServiceWorker: true, temPushManager: true, permissao: "default", jaInscrito: false, ua: "Android", standalone: false };
  assert.equal(lerEstado({ ...base }), "pode_pedir");
  assert.equal(lerEstado({ ...base, permissao: "denied" }), "negado");
  assert.equal(lerEstado({ ...base, permissao: "granted", jaInscrito: true }), "ligado");
  assert.equal(lerEstado({ ...base, temPushManager: false }), "nao_suportado");
  assert.equal(lerEstado({ ...base, temServiceWorker: false }), "nao_suportado");

  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
  assert.equal(lerEstado({ ...base, ua: iphone }), "ios_sem_instalar");
});

test("permissao concedida sem inscricao ainda pede para ligar", () => {
  /* Caso real: o corretor aceitou a permissao, mas o registro no servidor
     falhou (rede caiu). Se isso virasse "ligado", ele acharia que esta
     recebendo aviso e nao estaria. */
  const e = lerEstado({
    temServiceWorker: true, temPushManager: true, permissao: "granted",
    jaInscrito: false, ua: "Android", standalone: false,
  });
  assert.equal(e, "pode_pedir");
});
