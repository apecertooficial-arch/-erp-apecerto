import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260820174500_tracking_360_ceo.sql", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../app/api/inteligencia/route.ts", import.meta.url), "utf8");
const ceo = readFileSync(new URL("../app/features/inteligencia/telas/VisaoEmpresa.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/features/inteligencia/CascaInteligencia.tsx", import.meta.url), "utf8");

test("resumo 360 exige gestão e não expõe tabelas diretamente", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /u\.role::text in \('admin', 'gerente', 'diretor', 'executivo'\)/);
  assert.match(migration, /revoke all on function public\.tracking_360_ceo\(integer\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.tracking_360_ceo\(integer\) to authenticated, service_role/);
});

test("resumo 360 mede a operação e também denuncia dado ruim", () => {
  for (const trecho of [
    "site_events_anon",
    "lead_attribution",
    "ncrm_estado",
    "visitas_realizadas_sem_resultado",
    "negocios_abertos_sem_valor",
    "sla_timestamp_invalido",
    "target_coverage_percent",
    "team_overdue",
  ]) assert.ok(migration.includes(trecho), `faltou ${trecho}`);
  assert.match(migration, /sum\(vgv \* percentual_comissao\)/);
});

test("endpoint valida sessão, papel e devolve cache privado", () => {
  assert.match(api, /supabase\.auth\.getUser\(token\)/);
  assert.match(api, /rolesGestao/);
  assert.match(api, /tracking_360_ceo/);
  assert.match(api, /private, no-store/);
});

test("Visão CEO usa dados reais e não mantém o objeto demo", () => {
  assert.match(ceo, /useDados\(accessToken, recorte\.periodo\)/);
  assert.match(ceo, /useResumoInteligencia\(accessToken, periodo\)/);
  assert.doesNotMatch(ceo, /const demo/);
  assert.match(shell, /DADOS REAIS — site, CRM e financeiro/);
  assert.match(shell, /conectadoAoBanco = new Set\(\["empresa"\]\)/);
});
