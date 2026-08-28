import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = readFileSync(
  new URL("./fixtures/automation-builder-synthetic.html", import.meta.url),
  "utf8",
);

test("harness do builder bloqueia rede externa e persiste somente rascunho sintético", () => {
  assert.match(fixture, /http:\/\/synthetic\.invalid/);
  assert.match(fixture, /url\.origin !== syntheticOrigin/);
  assert.match(fixture, /unexpectedRequests\.push/);
  assert.match(fixture, /method === "PATCH"/);
  assert.match(fixture, /state\.savedDraft = body/);
  assert.match(fixture, /mapa_rascunho/);
  assert.match(fixture, /new DataTransfer\(\)/);
  assert.match(fixture, /new DragEvent\(type/);
  assert.match(fixture, /fire\(target, "drop"\)/);
  assert.match(fixture, /document\.querySelector\("#tbSave"\)\.click\(\)/);
  assert.match(fixture, /publishedMapSent/);
  assert.doesNotMatch(fixture, /supabase\.co|onrender\.com|https:\/\//);
});

test("harness abre o runtime canônico com uma automação sintética versionada", () => {
  assert.match(fixture, /automationBuilderRuntime\.js/);
  assert.match(fixture, /initialAutomationId:\s*999/);
  assert.match(fixture, /versao_publicada_id:\s*42/);
  assert.match(fixture, /SINTETICO_BUILDER/);
  assert.match(fixture, /onAutomationOpened/);
});
