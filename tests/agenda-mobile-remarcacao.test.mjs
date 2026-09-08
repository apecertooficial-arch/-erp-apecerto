import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { horaCurta } from "../app/features/calendar/telaAgenda.logica.ts";

const seletor = await readFile(new URL("../app/features/funil-2/HorariosVisita.tsx", import.meta.url), "utf8");
const agendaMobile = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const agendaApi = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const funilMobile = await readFile(new URL("../app/features/funil-2/Funil2Mobile.tsx", import.meta.url), "utf8");
const cssMobile = await readFile(new URL("../app/styles/app-mobile-aprovado.css", import.meta.url), "utf8");
const cssAgenda = await readFile(new URL("../app/styles/app-mobile-gestor.css", import.meta.url), "utf8");
const pwa = await readFile(new URL("../app/components/RegistroPwa.tsx", import.meta.url), "utf8");

test("app agenda e remarca somente em horários disponíveis", () => {
  const usos = agendaMobile.match(/<HorariosVisita/g) ?? [];
  assert.equal(usos.length, 2, "criação e remarcação devem usar o seletor canônico");
  assert.doesNotMatch(agendaMobile, /<input type="time"/);
  assert.match(agendaMobile, /visitId=\{editando\.id\}/);
  assert.match(agendaMobile, /Salvar nova data e horário/);
});

test("remarcação consulta disponibilidade excluindo a própria visita", () => {
  assert.match(agendaApi, /action === "visitAvailability"/);
  assert.match(agendaApi, /p_visita_id: visitId/);
  assert.match(agendaApi, /p_gerente_id: current\.com_gerente === true \? current\.gerente_id : null/);
});

test("seletor deixa data explícita e mostra o horário de Brasília", () => {
  assert.match(seletor, />Hoje</);
  assert.match(seletor, />Amanhã</);
  assert.match(seletor, /Horário de Brasília/);
  assert.match(seletor, /dataAmigavel\(data\)/);
  assert.match(seletor, /Manhã/);
  assert.match(seletor, /Tarde/);
  assert.match(seletor, /Noite/);
  assert.match(seletor, /horario\.inicio <= horaAgora\(\)/);
  assert.match(seletor, /Encerrado/);
  assert.match(seletor, /Horários disponíveis/);
  assert.match(seletor, /horariosIndisponiveis/);
});

test("folha da agenda rola e mantém a ação de salvar alcançável no celular", () => {
  assert.match(cssAgenda, /\.ape-agenda \.ape-folha > \.ape-ficha\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(cssAgenda, /\.ape-agenda \.f2m-agendar-acoes\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/s);
  assert.match(cssAgenda, /padding-bottom:\s*calc\([^)]*safe-area-inset-bottom/s);
});

test("PWA assume a nova versão sozinho quando não há formulário aberto", () => {
  assert.match(pwa, /podeRecarregarSemPerda/);
  assert.match(pwa, /querySelector\('\[aria-modal="true"\]'/);
  assert.match(pwa, /document\.visibilityState === "hidden" \|\| podeRecarregarSemPerda\(\)/);
});

test("agenda não exibe segundos vindos da API histórica", () => {
  assert.equal(horaCurta("10:30:00"), "10:30");
  assert.equal(horaCurta("09:00"), "09:00");
  assert.match(agendaMobile, /horaCurta\(prox\.hora\)/);
  assert.match(agendaMobile, /horaCurta\(c\.hora\)/);
});

test("confirmação de visita fica visível mesmo após a folha fechar", () => {
  assert.match(funilMobile, /Visita agendada com sucesso/);
  assert.match(funilMobile, /aria-live="polite"/);
  assert.match(cssMobile, /\.ape-visita-sucesso\s*\{[^}]*position:fixed[^}]*z-index:140/s);
  assert.match(agendaMobile, /Visita agendada com sucesso\./);
  assert.match(agendaMobile, /Visita remarcada com sucesso\./);
  assert.match(agendaMobile, /aria-label="Fechar confirmação"/);
  assert.match(cssAgenda, /\.ape-agenda-aviso\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*140/s);
});
