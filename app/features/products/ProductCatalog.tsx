"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { AttentionCenter } from "../../components/AttentionCenter";
import { SupabaseLogin } from "../../components/SupabaseLogin";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { CaptureWizard } from "./CaptureWizard";
import { ProductDetail } from "./ProductDetail";
import { products as fallbackProducts, type Product } from "./products";
import { CrmWorkspace } from "../crm/CrmWorkspace";
import { AutomationsWorkspace } from "../automations/AutomationsWorkspaceV2";
import { ApproachesWorkspace } from "../approaches/ApproachesWorkspace";
import { CampaignWorkspace } from "../campaigns/CampaignWorkspace";
import { LiveChatWorkspace } from "../chat/LiveChatWorkspace";
import { HomeWorkspace } from "../home/HomeWorkspace";
import { FinanceWorkspace } from "../finance/FinanceWorkspace";
import { TeamWorkspace } from "../team/TeamWorkspace";
import { CalendarWorkspace } from "../calendar/CalendarWorkspace";
import { LegacyModuleWorkspace } from "../system/LegacyModuleWorkspace";
import type { ModuleName } from "../system/module-map";

type CatalogResponse = {
  mode: string;
  count: number;
  catalog: Array<{
    id: string;
    name: string;
    developer: string | null;
    neighborhood: string;
    city: string;
    status: string;
    price: number | null;
    area: number | null;
    bedrooms: number | null;
    parking: number | null;
    available: number;
    units: number;
    media: number;
    coverUrl: string | null;
    draft: boolean;
    origin: string;
    favorite: boolean;
  }>;
};

type SessionProfile = { userId: string; email: string; name: string; role: "admin" | "gestor" | "corretor"; active: boolean; brokerId: number | null; online: boolean };

const brokerModules = new Set<ModuleName>(["Início", "CRM", "Performance", "Produtos", "Financeiro", "Chat ao Vivo", "Financiamento", "Disparos", "Calendário", "Notificações", "Configurações", "Ajuda"]);

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ProductCatalog() {
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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [dataState, setDataState] = useState<"loading" | "live" | "auth" | "error">("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleName>("Produtos");
  const [focusedDealId, setFocusedDealId] = useState<number | null>(null);
  const [loginPreview, setLoginPreview] = useState(false);
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null);

  const loadSessionProfile = useCallback(async (token: string) => {
    const response = await fetch("/api/session", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Não foi possível identificar o perfil conectado.");
    setSessionProfile(await response.json() as SessionProfile);
  }, []);

  const loadCatalog = useCallback(async function requestCatalog(token: string, allowRefresh = true) {
    setAccessToken(token);
    setDataState("loading");
    try {
      const [response] = await Promise.all([
        fetch("/api/catalog", { headers: { Authorization: `Bearer ${token}` } }),
        loadSessionProfile(token).catch(() => undefined),
      ]);
      if (response.status === 401) {
        if (allowRefresh) {
          const { data } = await getBrowserSupabaseClient().auth.refreshSession();
          if (data.session) {
            await requestCatalog(data.session.access_token, false);
            return;
          }
        }
        setAccessToken(null);
        setDataState("auth");
        return;
      }
      if (!response.ok) throw new Error("Não foi possível consultar o catálogo.");
      const result = await response.json() as CatalogResponse;
      setProducts(result.catalog.map((item) => ({
        id: item.id,
        name: item.name,
        developer: item.developer,
        price: item.price === null ? "Preço sob consulta" : currency.format(item.price),
        neighborhood: item.neighborhood,
        city: item.city,
        status: item.status,
        area: item.area ?? 0,
        bedrooms: item.bedrooms ?? 0,
        parking: item.parking ?? 0,
        available: item.available,
        leads: 0,
        priceM2: item.price && item.area ? `${currency.format(item.price / item.area)}/m²` : "—",
        units: item.units,
        media: item.media,
        coverUrl: item.coverUrl,
        draft: item.draft,
        origin: item.origin,
        numericPrice: item.price,
        favorite: item.favorite,
      })));
      setDataState("live");
    } catch {
      setDataState("error");
    }
  }, [loadSessionProfile]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        setDataState("auth");
        return;
      }
      const expiresSoon = Number(data.session.expires_at || 0) * 1000 <= Date.now() + 60_000;
      if (expiresSoon) {
        const refreshed = await supabase.auth.refreshSession();
        if (!active) return;
        if (refreshed.data.session) {
          await loadCatalog(refreshed.data.session.access_token, false);
          return;
        }
      }
      await loadCatalog(data.session.access_token);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setAccessToken(session.access_token);
        setDataState((current) => current === "auth" ? "loading" : current);
      } else {
        setAccessToken(null);
        setDataState("auth");
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadCatalog]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeModule]);

  useEffect(() => {
    if (sessionProfile?.role === "corretor" && !brokerModules.has(activeModule)) setActiveModule("Início");
  }, [activeModule, sessionProfile]);

  const filtered = useMemo(() => products.filter((product) => {
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
  }), [products, query, status, neighborhood, developer, bedrooms, stockOnly, priceBand, favoritesOnly, noMediaOnly]);

  const neighborhoods = useMemo(() => [...new Set(products.map((item) => item.neighborhood).filter(Boolean))].sort(), [products]);
  const developers = useMemo(() => [...new Set(products.map((item) => item.developer).filter((item): item is string => Boolean(item)))].sort(), [products]);

  return (
    <AppShell activeItem={activeModule} onNavigate={setActiveModule} onPreviewLogin={() => setLoginPreview(true)} sessionRole={sessionProfile?.role ?? "corretor"} sessionName={sessionProfile?.name ?? "Corretor"}>
      {activeModule === "Início" && accessToken ? (
        <HomeWorkspace accessToken={accessToken} />
      ) : activeModule === "CRM" && accessToken ? (
        <CrmWorkspace accessToken={accessToken} initialDealId={focusedDealId} onInitialDealHandled={() => setFocusedDealId(null)} sessionRole={sessionProfile?.role ?? "corretor"} />
      ) : activeModule === "Automações" && accessToken ? (
        <AutomationsWorkspace accessToken={accessToken} />
      ) : activeModule === "Abordagens" && accessToken ? (
        <ApproachesWorkspace accessToken={accessToken} />
      ) : activeModule === "Chat ao Vivo" && accessToken ? (
        <LiveChatWorkspace accessToken={accessToken} />
      ) : activeModule === "Disparos" && accessToken ? (
        <CampaignWorkspace accessToken={accessToken} />
      ) : activeModule === "Financeiro" && accessToken ? (
        <FinanceWorkspace accessToken={accessToken} sessionRole={sessionProfile?.role ?? "corretor"} />
      ) : activeModule === "Usuários" && accessToken ? (
        <TeamWorkspace accessToken={accessToken} />
      ) : activeModule === "Calendário" && accessToken ? (
        <CalendarWorkspace accessToken={accessToken} />
      ) : activeModule !== "Produtos" && accessToken ? (
        <LegacyModuleWorkspace moduleName={activeModule} accessToken={accessToken} session={sessionProfile} />
      ) : (
      <>
      <header className="topbar">
        <div><h1>Produtos</h1><p>{products.length} empreendimentos no portfólio</p></div>
        <div className="top-actions"><label className="global-search"><span>⌕</span><input placeholder="Buscar lead, telefone, bairro..." /></label><button className="primary-action" onClick={() => setCaptureOpen(true)} type="button">＋ Cadastrar produto</button></div>
      </header>
      <section className="catalog-controls">
        <div className="catalog-heading"><div className="tabs"><button className="active" type="button">Catálogo</button><button type="button">Inteligência comercial</button></div><span className={`data-status ${dataState}`}>{dataState === "live" ? "● Dados reais · sessão protegida" : dataState === "loading" ? "○ Conectando ao Supabase..." : dataState === "auth" ? "○ Login necessário" : "○ Erro de conexão"}</span></div>
        <div className="filter-row">
          <span className="filter-symbol">▽</span>
          {["Todos", "Lançamento", "Em obras", "Pronto"].map((item) => <button className={status === item ? "active" : ""} onClick={() => setStatus(item)} type="button" key={item}>{item}</button>)}
          <button className={favoritesOnly ? "favorite-filter active" : "favorite-filter"} onClick={() => setFavoritesOnly(!favoritesOnly)} type="button">★ Meus favoritos</button>
        </div>
        <div className="filter-row selects"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto..." /><select aria-label="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="Todos">Todos os bairros</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Incorporadora" value={developer} onChange={(event) => setDeveloper(event.target.value)}><option value="Todas">Todas as incorporadoras</option>{developers.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Faixa de preço" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}><option>Todas</option><option>Até 500 mil</option><option>500 mil a 1 mi</option><option>Acima de 1 mi</option></select><select aria-label="Dormitórios" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}><option value="Qualquer">Qualquer dorm.</option><option value="0">Studio</option><option value="1">1 dorm.</option><option value="2">2 dorm.</option><option value="3">3 dorm.</option><option value="4">4+ dorm.</option></select><label className="toggle"><input type="checkbox" checked={stockOnly} onChange={(event) => setStockOnly(event.target.checked)} /> Com estoque disponível</label><label className="toggle"><input type="checkbox" checked={noMediaOnly} onChange={(event) => setNoMediaOnly(event.target.checked)} /> Sem material (book)</label><span className="product-count">{filtered.length} produtos exibidos</span></div>
      </section>
      <section className="product-grid">
        {filtered.map((product) => <article className="product-card" role="button" tabIndex={0} onClick={() => product.id && setSelectedProductId(product.id)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && product.id) setSelectedProductId(product.id); }} key={product.id ?? product.name}><div className={`product-photo ${product.coverUrl ? "has-image" : ""}`}>{product.coverUrl && <img src={product.coverUrl} alt={`Foto de capa de ${product.name}`} />}<span>{product.draft ? "Rascunho" : product.status?.replace("_", " ") ?? "Pronto"}</span>{!product.coverUrl && <div className="building-icon">▥</div>}<button type="button" onClick={(event) => { event.stopPropagation(); if (product.id) setSelectedProductId(product.id); }} aria-label={`Abrir ficha de ${product.name}`}>•••</button></div><div className="product-info"><strong className="price">{product.price}</strong><h2>{product.name}</h2><p className="location">⌖ {product.neighborhood} · {product.city}</p>{product.developer && <p className="developer">{product.developer}</p>}<div className="specs"><span>{product.area} m²</span><span>{product.bedrooms} dorm.</span><span>{product.parking} vaga</span></div><div className="availability"><span><i /> {product.available} disp.</span><span>· {product.units ?? 0} unidades</span><span>· {product.media ?? 0} mídias</span></div><footer><strong>{product.priceM2}</strong><button type="button" onClick={(event) => event.stopPropagation()}>▦ Comparar</button></footer></div></article>)}
      </section>
      <button className="ai-button" type="button" aria-label="Pedir ajuda à IA">✦</button>
      {captureOpen && <CaptureWizard onClose={() => setCaptureOpen(false)} onSaved={() => {
        setCaptureOpen(false);
        if (accessToken) void loadCatalog(accessToken);
      }} />}
      {selectedProductId && accessToken && <ProductDetail productId={selectedProductId} accessToken={accessToken} onClose={() => setSelectedProductId(null)} onChanged={() => void loadCatalog(accessToken)} />}
      </>
      )}
      {accessToken && <AttentionCenter accessToken={accessToken} onOpenLead={(dealId) => { setFocusedDealId(dealId); setActiveModule("CRM"); }} onOpenNotifications={() => setActiveModule("Notificações")} />}
      {dataState === "auth" && <SupabaseLogin onAuthenticated={(accessToken) => { setActiveModule("Início"); void loadCatalog(accessToken); }} />}
      {loginPreview && <SupabaseLogin preview onClose={() => setLoginPreview(false)} onAuthenticated={(token) => { setLoginPreview(false); setActiveModule("Início"); void loadCatalog(token); }} />}
    </AppShell>
  );
}
