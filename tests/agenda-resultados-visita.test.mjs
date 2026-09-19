import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RESULTADOS_VISITA, resultadoPermitido, rotuloAtrasoResultado, resumirCobrancasGerenciais, resumirCobrancasPorCorretor, validarResultadoVisita } from "../app/features/calendar/resultadoVisita.ts";
import { verificarDonoResultadoVisita } from "../app/lib/supabase/autorizarResultadoVisita.ts";

const apiAgenda = await readFile(new URL("../app/api/agenda/route.ts", import.meta.url), "utf8");
const apiFunil = await readFile(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const agendaWeb = await readFile(new URL("../app/features/calendar/CalendarWorkspace.tsx", import.meta.url), "utf8");
const agendaApp = await readFile(new URL("../app/features/calendar/TelaAgendaMobile.tsx", import.meta.url), "utf8");
const autorizacaoResultado = await readFile(new URL("../app/lib/supabase/autorizarResultadoVisita.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260911163500_resultado_obrigatorio_visitas.sql", import.meta.url), "utf8");

test("cada desfecho oferece somente motivos compatíveis", () => {
  assert.equal(resultadoPermitido("realizada", "interessado"), true);
  assert.equal(resultadoPermitido("realizada", "cliente_cancelou"), false);
  assert.equal(resultadoPermitido("cancelada", "cliente_cancelou"), true);
  assert.equal(resultadoPermitido("nao_compareceu", "nao_compareceu"), true);
  assert.equal(RESULTADOS_VISITA.nao_compareceu.length, 1);
});

test("resultado exige justificativa útil", () => {
  assert.match(validarResultadoVisita("realizada", "interessado", "curto") ?? "", /pelo menos 10/);
  assert.equal(validarResultadoVisita("realizada", "interessado", "Cliente gostou e pediu retorno amanhã."), null);
});

test("web, app e Funil usam a mesma RPC estruturada", () => {
  assert.match(apiAgenda, /action === "registerVisitResult"/);
  assert.match(apiAgenda, /f2_registrar_resultado_visita/);
  assert.match(apiFunil, /f2_registrar_resultado_visita/);
  assert.match(agendaWeb, /action: "registerVisitResult"/);
  assert.match(agendaApp, /action: "registerVisitResult"/);
  assert.doesNotMatch(agendaWeb, /action: "updateVisitStatus"/);
  assert.doesNotMatch(agendaApp, /action: "updateVisitStatus"/);
});

test("fila mensal considera visita passada e qualquer encerramento incompleto", () => {
  assert.match(migration, /f2_visitas_resultado_pendente/);
  assert.match(migration, /status IN \('agendada','confirmada'\)[\s\S]*fim_em/);
  assert.match(migration, /status IN \('realizada','cancelada','nao_compareceu'\)[\s\S]*resultado_em IS NULL/);
  assert.match(migration, /public\.f2_admin\(\) IS TRUE OR c\.usuario_id=v_uid/);
});

test("cobrança não abandona pendências quando o calendário vira o mês", () => {
  assert.match(apiAgenda, /const hoje = hojeOperacao\(\)/);
  assert.match(apiAgenda, /somarDias\(hoje,\s*-365\)/);
  assert.doesNotMatch(apiAgenda, /const inicioMes/);
  assert.doesNotMatch(apiAgenda, /fimDoMes/);
});

test("histórico separa agendamento da justificativa do resultado", () => {
  assert.match(migration, /resultado_justificativa/);
  assert.match(migration, /resultado_detalhe_codigo/);
  assert.match(migration, /'visita_atualizada'/);
  assert.match(migration, /'justificativa',v_justificativa/);
});

test("falha da fila de cobrança nunca vira zero pendências silencioso", () => {
  assert.match(apiAgenda, /pendencias_resultado_erro/);
  assert.doesNotMatch(apiAgenda, /pendencias\.error\s*\?\s*\{\s*itens:\s*\[\],\s*resumo:\s*\{\}\s*\}/);
  assert.match(agendaWeb, /Não foi possível verificar os resultados pendentes/);
  assert.match(agendaWeb, /pendencias_resultado_erro/);
  assert.match(agendaApp, /Não foi possível verificar os resultados pendentes/);
  assert.match(agendaApp, /pendencias_resultado_erro/);
});

test("gestão enxerga atraso e responsável de cada cobrança", () => {
  assert.equal(rotuloAtrasoResultado("2026-09-19", "2026-09-19"), "hoje");
  assert.equal(rotuloAtrasoResultado("2026-09-18", "2026-09-19"), "há 1 dia");
  assert.equal(rotuloAtrasoResultado("2026-08-19", "2026-09-19"), "há 31 dias");
  assert.equal(rotuloAtrasoResultado("data-inválida", "2026-09-19"), "data não confirmada");
  assert.match(agendaWeb, /pendenciasPorCorretor/);
  assert.match(agendaWeb, /rotuloAtrasoResultado\(item\.data\)/);
  assert.match(agendaApp, /Responsável:/);
  assert.match(agendaApp, /rotuloAtrasoResultado\(item\.data\)/);
});

test("gestão recebe resumo acionável sem inventar performance", () => {
  assert.deepEqual(resumirCobrancasGerenciais([
    { data: "2026-09-19", corretor: "Corretora Alfa" },
    { data: "2026-09-17", corretor: "Corretora Alfa" },
    { data: "2026-09-16", corretor: "Corretor Beta" },
    { data: "data-inválida", corretor: "" },
  ], "2026-09-19"), {
    total: 4,
    responsaveis: 2,
    haDoisDiasOuMais: 2,
    maisAntigaDias: 3,
    semResponsavel: 1,
  });
  assert.match(agendaWeb, /resumirCobrancasGerenciais/);
  assert.match(agendaWeb, /sem feedback válido/);
  assert.match(agendaWeb, /há 2\+ dias/);
  assert.match(agendaApp, /resumirCobrancasGerenciais/);
  assert.match(agendaApp, /corretores envolvidos/);
});

test("gestão prioriza corretores por volume e atraso sem fabricar nota", () => {
  assert.deepEqual(resumirCobrancasPorCorretor([
    { data: "2026-09-19", corretor: "Corretora Alfa", corretor_id: 7 },
    { data: "2026-09-17", corretor: "Corretora Alfa", corretor_id: 7 },
    { data: "2026-09-16", corretor: "Corretor Beta", corretor_id: 8 },
    { data: "data-inválida", corretor: "", corretor_id: null },
  ], "2026-09-19"), [
    { chave: "id:8", corretorId: 8, corretor: "Corretor Beta", total: 1, haDoisDiasOuMais: 1, maisAntigaDias: 3 },
    { chave: "id:7", corretorId: 7, corretor: "Corretora Alfa", total: 2, haDoisDiasOuMais: 1, maisAntigaDias: 2 },
    { chave: "nome:sem responsável", corretorId: null, corretor: "Sem responsável", total: 1, haDoisDiasOuMais: 0, maisAntigaDias: null },
  ]);
  assert.match(agendaWeb, /resumirCobrancasPorCorretor/);
  assert.match(agendaWeb, /mais antiga/);
  assert.match(agendaApp, /resumirCobrancasPorCorretor/);
  assert.match(agendaApp, /há 2\+ dias/);
  assert.doesNotMatch(agendaWeb, /nota média fictícia/i);
});

test("gerente cobra o corretor e não responde a visita por ele", () => {
  assert.match(agendaWeb, /item\.meu\s*\?\s*<button/);
  assert.match(agendaApp, /item\.meu\s*\?\s*<button/);
  assert.match(agendaWeb, /Aguardando corretor/);
  assert.match(agendaApp, /Aguardando corretor/);
  assert.match(agendaApp, /aguardam os corretores/);
  assert.match(agendaApp, /Cobre o responsável/);
  assert.match(autorizacaoResultado, /current_broker_id/);
  assert.match(autorizacaoResultado, /from\("f2_visita"\)/);
  assert.match(autorizacaoResultado, /from\("f2_lead"\)/);
  assert.match(apiAgenda, /verificarDonoResultadoVisita/);
  assert.match(apiFunil, /verificarDonoResultadoVisita/);
});

test("as APIs autorizam somente o corretor dono da carteira", async () => {
  const db = (corretorAtual, corretorDono) => ({
    rpc: async () => ({ data: corretorAtual, error: null }),
    from: (tabela) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => tabela === "f2_visita"
            ? { data: { funil_lead_id: "20000000-0000-4000-8000-000000000001" }, error: null }
            : { data: { corretor_id: corretorDono }, error: null },
        }),
      }),
    }),
  });
  assert.deepEqual(await verificarDonoResultadoVisita(db(7, 7), "10000000-0000-4000-8000-000000000001"), { permitido: true });
  assert.deepEqual(await verificarDonoResultadoVisita(db(9, 7), "10000000-0000-4000-8000-000000000001"), {
    permitido: false, status: 403, mensagem: "O feedback deve ser registrado pelo corretor responsável.",
  });
  assert.deepEqual(await verificarDonoResultadoVisita(db(null, 7), "10000000-0000-4000-8000-000000000001"), {
    permitido: false, status: 403, mensagem: "O feedback deve ser registrado pelo corretor responsável.",
  });
});
