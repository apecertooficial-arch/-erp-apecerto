import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../app/api/connections/route.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260831102000_sincronizar_novas_instancias_conexoes.sql", import.meta.url),
  "utf8",
);
const linkMigration = readFileSync(
  new URL("../supabase/migrations/20260831104500_sincronizar_vinculo_instancia_conexoes.sql", import.meta.url),
  "utf8",
);
const databaseTypes = readFileSync(new URL("../app/lib/supabase/database.types.ts", import.meta.url), "utf8");

test("Conexões atualiza o inventário antes de montar o painel", () => {
  assert.match(api, /rpc\("wa_v7_atualizar_painel"\)/);
  assert.ok(
    api.indexOf('rpc("wa_v7_atualizar_painel")') < api.indexOf('rpc("wa_v7_painel")'),
    "a sincronização imediata precisa acontecer antes do fallback para o snapshot anterior",
  );
  assert.match(databaseTypes, /wa_v7_atualizar_painel: \{ Args: never; Returns: Json \}/);
});

test("sessão nova do provedor ganha registro local sem inventar corretor", () => {
  assert.match(migration, /create or replace function wa_core\.materializar_sessoes_novas/);
  assert.match(migration, /insert into public\.instancias/);
  assert.match(migration, /s\.legado_instancia_id is null/);
  assert.match(migration, /null::bigint\s+as corretor_id/);
  assert.match(migration, /update wa_core\.sessao s[\s\S]*legado_instancia_id\s*=\s*i\.id/);
});

test("sincronização imediata é autenticada, limitada e não expõe função interna", () => {
  assert.match(migration, /create or replace function public\.wa_v7_atualizar_painel/);
  assert.match(migration, /if \(select auth\.uid\(\)\) is null/);
  assert.match(migration, /interval '20 seconds'/);
  assert.match(migration, /revoke all on function public\.wa_v7_atualizar_painel\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.wa_v7_atualizar_painel\(\) to authenticated/);
  assert.match(migration, /revoke all on function wa_core\.materializar_sessoes_novas\(bigint\) from public, anon, authenticated/);
});

test("cron também materializa sessões novas mesmo sem abrir a tela", () => {
  assert.match(migration, /cron\.alter_job\([\s\S]*wa_core\.sincronizar_inventario\(1, true\)/);
});

test("vínculo feito em Minha Equipe chega ao inventário que escopa Conexões", () => {
  assert.match(linkMigration, /create or replace function wa_core\.sincronizar_vinculo_instancia/);
  assert.match(linkMigration, /from public\.corretor_instancias/);
  assert.match(linkMigration, /from public\.corretores[\s\S]*usuario_id/);
  assert.match(linkMigration, /insert into wa_core\.sessao_vinculo/);
  assert.match(linkMigration, /update public\.instancias[\s\S]*set corretor_id/);
  assert.match(linkMigration, /create trigger trg_wa_core_vinculo_corretor_instancias/);
});

test("remoção e troca de responsável encerram o vínculo anterior", () => {
  assert.match(linkMigration, /update wa_core\.sessao_vinculo[\s\S]*set vigente_ate = greatest\([\s\S]*clock_timestamp\(\)/);
  assert.match(linkMigration, /after insert or update or delete on public\.corretor_instancias/);
  assert.match(linkMigration, /after update of corretor_id on public\.instancias/);
});

test("migração corrige imediatamente a instância já associada à Jacqueline", () => {
  assert.match(linkMigration, /wa_core\.sincronizar_vinculo_instancia\(i\.id, 1\)/);
  assert.match(linkMigration, /where i\.instancia_dapi = 'Jaqueline - 4285'/);
});
