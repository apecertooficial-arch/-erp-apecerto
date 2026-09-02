import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const css = read("../app/styles/app-mobile-aprovado.css");

test("CRM mobile pesquisa também a carteira antiga autenticada", () => {
  assert.match(mobile, /fetch\(`\/api\/funil2\/carteira\?q=/);
  assert.match(mobile, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(mobile, /AbortController/);
  assert.match(mobile, /const termo = busca\.trim\(\)[\s\S]*termo\.length < 3/);
});

test("resultado fora do funil oferece ação explícita e segura", () => {
  assert.match(mobile, />Fora do funil</);
  assert.match(mobile, />Trazer para o funil</);
  assert.match(mobile, /action: "trazerLeadAntigo"/);
  assert.match(mobile, /disabled=\{trazendoLead \|\| !etapa \|\| !momento\}/);
  assert.match(mobile, /m\.etapa === etapa && m\.codigo !== "PRIMEIRA_ABORDAGEM"/);
  assert.match(css, /\.ape-carteira-antiga/);
  assert.match(css, /\.ape-trazer-folha/);
});
