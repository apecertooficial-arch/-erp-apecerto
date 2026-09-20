const PUBLIC_RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function publicJson(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { ...PUBLIC_RESPONSE_HEADERS, ...headers },
  });
}

export function publicToken(request: Request, bodyToken?: unknown) {
  return request.headers.get("x-apecerto-public-token")?.trim()
    || (typeof bodyToken === "string" ? bodyToken.trim() : "")
    || new URL(request.url).searchParams.get("token")?.trim()
    || "";
}
