import test from "node:test";
import assert from "node:assert/strict";
import { condutaOficial, momentoHumano, prazoDaConduta } from "../app/features/crm-nova-era-3/lib/conduta3.ts";

test("todo momento técnico vira linguagem operacional", () => {
  assert.equal(momentoHumano("novo"), "Novo lead");
  assert.equal(momentoHumano("tentando_contato"), "Tentando contato");
  assert.equal(momentoHumano("em_atendimento"), "Em atendimento");
  assert.equal(momentoHumano("em_acompanhamento"), "Em acompanhamento");
});

test("a Sara define uma única ação oficial quando existe análise", () => {
  const c = condutaOficial(
    { etapa: "em_atendimento", proximaAcao: "Ação antiga", proximaAcaoEm: "2026-08-05T12:00:00Z", respondeu: true },
    { negocio_id: 1, proxima_acao_sugerida: "Enviar opções na região pedida", justificativa: "Cliente pediu outro bairro", prazo_sugerido: "2026-08-03T15:00:00Z", confianca: .9, etapa_sugerida: "em_atendimento", analisado_em: "2026-08-03T10:00:00Z" },
  );
  assert.equal(c.acao, "Enviar opções na região pedida");
  assert.equal(c.fonte, "Sara");
  assert.match(c.objetivo, /opções aderentes/i);
});

test("sem resposta sempre persegue interação pela cadência", () => {
  const c = condutaOficial({ etapa: "tentando_contato", proximaAcao: "Cadência D2", proximaAcaoEm: null, respondeu: false });
  assert.match(c.situacao, /seguir a cadência/i);
  assert.match(c.objetivo, /resposta do cliente/i);
});

test("prazo vira contagem regressiva ou atraso explícito", () => {
  const agora = new Date("2026-08-03T12:00:00Z");
  assert.deepEqual(prazoDaConduta("2026-08-03T12:30:00Z", agora), { status: "vence_logo", rotulo: "Faltam 30 min" });
  assert.deepEqual(prazoDaConduta("2026-08-03T10:00:00Z", agora), { status: "atrasada", rotulo: "Atrasada há 2h" });
});

test("nenhum lead fica sem objetivo mesmo antes da leitura", () => {
  const c = condutaOficial({ etapa: "novo", respondeu: false });
  assert.match(c.acao, /Sara está definindo/i);
  assert.ok(c.objetivo.length > 20);
});
