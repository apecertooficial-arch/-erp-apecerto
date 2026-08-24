"use client";
/* eslint-disable @next/next/no-img-element */

/* Modulo Produtos.
 *
 * Extraido de ProductCatalog.tsx SEM alteracao de comportamento: os mesmos
 * filtros, a mesma chamada /api/catalog, o mesmo fluxo de aprovacao.
 * O que saiu daqui foi o que nunca pertenceu ao modulo -- bootstrap de sessao,
 * AppShell e o switch de navegacao, que agora vivem no layout (erp).
 *
 * O contador de pendencias e publicado no contexto para a navegacao exibir o
 * badge, em vez de o pai calcular e passar para baixo.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CaptureWizard } from "./CaptureWizard";
import { UnitWizard } from "./UnitWizard";
import { ProductDetail } from "./ProductDetail";
import { sitePropertyUrl, type Product } from "./products";
import type { ProductQuality } from "./quality";
import { normalizedKey } from "./quality";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { useErpSession } from "../system/ErpSession";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";
import { useEhCelular } from "../system/useFormato";

type CatalogResponse = {
  mode: string;
  count: number;
  buildingCount?: number;
  catalog: Array<{
    id: string; name: string; title?: string | null; slug?: string | null; purpose?: string | null; address?: string | null; developer: string | null; neighborhood: string; city: string;
    status: string; price: number | null; area: number | null; bedrooms: number | null;
    parking: number | null; available: number; units: number; media: number; unitMedia?: number; referenceMedia?: number;
    coverUrl: string | null; draft: boolean; origin: string; standalone?: boolean; favorite: boolean;
    approval?: string; rejectionReason?: string | null; mine?: boolean; capturedBy?: string | null; capturedByScore?: number | null; codigo?: string | null; unitId?: string | null;
    published?: boolean; quality: ProductQuality; topIssue?: string | null; createdAt?: string | null; updatedAt?: string | null;
    leads?: number;
  }>;
  qualitySummary?: { excellent: number; good: number; attention: number; critical: number; readyForSite: number; average: number };
  canApprove?: boolean;
  pendingCount?: number;
  pendingUnits?: Array<{ id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null; approval: string; rejectionReason: string | null; codigo: string | null }>;
  myUnits?: Array<{ id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null; approval: string; rejectionReason: string | null; codigo: string | null; published: boolean; available: boolean }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function captureStatusLabel(unit: NonNullable<CatalogResponse["myUnits"]>[number]): string {
  if (unit.approval === "reprovado") return `Correção solicitada${unit.rejectionReason ? `: ${unit.rejectionReason}` : ""}`;
  if (unit.approval === "pendente") return "Aguardando aprovação da gestão";
  if (!unit.available) return "Aprovado · indisponível";
  return unit.published ? "Aprovado · publicado no site" : "Aprovado · fora do ar";
}

type ProductsSection = "unidades" | "empreendimentos" | "condominios" | "aprovacoes";
type RegistrationChoice = "apartamento" | "remanescente" | "condominio" | "empreendimento";

function productState(product: Product) {
  if (product.published) return { label: "No site", tone: "site" };
  if (product.approval === "pendente") return { label: "Em aprovação", tone: "review" };
  if (product.approval === "reprovado") return { label: "Ajustes solicitados", tone: "blocked" };
  if (product.draft) return { label: "Rascunho", tone: "draft" };
  return { label: "Fora do ar", tone: "offline" };
}

function cleanUnitTitle(product: Product) {
  if (!product.unitId) return product.name;
  const parts = product.name.split(" · Un. ");
  return parts.length > 1 ? `Unidade ${parts.at(-1)}` : product.name;
}

function productBuilding(product: Product) {
  if (!product.unitId) return product.developer || product.name;
  return product.name.split(" · Un. ")[0] || product.developer || "Imóvel individual";
}

function Icon({ name }: { name: "search" | "filter" | "sort" | "grid" | "list" | "building" | "pin" | "area" | "bed" | "car" | "user" | "plus" | "bell" | "arrow" | "home" | "layers" | "check" | "more" }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></>,
    sort: <><path d="M8 6h10M8 12h7M8 18h4"/><path d="m4 8-2-2 2-2v14"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
    building: <><path d="M4 21V5l8-3 8 3v16"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1M2 21h20"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    area: <><path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"/></>,
    bed: <><path d="M3 20v-8h18v8M5 12V8h6a3 3 0 0 1 3 3v1M3 17h18"/></>,
    car: <><path d="M5 17h14l-1.5-5A2 2 0 0 0 15.6 10H8.4a2 2 0 0 0-1.9 2L5 17Z"/><path d="M7 17v2M17 17v2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>, home: <><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3Z"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>, check: <path d="m5 12 4 4L19 6"/>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg className="pv3-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function ProductsModule({ accessToken }: { accessToken: string }) {
  const { publicarBadge, role } = useErpSession();
  const ehCelular = useEhCelular();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [neighborhood, setNeighborhood] = useState("Todos");
  const [developer, setDeveloper] = useState("Todas");
  const [priceBand, setPriceBand] = useState("Todas");
  const [bedrooms, setBedrooms] = useState("Qualquer");
  const [stockOnly, setStockOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [noMediaOnly, setNoMediaOnly] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [standaloneOpen, setStandaloneOpen] = useState(false);
  const [unitWizardOpen, setUnitWizardOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingUnits, setPendingUnits] = useState<NonNullable<CatalogResponse["pendingUnits"]>>([]);
  const [myUnits, setMyUnits] = useState<NonNullable<CatalogResponse["myUnits"]>>([]);
  const [myUnitsOpen, setMyUnitsOpen] = useState(false);
  const [initialUnitId, setInitialUnitId] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState(false);
  const [qualityFilter, setQualityFilter] = useState("Todas");
  const [publicationFilter, setPublicationFilter] = useState("Todos");
  const [sortBy, setSortBy] = useState("quality-asc");
  const [dataState, setDataState] = useState<"loading" | "live" | "auth" | "error">("loading");
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openInEdit, setOpenInEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publicationTarget, setPublicationTarget] = useState<Product | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [captadorFilter, setCaptadorFilter] = useState("Todos");
  const [, setPuExpandida] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [section, setSection] = useState<ProductsSection>("unidades");
  const [catalogLayout, setCatalogLayout] = useState<"grid" | "list">("grid");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationChoice, setRegistrationChoice] = useState<RegistrationChoice>("apartamento");

  const loadCatalog = useCallback(async function requestCatalog(token: string, allowRefresh = true) {
    setDataState("loading");
    try {
      const response = await fetch("/api/catalog", { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) {
        if (allowRefresh) {
          const { data } = await getBrowserSupabaseClient().auth.refreshSession();
          if (data.session) { await requestCatalog(data.session.access_token, false); return; }
        }
        setDataState("auth");
        return;
      }
      if (!response.ok) throw new Error("Não foi possível consultar o catálogo.");
      const result = await response.json() as CatalogResponse;
      setProducts(result.catalog.map((item) => ({
        id: item.id, name: item.name, title: item.title ?? null, slug: item.slug ?? null,
        purpose: item.purpose ?? null, address: item.address ?? null, developer: item.developer,
        price: item.price === null ? "Preço sob consulta" : currency.format(item.price),
        neighborhood: item.neighborhood, city: item.city, status: item.status,
        area: item.area ?? 0, bedrooms: item.bedrooms ?? 0, parking: item.parking ?? 0,
        available: item.available, leads: item.leads ?? 0,
        priceM2: item.price && item.area ? `${currency.format(item.price / item.area)}/m²` : "—",
        units: item.units, media: item.media, unitMedia: item.unitMedia, referenceMedia: item.referenceMedia, coverUrl: item.coverUrl, draft: item.draft,
        origin: item.origin, standalone: item.standalone, numericPrice: item.price, favorite: item.favorite,
        approval: item.approval ?? "aprovado", rejectionReason: item.rejectionReason ?? null,
        mine: item.mine ?? false, capturedBy: item.capturedBy ?? null, capturedByScore: item.capturedByScore ?? null, codigo: item.codigo ?? null, unitId: item.unitId ?? null,
        published: item.published, quality: item.quality, topIssue: item.topIssue ?? null,
        createdAt: item.createdAt ?? null, updatedAt: item.updatedAt ?? null,
      })));
      setCanApprove(Boolean(result.canApprove));
      setPendingCount(result.pendingCount ?? 0);
      setPendingUnits(result.pendingUnits ?? []);
      setMyUnits(result.myUnits ?? []);
      setDataState("live");
      setAtualizadoEm(new Date());
    } catch {
      setDataState("error");
    }
  }, []);

  useEffect(() => { void loadCatalog(accessToken); }, [accessToken, loadCatalog]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const decideUnitFromList = useCallback(async (empId: string, unidadeId: string, approve: boolean) => {
    const motivo = approve ? "" : (window.prompt("Motivo da reprovação (opcional):", "") ?? "");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: empId, action: "decideUnit", unidadeId, approve, motivo }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { window.alert(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Não foi possível concluir a decisão."); return; }
      void loadCatalog(accessToken);
    } catch { window.alert("Falha de conexão. Tente novamente."); }
  }, [accessToken, loadCatalog]);

  const confirmDeleteProduct = useCallback(async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id, action: "deleteProduct" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { window.alert(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Não foi possível excluir o produto."); }
      else { void loadCatalog(accessToken); }
    } catch { window.alert("Falha de conexão ao excluir. Tente novamente."); }
    finally { setDeleting(false); setDeleteTarget(null); }
  }, [accessToken, deleteTarget, loadCatalog]);

  const changePublicationFromCard = useCallback(async (product: Product, publish: boolean) => {
    if (!product.id) return;
    setPublishing(true);
    try {
      const action = product.unitId ? (publish ? "publishUnit" : "unpublishUnit") : (publish ? "publish" : "unpublish");
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id, action, unidadeId: product.unitId ?? undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { window.alert(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Não foi possível alterar a publicação do imóvel."); return; }
      await loadCatalog(accessToken);
    } catch { window.alert("Falha de conexão ao alterar a publicação. Tente novamente."); }
    finally { setPublishing(false); setPublicationTarget(null); setOpenMenuId(null); }
  }, [accessToken, loadCatalog]);

  useEffect(() => {
    publicarBadge("Produtos", canApprove ? pendingCount + pendingUnits.length : 0);
  }, [canApprove, pendingCount, pendingUnits, publicarBadge]);

  const filtered = useMemo(() => products.filter((product) => {
    if (captadorFilter !== "Todos" && (product.capturedBy ?? "") !== captadorFilter) return false;
    const queryKey = normalizedKey(query);
    const matchesQuery = !queryKey || [product.name, product.title, product.address, product.neighborhood, product.city, product.developer, product.codigo]
      .some((value) => normalizedKey(value).includes(queryKey));
    const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace("_", " ").toLowerCase();
    const matchesStatus = status === "Todos" || (!product.draft && normalize(product.status ?? "") === normalize(status));
    const matchesNeighborhood = neighborhood === "Todos" || normalizedKey(product.neighborhood) === normalizedKey(neighborhood);
    const matchesDeveloper = developer === "Todas" || normalizedKey(product.developer) === normalizedKey(developer);
    const matchesBedrooms = bedrooms === "Qualquer" || (bedrooms === "4" ? product.bedrooms >= 4 : product.bedrooms === Number(bedrooms));
    const matchesStock = !stockOnly || product.available > 0;
    const matchesFavorite = !favoritesOnly || product.favorite;
    const matchesMine = !mineOnly || product.mine;
    const matchesMedia = !noMediaOnly || (product.media ?? 0) === 0;
    const price = product.numericPrice ?? 0;
    const matchesPrice = priceBand === "Todas" || (priceBand === "Até 500 mil" ? price > 0 && price <= 500000 : priceBand === "500 mil a 1 mi" ? price > 500000 && price <= 1000000 : price > 1000000);
    const matchesQuality = qualityFilter === "Todas" || product.quality?.level === qualityFilter;
    const matchesPublication = publicationFilter === "Todos"
      || (publicationFilter === "site" ? product.published : publicationFilter === "ready" ? product.quality?.readyForSite && !product.published : !product.quality?.readyForSite);
    return matchesQuery && matchesStatus && matchesNeighborhood && matchesDeveloper && matchesBedrooms && matchesStock && matchesPrice && matchesFavorite && matchesMine && matchesMedia && matchesQuality && matchesPublication;
  }).sort((a, b) => {
    if (sortBy === "quality-asc") return (a.quality?.score ?? 0) - (b.quality?.score ?? 0);
    if (sortBy === "quality-desc") return (b.quality?.score ?? 0) - (a.quality?.score ?? 0);
    if (sortBy === "price-asc") return (a.numericPrice ?? Number.MAX_SAFE_INTEGER) - (b.numericPrice ?? Number.MAX_SAFE_INTEGER);
    if (sortBy === "price-desc") return (b.numericPrice ?? 0) - (a.numericPrice ?? 0);
    return Date.parse(b.updatedAt ?? b.createdAt ?? "") - Date.parse(a.updatedAt ?? a.createdAt ?? "");
  }), [products, query, status, neighborhood, developer, bedrooms, stockOnly, priceBand, favoritesOnly, mineOnly, noMediaOnly, qualityFilter, publicationFilter, sortBy, captadorFilter]);

  const neighborhoods = useMemo(() => Array.from(new Map(products.map((item) => [normalizedKey(item.neighborhood), item.neighborhood])).values()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);
  const developers = useMemo(() => Array.from(new Map(products.filter((item) => Boolean(item.developer)).map((item) => [normalizedKey(item.developer), item.developer as string])).values()).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);
  const produtosVisiveis = filtered.filter((product) => !approvalFilter || product.approval === "pendente");
  const captadores = useMemo(() => Array.from(new Set([...products.map((p) => p.capturedBy), ...pendingUnits.map((u) => u.indicador)].filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "pt-BR")), [products, pendingUnits]);
  const pendingUnitsVisiveis = captadorFilter === "Todos" ? pendingUnits : pendingUnits.filter((u) => u.indicador === captadorFilter);
  const unitProducts = filtered.filter((product) => Boolean(product.unitId || product.standalone));
  const referenceProducts = filtered.filter((product) => !product.unitId && !product.standalone);
  const developmentProducts = referenceProducts.filter((product) => /lan[cç]|obra/i.test(product.status ?? "") || Boolean(product.developer));
  const condominiumProducts = referenceProducts.filter((product) => !developmentProducts.includes(product));
  const publishedCount = products.filter((product) => product.published).length;
  const offlineCount = products.filter((product) => !product.published && product.approval === "aprovado").length;
  const approvalTotal = pendingCount + pendingUnits.length;

  function openProduct(product: Product, edit = false) {
    if (!product.id) return;
    setOpenInEdit(edit && !product.unitId);
    setInitialUnitId(product.unitId ?? null);
    setSelectedProductId(product.id);
  }

  function chooseSection(next: ProductsSection) {
    setSection(next);
    setApprovalFilter(next === "aprovacoes");
    if (next === "aprovacoes") setPuExpandida(true);
  }

  function continueRegistration() {
    setRegistrationOpen(false);
    if (registrationChoice === "apartamento" || registrationChoice === "remanescente") setUnitWizardOpen(true);
    else setCaptureOpen(true);
  }

  const hasActiveFilters = Boolean(query || status !== "Todos" || neighborhood !== "Todos" || developer !== "Todas"
    || priceBand !== "Todas" || bedrooms !== "Qualquer" || stockOnly || favoritesOnly || mineOnly || noMediaOnly
    || approvalFilter || qualityFilter !== "Todas" || publicationFilter !== "Todos" || sortBy !== "quality-asc" || captadorFilter !== "Todos");

  function clearFilters() {
    setQuery(""); setStatus("Todos"); setNeighborhood("Todos"); setDeveloper("Todas"); setPriceBand("Todas");
    setBedrooms("Qualquer"); setStockOnly(false); setFavoritesOnly(false); setMineOnly(false); setNoMediaOnly(false); setApprovalFilter(false); setCaptadorFilter("Todos");
    setQualityFilter("Todas"); setPublicationFilter("Todos"); setSortBy("quality-asc");
  }

  function showCatalog() {
    setApprovalFilter(false);
    setSection("unidades");
  }

  function showApprovalQueue() {
    setQuery("");
    setStatus("Todos");
    setNeighborhood("Todos");
    setDeveloper("Todas");
    setPriceBand("Todas");
    setBedrooms("Qualquer");
    setStockOnly(false);
    setFavoritesOnly(false);
    setMineOnly(false);
    setNoMediaOnly(false);
    setQualityFilter("Todas");
    setPublicationFilter("Todos");
    setCaptadorFilter("Todos");
    setApprovalFilter(true);
    setSection("aprovacoes");
    setPuExpandida(true);
  }

  if (ehCelular === null) return null;
  if (ehCelular && dataState === "auth") return <AppMobileSessaoExpirada />;
  if (ehCelular) return <main className="ape-produtos">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <div className="ape-produto-mobile-actions"><button type="button" className="principal" onClick={() => setUnitWizardOpen(true)}>＋ Cadastrar apartamento</button><button type="button" onClick={() => setCaptureOpen(true)}>＋ Cadastrar condomínio</button>{myUnits.length > 0 && <button type="button" className={myUnitsOpen ? "ativo" : ""} onClick={() => setMyUnitsOpen(!myUnitsOpen)}>Minhas captações · {myUnits.length}</button>}{canApprove && <button type="button" className={approvalFilter ? "ativo" : ""} onClick={() => approvalFilter ? showCatalog() : showApprovalQueue()}>Aprovar · {pendingCount + pendingUnits.length}</button>}</div>
    <label className="ape-produto-busca">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, código AP ou rua" />
    </label>
    <nav className="ape-filtros ape-produto-filtros" aria-label="Filtrar produtos">
      {([
        ["Todos", "Todos"], ["Pronto", "Pronto pra morar"], ["Em obras", "Obras"], ["Lançamento", "Lançamento"],
      ] as const).map(([valor, rotulo]) => <button type="button" key={valor} className={!favoritesOnly && status === valor ? "ativo" : ""} onClick={() => { setFavoritesOnly(false); setStatus(valor); }}>{rotulo}</button>)}
      <button type="button" className={favoritesOnly ? "ativo" : ""} onClick={() => { setStatus("Todos"); setFavoritesOnly(true); }}>Favoritos</button>
      <button type="button" className={qualityFilter === "critico" ? "ativo" : ""} onClick={() => setQualityFilter(qualityFilter === "critico" ? "Todas" : "critico")}>Precisa completar</button>
    </nav>

    {dataState === "loading" && <div className="ape-produto-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i}><span /><i /><i /></div>)}</div>}
    {dataState === "error" && <div className="ape-estado ruim" role="alert"><strong>Não foi possível carregar os produtos.</strong><p>Confira sua conexão e tente novamente.</p><button type="button" onClick={() => void loadCatalog(accessToken)}>Tentar novamente</button></div>}
    {dataState === "live" && produtosVisiveis.length === 0 && <div className="ape-estado"><div className="ape-estado-icone" aria-hidden="true">⌕</div><strong>Nenhum produto encontrado</strong><p>Ajuste a busca ou escolha outro filtro.</p></div>}

    {myUnitsOpen && myUnits.length > 0 && <section className="ape-mobile-captacoes"><h2>Minhas captações</h2>{myUnits.map((unit) => <button type="button" key={unit.id} onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}><strong>{unit.predio} · Un. {unit.numero ?? "s/n"}{unit.codigo ? ` · ${unit.codigo}` : ""}</strong><span>{captureStatusLabel(unit)}</span></button>)}</section>}
    {canApprove && approvalFilter && pendingUnitsVisiveis.length > 0 && <section className="ape-mobile-captacoes"><h2>Unidades para aprovar</h2>{pendingUnitsVisiveis.map((unit) => <div key={unit.id}><button type="button" onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}><strong>{unit.predio} · Un. {unit.numero ?? "s/n"}</strong><span>{unit.indicador ?? "Sem captador"}</span></button><div><button type="button" onClick={() => void decideUnitFromList(unit.empreendimentoId, unit.id, true)}>✓ Aprovar</button><button type="button" onClick={() => void decideUnitFromList(unit.empreendimentoId, unit.id, false)}>✕ Reprovar</button></div></div>)}</section>}

    {dataState === "live" && produtosVisiveis.length > 0 && <section className="ape-produto-lista">
      {produtosVisiveis.map((product) => {
        const linkSite = product.published && product.id ? sitePropertyUrl(product) : null;
        const compartilhar = encodeURIComponent(`${product.name} — ${product.neighborhood}, ${product.city} — ${product.price}${linkSite ? ` — ${linkSite}` : ""}`);
        return <article className="ape-produto-card" key={product.unitId ?? product.id ?? product.name}>
          <button type="button" className={`ape-produto-foto${product.coverUrl ? " com-foto" : ""}`} onClick={() => { if (product.id) { setInitialUnitId(product.unitId ?? null); setSelectedProductId(product.id); } }} aria-label={`Abrir ${product.name}`}>
            {product.coverUrl ? <img src={product.coverUrl} alt={`Foto de ${product.name}`} /> : <span aria-hidden="true">▥</span>}
            <em>{product.draft ? "Rascunho" : product.status?.replaceAll("_", " ") || "Produto"}</em>
          </button>
          <div className="ape-produto-info">
            <strong className="ape-produto-preco">{product.price}</strong>
            <h2>{product.name} {product.codigo && <span className="cod-imovel">{product.codigo}</span>} {product.quality && <span className={`quality-badge ${product.quality.level}`}>{product.quality.score}</span>}</h2>
            {(product.neighborhood || product.city) && <p>{[product.neighborhood, product.city].filter(Boolean).join(" · ")}</p>}
            <div className="ape-produto-dados">
              {product.bedrooms > 0 && <span>{product.bedrooms} dorm.</span>}
              {product.area > 0 && <span>{product.area} m²</span>}
              {product.parking > 0 && <span>{product.parking} {product.parking === 1 ? "vaga" : "vagas"}</span>}
            </div>
            {product.available > 0 && <small>{product.available} disponíveis</small>}
            {product.topIssue && <small className="product-top-issue">⚠ {product.topIssue}</small>}
          </div>
          <div className="ape-produto-acoes">
            {linkSite && <a href={`https://wa.me/?text=${compartilhar}`} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a>}
            <button type="button" onClick={() => { if (product.id) { setInitialUnitId(product.unitId ?? null); setSelectedProductId(product.id); } }} aria-label={`Ver detalhes de ${product.name}`}>•••</button>
          </div>
        </article>;
      })}
    </section>}
    {captureOpen && <CaptureWizard onClose={() => setCaptureOpen(false)} onSaved={() => { setCaptureOpen(false); void loadCatalog(accessToken); }} />}
    {standaloneOpen && <CaptureWizard initialStandalone onClose={() => setStandaloneOpen(false)} onSaved={() => { setStandaloneOpen(false); void loadCatalog(accessToken); }} />}
    {unitWizardOpen && <UnitWizard accessToken={accessToken} onCreateStandalone={() => { setUnitWizardOpen(false); setStandaloneOpen(true); }} onCreateCondominium={() => { setUnitWizardOpen(false); setCaptureOpen(true); }} onClose={() => setUnitWizardOpen(false)} onSaved={() => { setUnitWizardOpen(false); void loadCatalog(accessToken); }} />}
    {selectedProductId && <ProductDetail productId={selectedProductId} accessToken={accessToken} sessionRole={role} initialUnitId={initialUnitId} initialEditing={openInEdit} captadorScore={products.find((p) => p.id === selectedProductId)?.capturedByScore ?? null} onClose={() => { setSelectedProductId(null); setInitialUnitId(null); setOpenInEdit(false); }} onChanged={() => void loadCatalog(accessToken)} />}
    {deleteTarget && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão do produto"><div><strong>Excluir este produto definitivamente?</strong><p><strong>{deleteTarget.name}</strong> e todas as suas unidades, fotos e vínculos serão removidos para sempre. Esta ação não pode ser desfeita.</p><footer><button type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="danger" disabled={deleting} type="button" onClick={() => void confirmDeleteProduct()}>Excluir para sempre</button></footer></div></div>}
  </main>;

  return (
    <main className="products-v3">
      <header className="pv3-header">
        <div><p className="pv3-breadcrumb">Gestão <span>›</span> Produtos</p><h1>Produtos</h1><p className="pv3-subtitle">Gerencie o que a apêcerto vende, publica e usa como referência.</p></div>
        <div className="pv3-header-actions"><button className="pv3-icon-button" aria-label="Notificações" type="button"><Icon name="bell" /></button><button className="pv3-primary" type="button" onClick={() => setRegistrationOpen(true)}><Icon name="plus" /> Cadastrar</button></div>
      </header>

      {section !== "aprovacoes" && <section className="pv3-kpis" aria-label="Resumo dos produtos">
        <button type="button" className={publicationFilter === "Todos" ? "orange active" : "orange"} onClick={() => setPublicationFilter("Todos")}><span><Icon name="layers" /></span><b>{products.length}</b><em>No catálogo</em></button>
        <button type="button" className={publicationFilter === "site" ? "green active" : "green"} onClick={() => setPublicationFilter(publicationFilter === "site" ? "Todos" : "site")}><span><Icon name="home" /></span><b>{publishedCount}</b><em>No site</em></button>
        <button type="button" className="purple" onClick={() => chooseSection("aprovacoes")}><span><Icon name="check" /></span><b>{approvalTotal}</b><em>Em aprovação</em></button>
        <button type="button" className={publicationFilter === "ready" ? "yellow active" : "yellow"} onClick={() => setPublicationFilter(publicationFilter === "ready" ? "Todos" : "ready")}><span><Icon name="home" /></span><b>{offlineCount}</b><em>Fora do ar</em></button>
      </section>}

      <nav className="pv3-tabs" aria-label="Áreas de produtos">
        <button type="button" className={section === "unidades" ? "active" : ""} onClick={() => chooseSection("unidades")}>Unidades</button>
        <button type="button" className={section === "empreendimentos" ? "active" : ""} onClick={() => chooseSection("empreendimentos")}>Empreendimentos</button>
        <button type="button" className={section === "condominios" ? "active" : ""} onClick={() => chooseSection("condominios")}>Condomínios</button>
        {canApprove && <button type="button" className={section === "aprovacoes" ? "active" : ""} onClick={() => chooseSection("aprovacoes")}>Aprovações <span>{approvalTotal}</span></button>}
      </nav>

      {section !== "aprovacoes" && <>
        <section className="pv3-toolbar">
          <label className="pv3-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section === "empreendimentos" ? "Buscar em empreendimentos..." : section === "condominios" ? "Buscar em condomínios..." : "Buscar em produtos..."} /></label>
          <button className={moreFiltersOpen ? "pv3-secondary active" : "pv3-secondary"} type="button" onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}><Icon name="filter" /> Filtros</button>
          <label className="pv3-sort"><Icon name="sort" /><select aria-label="Ordenação" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="updated">Mais recentes</option><option value="quality-asc">Menor nota</option><option value="quality-desc">Maior nota</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select></label>
          <div className="pv3-layout-toggle"><button type="button" className={catalogLayout === "grid" ? "active" : ""} onClick={() => setCatalogLayout("grid")} aria-label="Exibir em grade"><Icon name="grid" /></button><button type="button" className={catalogLayout === "list" ? "active" : ""} onClick={() => setCatalogLayout("list")} aria-label="Exibir em lista"><Icon name="list" /></button></div>
        </section>
        {moreFiltersOpen && <section className="pv3-filters">
          <select aria-label="Situação" value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option><option>Pronto</option><option>Em obras</option><option>Lançamento</option></select>
          <select aria-label="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="Todos">Todos os bairros</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Incorporadora" value={developer} onChange={(event) => setDeveloper(event.target.value)}><option value="Todas">Todas as incorporadoras</option>{developers.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Captador" value={captadorFilter} onChange={(event) => setCaptadorFilter(event.target.value)}><option value="Todos">Todos os captadores</option>{captadores.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Faixa de preço" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}><option>Todas</option><option>Até 500 mil</option><option>500 mil a 1 mi</option><option>Acima de 1 mi</option></select>
          <select aria-label="Dormitórios" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="Qualquer">Qualquer dormitório</option><option value="0">Studio</option><option value="1">1 dormitório</option><option value="2">2 dormitórios</option><option value="3">3 dormitórios</option><option value="4">4+ dormitórios</option></select>
          <button type="button" className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly(!favoritesOnly)}>☆ Favoritos</button><button type="button" className={mineOnly ? "active" : ""} onClick={() => setMineOnly(!mineOnly)}>Meus imóveis</button>
          {hasActiveFilters && <button type="button" className="clear" onClick={clearFilters}>Limpar filtros</button>}
        </section>}
      </>}

      {dataState === "loading" && <div className="pv3-loading" aria-label="Carregando produtos"><i/><i/><i/><i/></div>}
      {dataState === "error" && <div className="pv3-empty" role="alert"><strong>Não foi possível carregar os produtos.</strong><p>Confira sua conexão e tente novamente.</p><button type="button" onClick={() => void loadCatalog(accessToken)}>Tentar novamente</button></div>}

      {dataState === "live" && section === "unidades" && <section className="pv3-content">
        <div className="pv3-count"><strong>{unitProducts.length} unidades encontradas</strong><span>ⓘ Cada unidade mantém preço, mídia, proprietário e aprovação próprios.</span></div>
        {unitProducts.length ? <div className={`pv3-unit-grid ${catalogLayout}`}>{unitProducts.map((product) => {
          const state = productState(product); const menuKey = product.unitId ?? product.id;
          return <article className={`pv3-unit-card tint-${product.quality?.level ?? "neutral"}`} key={menuKey} onClick={() => openProduct(product)}>
            <div className="pv3-unit-cover" style={product.coverUrl ? { backgroundImage: `url(${product.coverUrl})` } : undefined}><span className={`pv3-state ${state.tone}`}>{state.label}</span>{!product.coverUrl && <Icon name="building" />}<div className="pv3-card-menu" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={`Ações de ${product.name}`} onClick={() => setOpenMenuId(openMenuId === menuKey ? null : menuKey)}><Icon name="more" /></button>{openMenuId === menuKey && <div role="menu"><button type="button" onClick={() => openProduct(product)}>Abrir ficha</button>{product.published && <button type="button" onClick={() => void navigator.clipboard.writeText(sitePropertyUrl(product))}>Copiar link do site</button>}{(canApprove || product.mine) && <button type="button" onClick={() => openProduct(product, true)}>Editar unidade</button>}{canApprove && product.published && <button type="button" className="danger" onClick={() => setPublicationTarget(product)}>Tirar imóvel do ar</button>}{canApprove && !product.published && product.approval === "aprovado" && product.quality?.readyForSite && <button type="button" onClick={() => void changePublicationFromCard(product, true)}>Publicar no site</button>}</div>}</div></div>
            <div className="pv3-unit-body"><p className="pv3-code">{product.codigo || "Código pendente"} · Captador: <b>{product.capturedBy || "não identificado"}</b></p><h2>{cleanUnitTitle(product)}</h2><p className="pv3-building"><Icon name="building" />{productBuilding(product)}</p><p className="pv3-location"><Icon name="pin" />{product.neighborhood} · {product.city}</p><strong className="pv3-price">{product.price}</strong><div className="pv3-specs"><span><Icon name="area" />{product.area || "—"} m²</span><span><Icon name="bed" />{product.bedrooms} dorm.</span><span><Icon name="car" />{product.parking} vaga(s)</span></div><footer><span><Icon name="user" />{product.capturedBy || "Sem captador"}</span><em className={product.available ? "available" : "unavailable"}>{product.available ? "Disponível" : "Indisponível"}</em></footer></div>
          </article>;
        })}</div> : <div className="pv3-empty"><strong>Nenhuma unidade encontrada</strong><p>Ajuste a busca ou limpe os filtros.</p></div>}
        {myUnits.length > 0 && <div className="pv3-my-captures"><button type="button" onClick={() => setMyUnitsOpen(!myUnitsOpen)}><span><Icon name="user" /><b>Minhas captações</b><em>{myUnits.length}</em></span>{myUnitsOpen ? "Recolher" : "Ver todas"}</button>{myUnitsOpen && <div>{myUnits.map((unit) => <button type="button" key={unit.id} onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}><strong>{unit.predio} · Unidade {unit.numero || "s/n"}</strong><span>{unit.codigo || "Sem código"} · {captureStatusLabel(unit)}</span><Icon name="arrow" /></button>)}</div>}</div>}
      </section>}

      {dataState === "live" && section === "empreendimentos" && <section className="pv3-content"><div className="pv3-section-head"><div><h2><span className="purple"><Icon name="building" /></span>Empreendimentos e estoque</h2><p>Visão consolidada do projeto. As unidades de estoque só viram produto individual quando necessário.</p></div><button type="button" className="pv3-secondary" onClick={() => { setRegistrationChoice("empreendimento"); setRegistrationOpen(true); }}><Icon name="plus" /> Cadastrar empreendimento</button></div><div className="pv3-development-list">{developmentProducts.map((product) => { const total = Math.max(product.units ?? 0, product.available); const sold = Math.max(0, total - product.available); const pct = total ? Math.round((sold / total) * 100) : 0; return <article key={product.id} className="pv3-development" onClick={() => openProduct(product)}><div className="pv3-dev-image" style={product.coverUrl ? { backgroundImage: `url(${product.coverUrl})` } : undefined}><span>EMPREENDIMENTO</span>{!product.coverUrl && <Icon name="building" />}</div><div className="pv3-dev-main"><p>{product.codigo || "EMP"} · {product.developer || "Incorporadora não informada"}</p><h3>{product.name}</h3><span><Icon name="pin" /> {product.neighborhood} · {product.city}</span><div className="pv3-dev-metrics"><em><b>{total}</b>Total</em><em className="green"><b>{product.available}</b>Disponíveis</em><em className="yellow"><b>0</b>Reservadas</em><em><b>{sold}</b>Vendidas</em></div><div className="pv3-progress"><span>Vendas <b>{pct}%</b></span><i><b style={{ width: `${pct}%` }} /></i></div></div><aside><span className={`pv3-state ${product.published ? "site" : "review"}`}>{product.published ? "Publicado" : product.approval === "pendente" ? "Em revisão" : "Fora do ar"}</span><strong>{product.price}</strong><button type="button">Ver ficha do empreendimento <Icon name="arrow" /></button></aside></article>; })}</div>{!developmentProducts.length && <div className="pv3-empty"><strong>Nenhum empreendimento encontrado</strong><p>Cadastre um lançamento ou ajuste os filtros.</p></div>}</section>}

      {dataState === "live" && section === "condominios" && <section className="pv3-content"><div className="pv3-section-head"><div><h2><span><Icon name="building" /></span>Condomínios e referências</h2><p>Prédios vinculados às captações individuais e aos empreendimentos cadastrados.</p></div><button type="button" className="pv3-secondary" onClick={() => { setRegistrationChoice("condominio"); setRegistrationOpen(true); }}><Icon name="plus" /> Novo condomínio</button></div><div className="pv3-condo-grid">{condominiumProducts.map((product) => { const total = Math.max(product.units ?? 0, product.available); const pct = total ? Math.round((product.available / total) * 100) : 0; return <article key={product.id} onClick={() => openProduct(product)}><header><span><Icon name="building" /></span><em>Condomínio de captação</em><Icon name="arrow" /></header><span className="pv3-ref-ok"><Icon name="check" /> Referência aprovada</span><h3>{product.name}</h3><p>{product.address || product.neighborhood} · {product.city}</p><div className="pv3-condo-metrics"><span>{total} unidades</span><span>{Math.max(0, total - product.available)} captações</span><span>{product.available} publicadas</span></div><footer><span>{pct}% das unidades publicadas</span><i><b style={{ width: `${pct}%` }}/></i></footer></article>; })}</div>{!condominiumProducts.length && <div className="pv3-empty"><strong>Nenhum condomínio encontrado</strong><p>Os prédios de referência aparecerão aqui.</p></div>}</section>}

      {dataState === "live" && section === "aprovacoes" && canApprove && <section className="pv3-approval"><header><h2>Central de aprovação</h2><p>Escolha uma requisição para revisar.</p></header><div className="pv3-approval-list"><div className="pv3-approval-list-head"><strong>Requisições pendentes</strong><span>{approvalTotal} na fila · {pendingUnitsVisiveis.filter((u) => u.rejectionReason).length + produtosVisiveis.filter((p) => !p.quality?.readyForSite).length} com bloqueios</span></div>{pendingUnitsVisiveis.map((unit) => <button type="button" key={unit.id} onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}><div className="pv3-approval-thumb" style={unit.coverUrl ? { backgroundImage: `url(${unit.coverUrl})` } : undefined}>{!unit.coverUrl && <Icon name="home" />}</div><span><strong>{unit.numero ? `Unidade ${unit.numero}` : "Unidade"} · {unit.predio}</strong><small>Unidade individual · {unit.indicador || "Captador não identificado"}</small></span><em className={unit.rejectionReason ? "blocked" : "ready"}>{unit.rejectionReason ? "1 bloqueio" : "Revisar cadastro"}</em><Icon name="arrow" /></button>)}{produtosVisiveis.map((product) => <button type="button" key={product.id} onClick={() => openProduct(product)}><div className="pv3-approval-thumb" style={product.coverUrl ? { backgroundImage: `url(${product.coverUrl})` } : undefined}>{!product.coverUrl && <Icon name="building" />}</div><span><strong>{product.name}</strong><small>{/lan[cç]|obra/i.test(product.status ?? "") ? "Empreendimento" : "Condomínio"} · {product.capturedBy || product.developer || "Equipe ApêCerto"}</small></span><em className={product.quality?.readyForSite ? "ready" : "blocked"}>{product.quality?.readyForSite ? "Pronto para aprovar" : `${product.quality?.blocking.length || 1} bloqueio(s)`}</em><Icon name="arrow" /></button>)}</div>{approvalTotal === 0 && <div className="pv3-empty"><strong>Fila de aprovação vazia</strong><p>Nenhuma solicitação aguarda revisão.</p></div>}</section>}

      {registrationOpen && <div className="pv3-register-layer" role="dialog" aria-modal="true" aria-label="Cadastrar produto"><button className="pv3-register-scrim" type="button" onClick={() => setRegistrationOpen(false)} aria-label="Fechar cadastro"/><section><aside><span>NOVO PRODUTO</span><h2>Cadastrar produto</h2><p>Escolha a natureza correta. A unidade sempre mantém dados e aprovação próprios.</p><div><b>1</b><span><strong>Identificação</strong><small>Escolha como o produto nasce.</small></span></div><div><b>2</b><span><strong>Cadastro completo</strong><small>Preencha ficha, valores e mídias.</small></span></div><p className="pv3-register-note">Nada é publicado antes da aprovação da gestão.</p></aside><div className="pv3-register-main"><header><div><small>Etapa 1</small><h3>Natureza do produto</h3></div><button type="button" onClick={() => setRegistrationOpen(false)} aria-label="Fechar">×</button></header><div className="pv3-register-options">{([
        ["apartamento", "Apartamento individual", "Uma unidade avulsa, com ou sem condomínio. O condomínio é opcional."],
        ["remanescente", "Unidade remanescente", "Sobra de estoque de um empreendimento já entregue."],
        ["condominio", "Condomínio", "O prédio em si: áreas comuns e administradora, nunca o produto da unidade."],
        ["empreendimento", "Empreendimento com estoque", "Várias unidades sob o mesmo projeto, cada uma com preço."],
      ] as Array<[RegistrationChoice, string, string]>).map(([value, label, description]) => <button type="button" key={value} className={registrationChoice === value ? "selected" : ""} onClick={() => setRegistrationChoice(value)}><span>{registrationChoice === value ? "✓" : ""}</span><div><strong>{label}</strong><small>{description}</small></div></button>)}</div><div className="pv3-register-independent"><Icon name="check" /><span><strong>Apartamento sem condomínio está liberado.</strong><small>O imóvel terá endereço próprio e seguirá normalmente para aprovação.</small></span></div><footer><button type="button" onClick={() => setRegistrationOpen(false)}>Cancelar</button><button type="button" className="pv3-primary" onClick={continueRegistration}>Continuar <Icon name="arrow" /></button></footer></div></section></div>}
      {captureOpen && <CaptureWizard onClose={() => setCaptureOpen(false)} onSaved={() => {
        setCaptureOpen(false);
        if (accessToken) void loadCatalog(accessToken);
      }} />}
      {standaloneOpen && <CaptureWizard initialStandalone onClose={() => setStandaloneOpen(false)} onSaved={() => {
        setStandaloneOpen(false);
        if (accessToken) void loadCatalog(accessToken);
      }} />}
      {unitWizardOpen && accessToken && <UnitWizard accessToken={accessToken} onCreateStandalone={() => { setUnitWizardOpen(false); setStandaloneOpen(true); }} onCreateCondominium={() => { setUnitWizardOpen(false); setCaptureOpen(true); }} onClose={() => setUnitWizardOpen(false)} onSaved={() => {
        setUnitWizardOpen(false);
        if (accessToken) void loadCatalog(accessToken);
      }} />}
      {selectedProductId && accessToken && <ProductDetail productId={selectedProductId} accessToken={accessToken} sessionRole={role} initialUnitId={initialUnitId} initialEditing={openInEdit} captadorScore={products.find((p) => p.id === selectedProductId)?.capturedByScore ?? null} onClose={() => { setSelectedProductId(null); setInitialUnitId(null); setOpenInEdit(false); }} onChanged={() => void loadCatalog(accessToken)} />}
      {deleteTarget && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão do produto"><div><strong>Excluir este produto definitivamente?</strong><p><strong>{deleteTarget.name}</strong> e todas as suas unidades, fotos e vínculos serão removidos para sempre. Esta ação não pode ser desfeita.</p><footer><button type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="danger" disabled={deleting} type="button" onClick={() => void confirmDeleteProduct()}>Excluir para sempre</button></footer></div></div>}
      {publicationTarget && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar retirada do imóvel do site"><div><strong>Tirar este imóvel do ar?</strong><p><strong>{publicationTarget.name}</strong> desaparecerá do site imediatamente. O cadastro, a aprovação e a disponibilidade continuam preservados para edição e publicação posterior.</p><footer><button type="button" onClick={() => setPublicationTarget(null)}>Cancelar</button><button className="danger" disabled={publishing} type="button" onClick={() => void changePublicationFromCard(publicationTarget, false)}>Tirar do ar</button></footer></div></div>}
    </main>
  );
}
