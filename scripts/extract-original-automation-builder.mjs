import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "../..");
const sourcePath = resolve(projectRoot, "reference/CRM_ApeCerto_FINAL.html");
const source = await readFile(sourcePath, "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);

if (!templateMatch) throw new Error("Template original não encontrado.");

const template = JSON.parse(templateMatch[1]);
const cssMatch = template.match(/<style id="apeab-styles">([\s\S]*?)<\/style>/);
const builderStart = template.indexOf("window.ApeCertoAutomationBuilder = (function(){");
const builderReturn = template.indexOf("return { mount: mount", builderStart);
const builderEnd = template.indexOf("})();", builderReturn) + 5;

if (!cssMatch || builderStart < 0 || builderReturn < 0 || builderEnd < 5) {
  throw new Error("Construtor original de automações incompleto.");
}

const banner = "/* Extraído sem alterações de reference/CRM_ApeCerto_FINAL.html. */\n";
await writeFile(resolve(projectRoot, "frontend/public/automation-builder-original.css"), `${banner}${cssMatch[1].trim()}\n`);
await writeFile(resolve(projectRoot, "frontend/public/automation-builder-original.js"), `/* eslint-disable */\n${banner}${template.slice(builderStart, builderEnd)}\n`);

console.log("Construtor original de automações extraído com sucesso.");
