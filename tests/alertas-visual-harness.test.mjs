import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("./alertas-visual-harness/main.tsx", import.meta.url), "utf8");

test("harness de Avisos usa componente real, dados sanitizados e rede local restrita", () => {
  assert.match(main, /NotificationsWorkspace/);
  assert.match(main, /alertasHarness = "sanitizado"/);
  assert.match(main, /url\.origin !== window\.location\.origin/);
  assert.match(main, /url\.pathname !== "\/api\/notificacoes"/);
  assert.match(main, /dataset\.lastNotificationNavigation = href/);
  assert.doesNotMatch(main, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});
