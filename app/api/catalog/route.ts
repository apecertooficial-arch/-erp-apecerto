import { createServerSupabaseClient } from "../../lib/supabase/server";
import { assessProductQuality, isPlausibleProductPrice } from "../../features/products/quality";
import { isProductManagerRole } from "../../features/products/access";
import { isProductPublishedOnSite } from "../../features/products/publication";
import { resolveCommercialOrigin } from "../../features/products/product-domain";

export const dynamic = "force-dynamic";

type UnitRow = {
  id: string;
  numero: string | null;
  area_m2: number | null;
  tipologia: string | null;
  vagas: number | null;
  valor_tabela: number | null;
  valor_promo: number | null;
  disponivel: boolean;
  aprovacao: string | null;
  codigo: string | null;
  captador_corretor_id: number | null;
  de_terceiros: boolean | null;
  reprovacao_motivo: string | null;
  publicado: boolean;
  compre_ja_alugado: boolean;
  condominio_valor: number | null;
  iptu: number | null;
  outros_custos: number | null;
};

type MediaRow = {
  id: string;
  tipo: string;
  unidade_id?: string | null;
  storage_path: string;
  categoria: string | null;
  nome: string | null;
  is_capa: boolean;
  created_at: string;
};

type CondominiumRow = {
  id: string;
  nome: string;
  cep: string | null;
  endereco: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
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
  const canApprove = isProductManagerRole(role);

  const { data, error } = await supabase
    .from("empreendimentos")
    .select(`
      id, nome, titulo, slug, slogan, descricao, finalidade, incorporadora, endereco, numero,
      bairro, cidade, uf, cep, status, area_util, rascunho, dormitorios, suites, banheiros,
      vagas, preco, condominio_valor, iptu, outros_custos, created_at, published_at,
      publicado, origem, condominio_id, lazer, diferenciais, tour_url,
      aprovacao, reprovacao_motivo, captado_por_usuario, captador_corretor_id,
      codigo,
      unidades (id, numero, area_m2, tipologia, vagas, valor_tabela, valor_promo, condominio_valor, iptu, outros_custos, compre_ja_alugado, disponivel, aprovacao, codigo, captador_corretor_id, de_terceiros, reprovacao_motivo, publicado),
      midias (id, tipo, storage_path, categoria, nome, is_capa, created_at, unidade_id)
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
  const { data: favorites } = await supabase.from("produto_favoritos").select("empreendimento_id").eq("usuario_id", authData.user.id);
  const favoriteIds = new Set((favorites ?? []).map((item) => item.empreendimento_id));
  const { data: corretoresList } = await supabase.from("corretores").select("id,nome");
  const corretorNameById = new Map((corretoresList ?? []).map((c) => [c.id, c.nome]));
  const { data: currentBroker } = await supabase.from("corretores").select("id").eq("usuario_id", authData.user.id).maybeSingle();
  const currentBrokerId = currentBroker?.id ?? null;
  const { data: condominiumRows, error: condominiumError } = await supabase
    .from("condominios")
    .select("id,nome,cep,endereco,numero,bairro,cidade,uf")
    .order("nome");
  if (condominiumError) return Response.json({ error: condominiumError.message }, { status: 502 });
  const { data: qualityRows } = await supabase.rpc("produto_qualidade_fila");
  const { data: originRows } = await supabase.rpc("produto_unidades_origens");
  const originByUnit = new Map((originRows ?? []).map((row) => [row.unidade_id, row.origem_comercial]));
  const qualityQueue = (qualityRows ?? []).map((row) => ({
    unitId: row.unidade_id,
    productId: row.empreendimento_id,
    codigo: row.codigo,
    numero: row.numero,
    productName: row.produto_nome,
    segment: row.origem_comercial,
    issues: row.problemas,
  }));
  const catalogIds = (data ?? []).map((item) => item.id);
  const { data: leadLinks } = catalogIds.length
    ? await supabase.from("lead_produtos").select("empreendimento_id").in("empreendimento_id", catalogIds)
    : { data: [] };
  const leadCountByProduct = new Map<string, number>();
  for (const link of leadLinks ?? []) leadCountByProduct.set(link.empreendimento_id, (leadCountByProduct.get(link.empreendimento_id) ?? 0) + 1);

  const catalog = (data ?? []).map((item) => {
    const units = (item.unidades ?? []) as UnitRow[];
    const unitMine = currentBrokerId != null && units.some((unit) => unit.captador_corretor_id === currentBrokerId);
    const allMedia = (item.midias ?? []) as MediaRow[];
    const standalone = item.origem === "terceiros" && !item.condominio_id;
    const media = standalone ? allMedia : allMedia.filter((entry) => !entry.unidade_id);
    const approvedUnits = units.filter((unit) => (unit.aprovacao ?? "aprovado") === "aprovado");
    const availableUnits = approvedUnits.filter((unit) => unit.disponivel);
    const publishedAvailableUnits = availableUnits.filter((unit) => unit.publicado !== false);
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
    const price = item.preco ?? (prices.length ? Math.min(...prices) : null);
    const area = areas.length ? Math.min(...areas) : item.area_util;
    const photoMedia = media.filter((entry) => entry.tipo === "foto");
    const videoMedia = media.filter((entry) => entry.tipo === "video");
    const quality = assessProductQuality({
      name: item.nome,
      title: item.titulo,
      slogan: item.slogan,
      description: item.descricao,
      purpose: item.finalidade,
      price,
      area,
      bedrooms: item.dormitorios ?? (bedroomOptions.length ? Math.max(...bedroomOptions) : null),
      bathrooms: item.banheiros,
      parking: item.vagas,
      address: item.endereco,
      number: item.numero,
      neighborhood: item.bairro,
      city: item.cidade,
      state: item.uf,
      zip: item.cep,
      condominiumFee: item.condominio_valor,
      propertyTax: item.iptu,
      otherCosts: item.outros_custos,
      photos: photoMedia.length,
      videos: videoMedia.length,
      hasCover: photoMedia.some((entry) => entry.is_capa),
      mediaCategories: photoMedia.map((entry) => entry.categoria ?? ""),
      tourUrl: item.tour_url,
      units: approvedUnits.length,
      availableUnits: availableUnits.length,
      unitsWithValidPrice: prices.filter((value) => isPlausibleProductPrice(value, item.finalidade)).length,
      amenities: item.lazer,
      differentiators: item.diferenciais,
    });
    const activityDates = [item.created_at, item.published_at, ...media.map((entry) => entry.created_at)]
      .map((value) => Date.parse(value ?? ""))
      .filter(Number.isFinite);
    const updatedAt = new Date(Math.max(...activityDates)).toISOString();

    return {
      id: item.id,
      name: item.nome,
      title: item.titulo,
      slug: item.slug,
      purpose: item.finalidade,
      address: item.endereco,
      developer: item.incorporadora,
      neighborhood: item.bairro ?? "Bairro não informado",
      city: item.cidade ?? "São Paulo",
      status: item.status,
      origin: item.origem,
      standalone,
      published: isProductPublishedOnSite({
        published: item.publicado,
        draft: item.rascunho,
        approval: item.aprovacao,
        status: item.status,
        availableApprovedUnits: publishedAvailableUnits.length,
      }),
      price,
      area,
      bedrooms: item.dormitorios ?? (bedroomOptions.length ? Math.max(...bedroomOptions) : null),
      suites: item.suites,
      parking: item.vagas,
      available: availableUnits.length,
      units: approvedUnits.length,
      media: media.length,
      coverUrl: cover ? publicMediaUrl(cover.storage_path) : null,
      draft: item.rascunho,
      approval: (item as { aprovacao?: string }).aprovacao ?? "aprovado",
      rejectionReason: (item as { reprovacao_motivo?: string | null }).reprovacao_motivo ?? null,
      mine: (item as { captado_por_usuario?: string | null }).captado_por_usuario === authData.user.id || unitMine,
      capturedBy: corretorNameById.get((item as { captador_corretor_id?: number | null }).captador_corretor_id ?? -1) ?? null,
      capturedByScore: null as number | null,
      favorite: favoriteIds.has(item.id),
      quality,
      topIssue: quality.blocking[0] ?? null,
      createdAt: item.created_at,
      updatedAt,
      leads: leadCountByProduct.get(item.id) ?? 0,
      codigo: (item as { codigo?: string | null }).codigo ?? null,
      unitId: null as string | null,
      segment: null as "terceiros" | "lancamento" | "remanescente" | null,
      condominiumLinked: Boolean(item.condominio_id),
      alreadyRented: false,
      condominiumFee: item.condominio_valor,
    };
  });

  // Nota do captador = média das notas de qualidade dos anúncios que ele captou (sem inventar dado).
  const captadorAgg = new Map<number, { sum: number; count: number }>();
  (data ?? []).forEach((item, i) => {
    if (!catalog[i]) return;
    const captadores = new Set<number>();
    const productCaptor = (item as { captador_corretor_id?: number | null }).captador_corretor_id ?? null;
    if (productCaptor != null) captadores.add(productCaptor);
    for (const unit of (item.unidades ?? []) as UnitRow[]) if (unit.captador_corretor_id != null) captadores.add(unit.captador_corretor_id);
    for (const cid of captadores) {
      const acc = captadorAgg.get(cid) ?? { sum: 0, count: 0 };
      acc.sum += catalog[i].quality.score; acc.count += 1; captadorAgg.set(cid, acc);
    }
  });
  const captadorScoreById = new Map<number, number>();
  captadorAgg.forEach((v, k) => captadorScoreById.set(k, Math.round(v.sum / v.count)));
  catalog.forEach((p, i) => {
    const cid = (data ?? [])[i] ? (((data ?? [])[i] as { captador_corretor_id?: number | null }).captador_corretor_id ?? null) : null;
    p.capturedByScore = cid != null ? (captadorScoreById.get(cid) ?? null) : null;
  });

  // Visibilidade: corretor só enxerga aprovados + os que ele mesmo captou (pra acompanhar pendente/reprovado).
  // Admin/gestor enxergam tudo (inclusive a fila de pendentes).
  const visible = canApprove ? catalog : catalog.filter((p) => p.approval === "aprovado" || p.mine);
  const pendingCount = catalog.filter((p) => p.approval === "pendente" && !p.standalone).length;
  const qualitySummary = {
    excellent: visible.filter((p) => p.quality.level === "excelente").length,
    good: visible.filter((p) => p.quality.level === "bom").length,
    attention: visible.filter((p) => p.quality.level === "atencao").length,
    critical: visible.filter((p) => p.quality.level === "critico").length,
    readyForSite: visible.filter((p) => p.quality.readyForSite && !p.published).length,
    average: visible.length ? Math.round(visible.reduce((sum, p) => sum + p.quality.score, 0) / visible.length) : 0,
  };

  // Fila de UNIDADES de indicação pendentes (só para aprovadores).
  type PendingUnit = { id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null; approval: string; rejectionReason: string | null; codigo: string | null };
  let pendingUnits: PendingUnit[] = [];
  if (canApprove) {
    const { data: pu } = await supabase
      .from("unidades")
      .select("id, numero, tipologia, valor_tabela, valor_promo, empreendimento_id, captador_corretor_id, aprovacao, reprovacao_motivo, codigo, empreendimentos(nome)")
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
      proprietario: null,
      indicador: corretorNameById.get(u.captador_corretor_id ?? -1) ?? null,
      coverUrl: coverByUnit.get(u.id) ?? null,
      approval: u.aprovacao ?? "pendente",
      rejectionReason: u.reprovacao_motivo ?? null,
      codigo: u.codigo ?? null,
    }));
  }

  let myUnits: PendingUnit[] = [];
  if (currentBrokerId != null) {
    const { data: mineRows } = await supabase
      .from("unidades")
      .select("id, numero, tipologia, valor_tabela, valor_promo, empreendimento_id, captador_corretor_id, aprovacao, reprovacao_motivo, codigo, publicado, disponivel, empreendimentos(nome)")
      .eq("de_terceiros", true)
      .eq("captador_corretor_id", currentBrokerId)
      .order("codigo", { ascending: false });
    const mineIds = (mineRows ?? []).map((u) => u.id);
    const coverByMine = new Map<string, string | null>();
    if (mineIds.length) {
      const { data: mineMedia } = await supabase.from("midias").select("unidade_id, storage_path, is_capa, created_at").in("unidade_id", mineIds).eq("tipo", "foto").order("is_capa", { ascending: false }).order("created_at", { ascending: true });
      for (const m of mineMedia ?? []) { const uid = (m as { unidade_id?: string }).unidade_id; if (uid && !coverByMine.has(uid)) coverByMine.set(uid, publicMediaUrl((m as { storage_path: string }).storage_path)); }
    }
    const mineProductIds = [...new Set((mineRows ?? []).map((u) => u.empreendimento_id))];
    const { data: privateOwners } = mineProductIds.length
      ? await supabase.rpc("produto_unidades_proprietarios_ler", { p_empreendimento_ids: mineProductIds })
      : { data: [] };
    const privateOwnerByUnit = new Map((privateOwners ?? []).map((owner) => [owner.unidade_id, owner]));
    myUnits = (mineRows ?? []).map((u) => ({
      id: u.id, numero: u.numero, tipologia: u.tipologia,
      valor: u.valor_promo ?? u.valor_tabela ?? null,
      empreendimentoId: u.empreendimento_id,
      predio: ((u.empreendimentos as { nome?: string } | null)?.nome) ?? "—",
      proprietario: privateOwnerByUnit.get(u.id)?.proprietario_nome ?? null,
      indicador: corretorNameById.get(u.captador_corretor_id ?? -1) ?? null,
      coverUrl: coverByMine.get(u.id) ?? null,
      approval: u.aprovacao ?? "pendente",
      rejectionReason: u.reprovacao_motivo ?? null,
      codigo: u.codigo ?? null,
      published: u.publicado !== false,
      available: u.disponivel,
    }));
  }

  // Cada captação individual é um imóvel próprio, inclusive quando o prédio de
  // referência está em obras ou é lançamento. O estágio do empreendimento não
  // pode esconder a unidade comercial captada pelo corretor.
  const rowById = new Map((data ?? []).map((item) => [item.id, item]));
  const catalogFinal = visible.flatMap((p) => {
    const bruto = rowById.get(p.id);
    const ehPronto = /pronto/i.test(p.status ?? "");
    if (!bruto) return [p];
    const unidadesBrutas = ((bruto.unidades ?? []) as UnitRow[]).filter((u) =>
      (u.disponivel && (u.aprovacao ?? "aprovado") === "aprovado")
      || (currentBrokerId != null && u.captador_corretor_id === currentBrokerId)
    );
    const unidadesComerciais = ehPronto
      ? unidadesBrutas
      : unidadesBrutas.filter((u) => u.de_terceiros === true || u.publicado !== false);
    const hasOwnUnit = currentBrokerId != null && unidadesComerciais.some((unit) => unit.captador_corretor_id === currentBrokerId);
    if (p.standalone) {
      if ((!hasOwnUnit && (p.draft || p.approval !== "aprovado")) || !unidadesComerciais.length) return [];
    } else {
      if ((!hasOwnUnit && (p.draft || p.approval !== "aprovado")) || !unidadesComerciais.length) return [p];
    }
    const allProductMedia = (bruto.midias ?? []) as MediaRow[];
    const fotos = allProductMedia.filter((m) => m.tipo === "foto");
    const buildingMediaCount = allProductMedia.filter((m) => !m.unidade_id).length;
    const unitCards = unidadesComerciais.map((u) => {
      const fotoDaUnidade = fotos.find((m) => m.unidade_id === u.id && m.is_capa) ?? fotos.find((m) => m.unidade_id === u.id);
      const unitMediaCount = allProductMedia.filter((m) => m.unidade_id === u.id).length;
      const dormMatch = u.tipologia?.match(/(\d+)\s*(?:dorm|su[ií]te)/i);
      const dormUnidade = dormMatch ? Number(dormMatch[1]) : /studio/i.test(u.tipologia ?? "") ? 0 : null;
      return {
        ...p,
        unitId: u.id,
        codigo: u.codigo ?? p.codigo,
        name: p.standalone ? p.name : `${p.name} · Un. ${u.numero == null ? "s/n" : String(u.numero).replace(/\.0+$/, "")}`,
        price: (u.valor_promo ?? u.valor_tabela) ?? p.price,
        area: u.area_m2 ?? p.area,
        bedrooms: dormUnidade ?? p.bedrooms,
        parking: u.vagas ?? p.parking,
        available: u.disponivel ? 1 : 0,
        units: 1,
        media: unitMediaCount,
        unitMedia: unitMediaCount,
        referenceMedia: buildingMediaCount,
        coverUrl: fotoDaUnidade ? publicMediaUrl(fotoDaUnidade.storage_path) : null,
        capturedBy: corretorNameById.get(u.captador_corretor_id ?? -1) ?? null,
        capturedByScore: u.captador_corretor_id != null ? (captadorScoreById.get(u.captador_corretor_id) ?? null) : null,
        mine: currentBrokerId != null && u.captador_corretor_id === currentBrokerId,
        approval: u.aprovacao ?? "aprovado",
        rejectionReason: u.reprovacao_motivo ?? null,
        draft: false,
        segment: resolveCommercialOrigin({
          explicit: originByUnit.get(u.id) ?? null,
          thirdParty: u.de_terceiros,
          buildingStatus: p.status,
        }),
        condominiumLinked: Boolean(bruto.condominio_id),
        alreadyRented: u.compre_ja_alugado === true,
        condominiumFee: u.condominio_valor ?? bruto.condominio_valor,
        published: Boolean(p.published && u.publicado !== false && unitMediaCount > 0),
      };
    });
    return ehPronto || p.standalone ? unitCards : [p, ...unitCards];
  });

  const condominiums = ((condominiumRows ?? []) as CondominiumRow[]).map((condominium) => {
    const linkedProducts = (data ?? []).filter((product) => product.condominio_id === condominium.id);
    const linkedUnits = linkedProducts.flatMap((product) => (product.unidades ?? []) as UnitRow[]);
    const publishedUnits = linkedUnits.filter((unit) => unit.disponivel && (unit.aprovacao ?? "aprovado") === "aprovado" && unit.publicado !== false).length;
    const captures = linkedUnits.filter((unit) => unit.de_terceiros === true).length;
    const buildingPhotos = linkedProducts.flatMap((product) => ((product.midias ?? []) as MediaRow[]).filter((media) => !media.unidade_id && media.tipo === "foto"));
    const cover = buildingPhotos.find((media) => media.is_capa) ?? buildingPhotos[0];
    return {
      id: condominium.id,
      name: condominium.nome,
      zipCode: condominium.cep,
      address: condominium.endereco,
      number: condominium.numero,
      neighborhood: condominium.bairro,
      city: condominium.cidade,
      state: condominium.uf,
      linkedProducts: linkedProducts.length,
      units: linkedUnits.length,
      captures,
      publishedUnits,
      availableUnits: linkedUnits.filter((unit) => unit.disponivel).length,
      referenceProductId: linkedProducts[0]?.id ?? null,
      coverUrl: cover ? publicMediaUrl(cover.storage_path) : null,
    };
  });

  return Response.json({
    mode: "production-readonly",
    role,
    canApprove,
    pendingCount,
    qualitySummary,
    pendingUnits,
    myUnits,
    qualityQueue,
    buildingCount: visible.filter((product) => !product.standalone).length,
    count: catalogFinal.length,
    catalog: catalogFinal,
    condominiums: condominiums,
  });
}
