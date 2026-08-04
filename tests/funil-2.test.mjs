import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const gate = readFileSync(new URL("../app/features/crm-nova-era/CrmNovaEraGate.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260810150000_funil_2_isolado.sql", import.meta.url), "utf8");
const clareza = readFileSync(new URL("../supabase/migrations/20260810160000_funil_2_cadencia_clara.sql", import.meta.url), "utf8");
const operacao = readFileSync(new URL("../supabase/migrations/20260810170000_funil_2_operacao_completa.sql", import.meta.url), "utf8");
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
  assert.match(clareza, /'momento_alterado'/);
  assert.match(clareza, /'mesmo_momento',v_mesmo/);
  assert.match(clareza, /v_atual\.momento_codigo<>'CADENCIA_SEM_RESPOSTA'/);
  assert.match(clareza, /v_dias_cadencia\[v_passo\+1\]-v_dias_cadencia\[v_passo\]/);
});

test("Meu Dia mostra cliente, etapa, momento, ação, tempo e central de atenção", () => {
  for (const texto of ["SEU PLANO DE TRABALHO", "Etapa e momento", "Ação oficial", "Tempo", "CENTRAL DE ATENÇÃO"]) assert.match(ui, new RegExp(texto));
  assert.match(ui, /ações atrasadas/);
  assert.match(ui, /vencem em até 2h/);
});

test("laboratório entrega abas operacionais e pesca sem tocar no legado", () => {
  for (const texto of ["Todos os Leads", "Pipe de Visitas", "Esteira de Vendas", "Configurações da operação", "Pescar um lead"]) assert.match(ui, new RegExp(texto));
  for (const objeto of ["f2_etapa_config", "f2_visita", "f2_negociacao", "f2_config_audit"]) assert.match(operacao, new RegExp(`CREATE TABLE public\\.${objeto}`));
  assert.match(operacao, /f2_pescar_negocio/);
  assert.doesNotMatch(operacao, /UPDATE public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
  assert.doesNotMatch(operacao, /DELETE FROM public\.(?:ncrm_estado|negocios|leads|visitas|vendas)/);
});

test("etapas e momentos são configuráveis com proteção administrativa", () => {
  assert.match(ui, /Horas permitidas/);
  assert.match(ui, /Salvar momento e prazo/);
  assert.match(operacao, /f2_configurar_etapa/);
  assert.match(operacao, /f2_configurar_momento/);
  assert.match(operacao, /etapa_em_uso/);
  assert.match(operacao, /momento_em_uso/);
});
