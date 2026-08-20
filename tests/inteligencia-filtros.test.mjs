import assert from "node:assert/strict";
import test from "node:test";
import { extrairFiltros, opcoesReaisPorTela } from "../app/features/inteligencia/filtros.ts";

test("expõe somente os filtros dimensionais aceitos pela RPC de privacidade", () => {
  assert.deepEqual(Object.keys(opcoesReaisPorTela), ["privacidade"]);
  assert.deepEqual(
    opcoesReaisPorTela.privacidade["Nível de consentimento"].map((opcao) => opcao.parametro),
    ["essential", "analytics", "marketing"],
  );
  assert.deepEqual(
    opcoesReaisPorTela.privacidade.Dispositivo.map((opcao) => opcao.parametro),
    ["desktop", "mobile", "tablet"],
  );
});

test("converte chips visuais nos parâmetros reais da RPC", () => {
  assert.deepEqual(
    extrairFiltros(["Nível de consentimento: Somente essenciais", "Dispositivo: Celular"]),
    { consent: "essential", device: "mobile" },
  );
  assert.deepEqual(extrairFiltros(["Origem: Google", "Dispositivo: todos"]), { consent: null, device: null });
});
