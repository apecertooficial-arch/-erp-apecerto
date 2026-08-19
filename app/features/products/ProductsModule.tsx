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
  catalog: Array<{
    id: string; name: string; title?: string | null; slug?: string | null; purpose?: string | null; address?: string | null; developer: string | null; neighborhood: string; city: string;
    status: string; price: number | null; area: number | null; bedrooms: number | null;
    parking: number | null; available: number; units: number; media: number;
    coverUrl: string | null; draft: boolean; origin: string; favorite: boolean;
    approval?: string; rejectionReason?: string | null; mine?: boolean; capturedBy?: string | null;
    published?: boolean; quality: ProductQuality; topIssue?: string | null; createdAt?: string | null; updatedAt?: string | null;
    leads?: number;
  }>;
  qualitySummary?: { excellent: number; good: number; attention: number; critical: number; readyForSite: number; average: number };
  canApprove?: boolean;
  pendingCount?: number;
  pendingUnits?: Array<{ id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
  const [unitWizardOpen, setUnitWizardOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingUnits, setPendingUnits] = useState<NonNullable<CatalogResponse["pendingUnits"]>>([]);
  const [initialUnitId, setInitialUnitId] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState(false);
  const [qualityFilter, setQualityFilter] = useState("Todas");
  const [publicationFilter, setPublicationFilter] = useState("Todos");
  const [sortBy, setSortBy] = useState("quality-asc");
  const [dataState, setDataState] = useState<"loading" | "live" | "auth" | "error">("loading");
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

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
        units: item.units, media: item.media, coverUrl: item.coverUrl, draft: item.draft,
        origin: item.origin, numericPrice: item.price, favorite: item.favorite,
        approval: item.approval ?? "aprovado", rejectionReason: item.rejectionReason ?? null,
        mine: item.mine ?? false, capturedBy: item.capturedBy ?? null,
        published: item.published, quality: item.quality, topIssue: item.topIssue ?? null,
        createdAt: item.createdAt ?? null, updatedAt: item.updatedAt ?? null,
      })));
      setCanApprove(Boolean(result.canApprove));
      setPendingCount(result.pendingCount ?? 0);
      setPendingUnits(result.pendingUnits ?? []);
      setDataState("live");
      setAtualizadoEm(new Date());
    } catch {
      setDataState("error");
    }
  }, []);

  useEffect(() => { void loadCatalog(accessToken); }, [accessToken, loadCatalog]);

  useEffect(() => {
    publicarBadge("Produtos", canApprove ? pendingCount + pendingUnits.length : 0);
  }, [canApprove, pendingCount, pendingUnits, publicarBadge]);

  const filtered = useMemo(() => products.filter((product) => {
    const queryKey = normalizedKey(query);
    const matchesQuery = !queryKey || [product.name, product.title, product.address, product.neighborhood, product.city, product.developer]
      .some((value) => normalizedKey(value).includes(queryKey));
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("_", " ").toLowerCase();
    const matchesStatus = status === "Todos" || normalize(product.status ?? "") === normalize(status);
    const matchesNeighborhood = neighborhood === "Todos" || normalizedKey(product.neighborhood) === normalizedKey(neighborhood);
    const matchesDeveloper = developer === "Todas" || normalizedKey(product.developer) === normalizedKey(developer);
    const matchesBedrooms = bedrooms === "Qualquer" || (bedrooms === "4" ? product.bedrooms >= 4 : product.bedrooms === Number(bedrooms));
    const matchesStock = !stockOnly || product.available > 0;
    const matchesFavorite = !favoritesOnly || product.favorite;
    const matchesMedia = !noMediaOnly || (product.media ?? 0) === 0;
    const price = product.numericPrice ?? 0;
    const matchesPrice = priceBand === "Todas" || (priceBand === "Até 500 mil" ? price > 0 && price <= 500000 : priceBand === "500 mil a 1 mi" ? price > 500000 && price <= 1000000 : price > 1000000);
    const matchesQuality = qualityFilter === "Todas" || product.quality?.level === qualityFilter;
    const matchesPublication = publicationFilter === "Todos"
      || (publicationFilter === "site" ? product.published : publicationFilter === "ready" ? product.quality?.readyForSite && !product.published : !product.quality?.readyForSite);
    return matchesQuery && matchesStatus && matchesNeighborhood && matchesDeveloper && matchesBedrooms && matchesStock && matchesPrice && matchesFavorite && matchesMedia && matchesQuality && matchesPublication;
  }).sort((a, b) => {
    if (sortBy === "quality-asc") return (a.quality?.score ?? 0) - (b.quality?.score ?? 0);
    if (sortBy === "quality-desc") return (b.quality?.score ?? 0) - (a.quality?.score ?? 0);
    if (sortBy === "price-asc") return (a.numericPrice ?? Number.MAX_SAFE_INTEGER) - (b.numericPrice ?? Number.MAX_SAFE_INTEGER);
    if (sortBy === "price-desc") return (b.numericPrice ?? 0) - (a.numericPrice ?? 0);
    return Date.parse(b.updatedAt ?? b.createdAt ?? "") - Date.parse(a.updatedAt ?? a.createdAt ?? "");
  }), [products, query, status, neighborhood, developer, bedrooms, stockOnly, priceBand, favoritesOnly, noMediaOnly, qualityFilter, publicationFilter, sortBy]);

  const neighborhoods = useMemo(() => Array.from(new Map(products.map((item) => [normalizedKey(item.neighborhood), item.neighborhood])).values()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);
  const developers = useMemo(() => Array.from(new Map(products.filter((item) => Boolean(item.developer)).map((item) => [normalizedKey(item.developer), item.developer as string])).values()).sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);
  const qualitySummary = useMemo(() => ({
    excellent: products.filter((item) => item.quality?.level === "excelente").length,
    good: products.filter((item) => item.quality?.level === "bom").length,
    attention: products.filter((item) => item.quality?.level === "atencao").length,
    critical: products.filter((item) => item.quality?.level === "critico").length,
    readyForSite: products.filter((item) => item.quality?.readyForSite && !item.published).length,
    average: products.length ? Math.round(products.reduce((sum, item) => sum + (item.quality?.score ?? 0), 0) / products.length) : 0,
  }), [products]);

  // Uma unidade pendente de indicação NUNCA aparece fora da aba "Pendentes de
  // aprovação" — antes ela também entrava em Todos/Lançamento/etc. porque o
  // filtro só isolava pendentes quando approvalFilter estava ligado, mas
  // deixava passar tudo (pendentes inclusos) quando estava desligado.
  const produtosVisiveis = filtered.filter((product) => {
    const pendenteDeRevisao = product.approval === "pendente" && !product.draft;
    return approvalFilter ? pendenteDeRevisao : !pendenteDeRevisao;
  });

  function exportCatalog() {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["Produto", "Bairro", "Cidade", "Incorporadora", "Preço", "Área", "Unidades disponíveis", "Leads", "Nota", "Qualidade", "No site", "Principal pendência"];
    const rows = produtosVisiveis.map((item) => [item.name, item.neighborhood, item.city, item.developer, item.numericPrice, item.area, item.available, item.leads, item.quality?.score, item.quality?.label, item.published ? "Sim" : "Não", item.topIssue]);
    const blob = new Blob(["\uFEFF", [header, ...rows].map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `catalogo-apecerto-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  const hasActiveFilters = Boolean(query || status !== "Todos" || neighborhood !== "Todos" || developer !== "Todas"
    || priceBand !== "Todas" || bedrooms !== "Qualquer" || stockOnly || favoritesOnly || noMediaOnly
    || approvalFilter || qualityFilter !== "Todas" || publicationFilter !== "Todos" || sortBy !== "quality-asc");

  function clearFilters() {
    setQuery(""); setStatus("Todos"); setNeighborhood("Todos"); setDeveloper("Todas"); setPriceBand("Todas");
    setBedrooms("Qualquer"); setStockOnly(false); setFavoritesOnly(false); setNoMediaOnly(false); setApprovalFilter(false);
    setQualityFilter("Todas"); setPublicationFilter("Todos"); setSortBy("quality-asc");
  }

  if (ehCelular === null) return null;
  if (ehCelular && dataState === "auth") return <AppMobileSessaoExpirada />;
  if (ehCelular) return <main className="ape-produtos">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <label className="ape-produto-busca">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empreendimento ou rua" />
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

    {dataState === "live" && produtosVisiveis.length > 0 && <section className="ape-produto-lista">
      {produtosVisiveis.map((product) => {
        const compartilhar = encodeURIComponent(`${product.name} — ${product.neighborhood}, ${product.city} — ${product.price}`);
        return <article className="ape-produto-card" key={product.id ?? product.name}>
          <button type="button" className={`ape-produto-foto${product.coverUrl ? " com-foto" : ""}`} onClick={() => product.id && setSelectedProductId(product.id)} aria-label={`Abrir ${product.name}`}>
            {product.coverUrl ? <img src={product.coverUrl} alt={`Foto de ${product.name}`} /> : <span aria-hidden="true">▥</span>}
            <em>{product.draft ? "Rascunho" : product.status?.replaceAll("_", " ") || "Produto"}</em>
          </button>
          <div className="ape-produto-info">
            <strong className="ape-produto-preco">{product.price}</strong>
            <h2>{product.name} {product.quality && <span className={`quality-badge ${product.quality.level}`}>{product.quality.score}</span>}</h2>
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
            <a href={`https://wa.me/?text=${compartilhar}`} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a>
            <button type="button" onClick={() => product.id && setSelectedProductId(product.id)} aria-label={`Ver detalhes de ${product.name}`}>•••</button>
          </div>
        </article>;
      })}
    </section>}
    {selectedProductId && <ProductDetail productId={selectedProductId} accessToken={accessToken} sessionRole={role} initialUnitId={initialUnitId} onClose={() => { setSelectedProductId(null); setInitialUnitId(null); }} onChanged={() => void loadCatalog(accessToken)} />}
  </main>;

  return (
<>
      <header className="topbar">
        <div><h1>Produtos</h1><p>{products.length} empreendimentos no portfólio</p></div>
        <div className="top-actions"><button className="secondary-action" onClick={exportCatalog} type="button">↓ Exportar catálogo</button><button className="secondary-action" onClick={() => setUnitWizardOpen(true)} type="button">＋ Cadastrar unidade</button><button className="primary-action" onClick={() => setCaptureOpen(true)} type="button">＋ Cadastrar condomínio</button></div>
      </header>
      <section className="product-quality-overview" aria-label="Saúde do portfólio">
        <button type="button" className={qualityFilter === "Todas" ? "active" : ""} onClick={() => setQualityFilter("Todas")}><span>Nota média</span><strong>{qualitySummary.average}</strong><small>de 100</small></button>
        <button type="button" className={qualityFilter === "excelente" ? "active" : ""} onClick={() => setQualityFilter("excelente")}><span>Excelentes</span><strong>{qualitySummary.excellent}</strong><small>90 a 100</small></button>
        <button type="button" className={qualityFilter === "bom" ? "active" : ""} onClick={() => setQualityFilter("bom")}><span>Bons</span><strong>{qualitySummary.good}</strong><small>75 a 89</small></button>
        <button type="button" className={qualityFilter === "atencao" ? "active" : ""} onClick={() => setQualityFilter("atencao")}><span>Com atenção</span><strong>{qualitySummary.attention}</strong><small>60 a 74</small></button>
        <button type="button" className={qualityFilter === "critico" ? "active" : ""} onClick={() => setQualityFilter("critico")}><span>Críticos</span><strong>{qualitySummary.critical}</strong><small>prioridade</small></button>
        <button type="button" className={publicationFilter === "ready" ? "active" : ""} onClick={() => { setQualityFilter("Todas"); setPublicationFilter(publicationFilter === "ready" ? "Todos" : "ready"); }}><span>Prontos para o site</span><strong>{qualitySummary.readyForSite}</strong><small>sem bloqueios</small></button>
      </section>
      <section className="catalog-controls">
        <div className="catalog-heading"><strong className="catalog-title">Catálogo</strong><span className={`data-status ${dataState}`}>{dataState === "live" ? "● Dados reais · sessão protegida" : dataState === "loading" ? "○ Conectando ao Supabase..." : dataState === "auth" ? "○ Login necessário" : "○ Erro de conexão"}</span></div>
        <div className="filter-row">
          <span className="filter-symbol">▽</span>
          {["Todos", "Lançamento", "Em obras", "Pronto"].map((item) => <button className={status === item ? "active" : ""} onClick={() => setStatus(item)} type="button" key={item}>{item}</button>)}
          <button className={favoritesOnly ? "favorite-filter active" : "favorite-filter"} onClick={() => setFavoritesOnly(!favoritesOnly)} type="button">★ Meus favoritos</button>
          {canApprove && <button className={approvalFilter ? "approval-filter active" : "approval-filter"} onClick={() => setApprovalFilter((v) => !v)} type="button">⏳ Pendentes de aprovação{(pendingCount + pendingUnits.length) > 0 && <b>{pendingCount + pendingUnits.length}</b>}</button>}
        </div>
        <div className="filter-row selects"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, título, rua ou incorporadora..." /><select aria-label="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="Todos">Todos os bairros</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Incorporadora" value={developer} onChange={(event) => setDeveloper(event.target.value)}><option value="Todas">Todas as incorporadoras</option>{developers.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Faixa de preço" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}><option>Todas</option><option>Até 500 mil</option><option>500 mil a 1 mi</option><option>Acima de 1 mi</option></select><select aria-label="Dormitórios" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="Qualquer">Qualquer dorm.</option><option value="0">Studio</option><option value="1">1 dorm.</option><option value="2">2 dorm.</option><option value="3">3 dorm.</option><option value="4">4+ dorm.</option></select><select aria-label="Publicação" value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value)}><option value="Todos">Todos os produtos</option><option value="site">Publicados no site</option><option value="ready">Prontos para publicar</option><option value="blocked">Bloqueados para publicação</option></select><select aria-label="Ordenação" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="quality-asc">Menor nota primeiro</option><option value="quality-desc">Maior nota primeiro</option><option value="updated">Atualizados recentemente</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select><label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} /> Com estoque disponível</label><label className="toggle"><input type="checkbox" checked={noMediaOnly} onChange={(event) => setNoMediaOnly(event.target.checked)} /> Sem nenhuma mídia</label>{hasActiveFilters && <button className="secondary-action clear-product-filters" type="button" onClick={clearFilters}>Limpar filtros</button>}<span className="product-count">{filtered.length} produtos exibidos</span></div>
      </section>
      {canApprove && approvalFilter && pendingUnits.length > 0 && <section className="pending-units">
        <h3>Unidades pendentes de aprovação <span>{pendingUnits.length}</span></h3>
        <p className="pu-sub">Solicitações de indicação aguardando sua validação.</p>
        {pendingUnits.map((pu) => <div className="pu-row" key={pu.id}>
          <div className="pu-thumb" style={pu.coverUrl ? { backgroundImage: `url(${pu.coverUrl})` } : undefined}>{!pu.coverUrl && "▥"}</div>
          <div className="pu-main"><strong>{pu.numero || "Unidade"} <span className="pu-chip">Indicação</span></strong><small>{pu.predio} · 👤 {pu.indicador ?? "—"} · Prop.: {pu.proprietario ?? "—"}</small></div>
          <button type="button" className="pu-rev" onClick={() => { setInitialUnitId(pu.id); setSelectedProductId(pu.empreendimentoId); }}>Revisar</button>
        </div>)}
      </section>}
      <section className="product-grid">
        {produtosVisiveis.map((product) => <article className={`product-card ${product.draft ? "t-lanc" : /obra/i.test(product.status ?? "") ? "t-obras" : /lan[cç]/i.test(product.status ?? "") ? "t-lanc" : "t-pronto"}`} role="button" tabIndex={0} onClick={() => product.id && setSelectedProductId(product.id)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && product.id) setSelectedProductId(product.id); }} key={product.id ?? product.name}>
          <div className={`product-photo ${product.coverUrl ? "has-image" : ""}`}>{product.coverUrl && <img src={product.coverUrl} alt={`Foto de capa de ${product.name}`} />}<span>{product.draft ? "Rascunho" : product.status?.replace("_", " ") ?? "Pronto"}</span>{product.quality && <span className={`quality-badge quality-on-photo ${product.quality.level}`}>Nota {product.quality.score}</span>}{!product.draft && product.approval && product.approval !== "aprovado" && <span className={`approval-badge ${product.approval}`}>{product.approval === "pendente" ? "⏳ Pendente" : "✕ Reprovado"}</span>}{!product.coverUrl && <div className="building-icon">▥</div>}<button type="button" onClick={(event) => { event.stopPropagation(); if (product.id) setSelectedProductId(product.id); }} aria-label={`Abrir ficha de ${product.name}`}>•••</button></div>
          <div className="product-info"><strong className="price">{product.price}</strong><h2>{product.name}</h2><p className="location">⌖ {product.neighborhood} · {product.city}</p>{product.developer && <p className="developer">{product.developer}</p>}
            <div className="specs"><span className="s-area"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M9 3v4"/><path d="M15 17v4"/><path d="M3 9h4"/><path d="M17 15h4"/></svg>{product.area} m²</span><span className="s-dorm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6"/><path d="M4 18v3"/><path d="M20 18v3"/><path d="M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/></svg>{product.bedrooms} dorm.</span><span className="s-vaga"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17h14"/><path d="M6 17v2"/><path d="M18 17v2"/><path d="M4 17l1.5-5.5A2 2 0 0 1 7.4 10h9.2a2 2 0 0 1 1.9 1.5L20 17z"/></svg>{product.parking} vaga</span></div>
            <div className="estoque"><div className="estoque-top"><strong>{product.available} de {product.units ?? 0} disponíveis</strong><span>{product.media ?? 0} mídias</span></div><div className="estoque-bar"><i style={{ width: `${product.units ? Math.min(100, Math.round((product.available / product.units) * 100)) : 0}%` }} /></div></div>
            {product.topIssue && <p className="product-top-issue">⚠ {product.topIssue}</p>}{product.approval === "reprovado" && product.rejectionReason && <p className="approval-reason">Motivo: {product.rejectionReason}</p>}{canApprove && product.approval === "pendente" && !product.draft && <p className="approval-captador">👤 Captado por: {product.capturedBy ?? "Não informado"}</p>}{canApprove && product.approval === "pendente" && !product.draft && product.id && <div className="approval-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="ap-review" onClick={() => setSelectedProductId(product.id!)}>Revisar ficha para aprovar</button></div>}<footer><strong>{product.priceM2}</strong><span>{product.leads > 0 ? `${product.leads} lead(s) vinculado(s) · ` : ""}{product.published ? "● Publicado no site" : product.quality?.readyForSite ? "Pronto para publicar" : "Cadastro incompleto"}</span></footer></div></article>)}
      </section>
      {captureOpen && <CaptureWizard onClose={() => setCaptureOpen(false)} onSaved={() => {
        setCaptureOpen(false);
        if (accessToken) void loadCatalog(accessToken);
      }} />}
      {unitWizardOpen && accessToken && <UnitWizard accessToken={accessToken} onClose={() => setUnitWizardOpen(false)} onSaved={() => {
        setUnitWizardOpen(false);
        if (accessToken) void loadCatalog(accessToken);
      }} />}
      {selectedProductId && accessToken && <ProductDetail productId={selectedProductId} accessToken={accessToken} sessionRole={role} initialUnitId={initialUnitId} onClose={() => { setSelectedProductId(null); setInitialUnitId(null); }} onChanged={() => void loadCatalog(accessToken)} />}
      </>
  );
}
