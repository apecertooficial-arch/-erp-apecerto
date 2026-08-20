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

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaptureWizard } from "./CaptureWizard";
import { UnitWizard } from "./UnitWizard";
import { ProductDetail } from "./ProductDetail";
import type { Product } from "./products";
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
  myUnits?: Array<{ id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null; approval: string; rejectionReason: string | null; codigo: string | null }>;
};

const emptyQualitySummary = { excellent: 0, good: 0, attention: 0, critical: 0, readyForSite: 0, average: 0 };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function mediaInventoryLabel(product: Product): string {
  if (!product.unitId) return `${product.media ?? 0} mídias`;
  if ((product.unitMedia ?? 0) > 0) return `${product.unitMedia} da unidade`;
  if ((product.referenceMedia ?? 0) > 0) return `${product.referenceMedia} do condomínio`;
  return "Sem fotos";
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
  const [buildingCount, setBuildingCount] = useState(0);
  const [qualitySummary, setQualitySummary] = useState(emptyQualitySummary);
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
  const [puExpandida, setPuExpandida] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

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
      setBuildingCount(result.buildingCount ?? result.count);
      setQualitySummary(result.qualitySummary ?? emptyQualitySummary);
      setDataState("live");
      setAtualizadoEm(new Date());
    } catch {
      setDataState("error");
    }
  }, []);

  useEffect(() => { void loadCatalog(accessToken); }, [accessToken, loadCatalog]);

  const decideFromCard = useCallback(async (produtoId: string, approve: boolean) => {
    const motivo = approve ? null : (window.prompt("Motivo da reprovação:", "") ?? "");
    if (!approve && !motivo) return;
    try {
      const response = await fetch("/api/capture", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: produtoId, action: approve ? "approve" : "reject", motivo }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { window.alert(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Não foi possível concluir a aprovação."); return; }
      void loadCatalog(accessToken);
    } catch { window.alert("Falha de conexão ao aprovar. Tente novamente."); }
  }, [accessToken, loadCatalog]);

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

  function exportCatalog() {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["Código", "Produto", "Tipo", "Bairro", "Cidade", "Incorporadora", "Captador", "Preço", "Área", "Unidades disponíveis", "Leads", "Aprovação", "Nota", "Qualidade", "No site", "Principal pendência"];
    const rows = produtosVisiveis.map((item) => [item.codigo, item.name, item.unitId ? "Unidade" : "Empreendimento", item.neighborhood, item.city, item.developer, item.capturedBy, item.numericPrice, item.area, item.available, item.leads, item.approval, item.quality?.score, item.quality?.label, item.published ? "Sim" : "Não", item.topIssue]);
    const blob = new Blob(["﻿", [header, ...rows].map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `catalogo-apecerto-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
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

    {myUnitsOpen && myUnits.length > 0 && <section className="ape-mobile-captacoes"><h2>Minhas captações</h2>{myUnits.map((unit) => <button type="button" key={unit.id} onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}><strong>{unit.predio} · Un. {unit.numero ?? "s/n"}{unit.codigo ? ` · ${unit.codigo}` : ""}</strong><span>{unit.approval === "reprovado" ? "Correção solicitada" : "Aguardando aprovação"}</span>{unit.rejectionReason && <small>{unit.rejectionReason}</small>}</button>)}</section>}
    {canApprove && approvalFilter && pendingUnitsVisiveis.length > 0 && <section className="ape-mobile-captacoes"><h2>Unidades para aprovar</h2>{pendingUnitsVisiveis.map((unit) => <div key={unit.id}><button type="button" onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}><strong>{unit.predio} · Un. {unit.numero ?? "s/n"}</strong><span>{unit.indicador ?? "Sem captador"}</span></button><div><button type="button" onClick={() => void decideUnitFromList(unit.empreendimentoId, unit.id, true)}>✓ Aprovar</button><button type="button" onClick={() => void decideUnitFromList(unit.empreendimentoId, unit.id, false)}>✕ Reprovar</button></div></div>)}</section>}

    {dataState === "live" && produtosVisiveis.length > 0 && <section className="ape-produto-lista">
      {produtosVisiveis.map((product) => {
        const linkSite = product.published && product.id ? `https://apecerto.com/?imovel=${encodeURIComponent(product.slug || product.id)}${product.codigo ? `&cod=${encodeURIComponent(product.codigo)}` : ""}` : null;
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
<>
      <header className="topbar">
        <div><h1>Produtos</h1><p>{buildingCount} empreendimentos · {products.length} imóveis no catálogo</p></div>
        <div className="top-actions"><button className="secondary-action" onClick={exportCatalog} type="button">↓ Exportar</button><button className="secondary-action" onClick={() => setCaptureOpen(true)} type="button">＋ Cadastrar condomínio</button><button className="primary-action" onClick={() => setUnitWizardOpen(true)} type="button">＋ Cadastrar apartamento</button></div>
      </header>
      <section className="product-entry-guide" aria-label="Qual cadastro devo usar?">
        <div><strong>Apartamento em condomínio existente</strong><span>Use para captar uma unidade específica de um proprietário.</span></div>
        <div><strong>Imóvel sem condomínio</strong><span>Casa, apartamento avulso, sala ou terreno com endereço próprio.</span></div>
        <div><strong>Condomínio ou prédio novo</strong><span>Use para cadastrar o edifício, lançamento ou estoque da construtora.</span></div>
      </section>
      {!approvalFilter && <section className="product-quality-overview" aria-label="Saúde do portfólio">
        <button type="button" className={qualityFilter === "Todas" ? "active" : ""} onClick={() => setQualityFilter("Todas")}><span>Nota média</span><strong>{qualitySummary.average}</strong><small>de 100</small></button>
        <button type="button" className={qualityFilter === "excelente" ? "active" : ""} onClick={() => setQualityFilter("excelente")}><span>Excelentes</span><strong>{qualitySummary.excellent}</strong><small>90 a 100</small></button>
        <button type="button" className={qualityFilter === "bom" ? "active" : ""} onClick={() => setQualityFilter("bom")}><span>Bons</span><strong>{qualitySummary.good}</strong><small>75 a 89</small></button>
        <button type="button" className={qualityFilter === "atencao" ? "active" : ""} onClick={() => setQualityFilter("atencao")}><span>Com atenção</span><strong>{qualitySummary.attention}</strong><small>60 a 74</small></button>
        <button type="button" className={qualityFilter === "critico" ? "active" : ""} onClick={() => setQualityFilter("critico")}><span>Críticos</span><strong>{qualitySummary.critical}</strong><small>prioridade</small></button>
        <button type="button" className={publicationFilter === "ready" ? "active" : ""} onClick={() => { setQualityFilter("Todas"); setPublicationFilter(publicationFilter === "ready" ? "Todos" : "ready"); }}><span>Prontos para o site</span><strong>{qualitySummary.readyForSite}</strong><small>sem bloqueios</small></button>
      </section>}
      <section className="catalog-controls">
        <div className="catalog-heading"><nav className="catalog-view-tabs" aria-label="Visão de produtos"><button type="button" className={!approvalFilter ? "active" : ""} onClick={showCatalog}>Catálogo</button>{canApprove && <button type="button" className={approvalFilter ? "active" : ""} onClick={showApprovalQueue}>Fila de aprovação <b>{pendingCount + pendingUnits.length}</b></button>}</nav><span className={`data-status ${dataState}`}>{dataState === "live" ? "● Dados reais · sessão protegida" : dataState === "loading" ? "○ Conectando ao Supabase..." : dataState === "auth" ? "○ Login necessário" : "○ Erro de conexão"}</span></div>
        {!approvalFilter && <div className="filter-row quick-filters">
          {['Todos', 'Lançamento', 'Em obras', 'Pronto'].map((item) => <button className={!favoritesOnly && !mineOnly && status === item ? "active" : ""} onClick={() => { setStatus(item); setFavoritesOnly(false); setMineOnly(false); }} type="button" key={item}>{item}</button>)}
          <button className={favoritesOnly ? "favorite-filter active" : "favorite-filter"} onClick={() => { setFavoritesOnly(!favoritesOnly); setMineOnly(false); }} type="button">★ Favoritos</button>
          <button className={mineOnly ? "mine-filter active" : "mine-filter"} onClick={() => { setMineOnly(!mineOnly); setFavoritesOnly(false); }} type="button">Meus imóveis</button>
        </div>}
        <div className="filter-row filter-primary">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, código AP, rua ou incorporadora..." />
          <select aria-label="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="Todos">Todos os bairros</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select>
          {canApprove && <select aria-label="Captador" value={captadorFilter} onChange={(event) => setCaptadorFilter(event.target.value)}><option value="Todos">Todos os captadores</option>{captadores.map((item) => <option key={item}>{item}</option>)}</select>}
          {!approvalFilter && <button className={moreFiltersOpen ? "active" : ""} type="button" onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}>Mais filtros {moreFiltersOpen ? "▲" : "▼"}</button>}
          {hasActiveFilters && <button className="secondary-action clear-product-filters" type="button" onClick={clearFilters}>Limpar</button>}
          <span className="product-count">{approvalFilter ? `${pendingUnitsVisiveis.length + produtosVisiveis.length} aguardando` : `${produtosVisiveis.length} imóveis`}</span>
        </div>
        {!approvalFilter && moreFiltersOpen && <div className="filter-row filter-advanced">
          <select aria-label="Incorporadora" value={developer} onChange={(event) => setDeveloper(event.target.value)}><option value="Todas">Todas as incorporadoras</option>{developers.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Faixa de preço" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}><option>Todas</option><option>Até 500 mil</option><option>500 mil a 1 mi</option><option>Acima de 1 mi</option></select>
          <select aria-label="Dormitórios" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="Qualquer">Qualquer dorm.</option><option value="0">Studio</option><option value="1">1 dorm.</option><option value="2">2 dorm.</option><option value="3">3 dorm.</option><option value="4">4+ dorm.</option></select>
          <select aria-label="Publicação" value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value)}><option value="Todos">Todos os produtos</option><option value="site">Publicados no site</option><option value="ready">Prontos para publicar</option><option value="blocked">Bloqueados para publicação</option></select>
          <select aria-label="Ordenação" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="quality-asc">Menor nota primeiro</option><option value="quality-desc">Maior nota primeiro</option><option value="updated">Atualizados recentemente</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select>
          <label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} /> Com estoque disponível</label>
          <label className="toggle"><input type="checkbox" checked={noMediaOnly} onChange={(event) => setNoMediaOnly(event.target.checked)} /> Sem nenhuma mídia</label>
        </div>}
      </section>
      {canApprove && approvalFilter && <div className="pendentes-resumo"><strong>{pendingUnitsVisiveis.length + produtosVisiveis.length} aguardando aprovação</strong><span>{pendingUnitsVisiveis.length} apartamento(s) + {produtosVisiveis.length} condomínio(s). A fila está aberta por completo.</span></div>}
      {canApprove && approvalFilter && pendingUnitsVisiveis.length > 0 && <section className="pending-units">
        <h3>Apartamentos para aprovar <span>{pendingUnitsVisiveis.length}</span></h3>
        <p className="pu-sub">Captações individuais aguardando a validação da gestão.</p>
        <div className={puExpandida ? "pu-list expandida" : "pu-list"}>{pendingUnitsVisiveis.map((pu) => <div className="pu-row" key={pu.id}>
          <div className="pu-thumb" style={pu.coverUrl ? { backgroundImage: `url(${pu.coverUrl})` } : undefined}>{!pu.coverUrl && "▥"}</div>
          <div className="pu-main"><strong>{pu.numero || "Unidade"} <span className="pu-chip">Indicação</span></strong><small>{pu.predio} · 👤 {pu.indicador ?? "—"} · Prop.: {pu.proprietario ?? "—"}</small></div>
          <div className="pu-actions"><button type="button" className="pu-approve" onClick={() => void decideUnitFromList(pu.empreendimentoId, pu.id, true)}>✓ Aprovar</button><button type="button" className="pu-reject" onClick={() => void decideUnitFromList(pu.empreendimentoId, pu.id, false)}>✕ Reprovar</button><button type="button" className="pu-rev" onClick={() => { setInitialUnitId(pu.id); setSelectedProductId(pu.empreendimentoId); }}>Revisar</button></div>
        </div>)}</div>
      </section>}
      {myUnits.length > 0 && <section className="pending-units my-captured-units">
        <h3>Minhas captações em análise ou correção <span>{myUnits.length}</span></h3>
        <p className="pu-sub">Acompanhe cada unidade individual sem depender da ficha do condomínio.</p>
        <button type="button" className="pu-toggle" onClick={() => setMyUnitsOpen(!myUnitsOpen)}>{myUnitsOpen ? "▲ Recolher lista" : `▼ Ver minhas ${myUnits.length} captações`}</button>
        {myUnitsOpen && <div className="pu-list expandida">{myUnits.map((unit) => <div className="pu-row" key={unit.id}>
          <div className="pu-thumb" style={unit.coverUrl ? { backgroundImage: `url(${unit.coverUrl})` } : undefined}>{!unit.coverUrl && "▥"}</div>
          <div className="pu-main"><strong>{unit.predio} · Un. {unit.numero || "s/n"} {unit.codigo && <span className="cod-imovel">{unit.codigo}</span>}</strong><small>{unit.approval === "reprovado" ? `Correção solicitada: ${unit.rejectionReason || "revise os dados"}` : "Aguardando aprovação da gestão"}</small></div>
          <div className="pu-actions"><button type="button" className="pu-rev" onClick={() => { setInitialUnitId(unit.id); setSelectedProductId(unit.empreendimentoId); }}>Abrir e editar</button></div>
        </div>)}</div>}
      </section>}
      {approvalFilter && produtosVisiveis.length > 0 && <h2 className="approval-building-title">Condomínios para aprovar <span>{produtosVisiveis.length}</span></h2>}
      <section className="product-grid">
        {produtosVisiveis.map((product) => <article className={`product-card ${product.draft ? "t-lanc" : /obra/i.test(product.status ?? "") ? "t-obras" : /lan[cç]/i.test(product.status ?? "") ? "t-lanc" : "t-pronto"}`} role="button" tabIndex={0} onClick={() => { if (product.id) { setInitialUnitId(product.unitId ?? null); setSelectedProductId(product.id); } }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && product.id) { setInitialUnitId(product.unitId ?? null); setSelectedProductId(product.id); } }} key={product.unitId ?? product.id ?? product.name}>
          <div className={`product-photo ${product.coverUrl ? "has-image" : ""}`}>
            {product.coverUrl && <img src={product.coverUrl} alt={`Foto de capa de ${product.name}`} />}
            <span>{product.draft ? "Rascunho" : product.status?.replace("_", " ") ?? "Pronto"}</span>
            {product.quality && <span className={`quality-badge quality-on-photo ${product.quality.level}`}>Nota {product.quality.score}</span>}
            {product.approval && product.approval !== "aprovado" && <span className={`approval-badge ${product.approval}`}>{product.approval === "pendente" ? "⏳ Pendente" : "✕ Reprovado"}</span>}
            {!product.coverUrl && <div className="building-icon">▥</div>}
            <div className="card-menu" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="card-menu-btn" aria-haspopup="true" aria-label={`Ações de ${product.name}`} onClick={(event) => { event.stopPropagation(); const key = product.unitId ?? product.id ?? null; setOpenMenuId(openMenuId === key ? null : key); }}>•••</button>
              {openMenuId === (product.unitId ?? product.id) && product.id && <div className="card-menu-pop" role="menu">
                <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); setOpenInEdit(false); setInitialUnitId(product.unitId ?? null); setSelectedProductId(product.id!); }}>Abrir ficha</button>
                {product.published && <button type="button" role="menuitem" onClick={() => { const link = `https://apecerto.com/?imovel=${encodeURIComponent(product.slug || product.id!)}${product.codigo ? `&cod=${encodeURIComponent(product.codigo)}` : ""}`; void navigator.clipboard.writeText(link); setOpenMenuId(null); }}>Copiar link do site</button>}
                {canApprove && product.published && <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenuId(null); setPublicationTarget(product); }}>Tirar imóvel do ar</button>}
                {canApprove && !product.published && product.approval === "aprovado" && product.quality?.readyForSite && <button type="button" role="menuitem" onClick={() => void changePublicationFromCard(product, true)}>Publicar no site</button>}
                {(canApprove || product.mine) && <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); setOpenInEdit(!product.unitId); setInitialUnitId(product.unitId ?? null); setSelectedProductId(product.id!); }}>{product.unitId ? "Editar unidade" : "Editar produto"}</button>}
                {canApprove && !product.unitId && <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenuId(null); setDeleteTarget(product); }}>Excluir</button>}
              </div>}
            </div>
          </div>
          <div className="product-info"><strong className="price">{product.price}</strong><h2>{product.name}{product.codigo && <span className="cod-imovel">{product.codigo}</span>}</h2><p className="location">⌖ {product.neighborhood} · {product.city}</p>{product.developer && <p className="developer">{product.developer}</p>}
            <div className="specs"><span className="s-area"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M9 3v4"/><path d="M15 17v4"/><path d="M3 9h4"/><path d="M17 15h4"/></svg>{product.area} m²</span><span className="s-dorm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6"/><path d="M4 18v3"/><path d="M20 18v3"/><path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/></svg>{product.bedrooms} dorm.</span><span className="s-vaga"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17h14"/><path d="M6 17v2"/><path d="M18 17v2"/><path d="M4 17l1.5-5.5A2 2 0 0 1 7.4 10h9.2a2 2 0 0 1 1.9 1.5L20 17z"/></svg>{product.parking} vaga</span></div>
            <div className="estoque"><div className="estoque-top"><strong>{product.available} de {product.units ?? 0} disponíveis</strong><span>{mediaInventoryLabel(product)}</span></div><div className="estoque-bar"><i style={{ width: `${product.units ? Math.min(100, Math.round((product.available / product.units) * 100)) : 0}%` }} /></div></div>
            {product.topIssue && <p className="product-top-issue">⚠ {product.topIssue}</p>}{product.approval === "reprovado" && product.rejectionReason && <p className="approval-reason">Motivo: {product.rejectionReason}</p>}{canApprove && product.approval === "pendente" && product.capturedBy && <p className="approval-captador">👤 Captado por: {product.capturedBy}{typeof product.capturedByScore === "number" ? <span className="captador-nota"> · nota {product.capturedByScore}</span> : null}</p>}{canApprove && product.approval === "pendente" && product.id && <div className="approval-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="ap-approve" disabled={!product.quality?.readyForSite} title={product.quality?.readyForSite ? "Aprovar e publicar no site" : (product.quality?.blocking?.join(" · ") || "Complete o cadastro antes de aprovar")} onClick={() => decideFromCard(product.id!, true)}>✓ Aprovar</button><button type="button" className="ap-reject" onClick={() => decideFromCard(product.id!, false)}>✕ Reprovar</button></div>}<footer><strong>{product.priceM2}</strong><span>{product.leads > 0 ? `${product.leads} lead(s) vinculado(s) · ` : ""}{product.published ? "● Publicado no site" : product.approval === "aprovado" && product.quality?.readyForSite ? "○ Fora do ar · pode editar" : product.quality?.readyForSite ? "Pronto para publicar" : "Cadastro incompleto"}</span></footer></div></article>)}
      </section>
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
      </>
  );
}
