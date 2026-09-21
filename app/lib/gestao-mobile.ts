export type PendenciasVisitaAgrupadas = {
  total: number;
  semCorretor: number;
  porCorretor: Map<string, number>;
};

function registro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function agruparPendenciasVisita(value: unknown): PendenciasVisitaAgrupadas | null {
  if (!Array.isArray(value)) return null;
  const porCorretor = new Map<string, number>();
  let semCorretor = 0;
  for (const item of value) {
    if (!registro(item)) return null;
    if (item.corretor_id == null) {
      semCorretor += 1;
      continue;
    }
    if ((typeof item.corretor_id !== "string" && typeof item.corretor_id !== "number")
        || !String(item.corretor_id).trim()) return null;
    const key = String(item.corretor_id);
    porCorretor.set(key, (porCorretor.get(key) ?? 0) + 1);
  }
  return { total: value.length, semCorretor, porCorretor };
}
