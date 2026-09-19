import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  montarJustificativaFeedbackVisita,
  validarEnvelopeFeedbackVisita,
  validarFeedbackVisitaDetalhado,
} from "../app/features/calendar/feedbackVisita.ts";

const form = await readFile(new URL("../app/features/calendar/ResultadoVisitaForm.tsx", import.meta.url), "utf8");
const desktop = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const mobile = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");

const feedbackCompleto = {
  presenca: "casal",
  acompanhantes: "Cônjuge participou da decisão",
  percepcao: "gostou",
  pontosPositivos: "Gostou da planta e da iluminação.",
  pontosNegativos: "Achou a entrada acima do planejado.",
  objecoes: "Precisa ajustar o valor de entrada.",
  alternativasOferecidas: "Unidades 84 e 112.",
  intencao: "negociacao",
  proximaAcao: "Simular nova condição de entrada amanhã.",
};

test("visita realizada exige resposta operacional completa", () => {
  assert.equal(validarFeedbackVisitaDetalhado("realizada", feedbackCompleto), null);
  assert.match(validarFeedbackVisitaDetalhado("realizada", { ...feedbackCompleto, objecoes: "" }), /objeções/i);
  assert.match(validarFeedbackVisitaDetalhado("realizada", { ...feedbackCompleto, proximaAcao: "" }), /próxima ação/i);
  assert.equal(validarFeedbackVisitaDetalhado("cancelada", null), null);
});

test("resumo estruturado é determinístico, legível e cabe no contrato legado", () => {
  const texto = montarJustificativaFeedbackVisita(feedbackCompleto, "Cliente quer comparar as condições antes de decidir.");
  assert.match(texto, /^FEEDBACK_VISITA_V1/);
  assert.match(texto, /Presença: Com companheiro\(a\)/);
  assert.match(texto, /Objeções: Precisa ajustar/);
  assert.match(texto, /Próxima ação: Simular nova condição/);
  assert.ok(texto.length <= 800);
  assert.equal(validarEnvelopeFeedbackVisita("realizada", texto), null);
  assert.match(validarEnvelopeFeedbackVisita("realizada", "Cliente gostou, retornar amanhã."), /estruturado/i);
  assert.match(validarEnvelopeFeedbackVisita("realizada", "FEEDBACK_VISITA_V1 | Presença: casal | Percepção: Gostou | Pontos positivos:  | Pontos negativos: nenhum | Objeções: nenhuma | Intenção: Continuar negociação | Próxima ação: ligar amanhã"), /estruturado/i);
  assert.equal(validarEnvelopeFeedbackVisita("cancelada", "Cliente pediu reagendamento."), null);
});

test("desktop e aplicativo usam o mesmo formulário estruturado", () => {
  for (const campo of ["Quem participou", "Percepção do cliente", "Pontos positivos", "Objeções", "Próxima ação combinada"]) {
    assert.match(form, new RegExp(campo));
  }
  assert.match(desktop, /ResultadoVisitaForm/);
  assert.match(mobile, /ResultadoVisitaForm/);
  assert.match(form, /montarJustificativaFeedbackVisita/);
  assert.match(form, /validarFeedbackVisitaDetalhado/);
});

test("API e contrato de banco rejeitam atalho textual em visita realizada", async () => {
  const apiAgenda = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
  const apiFunil = await readFile(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
  const draft = await readFile(new URL("../docs/erp-reestruturacao/P0_VISITA_OWNER_COBRANCA_DRAFT.sql", import.meta.url), "utf8");
  assert.match(apiAgenda, /validarEnvelopeFeedbackVisita/);
  assert.match(apiFunil, /validarEnvelopeFeedbackVisita/);
  assert.match(draft, /FEEDBACK_VISITA_V1/);
  assert.match(draft, /feedback_incompleto/);
});
