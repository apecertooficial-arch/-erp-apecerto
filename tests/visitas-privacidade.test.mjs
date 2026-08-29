import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const agendaApi = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const funilApi = await readFile(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const calendario = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const calendarioMobile = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const crm = await readFile(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const crmMobile = await readFile(new URL("../app/features/funil-2/Funil2Mobile.tsx", import.meta.url), "utf8");
const seletor = await readFile(new URL("../app/features/funil-2/HorariosVisita.tsx", import.meta.url), "utf8");
const chat = await readFile(new URL("../app/features/chat/LiveChatWorkspace.tsx", import.meta.url), "utf8");

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const migrationName = (await readdir(migrationsDir)).find((name) => name.endsWith("_visitas_agenda_privada.sql"));
assert.ok(migrationName, "a trava de concorrencia precisa ser versionada em migration");
const migration = await readFile(new URL(migrationName, migrationsDir), "utf8");

test("Calendario nao cria visitas, mas permite reagendar compromissos existentes", () => {
  assert.doesNotMatch(agendaApi, /action === "createVisit"/);
  assert.match(agendaApi, /action === "visitAvailability"/);
  assert.match(agendaApi, /action === "updateVisit"/);
  assert.doesNotMatch(agendaApi, /gerenteDisponibilidade/);
  assert.doesNotMatch(calendario, /Nova visita|createVisit|openCreate|onDoubleClick/);
  assert.match(calendario, /Editar visita|action: "updateVisit"|<HorariosVisita/);
  assert.doesNotMatch(calendarioMobile, /abrirNovaVisita|action: "createVisit"|\+ Visita/);
  assert.match(calendarioMobile, /Remarcar|action: "updateVisit"|<HorariosVisita/);
  assert.doesNotMatch(chat, /openQuickAction\("visit"\)|action: "createVisit"/);
});

test("gestao recebe a equipe e corretor recebe somente a propria agenda", () => {
  assert.match(agendaApi, /GESTAO_AGENDA/);
  assert.match(agendaApi, /scope:\s*gestao \? "equipe" : "propria"/);
  assert.match(agendaApi, /item\.meu === true/);
  assert.match(agendaApi, /\.eq\("corretor_id", corretorId!?\)/);
  assert.match(calendario, /data\.scope === "equipe"/);
});

test("agendamento nasce na ficha do lead e usa horarios clicaveis", () => {
  assert.doesNotMatch(crm, /onNova=\{\(\) => setModal\("visita"\)\}/);
  assert.match(crm, /modal === "visita" && lead/);
  assert.match(crm, /<HorariosVisita/);
  assert.match(crmMobile, /<HorariosVisita/);
  assert.match(seletor, /Disponível/);
  assert.match(seletor, /Indisponível/);
  assert.match(seletor, /Sua visita/);
  assert.match(seletor, /aria-pressed/);
});

test("API devolve estados anonimos, nunca dados do compromisso alheio", () => {
  assert.match(funilApi, /action === "visitaDisponibilidade"/);
  assert.match(funilApi, /f2_disponibilidade_visitas/);
  const inicio = funilApi.indexOf('action === "visitaDisponibilidade"');
  const fim = funilApi.indexOf('action === "salvarVisita"', inicio);
  const bloco = funilApi.slice(inicio, fim);
  assert.doesNotMatch(bloco, /cliente_nome|corretor_nome|corretor_id:\s*conflito/);
  assert.doesNotMatch(agendaApi, /conflitos:\s*conflitos \?\? \[\]/);
  assert.match(agendaApi, /p_visita_id: visitId/);
  assert.match(seletor, /visitId/);
});

test("banco serializa e recusa sobreposicao do corretor ou gerente", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /corretor_ocupado/);
  assert.match(migration, /gerente_ocupado/);
  assert.match(migration, /horario_ocupado/);
  assert.match(migration, /f2_disponibilidade_visitas/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /tstzrange/);
  assert.match(migration, /CREATE TRIGGER f2_visita_sem_sobreposicao/);
  assert.match(migration, /origem_visita_id\s+IS DISTINCT FROM p_visita_id/);
  assert.match(migration, /f2_reagendar_visita/);
  assert.match(funilApi, /corretor_ocupado:/);
});
