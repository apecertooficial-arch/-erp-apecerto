import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260828203000_central_sara_evento_unico.sql",
    import.meta.url,
  ),
  "utf8",
);
const clockBody = migration.match(
  /create or replace function public\.motor_relogio_central\(\)[\s\S]*?as \$function\$([\s\S]*?)\$function\$;/,
)?.[1] ?? "";
const saraEdge = readFileSync(
  new URL("../supabase/functions/f2-sara-reclassificar/index.ts", import.meta.url),
  "utf8",
);
const builderRuntime = readFileSync(
  new URL("../app/features/automations/automationBuilderRuntime.js", import.meta.url),
  "utf8",
);

function enfileirarEvento(fila, { automacaoId = 49, cardId, mensagemId, direcao }) {
  const eventType = direcao === "recebida"
    ? "conversation.message_received"
    : direcao === "enviada"
      ? "conversation.message_sent"
      : null;
  if (!eventType) return { ignorada: true };
  const chave = `${automacaoId}:${cardId}:${mensagemId}`;
  if (fila.some((item) => item.chave === chave)) return { duplicada: true };
  fila.push({
    chave,
    gatilho: "sara-ciclo-event-trigger",
    eventType,
    status: "pendente",
  });
  return { enfileirada: true };
}

function substituirCheckpoint(checkpoints, novo) {
  if (checkpoints.some((item) => item.eventKey === novo.eventKey)) return;
  for (const item of checkpoints) {
    if (item.cardId === novo.cardId && item.status === "pendente") {
      item.status = "cancelado";
    }
  }
  checkpoints.push({ ...novo, status: "pendente" });
}

function saraEventoElegivel({ descartado = false, etapa }) {
  return !descartado && etapa !== "legado";
}

test("uma automacao recebe mensagens de entrada e saida pelo mesmo contrato", () => {
  assert.match(migration, /sara-ciclo-event-trigger/);
  assert.match(migration, /conversation\.message_received/);
  assert.match(migration, /conversation\.message_sent/);
  assert.match(migration, /lead\.next_action_due/);
  assert.match(migration, /lead\.cadence_due/);
  assert.match(builderRuntime, /sara-ciclo-event-trigger/);
  assert.match(migration, /'Inteligencia de Conversa'/);
  assert.match(migration, /'\{options,agenteId\}',to_jsonb\(16\)/);
  for (const campo of [
    "aplicarEtapa",
    "aplicarMomento",
    "aplicarAcao",
    "aplicarTemperatura",
    "aplicarQualidade",
  ]) {
    assert.match(migration, new RegExp(`'${campo}',true`));
  }
});

test("proxima acao e um objeto contratual e agenda um unico checkpoint", () => {
  for (const campo of [
    "codigo",
    "tipo",
    "responsavel",
    "executar_em",
    "criterio_conclusao",
    "evidencia_esperada",
  ]) {
    assert.match(saraEdge, new RegExp(`${campo}:`));
  }
  assert.match(migration, /f2_sara_agendar_checkpoint/);
  assert.match(migration, /motor_fila_sara_checkpoint_ativo_uniq/);
  assert.match(migration, /motor_fila_sara_checkpoint_evento_uniq/);
  assert.match(migration, /lead_version/);
  assert.match(migration, /event_type/);
  assert.match(migration, /source_id/);
  assert.match(migration, /due_at=p_executar_em/);
});

test("cada mensagem gera evento proprio e o mesmo ID e idempotente", () => {
  const fila = [];
  assert.deepEqual(enfileirarEvento(fila, {
    cardId: "card-1", mensagemId: "msg-recebida", direcao: "recebida",
  }), { enfileirada: true });
  assert.deepEqual(enfileirarEvento(fila, {
    cardId: "card-1", mensagemId: "msg-enviada", direcao: "enviada",
  }), { enfileirada: true });
  assert.deepEqual(enfileirarEvento(fila, {
    cardId: "card-1", mensagemId: "msg-recebida", direcao: "recebida",
  }), { duplicada: true });
  assert.equal(fila.length, 2);
  assert.deepEqual(fila.map((item) => item.eventType), [
    "conversation.message_received",
    "conversation.message_sent",
  ]);
});

test("nova analise substitui o checkpoint anterior e preserva a chave idempotente", () => {
  const checkpoints = [];
  substituirCheckpoint(checkpoints, {
    cardId: "card-3",
    eventKey: "card-3:7:lead.cadence_due:analise-1",
    dueAt: "2026-08-29T12:00:00Z",
  });
  substituirCheckpoint(checkpoints, {
    cardId: "card-3",
    eventKey: "card-3:8:lead.next_action_due:analise-2",
    dueAt: "2026-08-30T12:00:00Z",
  });
  substituirCheckpoint(checkpoints, {
    cardId: "card-3",
    eventKey: "card-3:8:lead.next_action_due:analise-2",
    dueAt: "2026-08-30T12:00:00Z",
  });
  assert.equal(checkpoints.filter((item) => item.status === "pendente").length, 1);
  assert.equal(checkpoints.length, 2);
  assert.equal(checkpoints[0].status, "cancelado");
  assert.match(migration, /checkpoint_substituido_por_nova_analise/);
});

test("duas mensagens durante processamento nao sao coalescidas", () => {
  const fila = [];
  enfileirarEvento(fila, { cardId: "card-2", mensagemId: "msg-1", direcao: "recebida" });
  fila[0].status = "processando";
  enfileirarEvento(fila, { cardId: "card-2", mensagemId: "msg-2", direcao: "recebida" });
  assert.deepEqual(fila.map((item) => item.status), ["processando", "pendente"]);
  assert.doesNotMatch(migration, /select f\.id into v_fila_id/);
  assert.doesNotMatch(migration, /set lead=lead\|\|jsonb_build_object/);
  assert.match(migration, /perform public\.motor_enfileirar\(/);
  assert.match(migration, /status='cancelado'/);
  assert.match(migration, /checkpoint_substituido_por_mensagem/);
});

test("Sara cobre card ativo pre-corte sem reativar legado ou descartado", () => {
  assert.equal(saraEventoElegivel({ etapa: "em_atendimento" }), true);
  assert.equal(saraEventoElegivel({ etapa: "visita" }), true);
  assert.equal(saraEventoElegivel({ etapa: "legado" }), false);
  assert.equal(saraEventoElegivel({ etapa: "em_atendimento", descartado: true }), false);
  assert.match(migration, /f2_sara_evento_elegivel/);
  assert.match(migration, /f\.descartado_em is null/);
  assert.match(migration, /f\.etapa<>'legado'/);
  assert.doesNotMatch(migration, /f\.criado_em\s*>?=/);
  assert.match(migration, /2aa79b9776e4ca1d99206af596d806e6/);
  assert.match(migration, /545ad9a5674429c447dbd4d7b49e44d7/);
});

test("relogio preserva a fila e remove polling e checagem diaria da Sara", () => {
  assert.match(clockBody, /public\.motor_processar_fila\(\)/);
  assert.doesNotMatch(clockBody, /public\.motor_evento_mensagem\(300\)/);
  assert.doesNotMatch(clockBody, /public\.sara_checagem_diaria\(null\)/);
  assert.doesNotMatch(clockBody, /public\.motor_evento_retomar\(100\)/);
  assert.match(clockBody, /public\.motor_evento_prazo\(150\)/);
  assert.match(clockBody, /'mensagem','event_driven_trigger'/);
  assert.match(clockBody, /'checagem_diaria','desativada_event_driven'/);
});

test("arquiva sem excluir somente os fluxos absorvidos ou proibidos", () => {
  assert.match(migration, /where id in \(51,52,58,64,67,69\)/);
  assert.match(migration, /set ativa=false,\s*arquivada=true/);
  assert.doesNotMatch(migration, /delete from public\.automacoes/i);
  assert.doesNotMatch(migration, /cron\.unschedule|cron\.schedule/);
});

test("migracao fecha se mapas ou funcoes divergirem do snapshot auditado", () => {
  for (const hash of [
    "40906ba96e44fda928c58b9d58124398",
    "5b0b866f0ca6553a8b1a51f8c75591d0",
    "3e6956345c131475dd204429474c8efa",
    "c3ce46b74852a6891b9484f120198392",
    "d4da44eec6a0fbc2e85b2a05f9c3c0a5",
    "5d2d61f61618e10191291ae9c60c8f75",
  ]) {
    assert.match(migration, new RegExp(hash));
  }
  assert.match(migration, /AUTOMATION_STALE_VERSION/);
  assert.match(migration, /FUNCTION_STALE_VERSION/);
});
