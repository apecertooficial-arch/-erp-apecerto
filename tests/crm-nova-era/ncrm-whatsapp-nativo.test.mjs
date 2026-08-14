// PR B1 — abertura do WhatsApp nativo. Helpers puros, sem rede.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarTelefone, urlWhatsAppApp, urlWhatsAppWeb, prepararAberturaWhatsApp,
} from "../../app/lib/whatsappNativo.ts";

test("normaliza celular com e sem codigo do pais", () => {
  for (const bruto of ["11987654321", "5511987654321", "+55 (11) 98765-4321", "55 11 98765 4321"]) {
    const r = normalizarTelefone(bruto);
    assert.equal(r.ok, true, `falhou para ${bruto}`);
    assert.equal(r.e164, "5511987654321");
  }
});

test("formata para leitura humana", () => {
  assert.equal(normalizarTelefone("11987654321").exibicao, "(11) 98765-4321");
  assert.equal(normalizarTelefone("1132654321").exibicao, "(11) 3265-4321");
});

test("aceita fixo de oito digitos", () => {
  const r = normalizarTelefone("1132654321");
  assert.equal(r.ok, true);
  assert.equal(r.e164, "551132654321");
});

test("recusa telefone vazio com explicacao para o corretor", () => {
  const r = normalizarTelefone("");
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "vazio");
  assert.match(r.explicacao, /telefone/i);
});

test("recusa numero incompleto, longo demais e DDD inexistente", () => {
  assert.equal(normalizarTelefone("987654321").motivo, "curto_demais");
  assert.equal(normalizarTelefone("5511987654321999").motivo, "longo_demais");
  assert.equal(normalizarTelefone("0198765432").motivo, "ddd_invalido");
});

test("recusa celular de nove digitos que nao comeca com 9", () => {
  assert.equal(normalizarTelefone("11887654321").motivo, "celular_sem_nove");
});

test("recusa numero de outro pais", () => {
  assert.equal(normalizarTelefone("+1 415 555 2671000").motivo, "pais_nao_suportado");
});

test("monta as duas URLs sem texto pre-preenchido", () => {
  assert.equal(urlWhatsAppApp("5511987654321"), "whatsapp://send?phone=5511987654321");
  assert.equal(urlWhatsAppWeb("5511987654321"), "https://wa.me/5511987654321");
  for (const u of [urlWhatsAppApp("5511987654321"), urlWhatsAppWeb("5511987654321")]) {
    assert.ok(!u.includes("text="), "URL nao pode carregar mensagem pronta");
  }
});

test("preparar devolve app e web juntos, ou o erro", () => {
  const ok = prepararAberturaWhatsApp("11987654321");
  assert.equal(ok.ok, true);
  assert.equal(ok.app, "whatsapp://send?phone=5511987654321");
  assert.equal(ok.web, "https://wa.me/5511987654321");
  assert.equal(prepararAberturaWhatsApp(null).ok, false);
});

// --- DDD contra a lista canonica (correcao pos-review) ---
import { DDDS_VALIDOS, dddExiste } from "../../app/lib/whatsappNativo.ts";

test("a lista canonica tem os 67 DDDs em uso no Brasil", () => {
  assert.equal(DDDS_VALIDOS.length, 67);
  assert.equal(new Set(DDDS_VALIDOS).size, 67, "sem duplicatas");
  for (const d of DDDS_VALIDOS) assert.ok(d >= 11 && d <= 99, `${d} fora da faixa`);
});

test("DDDs que existem sao aceitos", () => {
  for (const d of [11, 21, 27, 31, 41, 47, 51, 61, 62, 68, 71, 79, 81, 85, 91, 92, 98, 99]) {
    assert.equal(dddExiste(d), true, `DDD ${d} deveria existir`);
    const r = normalizarTelefone(`${d}987654321`);
    assert.equal(r.ok, true, `telefone com DDD ${d} deveria passar`);
  }
});

test("DDDs que nao existem sao recusados, mesmo dentro da faixa 11-99", () => {
  // Buracos reais do plano de numeracao.
  for (const d of [20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56, 57, 58, 59, 60, 70, 72, 76, 78, 80, 90]) {
    assert.equal(dddExiste(d), false, `DDD ${d} nao existe e nao pode ser aceito`);
    const r = normalizarTelefone(`${d}987654321`);
    assert.equal(r.ok, false, `telefone com DDD ${d} deveria falhar`);
    assert.equal(r.motivo, "ddd_invalido");
  }
});

test("a mensagem de DDD invalido nomeia o pais, porque agora ela pode sustentar isso", () => {
  const r = normalizarTelefone("20987654321");
  assert.match(r.explicacao, /nao existe no Brasil/);
});

test("dddExiste aceita numero e texto, e recusa lixo", () => {
  assert.equal(dddExiste("11"), true);
  assert.equal(dddExiste(" 11 "), true);
  assert.equal(dddExiste("abc"), false);
  assert.equal(dddExiste(""), false);
  assert.equal(dddExiste(11.5), false);
});
