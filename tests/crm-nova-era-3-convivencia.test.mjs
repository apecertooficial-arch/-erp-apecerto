/* CONVIVENCIA — o que a 3.0 herda do CRM atual sem quebrar.
 *
 * A 3.0 monta as visoes oficiais DENTRO da propria casca. Herdar identidade e
 * o objetivo; herdar efeito colateral, nao. Este arquivo prende as regras que
 * so aparecem quando as duas arvores convivem na mesma tela.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = ler("../app/styles/crm-nova-era.css");
const globais = ler("../app/globals.css");

test("a visao oficial aninhada nao herda o zoom da casca duas vezes", () => {
  /* .crm-v2 tem zoom .85 no globals.css. Como a casca da 3.0 tambem e .crm-v2,
     sem este reset Leads, Esteira e Agenda renderizavam a 72% -- menores do que
     no CRM atual, que e exatamente o que esta entrega promete nao fazer. */
  assert.match(globais, /\.crm-v2 \{ zoom: 0\.85; \}/, "o zoom do CRM atual mudou; recalcule o reset da 3.0");
  assert.match(css, /\.ncrm3-oficial \.crm-v2 \{ min-height:0; zoom:1; \}/, "faltou o reset de zoom da visao oficial");
});

test("a barra de visoes e os filtros do CRM atual somem dentro da 3.0", () => {
  /* Prototipo de 31/07 (prints-apecerto/crm-desktop): dentro da 3.0 quem navega
     e a barra de oito abas, e quem filtra sao as telas novas (Leads 3.0 tem os
     proprios filtros). A barra de filtros antiga confundia com dois vocabularios. */
  assert.match(css, /\.ncrm3-oficial \.crm-command-bar \{ display:none; \}/);
  assert.match(css, /\.ncrm3-oficial \.crm-toolbar-v2 \{ display:none; \}/);
  /* O cabecalho oficial continua nas visoes montadas, EXCETO na aba Visitas,
     onde ele diria "CRM - Agenda" para uma tela chamada Visitas. */
  assert.ok(!/\.ncrm3-oficial \.crm-v2-header \{ display:none/.test(css), "o cabecalho oficial das visoes montadas fica");
  assert.match(css, /\.ncrm3-so-visitas \.crm-v2-header \{ display:none; \}/);
});

test("a aba Visitas recorta a Agenda, nao cria um pipe paralelo", () => {
  assert.match(css, /\.ncrm3-so-visitas \.crm-agenda-grid > \.agenda-panel:not\(\.visits\) \{ display:none; \}/);
  assert.match(css, /\.ncrm3-so-visitas \.crm-agenda-grid \{ grid-template-columns:1fr; \}/);
});
