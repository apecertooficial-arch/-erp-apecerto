import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { Database } from "../../lib/supabase/database.types";
import { resolveEffectiveAccess, denyIfCannot } from "../../lib/supabase/authz";
import {
  assessProductQuality,
  isPlausibleProductPrice,
  validateProductPrice,
  validateProductPricePerSquareMeter,
} from "../../features/products/quality";
import { isProductManagerRole } from "../../features/products/access";
import { isProductPublishedOnSite } from "../../features/products/publication";
import { canViewUnitOwner } from "../../features/products/product-domain";
import { lerComandoJson } from "../../lib/http/read-json-command.mjs";

export const dynamic = "force-dynamic";

type ProductUpdate = Database["public"]["Tables"]["empreendimentos"]["Update"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_COMMAND_MAX_BYTES = 512 * 1024;
const PHOTO_AI_MAX_SUGGESTIONS = 20;
const PHOTO_AI_MAX_RESTORE_ITEMS = 500;
const PUBLICATION_RULE_CODES = new Set([
  "PRODUCT_NOT_READY",
  "UNIT_NOT_READY",
  "PRODUCT_PUBLICATION_INVALID",
  "UNIT_PRICE_INVALID",
  "UNIT_PROMO_PRICE_INVALID",
  "UNIT_PROMO_ABOVE_LIST",
  "UNIT_PRICE_REQUIRED",
  "UNIT_OWN_PHOTO_REQUIRED",
  "MEDIA_ORDER_INVALID",
  "CAPTURE_DECISION_INVALID",
  "CAPTURE_DECISION_REASON_REQUIRED",
  "INVALID_PRODUCT",
  "INVALID_UNIT",
  "INVALID_PRICE",
]);
const PUBLICATION_MESSAGES: Record<string, string> = {
  PRODUCT_NOT_READY: "Este imóvel ainda não atingiu o padrão para publicação.",
  UNIT_NOT_READY: "Esta unidade ainda não atingiu o padrão para publicação.",
  PRODUCT_PUBLICATION_INVALID: "O estado de publicação do imóvel é inválido.",
  UNIT_PRICE_INVALID: "O preço da unidade é inválido.",
  UNIT_PROMO_PRICE_INVALID: "O preço promocional da unidade é inválido.",
  UNIT_PROMO_ABOVE_LIST: "O preço promocional não pode superar o preço de tabela.",
  INVALID_PRODUCT: "Produto inválido.",
  INVALID_UNIT: "Unidade inválida.",
  INVALID_PRICE: "Preço inválido.",
  PRODUCT_HAS_LINKS: "O produto possui vínculos comerciais e não pode ser excluído.",
  UNIT_HAS_LINKS: "A unidade possui vínculos comerciais e não pode ser excluída.",
  PRODUCT_DELETE_RACE: "O produto mudou durante a exclusão. Atualize a ficha e tente novamente.",
  UNIT_DELETE_RACE: "A unidade mudou durante a exclusão. Atualize a ficha e tente novamente.",
  PRODUCT_NOT_FOUND: "Produto não encontrado.",
  PRODUCT_PARENT_NOT_FOUND: "O empreendimento de referência não foi encontrado.",
  UNIT_NOT_FOUND: "Unidade não encontrada.",
  MEDIA_NOT_FOUND: "Mídia não encontrada.",
  PRODUCT_FORBIDDEN: "Você não tem permissão para alterar este produto.",
  PRODUCT_PUBLICATION_FORBIDDEN: "Apenas a gestão de Produtos pode publicar ou retirar imóveis do site.",
  PRODUCT_DELETE_FORBIDDEN: "Apenas a gestão de Produtos pode excluir imóveis.",
  UNIT_FORBIDDEN: "Você não tem permissão para alterar esta unidade.",
  UNIT_AVAILABILITY_FORBIDDEN: "Você não tem permissão para alterar a disponibilidade desta unidade.",
  UNIT_DELETE_FORBIDDEN: "Você não tem permissão para excluir esta unidade.",
  UNIT_PRICE_REQUIRED: "Informe o valor total da unidade.",
  UNIT_OWN_PHOTO_REQUIRED: "Adicione ao menos uma foto própria da unidade antes de publicar.",
  MEDIA_COVER_FORBIDDEN: "Você não tem permissão para alterar a capa desta mídia.",
  MEDIA_COVER_NOT_FOUND: "A mídia escolhida para capa não foi encontrada.",
  MEDIA_ORDER_FORBIDDEN: "Você não tem permissão para ordenar esta galeria.",
  MEDIA_ORDER_INVALID: "A ordem enviada não corresponde à galeria atual.",
  MEDIA_ORDER_NOT_FOUND: "Uma das mídias da galeria não foi encontrada.",
  CAPTURE_DECISION_INVALID: "A decisão da captação é inválida.",
  CAPTURE_DECISION_REASON_REQUIRED: "Informe o motivo da reprovação.",
  CAPTURE_DECISION_FORBIDDEN: "Apenas a gestão de Produtos pode decidir captações.",
  CAPTURE_DECISION_NOT_FOUND: "Captação não encontrada.",
  CAPTURE_DECISION_CONFLICT: "A captação já recebeu outra decisão. Atualize a tela antes de continuar.",
  CAPTURE_DECISION_AUDIT_MISSING: "A decisão não possui o registro de auditoria esperado.",
  CAPTURE_DECISION_NOT_CONFIRMED: "A decisão não foi confirmada pelo banco.",
};

function publicationErrorResponse(error: { code?: string; message?: string }) {
  const raw = error.message?.trim() ?? "";
  const match = raw.match(/^([A-Z][A-Z0-9_]+):/);
  const businessCode = match?.[1] ?? (error.code === "P0001" ? "PUBLICATION_RULE" : "PUBLICATION_FAILED");
  const normalized = raw.toLowerCase();
  const status = businessCode.endsWith("FORBIDDEN") || error.code === "42501" || normalized.includes("sem permissão") || normalized.includes("nao autorizado")
    ? 403
    : businessCode.endsWith("NOT_FOUND") || normalized.includes("não encontrado") || normalized.includes("nao encontrado")
      ? 404
      : businessCode === "PRODUCT_HAS_LINKS" || businessCode === "UNIT_HAS_LINKS"
        || businessCode === "PRODUCT_DELETE_RACE" || businessCode === "UNIT_DELETE_RACE"
        || businessCode === "CAPTURE_DECISION_CONFLICT"
        ? 409
      : PUBLICATION_RULE_CODES.has(businessCode) || error.code === "P0001"
        ? 422
        : 502;
  const message = PUBLICATION_MESSAGES[businessCode];
  if (!message) return productTechnicalFailure("publication_command", error, "Não foi possível concluir a operação do imóvel.");
  return Response.json({ error: message, code: businessCode }, { status });
}

function productTechnicalFailure(
  operation: string,
  error?: { code?: string | null },
  message = "Não foi possível carregar a ficha do imóvel. Tente novamente.",
) {
  const code = error?.code ?? "UNKNOWN";
  console.error("[product-api]", { operation, code });
  return Response.json({ error: message, code: operation.startsWith("read_") ? "PRODUCT_READ_FAILED" : "PRODUCT_OPERATION_FAILED" }, { status: 502 });
}

function reconciliationRequired(operation: string, error?: { code?: string | null }) {
  console.error("[product-api]", { operation, code: error?.code ?? "UNKNOWN", reconciliationRequired: true });
  return Response.json({
    error: "A operação foi iniciada, mas uma etapa complementar não foi confirmada. Atualize a ficha antes de tentar novamente.",
    code: "RECONCILIATION_REQUIRED",
    retryable: false,
  }, { status: 409 });
}
const productFields = [
  "nome", "titulo", "slogan", "finalidade", "lazer", "diferenciais", "incorporadora", "descricao", "status", "preco", "condominio_valor", "iptu",
  "outros_custos", "area_util", "dormitorios", "suites", "vagas", "banheiros", "endereco",
  "numero", "complemento", "bairro", "cidade", "uf", "cep", "acesso_tipo", "acesso_codigo",
  "acesso_instrucoes", "tour_url", "seo_titulo", "seo_descricao",
] as const;

function publicMediaUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/empreendimentos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function authenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("empreendimentos")
    .select(`
      *,
      condominios (*),
      unidades (*),
      midias (id, tipo, storage_path, categoria, nome, is_capa, created_at, unidade_id, ordem, alt_text)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    return productTechnicalFailure("read_product", error);
  }
  const media = (data.midias ?? [])
    .map((item) => ({ ...item, url: publicMediaUrl(item.storage_path) }))
    .sort((left, right) => Number(right.is_capa) - Number(left.is_capa)
      || left.ordem - right.ordem
      || left.created_at.localeCompare(right.created_at));
  const buildingMedia = media.filter((item) => !item.unidade_id);
  const units = data.unidades ?? [];
  const approvedUnits = units.filter((item) => (item.aprovacao ?? "aprovado") === "aprovado");
  const availableUnits = approvedUnits.filter((item) => item.disponivel);
  const publishedAvailableUnits = availableUnits.filter((item) => item.publicado !== false);
  const unitPrices = availableUnits.map((item) => item.valor_promo ?? item.valor_tabela).filter((value): value is number => typeof value === "number" && value > 0);
  const unitAreas = availableUnits.map((item) => item.area_m2).filter((value): value is number => typeof value === "number" && value > 0);
  const photoCount = buildingMedia.filter((item) => item.tipo === "foto").length;
  const videoCount = buildingMedia.filter((item) => item.tipo === "video").length;
  const summaryPrice = data.preco ?? (unitPrices.length ? Math.min(...unitPrices) : null);
  const summaryArea = data.area_util ?? (unitAreas.length ? Math.min(...unitAreas) : null);
  const quality = assessProductQuality({
    name: data.nome, title: data.titulo, slogan: data.slogan, description: data.descricao, purpose: data.finalidade,
    price: summaryPrice, area: summaryArea, bedrooms: data.dormitorios, bathrooms: data.banheiros, parking: data.vagas,
    address: data.endereco, number: data.numero, neighborhood: data.bairro, city: data.cidade, state: data.uf, zip: data.cep,
    condominiumFee: data.condominio_valor, propertyTax: data.iptu, otherCosts: data.outros_custos,
    photos: photoCount, videos: videoCount, hasCover: buildingMedia.some((item) => item.tipo === "foto" && item.is_capa),
    mediaCategories: buildingMedia.filter((item) => item.tipo === "foto").map((item) => item.categoria ?? ""), tourUrl: data.tour_url,
    units: approvedUnits.length, availableUnits: availableUnits.length,
    unitsWithValidPrice: unitPrices.filter((value) => isPlausibleProductPrice(value, data.finalidade)).length,
    amenities: data.lazer, differentiators: data.diferenciais,
  });
  const [
    { data: broker, error: brokerError },
    { data: meuPerfilGet, error: profileError },
  ] = await Promise.all([
    auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle(),
    auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle(),
  ]);
  const contextReadError = brokerError ?? profileError;
  if (contextReadError) return productTechnicalFailure("read_product_context", contextReadError);
  const gerenciaProdutosGet = isProductManagerRole((meuPerfilGet as { role?: string } | null)?.role);
  if (!gerenciaProdutosGet && !broker?.id) {
    return Response.json({ error: "Seu usuário ainda não está vinculado a uma carteira ativa." }, { status: 403 });
  }
  let leadsQuery = auth.supabase.from("leads").select("id,nome,telefone,corretor_id").order("atualizado_em", { ascending: false }).limit(100);
  if (broker?.id) leadsQuery = leadsQuery.eq("corretor_id", broker.id);
  const unitIds = (data.unidades ?? []).map((unit) => unit.id);
  const ownerStatusesPromise = unitIds.length
    ? auth.supabase.rpc("produto_unidades_proprietario_status", { p_unidade_ids: unitIds })
    : Promise.resolve({ data: [], error: null });
  const [
    { data: favorite, error: favoriteError },
    { data: links, error: linksError },
    { data: leadOptions, error: leadOptionsError },
    { data: corretoresList, error: corretoresError },
    { data: privateOwners, error: privateOwnersError },
    { data: ownerStatuses, error: ownerStatusesError },
    { data: productOwners, error: productOwnersError },
  ] = await Promise.all([
    auth.supabase.from("produto_favoritos").select("empreendimento_id").eq("empreendimento_id", id).eq("usuario_id", auth.user.id).maybeSingle(),
    auth.supabase.from("lead_produtos").select("lead_id").eq("empreendimento_id", id),
    leadsQuery,
    auth.supabase.from("corretores").select("id,nome"),
    auth.supabase.rpc("produto_unidades_proprietarios_ler", { p_empreendimento_ids: [id] }),
    ownerStatusesPromise,
    auth.supabase.rpc("produto_proprietario_ler", { p_empreendimento_id: id }),
  ]);
  const relatedReadError = favoriteError ?? linksError ?? leadOptionsError ?? corretoresError
    ?? privateOwnersError ?? ownerStatusesError ?? productOwnersError;
  if (relatedReadError) return productTechnicalFailure("read_product_relations", relatedReadError);
  const linkedIds = new Set((links ?? []).map((item) => item.lead_id));
  const corretorNameById = new Map((corretoresList ?? []).map((c) => [c.id, c.nome]));
  const captadorCorretorId = (data as { captador_corretor_id?: number | null }).captador_corretor_id ?? null;
  const capturedByName: string | null = captadorCorretorId ? (corretorNameById.get(captadorCorretorId) ?? null) : null;
  const privateOwnerByUnit = new Map((privateOwners ?? []).map((owner) => [owner.unidade_id, owner]));
  const ownerCompleteByUnit = new Map((ownerStatuses ?? []).map((owner) => [owner.unidade_id, owner.completo]));
  const unidadesEnriched = (data.unidades ?? []).map((u) => ({ ...u, captador_nome: corretorNameById.get((u as { captador_corretor_id?: number | null }).captador_corretor_id ?? -1) ?? null }));
  const mine = (data as { captado_por_usuario?: string | null }).captado_por_usuario === auth.user.id
    || (broker?.id != null && captadorCorretorId === broker.id);
  const podeEditar = gerenciaProdutosGet || mine;
  const productOwner = productOwners?.[0] ?? null;
  // Todos os corretores autenticados podem consultar a ficha operacional completa.
  // Somente a gestão ou o captador da unidade recebe nome e contato do proprietário.
  const unidadesVisiveis = unidadesEnriched.map((u) => {
    const unidadeMinha = canViewUnitOwner({
      viewerBrokerId: broker?.id,
      captorBrokerId: (u as { captador_corretor_id?: number | null }).captador_corretor_id,
    });
    const podeEditarUnidade = gerenciaProdutosGet || unidadeMinha;
    const podeVerProprietarioUnidade = canViewUnitOwner({
      viewerBrokerId: broker?.id,
      captorBrokerId: (u as { captador_corretor_id?: number | null }).captador_corretor_id,
      isManager: gerenciaProdutosGet,
    });
    const privateOwner = privateOwnerByUnit.get(u.id);
    const ownerComplete = ownerCompleteByUnit.get(u.id) ?? Boolean(u.proprietario_nome && u.proprietario_contato);
    return podeVerProprietarioUnidade
      ? { ...u, proprietario_nome: privateOwner?.proprietario_nome ?? u.proprietario_nome, proprietario_contato: privateOwner?.proprietario_contato ?? u.proprietario_contato, mine: unidadeMinha, pode_editar: podeEditarUnidade, pode_ver_proprietario: podeVerProprietarioUnidade, owner_complete: ownerComplete }
      : { ...u, mine: false, pode_editar: podeEditarUnidade, pode_ver_proprietario: false, owner_complete: ownerComplete, proprietario_nome: null, proprietario_contato: null };
  });
  const podeVerProprietarioProduto = gerenciaProdutosGet || mine;
  const checks: Record<string, boolean> = {
    basics: Boolean(data.nome && (data.preco || unitPrices.length) && (data.area_util || unitAreas.length)),
    location: Boolean(data.endereco && data.bairro && data.cidade),
    costs: data.condominio_valor !== null && data.iptu !== null && data.outros_custos !== null,
    media: photoCount >= 10 && videoCount >= 1 && media.some((item) => item.tipo === "foto" && item.is_capa),
    units: data.origem === "terceiros" || units.length > 0,
  };
  if (data.origem === "terceiros") {
    checks.owner = Boolean(data.proprietario_id);
    checks.access = Boolean(data.acesso_tipo && data.acesso_instrucoes && (data.acesso_tipo !== "chave_digital" || data.acesso_codigo));
  }
  const sitePublished = isProductPublishedOnSite({
    published: data.publicado,
    draft: data.rascunho,
    approval: data.aprovacao,
    status: data.status,
    availableApprovedUnits: publishedAvailableUnits.length,
  });
  return Response.json({ product: { ...data, proprietario_id: podeVerProprietarioProduto ? data.proprietario_id : null, proprietarios: podeVerProprietarioProduto ? productOwner : null, proprietario_nome: null, proprietario_tel: null, proprietario_email: null, site_published: sitePublished, midias: media, unidades: unidadesVisiveis, captado_por_nome: capturedByName, mine, pode_editar: podeEditar, pode_ver_proprietario: podeVerProprietarioProduto, summary_price: summaryPrice, summary_area: summaryArea, is_favorite: Boolean(favorite), leads: (leadOptions ?? []).map((lead) => ({ ...lead, linked: linkedIds.has(lead.id) })), quality, completion: { checks, completed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length } } });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const command = await lerComandoJson(request, PRODUCT_COMMAND_MAX_BYTES);
  if (!command.ok) return Response.json(
    { error: command.message, code: command.code },
    { status: command.status },
  );
  const body = command.value;
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID.test(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
  const authenticatedSupabase = auth.supabase;
  const authenticatedUserId = auth.user.id;
  const [
    { data: productContext, error: productContextError },
    { data: meuPerfilPatch, error: profilePatchError },
    { data: brokerContext, error: brokerContextError },
  ] = await Promise.all([
    auth.supabase.from("empreendimentos").select("nome, descricao, finalidade, origem, condominio_id, captado_por_usuario, captador_corretor_id, aprovacao, publicado, rascunho").eq("id", id).maybeSingle(),
    auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle(),
    auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle(),
  ]);
  const mutationContextError = productContextError ?? profilePatchError ?? brokerContextError;
  if (mutationContextError) return productTechnicalFailure("read_mutation_context", mutationContextError);
  if (!productContext) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
  const currentPurpose = productContext?.finalidade ?? "venda";
  const gerenciaProdutos = isProductManagerRole((meuPerfilPatch as { role?: string } | null)?.role);
  const souCaptador = (productContext as { captado_por_usuario?: string | null } | null)?.captado_por_usuario === auth.user.id
    || (brokerContext?.id != null && productContext?.captador_corretor_id === brokerContext.id);
  const negadoPorCaptacao = !gerenciaProdutos && !souCaptador ? Response.json({ error: "Você só pode editar imóveis captados por você." }, { status: 403 }) : null;

  // Acesso efetivo resolvido uma vez; admin passa e, sem mapa, libera (RLS é a trava dura).
  // Aprovação/publicação continuam por role logo abaixo (decideUnit/publish).
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  const guard = (pairs: Array<[string, string]>, msg: string) => denyIfCannot(access, pairs, msg);

  async function definePublication(publish: boolean, unidadeId: string | null = null) {
    const { data, error } = await authenticatedSupabase.rpc("produto_definir_publicacao", {
      p_empreendimento_id: id,
      p_publicado: publish,
      p_unidade_id: unidadeId,
    });
    if (error) return { response: publicationErrorResponse(error) } as const;
    const publication = data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
    if (publication.ok !== true || publication.site_visivel !== publish) {
      return {
        response: Response.json({
          error: publish
            ? "O banco concluiu a operação, mas o imóvel ainda não ficou visível na vitrine. Nenhuma confirmação falsa foi exibida."
            : "O banco concluiu a operação, mas o imóvel ainda aparece na vitrine.",
          code: "SITE_PUBLICATION_NOT_CONFIRMED",
          publication,
        }, { status: 502 }),
      } as const;
    }
    return { publication } as const;
  }

  async function editableMediaContext(mediaId: string) {
    const { data: media, error } = await authenticatedSupabase
      .from("midias")
      .select("id,unidade_id,storage_path,is_capa,tipo")
      .eq("id", mediaId)
      .eq("empreendimento_id", id)
      .maybeSingle();
    if (error) return { error: productTechnicalFailure("read_media_context", error) } as const;
    if (!media) return { error: Response.json({ error: "Mídia não encontrada." }, { status: 404 }) } as const;
    if (!media.unidade_id) {
      return { media, canEdit: gerenciaProdutos || souCaptador } as const;
    }
    const [{ data: unit, error: unitError }, { data: broker, error: brokerError }] = await Promise.all([
      authenticatedSupabase.from("unidades").select("captador_corretor_id").eq("id", media.unidade_id).eq("empreendimento_id", id).maybeSingle(),
      authenticatedSupabase.from("corretores").select("id").eq("usuario_id", authenticatedUserId).maybeSingle(),
    ]);
    const contextError = unitError ?? brokerError;
    if (contextError) return { error: productTechnicalFailure("read_media_owner_context", contextError) } as const;
    // O vínculo do captador é a autoridade canônica. O marcador legado
    // de_terceiros não pode retirar acesso de quem realmente captou a unidade.
    const ownsUnit = Boolean(broker?.id != null && unit?.captador_corretor_id === broker.id);
    return { media, canEdit: gerenciaProdutos || ownsUnit } as const;
  }

  if (body.action === "publishUnit" || body.action === "unpublishUnit") {
    if (!gerenciaProdutos) return Response.json({ error: "Apenas a gestão de Produtos pode publicar ou retirar imóveis do site." }, { status: 403 });
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const { data: unit, error: unitReadError } = await auth.supabase
      .from("unidades")
      .select("id,numero,codigo,publicado,disponivel,aprovacao,descricao_comercial")
      .eq("id", unidadeId)
      .eq("empreendimento_id", id)
      .maybeSingle();
    if (unitReadError) return productTechnicalFailure("read_unit_publication", unitReadError);
    if (!unit) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });
    const publish = body.action === "publishUnit";
    if (publish && unit.aprovacao !== "aprovado") return Response.json({ error: "A unidade precisa estar aprovada antes de voltar ao site." }, { status: 422 });
    if (publish && !unit.disponivel) return Response.json({ error: "A unidade está indisponível. Marque-a como disponível antes de publicar." }, { status: 422 });
    if (publish && productContext?.aprovacao !== "aprovado") return Response.json({ error: "O cadastro do empreendimento de referência precisa estar aprovado." }, { status: 422 });
    if (publish && (unit.descricao_comercial || productContext.descricao || "").trim().length < 80) {
      return Response.json({ error: "Descrição comercial com pelo menos 80 caracteres.", code: "UNIT_DESCRIPTION_REQUIRED" }, { status: 422 });
    }
    const result = await definePublication(publish, unidadeId);
    if ("response" in result) return result.response;
    return Response.json({
      success: true,
      unidadeId,
      publicado: publish,
      approval: publish ? "aprovado" : unit.aprovacao,
      disponivel: unit.disponivel,
      publication: result.publication,
    });
  }

  if (body.action === "criarUnidade") {
    const denied = guard([["produtos", "criar"], ["produtos", "editar"]], "Você não tem permissão para cadastrar unidades.");
    if (denied) return denied;
    const input = (body.unidade && typeof body.unidade === "object" ? body.unidade : {}) as Record<string, unknown>;
    const asString = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);
    const asNumber = (value: unknown) => {
      if (value === "" || value == null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const numero = asString(input.numero);
    if (!numero) return Response.json({ error: "Informe o número da unidade." }, { status: 400 });
    const tipologia = asString(input.tipologia);
    const area = asNumber(input.area_m2);
    const proprietarioNome = asString(input.proprietario_nome);
    const proprietarioContato = asString(input.proprietario_contato);
    const acessoTipo = asString(input.acesso_tipo);
    const acessoCodigo = asString(input.acesso_codigo);
    const acessoInstrucoes = asString(input.acesso_instrucoes);
    if (!tipologia || area == null || area <= 0) return Response.json({ error: "Informe tipologia e área útil da unidade." }, { status: 422 });
    if (!proprietarioNome || !proprietarioContato) return Response.json({ error: "Informe nome e contato do proprietário." }, { status: 422 });
    if (!acessoTipo || !acessoInstrucoes) return Response.json({ error: "Informe o tipo e as instruções de acesso." }, { status: 422 });
    if (acessoTipo === "chave_digital" && !acessoCodigo) return Response.json({ error: "Informe o código da chave digital." }, { status: 422 });
    const valorTabela = asNumber(input.valor_tabela);
    if (valorTabela == null) return Response.json({ error: "Informe o valor de tabela da unidade." }, { status: 400 });
    const tablePriceCheck = validateProductPrice(valorTabela, "Valor de tabela", currentPurpose);
    if (tablePriceCheck.error) return Response.json({ error: tablePriceCheck.error }, { status: 422 });
    const promoPrice = asNumber(input.valor_promo);
    if (promoPrice != null) {
      const promoPriceCheck = validateProductPrice(promoPrice, "Valor promocional", currentPurpose);
      if (promoPriceCheck.error) return Response.json({ error: promoPriceCheck.error }, { status: 422 });
    }
    const unitCosts = [asNumber(input.condominio_valor), asNumber(input.iptu), asNumber(input.outros_custos)];
    if (unitCosts.some((value) => value != null && value < 0)) return Response.json({ error: "Condomínio, IPTU e outros custos não podem ser negativos." }, { status: 422 });

    if (!brokerContext?.id && !gerenciaProdutos) return Response.json({ error: "Seu usuário ainda não está vinculado a um corretor ativo." }, { status: 422 });
    // RESUMABLE_UNIT_LOOKUP: se a conexão caiu depois de criar a unidade, uma
    // nova tentativa do mesmo captador continua o cadastro existente.
    const { data: sameBuildingUnits, error: lookupError } = await auth.supabase
      .from("unidades")
      .select("id,numero,captador_corretor_id,aprovacao,publicado")
      .eq("empreendimento_id", id)
      .eq("de_terceiros", true)
      .limit(500);
    if (lookupError) return productTechnicalFailure("read_resumable_unit", lookupError);
    const existingUnit = (sameBuildingUnits ?? []).find((unit) => unit.numero?.trim().toLocaleLowerCase("pt-BR") === numero.toLocaleLowerCase("pt-BR"));
    if (existingUnit) {
      const sameOwner = brokerContext?.id != null
        ? existingUnit.captador_corretor_id === brokerContext.id
        : gerenciaProdutos && existingUnit.captador_corretor_id == null;
      if (sameOwner && existingUnit.aprovacao !== "aprovado" && existingUnit.publicado !== true) {
        return Response.json({ unidadeId: existingUnit.id, userId: auth.user.id, resumed: true });
      }
      return Response.json({ error: "Esta unidade já foi cadastrada neste prédio. Abra o imóvel existente para continuar." }, { status: 409 });
    }
    const unitRow = {
      empreendimento_id: id, de_terceiros: true, aprovacao: "pendente", disponivel: true,
      captador_corretor_id: brokerContext?.id ?? null,
      numero,
      tipologia,
      area_m2: area,
      vagas: asNumber(input.vagas),
      valor_tabela: tablePriceCheck.value,
      valor_promo: promoPrice,
      compre_ja_alugado: input.compre_ja_alugado === true,
      condominio_valor: asNumber(input.condominio_valor),
      iptu: asNumber(input.iptu),
      outros_custos: asNumber(input.outros_custos),
      proprietario_nome: proprietarioNome,
      proprietario_contato: proprietarioContato,
      acesso_tipo: acessoTipo,
      acesso_codigo: acessoCodigo,
      acesso_instrucoes: acessoInstrucoes,
    };
    const { data: novaUnidade, error } = await auth.supabase.from("unidades").insert(unitRow as never).select("id").single();
    if (error) {
      const databaseMessage = error.message?.toLowerCase() ?? "";
      if (error.code === "23505" || databaseMessage.includes("unique") || databaseMessage.includes("uq_unidade_indicacao_por_predio")) {
        return Response.json({ error: "Esta unidade já foi cadastrada neste prédio." }, { status: 409 });
      }
      return productTechnicalFailure("create_unit", error, "Não foi possível cadastrar a unidade.");
    }
    return Response.json({ unidadeId: novaUnidade.id, userId: auth.user.id });
  }

  if (body.action === "updateUnit") {
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const { data: currentUnit, error: currentUnitError } = await auth.supabase.from("unidades").select("id,captador_corretor_id,de_terceiros,aprovacao,publicado,descricao_comercial").eq("id", unidadeId).eq("empreendimento_id", id).maybeSingle();
    if (currentUnitError) return productTechnicalFailure("read_unit_update", currentUnitError);
    if (!currentUnit) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });
    const broker = brokerContext;
    const ownsUnit = broker?.id != null && currentUnit.captador_corretor_id === broker.id;
    const canEditUnitOwner = gerenciaProdutos || ownsUnit;
    if (!gerenciaProdutos && !ownsUnit) return Response.json({ error: "Você só pode editar a unidade que captou." }, { status: 403 });
    const input = (body.unidade && typeof body.unidade === "object" ? body.unidade : {}) as Record<string, unknown>;
    const asString = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);
    const asNumber = (value: unknown) => {
      if (value === "" || value == null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const numero = asString(input.numero);
    const tipologia = asString(input.tipologia);
    const area = asNumber(input.area_m2);
    const valorTabela = asNumber(input.valor_tabela);
    const valorPromo = asNumber(input.valor_promo);
    const proprietarioNome = asString(input.proprietario_nome);
    const proprietarioContato = asString(input.proprietario_contato);
    const acessoTipo = asString(input.acesso_tipo);
    const acessoCodigo = asString(input.acesso_codigo);
    const acessoInstrucoes = asString(input.acesso_instrucoes);
    const optionalText = (field: string, maxLength: number) => {
      if (!Object.hasOwn(input, field)) return { value: undefined as string | null | undefined };
      const raw = input[field];
      if (raw !== null && typeof raw !== "string") return { error: `O campo ${field} é inválido.` };
      const value = typeof raw === "string" ? raw.trim() || null : null;
      if (value && value.length > maxLength) return { error: `O campo ${field} deve ter no máximo ${maxLength} caracteres.` };
      return { value };
    };
    const tituloComercial = optionalText("titulo_comercial", 120);
    const descricaoComercial = optionalText("descricao_comercial", 5000);
    const seoTitulo = optionalText("seo_titulo", 70);
    const seoDescricao = optionalText("seo_descricao", 180);
    const editorialError = tituloComercial.error ?? descricaoComercial.error ?? seoTitulo.error ?? seoDescricao.error;
    if (editorialError) return Response.json({ error: editorialError }, { status: 422 });
    if (!numero || !tipologia || area == null || area <= 0) return Response.json({ error: "Informe número, tipologia e área útil da unidade." }, { status: 422 });
    if (valorTabela == null) return Response.json({ error: "Informe o valor de tabela da unidade." }, { status: 422 });
    const tablePriceCheck = validateProductPrice(valorTabela, "Valor de tabela", currentPurpose);
    if (tablePriceCheck.error) return Response.json({ error: tablePriceCheck.error }, { status: 422 });
    if (valorPromo != null) {
      const promoCheck = validateProductPrice(valorPromo, "Valor promocional", currentPurpose);
      if (promoCheck.error) return Response.json({ error: promoCheck.error }, { status: 422 });
    }
    const unitCosts = [asNumber(input.condominio_valor), asNumber(input.iptu), asNumber(input.outros_custos)];
    if (unitCosts.some((value) => value != null && value < 0)) return Response.json({ error: "Condomínio, IPTU e outros custos não podem ser negativos." }, { status: 422 });
    if (currentUnit.de_terceiros && canEditUnitOwner && (!proprietarioNome || !proprietarioContato)) return Response.json({ error: "Informe nome e contato do proprietário." }, { status: 422 });
    if (!acessoTipo || !acessoInstrucoes) return Response.json({ error: "Informe o tipo e as instruções de acesso." }, { status: 422 });
    if (acessoTipo === "chave_digital" && !acessoCodigo) return Response.json({ error: "Informe o código da chave digital." }, { status: 422 });
    const effectiveDescription = descricaoComercial.value === undefined
      ? (currentUnit.descricao_comercial || productContext.descricao || "")
      : (descricaoComercial.value || productContext.descricao || "");
    if (gerenciaProdutos && currentUnit.publicado && effectiveDescription.trim().length < 80) {
      return Response.json({ error: "Descrição comercial com pelo menos 80 caracteres.", code: "UNIT_DESCRIPTION_REQUIRED" }, { status: 422 });
    }
    const patch = {
      numero, tipologia, area_m2: area, vagas: asNumber(input.vagas),
      valor_tabela: tablePriceCheck.value, valor_promo: valorPromo,
      disponivel: input.disponivel !== false,
      compre_ja_alugado: input.compre_ja_alugado === true,
      condominio_valor: asNumber(input.condominio_valor),
      iptu: asNumber(input.iptu),
      outros_custos: asNumber(input.outros_custos),
      ...(canEditUnitOwner ? { proprietario_nome: proprietarioNome, proprietario_contato: proprietarioContato } : {}),
      acesso_tipo: acessoTipo, acesso_codigo: acessoCodigo, acesso_instrucoes: acessoInstrucoes,
      ...(tituloComercial.value !== undefined ? { titulo_comercial: tituloComercial.value } : {}),
      ...(descricaoComercial.value !== undefined ? { descricao_comercial: descricaoComercial.value } : {}),
      ...(seoTitulo.value !== undefined ? { seo_titulo: seoTitulo.value } : {}),
      ...(seoDescricao.value !== undefined ? { seo_descricao: seoDescricao.value } : {}),
      ...(gerenciaProdutos ? {} : { aprovacao: "pendente", publicado: false, reprovacao_motivo: null }),
    };
    const { data: updatedUnit, error } = await auth.supabase.from("unidades").update(patch as never).eq("id", unidadeId).eq("empreendimento_id", id).select("id").maybeSingle();
    if (error) return productTechnicalFailure("update_unit", error, "Não foi possível atualizar a unidade.");
    if (!updatedUnit) return Response.json({ error: "A unidade não foi alterada. Atualize a tela e tente novamente.", code: "UNIT_UPDATE_NOT_CONFIRMED" }, { status: 409 });
    return Response.json({ success: true, approval: gerenciaProdutos ? currentUnit.aprovacao : "pendente" });
  }

  if (body.action === "setUnitAvailability") {
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const disponivel = body.disponivel === true;
    const { data, error } = await auth.supabase.rpc("produto_unidade_definir_disponibilidade", {
      p_empreendimento_id: id,
      p_unidade_id: unidadeId,
      p_disponivel: disponivel,
    });
    if (error) return publicationErrorResponse(error);
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
    if (result.ok !== true || result.unidade_id !== unidadeId || result.disponivel !== disponivel) {
      return Response.json({ error: "O banco não confirmou a alteração de disponibilidade.", code: "UNIT_AVAILABILITY_NOT_CONFIRMED" }, { status: 502 });
    }
    return Response.json({ success: true, unidadeId, disponivel, publicado: result.publicado === true });
  }

  if (body.action === "deleteUnit") {
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    // Esta RPC autoriza pelo captador e corrige o marcador legado na mesma
    // transação antes de delegar à exclusão canônica já existente.
    const { data, error } = await auth.supabase.rpc("produto_unidade_excluir_canonica", {
      p_empreendimento_id: id,
      p_unidade_id: unidadeId,
    });
    if (error) return publicationErrorResponse(error);
    const deletion = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as {
      ok?: boolean; unidade_id?: string; produto_excluido?: boolean; midias_paths?: unknown;
    };
    if (deletion.ok !== true || deletion.unidade_id !== unidadeId) {
      return Response.json({ error: "O banco não confirmou a exclusão do imóvel.", code: "UNIT_DELETE_NOT_CONFIRMED" }, { status: 502 });
    }
    const paths = Array.isArray(deletion.midias_paths)
      ? deletion.midias_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
      : [];
    let storageWarning: string | null = null;
    if (paths.length) {
      const { error: storageError } = await auth.supabase.storage.from("empreendimentos").remove(paths);
      if (storageError) {
        console.error("[product-api]", { operation: "delete_unit_storage", code: "STORAGE_CLEANUP_FAILED", unitId: unidadeId, reconciliationRequired: true });
        storageWarning = "O imóvel foi excluído, mas alguns arquivos exigem reconciliação do Storage.";
      }
    }
    return Response.json({
      success: true,
      deleted: true,
      unidadeId,
      productDeleted: deletion.produto_excluido === true,
      removedMedia: storageWarning ? 0 : paths.length,
      storageCleanupPending: Boolean(storageWarning),
      warning: storageWarning,
      code: storageWarning ? "RECONCILIATION_REQUIRED" : undefined,
    });
  }

  if (body.action === "decideUnit") {
    if (!gerenciaProdutos) return Response.json({ error: "Apenas a gestão de Produtos pode aprovar unidades." }, { status: 403 });
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const approve = body.approve === true;
    const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 300) : "";
    if (!approve && !motivo) return Response.json({ error: "Informe o motivo da reprovação.", code: "CAPTURE_DECISION_REASON_REQUIRED" }, { status: 422 });
    if (approve) {
      const [{ data: unitToApprove, error: unitReadError }, mediaCount, ownerStatus] = await Promise.all([
        auth.supabase.from("unidades").select("numero,tipologia,area_m2,valor_tabela,valor_promo,proprietario_nome,proprietario_contato,acesso_tipo,acesso_codigo,acesso_instrucoes,titulo_comercial,descricao_comercial,seo_titulo,seo_descricao").eq("id", unidadeId).eq("empreendimento_id", id).maybeSingle(),
        auth.supabase.from("midias").select("id", { count: "exact", head: true }).eq("unidade_id", unidadeId).eq("tipo", "foto"),
        auth.supabase.rpc("produto_unidades_proprietario_status", { p_unidade_ids: [unidadeId] }),
      ]);
      const unitApprovalContextError = unitReadError ?? mediaCount.error ?? ownerStatus.error;
      if (unitApprovalContextError) return productTechnicalFailure("read_unit_approval_context", unitApprovalContextError);
      if (!unitToApprove) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });
      const blocking: string[] = [];
      if (!unitToApprove.numero || !unitToApprove.tipologia || !unitToApprove.area_m2 || unitToApprove.area_m2 <= 0) blocking.push("Número, tipologia e área útil");
      if (!isPlausibleProductPrice(unitToApprove.valor_promo ?? unitToApprove.valor_tabela, currentPurpose)) blocking.push("Preço válido");
      const pricePerSquareMeter = validateProductPricePerSquareMeter(
        unitToApprove.valor_promo ?? unitToApprove.valor_tabela,
        unitToApprove.area_m2,
        "Unidade",
        currentPurpose,
      );
      if (pricePerSquareMeter.error) blocking.push(pricePerSquareMeter.error);
      const ownerComplete = ownerStatus.data?.[0]?.completo ?? Boolean(unitToApprove.proprietario_nome && unitToApprove.proprietario_contato);
      if (!ownerComplete) blocking.push("Proprietário e contato");
      if (!unitToApprove.acesso_tipo || !unitToApprove.acesso_instrucoes || (unitToApprove.acesso_tipo === "chave_digital" && !unitToApprove.acesso_codigo)) blocking.push("Instruções de acesso");
      if ((mediaCount.count ?? 0) < 1) blocking.push("Ao menos uma foto da unidade");
      if ((unitToApprove.descricao_comercial || productContext.descricao || "").trim().length < 80) blocking.push("Descrição comercial com pelo menos 80 caracteres");
      if (blocking.length) return Response.json({ error: `Complete a unidade antes de aprovar: ${blocking.join("; ")}.`, code: "UNIT_NOT_READY", blocking }, { status: 422 });
    }
    const { data, error } = await auth.supabase.rpc("produto_decidir_captacao", {
      p_empreendimento_id: id,
      p_unidade_id: unidadeId,
      p_aprovar: approve,
      p_motivo: approve ? null : motivo,
    });
    if (error) return publicationErrorResponse(error);
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    if (!result || result.ok !== true || result.unidade_id !== unidadeId || result.auditoria_id == null
      || result.aprovacao !== (approve ? "aprovado" : "reprovado") || result.publicado !== approve) {
      return Response.json({ error: "A decisão da unidade não foi confirmada.", code: "UNIT_DECISION_NOT_CONFIRMED" }, { status: 502 });
    }
    return Response.json({
      success: true,
      aprovacao: result.aprovacao,
      publicado: result.publicado,
      replayed: result.replayed === true,
      auditoriaId: result.auditoria_id,
      publication: result.publication ?? null,
    });
  }

  if (body.action === "toggleFavorite") {
    const favorite = body.favorite === true;
    if (favorite) {
      const { data: changedFavorite, error: favoriteError } = await auth.supabase.from("produto_favoritos").upsert(
        { empreendimento_id: id, usuario_id: auth.user.id },
        { onConflict: "empreendimento_id,usuario_id" },
      ).select("empreendimento_id").maybeSingle();
      if (favoriteError) return productTechnicalFailure("set_favorite", favoriteError, "Não foi possível atualizar o favorito.");
      if (!changedFavorite) return Response.json({ error: "O favorito não foi confirmado.", code: "FAVORITE_CHANGE_NOT_CONFIRMED" }, { status: 409 });
    } else {
      const { error: favoriteError } = await auth.supabase.from("produto_favoritos").delete().eq("empreendimento_id", id).eq("usuario_id", auth.user.id).select("empreendimento_id");
      if (favoriteError) return productTechnicalFailure("unset_favorite", favoriteError, "Não foi possível atualizar o favorito.");
    }
    return Response.json({ success: true, favorite });
  }

  if (body.action === "applyPhotoAiSuggestions" || body.action === "restorePhotoAiSuggestions") {
    const unitId = typeof body.unitId === "string" && body.unitId ? body.unitId : null;
    const expectedVersion = typeof body.expectedVersion === "string" ? body.expectedVersion : "";
    const suggestions = Array.isArray(body.suggestions) ? body.suggestions : [];
    const restoring = body.action === "restorePhotoAiSuggestions";
    const suggestionLimit = restoring ? PHOTO_AI_MAX_RESTORE_ITEMS : PHOTO_AI_MAX_SUGGESTIONS;
    if ((unitId && !UUID.test(unitId)) || !/^[0-9a-f]{32}$/i.test(expectedVersion) || suggestions.length < 1 || suggestions.length > suggestionLimit) {
      return Response.json({ error: "Revisão de fotos inválida.", code: "MEDIA_AI_INVALID" }, { status: 400 });
    }
    const { data, error } = await auth.supabase.rpc("produto_midias_aplicar_ia", {
      p_empreendimento_id: id,
      p_unidade_id: unitId,
      p_versao_esperada: expectedVersion,
      p_sugestoes: suggestions as Database["public"]["Functions"]["produto_midias_aplicar_ia"]["Args"]["p_sugestoes"],
      p_restaurar: restoring,
    });
    if (error) {
      const databaseMessage = error.message ?? "";
      const status = /MEDIA_AI_CONFLICT/.test(databaseMessage) ? 409
        : /MEDIA_AI_FORBIDDEN|permission denied/i.test(databaseMessage) ? 403
          : /MEDIA_AI_INVALID/.test(databaseMessage) ? 422 : 502;
      if (status === 409) {
        return Response.json({ error: "A galeria mudou desde a análise.", code: "MEDIA_AI_CONFLICT" }, { status: 409 });
      }
      if (status === 403) {
        return Response.json({ error: "Você não tem permissão para aplicar sugestões nesta galeria.", code: "MEDIA_AI_FORBIDDEN" }, { status: 403 });
      }
      if (status === 422) {
        return Response.json({ error: "As sugestões precisam ser revisadas.", code: "MEDIA_AI_INVALID" }, { status: 422 });
      }
      return productTechnicalFailure("apply_photo_ai_suggestions", error, "Não foi possível aplicar a revisão das fotos.");
    }
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    if (!result || result.ok !== true || typeof result.versao !== "string") {
      return Response.json({ error: "O banco não confirmou a revisão das fotos.", code: "MEDIA_UPDATE_NOT_CONFIRMED" }, { status: 502 });
    }
    return Response.json(result);
  }

  if (body.action === "linkLead" || body.action === "unlinkLead") {
    const leadId = Number(body.leadId);
    if (!Number.isSafeInteger(leadId) || leadId <= 0) return Response.json({ error: "Lead inválido." }, { status: 400 });
    const denied = guard([["produtos", "editar"], ["leads", "editar"]], "Você não tem permissão para vincular leads a produtos.");
    if (denied) return denied;
    if (body.action === "linkLead") {
      const { data: changedLink, error: linkError } = await auth.supabase.from("lead_produtos").upsert(
        { lead_id: leadId, empreendimento_id: id, vinculado_por: auth.user.id },
        { onConflict: "lead_id,empreendimento_id" },
      ).select("lead_id").maybeSingle();
      if (linkError) return productTechnicalFailure("link_lead", linkError, "Não foi possível atualizar o vínculo com o lead.");
      if (!changedLink) return Response.json({ error: "O vínculo com o lead não foi confirmado.", code: "LEAD_LINK_CHANGE_NOT_CONFIRMED" }, { status: 409 });
    } else {
      const { error: unlinkError } = await auth.supabase.from("lead_produtos").delete().eq("lead_id", leadId).eq("empreendimento_id", id).select("lead_id");
      if (unlinkError) return productTechnicalFailure("unlink_lead", unlinkError, "Não foi possível atualizar o vínculo com o lead.");
    }
    return Response.json({ success: true, linked: body.action === "linkLead" });
  }

  if (body.action === "publish" || body.action === "unpublish" || body.action === "solicitar") {
    const isApprover = gerenciaProdutos;

    // Corretor (dono) envia solicitação: vira pendente, NÃO vai pro ar. Passa pela alçada de aprovação.
    if (body.action === "solicitar") {
      const owns = (productContext.captado_por_usuario != null && productContext.captado_por_usuario === auth.user.id)
        || (brokerContext?.id != null && productContext.captador_corretor_id === brokerContext.id);
      if (!owns && !isApprover) return Response.json({ error: "Você só pode enviar solicitação de um produto que você captou." }, { status: 403 });
      const { data: requestedProduct, error: requestError } = await auth.supabase.from("empreendimentos").update({ rascunho: false, aprovacao: "pendente", reprovacao_motivo: null }).eq("id", id).select("id").maybeSingle();
      if (requestError) return productTechnicalFailure("request_product_approval", requestError, "Não foi possível enviar o imóvel para aprovação.");
      if (!requestedProduct) return Response.json({ error: "O envio para aprovação não foi confirmado.", code: "PRODUCT_REQUEST_NOT_CONFIRMED" }, { status: 409 });
      return Response.json({ success: true, aprovacao: "pendente" });
    }

    // Publicar / retirar do ar: só aprovadores (admin, gestor, executivo).
    if (!isApprover) return Response.json({ error: "Apenas administradores, gestores ou executivos podem publicar produtos." }, { status: 403 });
    if (body.action === "unpublish") {
      const result = await definePublication(false);
      if ("response" in result) return result.response;
      return Response.json({ success: true, rascunho: false, publicado: false, aprovacao: productContext?.aprovacao, publication: result.publication });
    }
    // Publicar somente após a checagem profissional. A regra fica no servidor para não ser
    // contornada por chamadas diretas à API.
    const { data: productToPublish, error: readError } = await auth.supabase
      .from("empreendimentos")
      .select("nome,titulo,slogan,descricao,finalidade,status,preco,area_util,dormitorios,banheiros,vagas,endereco,numero,bairro,cidade,uf,cep,condominio_valor,iptu,outros_custos,lazer,diferenciais,tour_url,unidades(area_m2,valor_tabela,valor_promo,disponivel,aprovacao),midias(tipo,categoria,is_capa,unidade_id)")
      .eq("id", id)
      .single();
    if (readError) return productTechnicalFailure("read_product_publication", readError);
    if (!productToPublish) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    const publishUnits = (productToPublish.unidades ?? []).filter((unit) => (unit.aprovacao ?? "aprovado") === "aprovado");
    const publishAvailable = publishUnits.filter((unit) => unit.disponivel);
    const publishPrices = publishAvailable.map((unit) => unit.valor_promo ?? unit.valor_tabela).filter((value): value is number => typeof value === "number" && value > 0);
    const publishAreas = publishAvailable.map((unit) => unit.area_m2).filter((value): value is number => typeof value === "number" && value > 0);
    const publishMedia = (productToPublish.midias ?? []).filter((item) => !item.unidade_id);
    if (/pronto/i.test(productToPublish.status ?? "") && publishAvailable.length === 0) {
      return Response.json({ error: "Produto pronto precisa ter ao menos uma unidade aprovada e disponível para aparecer no site.", code: "READY_PRODUCT_WITHOUT_APPROVED_UNIT" }, { status: 422 });
    }
    const quality = assessProductQuality({
      name: productToPublish.nome, title: productToPublish.titulo, slogan: productToPublish.slogan,
      description: productToPublish.descricao, purpose: productToPublish.finalidade,
      price: productToPublish.preco ?? (publishPrices.length ? Math.min(...publishPrices) : null),
      area: productToPublish.area_util ?? (publishAreas.length ? Math.min(...publishAreas) : null),
      bedrooms: productToPublish.dormitorios, bathrooms: productToPublish.banheiros, parking: productToPublish.vagas,
      address: productToPublish.endereco, number: productToPublish.numero, neighborhood: productToPublish.bairro,
      city: productToPublish.cidade, state: productToPublish.uf, zip: productToPublish.cep,
      condominiumFee: productToPublish.condominio_valor, propertyTax: productToPublish.iptu, otherCosts: productToPublish.outros_custos,
      photos: publishMedia.filter((item) => item.tipo === "foto").length,
      videos: publishMedia.filter((item) => item.tipo === "video").length,
      hasCover: publishMedia.some((item) => item.tipo === "foto" && item.is_capa),
      mediaCategories: publishMedia.filter((item) => item.tipo === "foto").map((item) => item.categoria ?? ""),
      tourUrl: productToPublish.tour_url, units: publishUnits.length, availableUnits: publishAvailable.length,
      unitsWithValidPrice: publishPrices.filter((value) => isPlausibleProductPrice(value, productToPublish.finalidade)).length,
      amenities: productToPublish.lazer, differentiators: productToPublish.diferenciais,
    });
    if (!quality.readyForSite) {
      return Response.json({ error: "Este imóvel ainda não atingiu o padrão para o site.", code: "PRODUCT_NOT_READY", quality, blocking: quality.blocking }, { status: 422 });
    }
    const result = await definePublication(true);
    if ("response" in result) return result.response;
    return Response.json({ success: true, rascunho: false, aprovado: true, publicado: true, aprovacao: "aprovado", publication: result.publication });
  }

  if (body.action === "setCover") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    if (!UUID.test(mediaId)) return Response.json({ error: "Mídia inválida." }, { status: 400 });
    const context = await editableMediaContext(mediaId);
    if ("error" in context) return context.error;
    if (!context.canEdit) return Response.json({ error: context.media.unidade_id ? "Você só pode editar as imagens da unidade que captou." : "Você só pode editar as imagens do produto que captou." }, { status: 403 });
    if (context.media.tipo !== "foto") return Response.json({ error: "A capa precisa ser uma foto." }, { status: 422 });
    const { data, error } = await auth.supabase.rpc("produto_midia_definir_capa", {
      p_empreendimento_id: id,
      p_unidade_id: context.media.unidade_id,
      p_media_id: mediaId,
    });
    if (error) return publicationErrorResponse(error);
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
    if (result.ok !== true || result.media_id !== mediaId) {
      return Response.json({ error: "O banco não confirmou a nova capa.", code: "MEDIA_COVER_NOT_CONFIRMED" }, { status: 502 });
    }
    return Response.json({ success: true, mediaId });
  }

  if (body.action === "reorderMedia") {
    const rawMediaIds = Array.isArray(body.mediaIds) ? body.mediaIds : [];
    const mediaIds = rawMediaIds
      .filter((mediaId): mediaId is string => typeof mediaId === "string" && UUID.test(mediaId));
    if (!mediaIds.length || mediaIds.length > 500 || mediaIds.length !== rawMediaIds.length || new Set(mediaIds).size !== mediaIds.length) {
      return Response.json({ error: "A ordem da galeria é inválida." }, { status: 400 });
    }
    const context = await editableMediaContext(mediaIds[0]);
    if ("error" in context) return context.error;
    if (!context.canEdit) return Response.json({ error: context.media.unidade_id ? "Você só pode ordenar as imagens da unidade que captou." : "Você só pode ordenar as imagens do produto que captou." }, { status: 403 });
    const { data, error } = await auth.supabase.rpc("produto_midias_reordenar", {
      p_empreendimento_id: id,
      p_unidade_id: context.media.unidade_id,
      p_ids: mediaIds,
    });
    if (error) return publicationErrorResponse(error);
    const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
    if (result.ok !== true || result.quantidade !== mediaIds.length) {
      return Response.json({ error: "O banco não confirmou a nova ordem da galeria.", code: "MEDIA_ORDER_NOT_CONFIRMED" }, { status: 502 });
    }
    return Response.json({ success: true, quantidade: mediaIds.length });
  }

  if (body.action === "updateMedia") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    const categoria = typeof body.category === "string" ? body.category.trim() : "";
    const hasAltText = Object.prototype.hasOwnProperty.call(body, "altText");
    const altText = typeof body.altText === "string" ? body.altText.trim() : null;
    if (!UUID.test(mediaId) || !categoria) return Response.json({ error: "Mídia ou classificação inválida." }, { status: 400 });
    if (altText != null && altText.length > 0 && altText.length < 3) return Response.json({ error: "A descrição acessível deve ter pelo menos 3 caracteres ou ficar vazia." }, { status: 422 });
    if (altText != null && altText.length > 160) return Response.json({ error: "A descrição acessível deve ter no máximo 160 caracteres." }, { status: 422 });
    const context = await editableMediaContext(mediaId);
    if ("error" in context) return context.error;
    if (!context.canEdit) return Response.json({ error: context.media.unidade_id ? "Você só pode editar as imagens da unidade que captou." : "Você só pode editar as imagens do produto que captou." }, { status: 403 });
    const mediaPatch = { categoria, ...(hasAltText ? { alt_text: altText || null } : {}) };
    const { data: updatedMedia, error: mediaUpdateError } = await auth.supabase.from("midias").update(mediaPatch).eq("id", mediaId).eq("empreendimento_id", id).select("id").maybeSingle();
    if (mediaUpdateError) return productTechnicalFailure("update_media", mediaUpdateError, "Não foi possível atualizar a classificação da mídia.");
    if (!updatedMedia) return Response.json({ error: "A classificação da mídia não foi confirmada.", code: "MEDIA_UPDATE_NOT_CONFIRMED" }, { status: 409 });
    return Response.json({ success: true });
  }

  if (body.action === "deleteMedia") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    if (!UUID.test(mediaId)) return Response.json({ error: "Mídia inválida." }, { status: 400 });
    const context = await editableMediaContext(mediaId);
    if ("error" in context) return context.error;
    if (!context.canEdit) return Response.json({ error: context.media.unidade_id ? "Você só pode excluir imagens da unidade que captou." : "Você só pode excluir imagens do produto que captou." }, { status: 403 });
    const { media } = context;
    const { data: deletedMedia, error: deleteError } = await auth.supabase.from("midias").delete().eq("id", mediaId).eq("empreendimento_id", id).select("id").maybeSingle();
    if (deleteError) return productTechnicalFailure("delete_media_metadata", deleteError, "Não foi possível excluir a mídia.");
    if (!deletedMedia) return Response.json({ error: "A exclusão da mídia não foi confirmada.", code: "MEDIA_DELETE_NOT_CONFIRMED" }, { status: 409 });
    const { error: storageError } = await auth.supabase.storage.from("empreendimentos").remove([media.storage_path]);
    let storageWarning = storageError ? "A mídia foi removida da ficha, mas o arquivo exige reconciliação do Storage." : null;
    if (storageError) console.error("[product-api]", { operation: "delete_media_storage", code: "STORAGE_CLEANUP_FAILED", mediaId, reconciliationRequired: true });
    if (media.is_capa && media.tipo === "foto") {
      let nextQuery = auth.supabase.from("midias").select("id").eq("empreendimento_id", id).eq("tipo", "foto");
      nextQuery = media.unidade_id ? nextQuery.eq("unidade_id", media.unidade_id) : nextQuery.is("unidade_id", null);
      const { data: nextPhoto, error: nextPhotoError } = await nextQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (nextPhotoError) {
        storageWarning = "A mídia foi excluída, mas a próxima capa exige reconciliação operacional.";
      } else if (nextPhoto) {
        const { data: coverData, error: coverError } = await auth.supabase.rpc("produto_midia_definir_capa", {
          p_empreendimento_id: id,
          p_unidade_id: media.unidade_id,
          p_media_id: nextPhoto.id,
        });
        const coverResult = coverData && typeof coverData === "object" && !Array.isArray(coverData) ? coverData as Record<string, unknown> : {};
        if (coverError || coverResult.ok !== true || coverResult.media_id !== nextPhoto.id) {
          storageWarning = "A mídia foi excluída, mas a próxima capa exige reconciliação operacional.";
        }
      }
    }
    return Response.json({
      success: true,
      storageCleanupPending: Boolean(storageWarning),
      warning: storageWarning,
      code: storageWarning ? "RECONCILIATION_REQUIRED" : undefined,
    });
  }

  if (body.action === "deleteProduct") {
    if (!gerenciaProdutos) return Response.json({ error: "Apenas a gestão de Produtos pode excluir produtos." }, { status: 403 });
    const deniedDelete = guard([["produtos", "excluir"]], "Você não tem permissão para excluir produtos.");
    if (deniedDelete) return deniedDelete;

    // A RPC faz autorização, trava os vínculos comerciais, audita e exclui o
    // banco em uma única transação. O Storage só é limpo depois do commit.
    const { data, error } = await auth.supabase.rpc("produto_excluir", { p_empreendimento_id: id });
    if (error) return publicationErrorResponse(error);
    const deletion = (data && typeof data === "object" ? data : {}) as {
      ok?: boolean;
      empreendimento_id?: string;
      nome?: string;
      midias_paths?: unknown;
      midias_total?: number;
      unidades_total?: number;
    };
    if (deletion.ok !== true || deletion.empreendimento_id !== id) {
      return Response.json({ error: "O banco não confirmou a exclusão do produto.", code: "PRODUCT_DELETE_NOT_CONFIRMED" }, { status: 502 });
    }
    const paths = Array.isArray(deletion.midias_paths)
      ? deletion.midias_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
      : [];
    let storageWarning: string | null = null;
    if (paths.length) {
      const { error: storageError } = await auth.supabase.storage.from("empreendimentos").remove(paths);
      if (storageError) {
        console.error("[product-api]", { operation: "delete_product_storage", code: "STORAGE_CLEANUP_FAILED", productId: id, reconciliationRequired: true });
        storageWarning = "O produto foi excluído, mas alguns arquivos exigem reconciliação do Storage.";
      }
    }
    return Response.json({
      success: true,
      deleted: true,
      product: { id: deletion.empreendimento_id, name: deletion.nome ?? null },
      removedMedia: storageWarning ? 0 : paths.length,
      storageCleanupPending: Boolean(storageWarning),
      warning: storageWarning,
      code: storageWarning ? "RECONCILIATION_REQUIRED" : undefined,
    });
  }

  // Bloco final = edição geral do produto (nome, dados, proprietário, condomínio).
  const deniedEdit = guard([["produtos", "editar"]], "Você não tem permissão para editar produtos.");
  if (deniedEdit) return deniedEdit;
  if (negadoPorCaptacao) return negadoPorCaptacao;
  const incoming = (body.product && typeof body.product === "object" ? body.product : {}) as Record<string, unknown>;
  const update: ProductUpdate = {};
  for (const field of productFields) {
    if (!Object.hasOwn(incoming, field)) continue;
    const rawValue = incoming[field];
    (update as Record<string, unknown>)[field] = (field === "lazer" || field === "diferenciais") && typeof rawValue === "string"
      ? rawValue.split(",").map((item) => item.trim()).filter(Boolean)
      : rawValue === "" ? null : rawValue;
  }
  if (!update.nome || typeof update.nome !== "string") return Response.json({ error: "Informe o nome do produto." }, { status: 400 });
  if (update.seo_titulo != null && (typeof update.seo_titulo !== "string" || update.seo_titulo.trim().length > 70)) {
    return Response.json({ error: "O título para busca deve ter no máximo 70 caracteres." }, { status: 422 });
  }
  if (update.seo_descricao != null && (typeof update.seo_descricao !== "string" || update.seo_descricao.trim().length > 180)) {
    return Response.json({ error: "A descrição para busca deve ter no máximo 180 caracteres." }, { status: 422 });
  }
  const nextProductDescription = typeof update.descricao === "string" ? update.descricao.trim() : (productContext.descricao || "").trim();
  if (gerenciaProdutos && productContext.publicado && nextProductDescription.length < 80) {
    return Response.json({ error: "Descrição comercial com pelo menos 80 caracteres.", code: "PRODUCT_DESCRIPTION_REQUIRED" }, { status: 422 });
  }
  if (update.preco !== null && update.preco !== undefined) {
    const priceCheck = validateProductPrice(update.preco, "Preço do imóvel", update.finalidade ?? currentPurpose);
    if (priceCheck.error) return Response.json({ error: priceCheck.error }, { status: 422 });
    update.preco = priceCheck.value;
  }
  if (!gerenciaProdutos && productContext?.publicado && productContext.aprovacao === "aprovado") {
    update.publicado = false;
    update.aprovacao = "pendente";
    update.rascunho = false;
    update.reprovacao_motivo = null;
  }

  type PreparedUnit = { unitId: string | null; row: { numero: string; tipologia: string; area_m2: number; vagas: number; valor_tabela: number; valor_promo: number | null; disponivel: boolean } };
  let preparedUnits: PreparedUnit[] | null = null;
  let constructorUnitIdsToRemove: string[] = [];
  if (Array.isArray(body.units)) {
    const { data: existingUnits, error: unitsReadError } = await auth.supabase.from("unidades").select("id,de_terceiros").eq("empreendimento_id", id);
    if (unitsReadError) return productTechnicalFailure("read_constructor_units", unitsReadError);
    const constructorIds = new Set((existingUnits ?? []).filter((item) => !item.de_terceiros).map((item) => item.id));
    const indicationIds = new Set((existingUnits ?? []).filter((item) => item.de_terceiros).map((item) => item.id));
    const incomingUnits = body.units as Array<Record<string, unknown>>;
    preparedUnits = [];
    for (const item of incomingUnits) {
      const rawId = typeof item.id === "string" ? item.id : null;
      if (rawId && indicationIds.has(rawId)) return Response.json({ error: "Indicações de corretores devem ser editadas pela ficha da própria unidade." }, { status: 422 });
      const numero = typeof item.numero === "string" ? item.numero.trim() : "";
      const tipologia = typeof item.tipologia === "string" ? item.tipologia.trim() : "";
      const area = Number(item.area_m2);
      const vagas = item.vagas === "" || item.vagas == null ? 0 : Number(item.vagas);
      const tableValue = Number(item.valor_tabela);
      const promoValue = item.valor_promo === "" || item.valor_promo == null ? null : Number(item.valor_promo);
      if (!numero || !tipologia || !Number.isFinite(area) || area <= 0 || !Number.isFinite(vagas) || vagas < 0) return Response.json({ error: "Preencha número, tipologia, área e vagas de todas as unidades da construtora." }, { status: 422 });
      if (!Number.isFinite(tableValue)) return Response.json({ error: `Informe o valor de tabela da unidade ${numero}.` }, { status: 422 });
      const tableCheck = validateProductPrice(tableValue, `Valor de tabela da unidade ${numero}`, update.finalidade ?? currentPurpose);
      if (tableCheck.error) return Response.json({ error: tableCheck.error }, { status: 422 });
      if (promoValue != null) {
        if (!Number.isFinite(promoValue)) return Response.json({ error: `Valor promocional inválido na unidade ${numero}.` }, { status: 422 });
        const promoCheck = validateProductPrice(promoValue, `Valor promocional da unidade ${numero}`, update.finalidade ?? currentPurpose);
        if (promoCheck.error) return Response.json({ error: promoCheck.error }, { status: 422 });
      }
      preparedUnits.push({ unitId: rawId && constructorIds.has(rawId) ? rawId : null, row: { numero, tipologia, area_m2: area, vagas, valor_tabela: tableCheck.value!, valor_promo: promoValue, disponivel: item.disponivel !== false } });
    }
    const keptIds = new Set(preparedUnits.map((item) => item.unitId).filter((value): value is string => Boolean(value)));
    constructorUnitIdsToRemove = [...constructorIds].filter((unitId) => !keptIds.has(unitId));
  }

  let preparedOwner: { nome: string; email: string; telefone: string } | null = null;
  if (body.owner && typeof body.owner === "object") {
    const ownerInput = body.owner as Record<string, unknown>;
    const nome = typeof ownerInput.nome === "string" ? ownerInput.nome.trim() : "";
    const email = typeof ownerInput.email === "string" ? ownerInput.email.trim().toLowerCase() : "";
    const telefone = typeof ownerInput.telefone === "string" ? ownerInput.telefone.trim() : "";
    if (nome || email || telefone) {
      if (!nome || !email || !telefone) return Response.json({ error: "Preencha nome, e-mail e telefone do proprietário." }, { status: 422 });
      preparedOwner = { nome, email, telefone };
    }
  }

  type PreparedCondominium = {
    id: string | null;
    row: { nome: string; endereco: string; cidade: string; created_by: string; numero: string | null; bairro: string | null; uf: string; cep: string | null } | null;
  };
  let preparedCondominium: PreparedCondominium | null = null;
  if (body.condominium && typeof body.condominium === "object") {
    const input = body.condominium as Record<string, unknown>;
    const condominiumId = typeof input.id === "string" && UUID.test(input.id) ? input.id : null;
    if (condominiumId) {
      preparedCondominium = { id: condominiumId, row: null };
    } else {
      const nome = typeof input.nome === "string" ? input.nome.trim() : "";
      const endereco = typeof input.endereco === "string" ? input.endereco.trim() : "";
      const cidade = typeof input.cidade === "string" ? input.cidade.trim() : "";
      if (!nome || !endereco || !cidade) return Response.json({ error: "Preencha nome, endereço e cidade do condomínio." }, { status: 422 });
      preparedCondominium = { id: null, row: {
        nome, endereco, cidade, created_by: auth.user.id,
        numero: typeof input.numero === "string" ? input.numero.trim() || null : null,
        bairro: typeof input.bairro === "string" ? input.bairro.trim() || null : null,
        uf: typeof input.uf === "string" ? input.uf.trim().toUpperCase() || "SP" : "SP",
        cep: typeof input.cep === "string" ? input.cep.trim() || null : null,
      } };
    }
  }

  const { data: updatedProduct, error: productUpdateError } = await auth.supabase.from("empreendimentos").update(update).eq("id", id).select("id").maybeSingle();
  if (productUpdateError) return productTechnicalFailure("update_product", productUpdateError, "Não foi possível atualizar o imóvel.");
  if (!updatedProduct) return Response.json({ error: "A atualização do imóvel não foi confirmada.", code: "PRODUCT_UPDATE_NOT_CONFIRMED" }, { status: 409 });

  if (preparedOwner) {
    const { error: ownerError } = await auth.supabase.rpc("produto_proprietario_salvar", {
      p_empreendimento_id: id,
      p_nome: preparedOwner.nome,
      p_email: preparedOwner.email,
      p_telefone: preparedOwner.telefone,
    });
    if (ownerError) return reconciliationRequired("save_product_owner", ownerError);
  }

  if (preparedCondominium) {
    let condominiumId = preparedCondominium.id;
    if (!condominiumId && preparedCondominium.row) {
      const { data: created, error: condominiumError } = await auth.supabase.from("condominios").insert(preparedCondominium.row).select("id").maybeSingle();
      if (condominiumError || !created) return reconciliationRequired("create_product_condominium", condominiumError ?? undefined);
      condominiumId = created.id;
    }
    const { data: linkedProduct, error: linkError } = await auth.supabase.from("empreendimentos").update({ condominio_id: condominiumId }).eq("id", id).select("id").maybeSingle();
    if (linkError || !linkedProduct) return reconciliationRequired("link_product_condominium", linkError ?? undefined);
  }

  if (preparedUnits) {
    if (constructorUnitIdsToRemove.length) {
      const { data: deletedUnits, error: deleteError } = await auth.supabase.from("unidades").delete().eq("empreendimento_id", id).eq("de_terceiros", false).in("id", constructorUnitIdsToRemove).select("id");
      if (deleteError || (deletedUnits?.length ?? 0) !== constructorUnitIdsToRemove.length) return reconciliationRequired("delete_constructor_units", deleteError ?? undefined);
    }
    for (const item of preparedUnits) {
      const unitResult = item.unitId
        ? await auth.supabase.from("unidades").update(item.row as never).eq("id", item.unitId).eq("empreendimento_id", id).eq("de_terceiros", false).select("id").maybeSingle()
        : await auth.supabase.from("unidades").insert({ ...item.row, empreendimento_id: id, de_terceiros: false, aprovacao: "aprovado" } as never).select("id").maybeSingle();
      if (unitResult.error || !unitResult.data) return reconciliationRequired("save_constructor_unit", unitResult.error ?? undefined);
    }
  }
  return Response.json({ success: true });
}
