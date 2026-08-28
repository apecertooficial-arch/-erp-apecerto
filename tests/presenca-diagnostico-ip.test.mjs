import assert from "node:assert/strict";
import test from "node:test";

import {
  criarDiagnosticoPresenca,
  mascararIp,
} from "../app/features/presence/presenceDiagnostic.mjs";

test("mascara IPv4 sem conservar os octetos finais", () => {
  assert.equal(mascararIp("189.18.123.45"), "189.18.x.x");
  assert.equal(mascararIp("10.0.0.7"), "10.0.x.x");
  assert.doesNotMatch(mascararIp("189.18.123.45"), /123|45/);
});

test("mascara IPv6 e nao devolve o endereco completo", () => {
  const mascarado = mascararIp("2001:db8:abcd:12::1");
  assert.equal(mascarado, "2001:db8:…");
  assert.doesNotMatch(mascarado, /abcd|::1/);
});

test("diagnostico correspondente informa horario e orienta confirmacao", () => {
  const diagnostico = criarDiagnosticoPresenca({
    ip: "189.18.123.45",
    corresponde: true,
    observadoEm: "2026-08-28T16:30:00.000Z",
  });
  assert.deepEqual(diagnostico, {
    corresponde: true,
    ip_mascarado: "189.18.x.x",
    observado_em: "2026-08-28T16:30:00.000Z",
    orientacao: "Rede do escritório reconhecida. Confirme sua presença para participar da distribuição.",
  });
});

test("diagnostico divergente e ausente falham fechados sem expor IP", () => {
  const divergente = criarDiagnosticoPresenca({
    ip: "177.26.9.8",
    corresponde: false,
    observadoEm: "2026-08-28T16:31:00.000Z",
  });
  assert.equal(divergente.corresponde, false);
  assert.equal(divergente.ip_mascarado, "177.26.x.x");
  assert.match(divergente.orientacao, /fora da lista reconhecida/i);
  assert.doesNotMatch(JSON.stringify(divergente), /177\.26\.9\.8/);

  const ausente = criarDiagnosticoPresenca({ ip: "", corresponde: false });
  assert.equal(ausente.ip_mascarado, "indisponível");
  assert.match(ausente.orientacao, /não foi possível identificar/i);
});
