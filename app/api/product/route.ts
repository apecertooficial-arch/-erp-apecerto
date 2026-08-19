import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { Database } from "../../lib/supabase/database.types";
import { resolveEffectiveAccess, denyIfCannot } from "../../lib/supabase/authz";
import { assessProductQuality, isPlausibleProductPrice, validateProductPrice } from "../../features/products/quality";

export const dynamic = "force-dynamic";

type ProductUpdate = Database["public"]["Tables"]["empreendimentos"]["Update"];
type OwnerUpdate = Database["public"]["Tables"]["proprietarios"]["Update"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  const units = data.unidades ?? [];
  const availableUnits = units.filter((item) => item.disponivel);
  const unitPrices = availableUnits.map((item) => item.valor_promo ?? item.valor_tabela).filter((value): value is number => typeof value === "number" && value > 0);
  const unitAreas = availableUnits.map((item) => item.area_m2).filter((value): value is number => typeof value === "number" && value > 0);
  const photoCount = media.filter((item) => item.tipo === "foto").length;
  const videoCount = media.filter((item) => item.tipo === "video").length;
  const summaryPrice = data.preco ?? (unitPrices.length ? Math.min(...unitPrices) : null);
  const summaryArea = data.area_util ?? (unitAreas.length ? Math.min(...unitAreas) : null);
  const quality = assessProductQuality({
    name: data.nome, title: data.titulo, slogan: data.slogan, description: data.descricao, purpose: data.finalidade,
    price: summaryPrice, area: summaryArea, bedrooms: data.dormitorios, bathrooms: data.banheiros, parking: data.vagas,
    address: data.endereco, number: data.numero, neighborhood: data.bairro, city: data.cidade, state: data.uf, zip: data.cep,
    condominiumFee: data.condominio_valor, propertyTax: data.iptu, otherCosts: data.outros_custos,
    photos: photoCount, videos: videoCount, hasCover: media.some((item) => item.tipo === "foto" && item.is_capa),
    mediaCategories: media.filter((item) => item.tipo === "foto").map((item) => item.categoria ?? ""), tourUrl: data.tour_url,
    units: units.length, availableUnits: availableUnits.length,
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
  const gerenciaProdutosGet = ["admin", "gestor", "executivo"].includes((meuPerfilGet as { role?: string } | null)?.role ?? "corretor");
  const podeEditar = gerenciaProdutosGet || mine;
  // Dado de proprietário é restrito: corretor só vê o que ele mesmo captou (produto e unidade).
  const unidadesVisiveis = unidadesEnriched.map((u) => (gerenciaProdutosGet || (broker?.id && (u as { captador_corretor_id?: number | null }).captador_corretor_id === broker.id)) ? u : { ...u, proprietario_nome: null, proprietario_contato: null });
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
  return Response.json({ product: { ...data, ...(podeEditar ? {} : { proprietarios: null, proprietario_nome: null, proprietario_tel: null, proprietario_email: null }), site_published: Boolean(data.publicado && !data.rascunho && data.aprovacao === "aprovado"), midias: media, unidades: unidadesVisiveis, captado_por_nome: capturedByName, mine, pode_editar: podeEditar, summary_price: summaryPrice, summary_area: summaryArea, is_favorite: Boolean(favorite), leads: (leadOptions ?? []).map((lead) => ({ ...lead, linked: linkedIds.has(lead.id) })), quality, completion: { checks, completed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length } } });
}

export async function PATCH(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID.test(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
  const { data: productContext } = await auth.supabase.from("empreendimentos").select("finalidade, captado_por_usuario").eq("id", id).maybeSingle();
  const currentPurpose = productContext?.finalidade ?? "venda";
  const { data: meuPerfilPatch } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
  const gerenciaProdutos = ["admin", "gestor", "executivo"].includes((meuPerfilPatch as { role?: string } | null)?.role ?? "corretor");
  const souCaptador = (productContext as { captado_por_usuario?: string | null } | null)?.captado_por_usuario === auth.user.id;
  const negadoPorCaptacao = !gerenciaProdutos && !souCaptador ? Response.json({ error: "Você só pode editar imóveis captados por você." }, { status: 403 }) : null;

  // Acesso efetivo resolvido uma vez; admin passa e, sem mapa, libera (RLS é a trava dura).
  // Aprovação/publicação continuam por role logo abaixo (decideUnit/publish).
  const access = await resolveEffectiveAccess(auth.supabase, auth.user.id);
  const guard = (pairs: Array<[string, string]>, msg: string) => denyIfCannot(access, pairs, msg);

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
    const unitRow = {
      empreendimento_id: id, de_terceiros: true, aprovacao: "pendente", disponivel: true,
      captador_corretor_id: broker?.id ?? null,
      numero,
      tipologia: asString(input.tipologia),
      area_m2: asNumber(input.area_m2),
      vagas: asNumber(input.vagas),
      valor_tabela: tablePriceCheck.value,
      valor_promo: promoPrice,
      proprietario_nome: asString(input.proprietario_nome),
      proprietario_contato: asString(input.proprietario_contato),
      acesso_tipo: asString(input.acesso_tipo),
      acesso_codigo: asString(input.acesso_codigo),
      acesso_instrucoes: asString(input.acesso_instrucoes),
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

  if (body.action === "decideUnit") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role ?? "corretor";
    if (!["admin", "gestor", "executivo"].includes(role)) return Response.json({ error: "Apenas admin, gestor ou executivo podem aprovar unidades." }, { status: 403 });
    const unidadeId = typeof body.unidadeId === "string" ? body.unidadeId : "";
    if (!UUID.test(unidadeId)) return Response.json({ error: "Unidade inválida." }, { status: 400 });
    const approve = body.approve === true;
    const patch = approve
      ? { aprovacao: "aprovado", reprovacao_motivo: null }
      : { aprovacao: "reprovado", reprovacao_motivo: typeof body.motivo === "string" ? body.motivo.slice(0, 300) : null };
    const { error } = await auth.supabase.from("unidades").update(patch as never).eq("id", unidadeId).eq("empreendimento_id", id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    if (approve) {
      // Unidade aprovada precisa aparecer no site: garante o prédio aprovado como publicado.
      const { data: pai } = await auth.supabase.from("empreendimentos").select("aprovacao, publicado, rascunho").eq("id", id).maybeSingle();
      const paiTyped = pai as { aprovacao?: string; publicado?: boolean; rascunho?: boolean } | null;
      if (paiTyped && paiTyped.aprovacao === "aprovado" && !paiTyped.rascunho && !paiTyped.publicado) {
        await auth.supabase.from("empreendimentos").update({ publicado: true } as never).eq("id", id);
      }
    }
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
    const isApprover = ["admin", "gestor", "executivo"].includes(role);

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

    // Publicar / voltar a rascunho: só aprovadores (admin, gestor, executivo).
    if (!isApprover) return Response.json({ error: "Apenas administradores, gestores ou executivos podem publicar produtos." }, { status: 403 });
    if (body.action === "unpublish") {
      const { error } = await auth.supabase.from("empreendimentos").update({ rascunho: true, publicado: false }).eq("id", id);
      return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, rascunho: true, publicado: false });
    }
    // Publicar somente após a checagem profissional. A regra fica no servidor para não ser
    // contornada por chamadas diretas à API.
    const { data: productToPublish, error: readError } = await auth.supabase
      .from("empreendimentos")
      .select("nome,titulo,slogan,descricao,finalidade,preco,area_util,dormitorios,banheiros,vagas,endereco,numero,bairro,cidade,uf,cep,condominio_valor,iptu,outros_custos,lazer,diferenciais,tour_url,unidades(area_m2,valor_tabela,valor_promo,disponivel),midias(tipo,categoria,is_capa)")
      .eq("id", id)
      .single();
    if (readError || !productToPublish) return Response.json({ error: readError?.message ?? "Produto não encontrado." }, { status: 502 });
    const publishUnits = productToPublish.unidades ?? [];
    const publishAvailable = publishUnits.filter((unit) => unit.disponivel);
    const publishPrices = publishAvailable.map((unit) => unit.valor_promo ?? unit.valor_tabela).filter((value): value is number => typeof value === "number" && value > 0);
    const publishAreas = publishAvailable.map((unit) => unit.area_m2).filter((value): value is number => typeof value === "number" && value > 0);
    const publishMedia = productToPublish.midias ?? [];
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
    const { error } = await auth.supabase.from("empreendimentos").update({ rascunho: false, aprovacao: "aprovado", publicado: true, reprovacao_motivo: null }).eq("id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true, rascunho: false, aprovacao: "aprovado" });
  }

  if (body.action === "setCover") {
    if (negadoPorCaptacao) return negadoPorCaptacao;
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    if (!UUID.test(mediaId)) return Response.json({ error: "Mídia inválida." }, { status: 400 });
    const denied = guard([["produtos", "editar"]], "Você não tem permissão para editar mídias do produto.");
    if (denied) return denied;
    const { error: clearError } = await auth.supabase.from("midias").update({ is_capa: false }).eq("empreendimento_id", id);
    if (clearError) return Response.json({ error: clearError.message }, { status: 502 });
    const { error } = await auth.supabase.from("midias").update({ is_capa: true }).eq("id", mediaId).eq("empreendimento_id", id).eq("tipo", "foto");
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "updateMedia") {
    if (negadoPorCaptacao) return negadoPorCaptacao;
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    const categoria = typeof body.category === "string" ? body.category.trim() : "";
    if (!UUID.test(mediaId) || !categoria) return Response.json({ error: "Mídia ou classificação inválida." }, { status: 400 });
    const denied = guard([["produtos", "editar"]], "Você não tem permissão para editar mídias do produto.");
    if (denied) return denied;
    const { error } = await auth.supabase.from("midias").update({ categoria }).eq("id", mediaId).eq("empreendimento_id", id);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (body.action === "deleteMedia") {
    if (negadoPorCaptacao) return negadoPorCaptacao;
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    if (!UUID.test(mediaId)) return Response.json({ error: "Mídia inválida." }, { status: 400 });
    const denied = guard([["produtos", "editar"], ["produtos", "excluir"]], "Você não tem permissão para excluir mídias do produto.");
    if (denied) return denied;
    const { data: media, error: readError } = await auth.supabase.from("midias").select("storage_path,is_capa,tipo").eq("id", mediaId).eq("empreendimento_id", id).single();
    if (readError) return Response.json({ error: readError.message }, { status: 502 });
    const { error: storageError } = await auth.supabase.storage.from("empreendimentos").remove([media.storage_path]);
    if (storageError) return Response.json({ error: `Não foi possível excluir o arquivo: ${storageError.message}` }, { status: 502 });
    const { error: deleteError } = await auth.supabase.from("midias").delete().eq("id", mediaId).eq("empreendimento_id", id);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 502 });
    if (media.is_capa && media.tipo === "foto") {
      const { data: nextPhoto } = await auth.supabase.from("midias").select("id").eq("empreendimento_id", id).eq("tipo", "foto").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (nextPhoto) await auth.supabase.from("midias").update({ is_capa: true }).eq("id", nextPhoto.id);
    }
    return Response.json({ success: true });
  }

  if (body.action === "deleteProduct") {
    const { data: me } = await auth.supabase.from("usuarios").select("role").eq("id", auth.user.id).maybeSingle();
    const role = (me as { role?: string } | null)?.role ?? "corretor";
    if (!["admin", "gestor", "executivo"].includes(role)) return Response.json({ error: "Apenas admin, gestor ou executivo podem excluir produtos." }, { status: 403 });
    const deniedDelete = guard([["produtos", "excluir"]], "Você não tem permissão para excluir produtos.");
    if (deniedDelete) return deniedDelete;

    const { data: alvo, error: alvoError } = await auth.supabase.from("empreendimentos").select("id, nome").eq("id", id).maybeSingle();
    if (alvoError) return Response.json({ error: alvoError.message }, { status: 502 });
    if (!alvo) return Response.json({ error: "Produto não encontrado." }, { status: 404 });

    // Trava dura: não apaga produto com histórico comercial (protege negócios, vendas e visitas).
    const [neg, ven, vis, f2v, pip, prop, capt] = await Promise.all([
      auth.supabase.from("negocios").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
      auth.supabase.from("vendas").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
      auth.supabase.from("visitas").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
      auth.supabase.from("f2_visita").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
      auth.supabase.from("pipelines").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
      auth.supabase.from("ncrm_proposta").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
      auth.supabase.from("captacoes_portal").select("empreendimento_id", { count: "exact", head: true }).eq("empreendimento_id", id),
    ]);
    const vinculos: string[] = [];
    if ((neg.count ?? 0) > 0) vinculos.push(`${neg.count} negócio(s)`);
    if ((ven.count ?? 0) > 0) vinculos.push(`${ven.count} venda(s)`);
    const totalVisitas = (vis.count ?? 0) + (f2v.count ?? 0);
    if (totalVisitas > 0) vinculos.push(`${totalVisitas} visita(s)`);
    if ((pip.count ?? 0) > 0) vinculos.push(`${pip.count} funil(is)`);
    if ((prop.count ?? 0) > 0) vinculos.push(`${prop.count} proposta(s)`);
    if ((capt.count ?? 0) > 0) vinculos.push(`${capt.count} captação(ões) do portal`);
    if (vinculos.length) return Response.json({ error: `Não é possível excluir: este produto tem ${vinculos.join(", ")} vinculado(s). Desvincule antes de excluir.`, code: "PRODUCT_HAS_LINKS" }, { status: 409 });

    // O CASCADE do banco remove as linhas de mídia, mas não os arquivos no storage.
    const { data: midiasDoProduto } = await auth.supabase.from("midias").select("storage_path").eq("empreendimento_id", id);
    const paths = (midiasDoProduto ?? []).map((m) => m.storage_path).filter((p): p is string => Boolean(p));
    if (paths.length) await auth.supabase.storage.from("empreendimentos").remove(paths);

    const { data: removido, error: deleteError } = await auth.supabase.from("empreendimentos").delete().eq("id", id).select("id");
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 502 });
    if (!removido || removido.length === 0) return Response.json({ error: "Exclusão bloqueada pelas permissões do banco (RLS)." }, { status: 403 });

    const { data: quem } = await auth.supabase.from("usuarios").select("nome").eq("id", auth.user.id).maybeSingle();
    await auth.supabase.from("erp_auditoria").insert({
      usuario_id: auth.user.id,
      usuario_nome: (quem as { nome?: string } | null)?.nome ?? null,
      acao: "excluir",
      modulo: "produtos",
      entidade: "empreendimento",
      entidade_id: id,
      antes: alvo,
      detalhe: `Produto "${alvo.nome ?? id}" excluído definitivamente (${paths.length} arquivo(s) de mídia removidos do storage).`,
    } as never);

    return Response.json({ success: true, deleted: true });
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

  if (Array.isArray(body.units)) {
    const { data: existingUnits, error: unitsReadError } = await auth.supabase.from("unidades").select("id").eq("empreendimento_id", id);
    if (unitsReadError) return Response.json({ error: unitsReadError.message }, { status: 502 });
    const incomingUnits = body.units as Array<Record<string, unknown>>;
    const existingIds = new Set((existingUnits ?? []).map((item) => item.id));
    const keptIds = incomingUnits.map((item) => typeof item.id === "string" && existingIds.has(item.id) ? item.id : null).filter((value): value is string => Boolean(value));
    const removeIds = (existingUnits ?? []).map((item) => item.id).filter((unitId) => !keptIds.includes(unitId));
    if (removeIds.length) {
      const { error: deleteError } = await auth.supabase.from("unidades").delete().in("id", removeIds);
      if (deleteError) return Response.json({ error: deleteError.message }, { status: 502 });
    }
    for (const item of incomingUnits) {
      // Só os campos COMERCIAIS da unidade. de_terceiros, proprietário, indicador e acesso
      // são propriedades da unidade/indicação e NUNCA são alterados pela edição do produto.
      const commonRow = {
        numero: typeof item.numero === "string" ? item.numero.trim() || null : null,
        tipologia: typeof item.tipologia === "string" ? item.tipologia.trim() || null : null,
        area_m2: item.area_m2 === "" || item.area_m2 == null ? null : Number(item.area_m2),
        vagas: item.vagas === "" || item.vagas == null ? null : Number(item.vagas),
        valor_tabela: item.valor_tabela === "" || item.valor_tabela == null ? null : Number(item.valor_tabela),
        valor_promo: item.valor_promo === "" || item.valor_promo == null ? null : Number(item.valor_promo),
        disponivel: item.disponivel !== false,
      };
      if (commonRow.valor_tabela != null) {
        const priceCheck = validateProductPrice(commonRow.valor_tabela, "Valor de tabela", update.finalidade ?? currentPurpose);
        if (priceCheck.error) return Response.json({ error: priceCheck.error }, { status: 422 });
      }
      if (commonRow.valor_promo != null) {
        const priceCheck = validateProductPrice(commonRow.valor_promo, "Valor promocional", update.finalidade ?? currentPurpose);
        if (priceCheck.error) return Response.json({ error: priceCheck.error }, { status: 422 });
      }
      const unitId = typeof item.id === "string" && existingIds.has(item.id) ? item.id : null;
      const unitResult = unitId
        ? await auth.supabase.from("unidades").update(commonRow as never).eq("id", unitId).eq("empreendimento_id", id)
        : await auth.supabase.from("unidades").insert({ ...commonRow, empreendimento_id: id, de_terceiros: body.origin === "terceiros" } as never);
      if (unitResult.error) return Response.json({ error: unitResult.error.message }, { status: 502 });
    }
  }
  return Response.json({ success: true });
}
