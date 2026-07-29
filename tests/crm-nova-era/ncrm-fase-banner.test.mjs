// Fase 4 — testes do resumo de fase e da explicação do quadro vazio (puros).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TITULO_FASE, linhasResumoFase, mensagemQuadroVazio } from "../../app/features/crm-nova-era/lib/faseBanner.ts";

test("título da fase é explícito", () => {
  assert.equal(TITULO_FASE, "Fase 4 — piloto funcional");
});

test("resumo com ingest desligado e runner desligado", () => {
  const chips = linhasResumoFase({ ingestAtivo: false, ativoDesde: null, saraModo: "observer", runnerEnabled: false, runnerUltimaExecucao: null, totalLeads: 0, errosRecentes: 0 });
  assert.ok(chips.includes("Ingest: desligado"));
  assert.ok(chips.some((c) => c.startsWith("Sara: observer")));
  assert.ok(chips.includes("Runner: desligado"));
  assert.ok(chips.includes("Leads no piloto: 0"));
  assert.ok(chips.includes("Sem erros recentes"));
});

test("resumo com ingest ligado mostra o corte e erros", () => {
  const chips = linhasResumoFase({ ingestAtivo: true, ativoDesde: "2026-07-29T12:00:00Z", saraModo: "observer", runnerEnabled: true, runnerUltimaExecucao: "2026-07-29T12:05:00Z", totalLeads: 3, errosRecentes: 2 });
  assert.ok(chips.some((c) => c.startsWith("Ingest: ligado desde ")));
  assert.ok(chips.includes("Runner: ligado (lote máx. 3)"));
  assert.ok(chips.includes("Leads no piloto: 3"));
  assert.ok(chips.includes("Erros recentes: 2"));
});

test("estado desconhecido nunca é inventado", () => {
  const chips = linhasResumoFase({ ingestAtivo: null, ativoDesde: null, saraModo: null, runnerEnabled: null, runnerUltimaExecucao: null, totalLeads: 0, errosRecentes: 0 });
  assert.ok(chips.includes("Ingest: —"));
  assert.ok(chips.includes("Sara: —"));
  assert.ok(chips.includes("Runner: —"));
});

test("quadro vazio: admin com ingest desligado aponta o caminho de ativação", () => {
  const m = mensagemQuadroVazio({ ingestAtivo: false, ativoDesde: null, souAdmin: true });
  assert.ok(m.includes("ingest ainda está desligado"));
  assert.ok(m.includes("Painel do piloto"));
});

test("quadro vazio: admin com ingest ligado aguarda mensagem elegível após o corte", () => {
  const m = mensagemQuadroVazio({ ingestAtivo: true, ativoDesde: "2026-07-29T12:00:00Z", souAdmin: true });
  assert.ok(m.includes("Aguardando a primeira mensagem elegível"));
  assert.ok(m.includes("Nenhum lead antigo é migrado"));
});

test("quadro vazio: corretor recebe mensagem neutra, sem detalhes administrativos", () => {
  const m = mensagemQuadroVazio({ ingestAtivo: null, ativoDesde: null, souAdmin: false });
  assert.ok(m.includes("Aguardando os primeiros leads"));
  assert.ok(!m.toLowerCase().includes("painel do piloto"));
});
