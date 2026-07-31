#!/usr/bin/env node
/* Typecheck comparativo.
 *
 * O repositorio tem erros de tipo anteriores a esta validacao (concentrados em
 * app/api/*). Reprovar o total travaria qualquer PR. Este script roda tsc na
 * base do PR e na branch, e falha somente se a branch INTRODUZIR erro novo.
 *
 * Assinatura do erro = arquivo + mensagem, sem linha/coluna: mover codigo nao
 * deve ser confundido com regressao.
 */
import { execSync } from "node:child_process";

const rodar = () => {
  try {
    execSync("./node_modules/.bin/tsc --noEmit -p tsconfig.json", { stdio: "pipe" });
    return new Set();
  } catch (e) {
    const saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    return new Set(
      saida.split("\n")
        .filter((l) => / error TS\d+/.test(l))
        .map((l) => l.replace(/\(\d+,\d+\)/, "").trim()),
    );
  }
};

const baseRef = process.env.BASE_SHA || execSync("git merge-base HEAD origin/main").toString().trim();
const atual = execSync("git rev-parse HEAD").toString().trim();

const daBranch = rodar();
execSync(`git checkout -q ${baseRef}`);
const daBase = rodar();
execSync(`git checkout -q ${atual}`);

const novos = [...daBranch].filter((e) => !daBase.has(e));
const resolvidos = [...daBase].filter((e) => !daBranch.has(e));

console.log(`base ${baseRef.slice(0, 8)}: ${daBase.size} assinaturas`);
console.log(`branch:           ${daBranch.size} assinaturas`);
console.log(`resolvidos: ${resolvidos.length} | novos: ${novos.length}`);

if (novos.length) {
  console.error("\nErros de tipo INTRODUZIDOS por esta branch:");
  novos.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}
console.log("\nNenhuma regressao de tipo.");
