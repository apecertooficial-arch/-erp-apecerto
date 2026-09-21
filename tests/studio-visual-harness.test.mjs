import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./studio-visual-harness/main.tsx", import.meta.url), "utf8");
const config = await readFile(new URL("./studio-visual-harness/vite.config.mjs", import.meta.url), "utf8");

test("harness visual renderiza o Studio real com efeitos externos desligados", () => {
  assert.match(source, /StudioModule/);
  assert.match(source, /externalActionsEnabled: false/);
  assert.match(source, /window\.fetch = async/);
  assert.match(source, /mutationHandler=/);
  assert.match(source, /mutação bloqueada/);
});

test("harness visual usa somente dados sanitizados e porta dedicada", () => {
  assert.doesNotMatch(source, /@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(source, /\+?55\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
  assert.match(source, /DEMO-101/);
  assert.match(config, /port: 4196/);
  assert.match(config, /strictPort: true/);
});
