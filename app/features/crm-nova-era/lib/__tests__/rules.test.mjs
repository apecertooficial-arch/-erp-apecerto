// CRM Nova Era — testes das funções puras (FASE 1.1)
// Executar: node --test app/features/crm-nova-era/lib/__tests__/rules.test.mjs
// Sem rede, sem banco: apenas node:test + import do módulo puro.
import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../rules.ts";
import { LEADS_DEMO, AGORA_DEMO } from "../../fixtures.ts";

const AGORA = "2026-07-28T12:00:00.000Z";

function leadBase(over = {}) {
  return {
    id: "L1",
    nome: "Lead Demo",
    telefone: "00000000001",
    origem: "demo",
    corretorNome: "Você (demo)",
    coluna: "novo",
    momento: "morno",
    criadoEm: "2026-07-28T08:00:00.000Z",
    respondeu: false,
    respostaPendenteCorretor: false,
    ultimaInteracaoEm: null,
    proximaAcaoTipo: "tentativa_cadencia",
    proximaAcaoTitulo: "Primeira intervenção humana",
    proximaAcaoEm: "2026-07-28T08:00:00.000Z",
    tentativas: [],
    acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: null,
    aguardandoRespostaAutomacao: false,
    visitaAgendadaEm: null,
    proposta: null,
    descartadoMotivo: null,
    nutricao: false,
    ...over,
  };
}

const PROPOSTA = { produto: "Residencial Teste", valor: 400000, data: "2026-07-28T10:00:00.000Z" };

/* ========== 1. Esteira: proposta REGISTRADA entra, sem exigir aceite ========== */
test("1. proposta registrada entra na Esteira, sem exigir aceite", () => {
  const semProposta = R.determinarSaidaEsteira(leadBase());
  assert.equal(semProposta.elegivel, false);
  const comProposta = R.determinarSaidaEsteira(leadBase({ proposta: PROPOSTA }));
  assert.equal(comProposta.elegivel, true);
  assert.equal(comProposta.payloadConceitual.gatilho, "proposta_registrada");
  assert.deepEqual(comProposta.payloadConceitual.proposta, PROPOSTA);
  // não existe nenhum conceito de "aceite" no modelo
  assert.equal(JSON.stringify(comProposta).includes("aceit"), false);
});

/* ========== 2. Proposta não é chamada de pós-venda ========== */
test("2. proposta não é descrita como pós-venda", () => {
  const textos = JSON.stringify([
    R.determinarSaidaEsteira(leadBase({ proposta: PROPOSTA })),
    R.determinarSaidaEsteira(leadBase()),
    R.sugerirProximoPasso(leadBase({ proposta: PROPOSTA }), AGORA),
  ]).toLowerCase();
  assert.equal(textos.includes("pós-venda"), false);
  assert.equal(textos.includes("pos-venda"), false);
  assert.ok(textos.includes("processo comercial") || textos.includes("esteira"));
});

/* ========== 3. Visita agendada sai do quadro ========== */
test("3. visita agendada sai do quadro (não fica em nenhuma coluna)", () => {
  const lead = R.aplicarVisitaAgendada(leadBase({ respondeu: true }), "2026-07-30T15:00:00.000Z");
  assert.equal(R.estaNoQuadro(lead), false);
  assert.equal(R.saidaDoLead(lead), "pipeline_visitas");
});

/* ========== 4. Proposta registrada sai do quadro ========== */
test("4. proposta registrada sai do quadro", () => {
  const lead = R.aplicarPropostaRegistrada(leadBase({ respondeu: true }), PROPOSTA);
  assert.equal(R.estaNoQuadro(lead), false);
  assert.equal(R.saidaDoLead(lead), "esteira_vendas");
});

/* ========== 5. Saída não aparece em Minha fila ========== */
test("5. visita/proposta/descartado não aparecem na fila", () => {
  const visita = leadBase({ id: "V", visitaAgendadaEm: "2026-07-30T15:00:00.000Z" });
  const proposta = leadBase({ id: "P", proposta: PROPOSTA });
  const descartado = leadBase({ id: "D", descartadoMotivo: "sem_interesse" });
  const nutricaoSemHoje = leadBase({ id: "N", nutricao: true, proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null });
  const normal = leadBase({ id: "OK" });
  const fila = R.ordenarFilaHoje([visita, proposta, descartado, nutricaoSemHoje, normal], AGORA);
  assert.deepEqual(fila.map((i) => i.lead.id), ["OK"]);
});

/* ========== 6. Quem respondeu não recebe próxima tentativa ========== */
test("6. cliente que respondeu não recebe próxima tentativa da cadência", () => {
  const entrada = { canal: "whatsapp", resultado: "respondeu", em: AGORA, proximaAcaoTipo: "entender_necessidade", proximaAcaoEm: "2026-07-28T15:00:00.000Z" };
  const lead = R.aplicarTentativa(leadBase(), entrada);
  assert.equal(lead.respondeu, true);
  assert.equal(R.cadenciaEncerrada(lead), true);
  assert.notEqual(lead.proximaAcaoTipo, "tentativa_cadencia");
  const sug = R.sugerirProximaTentativa(lead);
  assert.equal(sug.aplicavel, false);
  // e o coach nunca mostra "Tentativa N" depois da resposta
  const passo = R.sugerirProximoPasso(lead, AGORA);
  assert.equal(/Tentativa \d/.test(passo.titulo), false);
});

/* ========== 7. Pediu retorno exige data/hora ========== */
test("7. 'pediu retorno' exige data/hora", () => {
  const sem = R.validarConclusaoTentativa({ canal: "ligacao", resultado: "pediu_retorno", em: AGORA });
  assert.equal(sem.ok, false);
  const com = R.validarConclusaoTentativa({ canal: "ligacao", resultado: "pediu_retorno", em: AGORA, proximaAcaoEm: "2026-07-28T16:00:00.000Z" });
  assert.equal(com.ok, true);
  // e cria a próxima ação "Retornar contato" (não continua a régua)
  const lead = R.aplicarTentativa(leadBase(), { canal: "ligacao", resultado: "pediu_retorno", em: AGORA, proximaAcaoEm: "2026-07-28T16:00:00.000Z" });
  assert.equal(lead.proximaAcaoTipo, "retornar_contato");
  assert.equal(lead.proximaAcaoEm, "2026-07-28T16:00:00.000Z");
});

/* ========== 8. Respondeu exige próxima ação comercial ========== */
test("8. 'respondeu' exige próxima ação comercial com data/hora", () => {
  const sem = R.validarConclusaoTentativa({ canal: "whatsapp", resultado: "respondeu", em: AGORA });
  assert.equal(sem.ok, false);
  const semData = R.validarConclusaoTentativa({ canal: "whatsapp", resultado: "respondeu", em: AGORA, proximaAcaoTipo: "enviar_opcoes" });
  assert.equal(semData.ok, false);
  const com = R.validarConclusaoTentativa({ canal: "whatsapp", resultado: "respondeu", em: AGORA, proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: "2026-07-28T15:00:00.000Z" });
  assert.equal(com.ok, true);
});

/* ========== 9. Fila: resposta aguardando corretor na prioridade correta ========== */
test("9. fila prioriza: críticas → responderam/aguardam → previstas agora", () => {
  const critico = leadBase({ id: "CRIT", proximaAcaoEm: "2026-07-27T06:00:00.000Z" }); // 30h atraso
  const respondeuAguarda = leadBase({ id: "RESP", respondeu: true, respostaPendenteCorretor: true, coluna: "em_atendimento", proximaAcaoTipo: "confirmar_recebimento", proximaAcaoTitulo: "Confirmar recebimento", proximaAcaoEm: "2026-07-28T13:30:00.000Z" });
  const atrasadoLeve = leadBase({ id: "AGORA", proximaAcaoEm: "2026-07-28T11:00:00.000Z" }); // 1h atraso
  const novoSem = leadBase({ id: "NOVO", proximaAcaoEm: "2026-07-28T18:00:00.000Z" }); // hoje, futuro
  const futuro = leadBase({ id: "FUT", proximaAcaoEm: "2026-07-30T10:00:00.000Z", tentativas: [{ numero: 1, canal: "whatsapp", resultado: "nao_respondeu", em: "2026-07-27T10:00:00.000Z" }] });
  const fila = R.ordenarFilaHoje([futuro, novoSem, atrasadoLeve, respondeuAguarda, critico], AGORA);
  assert.deepEqual(fila.map((i) => i.lead.id), ["CRIT", "RESP", "AGORA", "NOVO", "FUT"]);
  assert.deepEqual(fila.map((i) => i.categoria), [1, 2, 3, 4, 6]);
});

/* ========== 10. Próxima ação do card = persistida no estado ========== */
test("10. próxima ação mostrada é a armazenada, não um recálculo divergente", () => {
  // corretor ajusta a data sugerida pela cadência — o estado guarda o ajuste
  const ajustada = "2026-07-28T19:45:00.000Z";
  const lead = R.aplicarTentativa(leadBase(), { canal: "whatsapp", resultado: "nao_respondeu", em: AGORA, proximaAcaoEm: ajustada });
  assert.equal(lead.proximaAcaoEm, ajustada);
  const sugestaoDaRegua = R.sugerirProximaTentativa(lead).quandoISO;
  assert.notEqual(lead.proximaAcaoEm, sugestaoDaRegua); // divergiu — e vale o armazenado
  // a fila ordena pelo armazenado
  const fila = R.ordenarFilaHoje([lead], AGORA);
  assert.equal(fila[0].lead.proximaAcaoEm, ajustada);
});

/* ========== 11. Temperatura não muda a coluna ========== */
test("11. temperatura (quente/negociando) não muda a coluna", () => {
  const frio = leadBase({ momento: "frio" });
  const negociando = leadBase({ momento: "negociando" });
  assert.equal(R.derivarColuna(frio), R.derivarColuna(negociando));
  const respFrio = leadBase({ momento: "frio", respondeu: true, proximaAcaoTipo: "entender_necessidade", tentativas: [{ numero: 1, canal: "whatsapp", resultado: "respondeu", em: AGORA }] });
  const respQuente = { ...respFrio, momento: "quente" };
  assert.equal(R.derivarColuna(respFrio), "em_atendimento");
  assert.equal(R.derivarColuna(respQuente), "em_atendimento");
});

/* ========== 12. Em acompanhamento não contém visita agendada ========== */
test("12. 'Em acompanhamento' não contém lead com visita agendada", () => {
  const lead = R.aplicarVisitaAgendada(leadBase({ respondeu: true, coluna: "em_acompanhamento" }), "2026-07-30T15:00:00.000Z");
  assert.equal(R.estaNoQuadro(lead), false); // o quadro filtra via estaNoQuadro
  const noQuadro = LEADS_DEMO.filter((l) => R.estaNoQuadro(l));
  assert.equal(noQuadro.some((l) => l.visitaAgendadaEm), false);
  assert.equal(noQuadro.some((l) => l.proposta), false);
});

/* ========== 13. Lead sem próximo passo válido é rejeitado ========== */
test("13. leads sem próximo passo válido são rejeitados", () => {
  const semPasso = leadBase({ respondeu: true, proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null });
  assert.equal(R.leadTemProximoPassoValido(semPasso), false);
  const comPasso = leadBase();
  assert.equal(R.leadTemProximoPassoValido(comPasso), true);
  // saídas são válidas sem próxima ação
  assert.equal(R.leadTemProximoPassoValido(leadBase({ proposta: PROPOSTA, proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null })), true);
  assert.equal(R.leadTemProximoPassoValido(leadBase({ visitaAgendadaEm: "2026-07-30T10:00:00.000Z", proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null })), true);
  assert.equal(R.leadTemProximoPassoValido(leadBase({ nutricao: true, proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null })), true);
  // TODAS as fixtures respeitam a regra
  for (const l of LEADS_DEMO) {
    assert.equal(R.leadTemProximoPassoValido(l), true, `fixture ${l.id} sem próximo passo válido`);
  }
});

/* ========== Complementares ========== */

test("validação: sem_interesse exige observação; contato_inadequado exige obs + reagendar/descartar", () => {
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "sem_interesse", em: AGORA }).ok, false);
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "sem_interesse", em: AGORA, observacao: "não tem interesse" }).ok, true);
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "contato_inadequado", em: AGORA, observacao: "número de terceiro" }).ok, false);
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "contato_inadequado", em: AGORA, observacao: "x", proximaAcaoEm: "2026-07-29T10:00:00.000Z" }).ok, true);
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "contato_inadequado", em: AGORA, observacao: "x", encaminharDescarte: true }).ok, true);
});

test("validação: telefone_invalido exige correção agendada ou descarte", () => {
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "telefone_invalido", em: AGORA }).ok, false);
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "telefone_invalido", em: AGORA, proximaAcaoEm: "2026-07-28T15:00:00.000Z" }).ok, true);
  assert.equal(R.validarConclusaoTentativa({ canal: "ligacao", resultado: "telefone_invalido", em: AGORA, encaminharDescarte: true }).ok, true);
});

test("validação de proposta: produto, valor > 0 e data obrigatórios", () => {
  assert.equal(R.validarProposta({}).ok, false);
  assert.equal(R.validarProposta({ produto: "X", valor: 0, data: AGORA }).ok, false);
  assert.equal(R.validarProposta({ produto: "X", valor: 100000, data: AGORA }).ok, true);
});

/* ==================== FASE 1.2 — automação + janela operacional ==================== */
// Lembrete: AGORA (12:00Z) = 09:00 em Brasília (UTC-3).

const AUTOMACAO = "2026-07-28T12:05:00.000Z"; // 09:05 BRT

function leadComAutomacao(over = {}) {
  return leadBase({
    mensagemAutomaticaEnviadaEm: AUTOMACAO,
    aguardandoRespostaAutomacao: true,
    proximaAcaoEm: "2026-07-28T14:05:00.000Z", // automação + 2h (11:05 BRT, na janela)
    ...over,
  });
}

test("1.2-1. mensagem automática não conta como tentativa humana", () => {
  const lead = leadComAutomacao();
  assert.equal(lead.tentativas.length, 0);
  const sug = R.sugerirProximaTentativa(lead);
  assert.equal(sug.numeroTentativa, 1); // a 1ª HUMANA ainda não aconteceu
  const tl = R.montarTimeline(lead);
  assert.equal(tl.filter((e) => e.tipo === "tentativa").length, 0);
});

test("1.2-2. lead novo não recebe sugestão de WhatsApp duplicado imediato", () => {
  const lead = leadComAutomacao();
  const sug = R.sugerirProximaTentativa(lead);
  // nasce só após o prazo configurado a partir do ENVIO AUTOMÁTICO, nunca "imediato"
  assert.ok(Date.parse(sug.quandoISO) >= Date.parse(AUTOMACAO) + 2 * 3600000);
  assert.equal(/imediato/i.test(sug.rotulo), false);
  assert.equal(sug.rotulo, "Primeira intervenção humana");
  // e o coach avisa para não duplicar o WhatsApp automático
  const passo = R.sugerirProximoPasso(leadComAutomacao({ proximaAcaoEm: "2026-07-28T11:00:00.000Z" }), AGORA);
  assert.ok(/não disparar WhatsApp duplicado/i.test(passo.detalhe));
});

test("1.2-3. timeline mostra o evento da mensagem automática", () => {
  const lead = leadComAutomacao({
    tentativas: [{ numero: 1, canal: "ligacao", resultado: "nao_respondeu", em: "2026-07-28T14:10:00.000Z" }],
  });
  const tl = R.montarTimeline(lead);
  assert.equal(tl[0].tipo, "mensagem_automatica");
  assert.equal(tl[0].titulo, "Mensagem automática enviada");
  assert.ok(/não conta como tentativa humana/i.test(tl[0].detalhe));
  assert.equal(tl[1].tipo, "tentativa");
});

test("1.2-4. primeira intervenção humana só nasce após o prazo configurado", () => {
  const lead = leadComAutomacao();
  const sug = R.sugerirProximaTentativa(lead);
  assert.equal(sug.quandoISO, "2026-07-28T14:05:00.000Z"); // 12:05Z + 2h, dentro da janela
  // antes do prazo o coach manda AGUARDAR (não agir)
  const passo = R.sugerirProximoPasso(lead, AGORA);
  assert.equal(passo.acao, "aguardar_automacao");
  assert.ok(/Aguardando resposta da mensagem automática/.test(passo.titulo));
  // depois do prazo, vira intervenção humana normal
  const depois = R.sugerirProximoPasso(lead, "2026-07-28T15:00:00.000Z");
  assert.equal(depois.acao, "registrar_tentativa");
});

test("1.2-5. horário antes de 09:30 (Brasília) é ajustado para 09:30", () => {
  // 11:00Z = 08:00 BRT → vira 09:30 BRT = 12:30Z do MESMO dia
  assert.equal(R.ajustarParaJanelaOperacional("2026-07-28T11:00:00.000Z"), "2026-07-28T12:30:00.000Z");
});

test("1.2-6. horário depois de 18:00 (Brasília) vai para o próximo dia às 09:30", () => {
  // 22:00Z = 19:00 BRT → próximo dia 09:30 BRT = 12:30Z de 29/07
  assert.equal(R.ajustarParaJanelaOperacional("2026-07-28T22:00:00.000Z"), "2026-07-29T12:30:00.000Z");
  // dentro da janela não muda (15:00Z = 12:00 BRT)
  assert.equal(R.ajustarParaJanelaOperacional("2026-07-28T15:00:00.000Z"), "2026-07-28T15:00:00.000Z");
  // e a régua aplica o ajuste: automação 19:30Z (16:30 BRT) + 2h = 18:30 BRT → dia seguinte 09:30
  const lead = leadBase({ mensagemAutomaticaEnviadaEm: "2026-07-28T19:30:00.000Z", aguardandoRespostaAutomacao: true });
  assert.equal(R.sugerirProximaTentativa(lead).quandoISO, "2026-07-29T12:30:00.000Z");
});

test("1.2-7. cliente que respondeu usa ação comercial, não tentativa", () => {
  const lead = leadBase({
    respondeu: true,
    coluna: "em_acompanhamento",
    proximaAcaoTipo: "ligar_retorno",
    proximaAcaoTitulo: "Ligar para retorno",
    proximaAcaoEm: "2026-07-28T13:00:00.000Z",
    tentativas: [{ numero: 1, canal: "whatsapp", resultado: "respondeu", em: "2026-07-27T15:00:00.000Z" }],
  });
  const depois = R.aplicarResultadoAcaoComercial(lead, {
    resultado: "acao_concluida",
    em: AGORA,
    proximaAcaoTipo: "enviar_opcoes",
    proximaAcaoEm: "2026-07-28T15:00:00.000Z",
  });
  assert.equal(depois.tentativas.length, 1); // NÃO incrementou tentativa de prospecção
  assert.equal(depois.acoesComerciais.length, 1);
  assert.equal(depois.acoesComerciais[0].acaoPrevista, "Ligar para retorno");
  assert.equal(depois.respondeu, true);
  assert.equal(depois.proximaAcaoTipo, "enviar_opcoes");
});

test("1.2-8. sem resposta no acompanhamento NÃO reinicia a cadência", () => {
  const lead = leadBase({
    respondeu: true,
    coluna: "em_acompanhamento",
    proximaAcaoTipo: "ligar_retorno",
    proximaAcaoTitulo: "Ligar para retorno",
    proximaAcaoEm: "2026-07-28T13:00:00.000Z",
    tentativas: [{ numero: 1, canal: "whatsapp", resultado: "respondeu", em: "2026-07-27T15:00:00.000Z" }],
  });
  const depois = R.aplicarResultadoAcaoComercial(lead, {
    resultado: "sem_resposta_acompanhamento",
    em: AGORA,
    proximaAcaoTipo: "ligar_retorno",
    proximaAcaoEm: "2026-07-28T17:00:00.000Z",
  });
  assert.equal(depois.respondeu, true);                       // continua atendido
  assert.equal(depois.tentativas.length, 1);                  // sem nova tentativa 1→4
  assert.notEqual(depois.proximaAcaoTipo, "tentativa_cadencia");
  assert.equal(R.sugerirProximaTentativa(depois).aplicavel, false); // cadência segue encerrada
  assert.equal(R.cadenciaEncerrada(depois), true);
  const passo = R.sugerirProximoPasso(depois, AGORA);
  assert.equal(/Tentativa \d/.test(passo.titulo), false);
});

test("1.2-9. sem resposta no acompanhamento NÃO sugere descarte", () => {
  const lead = leadBase({
    respondeu: true,
    coluna: "em_acompanhamento",
    proximaAcaoTipo: "ligar_retorno",
    proximaAcaoTitulo: "Ligar para retorno",
    proximaAcaoEm: "2026-07-28T13:00:00.000Z",
  });
  // validação REJEITA avaliar_descarte como próxima ação do fluxo comercial
  const invalida = R.validarResultadoAcaoComercial({
    resultado: "sem_resposta_acompanhamento", em: AGORA, proximaAcaoTipo: "avaliar_descarte", proximaAcaoEm: "2026-07-28T17:00:00.000Z",
  });
  assert.equal(invalida.ok, false);
  const depois = R.aplicarResultadoAcaoComercial(lead, {
    resultado: "sem_resposta_acompanhamento", em: AGORA, proximaAcaoTipo: "ligar_retorno", proximaAcaoEm: "2026-07-28T17:00:00.000Z",
  });
  assert.notEqual(depois.proximaAcaoTipo, "avaliar_descarte");
  assert.notEqual(R.sugerirProximoPasso(depois, AGORA).acao, "descartar");
});

test("1.2-10. conclusão comercial exige próxima ação com data/hora", () => {
  assert.equal(R.validarResultadoAcaoComercial({ resultado: "acao_concluida", em: AGORA }).ok, false);
  assert.equal(
    R.validarResultadoAcaoComercial({ resultado: "acao_concluida", em: AGORA, proximaAcaoTipo: "enviar_opcoes" }).ok,
    false, // falta data/hora
  );
  assert.equal(
    R.validarResultadoAcaoComercial({ resultado: "acao_concluida", em: AGORA, proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: "2026-07-28T15:00:00.000Z" }).ok,
    true,
  );
  // tentativa_cadencia NUNCA é aceita como próxima ação comercial
  assert.equal(
    R.validarResultadoAcaoComercial({ resultado: "outro", em: AGORA, proximaAcaoTipo: "tentativa_cadencia", proximaAcaoEm: "2026-07-28T15:00:00.000Z" }).ok,
    false,
  );
  // pediu novo retorno exige data/hora
  assert.equal(R.validarResultadoAcaoComercial({ resultado: "pediu_novo_retorno", em: AGORA }).ok, false);
  assert.equal(R.validarResultadoAcaoComercial({ resultado: "pediu_novo_retorno", em: AGORA, proximaAcaoEm: "2026-07-28T16:00:00.000Z" }).ok, true);
});

test("1.2-11. visita e proposta continuam produzindo as saídas corretas", () => {
  const base = leadBase({
    respondeu: true,
    coluna: "em_acompanhamento",
    proximaAcaoTipo: "agendar_visita",
    proximaAcaoTitulo: "Agendar visita",
    proximaAcaoEm: "2026-07-28T13:00:00.000Z",
  });
  const comVisita = R.aplicarResultadoAcaoComercial(base, {
    resultado: "visita_agendada", em: AGORA, visitaEm: "2026-07-30T18:00:00.000Z",
  });
  assert.equal(R.saidaDoLead(comVisita), "pipeline_visitas");
  assert.equal(R.estaNoQuadro(comVisita), false);
  assert.equal(R.determinarSaidaVisitas(comVisita).elegivel, true);

  const comProposta = R.aplicarResultadoAcaoComercial(base, {
    resultado: "proposta_registrada", em: AGORA,
    proposta: { produto: "Residencial Teste", valor: 400000, data: AGORA },
  });
  assert.equal(R.saidaDoLead(comProposta), "esteira_vendas");
  assert.equal(R.determinarSaidaEsteira(comProposta).payloadConceitual.gatilho, "proposta_registrada");
  assert.equal(R.ordenarFilaHoje([comVisita, comProposta], AGORA).length, 0);

  // sem_interesse exige descarte estruturado e gera saída de descarte
  assert.equal(R.validarResultadoAcaoComercial({ resultado: "sem_interesse", em: AGORA }).ok, false);
  const descartado = R.aplicarResultadoAcaoComercial(base, {
    resultado: "sem_interesse", em: AGORA, descarte: { motivo: "sem_perfil_financeiro" },
  });
  assert.equal(R.saidaDoLead(descartado), "descartado");
});

test("nao_respondeu segue a régua; cadência esgotada vira avaliar_descarte", () => {
  const lead = R.aplicarTentativa(leadBase(), { canal: "whatsapp", resultado: "nao_respondeu", em: AGORA });
  assert.equal(lead.proximaAcaoTipo, "tentativa_cadencia");
  assert.equal(lead.coluna, "tentando_contato");
  // esgotar
  let l = leadBase();
  for (let i = 0; i < 4; i++) {
    l = R.aplicarTentativa(l, { canal: "whatsapp", resultado: "nao_respondeu", em: AGORA });
  }
  assert.equal(l.proximaAcaoTipo, "avaliar_descarte");
  assert.equal(R.sugerirProximaTentativa(l).aplicavel, false);
});

test("indicadores refletem as fixtures", () => {
  const ind = R.calcularIndicadores(LEADS_DEMO, AGORA_DEMO);
  assert.equal(ind.visitasAgendadas, 1);
  assert.equal(ind.propostasRegistradas, 1);
  assert.equal(ind.respostasAguardando, 1);
  assert.equal(ind.novosSemAtuacao, 2);
  assert.ok(ind.vencidas >= 3);
});

test("filtros: meus/todos, responderam, etapa, origem", () => {
  const meus = R.filtrarLeads(LEADS_DEMO, { escopo: "meus", status: null, etapa: null, origem: null }, "Você (demo)", AGORA_DEMO);
  assert.ok(meus.length > 0 && meus.every((l) => l.corretorNome === "Você (demo)"));
  const resp = R.filtrarLeads(LEADS_DEMO, { escopo: "todos", status: "responderam", etapa: null, origem: null }, "Você (demo)", AGORA_DEMO);
  assert.ok(resp.every((l) => l.respondeu));
  const etapa = R.filtrarLeads(LEADS_DEMO, { escopo: "todos", status: null, etapa: "novo", origem: null }, "Você (demo)", AGORA_DEMO);
  assert.ok(etapa.every((l) => l.coluna === "novo"));
  const origem = R.filtrarLeads(LEADS_DEMO, { escopo: "todos", status: null, etapa: null, origem: "Portal (demo)" }, "Você (demo)", AGORA_DEMO);
  assert.ok(origem.length > 0 && origem.every((l) => l.origem === "Portal (demo)"));
});

test("descarte estruturado: motivo obrigatório; 'outro' exige detalhe", () => {
  assert.equal(R.validarDescarte({}).ok, false);
  assert.equal(R.validarDescarte({ motivo: "duplicado" }).ok, true);
  assert.equal(R.validarDescarte({ motivo: "outro" }).ok, false);
  assert.equal(R.validarDescarte({ motivo: "outro", detalhe: "motivo x" }).ok, true);
});

test("atraso: níveis configuráveis (não 24/48/72 fixos)", () => {
  assert.equal(R.calcularAtraso({ proximaAcaoEm: "2026-07-28T11:30:00.000Z" }, AGORA).nivel, "atencao");
  assert.equal(R.calcularAtraso({ proximaAcaoEm: "2026-07-28T07:00:00.000Z" }, AGORA).nivel, "atrasado");
  assert.equal(R.calcularAtraso({ proximaAcaoEm: "2026-07-27T06:00:00.000Z" }, AGORA).nivel, "critico");
  const cfg = { atencaoHoras: 0, atrasadoHoras: 1, criticoHoras: 2 };
  assert.equal(R.calcularAtraso({ proximaAcaoEm: "2026-07-28T10:30:00.000Z" }, AGORA, cfg).nivel, "atrasado");
});

test("fixtures: telefones obviamente inválidos e sem rede", () => {
  // 11 dígitos começando com pelo menos 9 zeros — obviamente inválido
  for (const l of LEADS_DEMO) assert.match(l.telefone, /^0{9}\d{2}$/);
  assert.equal(LEADS_DEMO.length, 14);
});
