import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mutateMetaAtomic } from "../app/api/metas/mutation-rpc.ts";

const rota = readFileSync(new URL("../app/api/metas/route.ts", import.meta.url), "utf8");
const tela = readFileSync(new URL("../app/features/finance/FinanceWorkspace.tsx", import.meta.url), "utf8");
const harness = readFileSync(new URL("./finance-visual-harness/main.tsx", import.meta.url), "utf8");
const estilos = readFileSync(new URL("../app/styles/redesign-apecerto-financeiro-abas.css", import.meta.url), "utf8");

function fakeClient(response) {
  const calls = [];
  return { calls, rpc(fn, args) { calls.push({ fn, args }); return Promise.resolve(response); } };
}

test("metas não expõe mensagem SQL nem payload em resposta ou log", () => {
  assert.doesNotMatch(rota, /Response\.json\(\{ error: error\.message/);
  assert.doesNotMatch(rota, /console\.error\([^\n]*(message|body|metaVgv|metaVendas)/);
  assert.match(rota, /erro: semPermissao \? "sem_permissao" : "falha_banco"/);
});

test("falha ao ler o papel não é disfarçada de acesso negado", () => {
  assert.match(rota, /data: me, error: meError/);
  assert.match(rota, /if \(meError\) return falhaMetas\(meError, "autorizar_alteracao"\)/);
  assert.match(rota, /papelNoGrupo\(me\.role, "metas"\)/);
});

test("salvar e apagar usam apenas a RPC atômica", async () => {
  const patch = rota.slice(rota.indexOf("export async function PATCH"));
  assert.match(patch, /mutateMetaAtomic/);
  assert.doesNotMatch(patch, /\.from\("metas"\)\.(?:insert|update|delete)/);
  const client = fakeClient({ data: { meta_id: "meta-1", operacao: "salvar", idempotente: false }, error: null });
  const response = await mutateMetaAtomic(client, { operation: "salvar", metaId: null, requestId: "req-1", payload: { ano: 2026 } });
  assert.deepEqual(client.calls, [{ fn: "metas_mutar", args: { p_operacao: "salvar", p_meta_id: null, p_request_id: "req-1", payload: { ano: 2026 } } }]);
  assert.deepEqual(response.body, { success: true, metaId: "meta-1", operation: "salvar", idempotent: false });
});

test("período, valores e corretor são validados sem coerção silenciosa", () => {
  assert.match(rota, /periodoTipo === "mensal"[\s\S]*periodo <= 12/);
  assert.match(rota, /periodoTipo === "semestral"[\s\S]*periodo <= 2/);
  assert.match(rota, /periodoTipo === "anual" && periodo === 0/);
  assert.match(rota, /!Number\.isFinite\(metaVgv\) \|\| metaVgv < 0/);
  assert.match(rota, /!Number\.isInteger\(metaVendas\) \|\| metaVendas < 0/);
  assert.match(rota, /metaVgvVazio \|\| metaVendasVazio/);
  assert.match(rota, /corretorId <= 0/);
  assert.doesNotMatch(rota, /Number\(body\.metaVgv\) \|\| 0/);
});

test("migration serializa, audita e deduplica todas as mutações de meta", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924033000_metas_mutacao_atomica.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists erp_auditoria_metas_request_uidx/);
  assert.match(sql, /create or replace function public\.metas_mutar/);
  assert.match(sql, /language plpgsql\s+security invoker/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_request_id::text,0\)\)/);
  assert.match(sql, /insert into public\.metas/);
  assert.match(sql, /update public\.metas/);
  assert.match(sql, /delete from public\.metas/);
  assert.match(sql, /insert into public\.erp_auditoria/);
  assert.match(sql, /revoke all on function public\.metas_mutar\(text,uuid,uuid,jsonb\) from public,anon/);
  assert.match(sql, /grant execute on function public\.metas_mutar\(text,uuid,uuid,jsonb\) to authenticated,service_role/);
});

test("interface mantém UUID estável por conteúdo até a confirmação", () => {
  assert.match(tela, /const mutationRequests = useRef\(new Map<string, string>\(\)\)/);
  assert.match(tela, /mutationRequests\.current\.get\(mutationKey\) \?\? crypto\.randomUUID\(\)/);
  assert.match(tela, /body: JSON\.stringify\(\{ \.\.\.mutationPayload, requestId \}\)/);
  assert.match(tela, /body: JSON\.stringify\(\{ action: "delete", id, requestId \}\)/);
});

test("interface não transforma falha em lista vazia nem confirma remoção rejeitada", () => {
  assert.match(tela, /if \(!response\.ok\) throw new Error\(payload\.error \|\| "Não foi possível carregar as metas\."\)/);
  assert.match(tela, /if \(!response\.ok\) throw new Error\(payload\.error \|\| "Não foi possível apagar a meta\."\)/);
  assert.match(tela, /metaVgv: form\.metaVgv, metaVendas: form\.metaVendas/);
  assert.match(tela, /A lista não pôde ser atualizada; recarregue a tela antes de repetir/);
  assert.match(tela, /metasStatus === "error" \? "Indisponível"/);
  assert.match(tela, /role="alert"[\s\S]*Tentar novamente/);
});

test("harness visual exercita a falha de Metas sem liberar mutações", () => {
  assert.match(harness, /"metaserror"/);
  assert.match(harness, /url\.pathname === "\/api\/metas"/);
  assert.match(harness, /estado === "metaserror"[\s\S]*sessionRole="admin"/);
  assert.match(harness, /method !== "GET" \|\| url\.origin !== window\.location\.origin/);
  assert.match(estilos, /\.finance-goal-panel \.finance-error-state/);
  assert.match(estilos, /\.finance-error-state button[^{]*\{[^}]*min-height:44px/);
});
