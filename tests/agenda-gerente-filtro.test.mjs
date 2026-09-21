import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filtrarPendenciasPorCorretor } from "../app/features/calendar/telaAgenda.logica.ts";

const raiz = new URL("../", import.meta.url);

test("cobrança gerencial mostra somente as visitas do corretor escolhido", () => {
  const itens = [
    { id: "a", corretor_id: 7, corretor: "Corretor A" },
    { id: "b", corretor_id: "8", corretor: "Corretor B" },
    { id: "c", corretor_id: null, corretor: "Sem responsável" },
  ];
  assert.deepEqual(filtrarPendenciasPorCorretor(itens, "7").map((item) => item.id), ["a"]);
  assert.deepEqual(filtrarPendenciasPorCorretor(itens, "8").map((item) => item.id), ["b"]);
  assert.equal(filtrarPendenciasPorCorretor(itens, "99").length, 0);
  assert.equal(filtrarPendenciasPorCorretor(itens, null), itens);
});

test("filtro vem de deep link validado e pode voltar à visão completa", async () => {
  const [pagina, agenda] = await Promise.all([
    readFile(new URL("../app/(erp)/agenda/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(pagina.includes('/^\\d+$/.test(corretorSolicitado)'));
  assert.match(pagina, /corretorIdInicial=\{corretorIdInicial\}/);
  assert.match(agenda, /filtrarPendenciasPorCorretor\(pendenciasResultado, corretorEmFoco\)/);
  assert.match(agenda, /Ver todos os corretores/);
  assert.match(agenda, /Nenhuma visita pendente foi confirmada para este corretor agora/);
  const harness = await readFile(new URL("../tests/crm-visual-harness/main.tsx", import.meta.url), "utf8");
  assert.match(harness, /corretorIdInicial=\{corretorEmFoco\}/);
});
