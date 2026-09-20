import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/styles/automation-workspace.css", import.meta.url), "utf8");

test("ações principais e operacionais de Automação mantêm alvo móvel de 44px", () => {
  assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*?\.automation-header-actions > \* \{ min-height: 44px;/);
  assert.match(css, /\.automation-header-actions \.automation-primary \{ min-height: 44px; \}/);
  assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*?\.central-lista button,[\s\S]*?min-height: 44px;/);
});
