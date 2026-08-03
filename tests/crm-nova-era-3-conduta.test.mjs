import test from "node:test";
import assert from "node:assert/strict";
import { ACOES_OFICIAIS, MOMENTOS_PADRAO, condutaOficial, prazoDaConduta } from "../app/features/crm-nova-era-3/lib/conduta3.ts";

test("o padrão operacional é fechado em 4 momentos e 10 ações", () => {
  assert.equal(MOMENTOS_PADRAO.length, 4);
  assert.equal(ACOES_OFICIAIS.length, 10);
  assert.equal(new Set(MOMENTOS_PADRAO.map((m) => m.codigo)).size, 4);
  assert.equal(new Set(ACOES_OFICIAIS.map((a) => a.codigo)).size, 10);
});

test("lead novo recebe primeira abordagem, sem texto livre", () => {
  const c = condutaOficial({ etapa: "novo", respondeu: false });
  assert.equal(c.momentoCodigo, "novo_lead");
  assert.equal(c.acaoCodigo, "PRIMEIRA_ABORDAGEM");
  assert.equal(c.acao, "Fazer a primeira abordagem");
});

test("cliente sem resposta entra na cadência oficial", () => {
  const c = condutaOficial({ etapa: "tentando_contato", proximaAcao: "Cadência D2", respondeu: false });
  assert.equal(c.momentoCodigo, "sem_resposta");
  assert.equal(c.acaoCodigo, "ENVIAR_CADENCIA");
});

test("pedido de outro produto ou região vira busca de imóveis", () => {
  const c = condutaOficial(
    { etapa: "em_atendimento", respondeu: true },
    { negocio_id: 1, proxima_acao_sugerida: "Buscar outro produto em outra região", justificativa: "Cliente mudou a região", prazo_sugerido: null, confianca: .9, etapa_sugerida: "em_atendimento", analisado_em: "2026-08-03T10:00:00Z" },
  );
  assert.equal(c.momentoCodigo, "em_atendimento");
  assert.equal(c.acaoCodigo, "BUSCAR_E_ENVIAR_IMOVEIS");
  assert.equal(c.fonte, "Sara");
});

test("opções já enviadas exigem retorno", () => {
  const c = condutaOficial({ etapa: "em_atendimento", proximaAcao: "Cobrar retorno sobre as opções enviadas", respondeu: true });
  assert.equal(c.momentoCodigo, "em_atendimento");
  assert.equal(c.acaoCodigo, "PEDIR_RETORNO");
});

test("visita tem ações oficiais próprias", () => {
  assert.equal(condutaOficial({ etapa: "em_atendimento", proximaAcao: "Confirmar visita", respondeu: true }).acaoCodigo, "AGENDAR_VISITA");
  assert.equal(condutaOficial({ etapa: "em_atendimento", proximaAcao: "Registrar resultado da visita", respondeu: true }).acaoCodigo, "REGISTRAR_RESULTADO_VISITA");
});

test("prazo vira contagem regressiva ou atraso explícito", () => {
  const agora = new Date("2026-08-03T12:00:00Z");
  assert.deepEqual(prazoDaConduta("2026-08-03T12:30:00Z", agora), { status: "vence_logo", rotulo: "Faltam 30 min" });
  assert.deepEqual(prazoDaConduta("2026-08-03T10:00:00Z", agora), { status: "atrasada", rotulo: "Atrasada há 2h" });
});

test("texto livre da Sara vira código oficial e fica apenas como justificativa", () => {
  const c = condutaOficial(
    { etapa: "em_atendimento", respondeu: true },
    { negocio_id: 1, proxima_acao_sugerida: "Pergunte faixa de valor e prazo de compra", justificativa: "Faltam dados", prazo_sugerido: null, confianca: .8, etapa_sugerida: "em_atendimento", analisado_em: "2026-08-03T10:00:00Z" },
  );
  assert.equal(c.acaoCodigo, "ENTENDER_NECESSIDADE");
  assert.equal(c.acao, "Entender o que o cliente procura");
  assert.equal(c.justificativa, "Faltam dados");
});

test("momento inequívoco vence uma orientação antiga ou errada da Sara", () => {
  const semResposta = condutaOficial(
    { etapa: "tentando_contato", respondeu: false, proximaAcao: "Aguardar retorno" },
    { negocio_id: 1, proxima_acao_sugerida: "Entender melhor o perfil", justificativa: "análise antiga", prazo_sugerido: null, confianca: .9, etapa_sugerida: "em_atendimento", analisado_em: "2026-08-03T10:00:00Z" },
  );
  assert.equal(semResposta.acaoCodigo, "ENVIAR_CADENCIA");
  assert.equal(semResposta.momentoCodigo, "sem_resposta");

  const aguardando = condutaOficial(
    { etapa: "em_atendimento", respondeu: true, respostaPendente: true },
    { negocio_id: 2, proxima_acao_sugerida: "Buscar novos imóveis", justificativa: "análise antiga", prazo_sugerido: null, confianca: .9, etapa_sugerida: "em_atendimento", analisado_em: "2026-08-03T10:00:00Z" },
  );
  assert.equal(aguardando.acaoCodigo, "RESPONDER_CLIENTE");
});
