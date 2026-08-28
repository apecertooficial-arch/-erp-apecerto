import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  fatosDaConversa,
  deveAplicarCadenciaSemResposta,
  filtrarCatalogoParaIa,
  validarSugestaoAutomatica,
} from "../supabase/functions/_shared/sara-policy.mjs";

const catalogo = [
  { codigo: "CADENCIA_SEM_RESPOSTA", etapa: "tentando_contato" },
  { codigo: "CONVERSANDO_QUALIFICANDO", etapa: "em_atendimento" },
  { codigo: "PRODUTO_ENVIADO", etapa: "em_atendimento" },
  { codigo: "TENTANDO_AGENDAMENTO", etapa: "em_atendimento" },
  { codigo: "RETORNO_PROGRAMADO", etapa: "em_atendimento" },
  { codigo: "VISITA_AGENDADA", etapa: "visita" },
  { codigo: "COLETAR_FEEDBACK", etapa: "pos_visita" },
];

test("worker usa fatos, catalogo reduzido e guarda antes de devolver a sugestao", () => {
  const edge = readFileSync(
    new URL("../supabase/functions/f2-sara-reclassificar/index.ts", import.meta.url),
    "utf8",
  );
  assert.match(edge, /fatosDaConversa\(mensagens\)/);
  assert.match(edge, /filtrarCatalogoParaIa\(c, catalogo, fatos\)/);
  assert.match(edge, /validarSugestaoAutomatica/);
  assert.match(edge, /evidencia-id-v7-inteligencia-hibrida/);
  assert.match(edge, /IaIndisponivelError/);
});

test("envio sem resposta e um fato do banco e nao usa interpretacao aberta", () => {
  const fatos = fatosDaConversa([{ id: 1, direcao: "enviada" }]);
  assert.deepEqual(fatos, {
    clienteRespondeu: false,
    corretorEnviou: true,
    recebidas: 0,
    enviadas: 1,
    ultimaDirecao: "corretor",
  });
  assert.deepEqual(
    filtrarCatalogoParaIa(
      { etapa: "novo", momento_codigo: "PRIMEIRA_ABORDAGEM" }, catalogo, fatos,
    ).map((item) => item.codigo),
    ["CADENCIA_SEM_RESPOSTA"],
  );
});

test("sem resposta nunca regride atendimento, visita ou pos-visita", () => {
  const fatos = fatosDaConversa([{ id: 6, direcao: "enviada" }]);
  assert.equal(deveAplicarCadenciaSemResposta({ etapa: "novo" }, fatos), true);
  assert.equal(deveAplicarCadenciaSemResposta({ etapa: "tentando_contato" }, fatos), true);
  assert.equal(deveAplicarCadenciaSemResposta({ etapa: "em_atendimento" }, fatos), false);
  assert.equal(deveAplicarCadenciaSemResposta({ etapa: "pos_visita" }, fatos), false);
  assert.deepEqual(
    filtrarCatalogoParaIa(
      { etapa: "pos_visita", momento_codigo: "COLETAR_FEEDBACK" }, catalogo, fatos,
    ).map((item) => item.codigo),
    ["COLETAR_FEEDBACK"],
  );
});

test("resposta permite interpretar intencao, mas nao inventar visita", () => {
  const fatos = fatosDaConversa([{ id: 2, direcao: "recebida" }]);
  const permitido = filtrarCatalogoParaIa(
    { etapa: "tentando_contato", momento_codigo: "CADENCIA_SEM_RESPOSTA" }, catalogo, fatos,
  );
  assert.deepEqual(permitido.map((item) => item.codigo), [
    "CONVERSANDO_QUALIFICANDO", "PRODUTO_ENVIADO", "TENTANDO_AGENDAMENTO", "RETORNO_PROGRAMADO",
  ]);
  assert.equal(permitido.some((item) => item.codigo === "VISITA_AGENDADA"), false);
});

test("regressao real de pos-visita para produto enviado e bloqueada", () => {
  const candidato = { etapa: "pos_visita", momento_codigo: "COLETAR_FEEDBACK" };
  const fatos = fatosDaConversa([{ id: 3, direcao: "recebida" }]);
  assert.deepEqual(
    filtrarCatalogoParaIa(candidato, catalogo, fatos).map((item) => item.codigo),
    ["COLETAR_FEEDBACK"],
  );
  assert.deepEqual(
    validarSugestaoAutomatica({
      candidato,
      momento: catalogo.find((item) => item.codigo === "PRODUTO_ENVIADO"),
      fatos,
      confianca: 0.99,
      evidencias: ["quero outro imovel"],
      prazoSugerido: null,
    }),
    { ok: false, motivo: "etapa_operacional_protegida" },
  );
});

test("intencao forte exige evidencia e confianca maior", () => {
  const candidato = { etapa: "em_atendimento", momento_codigo: "CONVERSANDO_QUALIFICANDO" };
  const fatos = fatosDaConversa([{ id: 4, direcao: "recebida" }]);
  const momento = catalogo.find((item) => item.codigo === "TENTANDO_AGENDAMENTO");
  assert.equal(validarSugestaoAutomatica({ candidato, momento, fatos, confianca: 0.89, evidencias: ["vamos ver"], prazoSugerido: null }).ok, false);
  assert.equal(validarSugestaoAutomatica({ candidato, momento, fatos, confianca: 0.92, evidencias: [], prazoSugerido: null }).ok, false);
  assert.equal(validarSugestaoAutomatica({ candidato, momento, fatos, confianca: 0.92, evidencias: ["posso visitar amanha"], prazoSugerido: null }).ok, true);
});

test("retorno programado sem data nao movimenta automaticamente", () => {
  const candidato = { etapa: "em_atendimento", momento_codigo: "PRODUTO_ENVIADO" };
  const fatos = fatosDaConversa([{ id: 5, direcao: "recebida" }]);
  const momento = catalogo.find((item) => item.codigo === "RETORNO_PROGRAMADO");
  assert.equal(validarSugestaoAutomatica({ candidato, momento, fatos, confianca: 0.95, evidencias: ["me chama depois"], prazoSugerido: null }).ok, false);
  assert.equal(validarSugestaoAutomatica({ candidato, momento, fatos, confianca: 0.95, evidencias: ["me chama dia 30"], prazoSugerido: "2026-08-30T15:00:00Z" }).ok, true);
});

test("migration adiciona a mesma guarda no registro e na aplicacao", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260828112500_sara_inteligencia_hibrida_guardas.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /f2_sara_transicao_automatica_permitida/);
  assert.match(migration, /transicao_ia_bloqueada/);
  assert.match(migration, /p_origem='ia'/);
  assert.match(migration, /v_a\.origem='ia'/);
  assert.match(migration, /p_origem='deterministica'.*CADENCIA_SEM_RESPOSTA/s);
  assert.match(migration, /v_a\.origem='deterministica'.*CADENCIA_SEM_RESPOSTA/s);
  assert.match(migration, /revoke all on function public\.f2_sara_transicao_automatica_permitida/);
});
