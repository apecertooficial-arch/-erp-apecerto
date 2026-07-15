import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type UnitRow = {
  id: string;
  area_m2: number | null;
  tipologia: string | null;
  vagas: number | null;
  valor_tabela: number | null;
  valor_promo: number | null;
  disponivel: boolean;
};

type MediaRow = {
  id: string;
  tipo: string;
  storage_path: string;
  categoria: string | null;
  nome: string | null;
  is_capa: boolean;
};

function publicMediaUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/empreendimentos/${encodedPath}`;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data, error } = await supabase
    .from("empreendimentos")
    .select(`
      id, nome, incorporadora, bairro, cidade, status, area_util, rascunho,
      dormitorios, suites, vagas, preco, created_at, publicado, origem,
      unidades (id, area_m2, tipologia, vagas, valor_tabela, valor_promo, disponivel),
      midias (id, tipo, storage_path, categoria, nome, is_capa)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
  const { data: favorites } = await supabase.from("produto_favoritos").select("empreendimento_id").eq("usuario_id", authData.user.id);
  const favoriteIds = new Set((favorites ?? []).map((item) => item.empreendimento_id));

  const catalog = (data ?? []).map((item) => {
    const units = (item.unidades ?? []) as UnitRow[];
    const media = (item.midias ?? []) as MediaRow[];
    const availableUnits = units.filter((unit) => unit.disponivel);
    const prices = availableUnits
      .map((unit) => unit.valor_promo ?? unit.valor_tabela)
      .filter((value): value is number => typeof value === "number");
    const areas = availableUnits
      .map((unit) => unit.area_m2)
      .filter((value): value is number => typeof value === "number");
    const cover = media.find((item) => item.tipo === "foto" && item.is_capa)
      ?? media.find((item) => item.tipo === "foto");
    const bedroomOptions = units.map((unit) => {
      const match = unit.tipologia?.match(/(\d+)\s*(?:dorm|su[ií]te)/i);
      return match ? Number(match[1]) : /studio/i.test(unit.tipologia ?? "") ? 0 : null;
    }).filter((value): value is number => value !== null);

    return {
      id: item.id,
      name: item.nome,
      developer: item.incorporadora,
      neighborhood: item.bairro ?? "Bairro não informado",
      city: item.cidade ?? "São Paulo",
      status: item.status,
      origin: item.origem,
      published: item.publicado,
      price: prices.length ? Math.min(...prices) : item.preco,
      area: areas.length ? Math.min(...areas) : item.area_util,
      bedrooms: item.dormitorios ?? (bedroomOptions.length ? Math.max(...bedroomOptions) : null),
      suites: item.suites,
      parking: item.vagas,
      available: availableUnits.length,
      units: units.length,
      media: media.length,
      coverUrl: cover ? publicMediaUrl(cover.storage_path) : null,
      draft: item.rascunho,
      favorite: favoriteIds.has(item.id),
    };
  });

  return Response.json({
    mode: "production-readonly",
    count: catalog.length,
    catalog,
  });
}
