import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dentroDaJanelaComercial, ehDiaUtil, proximaManhaComercialSeguinte, JANELA_COMERCIAL_PADRAO,
} from "../../app/features/crm-nova-era/lib/janelaComercial.ts";
import { proximaEtapaCadenciaOficial, prioridadeFilaOficial } from "../../app/features/crm-nova-era/lib/operacaoOficial.ts";

const AGORA = "2026-07-28T12:00:00.000Z";
function hAtras(h) { return new Date(Date.parse(AGORA) - h * 3600000).toISOString(); }
function lead(over = {}) {
  return {
    id: "n1", nome: "L", telefone: "x", origem: "o", corretorNome: "A", coluna: "novo", momento: "frio",
    criadoEm: hAtras(1), respondeu: false, respostaPendenteCorretor: false, ultimaInteracaoEm: null,
    proximaAcaoTipo: null, proximaAcaoTitulo: null, proximaAcaoEm: null, tentativas: [], acoesComerciais: [],
    mensagemAutomaticaEnviadaEm: null, aguardandoRespostaAutomacao: false,
    visitaAgendadaEm: null, proposta: null, descartadoMotivo: null, nutricao: false, ...over,
  };
}
const t = (n) => Array.from({ length: n }, (_, i) => ({ numero: i + 1, canal: "whatsapp", resultado: "nao_respondeu", em: hAtras(1) }));

test("janela comercial: dia útil e horário; fim de semana não é útil", () => {
  // 2026-07-29 é quarta-feira. 12:00 local (=15:00 UTC) está dentro de 09:00–18:00.
  assert.equal(dentroDaJanelaComercial("2026-07-29T15:00:00.000Z"), true);
  // 06:00 local (=09:00 UTC) — antes de 09:00 local? 06:00<09:00 → fora
  assert.equal(dentroDaJanelaComercial("2026-07-29T09:00:00.000Z"), false);
  // sábado 2026-08-01 não é dia útil
  assert.equal(ehDiaUtil("2026-08-01T15:00:00.000Z"), false);
  assert.equal(ehDiaUtil("2026-07-29T15:00:00.000Z"), true);
});

test("proximaManhaComercialSeguinte: próximo dia útil às 09:00 local, pulando fim de semana", () => {
  // sexta 2026-07-31 -> próxima manhã útil = segunda 2026-08-03 09:00 local (=12:00 UTC)
  const seg = proximaManhaComercialSeguinte("2026-07-31T15:00:00.000Z");
  const d = new Date(seg);
  assert.equal(d.getUTCHours(), 12); // 09:00 local (offset -180)
  assert.equal(ehDiaUtil(seg), true);
  // não cai em sábado/domingo
  const dow = new Date(Date.parse(seg) + JANELA_COMERCIAL_PADRAO.tzOffsetMin * 60000).getUTCDay();
  assert.ok(dow >= 1 && dow <= 5);
});

test("T4 e T5 NÃO se sobrepõem (T4.ate < T5.de), T4 na janela comercial", () => {
  const ancora = "2026-07-28T14:00:00.000Z"; // terça
  const t4 = proximaEtapaCadenciaOficial(lead({ mensagemAutomaticaEnviadaEm: ancora, tentativas: t(3) }));
  const t5 = proximaEtapaCadenciaOficial(lead({ mensagemAutomaticaEnviadaEm: ancora, tentativas: t(4) }));
  assert.equal(t4.numero, 4);
  assert.equal(t5.numero, 5);
  // sem sobreposição: fim da T4 estritamente antes do início da T5
  assert.ok(Date.parse(t4.janelaAlvoISO.ate) < Date.parse(t5.janelaAlvoISO.de), "T4.ate deve ser < T5.de");
  // não é exatamente 24h coincidente
  assert.notEqual(Date.parse(t4.janelaAlvoISO.de), Date.parse(ancora) + 24 * 3600000);
  // T4 começa na janela comercial (dia útil, 09:00 local)
  assert.equal(new Date(t4.janelaAlvoISO.de).getUTCHours(), 12);
  assert.equal(ehDiaUtil(t4.janelaAlvoISO.de), true);
});

test("retorno combinado PREVALECE sobre cadência genérica (prioridade menor = mais alta)", () => {
  const retorno = lead({ respondeu: true, tentativas: t(1), proximaAcaoTipo: "retornar_contato", proximaAcaoEm: hAtras(2) });
  const generica = lead({ respondeu: true, tentativas: t(1), proximaAcaoTipo: "enviar_opcoes", proximaAcaoEm: hAtras(2) });
  const pRetorno = prioridadeFilaOficial(retorno, AGORA); // 3
  const pGenerica = prioridadeFilaOficial(generica, AGORA); // 5
  assert.equal(pRetorno, 3);
  assert.equal(pGenerica, 5);
  assert.ok(pRetorno < pGenerica, "retorno combinado deve ter prioridade mais alta que a cadência genérica");
});
