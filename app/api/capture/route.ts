import { createServerSupabaseClient } from "../../lib/supabase/server";
import { assessProductQuality, isPlausibleProductPrice, validateProductPrice } from "../../features/products/quality";
import { isProductManagerRole } from "../../features/products/access";
import type { Json } from "../../lib/supabase/database.types";

export const dynamic = "force-dynamic";

type CaptureDbError = { code?: string; message?: string } | null | undefined;

function captureErrorCode(error: CaptureDbError) {
  return typeof error?.code === "string" && error.code ? error.code : "unknown";
}

function falhaCaptacao(error: CaptureDbError, operacao: string, status = 502) {
  console.error("captacao_operacao_falhou", { operacao, codigo: captureErrorCode(error) });
  return Response.json({
    error: "Não foi possível concluir esta etapa da captação. Tente novamente.",
    code: "CAPTURE_UNAVAILABLE",
  }, { status });
}

const PUBLICATION_RULES: Record<string, { status: number; message: string }> = {
  PRODUCT_NOT_READY: { status: 422, message: "O imóvel precisa ser completado antes da aprovação." },
  READY_PRODUCT_WITHOUT_APPROVED_UNIT: { status: 422, message: "Produto pronto precisa ter ao menos uma unidade aprovada e disponível para aparecer no site." },
  PRODUCT_PUBLICATION_FORBIDDEN: { status: 403, message: "Apenas a gestão de Produtos pode aprovar imóveis." },
  PRODUCT_APPROVAL_FORBIDDEN: { status: 403, message: "Apenas a gestão de Produtos pode aprovar imóveis." },
  PRODUCT_NOT_FOUND: { status: 404, message: "Produto não encontrado." },
  SITE_PUBLICATION_NOT_CONFIRMED: { status: 502, message: "A aprovação foi processada, mas a publicação no site precisa ser reconciliada." },
};

const CAPTURE_RULES: Record<string, { status: number; message: string }> = {
  CAPTURE_FORBIDDEN: { status: 403, message: "Você não tem permissão para alterar esta captação." },
  CAPTURE_CAPTOR_REQUIRED: { status: 422, message: "Seu usuário ainda não está vinculado a um corretor. Peça à gestão para corrigir o cadastro." },
  CAPTURE_OWNER_REQUIRED: { status: 422, message: "Informe e confirme o proprietário antes de continuar." },
  CAPTURE_PHOTO_REQUIRED: { status: 422, message: "Envie pelo menos 1 foto do imóvel." },
  CAPTURE_DUPLICATE: { status: 409, message: "Já existe um imóvel semelhante. Abra o cadastro existente em vez de criar outro." },
  CAPTURE_NOT_FOUND: { status: 404, message: "Captação não encontrada." },
  CAPTURE_INVALID: { status: 422, message: "Revise os dados obrigatórios da captação." },
  CAPTURE_CONFLICT: { status: 409, message: "A captação mudou enquanto era salva. Recarregue antes de tentar novamente." },
};

function falhaRegraCaptacao(error: CaptureDbError, operacao: string) {
  const code = error?.message?.match(/(?:^|\b)(CAPTURE_[A-Z_]+)(?::|\b)/)?.[1];
  const rule = code ? CAPTURE_RULES[code] : null;
  if (rule) return Response.json({ error: rule.message, code }, { status: rule.status });
  return falhaCaptacao(error, operacao);
}

function publicationRuleCode(error: CaptureDbError, result: Record<string, unknown>) {
  if (error?.code === "42501") return "PRODUCT_PUBLICATION_FORBIDDEN";
  const raw = typeof result.error === "string" ? result.error : error?.message;
  const candidate = raw?.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1];
  return candidate && PUBLICATION_RULES[candidate] ? candidate : null;
}

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
  if (authError) return falhaCaptacao(authError, "autenticar");
  if (!authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  let body: { action?: string; id?: string; motivo?: string };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  const action = String(body.action || "");
  const id = String(body.id || "");
  if ((action !== "approve" && action !== "reject") || !id) return Response.json({ error: "Ação ou empreendimento inválido." }, { status: 422 });
  if (action === "approve") {
    const { data: approver, error: approverError } = await supabase.from("usuarios").select("role").eq("id", authData.user.id).maybeSingle();
    if (approverError) return falhaCaptacao(approverError, "carregar_papel_aprovador");
    if (!isProductManagerRole(approver?.role)) return Response.json({ error: "Apenas a gestão de Produtos pode aprovar imóveis." }, { status: 403 });
    const { data: product, error: productError } = await supabase
      .from("empreendimentos")
      .select("nome,titulo,slogan,descricao,finalidade,status,preco,area_util,dormitorios,banheiros,vagas,endereco,numero,bairro,cidade,uf,cep,condominio_valor,iptu,outros_custos,lazer,diferenciais,tour_url,unidades(area_m2,valor_tabela,valor_promo,disponivel,aprovacao),midias(tipo,categoria,is_capa,unidade_id)")
      .eq("id", id)
      .single();
    if (productError) return falhaCaptacao(productError, "carregar_produto_aprovacao");
    if (!product) return Response.json({ error: "Produto não encontrado.", code: "PRODUCT_NOT_FOUND" }, { status: 404 });
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
    const code = publicationRuleCode(error, result);
    if (code) {
      const rule = PUBLICATION_RULES[code];
      return Response.json({ error: rule.message, code }, { status: rule.status });
    }
    if (!error && result.ok === false) {
      return Response.json({ error: "A aprovação foi recusada pelas regras do produto.", code: "PUBLICATION_RULE" }, { status: 422 });
    }
    return falhaCaptacao(error, "aprovar_empreendimento");
  }
  if (action === "approve" && result.site_visivel !== true) {
    return Response.json({ error: PUBLICATION_RULES.SITE_PUBLICATION_NOT_CONFIRMED.message, code: "SITE_PUBLICATION_NOT_CONFIRMED" }, { status: 502 });
  }
  return Response.json({ ok: true, aprovacao: result.aprovacao, publicado: result.publicado, site_visivel: result.site_visivel });
}

type UnitInput = {
  number: string;
  type: string;
  area: number;
  parking: number;
  price: number;
  promotionalPrice: number | null;
  alreadyRented?: boolean;
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
    alreadyRented?: boolean;
  };
  access: { type: "chave_fisica" | "chave_digital" | "proprietario" | "portaria" | "outro"; code: string; instructions: string };
  units: UnitInput[];
};

function tokenFrom(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function GET(request: Request) {
  const accessToken = tokenFrom(request);
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });
  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError) return falhaCaptacao(authError, "autenticar_rascunho");
  if (!authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const { data: activeProfile, error: profileError } = await supabase.from("usuarios").select("ativo").eq("id", authData.user.id).maybeSingle();
  if (profileError) return falhaCaptacao(profileError, "carregar_perfil_rascunho");
  if (activeProfile?.ativo !== true) return Response.json({ error: "Usuário inativo ou sem perfil operacional." }, { status: 403 });
  const { data, error } = await supabase.rpc("produto_cadastro_rascunho_ler");
  if (error) return falhaCaptacao(error, "carregar_rascunho");
  return Response.json({ draft: data ?? {} });
}

function isNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

export async function POST(request: Request) {
  const accessToken = tokenFrom(request);
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError) return falhaCaptacao(authError, "autenticar");
  if (!authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const { data: activeProfile, error: profileError } = await supabase.from("usuarios").select("ativo").eq("id", authData.user.id).maybeSingle();
  if (profileError) return falhaCaptacao(profileError, "carregar_perfil");
  if (activeProfile?.ativo !== true) return Response.json({ error: "Usuário inativo ou sem perfil operacional." }, { status: 403 });

  let payload: CapturePayload
    | { action: "finalize"; id: string }
    | { action: "saveDraft"; payload: Json; step: number; expectedVersion?: number | null }
    | { action: "deleteDraft" };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return Response.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }

  if (payload.action === "saveDraft") {
    if (!payload.payload || typeof payload.payload !== "object" || Array.isArray(payload.payload)) {
      return Response.json({ error: "Rascunho inválido." }, { status: 422 });
    }
    if (!Number.isFinite(payload.step) || (payload.expectedVersion != null && (!Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 1))) {
      return Response.json({ error: "Versão ou etapa do rascunho inválida." }, { status: 422 });
    }
    const { data, error } = await supabase.rpc("produto_cadastro_rascunho_salvar", {
      p_payload: payload.payload,
      p_etapa: Math.max(0, Math.min(6, Math.trunc(payload.step))),
      p_versao_esperada: payload.expectedVersion ?? null,
    });
    if (error) {
      const conflict = error.code === "40001" || error.message?.includes("DRAFT_CONFLICT");
      if (conflict) return Response.json({ error: "Este rascunho foi alterado em outra aba. Feche e reabra o cadastro para não perder trabalho.", code: "DRAFT_CONFLICT" }, { status: 409 });
      return falhaCaptacao(error, "salvar_rascunho");
    }
    return Response.json(data ?? { ok: true });
  }

  if (payload.action === "deleteDraft") {
    const { error } = await supabase.rpc("produto_cadastro_rascunho_excluir");
    if (error) return falhaCaptacao(error, "excluir_rascunho");
    return Response.json({ ok: true });
  }

  // Toda captação finalizada precisa nascer com um corretor responsável. A
  // consulta fica depois das ações de rascunho, que pertencem ao usuário e não
  // dependem do vínculo operacional do corretor.
  const { data: broker, error: brokerError } = await supabase
    .from("corretores")
    .select("id")
    .eq("usuario_id", authData.user.id)
    .maybeSingle();
  if (brokerError) return falhaCaptacao(brokerError, "carregar_corretor");

  if (payload.action === "finalize") {
    if (!payload.id) return Response.json({ error: "Captação inválida." }, { status: 422 });
    const { data, error } = await supabase.rpc("produto_captacao_finalizar_atomica", { p_empreendimento_id: payload.id });
    if (error) return falhaRegraCaptacao(error, "finalizar_captacao_atomica");
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    if (result?.ok !== true || result.id !== payload.id) return falhaCaptacao(undefined, "confirmar_finalizacao_atomica");
    return Response.json(result);
  }

  if (payload.action !== "create") return Response.json({ error: "Ação de captação inválida." }, { status: 422 });

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

  const { data, error } = await supabase.rpc("produto_captacao_criar_atomica", { p_payload: payload });
  if (error) return falhaRegraCaptacao(error, "criar_captacao_atomica");
  const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  if (result?.ok !== true || typeof result.id !== "string") return falhaCaptacao(undefined, "confirmar_criacao_atomica");
  return Response.json(result);
}
