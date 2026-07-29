import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG_PADRAO, situacaoDoItem, contaComoErro, exigeAtencao,
  classificarPendente, backoffSegundos, totalEmAberto,
} from "../../app/features/crm-nova-era/lib/filaIngest.ts";

const item = (o) => ({ status: "pendente", temNegocio: true, finalizado: false, idadeMin: 0, tentativas: 0, ...o });

test("configuração conservadora inicial: janela de 30 minutos", () => {
  assert.equal(CONFIG_PADRAO.janelaSemNegocioMin, 30);
  assert.equal(CONFIG_PADRAO.janelaForaEscopoMin, 30);
});

test("negócio elegível e ainda por processar aparece como processável", () => {
  assert.equal(situacaoDoItem(item({ status: "pendente", temNegocio: true })), "processavel");
});

test("mensagem sem negócio aparece separada, nunca como erro", () => {
  const i = item({ temNegocio: false });
  assert.equal(situacaoDoItem(i), "aguardando_negocio");
  assert.equal(contaComoErro(i.status), false);
});

test("noop de qualquer tipo NUNCA conta como erro", () => {
  for (const s of ["noop", "noop_fora_do_escopo", "noop_sem_negocio_expirado", "processado", "pendente"]) {
    assert.equal(contaComoErro(s), false, `${s} não pode contar como erro`);
  }
});

test("erro técnico continua contando como erro", () => {
  assert.equal(contaComoErro("erro"), true);
  assert.equal(situacaoDoItem(item({ status: "erro" })), "falha_tecnica");
});

test("itens finalizados saem da fila operacional, mas continuam no histórico", () => {
  assert.equal(exigeAtencao(item({ status: "noop_fora_do_escopo", finalizado: true })), false);
  assert.equal(exigeAtencao(item({ status: "noop_sem_negocio_expirado", finalizado: true })), false);
  assert.equal(exigeAtencao(item({ status: "processado", finalizado: true })), false);
  assert.equal(exigeAtencao(item({ status: "pendente", finalizado: false })), true);
  assert.equal(exigeAtencao(item({ status: "erro", finalizado: false })), true);
  assert.equal(situacaoDoItem(item({ status: "noop_fora_do_escopo", finalizado: true })), "fora_do_piloto");
  assert.equal(situacaoDoItem(item({ status: "noop_sem_negocio_expirado", finalizado: true })), "sem_negocio_expirado");
});

test("corrida: negócio ainda pode aparecer dentro da janela", () => {
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 5 })), "aguardando_negocio");
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 29 })), "aguardando_negocio");
});

test("expiração sem negócio após a janela", () => {
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 30 })), "sem_negocio_expirado");
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 600 })), "sem_negocio_expirado");
});

test("negócio existente fora do piloto termina como fora do escopo", () => {
  assert.equal(classificarPendente(item({ temNegocio: true, idadeMin: 31 })), "fora_do_piloto");
});

test("nenhum item fica preso quando as tentativas se esgotam", () => {
  const quase = CONFIG_PADRAO.maxTentativas - 1;
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 1, tentativas: quase })), "sem_negocio_expirado");
  assert.equal(classificarPendente(item({ temNegocio: true, idadeMin: 1, tentativas: quase })), "fora_do_piloto");
});

test("backoff cresce e respeita o teto", () => {
  assert.equal(backoffSegundos(0), 60);
  assert.equal(backoffSegundos(1), 120);
  assert.equal(backoffSegundos(2), 240);
  assert.equal(backoffSegundos(30), CONFIG_PADRAO.backoffMaxSeg);
  assert.equal(backoffSegundos(-5), 60);
  for (let t = 0; t < 20; t++) assert.ok(backoffSegundos(t) <= CONFIG_PADRAO.backoffMaxSeg);
});

test("classificação é idempotente: reclassificar o mesmo item dá o mesmo resultado", () => {
  const i = item({ temNegocio: true, idadeMin: 90 });
  assert.equal(classificarPendente(i), classificarPendente(i));
  assert.equal(situacaoDoItem({ ...i, status: "noop_fora_do_escopo", finalizado: true }),
               situacaoDoItem({ ...i, status: "noop_fora_do_escopo", finalizado: true }));
});

test("o total em aberto ignora tudo que já foi encerrado", () => {
  const resumo = {
    processaveis: 2, aguardando_negocio: 3, falhas_tecnicas: 1,
    fora_do_piloto: 87, sem_negocio_expirado: 69, encerrados_outros: 6, processados: 17,
  };
  assert.equal(totalEmAberto(resumo), 6);
});

test("janela configurável muda o corte sem tocar no resto", () => {
  const cfg = { ...CONFIG_PADRAO, janelaSemNegocioMin: 120 };
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 90 }), cfg), "aguardando_negocio");
  assert.equal(classificarPendente(item({ temNegocio: false, idadeMin: 121 }), cfg), "sem_negocio_expirado");
});
