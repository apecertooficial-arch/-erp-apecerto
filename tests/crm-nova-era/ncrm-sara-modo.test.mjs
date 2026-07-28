import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SARA_MODOS, SARA_MODO_INICIAL, saraModoValido, capacidadesSara,
  saraPodeMutar, saraMutacaoBloqueada, normalizarAnaliseSara,
} from "../../app/features/crm-nova-era/lib/saraModo.ts";

test("os 4 modos existem e o inicial obrigatório é observer", () => {
  assert.deepEqual(SARA_MODOS, ["off", "observer", "suggest", "execute"]);
  assert.equal(SARA_MODO_INICIAL, "observer");
  assert.equal(saraModoValido("observer"), true);
  assert.equal(saraModoValido("god"), false);
});

test("matriz de capacidades por modo", () => {
  assert.deepEqual(capacidadesSara("off"), { lerConversas: false, calcularSugestao: false, registrarAnalise: false, proporAoHumano: false, executarMutacao: false });
  const obs = capacidadesSara("observer");
  assert.equal(obs.lerConversas, true);
  assert.equal(obs.calcularSugestao, true);
  assert.equal(obs.registrarAnalise, true);
  assert.equal(obs.proporAoHumano, false);
  assert.equal(obs.executarMutacao, false);
  assert.equal(capacidadesSara("suggest").proporAoHumano, true);
  assert.equal(capacidadesSara("suggest").executarMutacao, false);
  assert.equal(capacidadesSara("execute").executarMutacao, true);
});

test("observer (e off/suggest) NÃO podem mutar; só execute muta", () => {
  assert.equal(saraPodeMutar("off"), false);
  assert.equal(saraPodeMutar("observer"), false);
  assert.equal(saraPodeMutar("suggest"), false);
  assert.equal(saraPodeMutar("execute"), true);
  assert.equal(saraMutacaoBloqueada("observer"), true);
  assert.equal(saraMutacaoBloqueada("execute"), false);
});

const analiseBase = {
  negocioId: 1005, etapaAtual: "em_atendimento", etapaSugerida: "em_acompanhamento",
  proximaAcaoSugerida: "enviar_opcoes", prazoSugerido: "2026-07-28T15:00:00.000Z",
  justificativa: "Cliente pediu opções de 2 dormitórios.", evidencias: ["msg 14:02", "áudio transcrito 14:05"],
  confianca: 0.72, clienteAguardandoResposta: true, promessaRetorno: false,
  visitaMencionada: false, propostaMencionada: false, versaoPrompt: "sara-obs-v1",
  modo: "observer", analisadoEm: "2026-07-28T14:10:00.000Z",
};

test("análise observer válida contém todos os campos de auditoria", () => {
  const r = normalizarAnaliseSara(analiseBase);
  assert.equal(r.ok, true);
  const a = r.analise;
  for (const k of ["negocioId", "etapaAtual", "etapaSugerida", "proximaAcaoSugerida", "prazoSugerido", "justificativa", "evidencias", "confianca", "versaoPrompt", "modo", "analisadoEm"]) {
    assert.ok(k in a, `faltou ${k}`);
  }
  assert.equal(a.modo, "observer");
  assert.equal(a.confianca, 0.72);
});

test("análise inválida: confiança fora de 0..1, sem justificativa, modo off", () => {
  assert.equal(normalizarAnaliseSara({ ...analiseBase, confianca: 1.5 }).ok, false);
  assert.equal(normalizarAnaliseSara({ ...analiseBase, justificativa: "" }).ok, false);
  assert.equal(normalizarAnaliseSara({ ...analiseBase, modo: "off" }).ok, false);
  assert.equal(normalizarAnaliseSara({ ...analiseBase, negocioId: 0 }).ok, false);
  assert.equal(normalizarAnaliseSara(null).ok, false);
  assert.equal(normalizarAnaliseSara({ ...analiseBase, analisadoEm: "nao-iso" }).ok, false);
  assert.equal(normalizarAnaliseSara({ ...analiseBase, versaoPrompt: "" }).ok, false);
});
