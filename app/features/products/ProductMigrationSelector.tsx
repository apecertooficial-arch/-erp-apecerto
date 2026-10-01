"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { retryProductMediaImage } from "./media-image";

type MigrationUnit = {
  id: string;
  productId: string;
  codigo: string | null;
  numero: string | null;
  productName: string;
  neighborhood: string;
  city: string;
  state: string | null;
  address: string;
  developer: string | null;
  purpose: string | null;
  tipologia: string | null;
  captador: string | null;
  available: boolean;
  approval: string;
  published: boolean;
  inCommercialCatalog: boolean;
  price: number | null;
  area: number | null;
  parking: number | null;
  condominiumFee: number | null;
  propertyTax: number | null;
  otherCosts: number | null;
  ownMedia: number;
  referenceMedia: number;
  coverUrl: string | null;
  segment: "terceiros" | "lancamento" | "remanescente";
  ownerName: string | null;
  ownerContact: string | null;
  selectedForMigration: boolean;
};

type MigrationCatalog = {
  canPrepareMigration?: boolean;
  inventorySummary?: { totalUnits: number };
  inventoryUnits?: MigrationUnit[];
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const segmentLabel = { terceiros: "Terceiros", lancamento: "Lançamento", remanescente: "Remanescente" } as const;

function key(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function options(units: MigrationUnit[], field: "captador" | "developer" | "neighborhood") {
  return [...new Set(units.map((unit) => unit[field]).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function ProductMigrationSelector({ accessToken }: { accessToken: string }) {
  const [units, setUnits] = useState<MigrationUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "live" | "denied" | "error">("loading");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("todos");
  const [captor, setCaptor] = useState("todos");
  const [developer, setDeveloper] = useState("todos");
  const [neighborhood, setNeighborhood] = useState("todos");
  const [commercialState, setCommercialState] = useState("todos");
  const [owner, setOwner] = useState("todos");
  const [photos, setPhotos] = useState("todos");
  const [selection, setSelection] = useState("todos");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/catalog?view=migration", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    if (!response) { setState("error"); return; }
    if (response.status === 401 || response.status === 403) { setState("denied"); return; }
    const body = await response.json().catch(() => null) as MigrationCatalog | null;
    if (!response.ok || !body?.canPrepareMigration || !Array.isArray(body.inventoryUnits)) { setState("error"); return; }
    setUnits(body.inventoryUnits);
    setTotal(body.inventorySummary?.totalUnits ?? body.inventoryUnits.length);
    setState("live");
  }, [accessToken]);

  // Carregamento remoto inicial; os setters de load rodam somente após o fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const captors = useMemo(() => options(units, "captador"), [units]);
  const developers = useMemo(() => options(units, "developer"), [units]);
  const neighborhoods = useMemo(() => options(units, "neighborhood"), [units]);

  const visible = useMemo(() => {
    const search = key(query);
    const lower = Number(minPrice) || 0;
    const upper = Number(maxPrice) || Number.POSITIVE_INFINITY;
    return units.filter((unit) => {
      const searchable = key([unit.codigo, unit.numero, unit.productName, unit.neighborhood, unit.city, unit.developer, unit.captador, unit.ownerName, unit.ownerContact].filter(Boolean).join(" "));
      const status = unit.published ? "publicado" : unit.inCommercialCatalog ? "catalogo" : unit.available ? "fora" : "inativo";
      const price = unit.price ?? 0;
      return (!search || searchable.includes(search))
        && (segment === "todos" || unit.segment === segment)
        && (captor === "todos" || unit.captador === captor)
        && (developer === "todos" || unit.developer === developer)
        && (neighborhood === "todos" || unit.neighborhood === neighborhood)
        && (commercialState === "todos" || status === commercialState)
        && (owner === "todos" || (owner === "com" ? Boolean(unit.ownerName || unit.ownerContact) : !unit.ownerName && !unit.ownerContact))
        && (photos === "todos" || (photos === "com" ? unit.ownMedia > 0 : unit.ownMedia === 0))
        && (selection === "todos" || (selection === "sim" ? unit.selectedForMigration : !unit.selectedForMigration))
        && price >= lower && price <= upper;
    });
  }, [units, query, segment, captor, developer, neighborhood, commercialState, owner, photos, selection, minPrice, maxPrice]);

  const selectedCount = units.filter((unit) => unit.selectedForMigration).length;

  async function toggle(unit: MigrationUnit) {
    const selected = !unit.selectedForMigration;
    setMessage("");
    setPending((current) => new Set(current).add(unit.id));
    const response = await fetch("/api/products/migration", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ unitId: unit.id, selected }),
    }).catch(() => null);
    if (!response?.ok) {
      setMessage("Não foi possível atualizar a lista. Tente novamente.");
    } else {
      setUnits((current) => current.map((item) => item.id === unit.id ? { ...item, selectedForMigration: selected } : item));
    }
    setPending((current) => { const next = new Set(current); next.delete(unit.id); return next; });
  }

  function clearFilters() {
    setQuery(""); setSegment("todos"); setCaptor("todos"); setDeveloper("todos"); setNeighborhood("todos");
    setCommercialState("todos"); setOwner("todos"); setPhotos("todos"); setSelection("todos"); setMinPrice(""); setMaxPrice("");
  }

  if (state === "loading") return <section className="migration-products-state"><span /><strong>Carregando o estoque completo…</strong></section>;
  if (state === "denied") return <section className="migration-products-state denied" role="alert"><strong>Acesso não liberado</strong><p>Peça à gestão a permissão “Selecionar para migração” em Produtos.</p><Link href="/produtos">Voltar para Produtos</Link></section>;
  if (state === "error") return <section className="migration-products-state" role="alert"><strong>Não foi possível carregar o estoque.</strong><button type="button" onClick={() => { setState("loading"); void load(); }}>Tentar novamente</button></section>;

  return <section className="migration-products" aria-label="Seleção de Produtos para migração">
    <header>
      <div><p>Gestão › Produtos › Migração</p><h1>Seleção para migração</h1><span>Espelho autenticado e atualizado do estoque da imobiliária.</span></div>
      <Link href="/produtos">← Voltar para Produtos</Link>
    </header>

    <section className="migration-products-summary" aria-label="Resumo do estoque">
      <article><strong>{total}</strong><span>unidades no estoque</span></article>
      <article><strong>{visible.length}</strong><span>aparecem nos filtros</span></article>
      <article className="selected"><strong>{selectedCount}</strong><span>na lista de migração</span></article>
    </section>

    <section className="migration-products-filters" aria-label="Filtros do estoque">
      <label className="wide"><span>Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AP, prédio, unidade, captador, proprietário…" /></label>
      <label><span>Tipo</span><select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="todos">Todos</option><option value="terceiros">Terceiros</option><option value="lancamento">Lançamentos</option><option value="remanescente">Remanescentes</option></select></label>
      <label><span>Captador</span><select value={captor} onChange={(event) => setCaptor(event.target.value)}><option value="todos">Todos</option>{captors.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Incorporadora</span><select value={developer} onChange={(event) => setDeveloper(event.target.value)}><option value="todos">Todas</option>{developers.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Bairro</span><select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}><option value="todos">Todos</option>{neighborhoods.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Situação</span><select value={commercialState} onChange={(event) => setCommercialState(event.target.value)}><option value="todos">Todas</option><option value="publicado">Publicado</option><option value="catalogo">No catálogo</option><option value="fora">Fora do catálogo</option><option value="inativo">Inativo</option></select></label>
      <label><span>Proprietário</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="todos">Todos</option><option value="com">Com dados</option><option value="sem">Sem dados</option></select></label>
      <label><span>Fotos próprias</span><select value={photos} onChange={(event) => setPhotos(event.target.value)}><option value="todos">Todas</option><option value="com">Com fotos</option><option value="sem">Sem fotos</option></select></label>
      <label><span>Lista de migração</span><select value={selection} onChange={(event) => setSelection(event.target.value)}><option value="todos">Todos</option><option value="sim">Selecionados</option><option value="nao">Não selecionados</option></select></label>
      <label><span>Preço mínimo</span><input inputMode="numeric" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
      <label><span>Preço máximo</span><input inputMode="numeric" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
      <button type="button" onPointerDown={clearFilters} onClick={clearFilters}>Limpar filtros</button>
    </section>

    {message && <p className="migration-products-error" role="alert">{message}</p>}

    <div className="migration-products-list">
      {visible.map((unit) => <article key={unit.id} className={unit.selectedForMigration ? "selected" : ""}>
        <div className="migration-products-photo">{unit.coverUrl ? <img src={unit.coverUrl} alt={`Foto do imóvel ${unit.codigo || unit.productName}`} onError={retryProductMediaImage} /> : <span>Sem foto própria</span>}<em>{segmentLabel[unit.segment]}</em></div>
        <div className="migration-products-main">
          <div className="migration-products-title"><div><small>{unit.codigo || "Sem código"} · Unidade {unit.numero || "s/n"}</small><h2>{unit.productName}</h2><p>{unit.address || "Endereço não informado"} · {unit.neighborhood} · {unit.city}/{unit.state || "SP"}</p></div><strong>{unit.price == null ? "Preço não informado" : currency.format(unit.price)}</strong></div>
          <dl>
            <div><dt>Captador</dt><dd>{unit.captador || "Não identificado"}</dd></div>
            <div><dt>Proprietário</dt><dd>{unit.ownerName || "Não vinculado"}{unit.ownerContact && <small>{unit.ownerContact}</small>}</dd></div>
            <div><dt>Incorporadora</dt><dd>{unit.developer || "Não informada"}</dd></div>
            <div><dt>Tipologia</dt><dd>{unit.tipologia || "Não informada"}</dd></div>
            <div><dt>Área e vagas</dt><dd>{unit.area ? `${unit.area} m²` : "—"} · {unit.parking ?? 0} vaga(s)</dd></div>
            <div><dt>Custos</dt><dd>Cond. {unit.condominiumFee == null ? "—" : currency.format(unit.condominiumFee)} · IPTU {unit.propertyTax == null ? "—" : currency.format(unit.propertyTax)}</dd></div>
            <div><dt>Galeria</dt><dd>{unit.ownMedia} própria(s) · {unit.referenceMedia} comum(ns)</dd></div>
            <div><dt>Status</dt><dd>{unit.published ? "Publicado" : unit.inCommercialCatalog ? "No catálogo" : unit.available ? "Fora do catálogo" : "Inativo"} · {unit.approval}</dd></div>
          </dl>
        </div>
        <button type="button" className="migration-products-select" disabled={pending.has(unit.id)} aria-pressed={unit.selectedForMigration} onClick={() => void toggle(unit)}>{pending.has(unit.id) ? "Salvando…" : unit.selectedForMigration ? "✓ Na lista · remover" : "+ Enviar para a lista"}</button>
      </article>)}
      {!visible.length && <div className="migration-products-empty"><strong>Nenhum imóvel encontrado.</strong><p>Limpe ou altere os filtros para voltar ao estoque completo.</p></div>}
    </div>
  </section>;
}
