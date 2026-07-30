// PR B1 — contrato canonico do outbound nativo. Fixtures espelham as familias
// reais de `raw` encontradas na auditoria de 30/07/2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ehOutboundNativo, representaVerdadeiro, ehFamiliaWebhookDapi } from "../../app/features/crm-nova-era/lib/outboundCanonico.ts";

const DIST = "2026-07-30T12:00:00-03:00";
const DEPOIS = "2026-07-30T12:03:00-03:00";
const ANTES = "2026-07-30T11:50:00-03:00";
const ctx = { distribuidoEm: DIST };

const webhook = (extra = {}) => ({
  direcao: "enviada", wa_message_id: "wamid.ABC", criado_em: DEPOIS,
  raw: { fromMe: true, from: "5511999", to: "5511888", timestamp: 1, type: "text", ...extra },
});

test("fromMe aceita as representacoes booleanas reais", () => {
  for (const v of [true, "true", "TRUE", 1, "1"]) assert.equal(representaVerdadeiro(v), true, String(v));
  for (const v of [false, "false", 0, "0", null, undefined, ""]) assert.equal(representaVerdadeiro(v), false, String(v));
});

test("a familia do webhook e reconhecida positivamente", () => {
  assert.equal(ehFamiliaWebhookDapi({ fromMe: true }), true);
  assert.equal(ehFamiliaWebhookDapi({ from_me: true }), true);
  assert.equal(ehFamiliaWebhookDapi({ origem: "motor" }), false);
  assert.equal(ehFamiliaWebhookDapi({}), false);
});

test("outbound nativo do celular confirma a abordagem", () => {
  const r = ehOutboundNativo(webhook(), ctx);
  assert.equal(r.ok, true);
  assert.equal(r.messageId, "wamid.ABC");
});

test("aceita a variante com from_me e string", () => {
  const m = { direcao: "enviada", wa_message_id: "wamid.X", criado_em: DEPOIS, raw: { from_me: "true", instance: "i1" } };
  assert.equal(ehOutboundNativo(m, ctx).ok, true);
});

test("mensagem do motor nunca confirma", () => {
  const m = { direcao: "enviada", wa_message_id: "m1", criado_em: DEPOIS, raw: { origem: "motor" } };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "origem_motor");
});

test("envio pelo chat do ERP nunca confirma", () => {
  const m = { direcao: "enviada", wa_message_id: "c1", criado_em: DEPOIS, raw: { via: "crm" } };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "via_crm");
});

test("espelho interno antigo nunca confirma", () => {
  const m = { direcao: "enviada", wa_message_id: "e1", criado_em: DEPOIS, raw: { status: "enviado", wa_message_id: "e1", conteudo: "x" } };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "espelho_interno");
});

test("motor disfarcado de webhook continua recusado", () => {
  const m = webhook({ origem: "motor" });
  assert.equal(ehOutboundNativo(m, ctx).motivo, "origem_motor");
});

test("ausencia de campo nao e prova: sem marca de webhook, recusa", () => {
  const m = { direcao: "enviada", wa_message_id: "s1", criado_em: DEPOIS, raw: { conteudo: "oi" } };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "sem_marca_de_webhook");
});

test("recebida nao confirma abordagem", () => {
  const m = { ...webhook(), direcao: "recebida" };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "nao_e_outbound");
});

test("fromMe false recusa", () => {
  assert.equal(ehOutboundNativo(webhook({ fromMe: false }), ctx).motivo, "from_me_nao_e_true");
});

test("mensagem anterior a distribuicao nao conta", () => {
  const m = { ...webhook(), criado_em: ANTES };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "anterior_a_distribuicao");
});

test("sem message_id nao ha idempotencia possivel", () => {
  const m = { ...webhook(), wa_message_id: "  " };
  assert.equal(ehOutboundNativo(m, ctx).motivo, "sem_message_id");
});

test("instancia divergente recusa", () => {
  const m = { ...webhook(), instancia_id: "inst-a" };
  assert.equal(ehOutboundNativo(m, { distribuidoEm: DIST, instanciaId: "inst-b" }).motivo, "instancia_incompativel");
  assert.equal(ehOutboundNativo(m, { distribuidoEm: DIST, instanciaId: "inst-a" }).ok, true);
});

test("enviado_em tem prioridade sobre criado_em", () => {
  const m = { ...webhook(), enviado_em: DEPOIS, criado_em: ANTES };
  assert.equal(ehOutboundNativo(m, ctx).ok, true);
});

test("raw ausente recusa", () => {
  assert.equal(ehOutboundNativo({ direcao: "enviada", wa_message_id: "x", criado_em: DEPOIS, raw: null }, ctx).motivo, "sem_raw");
});
