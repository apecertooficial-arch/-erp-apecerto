import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { erroAgendamentoVisita } from "../app/features/funil-2/modelo.ts";

const agendaApi = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const desktop = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const mobile = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const chat = await readFile(new URL("../app/features/chat/LiveChatWorkspace.tsx", import.meta.url), "utf8");
const funilApi = await readFile(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const funilDesktop = await readFile(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const funilMobile = await readFile(new URL("../app/features/funil-2/Funil2Mobile.tsx", import.meta.url), "utf8");
const identidadeCss = await readFile(new URL("../app/styles/apecerto-identidade.css", import.meta.url), "utf8");
const appMobileCss = await readFile(new URL("../app/styles/app-mobile-aprovado.css", import.meta.url), "utf8");

test("desktop, mobile e chat consomem somente a API canônica da Agenda", () => {
  assert.match(desktop, /\/api\/agenda\?workspace=1/);
  assert.doesNotMatch(desktop, /\/api\/crm/);
  assert.match(mobile, /\/api\/agenda\?/);
  assert.doesNotMatch(mobile, /\/api\/crm/);
  assert.match(chat, /\/api\/agenda/);
  assert.doesNotMatch(chat, /\/api\/crm/);
});

test("Agenda do app fica visível no breakpoint mobile", () => {
  const inicioMobile = appMobileCss.indexOf("\n@media (max-width: 900px) {");
  const agendaVisivel = appMobileCss.indexOf(".ape-agenda {", inicioMobile);
  assert.ok(inicioMobile >= 0 && agendaVisivel > inicioMobile);
  assert.match(appMobileCss.slice(agendaVisivel, agendaVisivel + 120), /display:\s*block/);
  assert.doesNotMatch(appMobileCss.slice(agendaVisivel + 120), /\.ape-agenda\s*\{\s*display:\s*none/);
});

test("Agenda administra e cria visitas pela mesma API canônica", () => {
  assert.match(agendaApi, /action === "updateVisitStatus"/);
  assert.match(agendaApi, /action === "updateVisit"/);
  assert.match(agendaApi, /action === "createVisit"/);
  assert.match(mobile, /action: "createVisit"/);
  assert.match(funilApi, /action === "salvarVisita"/);
  assert.match(funilApi, /action === "visitaDisponibilidade"/);
  assert.match(chat, /action: "createVisit"/);
  assert.equal(existsSync(new URL("../app/api/crm/route.ts", import.meta.url)), false);
});

test("corretor pode agendar como operação do atendimento e recebe a causa real", () => {
  assert.match(agendaApi, /\["calendario", "criar"\][\s\S]*\["crm", "editar"\][\s\S]*\["pipeline", "editar"\]/);
  assert.match(mobile, /setErroEscrita\(j\.error\?\.trim\(\) \|\| "Não foi possível salvar/);
});

test("nova visita só aceita lead operável no Funil 2", () => {
  assert.match(funilApi, /f2_disponibilidade_visitas/);
  assert.match(funilApi, /p_lead_id: leadId/);
  assert.match(funilDesktop, /modal === "visita" && lead/);
});

test("status na Agenda e agendamento no CRM usam a visita canônica", () => {
  const calls = agendaApi.match(/rpc\("f2_salvar_visita"/g) ?? [];
  assert.equal(calls.length, 3, "criação, edição e status devem passar pela mesma regra do Funil 2.0");
  assert.doesNotMatch(agendaApi, /from\("visitas"\)\.insert/);
  assert.match(agendaApi, /p_lead_id: card\.id/);
  assert.match(agendaApi, /p_id: visitId/);
});

test("o workspace não oferece a base histórica de recall como lead ativo", () => {
  const cardLookup = agendaApi.indexOf('from("f2_lead")');
  const dealLookup = agendaApi.indexOf('from("negocios")');
  const leadLookup = agendaApi.indexOf('from("leads")');
  assert.ok(cardLookup >= 0 && dealLookup > cardLookup && leadLookup > dealLookup);
  assert.match(agendaApi, /\.in\("id", negocioIds\)/);
  assert.match(agendaApi, /\.in\("id", leadIds\)/);
});

test("todas as portas do Funil 2 tratam datetime-local como horário de São Paulo", () => {
  assert.match(funilApi, /normalizarInstanteSaoPaulo\(String\(body\.inicioEm/);
  assert.doesNotMatch(funilApi, /new Date\(String\(body\.inicioEm/);
  assert.match(funilMobile, /inicioEm: quando/);
  assert.doesNotMatch(funilMobile, /inicioEm: new Date\(quando\)\.toISOString/);
  assert.match(funilDesktop, /inicioEm: inicio/);
  assert.match(funilDesktop, /dataHoraLocalSaoPaulo/);
  assert.match(funilDesktop, /timeZone: FUSO_OPERACAO/);
});

test("web e app explicam cada dado ausente antes de tentar agendar", () => {
  assert.equal(erroAgendamentoVisita({}), "Não foi possível identificar o cliente. Feche e abra a ficha novamente.");
  assert.equal(erroAgendamentoVisita({ leadId: "lead-1" }), "Escolha a data e a hora da visita.");
  assert.equal(
    erroAgendamentoVisita({ leadId: "lead-1", inicio: "2026-08-25T09:00" }),
    "Escolha o produto da visita ou informe a unidade.",
  );
  assert.equal(
    erroAgendamentoVisita({ leadId: "lead-1", inicio: "2026-08-25T09:00", empreendimentoId: "produto-1", comGerente: true }),
    "Escolha qual gerente vai acompanhar a visita.",
  );
  assert.equal(
    erroAgendamentoVisita({ leadId: "lead-1", inicio: "2026-08-25T09:00", empreendimentoId: "produto-1" }),
    null,
  );
});

test("confirmar visita exige um horário disponível selecionado", () => {
  assert.match(funilDesktop, /className="f2-modal-primary" disabled=\{busy \|\| !inicio\}/);
  assert.match(funilMobile, /disabled=\{salvando \|\| !quando\}/);
  assert.match(funilDesktop, /<HorariosVisita/);
  assert.match(funilMobile, /<HorariosVisita/);
});

test("app mostra a mensagem humana da API e os dois formatos confirmam o destino", () => {
  assert.match(funilMobile, /dados\?\.error/);
  assert.match(funilMobile, /Visita agendada com sucesso[\s\S]*Abrir Agenda/);
  assert.match(funilDesktop, /Visita agendada com sucesso[\s\S]*Ver visitas/);
  assert.match(funilApi, /gerente_ocupado:\s*"Esse gerente já tem uma visita nesse horário/);
});

test("convite de notificações não cobre a ficha nem o agendamento no aplicativo", () => {
  assert.match(identidadeCss, /body:has\(\.ape-folha\) \.aviso-push-convite/);
  assert.match(identidadeCss, /body:has\(\.ape-folha\) \.aviso-push-ok\s*\{\s*display:\s*none/);
});
