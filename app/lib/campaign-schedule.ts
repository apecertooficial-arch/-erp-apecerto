import { instanteSaoPaulo, normalizarInstanteSaoPaulo, somarDias } from "./timezone.ts";

export type DiasCampanha = "weekdays" | "all" | "saturday";
export type PlanoCampanha =
  | { ok: true; slots: string[] }
  | { ok: false; error: string };

function diaPermitido(data: string, dias: DiasCampanha) {
  const day = new Date(`${data}T12:00:00.000Z`).getUTCDay();
  if (dias === "all") return true;
  if (dias === "saturday") return day >= 1 && day <= 6;
  return day >= 1 && day <= 5;
}

export function planejarSlotsCampanha(input: {
  start: string;
  endTime: string;
  periodDays: number;
  days: DiasCampanha;
  rate: number;
  instanceCount: number;
  recipientCount: number;
  tailMs?: number;
  nowMs?: number;
}): PlanoCampanha {
  const startMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(input.start.trim());
  const startIso = normalizarInstanteSaoPaulo(input.start);
  if (!startMatch || !startIso || !/^\d{2}:\d{2}$/.test(input.endTime)) return { ok: false, error: "Defina data e horários válidos para a campanha." };
  if (![1, 3, 7, 14].includes(input.periodDays) || !["weekdays", "all", "saturday"].includes(input.days)) return { ok: false, error: "Defina um período válido para a campanha." };
  const tailMs = input.tailMs ?? 0;
  if (!Number.isInteger(input.rate) || input.rate < 1 || input.rate > 60 || !Number.isInteger(input.instanceCount) || input.instanceCount < 1 || !Number.isInteger(input.recipientCount) || input.recipientCount < 1 || !Number.isSafeInteger(tailMs) || tailMs < 0) return { ok: false, error: "A cadência da campanha é inválida." };

  const startMs = new Date(startIso).getTime();
  if (startMs < (input.nowMs ?? Date.now()) + 30_000) return { ok: false, error: "O início da campanha precisa estar no futuro." };

  const requiredSlots = Math.ceil(input.recipientCount / input.instanceCount);
  const gapMs = Math.ceil(3_600_000 / input.rate);
  const slots: string[] = [];
  for (let offset = 0; offset < input.periodDays && slots.length < requiredSlots; offset += 1) {
    const date = somarDias(startMatch[1], offset);
    if (!date || !diaPermitido(date, input.days)) continue;
    const dayStartIso = instanteSaoPaulo(date, startMatch[2]);
    const dayEndIso = instanteSaoPaulo(date, input.endTime);
    if (!dayStartIso || !dayEndIso) return { ok: false, error: "A janela diária da campanha é inválida." };
    const dayStart = new Date(dayStartIso).getTime();
    const dayEnd = new Date(dayEndIso).getTime();
    if (dayEnd <= dayStart) return { ok: false, error: "O horário final precisa ser posterior ao horário inicial." };
    for (let instant = dayStart; instant + tailMs < dayEnd && slots.length < requiredSlots; instant += gapMs) slots.push(new Date(instant).toISOString());
  }

  if (slots.length < requiredSlots) return { ok: false, error: "A janela escolhida não comporta todos os leads. Aumente o período, o horário final ou a velocidade." };
  return { ok: true, slots };
}
