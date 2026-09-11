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

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = await readdir(migrationsDir);
const migrationBaseName = migrationNames.find((name) => name.endsWith("_visitas_agenda_privada.sql"));
const migrationCorrecaoName = migrationNames.find((name) => name.endsWith("_visitas_sobrepostas_sem_gerente.sql"));
assert.ok(migrationBaseName, "a trava de integridade precisa ser versionada em migration");
assert.ok(migrationCorrecaoName, "a liberdade de horario precisa ser versionada em migration");
const migrationBase = await readFile(new URL(migrationBaseName, migrationsDir), "utf8");
const migration = await readFile(new URL(migrationCorrecaoName, migrationsDir), "utf8");

test("web e app criam e remarcam pela Agenda canonica", () => {
  assert.match(agendaApi, /action === "createVisit"/);
  assert.match(agendaApi, /action === "visitAvailability"/);
  assert.match(agendaApi, /action === "updateVisit"/);
  assert.match(calendario, /Nova visita|createVisit|openCreate/);
  assert.match(calendario, /action: "updateVisit"|<HorariosVisita/);
  assert.match(calendarioMobile, /action: "createVisit"/);
  assert.match(calendarioMobile, /action: "updateVisit"|<HorariosVisita/);
});

test("Agenda e CRM preservam a autorizacao da carteira ativa", () => {
  assert.match(agendaApi, /rpc\("ncrm_agenda_corretor"/);
  assert.match(agendaApi, /from\("f2_lead"\)[\s\S]*is\("descartado_em", null\)/);
  assert.match(agendaApi, /f2_salvar_visita/);
  assert.match(funilApi, /f2_salvar_visita/);
  assert.match(migration, /public\.f2_pode_operar_lead\(p_lead_id\)/);
  assert.match(migration, /SECURITY DEFINER/);
});

test("horarios do corretor continuam clicaveis e gerente ocupado vira aviso", () => {
  assert.match(crm, /<HorariosVisita/);
  assert.match(crmMobile, /<HorariosVisita/);
  assert.match(seletor, /horario\.estado === "disponivel" \|\| horario\.estado === "sem_gerente"/);
  assert.match(seletor, /Sem gerente/);
  assert.match(seletor, /a visita será salva sem gerente/);
  assert.match(seletor, /aria-pressed/);
});

test("API devolve estados anonimos, nunca dados do compromisso alheio", () => {
  assert.match(funilApi, /action === "visitaDisponibilidade"/);
  assert.match(funilApi, /f2_disponibilidade_visitas/);
  assert.match(funilApi, /"sem_gerente"/);
  const inicio = funilApi.indexOf('action === "visitaDisponibilidade"');
  const fim = funilApi.indexOf('action === "salvarVisita"', inicio);
  const bloco = funilApi.slice(inicio, fim);
  assert.doesNotMatch(bloco, /cliente_nome|corretor_nome|corretor_id:\s*conflito/);
  assert.match(agendaApi, /p_visita_id: visitId/);
  assert.match(seletor, /visitId/);
});

test("banco aceita sobreposicao e remove apenas o gerente ocupado", () => {
  assert.match(migrationBase, /CREATE TRIGGER f2_visita_sem_sobreposicao/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.f2_bloquear_sobreposicao_visita/);
  assert.match(migration, /NEW\.com_gerente:=false/);
  assert.match(migration, /NEW\.gerente_id:=NULL/);
  assert.match(migration, /v_gerente_removido:=true/);
  assert.match(migration, /'gerente_removido',v_gerente_removido/);
  assert.match(migration, /THEN 'sem_gerente'/);
  assert.doesNotMatch(migration, /MESSAGE='corretor_ocupado'/);
  assert.doesNotMatch(migration, /RETURN pg_catalog\.jsonb_build_object\('ok',false,'erro','gerente_ocupado'\)/);
});
