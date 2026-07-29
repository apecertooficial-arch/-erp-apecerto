import { test } from "node:test";
import assert from "node:assert/strict";
import {
  proximaEtapaCadenciaOficial, MAX_TENTATIVAS_OFICIAL, PLANO_CADENCIA_OFICIAL,
  classificarSLAOficial, prioridadeFilaOficial, ordenarFilaOficial,
  contarPorPrioridade, contarPorSLA, retornoCombinadoValido,
} from "../../app/features/crm-nova-era/lib/operacaoOficial.ts";

const AGORA = "2026-07-28T12:00:00.000Z";
function hAtras(h) { return new Date(Date.parse(AGORA) - h * 3600000).toISOString(); }
function hFut(h) { return new Date(Date.parse(AGORA) + h * 3600000).toISOString(); }

function lead(over = {}) {
  return {
    id: "n1", nome: "L", telefone: "x", origem: "o", corretorNome: "A",
    coluna: "novo", momento: "frio", criadoEm: hAtras(1),
    respondeu: false, respostaPendenteCorretor: false, ultimaInteracaoEm: null,
    proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null,
    tentativas: [], acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: null, aguardandoRespostaAutomacao: false,
    visitaAgendadaEm: null, proposta: null, descartadoMotivo: null, nutricao: false,
    ...over,
  };
}
const t = (n) => Array.from({ length: n }, (_, i) => ({ numero: i + 1, canal: "whatsapp", resultado: "nao_respondeu", em: hAtras(1) }));

test("cadência oficial: T1 (0–5min), T2 (30–60min), acompanhamento D3, encerrada ao responder", () => {
  const ancora = "2026-07-28T09:00:00.000Z";
  const e1 = proximaEtapaCadenciaOficial(lead({ mensagemAutomaticaEnviadaEm: ancora }));
  assert.equal(e1.fase, "intensiva"); assert.equal(e1.numero, 1);
  assert.equal(Date.parse(e1.janelaAlvoISO.de), Date.parse(ancora));
  assert.equal(Date.parse(e1.janelaAlvoISO.ate), Date.parse(ancora) + 5 * 60000);
  const e2 = proximaEtapaCadenciaOficial(lead({ mensagemAutomaticaEnviadaEm: ancora, tentativas: t(1) }));
  assert.equal(e2.numero, 2); assert.equal(e2.canalPreferido, "whatsapp");
  assert.equal(Date.parse(e2.janelaAlvoISO.de), Date.parse(ancora) + 30 * 60000);
  assert.equal(Date.parse(e2.janelaAlvoISO.ate), Date.parse(ancora) + 60 * 60000);
  const eAcomp = proximaEtapaCadenciaOficial(lead({ mensagemAutomaticaEnviadaEm: ancora, tentativas: t(MAX_TENTATIVAS_OFICIAL) }));
  assert.equal(eAcomp.fase, "acompanhamento"); assert.equal(eAcomp.numero, 3);
  const enc = proximaEtapaCadenciaOficial(lead({ respondeu: true }));
  assert.equal(enc.fase, "encerrada");
  assert.equal(MAX_TENTATIVAS_OFICIAL, 5);
  assert.deepEqual(PLANO_CADENCIA_OFICIAL.acompanhamentoDias, [3, 7, 14, 30]);
});

test("SLA oficial: chegaram_agora, nova_mensagem, verde, amarelo, vermelho, preto", () => {
  assert.equal(classificarSLAOficial(lead(), AGORA), "chegaram_agora");
  assert.equal(classificarSLAOficial(lead({ respostaPendenteCorretor: true }), AGORA), "nova_mensagem");
  assert.equal(classificarSLAOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoEm: hFut(3) }), AGORA), "verde");
  assert.equal(classificarSLAOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoEm: hAtras(30) }), AGORA), "amarelo");
  assert.equal(classificarSLAOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoEm: hAtras(60) }), AGORA), "vermelho");
  assert.equal(classificarSLAOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoEm: hAtras(100) }), AGORA), "preto");
  // limites exatos
  assert.equal(classificarSLAOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoEm: hAtras(23.9) }), AGORA), "verde");
  assert.equal(classificarSLAOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoEm: hAtras(48) }), AGORA), "vermelho");
});

test("prioridade oficial 1..6 e retorno combinado vencido é categoria 3", () => {
  assert.equal(prioridadeFilaOficial(lead({ respostaPendenteCorretor: true }), AGORA), 1);
  assert.equal(prioridadeFilaOficial(lead(), AGORA), 2); // novo sem atuação
  assert.equal(prioridadeFilaOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoTipo: "retornar_contato", proximaAcaoEm: hAtras(2) }), AGORA), 3);
  assert.equal(prioridadeFilaOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoTipo: "agendar_visita", proximaAcaoEm: hFut(5) }), AGORA), 4);
  assert.equal(prioridadeFilaOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: hAtras(2) }), AGORA), 5);
  assert.equal(prioridadeFilaOficial(lead({ respondeu: true, tentativas: t(1), proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: hFut(5) }), AGORA), 6);
});

test("retorno combinado exige data/hora", () => {
  assert.equal(retornoCombinadoValido(lead({ proximaAcaoTipo: "retornar_contato", proximaAcaoEm: null })), false);
  assert.equal(retornoCombinadoValido(lead({ proximaAcaoTipo: "retornar_contato", proximaAcaoEm: hFut(3) })), true);
  assert.equal(retornoCombinadoValido(lead({ proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: null })), true); // não é retorno
});

test("saídas (visita/proposta/descarte) ficam FORA da fila", () => {
  const leads = [
    lead({ id: "a", respostaPendenteCorretor: true }),
    lead({ id: "b", proposta: { produto: "P", valor: 1, data: AGORA } }),
    lead({ id: "c", visitaAgendadaEm: AGORA }),
    lead({ id: "d", descartadoMotivo: "x" }),
  ];
  const fila = ordenarFilaOficial(leads, AGORA);
  assert.deepEqual(fila.map((i) => i.lead.id), ["a"]);
});

test("sem dupla contagem: soma das prioridades = tamanho da fila; SLA idem", () => {
  const leads = [
    lead({ id: "a", respostaPendenteCorretor: true }),
    lead({ id: "b" }),
    lead({ id: "c", respondeu: true, tentativas: t(1), proximaAcaoTipo: "retornar_contato", proximaAcaoEm: hAtras(2) }),
    lead({ id: "d", respondeu: true, tentativas: t(1), proximaAcaoTipo: "preparar_proposta", proximaAcaoEm: hFut(2) }),
    lead({ id: "e", respondeu: true, tentativas: t(1), proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: hAtras(2) }),
    lead({ id: "f", respondeu: true, tentativas: t(1), proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: hFut(5) }),
  ];
  const fila = ordenarFilaOficial(leads, AGORA);
  const pri = contarPorPrioridade(leads, AGORA);
  const sla = contarPorSLA(leads, AGORA);
  const somaPri = Object.values(pri).reduce((a, b) => a + b, 0);
  const somaSla = Object.values(sla).reduce((a, b) => a + b, 0);
  assert.equal(somaPri, fila.length);
  assert.equal(somaSla, fila.length);
  assert.equal(fila.length, 6);
  // ordenação por prioridade crescente
  assert.deepEqual(fila.map((i) => i.prioridade), [1, 2, 3, 4, 5, 6]);
});
