import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tela = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const pagina = await readFile(new URL("../app/(erp)/agenda/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/styles/app-mobile-aprovado.css", import.meta.url), "utf8");

test("toque em visita própria abre a edição da Agenda sem montar o CRM", () => {
  assert.match(tela, /const podeEditarVisita/);
  assert.match(tela, /className="ape-agenda-cartao"[\s\S]*onClick=\{\(\) => \{ if \(editavel\) abrirEdicao\(c\); \}\}/);
  assert.match(tela, /disabled=\{!editavel\}/);
  assert.doesNotMatch(tela, /onAbrirLead|\/crm\?lead/);
  assert.doesNotMatch(pagina, /onAbrirLead|\/crm\?lead|useRouter/);
  assert.match(css, /@media \(max-width: 370px\)[\s\S]*\.ape-agenda-barra \{ flex-wrap: wrap; \}/);
});
