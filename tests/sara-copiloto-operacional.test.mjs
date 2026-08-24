import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const router = ler("../supabase/functions/ia-router/index.ts");
const migration = ler("../supabase/migrations/20260824213000_sara_copiloto_operacional_v1.sql");
const laboratorio = ler("../app/features/agents/AgentTrainingWorkspace.tsx");

test("ia-router valida a sessao no servidor e nao confia em decode local do JWT", () => {
  assert.match(router, /supabase\.auth\.getUser\(token\)/);
  assert.match(router, /reason:"sessao_invalida"/);
  assert.doesNotMatch(router, /atob\(/);
});

test("perfil, corretor e permissoes por perfil limitam as ferramentas", () => {
  assert.match(router, /select\("role,ativo"\)/);
  assert.match(router, /perfilOperacional|perfil_operacional_nao_encontrado/i);
  assert.match(router, /perfis_autorizados/);
  assert.match(router, /perfis\.includes\(perfilFerramenta\)/);
});

test("busca de lead e conversa passam pelas RPCs seguras", () => {
  assert.match(router, /ia_localizar_leads_seguro/);
  assert.match(router, /ia_conversa_segura/);
  assert.doesNotMatch(router, /from\("leads"\)\.select\("id,nome,telefone,status,origem"\)/);
  assert.match(migration, /v_role in \('admin','gerente'\) or f\.corretor_id=v_corretor/);
});

test("tarefa usa data e hora exatas e exige previa", () => {
  assert.match(router, /vencimento_em/);
  assert.match(router, /ia_criar_tarefa_v2/);
  assert.match(migration, /p_vencimento_em is null or p_vencimento_em<=now\(\)/);
  assert.match(migration, /'preview',true/);
});

test("Sara agenda visita real pela RPC canonica com confirmacao", () => {
  assert.match(router, /"agendar-visita"/);
  assert.match(router, /name:"agendar_visita"/);
  assert.match(router, /args\.confirmar!==true/);
  assert.match(router, /userSupabase\.rpc\("f2_salvar_visita"/);
  assert.match(migration, /'agendar-visita','Agendar visita real'/);
  assert.match(migration, /values\('agendar-visita'[\s\S]*'f2_salvar_visita',true,true\)/);
});

test("gpt-5.6 usa reasoning none quando houver ferramentas", () => {
  assert.match(router, /body\.reasoning_effort = tools\.length\s*\?\s*"none"/);
});

test("RPCs legadas sensiveis deixam de ficar abertas ao Data API", () => {
  assert.match(migration, /revoke all on function public\.ia_lead\(text\) from public,anon,authenticated/);
  assert.match(migration, /revoke all on function public\.ia_conversa\(text,integer\) from public,anon,authenticated/);
  assert.match(migration, /grant execute on function public\.ia_lead\(text\) to service_role/);
});

test("laboratorio preserva o modelo publicado ao salvar", () => {
  assert.match(laboratorio, /"gpt-5\.4-nano"/);
  assert.match(laboratorio, /"gpt-5\.4-mini"/);
  assert.match(laboratorio, /"gpt-5\.6-sol"/);
});

test("treinamento cobre ambiguidade, visita vaga, confirmacao e LGPD", () => {
  assert.match(migration, /Nao estou achando o lead Ana/);
  assert.match(migration, /amanha de tarde/);
  assert.match(migration, /Sim, confirmo a visita exatamente como voce mostrou/);
  assert.match(migration, /conversas de todos os corretores/);
});
