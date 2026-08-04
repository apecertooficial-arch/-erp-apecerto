import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const edge = readFileSync(new URL("../supabase/functions/f2-sara-reclassificar/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260811020000_funil_2_sara_reclassificacao.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const historico = readFileSync(new URL("../supabase/migrations/20260811034000_funil_2_historico_completo.sql", import.meta.url), "utf8");
const visitas = readFileSync(new URL("../supabase/migrations/20260811035000_funil_2_visitas_com_feedback.sql", import.meta.url), "utf8");
const gate = readFileSync(new URL("../app/features/crm-nova-era/CrmNovaEraGate.tsx", import.meta.url), "utf8");
const respostaInstanciasApp = readFileSync(new URL("../supabase/migrations/20260811037000_funil_2_resposta_instancias_app.sql", import.meta.url), "utf8");

test("worker exige segredo antes de ler o banco", () => {
  const auth = edge.indexOf("segredoIgual(req.headers.get");
  const client = edge.indexOf("createClient(SUPABASE_URL");
  assert.ok(auth > 0 && client > auth);
  assert.match(edge, /status:401/);
});

test("worker só usa o catálogo ativo e nunca envia WhatsApp", () => {
  assert.match(edge, /from\("f2_momento_config"\)/);
  assert.match(edge, /\.eq\("ativo",true\)/);
  assert.match(edge, /momento = catalogo\.find/);
  assert.doesNotMatch(edge, /dapi-enviar|enviar-whatsapp|messages\/send/);
});

test("sem histórico preserva classificação; ausência de resposta usa cadência", () => {
  assert.match(edge, /status:"sem_historico"/);
  assert.match(edge, /classificação anterior preservada/);
  assert.match(edge, /momento_codigo:"CADENCIA_SEM_RESPOSTA"/);
  assert.match(edge, /!entradas\.length && saidas\.length/);
});

test("evidência da IA precisa existir literalmente na fala do cliente", () => {
  assert.match(edge, /falasCliente/);
  assert.match(edge, /fala\.includes\(e\.toLowerCase\(\)\)/);
  assert.match(migration, /p_origem='ia'.*p_momento_codigo<>'CADENCIA_SEM_RESPOSTA'/s);
  assert.match(migration, /jsonb_array_length/);
});

test("persistência é service-role-only, idempotente e isolada no f2", () => {
  assert.match(migration, /UNIQUE\(funil_lead_id,context_hash\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.f2_sara_registrar_classificacao[\s\S]*TO service_role/);
  assert.doesNotMatch(migration, /UPDATE public\.(?:negocios|leads|visitas|vendas|ncrm_estado)/);
  assert.doesNotMatch(migration, /DELETE FROM public\.(?:negocios|leads|visitas|vendas|ncrm_estado)/);
});

test("API e tela passam a refletir o estado real do worker", () => {
  assert.match(route, /from\("f2_sara_config"\)/);
  assert.match(route, /from\("f2_sara_analise"\)/);
  assert.match(route, /reavaliacaoAutomaticaFunil2: saraF2Config\?\.enabled === true/);
});

test("carteira migrada lê histórico completo e pesca mantém corte", () => {
  assert.match(historico, /historico_completo boolean NOT NULL DEFAULT false/);
  assert.match(historico, /Migrado dos pipes antigos/);
  assert.match(historico, /f2_historico_vinculo/);
  assert.match(historico, /HAVING count\(\*\)=1/);
  assert.match(edge, /c\.historico_completo \|\| Date\.parse/);
});

test("visita movimenta o lead e exige feedback para encerrar a cobrança", () => {
  assert.match(visitas, /VISITA_AGENDADA/);
  assert.match(visitas, /COLETAR_FEEDBACK/);
  assert.match(visitas, /ACOMPANHAMENTO_POS_VISITA/);
  assert.match(visitas, /feedback_visita_min/);
  assert.match(visitas, /feedback obrigatório/);
});

test("aplicativo de qualquer corretor usa o mesmo Funil 2.0 com RLS por carteira", () => {
  assert.match(gate, /ehCelular === true[\s\S]*<Funil2Workspace/);
  assert.doesNotMatch(gate, /ehCelular === true[\s\S]*if \(podeFunil2\)/);
  assert.match(respostaInstanciasApp, /f2_pode_operar_lead/);
});
