import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const gate = readFileSync(new URL("../app/features/crm-nova-era/CrmNovaEraGate.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260810150000_funil_2_isolado.sql", import.meta.url), "utf8");
const clareza = readFileSync(new URL("../supabase/migrations/20260810160000_funil_2_cadencia_clara.sql", import.meta.url), "utf8");
const modelo = readFileSync(new URL("../app/features/funil-2/modelo.ts", import.meta.url), "utf8");

test("Funil 2.0 se apresenta como laboratório isolado de duas cópias", () => {
  assert.match(ui, /LABORATÓRIO ISOLADO/);
  assert.match(ui, /Originais intactos/);
  assert.match(ui, /limite físico de 2 leads/);
  assert.match(migration, /funil_2_limite_dois_leads/);
});

test("quadro deixa etapa, momento, ação e prazo explícitos", () => {
  for (const texto of ["MOMENTO", "FAÇA AGORA", "O QUE FAZER AGORA", "Próxima ação", "Prazo padrão"]) assert.match(ui, new RegExp(texto));
  assert.match(ui, /<select value=\{codigo\}/);
});

test("sandbox não escreve em tabelas operacionais e tem dez momentos", () => {
  const criacoes = [...migration.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(criacoes, ["f2_momento_config", "f2_lead", "f2_evento"]);
  assert.equal((migration.match(/^ \('[A-Z_]+','/gm) ?? []).length, 10);
  assert.doesNotMatch(migration, /UPDATE public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(migration, /DELETE FROM public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
});

test("acesso visual é explícito e administrativo; RLS repete a regra", () => {
  assert.match(gate, /pedeFunil2/);
  assert.match(gate, /podeFunil2/);
  assert.match(gate, /Funil2Workspace/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /CREATE POLICY f2_lead_admin_select/);
  assert.match(migration, /REVOKE ALL ON public\.f2_momento_config,public\.f2_lead,public\.f2_evento FROM PUBLIC,anon/);
});

test("mensagem precisa de confirmação D-API e toda mudança gera histórico", () => {
  assert.match(migration, /confirmacao_dapi_obrigatoria/);
  assert.match(migration, /'acao_confirmada'/);
  assert.match(migration, /'sara_reavaliou'/);
  assert.match(ui, /Simular evidência confirmada/);
  assert.match(ui, /o webhook do D-API executará esta confirmação/);
});

test("cadência mostra o dia oficial como ação executável", () => {
  assert.match(modelo, /DIAS_CADENCIA = \[1, 2, 4, 6, 7\]/);
  assert.match(ui, /CADÊNCIA OFICIAL · DIA/);
  assert.match(ui, /Abrir WhatsApp · enviar Dia/);
  assert.match(ui, /A conclusão vem do D-API/);
});

test("card e ficha oferecem conversa e atalhos operacionais", () => {
  assert.match(ui, />💬 Chat</);
  assert.match(ui, /Histórico do WhatsApp/);
  assert.match(ui, /Agendar visita/);
  assert.match(ui, /Gerar negociação/);
});

test("mesmo momento pode ser revalidado sem reiniciar a cadência", () => {
  assert.match(ui, /Continua neste momento · atualizar prazo/);
  assert.match(clareza, /'momento_revalidado'/);
  assert.match(clareza, /v_atual\.momento_codigo<>'CADENCIA_SEM_RESPOSTA'/);
  assert.match(clareza, /v_dias_cadencia\[v_passo\+1\]-v_dias_cadencia\[v_passo\]/);
});
