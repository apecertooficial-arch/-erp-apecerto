// CRM Nova Era (live) — testes do adaptador ncrm_estado/evento -> LeadNova.
// Puro: sem rede/banco. Executar: node --test tests/crm-nova-era/ncrm-adapter.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mapEstadoToLead, enriquecerComEventos } from "../../app/features/crm-nova-era/live/adapter.ts";

function estado(over = {}) {
  return {
    negocio_id: 100, etapa: "tentando_contato", respondeu: false, resposta_pendente: false,
    aguardando_automacao: false, tentativas_feitas: 2, proxima_acao_tipo: "tentativa_cadencia",
    proxima_acao_titulo: "Segunda tentativa", proxima_acao_em: "2026-07-28T15:00:00.000Z",
    ultima_interacao_em: "2026-07-28T12:00:00.000Z", temperatura: "morno", saida: null, saida_em: null,
    visita_id: null, proposta_id: null, descarte_motivo: null, descarte_detalhe: null, versao: 3,
    atualizado_em: "2026-07-28T12:00:00.000Z", msg_automatica_em: "2026-07-28T09:00:00.000Z",
    primeira_resposta_em: null,
    negocios: { id: 100, status: "aberto", lead_id: 7, corretor_id: 10,
      leads: { nome: "Fulano", telefone: "+55 11 95550-0101", email: "f@example.com" },
      corretores: { id: 10, nome: "Corretor A" } },
    ...over,
  };
}

test("mapEstadoToLead: etapa->coluna, temperatura->momento, contador->dots", () => {
  const l = mapEstadoToLead(estado());
  assert.equal(l.id, "100");
  assert.equal(l.nome, "Fulano");
  assert.equal(l.corretorNome, "Corretor A");
  assert.equal(l.coluna, "tentando_contato");
  assert.equal(l.momento, "morno");
  assert.equal(l.tentativas.length, 2, "tentativas sintetizadas = tentativas_feitas");
  assert.ok(l.tentativas.every((t) => t.resultado === "nao_respondeu"), "cadência só segue enquanto não respondeu");
  assert.equal(l.proximaAcaoTitulo, "Segunda tentativa");
});

test("mapEstadoToLead: etapa inválida cai em 'novo'; temperatura nula -> 'frio'", () => {
  const l = mapEstadoToLead(estado({ etapa: "xpto", temperatura: null }));
  assert.equal(l.coluna, "novo");
  assert.equal(l.momento, "frio");
});

test("mapEstadoToLead: saídas mapeadas", () => {
  assert.equal(mapEstadoToLead(estado({ saida: "pipeline_visitas", saida_em: "x" })).visitaAgendadaEm, "x");
  assert.ok(mapEstadoToLead(estado({ saida: "esteira_vendas", saida_em: "x" })).proposta);
  assert.equal(mapEstadoToLead(estado({ saida: "descartado", descarte_motivo: "sem_interesse" })).descartadoMotivo, "sem_interesse");
  assert.equal(mapEstadoToLead(estado({ saida: "nutricao" })).nutricao, true);
});

test("enriquecerComEventos: automação NÃO conta como tentativa; tentativas/ações reais entram", () => {
  const base = mapEstadoToLead(estado({ tentativas_feitas: 0 }));
  const eventos = [
    { id: 1, tipo: "mensagem_automatica", numero_tentativa: null, canal: null, resultado: null, payload: { message_id: "m1" }, origem: "automacao", criado_em: "2026-07-28T09:00:00.000Z", estado_versao_apos: 1 },
    { id: 2, tipo: "tentativa", numero_tentativa: 1, canal: "ligacao", resultado: "nao_respondeu", payload: { obs: "sem resposta" }, origem: "usuario", criado_em: "2026-07-28T10:00:00.000Z", estado_versao_apos: 2 },
    { id: 3, tipo: "acao_comercial", numero_tentativa: null, canal: null, resultado: "opcoes_enviadas", payload: { obs: "ok" }, origem: "usuario", criado_em: "2026-07-28T11:00:00.000Z", estado_versao_apos: 3 },
  ];
  const l = enriquecerComEventos(base, eventos, []);
  assert.equal(l.tentativas.length, 1, "só 1 tentativa humana (automação não conta)");
  assert.equal(l.tentativas[0].canal, "ligacao");
  assert.equal(l.acoesComerciais.length, 1);
  assert.equal(l.mensagemAutomaticaEnviadaEm, "2026-07-28T09:00:00.000Z");
});
