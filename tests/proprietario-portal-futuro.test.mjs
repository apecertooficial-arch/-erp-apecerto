import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const boundaryMigration = await readFile("supabase/migrations/20260923203500_portal_proprietario_futuro_fronteira.sql", "utf8");
const captureMigration = await readFile("supabase/migrations/20260923193000_captacao_proprietario_atomica.sql", "utf8");
const privacyMigration = await readFile("supabase/migrations/20260824215809_produtos_dados_privados_origem_qualidade.sql", "utf8");
const publicContract = await readFile("supabase/migrations/20260828113000_produtos_contrato_publico_privado.sql", "utf8");
const futureContract = await readFile("docs/erp-reestruturacao/CONTRATO_PORTAL_PROPRIETARIO_FUTURO.md", "utf8");

async function filesBelow(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const item = `${path}/${entry.name}`;
    return entry.isDirectory() ? filesBelow(item) : [item];
  }));
  return nested.flat();
}

test("preserva vínculo canônico sem transformar proprietário em usuário", () => {
  assert.match(captureMigration, /proprietario_id, cep, endereco/);
  assert.match(captureMigration, /v_capture\.proprietario_id is null/);
  assert.match(boundaryMigration, /comment on column public\.empreendimentos\.proprietario_id/);
  assert.match(boundaryMigration, /não equivale a usuário autenticado/i);
  assert.doesNotMatch(boundaryMigration, /alter table public\.proprietarios[\s\S]*add column[\s\S]*(usuario|user)_id/i);
});

test("PII continua fechada ao Data API e catálogo público não recebe proprietário", () => {
  assert.match(boundaryMigration, /alter table public\.proprietarios enable row level security/);
  assert.match(boundaryMigration, /revoke all privileges on table public\.proprietarios from public, anon, authenticated/);
  assert.match(boundaryMigration, /revoke all privileges on table private\.unidade_proprietarios from public, anon, authenticated/);
  assert.match(privacyMigration, /create table if not exists private\.unidade_proprietarios/);
  const siteView = publicContract.match(/create or replace view public\.site_produtos[\s\S]*?create or replace view public\.site_produtos_catalogo/)?.[0] ?? "";
  assert.doesNotMatch(siteView, /proprietario_(id|nome|contato|email|tel)/);
});

test("fase atual não cria portal, autenticação ou autorização especulativos", async () => {
  const appFiles = await filesBelow("app");
  assert.equal(appFiles.some((path) => /portal[-_/]?proprietario/i.test(path)), false);
  assert.doesNotMatch(boundaryMigration, /create (table|policy|function|view)/i);
  assert.match(futureContract, /Fora do escopo desta fase/);
  assert.match(futureContract, /associação inferida entre e-mail\/telefone e `auth\.users`/);
  assert.match(futureContract, /Gate obrigatório para uma fase futura/);
  assert.match(futureContract, /prova de posse\/consentimento/);
});
