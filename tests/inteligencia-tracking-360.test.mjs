import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260820213000_inteligencia_decisao_unificada.sql", import.meta.url), "utf8");
const migrationF2 = readFileSync(new URL("../supabase/migrations/20260820230000_inteligencia_funil_2_canonico.sql", import.meta.url), "utf8");
const telemetria = readFileSync(new URL("../supabase/migrations/20260820233000_inteligencia_horas_e_pulos.sql", import.meta.url), "utf8");
const adsRead = readFileSync(new URL("../supabase/functions/marketing-ads-read/index.ts", import.meta.url), "utf8");
const cleanup = readFileSync(new URL("../supabase/migrations/20260820214000_inteligencia_remover_camadas_antigas.sql", import.meta.url), "utf8");
const cleanupSnapshot = readFileSync(new URL("../supabase/migrations/20260820215000_inteligencia_remover_snapshot_antigo.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/inteligencia/route.ts", import.meta.url), "utf8");
const operacao = readFileSync(new URL("../app/features/inteligencia/telas/VisaoEmpresa.tsx", import.meta.url), "utf8");
const presencaApi = readFileSync(new URL("../app/api/presenca/route.ts", import.meta.url), "utf8");
const presencaHeartbeat = readFileSync(new URL("../app/features/presence/PresenceHeartbeat.tsx", import.meta.url), "utf8");
const marketing = readFileSync(new URL("../app/features/inteligencia/telas/VisaoDigital.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/features/inteligencia/CascaInteligencia.tsx", import.meta.url), "utf8");
const catalogo = readFileSync(new URL("../app/features/inteligencia/telas.ts", import.meta.url), "utf8");

test("mantém somente as duas áreas de decisão na interface", () => {
  assert.match(catalogo, /Marketing, site e tracking/);
  assert.match(catalogo, /Empresa e operação/);
  assert.doesNotMatch(shell, /Páginas da família|int-paginas|telasPublicadas/);
  assert.doesNotMatch(shell, /DADOS PARCIAIS|DEMONSTRAÇÃO|números ilustrativos/);
  assert.equal(existsSync(new URL("../app/features/inteligencia/registro.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/api/inteligencia/[tela]/route.ts", import.meta.url)), false);
});

test("as duas RPCs canônicas são protegidas e dados ausentes nunca são inventados", () => {
  for (const nome of ["tracking_360_ceo", "tracking_360_jornada_digital"]) {
    assert.match(migration, new RegExp(`security definer[\\s\\S]*revoke all on function public\\.${nome}\\(integer\\) from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${nome}\\(integer\\) to authenticated, service_role`));
  }
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /'horas_erp', null/);
  assert.match(migration, /'pulos_distribuicao', null/);
});

test("horas e pulos passam a ter histórico canônico sem reconstruir o passado", () => {
  for (const fonte of ["corretor_atividade_estado", "corretor_atividade_diaria", "motor_roleta_eventos"]) {
    assert.match(telemetria, new RegExp(fonte));
  }
  assert.match(telemetria, /resultado in \('recebeu','aguardou','pulado'\)/);
  assert.match(telemetria, /rodizio_normal/);
  assert.match(telemetria, /intervalos suspensos não entram/i);
  assert.match(telemetria, /revoke all on ncrm_private\.inteligencia_telemetria_config/);
  assert.match(telemetria, /revoke all on function public\.corretor_atividade_heartbeat\(boolean,boolean\)/);
  assert.match(presencaApi, /corretor_atividade_heartbeat/);
  assert.match(presencaHeartbeat, /document\.visibilityState/);
  assert.match(presencaHeartbeat, /ultimaInteracao/);
  assert.match(operacao, /Trabalho e presença/);
  assert.match(operacao, /Pulos por inelegibilidade/);
  assert.match(operacao, /atividade_diaria/);
});

test("empresa e operação usam CRM, presença, IA, mensagens, visitas e vendas reais", () => {
  for (const fonte of ["corretor_presencas", "ia_notas_atendimento", "wa_mensagens", "visitas", "vendas", "f2_lead"]) {
    assert.ok(migrationF2.includes(fonte), `faltou ${fonte}`);
  }
  assert.match(migrationF2, /f2_active as \(select \* from f2_all where descartado_em is null\)/);
  assert.match(migrationF2, /todo lead sem card ativo/);
  assert.match(operacao, /useResumoInteligencia\(accessToken, recorte\.periodo\)/);
  assert.match(operacao, /Funil 2\.0 e Bolsão/);
  assert.match(operacao, /Conversão comparável/);
  assert.match(operacao, /Qualidade do atendimento/);
  assert.match(operacao, /Resultado e presença/);
  assert.doesNotMatch(operacao, /const demo/);
});

test("marketing liga campanha a lead, visita e venda e lê Meta/Google sem inventar conexão", () => {
  for (const trecho of ["lead_campaign", "campaign_outcomes", "visitas_realizadas", "vendas", "vgv", "lead_attribution", "tracking_delivery_logs"]) {
    assert.ok(migration.includes(trecho), `faltou ${trecho}`);
  }
  assert.match(migration, /null::numeric investimento/);
  assert.match(marketing, /Campanha, conjunto e anúncio/);
  assert.match(marketing, /Meta Pixel \+ CAPI/);
  assert.match(marketing, /Google Ads/);
  assert.match(marketing, /Google Tag Manager/);
  assert.match(adsRead, /META_ADS_TOKEN/);
  assert.match(adsRead, /GOOGLE_ADS_DEVELOPER_TOKEN/);
  assert.match(adsRead, /me\/adaccounts/);
  assert.doesNotMatch(marketing, /const demo/);
});

test("endpoint consulta apenas as duas fontes canônicas e exige gestão", () => {
  assert.match(api, /supabase\.auth\.getUser\(token\)/);
  assert.match(api, /rolesGestao/);
  assert.match(api, /tracking_360_ceo/);
  assert.match(api, /tracking_360_jornada_digital/);
  assert.doesNotMatch(api, /tracking_360_digital_health|tracking_delivery_health/);
  assert.match(api, /private, no-store/);
});

test("a publicação remove as RPCs da arquitetura anterior", () => {
  for (const nome of ["intel_visao_ceo", "intel_visao_digital", "intel_aquisicao", "intel_corretores", "tracking_360_digital_health", "tracking_delivery_health"]) {
    assert.match(cleanup, new RegExp(`drop function if exists public\\.${nome}`));
  }
  assert.match(cleanupSnapshot, /drop function if exists public\.tracking_360_snapshot\(integer\)/);
  assert.doesNotMatch(api + shell + catalogo, /intel_visao_ceo|intel_visao_digital|tracking_360_digital_health|tracking_delivery_health/);
});
