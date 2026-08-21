import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interesseDasTags, normalizarTagsDoLead } from "../app/lib/lead-tags.ts";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");

test("normaliza os dois formatos históricos e identifica o produto da automação", () => {
  const tags = normalizarTagsDoLead([
    { name: "Origem: meta_lead_ads", color: "#ff7000" },
    { name: "Automacao: Entrada Miruna", color: "#FF7000" },
    { name: "Anuncio: AD | CD | 01 | MIRUNA 603" },
    "GRC | CARINAS",
    "GRC | CARINAS",
  ]);
  assert.equal(tags.length, 4);
  assert.equal(tags[0].nome, "GRC | CARINAS");
  assert.equal(tags.find((tag) => tag.nome.startsWith("Origem"))?.cor, "#FF7000");
  assert.equal(interesseDasTags(tags), "GRC | CARINAS");
});

test("usa a automação de entrada quando não existe etiqueta curta de produto", () => {
  const tags = normalizarTagsDoLead([
    { name: "Origem: Meta Lead Ads" },
    { name: "Automação: Entrada Miruna" },
    { name: "Campanha: APECERTO | MIRUNA | 449 | FORM LEAD | 08/26" },
  ]);
  assert.equal(interesseDasTags(tags), "Miruna");
});

test("não transforma etiqueta operacional em interesse de produto", () => {
  const tags = normalizarTagsDoLead([{ name: "Aquário" }, { name: "Respondeu Primeira" }]);
  assert.equal(interesseDasTags(tags), null);
});

test("API e as duas interfaces carregam e mostram interesse e tags", () => {
  const rota = ler("../app/api/funil2/route.ts");
  const mobile = ler("../app/features/funil-2/Funil2Mobile.tsx");
  const desktop = ler("../app/features/funil-2/Funil2Workspace.tsx");
  assert.match(rota, /from\("leads"\)\.select\("id,tags"\)/);
  assert.match(rota, /interesse:\s*contexto\?\.interesse/);
  assert.match(rota, /tags:\s*contexto\?\.tags/);
  assert.match(mobile, /INTERESSE DO LEAD/);
  assert.match(mobile, /<ContextoDoLead lead=\{lead\}/);
  assert.match(desktop, /<InteresseLead lead=\{item\}/);
});
