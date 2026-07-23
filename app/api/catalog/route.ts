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

  const { data: me } = await supabase.from("usuarios").select("role").eq("id", authData.user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "corretor";
  const canApprove = role === "admin" || role === "gestor" || role === "executivo";

  const { data, error } = await supabase
    .from("empreendimentos")
    .select(`
      id, nome, incorporadora, bairro, cidade, status, area_util, rascunho,
      dormitorios, suites, vagas, preco, created_at, publicado, origem,
      aprovacao, reprovacao_motivo, captado_por_usuario, captador_corretor_id,
      unidades (id, area_m2, tipologia, vagas, valor_tabela, valor_promo, disponivel),
      midias (id, tipo, storage_path, categoria, nome, is_capa)
    `)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
  const { data: favorites } = await supabase.from("produto_favoritos").select("empreendimento_id").eq("usuario_id", authData.user.id);
  const favoriteIds = new Set((favorites ?? []).map((item) => item.empreendimento_id));
  const { data: corretoresList } = await supabase.from("corretores").select("id,nome");
  const corretorNameById = new Map((corretoresList ?? []).map((c) => [c.id, c.nome]));

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
      price: item.preco ?? (prices.length ? Math.min(...prices) : null),
      area: areas.length ? Math.min(...areas) : item.area_util,
      bedrooms: item.dormitorios ?? (bedroomOptions.length ? Math.max(...bedroomOptions) : null),
      suites: item.suites,
      parking: item.vagas,
      available: availableUnits.length,
      units: units.length,
      media: media.length,
      coverUrl: cover ? publicMediaUrl(cover.storage_path) : null,
      draft: item.rascunho,
      approval: (item as { aprovacao?: string }).aprovacao ?? "aprovado",
      rejectionReason: (item as { reprovacao_motivo?: string | null }).reprovacao_motivo ?? null,
      mine: (item as { captado_por_usuario?: string | null }).captado_por_usuario === authData.user.id,
      capturedBy: corretorNameById.get((item as { captador_corretor_id?: number | null }).captador_corretor_id ?? -1) ?? null,
      favorite: favoriteIds.has(item.id),
    };
  });

  // Visibilidade: corretor só enxerga aprovados + os que ele mesmo captou (pra acompanhar pendente/reprovado).
  // Admin/gestor enxergam tudo (inclusive a fila de pendentes).
  const visible = canApprove ? catalog : catalog.filter((p) => p.approval === "aprovado" || p.mine);
  const pendingCount = catalog.filter((p) => p.approval === "pendente" && !p.draft).length;

  // Fila de UNIDADES de indicação pendentes (só para aprovadores).
  type PendingUnit = { id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null };
  let pendingUnits: PendingUnit[] = [];
  if (canApprove) {
    const { data: pu } = await supabase
      .from("unidades")
      .select("id, numero, tipologia, valor_tabela, valor_promo, empreendimento_id, proprietario_nome, captador_corretor_id, empreendimentos(nome)")
      .eq("de_terceiros", true).eq("aprovacao", "pendente");
    const unitIds = (pu ?? []).map((u) => u.id);
    const coverByUnit = new Map<string, string | null>();
    if (unitIds.length) {
      const { data: um } = await supabase.from("midias").select("unidade_id, storage_path, is_capa, created_at").in("unidade_id", unitIds).eq("tipo", "foto").order("is_capa", { ascending: false }).order("created_at", { ascending: true });
      for (const m of (um ?? [])) { const uid = (m as { unidade_id?: string }).unidade_id; if (uid && !coverByUnit.has(uid)) coverByUnit.set(uid, publicMediaUrl((m as { storage_path: string }).storage_path)); }
    }
    pendingUnits = (pu ?? []).map((u) => ({
      id: u.id, numero: u.numero, tipologia: u.tipologia,
      valor: u.valor_promo ?? u.valor_tabela ?? null,
      empreendimentoId: u.empreendimento_id,
      predio: ((u.empreendimentos as { nome?: string } | null)?.nome) ?? "—",
      proprietario: u.proprietario_nome,
      indicador: corretorNameById.get(u.captador_corretor_id ?? -1) ?? null,
      coverUrl: coverByUnit.get(u.id) ?? null,
    }));
  }

  return Response.json({
    mode: "production-readonly",
    role,
    canApprove,
    pendingCount,
    pendingUnits,
    count: visible.length,
    catalog: visible,
  });
}
