import { test } from "node:test";
import assert from "node:assert/strict";
import { montarContexto, contextHashEstavel } from "../../app/features/crm-nova-era/lib/saraContexto.ts";

const base = (over = {}) => ({
  negocioId: 100, leadNome: "Ana", corretorNome: "Bruno", etapaAtual: "em_atendimento", proximaAcao: "Enviar opções",
  ultimaInteracaoEm: "2026-07-28T14:00:00.000Z",
  mensagens: [
    { id: "m1", direcao: "recebida", tipo: "texto", conteudo: "Quero visitar o apê", enviadoEm: "2026-07-28T14:00:00.000Z" },
    { id: "m2", direcao: "enviada", tipo: "audio", transcricao: "Posso te mostrar amanhã", enviadoEm: "2026-07-28T14:05:00.000Z" },
  ],
  ...over,
});

test("montarContexto: texto contextual, etapa, timestamp da última mensagem", () => {
  const c = montarContexto(base());
  assert.equal(c.negocioId, 100);
  assert.equal(c.etapaAtual, "em_atendimento");
  assert.match(c.texto, /Ana/);
  assert.match(c.texto, /Cliente/); // mensagem inbound
  assert.match(c.texto, /\[áudio\]/); // transcrição de áudio
  assert.equal(c.ultimaMensagemEm, "2026-07-28T14:05:00.000Z");
  assert.equal(c.visitaMencionada, true); // "visitar"
});

test("hash é estável para o mesmo contexto e MUDA quando o conteúdo muda", () => {
  const h1 = montarContexto(base()).hash;
  const h2 = montarContexto(base()).hash;
  assert.equal(h1, h2); // estável
  const h3 = montarContexto(base({ mensagens: [{ id: "m1", direcao: "recebida", conteudo: "outro texto", enviadoEm: "2026-07-28T14:00:00.000Z" }] })).hash;
  assert.notEqual(h1, h3);
});

test("mesmo TEXTO em negócios diferentes gera HASH diferente (inclui negocio_id)", () => {
  const a = montarContexto(base({ negocioId: 1 })).hash;
  const b = montarContexto(base({ negocioId: 2 })).hash;
  assert.notEqual(a, b);
});

test("texto NÃO inclui raw sensível (telefone) — só usa o que foi passado", () => {
  const c = montarContexto(base());
  assert.doesNotMatch(c.texto, /\+?55\d{2}9?\d{8}/); // sem telefone
});

test("contextHashEstavel é determinístico", () => {
  assert.equal(contextHashEstavel("abc"), contextHashEstavel("abc"));
  assert.notEqual(contextHashEstavel("abc"), contextHashEstavel("abd"));
});
