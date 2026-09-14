#!/usr/bin/env node
/* Onda 1.1 + 3.4 do PLANO-CONSOLIDADO-EXECUCAO-ERP.
 *
 * POR QUE UM SCRIPT, E NAO UM COMMIT DIRETO
 * Estas correcoes tocam arquivos grandes (ProductDetail.tsx tem 94 KB). Foram
 * geradas e validadas em 14/09/2026 num clone limpo da main -- tsc 207 -> 0,
 * eslint 0 erros, build completo -- mas o canal usado para publicar nao
 * comportava enviar os arquivos inteiros com seguranca. Este script reproduz as
 * mesmas edicoes, e idempotente, e ABORTA se o fonte nao for o esperado: ou
 * aplica a correcao certa, ou nao faz nada.
 *
 * COMO RODAR (na raiz do repositorio):
 *   node scripts/onda-1-typecheck-e-tracking.mjs
 *   npx tsc --noEmit --incremental false     # esperado: 0 erros
 *   pnpm run lint
 *   node --test tests/tracking-360-removal.test.mjs   # esperado: 3/3
 *   git add -A && git commit && git push
 *
 * DEPOIS DE APLICADO E COMITADO, PODE APAGAR ESTE ARQUIVO.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

let mudou = 0;
const ler = (p) => readFileSync(p, "utf8");
const gravar = (p, s) => { writeFileSync(p, s); mudou++; console.log("  atualizado:", p); };
const erro = (m) => { throw new Error(m + " -- fonte inesperado, nada foi alterado"); };

/* 1.1a ProductDetail.tsx: remover os dois blocos `{false && ...}`.
 *
 * Eram a ficha antiga da unidade e a ficha antiga do produto, 27.593 caracteres
 * de JSX inalcancavel. O TypeScript checa codigo morto, e dentro desses blocos a
 * narrowing de `product` e `focusedUnit` se perdia: 199 dos 207 erros de tsc da
 * main vinham dai. Nenhum efeito em runtime -- o codigo nunca executava. */
function fecharChave(s, inicio) {
  let i = inicio, nivel = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === "`") {
      const aspa = c;
      i++;
      while (i < s.length) {
        if (s[i] === "\\") { i += 2; continue; }
        if (s[i] === aspa) break;
        if (aspa === "`" && s[i] === "$" && s[i + 1] === "{") i = fecharChave(s, i + 1);
        i++;
      }
    } else if (c === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    } else if (c === "{") {
      nivel++;
    } else if (c === "}") {
      nivel--;
      if (nivel === 0) return i;
    }
    i++;
  }
  return erro("bloco {false && ...} nao fecha");
}

{
  const p = "app/features/products/ProductDetail.tsx";
  let s = ler(p);
  const blocos = [];
  const re = /\{false && /g;
  let m;
  while ((m = re.exec(s))) blocos.push([m.index, fecharChave(s, m.index) + 1]);
  if (blocos.length === 0) {
    console.log("  ProductDetail.tsx: ja aplicado");
  } else if (blocos.length !== 2) {
    erro("esperava 2 blocos mortos em ProductDetail.tsx, achei " + blocos.length);
  } else {
    const antes = s.length;
    for (const par of blocos.reverse()) s = s.slice(0, par[0]) + s.slice(par[1]);
    console.log("  ProductDetail.tsx: removidos 2 blocos mortos (" + (antes - s.length) + " chars)");
    gravar(p, s);
  }
}

/* 1.1b resumable-upload.ts: previous.uploadUrl pode ser null. */
{
  const p = "app/features/products/resumable-upload.ts";
  const s = ler(p);
  const a = "try { return new URL(previous.uploadUrl).origin === endpointOrigin; }";
  const b = "try { return previous.uploadUrl ? new URL(previous.uploadUrl).origin === endpointOrigin : false; }";
  if (s.includes(b)) console.log("  resumable-upload.ts: ja aplicado");
  else if (!s.includes(a)) erro("resumable-upload.ts: trecho nao encontrado");
  else gravar(p, s.replace(a, b));
}

/* 1.1c As 4 RPCs de proprietario existem em producao desde 27/08/2026 e faltam
 * no database.types.ts gerado. Em vez de editar a mao um arquivo de 424 KB que
 * sera sobrescrito na proxima geracao, o cast fica isolado em
 * app/lib/supabase/rpc-proprietarios.ts. */
function comImport(s, linha) {
  if (s.includes(linha)) return s;
  const ms = [...s.matchAll(/^import .*?;\n/gm)];
  if (!ms.length) erro("nenhum import para ancorar");
  const fim = ms[ms.length - 1].index + ms[ms.length - 1][0].length;
  return s.slice(0, fim) + linha + s.slice(fim);
}

function trocar(p, pares, linhaImport) {
  let s = ler(p);
  let houve = false;
  for (const par of pares) {
    if (s.includes(par[1])) continue;
    if (!s.includes(par[0])) erro(p + ": trecho nao encontrado");
    s = s.replace(par[0], par[1]);
    houve = true;
  }
  if (!houve) { console.log("  " + p + ": ja aplicado"); return; }
  gravar(p, comImport(s, linhaImport));
}

trocar("app/api/product/route.ts", [
  ['const { data: productOwners } = await auth.supabase.rpc("produto_proprietario_ler", { p_empreendimento_id: id });',
   "const { data: productOwners } = await lerProprietariosDoProduto(auth.supabase, id);"],
  ['const { error: ownerError } = await auth.supabase.rpc("produto_proprietario_salvar", {\n        p_empreendimento_id: id,\n        p_nome: nome,\n        p_email: email,\n        p_telefone: telefone,',
   "const { error: ownerError } = await salvarProprietarioDoProduto(auth.supabase, {\n        empreendimentoId: id,\n        nome,\n        email,\n        telefone,"],
], 'import { lerProprietariosDoProduto, salvarProprietarioDoProduto } from "../../lib/supabase/rpc-proprietarios";\n');

trocar("app/api/capture/route.ts", [
  ['const { data, error } = await supabase.rpc("produto_proprietario_captacao_resolver", {\n      p_proprietario_id: ownerId,\n      p_nome: owner.name.trim(),\n      p_email: owner.email.trim().toLowerCase(),\n      p_telefone: owner.phone.trim(),\n    });',
   "const { data, error } = await resolverProprietarioDaCaptacao(supabase, {\n      proprietarioId: ownerId,\n      nome: owner.name.trim(),\n      email: owner.email.trim().toLowerCase(),\n      telefone: owner.phone.trim(),\n    });"],
], 'import { resolverProprietarioDaCaptacao } from "../../lib/supabase/rpc-proprietarios";\n');

trocar("app/features/products/CaptureWizard.tsx", [
  ['supabase.rpc("produto_proprietarios_meus"),', "lerMeusProprietarios(supabase),"],
  ["if (ownerResult.data) setOwners(ownerResult.data);",
   'if (ownerResult.data) setOwners(ownerResult.data.map((item) => ({\n        id: item.id,\n        nome: item.nome ?? "",\n        email: item.email ?? "",\n        telefone: item.telefone ?? "",\n      })));'],
], 'import { lerMeusProprietarios } from "../../lib/supabase/rpc-proprietarios";\n');

/* 3.4 Remover o Tracking 360 do ERP.
 *
 * As 5 RPCs que /api/tracking-360 chamava nao existem no banco desde a migracao
 * 20260828104449_remover_tracking_360.sql. A tela so sabia dar "Nao foi possivel
 * carregar o tracking" e continuava no menu, inclusive no celular do corretor. O
 * teste tests/tracking-360-removal.test.mjs ja afirmava a remocao, falhava, e nao
 * estava em nenhum script nem no CI -- por isso ninguem viu.
 *
 * ATENCAO: os DADOS de atribuicao nao sao apagados. Continuam sendo coletados em
 * private.site_events_anon (11.463), private.lead_attribution (537) e
 * private.tracking_delivery_logs (1.794). Reimplementar o painel sobre esses
 * dados e o item 6.5 do plano consolidado. */
for (const p of [
  "app/(erp)/tracking/page.tsx",
  "app/api/tracking-360/route.ts",
  "app/styles/tracking-360.css",
]) if (existsSync(p)) { rmSync(p); mudou++; console.log("  removido:", p); }
for (const d of ["app/features/tracking", "app/(erp)/tracking", "app/api/tracking-360"]) {
  if (existsSync(d)) { rmSync(d, { recursive: true, force: true }); console.log("  removido:", d + "/"); }
}

function semLinhasCom(p, agulha) {
  const s = ler(p);
  if (!s.includes(agulha)) { console.log("  " + p + ": ja aplicado"); return; }
  gravar(p, s.split("\n").filter((l) => !l.includes(agulha)).join("\n"));
}

{
  // module-map.ts: a entrada ocupa 4 linhas, entao remove-se o bloco inteiro.
  const p = "app/features/system/module-map.ts";
  const s = ler(p);
  const i = s.indexOf('  "Tracking 360": {');
  if (i === -1) console.log("  module-map.ts: ja aplicado");
  else {
    const fim = s.indexOf("\n  },\n", i);
    if (fim === -1) erro("module-map.ts: bloco do Tracking 360 nao fecha");
    gravar(p, s.slice(0, i) + s.slice(fim + "\n  },\n".length));
  }
}
semLinhasCom("app/features/system/erp-routes.ts", '"Tracking 360": { path: "/tracking"');
semLinhasCom("app/features/system/ErpShell.tsx", 'modulo === "Tracking 360"');
semLinhasCom("app/layout.tsx", 'import "./styles/tracking-360.css";');
{
  const p = "app/components/AppShell.tsx";
  let s = ler(p);
  if (!s.includes("Tracking 360")) console.log("  AppShell.tsx: ja aplicado");
  else {
    s = s.replace(', "Tracking 360"]', "]");
    s = s.split("\n").filter((l) => !l.includes('item === "Tracking 360"')).join("\n");
    if (s.includes("Tracking 360")) erro("AppShell.tsx: sobrou referencia");
    gravar(p, s);
  }
}

console.log(mudou ? "\nOK -- " + mudou + " arquivo(s). Rode: npx tsc --noEmit --incremental false" : "\nNada a fazer: tudo ja aplicado.");
