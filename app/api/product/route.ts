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

export const dynamic = "force-dynamic";

type ProductUpdate = Database["public"]["Tables"]["empreendimentos"]["Update"];
type OwnerUpdate = Database["public"]["Tables"]["proprietarios"]["Update"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLICATION_RULE_CODES = new Set([
  "PRODUCT_NOT_READY",
  "UNIT_NOT_READY",
  "PRODUCT_PUBLICATION_INVALID",
  "UNIT_PRICE_INVALID",
  "UNIT_PROMO_PRICE_INVALID",
  "UNIT_PROMO_ABOVE_LIST",
  "INVALID_PRODUCT",
  "INVALID_UNIT",
  "INVALID_PRICE",
]);

function publicationErrorResponse(error: { code?: string; message?: string }) {
  const raw = error.message?.trim() || "Não foi possível atualizar a publicação do imóvel.";
  const match = raw.match(/^([A-Z][A-Z0-9_]+):\s*([\s\S]+)$/);
  const businessCode = match?.[1] ?? (error.code === "P0001" ? "PUBLICATION_RULE" : "PUBLICATION_FAILED");
  const message = match?.[2] ?? raw;
  const normalized = raw.toLowerCase();
  const status = businessCode.endsWith("FORBIDDEN") || error.code === "42501" || normalized.includes("sem permissão") || normalized.includes("nao autorizado")
    ? 403
    : businessCode.endsWith("NOT_FOUND") || normalized.includes("não encontrado") || normalized.includes("nao encontrado")
      ? 404
      : businessCode === "PRODUCT_HAS_LINKS"
        ? 409
      : PUBLICATION_RULE_CODES.has(businessCode) || error.code === "P0001"
        ? 422
        : 502;
  return Response.json({ error: message, code: businessCode }, { status });
}
const productFields = [
  "nome", "titulo", "slogan", "finalidade", "lazer", "diferenciais", "incorporadora", "descricao", "status", "preco", "condominio_valor", "iptu",
  "outros_custos", "area_util", "dormitorios", "suites", "vagas", "banheiros", "endereco",
  "numero", "complemento", "bairro", "cidade", "uf", "cep", "acesso_tipo", "acesso_codigo",
  "acesso_instrucoes", "tour_url",
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
      proprietarios (*),
      unidades (*),
      midias (id, tipo, storage_path, categoria, nome, is_capa, created_at, unidade_id)
    `)
    .eq("id", id)
    .single();

  if (error) return Response.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 502 });
  const media = (data.midias ?? []).map((item) => ({ ...item, url: publicMediaUrl(item.storage_path) }));
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
  const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
  let leadsQuery = auth.supabase.from("leads").select("id,nome,telefone,corretor_id").order("atualizado_em", { ascending: false }).limit(100);
  if (broker?.id) leadsQuery = leadsQuery.eq("corretor_id", broker.id);
  const [{ data: favorite }, { data: links }, { data: leadOptions }] = await Promise.all([
    auth.supabase.from("produto_favoritos").select("empreendimento_id").eq("empreendimento_id", id).eq("usuario_id", auth.user.id).maybeSingle(),
    auth.supabase.from("lead_produtos").select("lead_id").eq("empreendimento_id", id),
    leadsQuery,
  ]);
  const linkedIds = new Set((links ?? []).map((item) => item.lead_id));
  const { data: corretoresList } = await auth.supabase.from("corretores").select("id,nome");
  const corretorNameById = new Map((corretoresList ?? []).map((c) => [c.id, c.nome]));
  const captadorCorretorId = (data as { captador_corretor_id?: number | null }).captador_corretor_id ?? null;
  const capturedByName: string | null = captadorCorretorId ? (corretorNameById.get(captadorCorretorId) ?? null) : null;
  const unidadesEnriched = (data.unidades ?? []).map((u) => ({ ...u, captador_nome: corretorNameById.get((u as { captador_corretor_id?: number | null }).captador_corretor_id ?? -1) ?? null }));
  const mine = (data as { captado_por_usuario?: string | null }).captado_por_usuario === auth.user.id;
  const { data: meuPerfilGet } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  const gerenciaProdutosGet = isProductManagerRole((meuPerfilGet as { role?: string } | null)?.role);
  const podeEditar = gerenciaProdutosGet || mine;
  // Todos os corretores autenticados podem consultar a ficha operacional completa.
  // Somente os dados do proprietário continuam restritos a captador e gestão.
  const unidadesVisiveis = unidadesEnriched.map((u) => {
    const unidadeMinha = Boolean(broker?.id && (u as { captador_corretor_id?: number | null }).captador_corretor_id === broker.id);
    const podeEditarUnidade = gerenciaProdutosGet || unidadeMinha;
    return podeEditarUnidade
      ? { ...u, mine: unidadeMinha, pode_editar: true }
      : { ...u, mine: false, pode_editar: false, proprietario_nome: null, proprietario_contato: null };
  });
  const checks: Record<string, boolean> = {
    basics: Boolean(data.nome && (data.preco || unitPrices.length) && (data.area_util || unitAreas.length)),
    location: Boolean(data.endereco && data.bairro && data.cidade),
    costs: data.condominio_valor !== null && data.iptu !== null && data.outros_custos !== null,
    media: photoCount >= 10 && videoCount >= 1 && media.some((item) => item.tipo === "foto" && item.is_capa),
    units: data.origem === "terceiros" || units.length > 0,
  };
  if (data.origem === "terceiros") {
    checks.owner = Boolean(data.proprietario_id || (data.proprietario_nome && data.proprietario_tel && data.proprietario_email));
    checks.access = Boolean(data.acesso_tipo && data.acesso_instrucoes && (data.acesso_tipo !== "chave_digital" || data.acesso_codigo));
  }
  const sitePublished = isProductPublishedOnSite({
    published: data.publicado,
    draft: data.rascunho,
    approval: data.aprovacao,
    status: data.status,
    availableApprovedUnits: publishedAvailableUnits.length,
  });
  return Response.json({ product: { ...data, ...(podeEditar ? {} : { proprietarios: null, proprietario_nome: null, proprietario_tel: null, proprietario_email: null }), site_published: sitePublished, midias: media, unidades: unidadesVisiveis, captado_por_nome: capturedByName, mine, pode_editar: podeEditar, summary_price: summaryPrice, summary_area: summaryArea, is_favorite: Boolean(favorite), leads: (leadOptions ?? []).map((lead) => ({ ...lead, linked: linkedIds.has(lead.id) })), quality, completion: { checks, completed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length } } });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID.test(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
  const authenticatedSupabase = auth.supabase;
  const authenticatedUserId = auth.user.id;
  const { data: productContext } = await auth.supabase.from("empreendimentos").select("nome, finalidade, origem, condominio_id, captado_por_usuario, aprovacao, publicado, rascunho").eq("id", id).maybeSingle();
  const currentPurpose = productContext?.finalidade ?? "venda";
  const { data: meuPerfilPatch } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  const gerenciaProdutos = isProductManagerRole((meuPerfilPatch as { role?: string } | null)?.role);
  const souCaptador = (productContext as { captado_por_usuario?: string | null } | null)?.captado_por_usuario === auth.user.id;
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
    if (error) return { error: Response.json({ error: error.message }, { status: 502 }) } as const;
    if (!media) return { error: Response.json({ error: "Mídia não encontrada." }, { status: 404 }) } as const;
    if (!media.unidade_id) {
      return { media, canEdit: gerenciaProdutos || souCaptador } as const;
    }
    const [{ data: unit }, { data: broker }] = await Promise.all([
      authenticatedSupabase.from("unidades").select("captador_corretor_id,de_terceiros").eq("id", media.unidade_id).eq("empreendimento_id", id).maybeSingle(),
      authenticatedSupabase.from("corretores").select("id").eq("usuario_id", authenticatedUserId).maybeSingle(),
    ]);
    const ownsUnit = Boolean(unit?.de_terceiros && broker?.id != null && unit.captador_corretor_id === broker.id);
    return { media, canEdit: gerenciaProdutos || ownsUnit } as const;
  }

  if (body.action === "publishUnit" || body.action === "unpublishUnit") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role ?? "corretor";
    if (!isProductManagerRole(role)) return Response.json({ error: "Apenas a gestão de Produtos pode publicar ou retirar imóveis do site." }, { status: 403 });
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const { data: unit, error: unitReadError } = await auth.supabase
      .from("unidades")
      .select("id,numero,codigo,publicado,disponivel,aprovacao")
      .eq("id", unidadeId)
      .eq("empreendimento_id", id)
      .maybeSingle();
    if (unitReadError) return Response.json({ error: unitReadError.message }, { status: 502 });
    if (!unit) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });
    const publish = body.action === "publishUnit";
    if (publish && unit.aprovacao !== "aprovado") return Response.json({ error: "A unidade precisa estar aprovada antes de voltar ao site." }, { status: 422 });
    if (publish && !unit.disponivel) return Response.json({ error: "A unidade está indisponível. Marque-a como disponível antes de publicar." }, { status: 422 });
    if (publish && productContext?.aprovacao !== "aprovado") return Response.json({ error: "O cadastro do empreendimento de referência precisa estar aprovado." }, { status: 422 });
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

    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    if (!broker?.id && !gerenciaProdutos) return Response.json({ error: "Seu usuário ainda não está vinculado a um corretor ativo." }, { status: 422 });
    const unitRow = {
      empreendimento_id: id, de_terceiros: true, aprovacao: "pendente", disponivel: true,
      captador_corretor_id: broker?.id ?? null,
      numero,
      tipologia,
      area_m2: area,
      vagas: asNumber(input.vagas),
      valor_tabela: tablePriceCheck.value,
      valor_promo: promoPrice,
      proprietario_nome: proprietarioNome,
      proprietario_contato: proprietarioContato,
      acesso_tipo: acessoTipo,
      acesso_codigo: acessoCodigo,
      acesso_instrucoes: acessoInstrucoes,
    };
    const { data: novaUnidade, error } = await auth.supabase.from("unidades").insert(unitRow as never).select("id").single();
    if (error) {
      const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
      if (error.code === "23505" || text.includes("unique") || text.includes("uq_unidade_indicacao_por_predio")) {
        return Response.json({ error: "Esta unidade já foi cadastrada neste prédio." }, { status: 409 });
      }
      return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json({ unidadeId: novaUnidade.id, userId: auth.user.id });
  }

  if (body.action === "updateUnit") {
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
    const { data: currentUnit, error: currentUnitError } = await auth.supabase.from("unidades").select("id,captador_corretor_id,de_terceiros,aprovacao").eq("id", unidadeId).eq("empreendimento_id", id).maybeSingle();
    if (currentUnitError) return Response.json({ error: currentUnitError.message }, { status: 502 });
    if (!currentUnit) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });
    const ownsUnit = broker?.id != null && currentUnit.captador_corretor_id === broker.id;
    if (!gerenciaProdutos && (!currentUnit.de_terceiros || !ownsUnit)) return Response.json({ error: "Você só pode editar a unidade que captou." }, { status: 403 });
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
    if (!numero || !tipologia || area == null || area <= 0) return Response.json({ error: "Informe número, tipologia e área útil da unidade." }, { status: 422 });
    if (valorTabela == null) return Response.json({ error: "Informe o valor de tabela da unidade." }, { status: 422 });
    const tablePriceCheck = validateProductPrice(valorTabela, "Valor de tabela", currentPurpose);
    if (tablePriceCheck.error) return Response.json({ error: tablePriceCheck.error }, { status: 422 });
    if (valorPromo != null) {
      const promoCheck = validateProductPrice(valorPromo, "Valor promocional", currentPurpose);
      if (promoCheck.error) return Response.json({ error: promoCheck.error }, { status: 422 });
    }
    if (!proprietarioNome || !proprietarioContato) return Response.json({ error: "Informe nome e contato do proprietário." }, { status: 422 });
    if (!acessoTipo || !acessoInstrucoes) return Response.json({ error: "Informe o tipo e as instruções de acesso." }, { status: 422 });
    if (acessoTipo === "chave_digital" && !acessoCodigo) return Response.json({ error: "Informe o código da chave digital." }, { status: 422 });
    const patch = {
      numero, tipologia, area_m2: area, vagas: asNumber(input.vagas),
      valor_tabela: tablePriceCheck.value, valor_promo: valorPromo,
      disponivel: input.disponivel !== false,
      proprietario_nome: proprietarioNome, proprietario_contato: proprietarioContato,
      acesso_tipo: acessoTipo, acesso_codigo: acessoCodigo, acesso_instrucoes: acessoInstrucoes,
      ...(gerenciaProdutos ? {} : { aprovacao: "pendente", reprovacao_motivo: null }),
    };
    const { error } = await auth.supabase.from("unidades").update(patch as never).eq("id", unidadeId).eq("empreendimento_id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, approval: gerenciaProdutos ? currentUnit.aprovacao : "pendente" });
  }

  if (body.action === "decideUnit") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role ?? "corretor";
    if (!isProductManagerRole(role)) return Response.json({ error: "Apenas a gestão de Produtos pode aprovar unidades." }, { status: 403 });
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const approve = body.approve === true;
    if (approve) {
      const [{ data: unitToApprove, error: unitReadError }, mediaCount] = await Promise.all([
        auth.supabase.from("unidades").select("numero,tipologia,area_m2,valor_tabela,valor_promo,proprietario_nome,proprietario_contato,acesso_tipo,acesso_codigo,acesso_instrucoes").eq("id", unidadeId).eq("empreendimento_id", id).maybeSingle(),
        auth.supabase.from("midias").select("id", { count: "exact", head: true }).eq("unidade_id", unidadeId).eq("tipo", "foto"),
      ]);
      if (unitReadError || !unitToApprove) return Response.json({ error: unitReadError?.message ?? "Unidade não encontrada." }, { status: 404 });
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
      if (!unitToApprove.proprietario_nome || !unitToApprove.proprietario_contato) blocking.push("Proprietário e contato");
      if (!unitToApprove.acesso_tipo || !unitToApprove.acesso_instrucoes || (unitToApprove.acesso_tipo === "chave_digital" && !unitToApprove.acesso_codigo)) blocking.push("Instruções de acesso");
      if ((mediaCount.count ?? 0) < 1) blocking.push("Ao menos uma foto da unidade");
      if (blocking.length) return Response.json({ error: `Complete a unidade antes de aprovar: ${blocking.join("; ")}.`, code: "UNIT_NOT_READY", blocking }, { status: 422 });
      const result = await definePublication(true, unidadeId);
      if ("response" in result) return result.response;
      return Response.json({ success: true, aprovacao: "aprovado", publicado: true, publication: result.publication });
    }
    const patch = { aprovacao: "reprovado", publicado: false, reprovacao_motivo: typeof body.motivo === "string" ? body.motivo.slice(0, 300) : null };
    const { error } = await auth.supabase.from("unidades").update(patch as never).eq("id", unidadeId).eq("empreendimento_id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ success: true, aprovacao: patch.aprovacao });
  }

  if (body.action === "toggleFavorite") {
    const favorite = body.favorite === true;
    const result = favorite
      ? await auth.supabase.from("produto_favoritos").insert({ empreendimento_id: id, usuario_id: auth.user.id })
      : await auth.supabase.from("produto_favoritos").delete().eq("empreendimento_id", id).eq("usuario_id", auth.user.id);
    return result.error ? Response.json({ error: result.error.message }, { status: 502 }) : Response.json({ success: true, favorite });
  }

  if (body.action === "linkLead" || body.action === "unlinkLead") {
    const leadId = Number(body.leadId);
    if (!Number.isSafeInteger(leadId) || leadId <= 0) return Response.json({ error: "Lead inválido." }, { status: 400 });
    const denied = guard([["produtos", "editar"], ["leads", "editar"]], "Você não tem permissão para vincular leads a produtos.");
    if (denied) return denied;
    const result = body.action === "linkLead"
      ? await auth.supabase.from("lead_produtos").insert({ lead_id: leadId, empreendimento_id: id, vinculado_por: auth.user.id })
      : await auth.supabase.from("lead_produtos").delete().eq("lead_id", leadId).eq("empreendimento_id", id);
    return result.error ? Response.json({ error: result.error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "publish" || body.action === "unpublish" || body.action === "solicitar") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role ?? "corretor";
    const isApprover = isProductManagerRole(role);

    // Corretor (dono) envia solicitação: vira pendente, NÃO vai pro ar. Passa pela alçada de aprovação.
    if (body.action === "solicitar") {
      const { data: prod } = await auth.supabase.from("empreendimentos").select("captado_por_usuario, captador_corretor_id").eq("id", id).maybeSingle();
      const { data: broker } = await auth.supabase.from("corretores").select("id").eq("usuario_id", auth.user.id).maybeSingle();
      const owns = (prod?.captado_por_usuario != null && prod.captado_por_usuario === auth.user.id)
        || (broker?.id != null && prod?.captador_corretor_id === broker.id);
      if (!owns && !isApprover) return Response.json({ error: "Você só pode enviar solicitação de um produto que você captou." }, { status: 403 });
      const { error } = await auth.supabase.from("empreendimentos").update({ rascunho: false, aprovacao: "pendente", reprovacao_motivo: null }).eq("id", id);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, aprovacao: "pendente" });
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
    if (readError || !productToPublish) return Response.json({ error: readError?.message ?? "Produto não encontrado." }, { status: 502 });
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
    let clearQuery = auth.supabase.from("midias").update({ is_capa: false }).eq("empreendimento_id", id).eq("tipo", "foto");
    clearQuery = context.media.unidade_id ? clearQuery.eq("unidade_id", context.media.unidade_id) : clearQuery.is("unidade_id", null);
    const { error: clearError } = await clearQuery;
    if (clearError) return Response.json({ error: clearError.message }, { status: 502 });
    const { error } = await auth.supabase.from("midias").update({ is_capa: true }).eq("id", mediaId).eq("empreendimento_id", id).eq("tipo", "foto");
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "updateMedia") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    const categoria = typeof body.category === "string" ? body.category.trim() : "";
    if (!UUID.test(mediaId) || !categoria) return Response.json({ error: "Mídia ou classificação inválida." }, { status: 400 });
    const context = await editableMediaContext(mediaId);
    if ("error" in context) return context.error;
    if (!context.canEdit) return Response.json({ error: context.media.unidade_id ? "Você só pode editar as imagens da unidade que captou." : "Você só pode editar as imagens do produto que captou." }, { status: 403 });
    const { error } = await auth.supabase.from("midias").update({ categoria }).eq("id", mediaId).eq("empreendimento_id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "deleteMedia") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    if (!UUID.test(mediaId)) return Response.json({ error: "Mídia inválida." }, { status: 400 });
    const context = await editableMediaContext(mediaId);
    if ("error" in context) return context.error;
    if (!context.canEdit) return Response.json({ error: context.media.unidade_id ? "Você só pode excluir imagens da unidade que captou." : "Você só pode excluir imagens do produto que captou." }, { status: 403 });
    const { media } = context;
    const { error: storageError } = await auth.supabase.storage.from("empreendimentos").remove([media.storage_path]);
    if (storageError) return Response.json({ error: `Não foi possível excluir o arquivo: ${storageError.message}` }, { status: 502 });
    const { error: deleteError } = await auth.supabase.from("midias").delete().eq("id", mediaId).eq("empreendimento_id", id);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 502 });
    if (media.is_capa && media.tipo === "foto") {
      let nextQuery = auth.supabase.from("midias").select("id").eq("empreendimento_id", id).eq("tipo", "foto");
      nextQuery = media.unidade_id ? nextQuery.eq("unidade_id", media.unidade_id) : nextQuery.is("unidade_id", null);
      const { data: nextPhoto } = await nextQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (nextPhoto) await auth.supabase.from("midias").update({ is_capa: true }).eq("id", nextPhoto.id);
    }
    return Response.json({ success: true });
  }

  if (body.action === "deleteProduct") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role ?? "corretor";
    if (!isProductManagerRole(role)) return Response.json({ error: "Apenas a gestão de Produtos pode excluir produtos." }, { status: 403 });
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
      if (storageError) storageWarning = "O produto foi excluído, mas alguns arquivos de mídia aguardam limpeza automática.";
    }
    return Response.json({
      success: true,
      deleted: true,
      product: { id: deletion.empreendimento_id, name: deletion.nome ?? null },
      removedMedia: storageWarning ? 0 : paths.length,
      storageCleanupPending: Boolean(storageWarning),
      warning: storageWarning,
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
    if (unitsReadError) return Response.json({ error: unitsReadError.message }, { status: 502 });
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

  const { error } = await auth.supabase.from("empreendimentos").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  if (body.owner && typeof body.owner === "object") {
    const { data: product } = await auth.supabase.from("empreendimentos").select("proprietario_id").eq("id", id).single();
    if (product?.proprietario_id) {
      const ownerInput = body.owner as Record<string, unknown>;
      const owner: OwnerUpdate = {};
      for (const field of ["nome", "email", "telefone"] as const) {
        if (typeof ownerInput[field] === "string") owner[field] = ownerInput[field];
      }
      const { error: ownerError } = await auth.supabase.from("proprietarios").update(owner).eq("id", product.proprietario_id);
      if (ownerError) return Response.json({ error: ownerError.message }, { status: 502 });
      await auth.supabase.from("empreendimentos").update({ proprietario_nome: owner.nome ?? null, proprietario_email: owner.email ?? null, proprietario_tel: owner.telefone ?? null }).eq("id", id);
    } else {
      const ownerInput = body.owner as Record<string, unknown>;
      const nome = typeof ownerInput.nome === "string" ? ownerInput.nome.trim() : "";
      const email = typeof ownerInput.email === "string" ? ownerInput.email.trim().toLowerCase() : "";
      const telefone = typeof ownerInput.telefone === "string" ? ownerInput.telefone.trim() : "";
      if (nome || email || telefone) {
        if (!nome || !email || !telefone) return Response.json({ error: "Preencha nome, e-mail e telefone do proprietário." }, { status: 422 });
        const { data: createdOwner, error: ownerError } = await auth.supabase.from("proprietarios").insert({ nome, email, telefone, created_by: auth.user.id }).select("id").single();
        if (ownerError) return Response.json({ error: ownerError.message }, { status: 502 });
        const { error: linkError } = await auth.supabase.from("empreendimentos").update({ proprietario_id: createdOwner.id, proprietario_nome: nome, proprietario_email: email, proprietario_tel: telefone }).eq("id", id);
        if (linkError) return Response.json({ error: linkError.message }, { status: 502 });
      }
    }
  }

  if (body.condominium && typeof body.condominium === "object") {
    const input = body.condominium as Record<string, unknown>;
    let condominiumId = typeof input.id === "string" && UUID.test(input.id) ? input.id : null;
    if (!condominiumId) {
      const nome = typeof input.nome === "string" ? input.nome.trim() : "";
      const endereco = typeof input.endereco === "string" ? input.endereco.trim() : "";
      const cidade = typeof input.cidade === "string" ? input.cidade.trim() : "";
      if (!nome || !endereco || !cidade) return Response.json({ error: "Preencha nome, endereço e cidade do condomínio." }, { status: 422 });
      const { data: created, error: condominiumError } = await auth.supabase.from("condominios").insert({
        nome, endereco, cidade, created_by: auth.user.id,
        numero: typeof input.numero === "string" ? input.numero.trim() || null : null,
        bairro: typeof input.bairro === "string" ? input.bairro.trim() || null : null,
        uf: typeof input.uf === "string" ? input.uf.trim().toUpperCase() || "SP" : "SP",
        cep: typeof input.cep === "string" ? input.cep.trim() || null : null,
      }).select("id").single();
      if (condominiumError) return Response.json({ error: condominiumError.message }, { status: 502 });
      condominiumId = created.id;
    }
    const { error: linkError } = await auth.supabase.from("empreendimentos").update({ condominio_id: condominiumId }).eq("id", id);
    if (linkError) return Response.json({ error: linkError.message }, { status: 502 });
  }

  if (preparedUnits) {
    if (constructorUnitIdsToRemove.length) {
      const { error: deleteError } = await auth.supabase.from("unidades").delete().eq("empreendimento_id", id).eq("de_terceiros", false).in("id", constructorUnitIdsToRemove);
      if (deleteError) return Response.json({ error: deleteError.message }, { status: 502 });
    }
    for (const item of preparedUnits) {
      const unitResult = item.unitId
        ? await auth.supabase.from("unidades").update(item.row as never).eq("id", item.unitId).eq("empreendimento_id", id).eq("de_terceiros", false)
        : await auth.supabase.from("unidades").insert({ ...item.row, empreendimento_id: id, de_terceiros: false, aprovacao: "aprovado" } as never);
      if (unitResult.error) return Response.json({ error: unitResult.error.message }, { status: 502 });
    }
  }
  return Response.json({ success: true });
}
