// Kanban, resultados e a fronteira proposta != venda.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLUNAS, saidaDoLead } from "../app/features/crm-nova-era/lib/rules.ts";
import { RESULTADOS_VISIVEIS, resultadoCriaVenda } from "../app/features/crm-nova-era/lib/linguagem.ts";

const css = readFileSync(new URL("../app/styles/app-mobile.css", import.meta.url), "utf8");
const board = css.slice(css.indexOf("CRM NOVA ERA — CELULAR"));
const workspace = readFileSync(new URL("../app/features/crm-nova-era/CrmNovaEraLiveWorkspace.tsx", import.meta.url), "utf8");

/* ------------------------------- Kanban ------------------------------- */

test("o quadro tem exatamente quatro momentos, na ordem do fluxo", () => {
  assert.deepEqual(COLUNAS.map((c) => c.chave), ["novo", "tentando_contato", "em_atendimento", "em_acompanhamento"]);
  assert.deepEqual(COLUNAS.map((c) => c.titulo), ["Novo", "Tentando contato", "Em atendimento", "Em acompanhamento"]);
});

test("celular mostra UMA etapa por vez", () => {
  assert.ok(board.includes(".nova-crm-board > .nova-crm-col { display: none; }"), "colunas escondidas por padrao no celular");
  for (const chave of COLUNAS.map((c) => c.chave)) {
    assert.ok(board.includes(`[data-etapa-mobile="${chave}"] > [data-coluna="${chave}"]`), `falta a regra da etapa ${chave}`);
  }
});

test("segmento de etapa existe so no celular e tem contador", () => {
  assert.ok(css.includes(".nova-crm-etapas { display: none; }"), "segmentos ocultos no desktop");
  assert.ok(board.includes(".nova-crm-etapas {"), "segmentos aparecem abaixo de 900px");
  assert.ok(/porColuna\[c\.chave\]\.length\}<\/b>/.test(workspace), "cada segmento precisa exibir o contador");
});

test("DESKTOP PRESERVADO: nenhuma regra do bloco afeta telas grandes", () => {
  assert.ok(board.includes("@media (max-width: 900px)"), "o bloco precisa estar sob max-width");
  assert.ok(!/@media \(min-width/.test(board), "o bloco nao pode alterar telas maiores");
  // As quatro colunas continuam renderizadas na arvore; quem esconde e o CSS.
  assert.ok(/COLUNAS\.map\(\(c\) => \(/.test(workspace), "o desktop continua renderizando as quatro colunas");
});

test("alvos de toque do segmento respeitam 44px", () => {
  const m = board.match(/\.nova-crm-etapas > button \{[^}]*min-height:\s*(\d+)px/);
  assert.ok(m && Number(m[1]) >= 44, "segmento precisa de min-height >= 44px");
});

test("CRM nao pode gerar scroll horizontal no celular", () => {
  assert.match(board, /\.nova-crm-board, \.nova-crm-col, \.nova-crm-fila-wrap \{[^}]*max-width:\s*100%/);
});

/* ------------------------------ Resultados ------------------------------ */

test("os sete resultados do briefing existem, na lingua do corretor", () => {
  assert.deepEqual(RESULTADOS_VISIVEIS.map((r) => r.rotulo), [
    "Consegui falar", "Não respondeu", "Número inválido", "Retornar depois",
    "Sem interesse", "Visita agendada", "Proposta realizada",
  ]);
});

test("visita vai para o Pipe de Visitas; proposta vai para a Esteira", () => {
  const porRotulo = (r) => RESULTADOS_VISIVEIS.find((x) => x.rotulo === r);
  assert.equal(porRotulo("Visita agendada").saida, "pipeline_visitas");
  assert.equal(porRotulo("Proposta realizada").saida, "esteira_vendas");
});

test("NENHUM resultado cria venda", () => {
  for (const r of RESULTADOS_VISIVEIS) {
    assert.equal(resultadoCriaVenda(r.chave), false, `${r.rotulo} nao pode criar venda`);
  }
});

test("PROPOSTA NAO E VENDA: proposta encaminha para a esteira, nao cria venda", () => {
  const comProposta = { proposta: { data: "2026-07-30" }, descartadoMotivo: null, visitaAgendadaEm: null, nutricao: null };
  assert.equal(saidaDoLead(comProposta), "esteira_vendas");
  // A esteira e um processo comercial; venda e outro estado, decidido fora daqui.
  assert.notEqual(saidaDoLead(comProposta), "venda");
});

test("o frontend nao cria venda em lugar nenhum do CRM Nova Era", () => {
  const src = readFileSync(new URL("../app/features/crm-nova-era/components/ActionModals.tsx", import.meta.url), "utf8");
  assert.ok(!/criarVenda|registrarVenda|novaVenda|\/api\/crm\/sales/i.test(src),
    "registrar proposta nao pode criar venda automaticamente");
});
