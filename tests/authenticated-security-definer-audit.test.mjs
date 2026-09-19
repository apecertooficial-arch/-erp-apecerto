import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const audit = readFileSync(
  new URL("../docs/erp-reestruturacao/AUTHENTICATED_SECURITY_DEFINER_AUDIT.md", import.meta.url),
  "utf8",
);

test("auditoria registra a superfície autenticada sem tratar auth.uid como autorização", () => {
  for (const total of [276, 148, 81, 32]) {
    assert.match(audit, new RegExp(`\\b${total}\\b`));
  }

  assert.match(audit, /Encontrar `auth\.uid\(\)` não prova\s+autorização/);
  assert.match(audit, /`transferir_negocio\(bigint,bigint\)`/);
  assert.match(audit, /`aprovar_descarte\(bigint\)`/);
  assert.match(audit, /`registrar_acao\(bigint,/);
  assert.match(audit, /`registrar_observacao\(bigint,text\)`/);
});

test("auditoria preserva correção por função e proíbe revogação em massa", () => {
  assert.match(audit, /service_role/);
  assert.match(audit, /Não usar `revoke execute on all functions`/);
  assert.match(audit, /validar chamadores internos, aplicativo e navegador/);
  assert.match(audit, /canário isolado/);
});
