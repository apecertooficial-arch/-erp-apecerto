/* Meu Dia do corretor — a tela do app.
 * O teste mais importante e o primeiro: a copia da regra de grupos aqui tem
 * que concordar com a fonte canonica do CRM. Se divergirem, o corretor ve o
 * lead num bloco na home e noutro no CRM.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  montarBlocos, paraAtender, acaoDoItem, esperaHumana, saudacao,
  grupoDoItem as grupoLocal, grupoVisivel as visivelLocal, ORDEM_BLOCOS,
} from "../app/features/home/meuDia.logica.ts";
import { grupoDoItem as grupoCanon, grupoVisivel as visivelCanon } from "../app/features/crm-nova-era/lib/linguagem.ts";

const ler = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const item = (id, prio, extra = {}) => ({
  negocio_id: id, lead_nome: `Lead ${id}`, etapa: "em_atendimento", motivo: "Cliente respondeu — aguardando você",
  espera_min: 90, prioridade: prio, respondeu: true, proxima_acao_titulo: null, proxima_acao_em: null, ...extra,
});

test("a copia da regra concorda com a fonte canonica", () => {
  for (const prioridade of [1, 2, 3, 6, 7, 9]) {
    for (const respondeu of [true, false]) {
      const i = { prioridade, respondeu, proxima_acao_em: null };
      assert.equal(grupoLocal(i), grupoCanon(i), `grupoDoItem divergiu em prioridade ${prioridade}`);
      assert.equal(visivelLocal(grupoLocal(i)), visivelCanon(grupoCanon(i)), "grupoVisivel divergiu");
    }
  }
});

test("tres blocos, na ordem do trabalho", () => {
  assert.deepEqual(ORDEM_BLOCOS, ["atenda_agora", "faca_combinado", "acompanhe"]);
  assert.deepEqual(montarBlocos([]).map((b) => b.titulo), ["Atenda agora", "Faça o combinado", "Acompanhe"]);
});

test("nenhum lead aparece em dois blocos", () => {
  const itens = [item(1, 1), item(2, 4), item(3, 9, { respondeu: true }), item(4, 9, { respondeu: false })];
  const blocos = montarBlocos(itens, 99);
  const ids = blocos.flatMap((b) => b.cards.map((c) => c.negocioId));
  assert.equal(ids.length, new Set(ids).size, "o mesmo negocio caiu em mais de um bloco");
  assert.equal(ids.length, itens.length, "algum lead sumiu");
});

test("mostra poucos, mas conta todos", () => {
  const itens = Array.from({ length: 19 }, (_, i) => item(i + 1, 1));
  const [agora] = montarBlocos(itens);
  assert.equal(agora.cards.length, 3);
  assert.equal(agora.total, 19);
});

test("\"Você tem X clientes\" conta so a urgencia", () => {
  const itens = [item(1, 1), item(2, 2), item(3, 5), item(4, 9, { respondeu: true })];
  assert.equal(paraAtender(itens), 2, "faca_combinado e acompanhe nao entram na chamada do topo");
});

test("acao principal: WhatsApp so com telefone em maos", () => {
  const i = item(1, 1);
  // A fila NAO devolve telefone -- conferido em producao. Prometer discagem que
  // nao acontece seria pior do que um toque a mais.
  assert.equal(acaoDoItem(i, false), "atendimento");
  assert.equal(acaoDoItem(i, true), "whatsapp");
});

test("compromisso operacional vira Ver tarefa, nao conversa", () => {
  for (const t of ["Agendar visita ao decorado", "Coletar documentos", "Enviar proposta", "Assinatura do contrato"]) {
    assert.equal(acaoDoItem(item(1, 1, { proxima_acao_titulo: t }), true), "tarefa", `"${t}" deveria ser tarefa`);
  }
  assert.equal(acaoDoItem(item(1, 1, { proxima_acao_titulo: "Entender necessidade do cliente" }), true), "whatsapp");
});

test("card carrega nome, motivo, tempo e etapa", () => {
  const [b] = montarBlocos([item(7, 1, { espera_min: 130 })]);
  const c = b.cards[0];
  assert.equal(c.nome, "Lead 7");
  assert.equal(c.motivo, "Cliente respondeu — aguardando você");
  assert.equal(c.espera, "2h");
  assert.equal(c.etapa, "Em atendimento", "etapa tecnica nao pode vazar para a tela");
});

test("lead sem nome nao vira card em branco", () => {
  const [b] = montarBlocos([item(9, 1, { lead_nome: "   " })]);
  assert.equal(b.cards[0].nome, "Atendimento 9");
});

test("acao vencida e marcada", () => {
  const vencida = item(1, 1, { proxima_acao_em: new Date(Date.now() - 3600e3).toISOString() });
  const futura = item(2, 1, { proxima_acao_em: new Date(Date.now() + 3600e3).toISOString() });
  assert.equal(montarBlocos([vencida])[0].cards[0].vencida, true);
  assert.equal(montarBlocos([futura])[0].cards[0].vencida, false);
});

test("tempo e saudacao em linguagem de gente", () => {
  assert.equal(esperaHumana(0), "agora");
  assert.equal(esperaHumana(45), "45 min");
  assert.equal(esperaHumana(60 * 26), "1d 2h");
  assert.equal(saudacao(8), "Bom dia");
  assert.equal(saudacao(14), "Boa tarde");
  assert.equal(saudacao(21), "Boa noite");
});

test("listas de 0, 3, 20 e muitos leads", () => {
  for (const n of [0, 3, 20, 500]) {
    const itens = Array.from({ length: n }, (_, i) => item(i + 1, (i % 9) + 1));
    const blocos = montarBlocos(itens);
    assert.equal(blocos.reduce((a, b) => a + b.total, 0), n);
    for (const b of blocos) assert.ok(b.cards.length <= 3, "nunca mais de 3 visiveis por bloco");
  }
});

/* ---------------- a tela ---------------- */

test("a tela do corretor nao mostra gestao antes da fila", () => {
  const home = ler("../app/features/home/HomeWorkspace.tsx");
  const celular = home.slice(home.indexOf("if (ehCelular === true)"), home.indexOf("if (ehCelular === null)"));
  const posFila = celular.indexOf("MeuDiaCorretor");
  const posGestao = celular.indexOf("hm-gestao");
  assert.ok(posFila > -1 && posGestao > posFila, "meta e funil nao podem vir antes da fila do dia");
  assert.ok(!/hv2-hero|Abrir Financeiro/.test(celular), "meta e Financeiro nao aparecem na tela do corretor");
});

test("o toque no card nao afirma que houve contato", () => {
  const c = ler("../app/features/home/MeuDiaCorretor.tsx");
  assert.match(c, /Aguardando a mensagem aparecer no histórico/);
  // Olha o que e RENDERIZADO: o comentario do arquivo cita a frase proibida de
  // proposito, para explicar por que ela nao existe.
  const semComentarios = c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Contato realizado|Contato feito/i.test(semComentarios), 'nunca "contato realizado" so pelo toque');
  assert.match(c, /whatsappAbertoEm/, "o estado vem do registro local de intencao, nao de envio");
});

test("Meu Dia nao baixa /api/crm", () => {
  const c = ler("../app/features/home/MeuDiaCorretor.tsx");
  assert.ok(!/\/api\/crm/.test(c));
  assert.match(c, /\/api\/ncrm\/fila/);
});

test("nada do Meu Dia vaza para o desktop", () => {
  const css = ler("../app/styles/app-mobile.css");
  const bloco = css.slice(css.indexOf("MEU DIA DO CORRETOR"));
  const fora = bloco.slice(0, bloco.indexOf("@media"));
  assert.match(fora, /\.md-wrap \{ display: none; \}/);
  assert.ok(!/min-height|grid-template|padding:/.test(fora));
});

test("alvo principal grande e sem overflow escondido", () => {
  const css = ler("../app/styles/app-mobile.css");
  const bloco = css.slice(css.indexOf("MEU DIA DO CORRETOR"));
  assert.match(bloco, /\.md-acao \{[^}]*min-height: 48px/s);
  assert.ok(!/overflow-x:\s*hidden/.test(bloco));
  assert.match(bloco, /overflow-wrap: anywhere/);
});
