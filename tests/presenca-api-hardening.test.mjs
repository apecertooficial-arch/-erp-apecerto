import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rota = readFileSync(new URL("../app/api/presenca/route.ts", import.meta.url), "utf8");
const heartbeat = readFileSync(new URL("../app/features/presence/PresenceHeartbeat.tsx", import.meta.url), "utf8");

test("falha do status nunca é interpretada como saída explícita da rede", () => {
  const inicio = heartbeat.indexOf('const res = await fetch("/api/presenca"');
  const fim = heartbeat.indexOf("} catch", inicio);
  const polling = heartbeat.slice(inicio, fim);
  assert.match(polling, /if \(!res\.ok \|\| typeof data\.no_escritorio_ip !== "boolean"\) throw/);
  assert.ok(
    polling.indexOf("if (!res.ok") < polling.indexOf("const estaNaRede"),
    "a resposta precisa ser validada antes de decidir que o corretor está fora",
  );
  assert.ok(
    polling.indexOf("if (!res.ok") < polling.indexOf("void sairDaFila()"),
    "falha de rede/API não pode acionar a mutação de saída",
  );
});

test("falha ao conferir o IP não é convertida silenciosamente em false", () => {
  assert.match(rota, /return \{ noEscritorio: data === true, error \}/);
  assert.match(rota, /if \(rede\.error\) return falhaPresenca\(rede\.error, "conferir_rede_escritorio"\)/);
  assert.doesNotMatch(rota, /return !error && data === true/);
});

test("configuração falha se qualquer conjunto obrigatório falhar", () => {
  assert.match(rota, /const firstError = config\.error \?\? corretores\.error/);
  assert.match(rota, /if \(firstError\) return falhaPresenca/);
  assert.doesNotMatch(rota, /corretores: brokers \?\? \[\]/);
});

test("saída da distribuição exige confirmação real do comando", () => {
  assert.match(rota, /\(data as \{ ok\?: boolean \}\)\.ok !== true/);
  assert.match(rota, /erro: "presenca_nao_alterada"/);
  assert.doesNotMatch(rota, /return Response\.json\(data \?\? \{ ok: true \}\)/);
});

test("erros técnicos são sanitizados sem payload, IP ou mensagem SQL", () => {
  assert.doesNotMatch(rota, /Response\.json\(\{ error: error\.message/);
  assert.doesNotMatch(rota, /console\.error\([^\n]*(message|p_ip|ipDaRequisicao)/);
  assert.match(rota, /erro: semPermissao \? "sem_permissao" : "falha_banco"/);
});
