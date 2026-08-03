/* O CICLO DA SARA — le o historico, atualiza, da a acao, o corretor executa.
 *
 * Este arquivo prende o que muda o dia do corretor: a orientacao vira acao
 * registrada com UM clique, e o checklist de qualificacao sai da conversa real
 * em vez de um formulario que ninguem preenche.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CAMPOS_QUALIFICACAO, TOTAL_CAMPOS, montarChecklist, campoValido, resumoChecklist,
} from "../app/features/crm-nova-era-3/lib/qualificacao.ts";
import {
  normalizarSara, acaoConfirmadaDaSara, prazoOuPadrao,
  SARA_PODE_ENVIAR, SARA_PODE_MOVER_ETAPA, ACOES_SARA,
} from "../app/features/crm-nova-era-3/lib/sara3.ts";
import { painelDeAbertura, saudacao } from "../app/features/crm-nova-era-3/lib/meuDia3.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const item = (id, extra = {}) => ({
  negocio_id: id, lead_nome: `Cliente ${id}`, etapa: "em_atendimento", temperatura: "morno",
  corretor_nome: "Ana", proxima_acao_titulo: "Ligar de volta", proxima_acao_em: null,
  prioridade: 1, motivo: "Cliente respondeu", espera_min: 90, respondeu: true, ...extra,
});

/* ==================== CHECKLIST ==================== */

test("as onze perguntas da qualificacao, e so elas", () => {
  assert.equal(TOTAL_CAMPOS, 11);
  assert.deepEqual(CAMPOS_QUALIFICACAO.map((c) => c.chave), [
    "regiao", "tipo_imovel", "dormitorios", "faixa_valor", "forma_pagamento", "prazo_compra",
    "metragem", "vagas", "motivo_compra", "quem_decide", "disponibilidade_visita",
  ]);
  for (const c of CAMPOS_QUALIFICACAO) assert.ok(c.pergunta.endsWith("?"), `${c.chave} sem pergunta pronta`);
});

test("o checklist separa o que sabemos do que falta", () => {
  const c = montarChecklist({ regiao: "Zona Sul", dormitorios: "3", faixa_valor: "ate 800 mil" });
  assert.equal(c.descobertos.length, 3);
  assert.equal(c.faltantes.length, 8);
  assert.equal(c.completudePct, 27);
  assert.equal(c.itens.length, 11, "o checklist mostra sempre os onze, marcados ou nao");
});

test("campo que a Sara inventar nao entra no checklist", () => {
  const c = montarChecklist({ regiao: "Centro", signo: "leao", cor_favorita: "azul" });
  assert.equal(c.descobertos.length, 1);
  assert.equal(campoValido("signo"), false);
  assert.equal(campoValido("regiao"), true);
});

test("null, vazio e a palavra null contam como nao perguntado", () => {
  const c = montarChecklist({ regiao: null, tipo_imovel: "", dormitorios: "null", vagas: "  " });
  assert.equal(c.descobertos.length, 0);
});

test("as proximas perguntas seguem a prioridade comercial, nao a ordem da lista", () => {
  const c = montarChecklist({ metragem: "70m2", vagas: "1", motivo_compra: "morar" });
  assert.deepEqual(c.proximasPerguntas.slice(0, 3), [
    "Em qual região você quer morar?",
    "Está procurando apartamento, casa ou terreno?",
    "Quantos dormitórios você precisa?",
  ]);
});

test("o resumo fala em portugues, nao em porcentagem solta", () => {
  assert.match(resumoChecklist(montarChecklist({})), /ainda nao sabemos|ainda não sabemos/i);
  const cheio = Object.fromEntries(CAMPOS_QUALIFICACAO.map((c) => [c.chave, "x"]));
  assert.match(resumoChecklist(montarChecklist(cheio)), /qualificado/i);
});

test("a Sara devolve o checklist junto da sugestao", () => {
  const s = normalizarSara({
    proxima_acao: "Responder valor e perguntar o prazo",
    confianca: 0.9,
    informacoes_descobertas: { regiao: "Zona Sul", faixa_valor: "800 mil" },
  });
  assert.equal(s.checklist.descobertos.length, 2);
  assert.equal(s.checklist.faltantes.length, 9);
});

/* ==================== ACEITAR EXECUTA ==================== */

test("a orientação pode ser traduzida para o contrato operacional", () => {
  const sugestao = {
    proxima_acao: "Responder valor e metragem e perguntar quando pretende comprar",
    prazo_sugerido: "2026-08-01T14:00:00.000Z",
    possibilidade_visita: "alta",
    confianca: 0.91,
    evidencia_suficiente: true,
    evidencias: ["quero conhecer o imóvel"],
  };
  const a = acaoConfirmadaDaSara(sugestao, { id: "42", respondeu: true }, 7, new Date("2026-07-31T12:00:00Z"));
  assert.equal(a.action, "concluirAcao");
  assert.equal(a.payload.negocioId, 42);
  assert.equal(a.payload.versao, 7, "sem a versao o banco nao consegue recusar escrita concorrente");
  assert.equal(a.payload.proximaTipo, "agendar_visita");
  assert.equal(a.payload.proximaEm, "2026-08-01T14:00:00.000Z");
  assert.match(String(a.payload.obs), /Sara/);
});

test("cliente que ainda nao respondeu registra TENTATIVA, nao acao comercial", () => {
  // Confundir os dois zeraria a contagem da cadencia e o lead pularia etapa.
  const a = acaoConfirmadaDaSara({ proxima_acao: "Tentar de novo", confianca: 0.8, evidencia_suficiente: true, evidencias: ["sem resposta após a primeira mensagem"] }, { id: "9", respondeu: false }, 2);
  assert.equal(a.action, "registrarTentativa");
  assert.equal(a.payload.resultado, "nao_respondeu");
  assert.equal(a.payload.proximaEm, null, "quem define o proximo contato e a cadencia, nao a Sara");
});

test("sem proxima acao, nao ha o que executar", () => {
  assert.equal(acaoConfirmadaDaSara(null, { id: "1", respondeu: true }, 1), null);
  assert.equal(acaoConfirmadaDaSara({ confianca: 0.9 }, { id: "1", respondeu: true }, 1), null);
});

test("sem prazo sugerido, cai em duas horas — nunca em lead sem data", () => {
  const agora = new Date("2026-07-31T12:00:00.000Z");
  assert.equal(prazoOuPadrao(null, agora), "2026-07-31T14:00:00.000Z");
  assert.equal(prazoOuPadrao("data invalida", agora), "2026-07-31T14:00:00.000Z");
  assert.equal(prazoOuPadrao("2026-08-02T10:00:00.000Z", agora), "2026-08-02T10:00:00.000Z");
});

test("a acao e idempotente por lead e versao", () => {
  const s = { proxima_acao: "Ligar", confianca: 0.7, evidencia_suficiente: true, evidencias: ["pode me ligar amanhã"] };
  const a = acaoConfirmadaDaSara(s, { id: "5", respondeu: true }, 3);
  const b = acaoConfirmadaDaSara(s, { id: "5", respondeu: true }, 3);
  assert.equal(a.payload.idem, b.payload.idem, "clique duplo nao pode virar dois registros");
});

test("a Sara continua sem enviar mensagem e sem escrever etapa", () => {
  assert.equal(SARA_PODE_ENVIAR, false);
  assert.equal(SARA_PODE_MOVER_ETAPA, false);
  const fonte = ler("../app/features/crm-nova-era-3/lib/sara3.ts");
  assert.ok(!/etapa|coluna|momento\s*:/.test(fonte.split("acaoConfirmadaDaSara")[1] ?? ""),
    "a acao aceita nao pode escrever etapa: quem recalcula o momento e o banco");
});

test("as tres decisoes continuam existindo", () => {
  assert.deepEqual(ACOES_SARA.map((a) => a.decisao), ["aceita", "ajustada", "rejeitada"]);
  assert.match(ACOES_SARA[0].ajuda, /[Rr]egistra/, "a decisão precisa permanecer auditável");
});

test("confirmar conduta não pode fingir que a ação já foi executada", () => {
  const ficha = ler("../app/features/crm-nova-era-3/components/Ficha3.tsx");
  const ramo = ficha.slice(ficha.indexOf('if (decisao === "aceita")'), ficha.indexOf('if (decisao === "ajustada")'));
  assert.doesNotMatch(ramo, /onExecutar|executarEReavaliar|registrarTentativa|concluirAcao/);
  assert.match(ramo, /Ação feita/);
});

test("acao feita fecha o ciclo e pede uma nova leitura da Sara", () => {
  const ficha = ler("../app/features/crm-nova-era-3/components/Ficha3.tsx");
  const form = ler("../app/features/crm-nova-era-3/components/FormAcao3.tsx");
  const workspace = ler("../app/features/crm-nova-era-3/Crm3Workspace.tsx");
  assert.match(ficha, /executarEReavaliar/);
  assert.match(ficha, /await pedirSara\(\)/, "a ação humana precisa provocar uma nova leitura");
  assert.match(ficha, /analiseInicial/, "a orientação persistida não pode sumir ao reabrir a ficha");
  assert.match(form, /Concluir e receber o próximo passo/);
  assert.match(workspace, /analiseInicial=\{analises\[/, "a ficha precisa receber a leitura persistida do board");
});

/* ==================== PAINEL DE ABERTURA ==================== */

test("o painel conta o dia com os numeros que o corretor confere", () => {
  const hoje = new Date();
  const p = painelDeAbertura([
    item(1),
    item(2, { lead_nome: "Cliente 1" }),
    item(3, { etapa: "novo", respondeu: false, lead_nome: "Novo A" }),
    item(4, { etapa: "tentando_contato", respondeu: false, lead_nome: "Retorno B", proxima_acao_em: hoje.toISOString() }),
  ], hoje);
  assert.equal(p.aguardandoResposta, 1, "o cliente repetido conta uma vez so");
  assert.equal(p.leadsNovos, 1);
  assert.equal(p.cadenciasHoje, 1);
  assert.ok(p.atrasadas >= 0);
});

test("o painel aponta um proximo atendimento, nomeado", () => {
  const p = painelDeAbertura([item(10, { lead_nome: "Fatima Juntolli", motivo: "Cliente respondeu" })]);
  assert.equal(p.proximo.nome, "Fatima Juntolli");
  assert.equal(p.proximo.motivo, "Cliente respondeu");
  assert.ok(p.proximo.proximaAcao.length > 0);
});

test("sem urgencia, o painel nao inventa um proximo atendimento", () => {
  const p = painelDeAbertura([item(1, { prioridade: 9, respondeu: true, proxima_acao_em: "2030-01-01T10:00:00.000Z" })]);
  assert.equal(p.proximo, null);
});

test("o painel nao promete contagem de visitas", () => {
  // A fila de trabalho nao devolve visita. Numero que o corretor nao confere
  // vale menos do que numero nenhum -- visita tem aba propria.
  const p = painelDeAbertura([item(1)]);
  assert.ok(!("visitasHoje" in p), "nao inventar contador de visitas na fila");
});

test("a saudacao segue a hora e usa o primeiro nome", () => {
  assert.equal(saudacao("Kapri Souza", new Date("2026-07-31T09:00:00")), "Bom dia, Kapri");
  assert.equal(saudacao("Kapri Souza", new Date("2026-07-31T14:00:00")), "Boa tarde, Kapri");
  assert.equal(saudacao("Kapri Souza", new Date("2026-07-31T20:00:00")), "Boa noite, Kapri");
  assert.match(saudacao("", new Date("2026-07-31T09:00:00")), /corretor/);
});

/* ==================== TREINO DA SARA ==================== */

test("o prompt da Sara pede o checklist e proibe suposicao", () => {
  const rota = ler("../app/api/ncrm/sara/route.ts");
  assert.match(rota, /informacoes_descobertas/, "o prompt nao pede o checklist");
  for (const campo of CAMPOS_QUALIFICACAO.map((c) => c.chave)) {
    assert.ok(rota.includes(campo), `o prompt nao lista o campo ${campo}`);
  }
  assert.match(rota, /REGRA DE OURO/, "faltou a trava contra preencher campo que o cliente nao disse");
});

test("o normalizador descarta chave inventada pela IA", () => {
  const schema = ler("../app/api/ncrm/saraSchema.ts");
  assert.match(schema, /CAMPOS_QUALIFICACAO/);
  assert.match(schema, /informacoes_descobertas: checklist\(o\.informacoes_descobertas\)/);
});
