import { createServerSupabaseClient } from "../../lib/supabase/server";
import { assessProductQuality, isPlausibleProductPrice, normalizedKey, validateProductPrice } from "../../features/products/quality";
import { isProductManagerRole } from "../../features/products/access";

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
  if (action === "approve") {
    const { data: approver } = await supabase.from("usuarios").select("role").eq("id", authData.user.id).maybeSingle();
    if (!isProductManagerRole(approver?.role)) return Response.json({ error: "Apenas a gestão de Produtos pode aprovar imóveis." }, { status: 403 });
    const { data: product, error: productError } = await supabase
      .from("empreendimentos")
      .select("nome,titulo,slogan,descricao,finalidade,status,preco,area_util,dormitorios,banheiros,vagas,endereco,numero,bairro,cidade,uf,cep,condominio_valor,iptu,outros_custos,lazer,diferenciais,tour_url,unidades(area_m2,valor_tabela,valor_promo,disponivel,aprovacao),midias(tipo,categoria,is_capa,unidade_id)")
      .eq("id", id)
      .single();
    if (productError || !product) return Response.json({ error: productError?.message ?? "Produto não encontrado." }, { status: 404 });
    const units = (product.unidades ?? []).filter((unit) => (unit.aprovacao ?? "aprovado") === "aprovado");
    const available = units.filter((unit) => unit.disponivel);
    const prices = available.map((unit) => unit.valor_promo ?? unit.valor_tabela).filter((value): value is number => typeof value === "number" && value > 0);
    const areas = available.map((unit) => unit.area_m2).filter((value): value is number => typeof value === "number" && value > 0);
    const media = (product.midias ?? []).filter((item) => !item.unidade_id);
    if (/pronto/i.test(product.status ?? "") && available.length === 0) {
      return Response.json({ error: "Produto pronto precisa ter ao menos uma unidade aprovada e disponível para aparecer no site.", code: "READY_PRODUCT_WITHOUT_APPROVED_UNIT" }, { status: 422 });
    }
    const quality = assessProductQuality({
      name: product.nome, title: product.titulo, slogan: product.slogan, description: product.descricao, purpose: product.finalidade,
      price: product.preco ?? (prices.length ? Math.min(...prices) : null), area: product.area_util ?? (areas.length ? Math.min(...areas) : null),
      bedrooms: product.dormitorios, bathrooms: product.banheiros, parking: product.vagas,
      address: product.endereco, number: product.numero, neighborhood: product.bairro, city: product.cidade, state: product.uf, zip: product.cep,
      condominiumFee: product.condominio_valor, propertyTax: product.iptu, otherCosts: product.outros_custos,
      photos: media.filter((item) => item.tipo === "foto").length, videos: media.filter((item) => item.tipo === "video").length,
      hasCover: media.some((item) => item.tipo === "foto" && item.is_capa),
      mediaCategories: media.filter((item) => item.tipo === "foto").map((item) => item.categoria ?? ""), tourUrl: product.tour_url,
      units: units.length, availableUnits: available.length,
      unitsWithValidPrice: prices.filter((value) => isPlausibleProductPrice(value, product.finalidade)).length,
      amenities: product.lazer, differentiators: product.diferenciais,
    });
    if (!quality.readyForSite) {
      return Response.json({ error: "O imóvel precisa ser completado antes da aprovação.", code: "PRODUCT_NOT_READY", quality, blocking: quality.blocking }, { status: 422 });
    }
  }
  const { data, error } = await supabase.rpc("aprovar_empreendimento", { p_id: id, p_aprovar: action === "approve", p_motivo: action === "reject" ? (body.motivo || undefined) : undefined });
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (error || result.ok === false) {
    const raw = error?.message || (typeof result.error === "string" ? result.error : "Não foi possível concluir a aprovação.");
    const match = raw.match(/^([A-Z][A-Z0-9_]+):\s*([\s\S]+)$/);
    const code = match?.[1] ?? (error?.code === "P0001" ? "PUBLICATION_RULE" : "PUBLICATION_FAILED");
    const status = code.endsWith("FORBIDDEN") || error?.code === "42501"
      ? 403
      : code.endsWith("NOT_FOUND")
        ? 404
        : error?.code === "P0001" || code.endsWith("NOT_READY")
          ? 422
          : error ? 502 : 403;
    return Response.json({ error: match?.[2] ?? raw, code }, { status });
  }
  if (action === "approve" && result.site_visivel !== true) {
    return Response.json({ error: "A aprovação foi processada, mas o imóvel ainda não ficou visível no site.", code: "SITE_PUBLICATION_NOT_CONFIRMED", publication: result }, { status: 502 });
  }
  return Response.json({ ok: true, aprovacao: result.aprovacao, publicado: result.publicado, site_visivel: result.site_visivel, publication: result });
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
  semCondominio?: boolean;
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
    title?: string;
    slogan?: string;
    description?: string;
    purpose?: string;
    amenities?: string[];
    differentiators?: string[];
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

  // Toda captação precisa nascer com um corretor responsável. Sem este vínculo,
  // a unidade some de "Minhas captações" e o corretor perde a edição operacional.
  // Resolver antes de criar condomínio/proprietário também evita registros órfãos
  // quando um usuário ainda não foi cadastrado na tabela de corretores.
  const { data: broker, error: brokerError } = await supabase
    .from("corretores")
    .select("id")
    .eq("usuario_id", authData.user.id)
    .maybeSingle();
  if (brokerError) return Response.json({ error: brokerError.message }, { status: 502 });

  let payload: CapturePayload | { action: "finalize"; id: string };
  try {
    payload = await request.json() as CapturePayload | { action: "finalize"; id: string };
  } catch {
    return Response.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }

  if (payload.action === "finalize") {
    if (!broker?.id) {
      return Response.json({ error: "Seu usuário ainda não está vinculado a um corretor. Peça à gestão para corrigir o cadastro antes de publicar uma captação." }, { status: 422 });
    }
    const { data: capture, error: captureError } = await supabase
      .from("empreendimentos")
      .select("aprovacao,rascunho,captado_por_usuario,captador_corretor_id")
      .eq("id", payload.id)
      .maybeSingle();
    if (captureError) return Response.json({ error: captureError.message }, { status: 502 });
    if (!capture) return Response.json({ error: "Captação não encontrada." }, { status: 404 });
    if ((capture.captado_por_usuario && capture.captado_por_usuario !== authData.user.id)
      || (capture.captador_corretor_id && capture.captador_corretor_id !== broker.id)) {
      return Response.json({ error: "Esta captação pertence a outro corretor e não pode ser reassociada ao finalizar." }, { status: 403 });
    }

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
    const patch = capture.aprovacao === "aprovado"
      ? { rascunho: false, captado_por_usuario: authData.user.id, captador_corretor_id: broker.id }
      : { rascunho: false, aprovacao: "pendente", reprovacao_motivo: null, captado_por_usuario: authData.user.id, captador_corretor_id: broker.id };
    const { error } = await supabase.from("empreendimentos").update(patch).eq("id", payload.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    // Repara somente unidades ainda sem responsável dentro da captação que este
    // usuário acabou de finalizar; um vínculo existente nunca é sobrescrito.
    const { error: unitCaptorError } = await supabase
      .from("unidades")
      .update({ captador_corretor_id: broker.id })
      .eq("empreendimento_id", payload.id)
      .is("captador_corretor_id", null);
    if (unitCaptorError) return Response.json({ error: unitCaptorError.message }, { status: 502 });
    return Response.json({ ok: true, id: payload.id, aprovacao: (patch as { aprovacao?: string }).aprovacao ?? "aprovado" });
  }

  const { property, condominium, owner, access, units } = payload;
  if (payload.propertyType === "terceiro" && !broker?.id) {
    return Response.json({ error: "Seu usuário ainda não está vinculado a um corretor. Peça à gestão para corrigir o cadastro antes de publicar uma captação." }, { status: 422 });
  }
  const semCondominio = payload.semCondominio === true;
  if (!property.name.trim() || (!semCondominio && !condominium.name.trim()) || !condominium.address.trim() || !condominium.city.trim()) {
    return Response.json({ error: semCondominio ? "Nome do produto e endereço completo são obrigatórios." : "Nome do produto, condomínio e endereço completo são obrigatórios." }, { status: 422 });
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
  const propertyPriceCheck = validateProductPrice(property.price, "Preço do imóvel", property.purpose);
  if (propertyPriceCheck.error) return Response.json({ error: propertyPriceCheck.error }, { status: 422 });
  // Somente condomínio/estoque de construtora possui unidades informadas pelo
  // formulário. Para imóvel avulso, a unidade é derivada de `property` abaixo.
  // Ignorar qualquer linha vazia legada impede que um preço correto do imóvel
  // seja rejeitado como "Preço da unidade sem número muito baixo".
  if (payload.propertyType === "construtora") {
    if (!units.length || units.some((unit) => !unit.number.trim() || !unit.type.trim() || !isNonNegative(unit.area) || !isNonNegative(unit.price))) {
      return Response.json({ error: "Adicione ao menos uma unidade completa ao empreendimento." }, { status: 422 });
    }
    for (const unit of units) {
      const tablePriceCheck = validateProductPrice(unit.price, `Preço da unidade ${unit.number || "sem número"}`, property.purpose);
      if (tablePriceCheck.error) return Response.json({ error: tablePriceCheck.error }, { status: 422 });
      if (unit.promotionalPrice != null) {
        const promoPriceCheck = validateProductPrice(unit.promotionalPrice, `Preço promocional da unidade ${unit.number || "sem número"}`, property.purpose);
        if (promoPriceCheck.error) return Response.json({ error: promoPriceCheck.error }, { status: 422 });
      }
    }
  }

  // Evita imóveis repetidos antes de criar qualquer registro auxiliar.
  const { data: possibleDuplicates } = await supabase
    .from("empreendimentos")
    .select("id,nome,endereco,numero,bairro,cidade")
    .ilike("cidade", condominium.city.trim())
    .limit(80);
  const duplicate = (possibleDuplicates ?? []).find((item) => {
    const sameName = normalizedKey(item.nome) === normalizedKey(property.name);
    const sameAddress = normalizedKey(item.endereco) === normalizedKey(condominium.address)
      && normalizedKey(item.numero) === normalizedKey(condominium.number);
    const sameNeighborhood = normalizedKey(item.bairro) === normalizedKey(condominium.neighborhood);
    return (sameName && sameNeighborhood) || sameAddress;
  });
  if (duplicate) {
    return Response.json({
      error: `Já existe um produto semelhante: ${duplicate.nome}. Abra o cadastro existente em vez de criar outro.`,
      code: "DUPLICATE_PRODUCT",
      existingProductId: duplicate.id,
      existingName: duplicate.nome,
    }, { status: 409 });
  }

  let condominiumId = condominium.id;
  if (semCondominio) condominiumId = null;
  if (!condominiumId && !semCondominio) {
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

  const { data: development, error: developmentError } = await supabase.from("empreendimentos").insert({
    nome: property.name.trim(), titulo: property.title?.trim() || property.name.trim(), slogan: property.slogan?.trim() || null,
    descricao: property.description?.trim() || null, finalidade: property.purpose?.trim() || null,
    lazer: property.amenities?.map((item) => item.trim()).filter(Boolean) || [],
    diferenciais: property.differentiators?.map((item) => item.trim()).filter(Boolean) || [],
    incorporadora: property.developer.trim() || null,
    status: property.status, origem: payload.propertyType === "terceiro" ? "terceiros" : "predio",
    condominio_id: condominiumId || null, proprietario_id: ownerId,
    cep: condominium.zipCode.trim() || null, endereco: condominium.address.trim(), numero: condominium.number.trim() || null,
    complemento: condominium.complement.trim() || null, bairro: condominium.neighborhood.trim() || null,
    cidade: condominium.city.trim(), uf: condominium.state.trim() || "SP",
    preco: propertyPriceCheck.value, condominio_valor: property.condominiumFee, iptu: property.propertyTax, outros_custos: property.otherCosts,
    area_util: property.area, dormitorios: property.bedrooms, suites: property.suites, banheiros: property.bathrooms, vagas: property.parking,
    proprietario_nome: owner?.name.trim() || null, proprietario_tel: owner?.phone.trim() || null, proprietario_email: owner?.email.trim().toLowerCase() || null,
    acesso_tipo: access.type, acesso_codigo: access.type === "chave_digital" ? access.code.trim() : null,
    acesso_instrucoes: access.instructions.trim(), captado_por_usuario: authData.user.id,
    captador_corretor_id: broker?.id ?? null, captacao_habilitada: true, rascunho: true, publicado: false,
  }).select("id").single();
  if (developmentError) return Response.json({ error: developmentError.message }, { status: 400 });

  const unitRows = payload.propertyType === "construtora" ? units : [{
    number: semCondominio ? "Imóvel único" : condominium.number || "Única", type: `${property.bedrooms} dorm.`, area: property.area,
    parking: property.parking, price: property.price, promotionalPrice: null,
  }];
  const { data: createdUnits, error: unitsError } = await supabase.from("unidades").insert(unitRows.map((unit) => ({
    empreendimento_id: development.id, numero: unit.number.trim(), area_m2: unit.area,
    tipologia: unit.type.trim(), vagas: unit.parking, valor_tabela: unit.price,
    valor_promo: unit.promotionalPrice, valor_m2: unit.area > 0 ? (unit.promotionalPrice ?? unit.price) / unit.area : null,
    disponivel: true, de_terceiros: payload.propertyType === "terceiro", captador_corretor_id: broker?.id ?? null,
    aprovacao: payload.propertyType === "terceiro" ? "pendente" : "aprovado",
    proprietario_nome: owner?.name.trim() || null, proprietario_contato: owner?.phone.trim() || null,
    acesso_tipo: access.type, acesso_codigo: access.type === "chave_digital" ? access.code.trim() : null,
    acesso_instrucoes: access.instructions.trim(),
  }))).select("id");
  if (unitsError) return Response.json({ error: `Produto salvo como rascunho, mas as unidades falharam: ${unitsError.message}` }, { status: 400 });

  return Response.json({ ok: true, id: development.id, unidadeId: payload.propertyType === "terceiro" ? createdUnits?.[0]?.id ?? null : null, userId: authData.user.id, draft: true });
}
