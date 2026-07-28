import { test } from "node:test";
import assert from "node:assert/strict";
import {
  faixaPorAtrasoHoras, diagnosticoCarteiraLegada,
  acaoNovaEraPermitidaSobreLegado, resumoCarteiraNovaEra,
} from "../../app/features/crm-nova-era/lib/carteira.ts";

test("faixas por atraso", () => {
  assert.equal(faixaPorAtrasoHoras(null), "sem_atraso");
  assert.equal(faixaPorAtrasoHoras(-3), "sem_atraso");
  assert.equal(faixaPorAtrasoHoras(10), "ate_24h");
  assert.equal(faixaPorAtrasoHoras(30), "de_24_48h");
  assert.equal(faixaPorAtrasoHoras(60), "de_48_72h");
  assert.equal(faixaPorAtrasoHoras(100), "mais_72h");
});

test("diagnóstico legado é somente-leitura e nunca permite ação Nova Era", () => {
  const d = diagnosticoCarteiraLegada([{ negocioId: 1, atrasoHoras: 10 }]);
  assert.equal(d.somenteLeitura, true);
  assert.equal(d.permiteAcaoNovaEra, false);
  assert.equal(d.rotulo, "Diagnóstico da carteira antiga — ainda não migrada");
  assert.equal(acaoNovaEraPermitidaSobreLegado(), false);
});

test("sem dupla contagem: negócios já ingeridos na Nova Era são excluídos do diagnóstico", () => {
  const alertas = [
    { negocioId: 1, atrasoHoras: 10 },   // ate_24h
    { negocioId: 2, atrasoHoras: 30 },   // de_24_48h
    { negocioId: 3, atrasoHoras: 100 },  // mais_72h
    { negocioId: 4, atrasoHoras: null }, // sem_atraso
  ];
  const d = diagnosticoCarteiraLegada(alertas, [2, 3]); // 2 e 3 já migrados
  assert.equal(d.totalLegado, 4);
  assert.equal(d.ignoradosJaMigrados, 2);
  assert.equal(d.totalConsiderado, 2);
  assert.equal(d.porFaixa.ate_24h, 1);
  assert.equal(d.porFaixa.sem_atraso, 1);
  assert.equal(d.porFaixa.de_24_48h, 0); // excluído (migrado)
  assert.equal(d.porFaixa.mais_72h, 0);  // excluído (migrado)
  // soma das faixas = total considerado
  const soma = Object.values(d.porFaixa).reduce((a, b) => a + b, 0);
  assert.equal(soma, d.totalConsiderado);
});

test("carteira Nova Era vazia quando ncrm_estado = 0", () => {
  const vazia = resumoCarteiraNovaEra(0);
  assert.equal(vazia.vazia, true);
  assert.equal(vazia.total, 0);
  const cheia = resumoCarteiraNovaEra(12);
  assert.equal(cheia.vazia, false);
  assert.equal(cheia.total, 12);
});

test("cenário atual: ~1118 alertas legados, carteira Nova Era vazia, sem dupla contagem", () => {
  const alertas = Array.from({ length: 1118 }, (_, i) => ({ negocioId: i + 1, atrasoHoras: (i % 5) * 20 }));
  const d = diagnosticoCarteiraLegada(alertas, []); // nada migrado ainda
  assert.equal(d.totalConsiderado, 1118);
  assert.equal(resumoCarteiraNovaEra(0).vazia, true);
  // os 1118 pertencem SÓ ao diagnóstico legado, nunca à carteira Nova Era
  const soma = Object.values(d.porFaixa).reduce((a, b) => a + b, 0);
  assert.equal(soma, 1118);
});
