#!/usr/bin/env node
/* Lint somente nos arquivos que o PR tocou.
 *
 * O repositorio tem erros de lint anteriores (Edge Functions com @ts-nocheck,
 * entre outros). Rodar no repo inteiro reprovaria todo PR por divida antiga.
 */
import { execSync } from "node:child_process";

const base = process.env.BASE_SHA || execSync("git merge-base HEAD origin/main").toString().trim();
const arquivos = execSync(`git diff --name-only --diff-filter=ACMR ${base} HEAD`)
  .toString().split("\n")
  .filter((f) => /\.(ts|tsx|mjs|js|jsx)$/.test(f))
  .filter((f) => !f.startsWith("supabase/functions/"))   // Edge Functions: fora do escopo do frontend
  .filter((f) => !f.includes("tests/shell/.build/"));    // bundle gerado

if (!arquivos.length) {
  console.log("Nenhum arquivo de frontend alterado. Nada a lintar.");
  process.exit(0);
}
console.log(`Lintando ${arquivos.length} arquivo(s) alterado(s):`);
arquivos.forEach((f) => console.log(`  ${f}`));
execSync(`./node_modules/.bin/eslint ${arquivos.map((f) => JSON.stringify(f)).join(" ")}`, { stdio: "inherit" });
console.log("Lint limpo no delta.");
