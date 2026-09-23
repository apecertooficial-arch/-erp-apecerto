import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  avaliarQualidadeFeedbackVisita,
  montarJustificativaFeedbackVisita,
  montarJustificativaResultadoVisita,
  NOTA_MINIMA_FEEDBACK_VISITA,
  validarEncaminhamentoResultadoVisita,
  validarEnvelopeFeedbackVisita,
  validarFeedbackVisitaDetalhado,
} from "../app/features/calendar/feedbackVisita.ts";

const form = await readFile(new URL("../app/features/calendar/ResultadoVisitaForm.tsx", import.meta.url), "utf8");
const desktop = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const mobile = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const crm = await readFile(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");

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

test("qualidade do feedback é determinística, explicável e exige nota mínima nove", () => {
  assert.equal(NOTA_MINIMA_FEEDBACK_VISITA, 9);
  assert.deepEqual(avaliarQualidadeFeedbackVisita(feedbackCompleto), { nota: 10, pendencias: [] });

  const insuficiente = avaliarQualidadeFeedbackVisita({
    ...feedbackCompleto,
    acompanhantes: "",
    alternativasOferecidas: "",
    proximaAcao: "ligar",
  });
  assert.equal(insuficiente.nota, 7);
  assert.match(insuficiente.pendencias.join(" "), /participou/i);
  assert.match(insuficiente.pendencias.join(" "), /alternativa/i);
  assert.match(validarFeedbackVisitaDetalhado("realizada", {
    ...feedbackCompleto,
    acompanhantes: "",
    alternativasOferecidas: "",
    proximaAcao: "ligar",
  }) ?? "", /7\/10/);
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
  assert.match(validarEnvelopeFeedbackVisita("cancelada", "Cliente pediu reagendamento."), /próxima ação/i);
});

test("cancelamento e ausência exigem motivo e próximo passo explícitos", () => {
  assert.match(validarEncaminhamentoResultadoVisita("cancelada", "ligar"), /remarcada|retomado/i);
  assert.match(validarEncaminhamentoResultadoVisita("nao_compareceu", "ligar"), /ausência/i);
  assert.equal(validarEncaminhamentoResultadoVisita("cancelada", "Ligar amanhã às 10h para remarcar."), null);

  const cancelamento = montarJustificativaResultadoVisita(
    "cancelada",
    "cliente_cancelou",
    "Ligar amanhã às 10h para remarcar.",
    "Cliente avisou com antecedência.",
  );
  assert.match(cancelamento, /^RESULTADO_VISITA_V1/);
  assert.match(cancelamento, /Motivo: Cliente cancelou/);
  assert.match(cancelamento, /Próxima ação: Ligar amanhã/);
  assert.equal(validarEnvelopeFeedbackVisita("cancelada", cancelamento), null);
});

test("desktop, aplicativo e CRM usam o mesmo formulário estruturado", () => {
  for (const campo of ["Quem participou", "Percepção do cliente", "Pontos positivos", "Objeções", "Próxima ação combinada"]) {
    assert.match(form, new RegExp(campo));
  }
  assert.match(desktop, /ResultadoVisitaForm/);
  assert.match(mobile, /ResultadoVisitaForm/);
  assert.match(crm, /import \{ ResultadoVisitaForm \}/);
  assert.match(crm, /<ResultadoVisitaForm[\s\S]*accessToken=\{accessToken\}[\s\S]*onSalvar=\{\(dados\)/);
  assert.match(crm, /erro=\{erro \?\? undefined\}/);
  assert.match(crm, /const \[carregado, setCarregado\] = useState\(false\)/);
  assert.match(crm, /!carregando && carregado && aba === "visitas"/);
  assert.match(crm, /Preencher resultado completo/);
  assert.doesNotMatch(crm, /aria-label="Resultado da visita"/);
  assert.doesNotMatch(crm, /Justificativa obrigatória: o que aconteceu/);
  assert.match(form, /montarJustificativaFeedbackVisita/);
  assert.match(form, /QUALIDADE DO FEEDBACK/);
  assert.match(form, /avaliarQualidadeFeedbackVisita/);
  assert.match(form, /validarFeedbackVisitaDetalhado/);
  assert.match(form, /validarEncaminhamentoResultadoVisita/);
  assert.match(form, /Próxima ação/);
});

test("API e contrato de banco rejeitam atalho textual em visita realizada", async () => {
  const apiAgenda = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
  const apiFunil = await readFile(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
  const draft = await readFile(new URL("../supabase/migrations/20260923132610_visita_feedback_cobranca_canonica.sql", import.meta.url), "utf8");
  assert.match(apiAgenda, /validarEnvelopeFeedbackVisita/);
  assert.match(apiFunil, /validarEnvelopeFeedbackVisita/);
  assert.match(draft, /FEEDBACK_VISITA_V1/);
  assert.match(draft, /feedback_incompleto/);
  assert.match(draft, /f2_feedback_visita_nota/);
  assert.match(draft, /v_qualidade[\s\S]*<\s*9/);
  assert.match(draft, /feedback_qualidade_insuficiente/);
  assert.match(draft, /RESULTADO_VISITA_V1/);
  assert.match(draft, /resultado_encaminhamento_incompleto/);
  assert.match(draft, /Próxima ação:\[ \]\[\^\|\]\{12,/);
  assert.match(draft, /'qualidade_feedback_nota',v_qualidade/);
});

test("API rejeita envelope completo na aparência mas abaixo da qualidade mínima", () => {
  const baixo = montarJustificativaFeedbackVisita({
    ...feedbackCompleto,
    acompanhantes: "",
    alternativasOferecidas: "",
    proximaAcao: "ligar",
  }, "");
  assert.match(validarEnvelopeFeedbackVisita("realizada", baixo) ?? "", /7\/10/);
});
