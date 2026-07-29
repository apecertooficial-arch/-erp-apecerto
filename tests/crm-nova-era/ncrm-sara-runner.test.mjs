import { test } from "node:test";
import assert from "node:assert/strict";
import { saraObserverRunner, sanitizarErro } from "../../app/features/crm-nova-era/lib/saraObserverRunner.ts";

const OPTS = { lote: 50, timeoutMs: 50, maxRetries: 1 };
const analiseOk = { justificativa: "j", confianca: 0.5, evidencias: [] };

function deps(over = {}) {
  const registrados = [];
  const base = {
    getModo: async () => "observer",
    listarElegiveis: async () => [{ negocioId: 1 }, { negocioId: 2 }, { negocioId: 3 }],
    lerContexto: async (n) => ({ hash: `h${n}`, texto: `t${n}`, etapaAtual: "em_atendimento" }),
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

test("observer: analisa e registra cada elegível (identidade do serviço via deps.registrar)", async () => {
  const { d, registrados } = deps();
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.executou, true);
  assert.equal(r.processados, 3);
  assert.equal(r.analisados, 3);
  assert.equal(registrados.length, 3);
});

test("idempotência: contexto já analisado é PULADO (não duplica)", async () => {
  const { d, registrados } = deps({ jaAnalisado: async (h) => h === "h2" });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.pulados_ja_analisado, 1);
  assert.equal(r.analisados, 2);
  assert.deepEqual(registrados.map((x) => x.n).sort(), [1, 3]); // 2 foi pulado
});

test("idempotência no registro: registrar retorna ja=true => pulado, não conta como analisado", async () => {
  const { d } = deps({ registrar: async (n) => (n === 2 ? { ok: true, ja: true } : { ok: true }) });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.analisados, 2);
  assert.equal(r.pulados_ja_analisado, 1);
});

test("falha isolada por negócio: erro em um item NÃO interrompe o lote", async () => {
  const { d } = deps({ chamarIaRouter: async ({ negocioId }) => { if (negocioId === 2) throw new Error("boom-token-abcdefghijklmnopqrstuvwxyz"); return {}; } });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.processados, 3);
  assert.equal(r.analisados, 2);
  assert.equal(r.erros, 1);
  const erroItem = r.detalhes.find((x) => x.status === "erro");
  assert.doesNotMatch(erroItem.erro, /abcdefghijklmnopqrstuvwxyz/); // sanitizado
});

test("timeout + retry limitado: item que trava vira erro após esgotar retries", async () => {
  let chamadas = 0;
  const { d } = deps({
    listarElegiveis: async () => [{ negocioId: 9 }],
    chamarIaRouter: () => new Promise(() => { chamadas++; }), // nunca resolve
  });
  const r = await saraObserverRunner(d, { lote: 10, timeoutMs: 20, maxRetries: 2 });
  assert.equal(r.erros, 1);
  assert.equal(r.detalhes[0].status, "erro");
  assert.equal(chamadas, 3); // 1 tentativa + 2 retries
});

test("resposta inválida do ia-router => invalido, sem registrar", async () => {
  const { d, registrados } = deps({ validar: () => ({ ok: false }) });
  const r = await saraObserverRunner(d, OPTS);
  assert.equal(r.invalidos, 3);
  assert.equal(r.analisados, 0);
  assert.equal(registrados.length, 0);
});

test("sanitizarErro remove tokens longos e trunca", () => {
  const s = sanitizarErro(new Error("falha eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 no banco"));
  assert.doesNotMatch(s, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  assert.ok(s.length <= 200);
});
