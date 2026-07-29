import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarContextoAdaptador, resumoAvaliacaoSeguro } from "../../app/features/crm-nova-era/lib/saraContexto.ts";

// Fábrica de CtxQueries (mesma forma {data,error} do supabase-js) — nomes REAIS das colunas.
function queries(over = {}) {
  return {
    estado: async () => ({ data: { etapa: "em_atendimento", proxima_acao_titulo: "Enviar opções", ultima_interacao_em: "2026-07-28T14:00:00.000Z", lead_id: 55, lead_nome: "Ana", corretor_nome: "Bruno" }, error: null }),
    contatos: async () => ({ data: [{ id: "c1" }], error: null }),
    conversas: async () => ({ data: [{ id: "v1" }], error: null }),
    mensagens: async () => ({ data: [{ id: "m1", direcao: "recebida", tipo: "texto", conteudo: "Quero visitar", enviadoEm: "2026-07-28T14:00:00.000Z" }], error: null }),
    avaliacoes: async () => ({ data: [{ nota: 4, contexto: { intencao: "2 dormitorios" }, feedbacks: ["gostou do bairro"], criado_em: "2026-07-20T10:00:00.000Z" }], error: null }),
    ...over,
  };
}

test("adaptador: contexto válido com mensagens e avaliação (colunas reais)", async () => {
  const c = await carregarContextoAdaptador(1000, queries());
  assert.equal(c.negocioId, 1000);
  assert.match(c.texto, /Quero visitar/);
  assert.match(c.texto, /gostou do bairro/);   // avaliação transformada de feedbacks
  assert.match(c.texto, /2 dormitorios/);       // avaliação transformada de contexto
  assert.equal(c.avaliacoesErro, undefined);
  assert.ok(c.hash);
});

test("FAIL-CLOSED: erro em consulta essencial (estado) => LANÇA (não chama IA)", async () => {
  await assert.rejects(() => carregarContextoAdaptador(1, queries({ estado: async () => ({ data: null, error: { message: "db down" } }) })), /erro_estado/);
});
test("FAIL-CLOSED: erro em contatos/conversas/mensagens => LANÇA", async () => {
  await assert.rejects(() => carregarContextoAdaptador(1, queries({ contatos: async () => ({ data: null, error: { message: "x" } }) })), /erro_contatos/);
  await assert.rejects(() => carregarContextoAdaptador(1, queries({ conversas: async () => ({ data: null, error: { message: "x" } }) })), /erro_conversas/);
  await assert.rejects(() => carregarContextoAdaptador(1, queries({ mensagens: async () => ({ data: null, error: { message: "x" } }) })), /erro_mensagens/);
});

test("sem estado (query ok, ausente) => null (sem_contexto, distinto de erro)", async () => {
  const r = await carregarContextoAdaptador(1, queries({ estado: async () => ({ data: null, error: null }) }));
  assert.equal(r, null);
});

test("ZERO mensagens legítimo (consulta ok, vazia) != falha: constrói contexto sem mensagens", async () => {
  const c = await carregarContextoAdaptador(1, queries({ contatos: async () => ({ data: [], error: null }) }));
  assert.notEqual(c, null);
  assert.match(c.texto, /\(sem mensagens\)/);
});

test("avaliações OPCIONAIS: erro é registrado sanitizado (avaliacoesErro), NÃO confundido com vazio", async () => {
  const c = await carregarContextoAdaptador(1, queries({ avaliacoes: async () => ({ data: null, error: { message: "boom" } }) }));
  assert.notEqual(c, null);
  assert.equal(c.avaliacoesErro, "erro_avaliacoes"); // erro != vazio
});

test("resumoAvaliacaoSeguro: extrai texto, remove raw sensível, null quando vazio", () => {
  const r = resumoAvaliacaoSeguro({ nota: "cliente com email joao@x.com e fone +5511999998888" }, ["quer 2 dorms"]);
  assert.match(r, /quer 2 dorms/);
  assert.doesNotMatch(r, /joao@x\.com/);       // e-mail removido
  assert.doesNotMatch(r, /\+?5511999998888/);   // telefone removido
  assert.ok(r.length <= 240);
  assert.equal(resumoAvaliacaoSeguro(null, null), null);   // vazio => null (não inventa)
  assert.equal(resumoAvaliacaoSeguro({}, []), null);
});

test("mensagens com data efetiva (enviado_em ?? criado_em): contexto ordena cronologicamente e nada é perdido", async () => {
  // Simula o contrato da Edge pós-correção: enviadoEm SEMPRE presente (fallback p/ criado_em).
  const c = await carregarContextoAdaptador(1, queries({
    mensagens: async () => ({ data: [
      { id: "m3", direcao: "recebida", tipo: "texto", conteudo: "terceira", enviadoEm: "2026-07-28T15:00:00.000Z" },
      { id: "m1", direcao: "recebida", tipo: "texto", conteudo: "primeira", enviadoEm: "2026-07-28T13:00:00.000Z" }, // veio de criado_em (enviado_em era NULL)
      { id: "m2", direcao: "enviada",  tipo: "texto", conteudo: "segunda",  enviadoEm: "2026-07-28T14:00:00.000Z" },
    ], error: null }),
  }));
  assert.notEqual(c, null);
  const iPrimeira = c.texto.indexOf("primeira"), iSegunda = c.texto.indexOf("segunda"), iTerceira = c.texto.indexOf("terceira");
  assert.ok(iPrimeira >= 0 && iSegunda > iPrimeira && iTerceira > iSegunda, "ordem cronológica pela data efetiva");
  assert.equal(c.ultimaMensagemEm, "2026-07-28T15:00:00.000Z");
});
