import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../docs/erp-reestruturacao/P0_SARA_JANELA_CONVERSA_DRAFT.sql", import.meta.url),
  "utf8",
);

test("ensaio fixa o runtime observado e falha fechado em qualquer deriva", () => {
  assert.match(sql, /c12a68df57a7dac2e0f8733decfd054bec8e8dfe65ca7495f62cef0c17876b71/);
  assert.match(sql, /PREFLIGHT_FAILED: sara_enfileirar_mensagem divergiu/);
  assert.match(sql, /v_quiet <> 6/);
  assert.match(sql, /v_maximum <> 15/);
  assert.doesNotMatch(sql, /drop constraint if exists/i);
});

test("janela proposta espera silencio real e limita conversa longa", () => {
  assert.match(sql, /quiet_window_seconds set default 90/);
  assert.match(sql, /max_batch_wait_seconds set default 600/);
  assert.match(sql, /quiet_window_seconds between 30 and 300/);
  assert.match(sql, /max_batch_wait_seconds between 60 and 900/);
  assert.match(sql, /max_batch_wait_seconds >= quiet_window_seconds/);
  assert.match(sql, /v_silencio:=greatest\(30,least\(coalesce\(v_silencio,90\),300\)\)/);
  assert.match(sql, /v_maximo:=greatest\(v_silencio,least\(coalesce\(v_maximo,600\),900\)\)/);
});

test("draft nunca confirma DDL ou configuracao", () => {
  assert.match(sql, /\nbegin;\n/i);
  assert.match(sql, /\nrollback;\s*$/i);
  assert.doesNotMatch(sql, /\ncommit;\s*$/i);
});
