import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main = readFileSync(new URL("./photo-ai-visual-harness/main.tsx", import.meta.url), "utf8");
const config = readFileSync(new URL("./photo-ai-visual-harness/vite.config.mjs", import.meta.url), "utf8");

test("harness usa o organizador produtivo com dados sanitizados", () => {
  assert.match(main, /PhotoAiOrganizer/);
  assert.match(main, /photo-ai-sanitizado/);
  assert.doesNotMatch(main, /@example\.(com|com\.br)|\+55\s?\(?\d{2}\)?/i);
});

test("harness bloqueia rede e mutações", () => {
  assert.match(main, /window\.fetch = async/);
  assert.match(main, /blocked: true/);
  assert.match(main, /status: 405/);
  assert.match(config, /mock-supabase\.ts/);
});
