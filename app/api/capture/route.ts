import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type UnitInput = {
  number: string;
  type: string;
  area: number;
  parking: number;
  price: number;
  promotionalPrice: number | null;
};

type CapturePayload = {
  action: "create";
  propertyType: "terceiro" | "construtora";
  condominium: {
    id: string | null;
    name: string;
    zipCode: string;
    address: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  owner: { id: string | null; name: string; email: string; phone: string } | null;
  property: {
    name: string;
    developer: string;
    status: "pronto" | "em_obras" | "lancamento";
    price: number;
    condominiumFee: number;
    propertyTax: number;
    otherCosts: number;
    area: number;
    bedrooms: number;
    suites: number;
    bathrooms: number;
    parking: number;
  };
  access: { type: "chave_fisica" | "chave_digital" | "proprietario" | "portaria" | "outro"; code: string; instructions: string };
  units: UnitInput[];
};

function tokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function isNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

export async function POST(request: Request) {
  const accessToken = tokenFrom(request);
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  let payload: CapturePayload | { action: "finalize"; id: string };
  try {
    payload = await request.json() as CapturePayload | { action: "finalize"; id: string };
  } catch {
    return Response.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }

  if (payload.action === "finalize") {
    const { data: media, error: mediaError } = await supabase
      .from("midias")
      .select("tipo,is_capa")
      .eq("empreendimento_id", payload.id);
    if (mediaError) return Response.json({ error: mediaError.message }, { status: 400 });

    const photos = media.filter((item) => item.tipo === "foto").length;
    const videos = media.filter((item) => item.tipo === "video").length;
    const covers = media.filter((item) => item.tipo === "foto" && item.is_capa).length;
    if (photos < 10 || videos < 1 || covers !== 1) {
      return Response.json({ error: "A captação exige 10 fotos, 1 vídeo e exatamente 1 foto de capa." }, { status: 422 });
    }

    const { error } = await supabase.from("empreendimentos").update({ rascunho: false }).eq("id", payload.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, id: payload.id });
  }

  const { property, condominium, owner, access, units } = payload;
  if (!property.name.trim() || !condominium.name.trim() || !condominium.address.trim() || !condominium.city.trim()) {
    return Response.json({ error: "Nome do produto, condomínio e endereço completo são obrigatórios." }, { status: 422 });
  }
  if (payload.propertyType === "terceiro" && (!owner || !owner.name.trim() || !owner.email.trim() || !owner.phone.trim())) {
    return Response.json({ error: "O proprietário com nome, telefone e e-mail é obrigatório." }, { status: 422 });
  }
  if (access.type === "chave_digital" && !access.code.trim()) {
    return Response.json({ error: "Informe o código da chave digital." }, { status: 422 });
  }
  if (!access.instructions.trim()) {
    return Response.json({ error: "As instruções completas de acesso são obrigatórias." }, { status: 422 });
  }
  const numericValues = [property.price, property.condominiumFee, property.propertyTax, property.otherCosts, property.area, property.bedrooms, property.suites, property.bathrooms, property.parking];
  if (!numericValues.every(isNonNegative)) return Response.json({ error: "Revise os valores numéricos do imóvel." }, { status: 422 });
  if (payload.propertyType === "construtora" && (!units.length || units.some((unit) => !unit.number.trim() || !unit.type.trim() || !isNonNegative(unit.area) || !isNonNegative(unit.price)))) {
    return Response.json({ error: "Adicione ao menos uma unidade completa ao empreendimento." }, { status: 422 });
  }

  let condominiumId = condominium.id;
  if (!condominiumId) {
    const { data, error } = await supabase.from("condominios").insert({
      nome: condominium.name.trim(), cep: condominium.zipCode.trim() || null,
      endereco: condominium.address.trim(), numero: condominium.number.trim() || null,
      complemento: condominium.complement.trim() || null, bairro: condominium.neighborhood.trim() || null,
      cidade: condominium.city.trim(), uf: condominium.state.trim() || "SP", created_by: authData.user.id,
    }).select("id").single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    condominiumId = data.id;
  }

  let ownerId = owner?.id ?? null;
  if (payload.propertyType === "terceiro" && owner && !ownerId) {
    const { data, error } = await supabase.from("proprietarios").insert({
      nome: owner.name.trim(), email: owner.email.trim().toLowerCase(), telefone: owner.phone.trim(), created_by: authData.user.id,
    }).select("id").single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    ownerId = data.id;
  }

  const { data: broker } = await supabase.from("corretores").select("id").eq("usuario_id", authData.user.id).maybeSingle();
  const { data: development, error: developmentError } = await supabase.from("empreendimentos").insert({
    nome: property.name.trim(), titulo: property.name.trim(), incorporadora: property.developer.trim() || null,
    status: property.status, origem: payload.propertyType === "terceiro" ? "terceiro" : "construtora",
    condominio_id: condominiumId, proprietario_id: ownerId,
    cep: condominium.zipCode.trim() || null, endereco: condominium.address.trim(), numero: condominium.number.trim() || null,
    complemento: condominium.complement.trim() || null, bairro: condominium.neighborhood.trim() || null,
    cidade: condominium.city.trim(), uf: condominium.state.trim() || "SP",
    preco: property.price, condominio_valor: property.condominiumFee, iptu: property.propertyTax, outros_custos: property.otherCosts,
    area_util: property.area, dormitorios: property.bedrooms, suites: property.suites, banheiros: property.bathrooms, vagas: property.parking,
    proprietario_nome: owner?.name.trim() || null, proprietario_tel: owner?.phone.trim() || null, proprietario_email: owner?.email.trim().toLowerCase() || null,
    acesso_tipo: access.type, acesso_codigo: access.type === "chave_digital" ? access.code.trim() : null,
    acesso_instrucoes: access.instructions.trim(), captado_por_usuario: authData.user.id,
    captador_corretor_id: broker?.id ?? null, captacao_habilitada: true, rascunho: true, publicado: false,
  }).select("id").single();
  if (developmentError) return Response.json({ error: developmentError.message }, { status: 400 });

  const unitRows = payload.propertyType === "construtora" ? units : [{
    number: condominium.number || "Única", type: `${property.bedrooms} dorm.`, area: property.area,
    parking: property.parking, price: property.price, promotionalPrice: null,
  }];
  const { error: unitsError } = await supabase.from("unidades").insert(unitRows.map((unit) => ({
    empreendimento_id: development.id, numero: unit.number.trim(), area_m2: unit.area,
    tipologia: unit.type.trim(), vagas: unit.parking, valor_tabela: unit.price,
    valor_promo: unit.promotionalPrice, valor_m2: unit.area > 0 ? (unit.promotionalPrice ?? unit.price) / unit.area : null,
    disponivel: true, de_terceiros: payload.propertyType === "terceiro", captador_corretor_id: broker?.id ?? null,
    proprietario_nome: owner?.name.trim() || null, proprietario_contato: owner?.phone.trim() || null,
  })));
  if (unitsError) return Response.json({ error: `Produto salvo como rascunho, mas as unidades falharam: ${unitsError.message}` }, { status: 400 });

  return Response.json({ ok: true, id: development.id, userId: authData.user.id, draft: true });
}
