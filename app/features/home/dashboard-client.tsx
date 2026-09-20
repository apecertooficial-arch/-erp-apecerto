"use client";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function fetchDashboardSection<T>(
  accessToken: string,
  section: "financeiro" | "funil" | "namesa" | "rodagem",
  key: string,
  validate: (value: unknown) => value is T,
  signal: AbortSignal,
) {
  const suffix = section === "rodagem" ? "" : `?section=${section}`;
  const response = await fetch(`/api/dashboard${suffix}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok || !isRecord(body) || !validate(body[key])) {
    throw new Error("dashboard_indisponivel");
  }
  return body[key];
}

export function DashboardSectionError({ titulo, onRetry }: { titulo: string; onRetry: () => void }) {
  return <section className="hv2-dashboard-error" role="alert">
    <strong>{titulo} indisponível</strong>
    <span>Não foi possível confirmar estes indicadores agora.</span>
    <button type="button" onClick={onRetry}>Tentar novamente</button>
  </section>;
}
