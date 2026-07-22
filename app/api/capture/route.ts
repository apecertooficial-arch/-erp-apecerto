import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

// Aprovar / reprovar empreendimento (admin/gestor). A RPC valida o papel.
export async function PATCH(request: Request) {
  const accessToken = bearer(request);
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  let body: { action?: string; id?: string; motivo?: string };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const action = String(body.action || "");
  const id = String(body.id || "");
  if ((action !== "approve" && action !== "reject") || !id) return Response.json({ error: "Ação ou empreendimento inválido." }, { status: 422 });
  const { data, error } = await supabase.rpc("aprovar_empreendimento", { p_id: id, p_aprovar: action === "approve", p_motivo: action === "reject" ? (body.motivo ?? null) : null });
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (error || result.ok === false) return Response.json({ error: error?.message || (typeof result.error === "string" ? result.error : "Não foi possível concluir a aprovação.") }, { status: error ? 502 : 403 });
  return Response.json({ ok: true, aprovacao: result.aprovacao });
}

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
    if (photos < 1) {
      return Response.json({ error: "Envie pelo menos 1 foto do imóvel." }, { status: 422 });
    }

    // Ao publicar (finalizar a captação), o empreendimento entra na fila de aprovação do gestor.
    // Se já estava aprovado (edição de algo publicado), mantém aprovado — não re-gateia edições.
    const { data: cur } = await supabase.from("empreendimentos").select("aprovacao").eq("id", payload.id).maybeSingle();
    const patch = (cur as { aprovacao?: string } | null)?.aprovacao === "aprovado"
      ? { rascunho: false }
      : { rascunho: false, aprovacao: "pendente", reprovacao_motivo: null };
    const { error } = await supabase.from("empreendimentos").update(patch).eq("id", payload.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, id: payload.id, aprovacao: (patch as { aprovacao?: string }).aprovacao ?? "aprovado" });
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
    // Anti-duplicata: reaproveita um condomínio com o mesmo nome + endereço + cidade (case-insensitive).
    // Evita a enxurrada de repetidos que acontecia quando um cadastro falhava e era refeito.
    const nomeN = condominium.name.trim();
    const endN = condominium.address.trim();
    const cidN = condominium.city.trim();
    const { data: existingCond } = await supabase.from("condominios").select("id").ilike("nome", nomeN).ilike("endereco", endN).ilike("cidade", cidN).limit(1).maybeSingle();
    if (existingCond?.id) {
      condominiumId = existingCond.id;
    } else {
      const { data, error } = await supabase.from("condominios").insert({
        nome: nomeN, cep: condominium.zipCode.trim() || null,
        endereco: endN, numero: condominium.number.trim() || null,
        complemento: condominium.complement.trim() || null, bairro: condominium.neighborhood.trim() || null,
        cidade: cidN, uf: condominium.state.trim() || "SP", created_by: authData.user.id,
      }).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      condominiumId = data.id;
    }
  }

  let ownerId = owner?.id ?? null;
  if (payload.propertyType === "terceiro" && owner && !ownerId) {
    // Anti-duplicata de proprietário por e-mail.
    const emailN = owner.email.trim().toLowerCase();
    const { data: existingOwner } = emailN ? await supabase.from("proprietarios").select("id").ilike("email", emailN).limit(1).maybeSingle() : { data: null };
    if (existingOwner?.id) {
      ownerId = existingOwner.id;
    } else {
      const { data, error } = await supabase.from("proprietarios").insert({
        nome: owner.name.trim(), email: emailN, telefone: owner.phone.trim(), created_by: authData.user.id,
      }).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      ownerId = data.id;
    }
  }

  const { data: broker } = await supabase.from("corretores").select("id").eq("usuario_id", authData.user.id).maybeSingle();
  const { data: development, error: developmentError } = await supabase.from("empreendimentos").insert({
    nome: property.name.trim(), titulo: property.name.trim(), incorporadora: property.developer.trim() || null,
    status: property.status, origem: payload.propertyType === "terceiro" ? "terceiros" : "predio",
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
