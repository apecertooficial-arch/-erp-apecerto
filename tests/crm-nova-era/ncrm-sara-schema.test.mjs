// Schema da sugestão da Sara. node --test.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizarSugestaoSara, extrairJson, sugestaoParaFormulario } from "../../app/api/ncrm/saraSchema.ts";

const valida = {
  etapa_sugerida: "em_atendimento", temperatura: "quente", intencao_detectada: "comprar",
  proxima_acao: "Ligar hoje 15h", prazo_sugerido: "2026-07-28T18:00:00Z", objecoes: ["preço"],
  risco_abandono: "medio", possibilidade_visita: "alta", possibilidade_proposta: "media",
  justificativa: "engajado", confianca: 0.82, evidencias: ["quero visitar"],
};

test("normaliza objeto válido", () => {
  const r = normalizarSugestaoSara(valida);
  assert.ok(r.ok);
  assert.equal(r.sugestao.proxima_acao, "Ligar hoje 15h");
  assert.equal(r.sugestao.confianca, 0.82);
  assert.equal(r.sugestao.possibilidade_visita, "alta");
});

test("aceita JSON embutido em string (contrato { resposta })", () => {
  const r = normalizarSugestaoSara('Claro! ' + JSON.stringify(valida) + ' fim');
  assert.ok(r.ok && r.sugestao.temperatura === "quente");
});

test("falha controlada: não-JSON", () => {
  const r = normalizarSugestaoSara("desculpe, não consigo agora");
  assert.equal(r.ok, false);
  assert.equal(r.erro, "resposta_da_sara_nao_e_json");
});

test("falha controlada: sem proxima_acao ou confiança inválida", () => {
  assert.equal(normalizarSugestaoSara({ confianca: 0.5 }).ok, false);
  assert.equal(normalizarSugestaoSara({ proxima_acao: "x", confianca: 2 }).ok, false);
  assert.equal(normalizarSugestaoSara({ proxima_acao: "x", confianca: "abc" }).ok, false);
});

test("enum inválido vira null (não quebra)", () => {
  const r = normalizarSugestaoSara({ proxima_acao: "x", confianca: 0.3, temperatura: "roxo", etapa_sugerida: "zzz" });
  assert.ok(r.ok && r.sugestao.temperatura === null && r.sugestao.etapa_sugerida === null);
});

test("extrairJson e mapeamento p/ formulário", () => {
  assert.equal(extrairJson("nada"), null);
  assert.deepEqual(sugestaoParaFormulario(normalizarSugestaoSara(valida).sugestao).proximaTipo, "agendar_visita");
});
