import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const edge = readFileSync(new URL("../supabase/functions/marketing-ads-read/index.ts", import.meta.url), "utf8");
const prototype = readFileSync(new URL("../public/central-comando/prototype.html", import.meta.url), "utf8");

test("consulta mídia entregue no período, inclusive itens atualmente pausados", () => {
  assert.doesNotMatch(edge, /ad\.effective_status/);
  assert.doesNotMatch(edge, /campaign\.status = 'ENABLED'/);
  assert.match(edge, /DELIVERED_IN_PERIOD/);
});

test("usa datas de São Paulo e pagina os insights Meta", () => {
  assert.match(edge, /timeZone: "America\/Sao_Paulo"/);
  assert.match(edge, /while \(next && pages < 20\)/);
  assert.match(edge, /payload\?\.paging\?\.next/);
});

test("diagnóstico mostra o erro real e oferece nova consulta", () => {
  assert.match(prototype, /detalhe: st\.realError/);
  assert.match(prototype, /this\.carregarDadosReais\(this\._centralToken, true, F\.periodo\)/);
  assert.doesNotMatch(prototype, /A API do Meta Ads respondeu com erro 500 nas últimas 3 tentativas/);
});
