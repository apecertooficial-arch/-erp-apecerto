import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filtrarPendenciasPorCorretor, rotuloTotalResultados } from "../app/features/calendar/telaAgenda.logica.ts";

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

test("filtro de corretor não atribui o total da equipe a uma pessoa", () => {
  assert.equal(rotuloTotalResultados("96 concluídas", false), "96 concluídas");
  assert.equal(rotuloTotalResultados("96 concluídas", true), "96 concluídas no total");
});

test("filtro vem de deep link validado e pode voltar à visão completa", async () => {
  const [pagina, agenda, desktop] = await Promise.all([
    readFile(new URL("../app/(erp)/agenda/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(pagina.includes('/^\\d+$/.test(corretorSolicitado)'));
  assert.equal(pagina.match(/corretorIdInicial=\{corretorIdInicial\}/g)?.length, 2);
  assert.match(agenda, /filtrarPendenciasPorCorretor\(pendenciasResultado, corretorEmFoco\)/);
  assert.match(agenda, /rotuloTotalResultados\(`/);
  assert.match(desktop, /rotuloTotalResultados\(`/);
  assert.match(desktop, /filtrarPendenciasPorCorretor\(data\.pendencias_resultado \?\? \[\], isAdmin \? corretorEmFoco : null\)/);
  assert.match(agenda, /Ver todos os corretores/);
  assert.match(desktop, /Ver todos os corretores/);
  assert.match(agenda, /Nenhuma visita pendente foi confirmada para este corretor agora/);
  assert.match(desktop, /Nenhuma visita pendente foi confirmada para este corretor agora/);
  const harness = await readFile(new URL("../tests/crm-visual-harness/main.tsx", import.meta.url), "utf8");
  assert.match(harness, /corretorIdInicial=\{corretorEmFoco\}/);
});
