import assert from "node:assert/strict";
import test from "node:test";
import { normalizarSara, prazoOuPadrao, acaoConfirmadaDaSara } from "../app/features/crm-nova-era-3/lib/sara3.ts";
import { ACOES_PADRAO, politicaSara } from "../app/features/crm-nova-era-3/lib/operacaoPadrao.ts";

test("catálogo operacional tem códigos estáveis e SLA", () => {
  assert.equal(ACOES_PADRAO.RESPONDER_CLIENTE.slaMin, 15);
  assert.equal(ACOES_PADRAO.ENVIAR_OPCOES.tipo, "enviar_opcoes");
  assert.equal(Object.keys(ACOES_PADRAO).length, 15);
});

test("Sara sem evidência ou abaixo de 70% exige revisão", () => {
  assert.equal(politicaSara(95, false, []).podeUsar, false);
  assert.equal(politicaSara(50, true, ["trecho"]).podeUsar, false);
  assert.equal(politicaSara(80, true, ["trecho"]).nivel, "sugestao");
  assert.equal(politicaSara(92, true, ["trecho"]).nivel, "forte");
});

test("prazo vencido nunca é reaproveitado", () => {
  const agora = new Date("2026-08-02T12:00:00Z");
  assert.equal(prazoOuPadrao("2026-08-01T12:00:00Z", agora), "2026-08-02T14:00:00.000Z");
});

test("ação aceita usa o código padrão e bloqueia baixa confiança", () => {
  const base = { proxima_acao: "Responder agora", acao_padrao_codigo: "RESPONDER_CLIENTE", evidencia_suficiente: true, evidencias: ["qual o valor?"], confianca: .92 };
  const s = normalizarSara(base);
  assert.equal(s?.codigoAcao, "RESPONDER_CLIENTE");
  assert.equal(acaoConfirmadaDaSara(base, { id: "7", respondeu: true }, 1)?.payload.proximaTipo, "retornar_contato");
  assert.equal(acaoConfirmadaDaSara({ ...base, confianca: .5 }, { id: "7", respondeu: true }, 1), null);
});
