import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../docs/erp-reestruturacao/P0_PUBLIC_LINKS_HARDENING_DRAFT.sql");
const agendaApi = read("../app/api/agenda-publica/route.ts");
const financingApi = read("../app/api/ficha-publica/route.ts");
const agendaPage = read("../app/agenda/[token]/page.tsx");
const financingPage = read("../app/ficha/[token]/page.tsx");
const publicLinks = read("../app/lib/public-links.ts");
const server = read("../app/lib/supabase/server.ts");
const render = read("../render.yaml");

test("fase A é aditiva, canário é desligado e cutover fica separado", () => {
  assert.match(sql, /DRAFT NÃO APLICADO/);
  assert.match(sql, /Fase A aditiva e reversível/);
  assert.match(sql, /FASE B — CUTOVER SEPARADO/);
  assert.match(render, /PUBLIC_LINK_HARDENING_ENABLED\n\s+value: "false"/);
  assert.doesNotMatch(sql.slice(0, sql.indexOf("FASE B — CUTOVER SEPARADO")), /drop function|drop table|truncate/i);
});

test("tokens V2 são hashes com expiração e revogação", () => {
  for (const column of [
    "token_hash", "token_expira_em", "token_revogado_em",
    "link_token_hash", "link_expira_em", "link_revogada_em",
  ]) assert.match(sql, new RegExp(column));
  assert.match(sql, /extensions\.digest\(token, 'sha256'\)/);
  assert.match(sql, /extensions\.digest\(link_token, 'sha256'\)/);
  assert.match(sql, /extensions\.gen_random_bytes\(32\)/);
  assert.match(sql, /extensions\.gen_random_bytes\(24\)/);
});

test("RPCs públicas V2 só podem ser chamadas pelo servidor", () => {
  for (const signature of [
    "public_link_rate_consume\\(text,text,text\\)",
    "agenda_publica_v2\\(text,date,date,text\\)",
    "ficha_publica_obter_v2\\(text,text\\)",
    "ficha_publica_enviar_v2\\(text,jsonb,text\\)",
  ]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature} to service_role`));
  }
  assert.match(sql, /has_function_privilege\('anon', v_fn, 'execute'\)/);
  assert.match(sql, /has_function_privilege\('authenticated', v_fn, 'execute'\)/);
});

test("limite é persistente, concorrente e não guarda IP ou token bruto", () => {
  assert.match(sql, /create table if not exists public\.public_link_rate_limits/);
  assert.match(sql, /primary key \(scope, subject_hash\)/);
  assert.equal((sql.match(/on conflict \(scope, subject_hash\) do update/g) ?? []).length, 2);
  assert.match(sql, /alter table public\.public_link_rate_limits enable row level security/);
  assert.doesNotMatch(sql, /\bip_address\b|\braw_token\b/i);
  assert.match(publicLinks, /createHmac\("sha256", pepper\)/);
  assert.match(publicLinks, /createHash\("sha256"\)\.update\(token\)/);
});

test("ficha V2 não devolve PII existente e só pode ser enviada uma vez", () => {
  const getBlock = sql.match(/create or replace function public\.ficha_publica_obter_v2[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(getBlock, /'comprador_nome', null/);
  assert.match(getBlock, /'telefone', null/);
  assert.match(getBlock, /'email', null/);
  assert.match(getBlock, /ALREADY_USED/);
  const sendBlock = sql.match(/create or replace function public\.ficha_publica_enviar_v2[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(sendBlock, /for update/);
  assert.match(sendBlock, /preenchida_em is not null/);
  assert.match(sendBlock, /link_revogada_em = now\(\)/);
  assert.match(sendBlock, /consentimento_lgpd = true/);
  const regenerateBlock = sql.match(/create or replace function public\.financiamento_link_regenerar_v2[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(regenerateBlock, /and preenchida_em is null/);
  assert.doesNotMatch(regenerateBlock, /preenchida_em\s*=\s*null/);
});

test("agenda V2 minimiza cliente e local por padrão", () => {
  assert.match(sql, /expor_cliente boolean not null default false/);
  assert.match(sql, /expor_local boolean not null default false/);
  assert.match(sql, /when v_share\.expor_cliente[\s\S]*?split_part/);
  assert.match(sql, /when v_share\.expor_local then coalesce\(v\.local, ''\) else '' end/);
});

test("navegador não repete token nas URLs ou no corpo da API", () => {
  assert.doesNotMatch(agendaPage, /agenda-publica\?token=/);
  assert.doesNotMatch(financingPage, /ficha-publica\?token=/);
  assert.match(agendaPage, /"X-Apecerto-Public-Token": token/);
  assert.match(financingPage, /"X-Apecerto-Public-Token": token/);
  assert.doesNotMatch(financingPage, /JSON\.stringify\(\{\s*token,/);
});

test("APIs falham fechadas, não vazam erro SQL e desabilitam cache", () => {
  for (const route of [agendaApi, financingApi]) {
    assert.match(route, /publicNoStoreHeaders/);
    assert.match(route, /publicLinkHardeningEnabled/);
    assert.match(route, /createServerSupabaseServiceClient/);
    assert.doesNotMatch(route, /error\.message/);
  }
  assert.match(financingApi, /contentLength > 32_768/);
  assert.match(financingApi, /new TextEncoder\(\)\.encode\(rawBody\)\.byteLength > 32_768/);
  assert.match(financingApi, /JSON inválido/);
  assert.match(financingApi, /status, headers: publicNoStoreHeaders/);
  assert.match(agendaApi, /status, headers: publicNoStoreHeaders/);
});

test("service_role permanece exclusivamente no módulo servidor", () => {
  assert.match(server, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(server, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(publicLinks, /process\.env\.PUBLIC_LINK_RATE_LIMIT_PEPPER/);
  assert.doesNotMatch(publicLinks, /NEXT_PUBLIC_/);
});
