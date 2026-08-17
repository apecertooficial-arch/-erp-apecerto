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
const ampliacao = ler("../supabase/migrations/20260815215004_ampliar_performance_trabalho_execucao.sql");
const remocao = ler("../supabase/migrations/20260815182228_remover_performance_legada.sql");
const estudo = ler("../docs/estudo-performance-imobiliaria-2026.md");
const catalogo = ler("../docs/catalogo-metricas-performance.md");

test("performance é dividida em vendas, trabalho e atendimento sem duplicar o Funil 2", () => {
  assert.match(tela, /nome: "Vendas"/);
  assert.match(tela, /nome: "Trabalho"/);
  assert.match(tela, /nome: "Atendimento e conduta"/);
  assert.doesNotMatch(tela, /nome: "Sala de comando"|nome: "Receita e funil"|nome: "Corretores"|nome: "Confiança dos dados"/);
  assert.doesNotMatch(funil, /Performance de Atendimento|PerformanceFunil2|id: "performance"/);
});

test("API usa um contrato executivo único e autenticado", () => {
  assert.match(api, /rpc\("performance_sala_comando"/);
  assert.match(api, /supabase\.auth\.getUser/);
  assert.doesNotMatch(api, /performance_painel|performance_resumo_empresa|performance_bolsao_ajustes/);
});

test("todo o histórico é a leitura padrão e períodos menores continuam acessíveis", () => {
  assert.match(tela, /useState<Periodo>\("todo"\)/);
  assert.match(tela, /Todo histórico/);
  assert.match(api, /periodo === "todo"/);
  assert.match(sala, /public\.wa_mensagens/);
  assert.match(sala, /public\.ncrm_evento|public\.perf_eventos/);
  assert.match(sala, /public\.vendas/);
  assert.match(ampliacao, /public\.wa_mensagens/);
  assert.match(ampliacao, /public\.ncrm_evento/);
  assert.match(ampliacao, /public\.f2_evento/);
});

test("resultado, risco e confiança ficam separados sem nota geral enganosa", () => {
  assert.match(tela, /RESULTADO COMERCIAL/);
  assert.match(tela, /Margem de contribuição/);
  assert.match(tela, /TRABALHO COMPROVADO/);
  assert.match(tela, /ATENDIMENTO E CONDUTA/);
  assert.doesNotMatch(tela, /Nota de execução|notaExecucao|score geral/i);
});

test("Aquário e Pescado não viram mérito individual", () => {
  assert.match(sala, /public\.aquario_stage_id\(\)/);
  assert.match(sala, /f\.etapa<>'pescado'/);
  assert.match(tela, /Bolsão, Aquário e a ação de pescar estão fora da performance individual/);
  assert.match(tela, /Esse estoque histórico não gera trabalho, produção ou mérito/);
});

test("ausência de ligação bloqueia forecast, ROI e conversão de coorte", () => {
  assert.match(tela, /Limite desta leitura/);
  assert.match(tela, /não conversão de coorte/);
  assert.match(tela, /Volumes do período; não é uma coorte/);
  assert.match(tela, /volumes do período; bases diferentes/);
  assert.doesNotMatch(tela, /taxa\(c\.producao\.contatosTrabalhados, c\.producao\.leadsRecebidos\)/);
  assert.match(sala, /vendas_vinculadas/);
  assert.match(sala, /negocios_com_valor/);
});

test("o mesmo corretor pode ser analisado nos três eixos e amostra ausente não vira zero", () => {
  assert.match(tela, /Quem analisar/);
  assert.match(tela, /Clique em uma pessoa para investigar os três eixos/);
  assert.match(tela, /não classificar/);
  assert.match(tela, /ausência de amostra nunca vira nota zero/);
});

test("RPC restringe empresa ao gestor e o corretor ao próprio id", () => {
  assert.match(sala, /public\.can_manage_all\(\)/);
  assert.match(sala, /c\.id=p\.corretor_id/);
  assert.match(sala, /'empresa',case when p\.admin/);
  assert.match(sala, /revoke all on function public\.performance_sala_comando\(date,date\) from public,anon/);
  assert.match(sala, /grant execute on function public\.performance_sala_comando\(date,date\) to authenticated,service_role/);
  assert.match(ampliacao, /public\.can_manage_all\(\)/);
  assert.match(ampliacao, /c\.id=p\.corretor_id/);
  assert.match(ampliacao, /revoke all on function public\.performance_sala_comando\(date,date\) from public,anon/);
});

test("atividade real continua sem usar presença ou botão online como produtividade", () => {
  assert.match(shell, /PerformanceActivityHeartbeat/);
  assert.match(atividade, /document\.visibilityState !== "visible"/);
  assert.match(atividade, /OCIOSO_APOS_MS/);
  assert.match(base, /primary key \(corretor_id, bloco_em\)/);
  assert.match(ampliacao, /'minutosAtivosErp'/);
  assert.match(ampliacao, /date_bin\(interval '5 minutes'/);
  assert.match(ampliacao, /pe\.tipo not in \('online','login'/);
  assert.match(tela, /Uso ativo do ERP/);
  assert.match(tela, /não representa horas trabalhistas/);
  assert.doesNotMatch(tela, /tempo online|onlineH/i);
});

test("trabalho real mede comunicação, CRM, Meu Dia e produção separadamente", () => {
  assert.match(ampliacao, /'trabalho',jsonb_build_object/);
  assert.match(ampliacao, /'meuDia',jsonb_build_object/);
  assert.match(ampliacao, /'producao',jsonb_build_object/);
  assert.match(ampliacao, /'mensagensEnviadas'/);
  assert.match(ampliacao, /'contatosBilaterais'/);
  assert.match(ampliacao, /'acoesComerciais'/);
  assert.match(ampliacao, /'tarefasConcluidasCoorte'/);
  assert.match(tela, /TRABALHO COMPROVADO/);
  assert.match(tela, /DISCIPLINA OPERACIONAL/);
  assert.match(tela, /Ações registradas/);
});

test("atendimento expõe cauda de resposta e dimensões da IA com amostra", () => {
  assert.match(ampliacao, /'atendimento',jsonb_build_object/);
  assert.match(ampliacao, /'respostaP50Min'/);
  assert.match(ampliacao, /'respostaP75Min'/);
  assert.match(ampliacao, /'respostaP90Min'/);
  assert.match(ampliacao, /'sla2Pct'/);
  assert.match(ampliacao, /'sla5Pct'/);
  assert.match(ampliacao, /'sla15Pct'/);
  assert.match(ampliacao, /'sla60Pct'/);
  assert.match(tela, /VELOCIDADE E RECIPROCIDADE/);
  assert.match(tela, /QUALIDADE DA CONVERSA/);
});

test("Aquário e Pescado seguem excluídos também da ampliação operacional", () => {
  assert.match(ampliacao, /public\.aquario_stage_id\(\)/);
  assert.match(ampliacao, /f\.etapa<>'pescado'/);
  assert.match(ampliacao, /f\.etapa='visita'/);
});

test("estudo registra benchmarks, natureza da operação e contrato de métricas", () => {
  assert.match(estudo, /Tese executiva/);
  assert.match(estudo, /Natureza comprovada da operação/);
  assert.match(estudo, /Contrato das métricas/);
  assert.match(estudo, /Zillow/);
  assert.match(estudo, /NAR/);
  assert.match(estudo, /RD Station/);
});

test("catálogo distingue métrica pronta, cobertura parcial e captura inexistente", () => {
  assert.match(catalogo, /Disponível na Sala de Comando/);
  assert.match(catalogo, /Disponível com cobertura limitada/);
  assert.match(catalogo, /Ainda sem fonte confiável no ERP/);
  assert.match(catalogo, /Aquário\/Bolsão e a etapa Pescado/);
  assert.match(catalogo, /não é jornada trabalhista/);
  assert.match(catalogo, /mídia: investimento, impressões, cliques/);
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
