export const MAX_ENTRADA_BYTES = 256 * 1024;
const MAX_ENTRADA_DEPTH = 20;
const CAMPOS_RESERVADOS = new Set(["__proto__", "constructor", "prototype"]);

export type PayloadEntradaValido = {
  ok: true;
  body: Record<string, unknown>;
  lead: Record<string, unknown>;
};

export type PayloadEntradaInvalido = {
  ok: false;
  error: "INVALID_PAYLOAD" | "PAYLOAD_TOO_LARGE" | "PAYLOAD_TOO_COMPLEX" | "UNSAFE_FIELD";
  status: 400 | 413;
};

function scalarString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function firstScalarString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = scalarString(value);
    if (normalized) return normalized;
  }
  return "";
}

function assertSafeShape(value: unknown, depth = 0): void {
  if (depth > MAX_ENTRADA_DEPTH) throw new Error("PAYLOAD_TOO_COMPLEX");
  if (Array.isArray(value)) {
    for (const item of value) assertSafeShape(item, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (CAMPOS_RESERVADOS.has(key)) throw new Error("UNSAFE_FIELD");
    assertSafeShape(nested, depth + 1);
  }
}

export function stableJson(value: unknown, depth = 0): string {
  if (depth > MAX_ENTRADA_DEPTH) throw new Error("PAYLOAD_TOO_COMPLEX");
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item, depth + 1)).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(object[key], depth + 1)}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function normalizePayloadEntrada(value: unknown): PayloadEntradaValido | PayloadEntradaInvalido {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { ok: false, error: "INVALID_PAYLOAD", status: 400 };
  }
  const body = value as Record<string, unknown>;
  const serialized = JSON.stringify(body);
  if (new TextEncoder().encode(serialized).byteLength > MAX_ENTRADA_BYTES) {
    return { ok: false, error: "PAYLOAD_TOO_LARGE", status: 413 };
  }
  try {
    assertSafeShape(body);
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYLOAD_TOO_COMPLEX";
    return {
      ok: false,
      error: code === "UNSAFE_FIELD" ? "UNSAFE_FIELD" : "PAYLOAD_TOO_COMPLEX",
      status: 400,
    };
  }

  const lead = Object.create(null) as Record<string, unknown>;
  lead.nome = firstScalarString(body.nome, body.name, body.full_name, body.fullName) || "Lead";
  lead.telefone = firstScalarString(body.telefone, body.phone, body.whatsapp, body.numero, body.celular).replace(/\D/g, "");
  lead.email = firstScalarString(body.email);
  for (const [key, nested] of Object.entries(body)) if (!(key in lead)) lead[key] = nested;
  return { ok: true, body, lead };
}

export function classifyQueueFailure(status: number, raw: string): { error: string; status: number } {
  let description = "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    description = [parsed.code, parsed.message, parsed.details, parsed.hint]
      .filter((item) => typeof item === "string")
      .join(" ");
  } catch {
    description = "";
  }
  if (status === 409 || /IDEMPOTENCY_CONFLICT|23505/.test(description)) {
    return { error: "IDEMPOTENCY_CONFLICT", status: 409 };
  }
  return { error: "AUTOMATION_QUEUE_REJECTED", status: 502 };
}

export function parseQueueSuccess(raw: string): { fila_id: number; duplicado: boolean } | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const filaId = Number(parsed.fila_id);
    if (parsed.ok !== true || typeof parsed.duplicado !== "boolean" || !Number.isSafeInteger(filaId) || filaId <= 0) return null;
    return { fila_id: filaId, duplicado: parsed.duplicado };
  } catch {
    return null;
  }
}
