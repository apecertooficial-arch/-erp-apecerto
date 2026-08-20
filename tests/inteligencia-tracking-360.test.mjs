import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260820213000_inteligencia_decisao_unificada.sql", import.meta.url), "utf8");
const cleanup = readFileSync(new URL("../supabase/migrations/20260820214000_inteligencia_remover_camadas_antigas.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/inteligencia/route.ts", import.meta.url), "utf8");
const operacao = readFileSync(new URL("../app/features/inteligencia/telas/VisaoEmpresa.tsx", import.meta.url), "utf8");
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

test("as duas RPCs canônicas são protegidas e não inventam horas ou pulos", () => {
  for (const nome of ["tracking_360_ceo", "tracking_360_jornada_digital"]) {
    assert.match(migration, new RegExp(`security definer[\\s\\S]*revoke all on function public\\.${nome}\\(integer\\) from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${nome}\\(integer\\) to authenticated, service_role`));
  }
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /'horas_erp', null/);
  assert.match(migration, /'pulos_distribuicao', null/);
});

test("empresa e operação usam CRM, presença, IA, mensagens, visitas e vendas reais", () => {
  for (const fonte of ["corretor_presencas", "ia_notas_atendimento", "perf_eventos", "visitas", "vendas", "f2_lead"]) {
    assert.ok(migration.includes(fonte), `faltou ${fonte}`);
  }
  assert.match(operacao, /useResumoInteligencia\(accessToken, recorte\.periodo\)/);
  assert.match(operacao, /Carteira e velocidade/);
  assert.match(operacao, /Visitas e resultado/);
  assert.match(operacao, /Atendimento observado/);
  assert.match(operacao, /Presença e captação/);
  assert.doesNotMatch(operacao, /const demo/);
});

test("marketing liga campanha a lead, visita e venda e declara mídia ausente", () => {
  for (const trecho of ["lead_campaign", "campaign_outcomes", "visitas_realizadas", "vendas", "vgv", "lead_attribution", "tracking_delivery_logs"]) {
    assert.ok(migration.includes(trecho), `faltou ${trecho}`);
  }
  assert.match(migration, /null::numeric investimento/);
  assert.match(marketing, /Qual campanha vira visita e venda/);
  assert.match(marketing, /Meta Pixel \/ API de Conversões/);
  assert.match(marketing, /Google Ads \/ Analytics/);
  assert.match(marketing, /Google Tag Manager/);
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
  assert.doesNotMatch(api + shell + catalogo, /intel_visao_ceo|intel_visao_digital|tracking_360_digital_health|tracking_delivery_health/);
});
