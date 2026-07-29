import { test } from "node:test";
import assert from "node:assert/strict";
import { saraObserverRunner, sanitizarErro, compararSegredo, tratarRequisicaoObserver } from "../../app/features/crm-nova-era/lib/saraObserverRunner.ts";

const OPTS = { lote: 50, timeoutMs: 50, maxRetries: 1 };
const analiseOk = { justificativa: "j", confianca: 0.5, evidencias: [] };
const CTX = (n) => ({ negocioId: n, etapaAtual: "em_atendimento", texto: `t${n}`, hash: `h${n}`, ultimaMensagemEm: null, visitaMencionada: false, propostaMencionada: false, clienteAguardando: false, promessaRetorno: false });

function deps(over = {}) {
  const registrados = [];
  const base = {
    getModo: async () => "observer",
    listarElegiveis: async () => [{ negocioId: 1 }, { negocioId: 2 }, { negocioId: 3 }],
    lerContexto: async (n) => CTX(n),
    jaAnalisado: async () => false,
    chamarIaRouter: async () => ({ raw: true }),
    validar: () => ({ ok: true, analise: analiseOk }),
    registrar: async (n, h) => { registrados.push({ n, h }); return { ok: true }; },
    log: () => {},
    ...over,
  };
  return { d: base, registrados };
}

test("runner NÃO executa fora de observer (off/suggest/execute)", async () => {
  for (const modo of ["off", "suggest", "execute"]) {
    const { d, registrados } = deps({ getModo: async () => modo });
    const r = await saraObserverRunner(d, OPTS);
    assert.equal(r.executou, false);
    assert.equal(r.processados, 0);
    assert.equal(registrados.length, 0, `não deve registrar nada em ${modo}`);
  }
});

test("observer: analisa e registra cada elegível", async () => {
  const { d, registrados } = deps();
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.executou, true);
  assert.equal(r.analisados, 3);
  assert.equal(registrados.length, 3);
});

test("não chama IA para contexto já analisado (jaAnalisado por negócio+hash)", async () => {
  let iaChamadas = 0;
  const { d } = deps({
    jaAnalisado: async (n, h) => n === 2 && h === "h2",
    chamarIaRouter: async () => { iaChamadas++; return {}; },
  });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.pulados_ja_analisado, 1);
  assert.equal(r.analisados, 2);
  assert.equal(iaChamadas, 2, "IA não é chamada para o já analisado");
});

test("mesmo hash em NEGÓCIOS diferentes não colide (jaAnalisado é por negócio+hash)", async () => {
  const { d, registrados } = deps({
    listarElegiveis: async () => [{ negocioId: 10 }, { negocioId: 20 }],
    lerContexto: async (n) => ({ ...CTX(n), hash: "MESMO_HASH" }), // mesmo hash textual
    jaAnalisado: async (n, h) => false, // nenhum foi analisado ainda
  });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.analisados, 2);
  assert.equal(registrados.length, 2);
});

test("falha isolada por negócio: erro em um item NÃO interrompe o lote", async () => {
  const { d } = deps({ chamarIaRouter: async ({ negocioId }) => { if (negocioId === 2) throw new Error("boom-token-abcdefghijklmnopqrstuvwxyz"); return {}; } });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.analisados, 2);
  assert.equal(r.erros, 1);
  assert.doesNotMatch(r.detalhes.find((x) => x.status === "erro").erro, /abcdefghijklmnopqrstuvwxyz/);
});

test("timeout + retry limitado: item que trava vira erro após esgotar retries", async () => {
  let chamadas = 0;
  const { d } = deps({ listarElegiveis: async () => [{ negocioId: 9 }], chamarIaRouter: () => new Promise(() => { chamadas++; }) });
  const r = await saraObserverRunner(d, { lote: 10, timeoutMs: 20, maxRetries: 2 });
  assert.equal(r.erros, 1);
  assert.equal(chamadas, 3);
});

test("resposta inválida do ia-router => invalido, sem registrar (sem valores artificiais)", async () => {
  const { d, registrados } = deps({ validar: () => ({ ok: false }) });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.invalidos, 3);
  assert.equal(registrados.length, 0);
});

/* ------------------------- auth cron → Edge ------------------------- */
test("compararSegredo: constante e correto", () => {
  assert.equal(compararSegredo("abc123", "abc123"), true);
  assert.equal(compararSegredo("abc123", "abc124"), false);
  assert.equal(compararSegredo("", "abc"), false);
  assert.equal(compararSegredo("abc", ""), false);
  assert.equal(compararSegredo(null, null), false); // sem segredo esperado => nega
});

test("handler: segredo ausente/incorreto => 401 ANTES de qualquer leitura", async () => {
  let leu = false;
  const { d } = deps({ getModo: async () => { leu = true; return "observer"; } });
  const semSegredo = await tratarRequisicaoObserver({ segredoRecebido: null, segredoEsperado: "S3cr3t-forte" }, d, OPTS);
  assert.equal(semSegredo.status, 401);
  const errado = await tratarRequisicaoObserver({ segredoRecebido: "x", segredoEsperado: "S3cr3t-forte" }, d, OPTS);
  assert.equal(errado.status, 401);
  assert.equal(leu, false, "não deve ler nada com 401");
});

test("handler: segredo correto => 200 e roda o runner", async () => {
  const { d, registrados } = deps();
  const ok = await tratarRequisicaoObserver({ segredoRecebido: "S3cr3t-forte", segredoEsperado: "S3cr3t-forte" }, d, OPTS);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.executou, true);
  assert.equal(registrados.length, 3);
});

test("sanitizarErro remove tokens longos e trunca", () => {
  const s = sanitizarErro(new Error("falha eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 no banco"));
  assert.doesNotMatch(s, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  assert.ok(s.length <= 200);
});
