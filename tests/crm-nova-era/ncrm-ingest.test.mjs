// Planejador do backend de entrada (ncrm-ingest). node --test.
import test from "node:test";
import assert from "node:assert/strict";
import { planejarIngest, interpretarRetornoRpc } from "../../supabase/functions/ncrm-ingest/logic.ts";

const AGORA = "2026-07-28T12:00:00.000Z";

test("mensagem automática -> ncrm_registrar_msg_automatica (idem pelo message_id)", () => {
  const p = planejarIngest({ tipo: "msg_automatica", negocioId: 100, messageId: "wamid.ABC", em: "2026-07-28T09:00:00Z" }, AGORA);
  assert.ok(p.ok && p.rpc === "ncrm_registrar_msg_automatica");
  assert.equal(p.args.p_negocio_id, 100);
  assert.equal(p.args.p_message_id, "wamid.ABC");
  assert.ok(p.args.p_enviado_em.startsWith("2026-07-28T09"));
});

test("resposta inbound -> ncrm_registrar_resposta_cliente", () => {
  const p = planejarIngest({ tipo: "resposta_inbound", negocioId: 7, messageId: "wamid.XYZ" }, AGORA);
  assert.ok(p.ok && p.rpc === "ncrm_registrar_resposta_cliente");
  assert.equal(p.args.p_em, AGORA, "usa agora quando 'em' ausente");
});

test("rejeita sem message_id / negócio inválido / tipo desconhecido", () => {
  assert.equal(planejarIngest({ tipo: "msg_automatica", negocioId: 1, messageId: "  " }, AGORA).ok, false);
  assert.equal(planejarIngest({ tipo: "resposta_inbound", negocioId: 0, messageId: "m" }, AGORA).ok, false);
  assert.equal(planejarIngest({ tipo: "outro", negocioId: 1, messageId: "m" }, AGORA).ok, false);
});

test("interpretarRetornoRpc: ja_processado e ok = 200; erro = 409", () => {
  assert.deepEqual(interpretarRetornoRpc({ ok: true, ja_processado: true }), { status: 200, body: { ok: true, ja_processado: true } });
  assert.equal(interpretarRetornoRpc({ ok: true, versao: 1 }).status, 200);
  assert.equal(interpretarRetornoRpc({ ok: false, erro: "sem_config_publicada" }).status, 409);
});
