import { test } from "node:test";
import assert from "node:assert/strict";
import { tratarRequisicaoObserver } from "../../app/features/crm-nova-era/lib/saraObserverRunner.ts";
import { montarContexto, mapearSugestaoParaAnalise } from "../../app/features/crm-nova-era/lib/saraContexto.ts";
import { normalizarSugestaoSara } from "../../app/api/ncrm/saraSchema.ts";

const SEGREDO = "S3cr3t-forte-cron";
const OPTS = { lote: 100, timeoutMs: 50, maxRetries: 0 };

// sugestão válida no CONTRATO REAL da Sara (saraSchema)
const sugestaoValida = {
  etapa_sugerida: "em_acompanhamento", temperatura: "morno", intencao_detectada: "quer 2 dorms",
  proxima_acao: "Enviar 3 opções no Cambuí", prazo_sugerido: "2026-07-30T13:00:00.000Z",
  objecoes: ["preço"], risco_abandono: "medio", possibilidade_visita: "alta", possibilidade_proposta: "baixa",
  justificativa: "Cliente pediu opções e demonstrou interesse.", confianca: 0.71, evidencias: ["msg 14:02", "áudio 14:05"],
};

// deps da Edge usando o CONTRATO REAL (normalizarSugestaoSara + mapear)
function deps(over = {}) {
  const escritas = [];
  const contexto = (n) => montarContexto({
    negocioId: n, leadNome: "Ana", corretorNome: "Bruno", etapaAtual: "em_atendimento", proximaAcao: "Enviar opções",
    mensagens: [{ id: "m1", direcao: "recebida", tipo: "texto", conteudo: "Quero visitar", enviadoEm: "2026-07-28T14:00:00.000Z" }],
  });
  const base = {
    getModo: async () => "observer",
    listarElegiveis: async () => [{ negocioId: 1 }],
    lerContexto: async (n) => contexto(n),
    jaAnalisado: async () => false,
    chamarIaRouter: async () => sugestaoValida,
    validar: (raw, ctx) => {
      const n = normalizarSugestaoSara(raw);
      if (!n.ok) return { ok: false };
      const a = mapearSugestaoParaAnalise(n.sugestao, ctx);
      return a ? { ok: true, analise: { ...a, etapaAtual: ctx.etapaAtual } } : { ok: false };
    },
    registrar: async (n, h, a) => { escritas.push({ n, h, a }); return { ok: true }; },
    log: () => {},
    ...over,
  };
  return { d: base, escritas };
}
const run = (d, seg = SEGREDO) => tratarRequisicaoObserver({ segredoRecebido: seg, segredoEsperado: SEGREDO }, d, OPTS);

test("segredo incorreto => 401, sem escrever", async () => {
  const { d, escritas } = deps();
  const r = await run(d, "errado");
  assert.equal(r.status, 401);
  assert.equal(escritas.length, 0);
});

test("erro de banco no contexto => erro isolado (fail-closed), sem escrever nem chamar IA", async () => {
  let ia = 0;
  const { d, escritas } = deps({ lerContexto: async () => { throw new Error("erro_estado"); }, chamarIaRouter: async () => { ia++; return sugestaoValida; } });
  const r = await run(d);
  assert.equal(r.status, 200);
  assert.equal(r.body.erros, 1);
  assert.equal(ia, 0);            // não chama IA em falha de banco
  assert.equal(escritas.length, 0);
});

test("sem_contexto (lerContexto null) => status sem_contexto, sem IA, sem escrita", async () => {
  let ia = 0;
  const { d, escritas } = deps({ lerContexto: async () => null, chamarIaRouter: async () => { ia++; return sugestaoValida; } });
  const r = await run(d);
  assert.equal(r.body.sem_contexto, 1);
  assert.equal(r.body.analisados, 0);
  assert.equal(ia, 0);
  assert.equal(escritas.length, 0);
});

test("ia-router como OBJETO válido => registra 1 análise", async () => {
  const { d, escritas } = deps({ chamarIaRouter: async () => sugestaoValida });
  const r = await run(d);
  assert.equal(r.body.analisados, 1);
  assert.equal(escritas.length, 1);
  assert.equal(escritas[0].a.justificativa, sugestaoValida.justificativa); // sem valor artificial
});

test("ia-router como STRING com JSON embutido => registra 1 análise", async () => {
  const { d } = deps({ chamarIaRouter: async () => "Claro! " + JSON.stringify(sugestaoValida) + " fim" });
  const r = await run(d);
  assert.equal(r.body.analisados, 1);
});

test("JSON inválido / sem proxima_acao => invalido, NÃO cria análise falsa", async () => {
  const { d, escritas } = deps({ chamarIaRouter: async () => "isto não é json" });
  const r = await run(d);
  assert.equal(r.body.invalidos, 1);
  assert.equal(r.body.analisados, 0);
  assert.equal(escritas.length, 0);
  // confiança ausente também invalida (nunca usar 0.5 artificial)
  const semConf = deps({ chamarIaRouter: async () => ({ ...sugestaoValida, confianca: undefined }) });
  const r2 = await run(semConf.d);
  assert.equal(r2.body.invalidos, 1);
});

test("contexto já analisado NÃO chama IA e é pulado", async () => {
  let ia = 0;
  const { d, escritas } = deps({ jaAnalisado: async () => true, chamarIaRouter: async () => { ia++; return sugestaoValida; } });
  const r = await run(d);
  assert.equal(ia, 0);
  assert.equal(r.body.pulados_ja_analisado, 1);
  assert.equal(escritas.length, 0);
});

test("dois negócios com MESMO hash textual não colidem (ambos registram)", async () => {
  const { d, escritas } = deps({
    listarElegiveis: async () => [{ negocioId: 10 }, { negocioId: 20 }],
    lerContexto: async (n) => ({ negocioId: n, etapaAtual: "em_atendimento", texto: "igual", hash: "HASH_IGUAL", ultimaMensagemEm: null, visitaMencionada: false, propostaMencionada: false, clienteAguardando: false, promessaRetorno: false }),
  });
  const r = await run(d);
  assert.equal(r.body.analisados, 2);
  assert.deepEqual(escritas.map((e) => e.n).sort(), [10, 20]);
});

test("paginação além de 100: processa todos os elegíveis retornados pela fila justa", async () => {
  const grande = Array.from({ length: 150 }, (_, i) => ({ negocioId: i + 1 }));
  const { d } = deps({ listarElegiveis: async (lote) => grande.slice(0, lote), chamarIaRouter: async () => sugestaoValida });
  const r = await run(d);
  assert.equal(r.body.processados, 100); // respeita o lote; a fila justa (RPC) garante rotação
});

test("modo off/suggest/execute não roda; observer registra 1", async () => {
  for (const modo of ["off", "suggest", "execute"]) {
    const { d, escritas } = deps({ getModo: async () => modo });
    const r = await run(d);
    assert.equal(r.body.executou, false);
    assert.equal(escritas.length, 0);
  }
  const { d, escritas } = deps();
  const ok = await run(d);
  assert.equal(ok.body.analisados, 1);
  assert.equal(escritas.length, 1);
});
