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
import { products as fallbackProducts, type Product } from "./products";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { useErpSession } from "../system/ErpSession";

type CatalogResponse = {
  mode: string;
  count: number;
  catalog: Array<{
    id: string; name: string; developer: string | null; neighborhood: string; city: string;
    status: string; price: number | null; area: number | null; bedrooms: number | null;
    parking: number | null; available: number; units: number; media: number;
    coverUrl: string | null; draft: boolean; origin: string; favorite: boolean;
    approval?: string; rejectionReason?: string | null; mine?: boolean; capturedBy?: string | null;
    priceMax: number | null; areaMax: number | null; typologies: string[]; stockValue: number;
  }>;
  canApprove?: boolean;
  pendingCount?: number;
  pendingUnits?: Array<{ id: string; numero: string | null; tipologia: string | null; valor: number | null; empreendimentoId: string; predio: string; proprietario: string | null; indicador: string | null; coverUrl: string | null }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const kurto = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (n >= 1e6) return "R$ " + (n / 1e6).toFixed(1).replace(".", ",") + " mi";
  return "R$ " + Math.round(n / 1e3) + " mil";
};

export function ProductsModule({ accessToken }: { accessToken: string }) {
  const { publicarBadge, role } = useErpSession();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [neighborhood, setNeighborhood] = useState("Todos");
  const [developer, setDeveloper] = useState("Todas");
  const [priceBand, setPriceBand] = useState("Todas");
  const [bedrooms, setBedrooms] = useState("Qualquer");
  const [stockOnly, setStockOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [noMediaOnly, setNoMediaOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState("disp");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [unitWizardOpen, setUnitWizardOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [canApprove, setCanApprove] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingUnits, setPendingUnits] = useState<NonNullable<CatalogResponse["pendingUnits"]>>([]);
  const [initialUnitId, setInitialUnitId] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [dataState, setDataState] = useState<"loading" | "live" | "auth" | "error">("loading");

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
        id: item.id, name: item.name, developer: item.developer,
        price: item.price === null ? "Preço sob consulta" : currency.format(item.price),
        neighborhood: item.neighborhood, city: item.city, status: item.status,
        area: item.area ?? 0, bedrooms: item.bedrooms ?? 0, parking: item.parking ?? 0,
        available: item.available, leads: 0,
        priceM2: item.price && item.area ? `${currency.format(item.price / item.area)}/m²` : "—",
        units: item.units, media: item.media, coverUrl: item.coverUrl, draft: item.draft,
        origin: item.origin, numericPrice: item.price, favorite: item.favorite,
        approval: item.approval ?? "aprovado", rejectionReason: item.rejectionReason ?? null,
        mine: item.mine ?? false, capturedBy: item.capturedBy ?? null,
        priceMax: item.priceMax, areaMax: item.areaMax, typologies: item.typologies, stockValue: item.stockValue
      })));
      setCanApprove(Boolean(result.canApprove));
      setPendingCount(result.pendingCount ?? 0);
      setPendingUnits(result.pendingUnits ?? []);
      setDataState("live");
    } catch {
      setDataState("error");
    }
  }, []);

  useEffect(() => { void loadCatalog(accessToken); }, [accessToken, loadCatalog]);

  useEffect(() => {
    publicarBadge("Produtos", canApprove ? pendingCount + pendingUnits.length : 0);
  }, [canApprove, pendingCount, pendingUnits, publicarBadge]);

  const decide = useCallback(async (id: string, approve: boolean) => {
    let motivo: string | null = null;
    if (!approve) { motivo = window.prompt("Motivo da reprovação (opcional):", "") ?? ""; }
    setDecidingId(id);
    try {
      const response = await fetch("/api/capture", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: approve ? "approve" : "reject", id, motivo }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
      await loadCatalog(accessToken);
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : "Não foi possível concluir a aprovação."); }
    finally { setDecidingId(null); }
  }, [accessToken, loadCatalog]);

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase()) || product.neighborhood.toLowerCase().includes(query.toLowerCase());
      const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("_", " ").toLowerCase();
      const matchesStatus = status === "Todos" || normalize(product.status ?? "") === normalize(status);
      const matchesNeighborhood = neighborhood === "Todos" || product.neighborhood === neighborhood;
      const matchesDeveloper = developer === "Todas" || product.developer === developer;
      const matchesBedrooms = bedrooms === "Qualquer" || (bedrooms === "4" ? product.bedrooms >= 4 : product.bedrooms === Number(bedrooms));
      const matchesStock = !stockOnly || product.available > 0;
      const matchesFavorite = !favoritesOnly || product.favorite;
      const matchesMedia = !noMediaOnly || (product.media ?? 0) === 0;
      const price = product.numericPrice ?? 0;
      const matchesPrice = priceBand === "Todas" || (priceBand === "Até 500 mil" ? price > 0 && price <= 500000 : priceBand === "500 mil a 1 mi" ? price > 500000 && price <= 1000000 : price > 1000000);
      return matchesQuery && matchesStatus && matchesNeighborhood && matchesDeveloper && matchesBedrooms && matchesStock && matchesPrice && matchesFavorite && matchesMedia;
    });
    result.sort((a, b) => {
      if (sortOrder === "nome") return a.name.localeCompare(b.name);
      if (sortOrder === "pmin") return (a.numericPrice ?? 9e15) - (b.numericPrice ?? 9e15);
      if (sortOrder === "vgv") return (b.stockValue ?? 0) - (a.stockValue ?? 0);
      return (b.available ?? 0) - (a.available ?? 0);
    });
    return result;
  }, [products, query, status, neighborhood, developer, bedrooms, stockOnly, priceBand, favoritesOnly, noMediaOnly, sortOrder]);

  const neighborhoods = useMemo(() => [...new Set(products.map((item) => item.neighborhood).filter(Boolean))].sort(), [products]);
  const developers = useMemo(() => [...new Set(products.map((item) => item.developer).filter((item): item is string => Boolean(item)))].sort(), [products]);

  const totalUnidades = products.reduce((acc, p) => acc + p.available, 0);
  const totalVgv = products.reduce((acc, p) => acc + (p.stockValue ?? 0), 0);
  const countSemBook = products.filter(p => p.media === 0).length;
  const countSemEstoque = products.filter(p => p.available === 0).length;
  const countMoema = products.filter(p => p.neighborhood.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "moema").reduce((acc, p) => acc + p.available, 0);

  return (
<>
      <header className="topbar">
        <div><h1>Produtos</h1><p className="sub">{products.length} empreendimentos no portfólio</p></div>
        <div className="top-actions"><button className="secondary-action" onClick={() => setUnitWizardOpen(true)} type="button">＋ Cadastrar unidade</button><button className="primary-action" onClick={() => setCaptureOpen(true)} type="button">＋ Cadastrar produto</button></div>
      </header>
      <section className="kpis">
        <div className="kpi o"><span className="bolha"></span><p className="lab">Unidades disponíveis</p><p className="val">{totalUnidades}</p><p className="hint">em {products.filter(p => p.available > 0).length} de {products.length} produtos</p></div>
        <div className="kpi p"><span className="bolha"></span><p className="lab">VGV disponível</p><p className="val">{(totalVgv / 1e6).toFixed(1).replace(".", ",")} mi</p><p className="hint">soma do estoque em tabela</p></div>
        <div className="kpi g"><span className="bolha"></span><p className="lab">Ticket médio</p><p className="val">{kurto(totalUnidades ? totalVgv / totalUnidades : 0)}</p><p className="hint">por unidade disponível</p></div>
        <div className="kpi warn act" onClick={() => setNoMediaOnly(true)}><span className="bolha"></span><p className="lab">Sem material</p><p className="val">{countSemBook}</p><p className="hint">produtos sem nenhuma foto ▸</p></div>
        <div className="kpi n"><span className="bolha"></span><p className="lab">Concentração Moema</p><p className="val">{totalUnidades ? Math.round((countMoema / totalUnidades) * 100) : 0}%</p><p className="hint">{countSemEstoque} produtos com estoque zerado</p></div>
      </section>
      <section className="catalog-controls">
        <div className="catalog-heading"><div className="tabs"><button className="active" type="button">Catálogo</button><button type="button">Inteligência comercial</button></div><span className={`data-status ${dataState}`}>{dataState === "live" ? "● Dados reais · sessão protegida" : dataState === "loading" ? "○ Conectando ao Supabase..." : dataState === "auth" ? "○ Login necessário" : "○ Erro de conexão"}</span></div>
        <div className="filter-row">
          <span className="filter-symbol">▽</span>
          {["Todos", "Lançamento", "Em obras", "Pronto"].map((item) => <button className={status === item ? "active" : ""} onClick={() => setStatus(item)} type="button" key={item}>{item}</button>)}
          <button className={favoritesOnly ? "favorite-filter active" : "favorite-filter"} onClick={() => setFavoritesOnly(!favoritesOnly)} type="button">★ Meus favoritos</button>
          {canApprove && <button className={approvalFilter ? "approval-filter active" : "approval-filter"} onClick={() => setApprovalFilter((v) => !v)} type="button">⏳ Pendentes de aprovação{(pendingCount + pendingUnits.length) > 0 && <b>{pendingCount + pendingUnits.length}</b>}</button>}
        </div>
        <div className="filter-row selects"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto..." /><select aria-label="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="Todos">Todos os bairros</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Incorporadora" value={developer} onChange={(event) => setDeveloper(event.target.value)}><option value="Todas">Todas as incorporadoras</option>{developers.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Faixa de preço" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}><option>Todas</option><option>Até 500 mil</option><option>500 mil a 1 mi</option><option>Acima de 1 mi</option></select><select aria-label="Dormitórios" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="Qualquer">Qualquer dorm.</option><option value="0">Studio</option><option value="1">1 dorm.</option><option value="2">2 dorm.</option><option value="3">3 dorm.</option><option value="4">4+ dorm.</option></select><select aria-label="Ordenação" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="disp">Ordenar: mais estoque</option><option value="vgv">Ordenar: maior VGV</option><option value="pmin">Ordenar: menor preço</option><option value="nome">Ordenar: A–Z</option></select><label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} /> Com estoque disponível</label><label className="toggle"><input type="checkbox" checked={noMediaOnly} onChange={(event) => setNoMediaOnly(event.target.checked)} /> Sem material (book)</label><span className="product-count">{filtered.length} produtos exibidos</span></div>
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
        {filtered.filter((product) => !approvalFilter || (product.approval === "pendente" && !product.draft)).map((product) => {
          const pct = product.units ? Math.round((product.available / product.units) * 100) : 0;
          const m2 = product.numericPrice && product.area ? Math.round(product.numericPrice / product.area) : null;
          const faixa = product.numericPrice == null ? <p className="faixa">Sob consulta</p>
            : product.numericPrice === product.priceMax ? <p className="faixa">{currency.format(product.numericPrice)}</p>
            : <p className="faixa">{kurto(product.numericPrice)} <small>a</small> {kurto(product.priceMax)}</p>;
          const areaStr = product.area == null ? "" : product.area === product.areaMax ? `${product.area} m²` : `${product.area} – ${product.areaMax} m²`;

          return (
            <article className="product-card" role="button" tabIndex={0} onClick={() => product.id && setSelectedProductId(product.id)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && product.id) setSelectedProductId(product.id); }} key={product.id ?? product.name}>
              <div className={`product-photo ${product.coverUrl ? "has-image" : ""}`}>
                {product.coverUrl ? <img src={product.coverUrl} alt={`Foto de capa de ${product.name}`} /> : <div className="semfoto"><b>SEM MATERIAL</b></div>}
                <span className={`selo ${product.status ?? ""}`}>{product.draft ? "Rascunho" : product.status?.replace("_", " ") ?? "Pronto"}</span>
                <span className={`estoque ${product.available === 0 ? "zero" : ""}`}>{product.available === 0 ? "Esgotado" : `${product.available} disp.`}</span>
                {!product.draft && product.approval && product.approval !== "aprovado" && <span className={`alerta ${product.approval}`}>{product.approval === "pendente" ? "⏳ Pendente" : "✕ Reprovado"}</span>}
                {(product.media ?? 0) > 0 && <span className="fotos-n">▣ {product.media}</span>}
                <button type="button" onClick={(event) => { event.stopPropagation(); if (product.id) setSelectedProductId(product.id); }} aria-label={`Abrir ficha de ${product.name}`}>•••</button>
              </div>
              <div className="product-info corpo">
                {faixa}
                <h2 className="nome">{product.name}</h2>
                <p className="local">⌖ {product.neighborhood} · <b>{product.developer}</b></p>
                {product.typologies && product.typologies.length > 0 && <div className="tips">{product.typologies.slice(0, 4).map(t => <span key={t}>{t}</span>)}</div>}
                {areaStr && <p className="area">▭ {areaStr}</p>}
                {product.approval === "reprovado" && product.rejectionReason && <p className="approval-reason">Motivo: {product.rejectionReason}</p>}
                {canApprove && product.approval === "pendente" && !product.draft && <p className="approval-captador">👤 Captado por: {product.capturedBy ?? "Não informado"}</p>}
                {canApprove && product.approval === "pendente" && !product.draft && product.id && <div className="approval-actions" onClick={(event) => event.stopPropagation()}><button type="button" className="ap-approve" disabled={decidingId === product.id} onClick={() => void decide(product.id!, true)}>{decidingId === product.id ? "…" : "✓ Aprovar"}</button><button type="button" className="ap-reject" disabled={decidingId === product.id} onClick={() => void decide(product.id!, false)}>✕ Reprovar</button></div>}
              </div>
              <div className="barra-wrap">
                <div className="barra"><i style={{ width: `${pct}%` }}></i></div>
                <div className="barra-lab"><span>{product.available} de {product.units ?? 0} unidades</span><span>{pct}%</span></div>
              </div>
              <div className="rodape">
                <div className="m2">{m2 ? `${currency.format(m2)}/m²` : "—"}<small>a partir de</small></div>
                <button className="mini" type="button" onClick={(event) => { event.stopPropagation(); if (product.id) setSelectedProductId(product.id); }}>Abrir ficha ▸</button>
              </div>
            </article>
          );
        })}
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
