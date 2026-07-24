import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Geocoding NO SERVIDOR (mesma origem do site) — o navegador nunca chama o
// Nominatim direto, então bloqueadores/Brave Shields/firewall não impedem o mapa.
// A primeira busca de cada prédio é cacheada no banco (RPC idempotente).
async function geocode(row: Record<string, unknown>): Promise<{ lat: number; lon: number } | null> {
  const clean = (v: unknown) => String(v ?? "").replace(/[;,·\-–—\s]+$/g, "").replace(/\s+/g, " ").trim();
  const rua = clean(row.endereco);
  const num = clean(row.numero);
  const bairro = clean(row.bairro);
  const cidade = clean(row.cidade) || "São Paulo";
  const uf = clean(row.uf) || "SP";
  const cep = clean(row.cep);
  const queries = Array.from(new Set([
    [rua && num ? `${rua}, ${num}` : rua, bairro, cidade, uf, "Brasil"].filter(Boolean).join(", "),
    cep ? [cep, cidade, "Brasil"].filter(Boolean).join(", ") : "",
    [bairro, cidade, uf, "Brasil"].filter(Boolean).join(", "),
  ].filter(Boolean)));
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "apecerto-erp/1.0 (suporte@apecerto.com.br)", Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) continue;
      const arr = await res.json() as Array<{ lat?: string; lon?: string }>;
      if (Array.isArray(arr) && arr.length && arr[0].lat && arr[0].lon) {
        const lat = Number(arr[0].lat);
        const lon = Number(arr[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
      }
    } catch { /* tenta a próxima query */ }
  }
  return null;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });

  const { data, error } = await supabase
    .from("empreendimentos")
    .select("id, latitude, longitude, endereco, numero, bairro, cidade, uf, cep")
    .eq("id", id)
    .single();
  if (error || !data) return Response.json({ error: "Produto não encontrado." }, { status: 404 });

  const row = data as Record<string, unknown>;
  if (row.latitude != null && row.longitude != null) {
    return Response.json({ lat: Number(row.latitude), lon: Number(row.longitude), cached: true });
  }

  const coord = await geocode(row);
  if (!coord) return Response.json({ error: "Não foi possível localizar o endereço." }, { status: 422 });

  // Cacheia (idempotente — só grava se estiver nulo). Best-effort.
  try { await supabase.rpc("set_empreendimento_coords", { p_id: id, p_lat: coord.lat, p_lon: coord.lon }); } catch { /* segue mesmo se falhar */ }

  return Response.json({ lat: coord.lat, lon: coord.lon, cached: false });
}
