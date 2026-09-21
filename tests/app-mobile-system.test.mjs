import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sistema = await readFile("app/features/system/AppMobileSystem.tsx", "utf8");

test("sessão expirada volta para a entrada real do ERP", () => {
  assert.match(sistema, /href="\/inicio">Entrar novamente/);
  assert.doesNotMatch(sistema, /href="\/login"/);
});
