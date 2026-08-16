import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const tela = ler("../app/features/tasks/SaraTasksMobile.tsx");
const pagina = ler("../app/(erp)/tarefas/page.tsx");
const api = ler("../app/api/funil2/route.ts");
const migration = ler("../supabase/migrations/20260816010000_tarefas_sara_decisoes.sql");

test("celular usa Tarefas da Sara e desktop preserva Projetos", () => {
  assert.match(pagina, /ehCelular \? <SaraTasksMobile/);
  assert.match(pagina, /: <ProjectsWorkspace/);
});

test("tarefas usam somente dados reais do Funil 2", () => {
  assert.match(tela, /fetch\("\/api\/funil2"/);
  assert.match(tela, /dados\?\.leads/);
  assert.doesNotMatch(tela, /const\s+(tasks|tarefas)\s*=\s*\[/i);
});

test("sugestão aceita ou recusada é auditável e não envia mensagem", () => {
  assert.match(tela, /decidirSugestao/);
  assert.match(api, /rpc\("f2_decidir_sugestao"/);
  assert.match(migration, /decisao in \('aceita','recusada'\)/);
  assert.match(migration, /A decisão e a eventual mudança de momento são uma única transação/);
  assert.match(migration, /security invoker/i);
  assert.doesNotMatch(api, /send-text-message|enviarMensagem/);
});

test("tarefas têm os cinco estados de sistema", () => {
  for (const trecho of ["ape-esqueleto", "Fila zerada", "Tentar novamente", "AppMobileOffline", "AppMobileSessaoExpirada"]) {
    assert.ok(tela.includes(trecho), `faltou ${trecho}`);
  }
});
