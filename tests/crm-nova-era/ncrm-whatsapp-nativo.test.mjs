// PR B1 — abertura do WhatsApp nativo. Helpers puros, sem rede.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarTelefone, urlWhatsAppApp, urlWhatsAppWeb, prepararAberturaWhatsApp,
} from "../../app/features/crm-nova-era/lib/whatsappNativo.ts";

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
