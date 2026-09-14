#!/usr/bin/env node
/* Onda 2.1 — Reprodutibilidade do banco.
 *
 * PROBLEMA QUE ESTE SCRIPT RESOLVE
 * Em 14/09/2026 a auditoria encontrou 571 migracoes aplicadas em producao
 * (a partir do baseline 20260727000000) e apenas 239 com arquivo correspondente
 * neste repositorio. Ou seja: 332 migracoes (58%) existem SO no banco.
 * Consequencia pratica: nao e possivel reconstruir o banco a partir do repo.
 * Sem isso nao ha homologacao fiel nem recuperacao de desastre testavel.
 *
 * O QUE ELE FAZ
 * Compara supabase_migrations.schema_migrations com supabase/migrations/ e
 * grava supabase/MIGRACOES-FALTANTES.md com a lista do que falta. Nao altera
 * producao: e somente leitura.
 *
 * COMO RODAR
 *   DATABASE_URL='postgresql://...' node scripts/migracoes-faltantes.mjs
 * ou, preferencialmente, use a CLI oficial para tambem TRAZER o conteudo:
 *   supabase db pull --linked
 *
 * A comparacao e por NOME, nao por versao: os arquivos do repo usam timestamps
 * proprios, diferentes dos gravados em producao. Comparar por versao produz
 * falso positivo (parece que 557 faltam quando sao 332).
 */
import { readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (string de conexao do Postgres de producao).");
  process.exit(1);
}

const nomesNoRepo = new Set(
  readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/^\d+_/, "").replace(/\.sql$/, "")),
);

const consulta =
  "select version || '\\t' || coalesce(name,'sem_nome') " +
  "from supabase_migrations.schema_migrations " +
  "where version >= '20260727000000' order by version";

const saida = execFileSync("psql", [url, "-At", "-c", consulta], { encoding: "utf8" });

const linhas = saida.split("\n").filter(Boolean).map((l) => {
  const [version, name] = l.split("\t");
  return { version, name };
});

const faltantes = linhas.filter((m) => !nomesNoRepo.has(m.name));

const md = [
  "# Migrações aplicadas em produção sem arquivo no repositório",
  "",
  `Gerado em ${new Date().toISOString()} por \`scripts/migracoes-faltantes.mjs\`.`,
  "",
  `- Migrações em produção (a partir do baseline): **${linhas.length}**`,
  `- Com arquivo neste repositório: **${linhas.length - faltantes.length}**`,
  `- **Sem arquivo: ${faltantes.length}**`,
  "",
  "Enquanto esta lista não for zero, o banco **não pode ser reconstruído a partir do repositório**.",
  "Para trazer o conteúdo (e não só a lista), use `supabase db pull --linked`.",
  "",
  "| version | name |",
  "|---|---|",
  ...faltantes.map((m) => `| ${m.version} | ${m.name} |`),
  "",
].join("\n");

writeFileSync("supabase/MIGRACOES-FALTANTES.md", md);
console.log(`${faltantes.length} migrações sem arquivo. Lista em supabase/MIGRACOES-FALTANTES.md`);
