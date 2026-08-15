import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const tela = ler("../app/features/team/PerformanceWorkspace.tsx");
const funil = ler("../app/features/funil-2/Funil2Workspace.tsx");
const shell = ler("../app/features/system/ErpShell.tsx");
const atividade = ler("../app/features/performance/PerformanceActivityHeartbeat.tsx");
const api = ler("../app/api/performance/route.ts");
const base = ler("../supabase/migrations/20260815180316_performance_canonica_corretor.sql");
const sala = ler("../supabase/migrations/20260815203057_performance_sala_comando_ceo.sql");
const remocao = ler("../supabase/migrations/20260815182228_remover_performance_legada.sql");
const estudo = ler("../docs/estudo-performance-imobiliaria-2026.md");

test("performance vira Sala de Comando e não duplica painel no Funil 2", () => {
  assert.match(tela, /Sala de Comando/);
  assert.match(tela, /Receita e funil/);
  assert.match(tela, /Confiança dos dados/);
  assert.doesNotMatch(funil, /Performance de Atendimento|PerformanceFunil2|id: "performance"/);
});

test("API usa um contrato executivo único e autenticado", () => {
  assert.match(api, /rpc\("performance_sala_comando"/);
  assert.match(api, /supabase\.auth\.getUser/);
  assert.doesNotMatch(api, /performance_painel|performance_resumo_empresa|performance_bolsao_ajustes/);
});

test("mês é a decisão padrão e todo o histórico continua acessível", () => {
  assert.match(tela, /useState<Periodo>\("mes"\)/);
  assert.match(tela, /Todo histórico/);
  assert.match(api, /periodo === "todo"/);
  assert.match(sala, /public\.wa_mensagens/);
  assert.match(sala, /public\.ncrm_evento|public\.perf_eventos/);
  assert.match(sala, /public\.vendas/);
});

test("resultado, risco e confiança ficam separados sem nota geral enganosa", () => {
  assert.match(tela, /LEITURA DO CEO/);
  assert.match(tela, /Margem de contribuição/);
  assert.match(tela, /DECISÕES DE HOJE/);
  assert.doesNotMatch(tela, /Nota de execução|notaExecucao|score geral/i);
});

test("Aquário e Pescado não viram mérito individual", () => {
  assert.match(sala, /public\.aquario_stage_id\(\)/);
  assert.match(sala, /f\.etapa<>'pescado'/);
  assert.match(tela, /Aquário\/Bolsão e Pescado não contam como performance/);
});

test("ausência de ligação bloqueia forecast, ROI e conversão de coorte", () => {
  assert.match(tela, /O PAINEL NÃO VAI INVENTAR/);
  assert.match(tela, /Forecast de receita/);
  assert.match(tela, /ROI e CAC por canal/);
  assert.match(tela, /Conversão por coorte/);
  assert.match(sala, /vendas_vinculadas/);
  assert.match(sala, /negocios_com_valor/);
});

test("corretores são geridos por decisão e amostra, não por volume isolado", () => {
  assert.match(tela, /Sobrecarga/);
  assert.match(tela, /Carteira travada/);
  assert.match(tela, /Resposta em risco/);
  assert.match(tela, /Não classificar sem casos medidos/);
});

test("RPC restringe empresa ao gestor e o corretor ao próprio id", () => {
  assert.match(sala, /public\.can_manage_all\(\)/);
  assert.match(sala, /c\.id=p\.corretor_id/);
  assert.match(sala, /'empresa',case when p\.admin/);
  assert.match(sala, /revoke all on function public\.performance_sala_comando\(date,date\) from public,anon/);
  assert.match(sala, /grant execute on function public\.performance_sala_comando\(date,date\) to authenticated,service_role/);
});

test("atividade real continua sem usar presença ou botão online como produtividade", () => {
  assert.match(shell, /PerformanceActivityHeartbeat/);
  assert.match(atividade, /document\.visibilityState !== "visible"/);
  assert.match(atividade, /OCIOSO_APOS_MS/);
  assert.match(base, /primary key \(corretor_id, bloco_em\)/);
  assert.match(sala, /'minutosErp'/);
  assert.match(tela, /Uso ativo do ERP/);
  assert.match(tela, /não representa horas trabalhadas fora do sistema/);
  assert.doesNotMatch(tela, /tempo online|onlineH/i);
});

test("estudo registra benchmarks, natureza da operação e contrato de métricas", () => {
  assert.match(estudo, /Tese executiva/);
  assert.match(estudo, /Natureza comprovada da operação/);
  assert.match(estudo, /Contrato das métricas/);
  assert.match(estudo, /Zillow/);
  assert.match(estudo, /NAR/);
  assert.match(estudo, /RD Station/);
});

test("estrutura antiga permanece removida sem cascade", () => {
  assert.match(remocao, /drop table if exists public\.perf_snapshots/);
  assert.match(remocao, /drop function if exists public\.performance_corretores/);
  assert.doesNotMatch(remocao, /cascade/i);
  assert.match(sala, /drop function if exists public\.performance_painel\(date,date\)/);
  assert.match(sala, /drop function if exists public\.performance_resumo_empresa\(date,date\)/);
  assert.match(sala, /drop function if exists public\.performance_bolsao_ajustes\(date,date\)/);
  assert.doesNotMatch(sala, /cascade/i);
});
