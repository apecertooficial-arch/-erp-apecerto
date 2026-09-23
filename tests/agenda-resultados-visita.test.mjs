import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RESULTADOS_VISITA, resultadoPermitido, rotuloAtrasoResultado, validarResultadoVisita } from "../app/features/calendar/resultadoVisita.ts";
import { confirmarResultadoVisitaPersistido, verificarDonoResultadoVisita } from "../app/lib/supabase/autorizarResultadoVisita.ts";

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

test("agenda desktop impede dois envios da mesma visita enquanto aguarda a API", () => {
  assert.match(agendaWeb, /if \(creatingVisitRef\.current\) return;/);
  assert.match(agendaWeb, /creatingVisitRef\.current = true;[\s\S]*fetch\("\/api\/agenda"/);
  assert.match(agendaWeb, /finally \{ creatingVisitRef\.current = false; setCreatingVisit\(false\); \}/);
  assert.match(agendaWeb, /type="submit" disabled=\{creatingVisit\}/);
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

test("agenda móvel recebe meu booleano mesmo quando a RPC gerencial devolve null", () => {
  assert.match(apiAgenda, /result\.itens\s*=\s*itens\.map/);
  assert.match(apiAgenda, /meu:\s*item\.meu\s*===\s*true/);
  assert.match(agendaApp, /typeof compromisso\.meu === "boolean"/);
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

test("qualidade por corretor falha fechada e não pontua histórico legado", () => {
  assert.match(apiAgenda, /f2_feedback_visita_performance/);
  assert.match(apiAgenda, /status:\s*performance\?\.erro === "sem_permissao" \? "restrito" : "indisponivel"/);
  assert.match(agendaWeb, /Baseline ainda indisponível/);
  assert.match(agendaWeb, /histórico legado continua preservado, sem avaliação retroativa/);
  assert.match(agendaApp, /Baseline ainda indisponível/);
  assert.match(agendaApp, /nenhum texto antigo será pontuado por estimativa/);
  assert.match(agendaWeb, /estruturados_total/);
  assert.match(agendaApp, /estruturados_total/);
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

test("detalhe da agenda só oferece resultado para pendência própria confirmada", () => {
  assert.match(agendaWeb, /pendenciaSelecionada\?\.meu === true/);
  assert.match(agendaWeb, /setResultadoPendente\(pendenciaSelecionada\)/);
  assert.doesNotMatch(agendaWeb, /meu: true \}/);
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

test("sucesso só é devolvido depois de reler o resultado persistido e a fila encerrada", async () => {
  const db = (data, error = null, pendencias = []) => ({
    rpc: async () => ({ data: { ok: true, itens: pendencias }, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }),
  });
  const esperado = {
    status: "realizada",
    resultado_codigo: "interessado",
    resultado_justificativa: "FEEDBACK_VISITA_V1 | Próxima ação: retornar amanhã",
    resultado_em: "2026-09-21T12:00:00Z",
    inicio_em: "2026-09-21T11:00:00Z",
  };
  const args = ["10000000-0000-4000-8000-000000000001", esperado.status, esperado.resultado_codigo, esperado.resultado_justificativa];
  assert.equal(await confirmarResultadoVisitaPersistido(db(esperado), ...args), true);
  assert.equal(await confirmarResultadoVisitaPersistido(db(esperado, null, [{ id: args[0] }]), ...args), false);
  assert.equal(await confirmarResultadoVisitaPersistido(db({ ...esperado, resultado_em: null }), ...args), false);
  assert.equal(await confirmarResultadoVisitaPersistido(db({ ...esperado, resultado_codigo: "nao_gostou" }), ...args), false);
  assert.equal(await confirmarResultadoVisitaPersistido(db(null, { message: "falha" }), ...args), false);
  assert.match(apiAgenda, /confirmarResultadoVisitaPersistido/);
  assert.match(apiFunil, /confirmarResultadoVisitaPersistido/);
});

test("Agenda não devolve nem registra mensagem interna do banco", () => {
  assert.doesNotMatch(apiAgenda, /error:\s*error\?\.message/);
  assert.match(apiAgenda, /erro:\s*"falha_banco"/);
  assert.doesNotMatch(agendaApp, /console\.error\([^\n]*j\.error/);
});
