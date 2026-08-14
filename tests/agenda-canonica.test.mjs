import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const agendaApi = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const crmApi = await readFile(new URL("../app/api/crm/route.ts", import.meta.url), "utf8");
const desktop = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const mobile = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const chat = await readFile(new URL("../app/features/chat/LiveChatWorkspace.tsx", import.meta.url), "utf8");

test("desktop e mobile consomem somente a API canônica da Agenda", () => {
  assert.match(desktop, /\/api\/agenda\?workspace=1/);
  assert.doesNotMatch(desktop, /\/api\/crm/);
  assert.match(mobile, /\/api\/agenda\?/);
  assert.doesNotMatch(mobile, /\/api\/crm/);
  assert.match(chat, /\/api\/agenda/);
  assert.doesNotMatch(chat, /createVisit[\s\S]{0,500}\/api\/crm/);
});

test("escritas de visita existem na Agenda e não na API geral do CRM", () => {
  for (const action of ["createVisit", "updateVisit", "updateVisitStatus", "gerenteDisponibilidade"]) {
    assert.match(agendaApi, new RegExp(`action === "${action}"`));
    assert.doesNotMatch(crmApi, new RegExp(`action === "${action}"`));
  }
});

test("nova visita só aceita negócio presente na carteira ativa do Funil 2", () => {
  assert.match(agendaApi, /from\("f2_lead"\)/);
  assert.match(agendaApi, /is\("descartado_em", null\)/);
  assert.match(agendaApi, /O negócio não está ativo no Funil 2\.0\./);
});

test("o workspace não oferece a base histórica de recall como lead ativo", () => {
  const cardLookup = agendaApi.indexOf('from("f2_lead")');
  const dealLookup = agendaApi.indexOf('from("negocios")');
  const leadLookup = agendaApi.indexOf('from("leads")');
  assert.ok(cardLookup >= 0 && dealLookup > cardLookup && leadLookup > dealLookup);
  assert.match(agendaApi, /\.in\("id", negocioIds\)/);
  assert.match(agendaApi, /\.in\("id", leadIds\)/);
});
