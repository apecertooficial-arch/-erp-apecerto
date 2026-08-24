import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SP_BOUNDS = { minLat: -24.2, maxLat: -23.2, minLon: -47.2, maxLon: -46.0 } as const;

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    country_code?: string;
    road?: string;
    pedestrian?: string;
  };
};

function normalizeText(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function addressNumber(value: unknown) {
  return (String(value ?? "").match(/\d{1,6}/)?.[0] ?? "").replace(/^0+/, "") || "0";
}

function withinSaoPaulo(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= SP_BOUNDS.minLat && lat <= SP_BOUNDS.maxLat
    && lon >= SP_BOUNDS.minLon && lon <= SP_BOUNDS.maxLon;
}

function resultMatchesAddress(result: NominatimResult, street: string, number: string) {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!withinSaoPaulo(lat, lon) || normalizeText(result.address?.country_code) !== "br") return false;
  if (addressNumber(result.address?.house_number) !== addressNumber(number)) return false;
  const ignored = new Set(["rua", "avenida", "av", "alameda", "dos", "das", "do", "da", "de", "e"]);
  const tokens = normalizeText(street).split(" ").filter((token) => token.length >= 4 && !ignored.has(token) && !/^\d+$/.test(token));
  const returned = normalizeText([result.address?.road, result.address?.pedestrian, result.display_name].filter(Boolean).join(" "));
  return tokens.length > 0 && tokens.some((token) => returned.includes(token));
}

// Geocoding NO SERVIDOR (mesma origem do site) — o navegador nunca chama o
// Nominatim direto, então bloqueadores/Brave Shields/firewall não impedem o mapa.
// A primeira busca de cada prédio é cacheada no banco (RPC idempotente).
async function geocode(row: Record<string, unknown>): Promise<{ lat: number; lon: number } | null> {
  const clean = (v: unknown) => String(v ?? "").replace(/[;,·\-–—\s]+$/g, "").replace(/\s+/g, " ").trim();
  const endereco = clean(row.endereco);
  const numeroCampo = clean(row.numero);
  const numero = numeroCampo || (endereco.match(/(?:,|\s)(\d{1,6})(?:\D|$)/)?.[1] ?? "");
  const rua = numeroCampo ? endereco : endereco.replace(new RegExp("(?:,|\\s)" + numero + "(?:\\D.*)?$"), "").trim();
  const bairro = clean(row.bairro);
  const cidade = clean(row.cidade) || "São Paulo";
  const uf = clean(row.uf) || "SP";
  const cep = clean(row.cep);
  if (!rua || !numero) return null;
  const queries = Array.from(new Set([
    [`${rua}, ${numero}`, bairro, cidade, uf, "Brasil"].filter(Boolean).join(", "),
    cep ? [`${rua}, ${numero}`, cep, cidade, uf, "Brasil"].filter(Boolean).join(", ") : "",
  ].filter(Boolean)));
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "apecerto-erp/1.0 (suporte@apecerto.com.br)", Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) continue;
      const arr = await res.json() as NominatimResult[];
      const exact = Array.isArray(arr) ? arr.find((item) => resultMatchesAddress(item, rua, numero)) : null;
      if (exact?.lat && exact.lon) {
        return { lat: Number(exact.lat), lon: Number(exact.lon) };
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
    .select("id, nome, latitude, longitude, endereco, numero, bairro, cidade, uf, cep")
    .eq("id", id)
    .single();
  if (error || !data) return Response.json({ error: "Produto não encontrado." }, { status: 404 });

  const row = data as Record<string, unknown>;
  if (row.latitude != null && row.longitude != null) {
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    if (!withinSaoPaulo(lat, lon)) return Response.json({ error: "A localização cadastrada precisa ser revisada." }, { status: 422 });
    return Response.json({ lat, lon, cached: true });
  }

  const coord = await geocode(row);
  if (!coord) return Response.json({ error: "Não foi possível localizar o endereço." }, { status: 422 });

  // Cacheia somente com a sessão do usuário; a RPC respeita grants e RLS.
  const { error: cacheError } = await supabase.rpc("set_empreendimento_coords", { p_id: id, p_lat: coord.lat, p_lon: coord.lon });
  if (cacheError) {
    const denied = cacheError.code === "42501";
    return Response.json({ error: denied ? "Você não pode alterar a localização deste produto." : "Não foi possível salvar a localização agora." }, { status: denied ? 403 : 503 });
  }

  return Response.json({ lat: coord.lat, lon: coord.lon, cached: false });
}
