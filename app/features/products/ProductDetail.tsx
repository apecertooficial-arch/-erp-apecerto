"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type Media = { id: string; tipo: "foto" | "video" | "pdf" | "apresentacao"; storage_path: string; categoria: string | null; nome: string | null; is_capa: boolean; url: string | null; unidade_id?: string | null };
type Unit = { id: string; numero: string | null; tipologia: string | null; area_m2: number | null; vagas: number | null; valor_tabela: number | null; valor_promo: number | null; disponivel: boolean; de_terceiros?: boolean; captador_nome?: string | null; proprietario_nome?: string | null; proprietario_contato?: string | null; acesso_tipo?: string | null; acesso_codigo?: string | null; acesso_instrucoes?: string | null; aprovacao?: string | null };
type Owner = { nome: string; email: string; telefone: string };
type Condo = { id: string; nome: string; endereco: string; numero: string | null; bairro: string | null; cidade: string; uf: string; cep: string | null };
type LeadOption = { id: number; nome: string | null; telefone: string | null; linked: boolean };
type ProductDetailData = {
  id: string; nome: string; incorporadora: string | null; descricao: string | null; status: string; origem: string;
  preco: number | null; condominio_valor: number | null; iptu: number | null; outros_custos: number | null;
  area_util: number | null; dormitorios: number | null; suites: number | null; vagas: number | null; banheiros: number | null;
  endereco: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null;
  acesso_tipo: string | null; acesso_codigo: string | null; acesso_instrucoes: string | null; rascunho: boolean;
  condominios: Condo | null; proprietarios: Owner | null; unidades: Unit[]; midias: Media[];
  summary_price: number | null; summary_area: number | null;
  completion: { checks: Record<string, boolean>; completed: number; total: number };
  is_favorite: boolean; leads: LeadOption[];
  aprovacao?: string | null; captado_por_nome?: string | null; mine?: boolean;
  latitude?: number | null; longitude?: number | null;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const mediaCategories = ["Fachada", "Sala", "Cozinha", "Dormitório", "Banheiro", "Varanda", "Piscina", "Lazer", "Planta", "Tabela", "Apresentação", "Outros"];
const editableFields = ["nome", "incorporadora", "descricao", "preco", "condominio_valor", "iptu", "outros_custos", "area_util", "dormitorios", "suites", "vagas", "banheiros", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "cep", "acesso_tipo", "acesso_codigo", "acesso_instrucoes"] as const;

function mediaType(file: File): Media["tipo"] {
  if (file.type.startsWith("image/")) return "foto";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf") return "pdf";
  return "apresentacao";
}

/* --- Ficha v2: ícones SVG inline (traço ~1.9px, arredondado) --- */
function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const IcRuler = () => <Svg><path d="M3 8l5-5 13 13-5 5z" /><path d="M8 8l1.6 1.6M11 5l1.6 1.6M14 8l1.6 1.6M5 11l1.6 1.6" /></Svg>;
const IcBed = () => <Svg><path d="M2 17v-4a2 2 0 0 1 2-2h12a4 4 0 0 1 4 4v2" /><path d="M2 17h20M2 13V7" /><path d="M6 11V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" /></Svg>;
const IcBath = () => <Svg><path d="M4 12V6a2 2 0 0 1 4 0" /><path d="M2 12h20v2a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" /><path d="M7 20l-1 1M18 20l1 1" /></Svg>;
const IcCar = () => <Svg><path d="M5 13l1.4-4A2 2 0 0 1 8.3 8h7.4a2 2 0 0 1 1.9 1.4L19 13" /><path d="M4 17v-2.5L5 13h14l1 1.5V17a1 1 0 0 1-1 1h-1M7 18H5a1 1 0 0 1-1-1" /><circle cx="7.5" cy="17.5" r="1.4" /><circle cx="16.5" cy="17.5" r="1.4" /></Svg>;
const IcSeal = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.4 4.5-5" /></Svg>;
const IcPhone = () => <Svg size={16}><path d="M6 3h3l1.4 5-2 1.4a11 11 0 0 0 5 5l1.4-2 5 1.4V22 21a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" /></Svg>;
const IcMail = () => <Svg size={16}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>;
const IcKey = () => <Svg size={18}><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 16l2-2M18 18l2-2" /></Svg>;
const IcStar = () => <Svg size={18}><path d="M12 3l2.6 5.5 6 .9-4.3 4.2 1 6L12 17l-5.3 2.6 1-6L3.4 9.4l6-.9z" /></Svg>;
const IcShare = () => <Svg size={18}><circle cx="6" cy="12" r="2.4" /><circle cx="17" cy="6" r="2.4" /><circle cx="17" cy="18" r="2.4" /><path d="M8.1 10.9l6.8-3.7M8.1 13.1l6.8 3.7" /></Svg>;
const IcEdit = () => <Svg size={18}><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></Svg>;
const IcLink = () => <Svg size={18}><path d="M7 17L17 7M9 7h8v8" /></Svg>;
const IcImages = () => <Svg><rect x="3" y="5" width="13" height="13" rx="2" /><path d="M3 14l3.5-3.5 3 3 3-3 3.5 3.5" /><circle cx="8" cy="9" r="1.2" /><path d="M17 8h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9" /></Svg>;
const IcBuilding = () => <Svg><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-3h4v3" /></Svg>;
const IcPin = () => <Svg size={18}><path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></Svg>;
const IcClose = () => <Svg size={18}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const IcRotate = () => <Svg size={17}><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4" /></Svg>;
const IcClock = () => <Svg size={17}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
const IcSend = () => <Svg size={17}><path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8-8-4z" /></Svg>;
const IcCheck = () => <Svg size={17}><path d="M4 12.5l5 5 11-11" /></Svg>;
const IcDownload = () => <Svg size={17}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></Svg>;

function acessoLabel(tipo?: string | null): string {
  if (!tipo) return "—";
  const map: Record<string, string> = { chave_digital: "Chave digital", chave_fisica: "Chave física", chave: "Chave", porteiro: "Porteiro", corretor: "Com o corretor", proprietario: "Com o proprietário", biometria: "Biometria" };
  return map[tipo] ?? (tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, " "));
}
function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function ProductDetail({ productId, accessToken, sessionRole = "corretor", initialUnitId, onClose, onChanged }: { productId: string; accessToken: string; sessionRole?: string; initialUnitId?: string | null; onClose: () => void; onChanged: () => void }) {
  const canPublish = sessionRole === "admin" || sessionRole === "gestor" || sessionRole === "executivo";
  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [draft, setDraft] = useState<Record<string, string | number | null>>({});
  const [owner, setOwner] = useState<Owner | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [condominiums, setCondominiums] = useState<Condo[]>([]);
  const [condominiumId, setCondominiumId] = useState("");
  const [newCondominiumName, setNewCondominiumName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Outros");
  const [mediaTab, setMediaTab] = useState<"fotos" | "videos" | "apresentacoes">("fotos");
  const [editImages, setEditImages] = useState(false); /* Doc §9 — gestão só no modo Editar imagens */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [leadId, setLeadId] = useState("");
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<Media | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Media | null>(null);
  const [tab, setTab] = useState<"resumo" | "localizacao" | "proprietario" | "unidades" | "galeria">("resumo");
  const [unitDetail, setUnitDetail] = useState<Unit | null>(null);
  const [unitLightbox, setUnitLightbox] = useState<{ items: { url: string; label: string }[]; index: number } | null>(null);
  const [mapCoord, setMapCoord] = useState<{ lat: number; lon: number } | null>(null);

  const load = useCallback(async () => {
    setMessage("");
    const response = await fetch(`/api/product?id=${encodeURIComponent(productId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível abrir o produto.");
    const next = result.product as ProductDetailData;
    setProduct(next);
    setOwner(next.proprietarios ?? { nome: "", email: "", telefone: "" });
    setUnits(next.unidades);
    setCondominiumId(next.condominios?.id ?? "");
    setNewCondominiumName(next.condominios?.nome ?? "");
    setDraft(Object.fromEntries(editableFields.map((field) => [field, next[field] ?? (field === "preco" ? next.summary_price : field === "area_util" ? next.summary_area : "")])));
    const supabase = getBrowserSupabaseClient();
    const { data: condoOptions } = await supabase.from("condominios").select("id,nome,endereco,numero,bairro,cidade,uf,cep").order("nome");
    setCondominiums(condoOptions ?? []);
  }, [accessToken, productId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((error: Error) => setMessage(error.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  // Galeria do PRÉDIO/produto = mídia sem unidade_id. As fotos de unidade de indicação aparecem no detalhe da unidade.
  const buildingMedia = useMemo(() => product?.midias.filter((item) => !item.unidade_id) ?? [], [product]);
  const photos = useMemo(() => buildingMedia.filter((item) => item.tipo === "foto"), [buildingMedia]);
  const videos = useMemo(() => buildingMedia.filter((item) => item.tipo === "video"), [buildingMedia]);
  const presentations = useMemo(() => buildingMedia.filter((item) => item.tipo === "pdf" || item.tipo === "apresentacao"), [buildingMedia]);
  const visibleMedia = mediaTab === "fotos" ? photos : mediaTab === "videos" ? videos : presentations;
  const cover = photos.find((item) => item.is_capa) ?? photos[0];

  const addressLine = useMemo(() => [product?.endereco, product?.numero, product?.bairro, product?.cidade, product?.uf, product?.cep].filter(Boolean).join(", "), [product]);
  // Query pro embed do Google (por texto) — sempre com cidade/UF/Brasil pra melhorar o acerto.
  const mapQuery = useMemo(() => addressLine ? encodeURIComponent(`${addressLine}${product?.cidade ? "" : ", São Paulo, SP"}, Brasil`) : "", [addressLine, product]);
  useEffect(() => {
    if (tab !== "localizacao" || !product) return;
    // Se já tem coordenada salva, usa o OpenStreetMap direto.
    if (product.latitude != null && product.longitude != null) {
      if (!mapCoord) setMapCoord({ lat: Number(product.latitude), lon: Number(product.longitude) });
      return;
    }
    // Sem coordenada: mostra o embed do Google na hora (render abaixo) e dispara o
    // geocoding NO SERVIDOR só pra CACHEAR — na próxima abertura já vem OSM.
    void fetch(`/api/geocode?id=${product.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {});
  }, [tab, product, accessToken, mapCoord]);

  async function save() {
    setBusy(true); setMessage("");
    try {
      const numeric = new Set(["preco", "condominio_valor", "iptu", "outros_custos", "area_util", "dormitorios", "suites", "vagas", "banheiros"]);
      const payload = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, numeric.has(key) && value !== "" ? Number(value) : value]));
      const condominium = condominiumId ? { id: condominiumId } : newCondominiumName.trim() ? { id: null, nome: newCondominiumName, endereco: draft.endereco, numero: draft.numero, bairro: draft.bairro, cidade: draft.cidade, uf: draft.uf, cep: draft.cep } : null;
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, product: payload, owner: product?.origem === "terceiros" ? owner : null, units, condominium, origin: product?.origem }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
      await load(); onChanged(); setEditing(false); setMessage("Alterações salvas no Supabase.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao salvar."); } finally { setBusy(false); }
  }

  async function setCover(mediaId: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "setCover", mediaId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível definir a capa.");
      await load(); onChanged(); setMessage("Foto de capa atualizada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao definir a capa."); } finally { setBusy(false); }
  }

  async function upload(files: FileList | null, forcedCategory?: string) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sua sessão expirou.");
      for (const file of Array.from(files)) {
        const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${auth.user.id}/${productId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("empreendimentos").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const tipo = mediaType(file);
        const { error: insertError } = await supabase.from("midias").insert({ empreendimento_id: productId, storage_path: path, tipo, categoria: forcedCategory ?? category, nome: file.name, is_capa: tipo === "foto" && photos.length === 0 });
        if (insertError) throw insertError;
      }
      await load(); onChanged(); setMessage(`${files.length} material(is) adicionado(s).`);
    } catch (error) { console.error("[produto upload]", error); setMessage(error instanceof Error ? `Falha no upload: ${error.message}` : "Falha no upload."); } finally { setBusy(false); }
  }

  async function mediaAction(action: "updateMedia" | "deleteMedia", mediaId: string, categoryValue?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action, mediaId, category: categoryValue }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível alterar a mídia.");
      await load(); onChanged(); setMessage(action === "deleteMedia" ? "Material removido." : "Classificação atualizada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao alterar a mídia."); } finally { setBusy(false); }
  }

  async function productAction(action: "toggleFavorite" | "linkLead" | "unlinkLead", value?: string | number | boolean) {
    setBusy(true); setMessage("");
    try {
      const body = action === "toggleFavorite" ? { id: productId, action, favorite: value } : { id: productId, action, leadId: value };
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a ação.");
      await load(); onChanged(); setLeadId(""); setMessage(action === "toggleFavorite" ? "Favoritos atualizados." : "Vínculo com o lead atualizado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao concluir a ação."); } finally { setBusy(false); }
  }

  async function publishAction(publish: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: publish ? "publish" : "unpublish" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a ação.");
      await load(); onChanged(); setMessage(publish ? "Produto publicado — já aparece no disparo, nas abordagens e no catálogo." : "Produto voltou para rascunho (fica invisível no disparo e nas abordagens).");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao publicar."); } finally { setBusy(false); }
  }

  const initialOpened = useRef(false);
  useEffect(() => {
    if (!initialOpened.current && initialUnitId && product) {
      const u = product.unidades.find((x) => x.id === initialUnitId);
      if (u) { setTab("unidades"); setUnitDetail(u); initialOpened.current = true; }
    }
  }, [product, initialUnitId]);

  async function decideUnit(unidadeId: string, approve: boolean) {
    let motivo: string | null = null;
    if (!approve) { motivo = window.prompt("Motivo da reprovação (opcional):", "") ?? ""; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "decideUnit", unidadeId, approve, motivo }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a decisão.");
      setUnitDetail(null); await load(); onChanged(); setMessage(approve ? "Unidade aprovada." : "Unidade reprovada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao decidir a unidade."); } finally { setBusy(false); }
  }

  async function submitRequest() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "solicitar" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar a solicitação.");
      await load(); onChanged(); setMessage("Solicitação enviada — aguardando aprovação do gestor.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao enviar solicitação."); } finally { setBusy(false); }
  }

  const completionPct = product ? Math.round((product.completion.completed / product.completion.total) * 100) : 0;
  const completionLabels: Record<string, string> = { basics: "Dados básicos", location: "Endereço", owner: "Proprietário", costs: "Custos", access: "Acesso", media: "Fotos, vídeo e capa", units: "Unidades" };
  const otherPhotos = photos.filter((item) => item.id !== cover?.id);

  const publishButton = product && (canPublish
    ? (product.rascunho
      ? <button className="fv2-btn fv2-btn-publish" type="button" disabled={busy} title={product.completion.completed < product.completion.total ? `Faltam ${product.completion.total - product.completion.completed} bloco(s) para ficar 100% completo` : "Produto completo"} onClick={() => void publishAction(true)}><IcCheck /> Publicar produto{product.completion.completed < product.completion.total ? " (incompleto)" : ""}</button>
      : <button className="fv2-btn fv2-btn-ghost" type="button" disabled={busy} onClick={() => void publishAction(false)}><IcRotate /> Voltar a rascunho</button>)
    : (product.aprovacao === "pendente"
      ? <button className="fv2-btn fv2-btn-ghost" type="button" disabled title="Aguardando aprovação do gestor"><IcClock /> Aguardando aprovação</button>
      : (product.mine && (product.rascunho || product.aprovacao === "reprovado")
        ? <button className="fv2-btn fv2-btn-publish" type="button" disabled={busy} onClick={() => void submitRequest()}><IcSend /> Enviar solicitação</button>
        : null)));

  const mediaLibrary = product && <section className="detail-section media-library fv2-media">
    <div className="section-row"><div><h3>Galeria e materiais</h3><small>{photos.length} fotos · {videos.length} vídeos · {presentations.length} apresentações</small></div><button className={editImages ? "edit-images-btn active" : "edit-images-btn"} type="button" onClick={() => setEditImages(!editImages)}>{editImages ? "✓ Concluir edição" : "✎ Editar imagens"}</button></div>
    <div className="media-tabs"><button className={mediaTab === "fotos" ? "active" : ""} type="button" onClick={() => setMediaTab("fotos")}>Fotos ({photos.length})</button><button className={mediaTab === "videos" ? "active" : ""} type="button" onClick={() => setMediaTab("videos")}>Vídeos ({videos.length})</button><button className={mediaTab === "apresentacoes" ? "active" : ""} type="button" onClick={() => setMediaTab("apresentacoes")}>Apresentações ({presentations.length})</button></div>
    {editImages && <div className="material-upload">{mediaTab === "fotos" && <select value={category} onChange={(event) => setCategory(event.target.value)}>{mediaCategories.map((item) => <option key={item}>{item}</option>)}</select>}<label className="primary-action">＋ {mediaTab === "fotos" ? "Adicionar fotos" : mediaTab === "videos" ? "Adicionar vídeos" : "Adicionar apresentação PDF"}<input disabled={busy} multiple type="file" accept={mediaTab === "fotos" ? "image/*" : mediaTab === "videos" ? "video/*" : ".pdf,application/pdf,.ppt,.pptx"} onChange={(event) => void upload(event.target.files, mediaTab === "videos" ? "Tour" : mediaTab === "apresentacoes" ? "Apresentação" : undefined)} /></label></div>}
    {visibleMedia.length ? <div className="detail-gallery">{visibleMedia.map((item) => <article key={item.id}>
      {editImages && <button className="media-delete" disabled={busy} type="button" onClick={() => setPendingDelete(item)} aria-label={`Excluir ${item.nome ?? "arquivo"}`}>×</button>}
      {item.tipo === "foto" && item.url ? <button className="gallery-open watermarked-preview" type="button" onClick={() => setLightboxIndex(photos.findIndex((photo) => photo.id === item.id))}><img src={item.url} alt={item.categoria || item.nome || "Foto do imóvel"} /></button> : item.tipo === "video" && item.url ? <div className="watermarked-preview"><video src={item.url} controls preload="metadata" /></div> : item.url ? <button className="file-tile watermarked-preview" type="button" onClick={() => setDocumentPreview(item)}>Abrir {item.tipo === "pdf" ? "PDF" : "apresentação"}</button> : <div className="file-tile watermarked-preview">{item.tipo.toUpperCase()}</div>}
      {editImages ? <div><select aria-label={`Classificação de ${item.nome ?? "material"}`} value={item.categoria ?? "Outros"} onChange={(event) => void mediaAction("updateMedia", item.id, event.target.value)}>{mediaCategories.map((entry) => <option key={entry}>{entry}</option>)}</select><small>{item.nome}</small><div className="media-actions">{item.tipo === "foto" && <button disabled={busy || item.is_capa} type="button" onClick={() => void setCover(item.id)}>{item.is_capa ? "✓ Foto de capa" : "Usar como capa"}</button>}</div></div> : null}
    </article>)}</div> : <p className="empty-media">Nenhum material nesta categoria. Use o botão acima para adicionar.</p>}
  </section>;

  return <div className="modal-layer product-detail-layer">
    <button className="modal-scrim" type="button" onClick={onClose} aria-label="Fechar ficha do produto" />
    <aside className="product-detail-panel ficha-v2" aria-label="Ficha completa do produto">
      {!product ? <div className="detail-loading">{message || "Carregando dados reais do produto..."}</div> : editing ? (
        <div className="fv2-edit">
          <div className="fv2-edit-head"><h2>Editar produto</h2><button className="fv2-btn fv2-btn-ghost" type="button" onClick={() => setEditing(false)}>Cancelar edição</button></div>
          {message && <div className={`detail-message ${message.includes("salv") || message.includes("atualiz") || message.includes("adicionado") ? "success" : ""}`}>{message}</div>}
          <div className="detail-form">
            <h3>Dados do imóvel</h3>
            <div className="field-grid">
              {(["nome", "incorporadora", "preco", "area_util", "dormitorios", "suites", "vagas", "banheiros"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}<input type={["preco","area_util","dormitorios","suites","vagas","banheiros"].includes(field) ? "number" : "text"} value={draft[field] ?? ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
            </div>
            <label>Descrição<textarea rows={3} value={draft.descricao ?? ""} onChange={(event) => setDraft({ ...draft, descricao: event.target.value })} /></label>
            <h3>Endereço e custos</h3><div className="field-grid">
              {(["endereco", "numero", "complemento", "bairro", "cidade", "uf", "cep", "condominio_valor", "iptu", "outros_custos"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}<input type={["condominio_valor","iptu","outros_custos"].includes(field) ? "number" : "text"} value={draft[field] ?? ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
            </div>
            <label>Condomínio associado<select value={condominiumId} onChange={(event) => { setCondominiumId(event.target.value); if (event.target.value) setNewCondominiumName(""); }}><option value="">Cadastrar novo com o endereço acima</option>{condominiums.map((item) => <option value={item.id} key={item.id}>{item.nome} · {item.bairro ?? item.cidade}</option>)}</select></label>{!condominiumId && <label>Nome do novo condomínio<input value={newCondominiumName} onChange={(event) => setNewCondominiumName(event.target.value)} placeholder="Nome do condomínio" /></label>}
            {product.origem === "terceiros" && <><h3>Acesso ao imóvel</h3><div className="field-grid"><label>Tipo<input value={draft.acesso_tipo ?? ""} onChange={(event) => setDraft({ ...draft, acesso_tipo: event.target.value })} /></label><label>Código digital<input value={draft.acesso_codigo ?? ""} onChange={(event) => setDraft({ ...draft, acesso_codigo: event.target.value })} /></label></div><label>Instruções<textarea rows={3} value={draft.acesso_instrucoes ?? ""} onChange={(event) => setDraft({ ...draft, acesso_instrucoes: event.target.value })} /></label>{owner && <><h3>Proprietário</h3><div className="field-grid">{(["nome", "email", "telefone"] as const).map((field) => <label key={field}>{field}<input value={owner[field]} onChange={(event) => setOwner({ ...owner, [field]: event.target.value })} /></label>)}</div></>}</>}
            <h3>Unidades</h3><div className="section-row"><small>Edite estoque, tipologia, área e preço.</small><button className="secondary-action" type="button" onClick={() => setUnits([...units, { id: crypto.randomUUID(), numero: "", tipologia: "", area_m2: null, vagas: 0, valor_tabela: null, valor_promo: null, disponivel: true }])}>＋ Unidade</button></div><div className="edit-units">{units.map((unit, index) => <div key={unit.id}><span>{index + 1}</span><input aria-label="Número" value={unit.numero ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, numero: event.target.value } : item))} placeholder="Unidade" /><input aria-label="Tipologia" value={unit.tipologia ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, tipologia: event.target.value } : item))} placeholder="Tipologia" /><input aria-label="Área" type="number" value={unit.area_m2 ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, area_m2: event.target.value ? Number(event.target.value) : null } : item))} placeholder="m²" /><input aria-label="Vagas" type="number" value={unit.vagas ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, vagas: event.target.value ? Number(event.target.value) : null } : item))} /><input aria-label="Preço" type="number" value={unit.valor_tabela ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, valor_tabela: event.target.value ? Number(event.target.value) : null } : item))} placeholder="Preço" /><label><input type="checkbox" checked={unit.disponivel} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, disponivel: event.target.checked } : item))} /> disponível</label><button type="button" aria-label="Remover unidade" onClick={() => setUnits(units.filter((item) => item.id !== unit.id))}>×</button></div>)}</div>
            <button className="primary-action" disabled={busy} type="button" onClick={() => void save()}>{busy ? "Salvando..." : "Salvar no Supabase"}</button>
          </div>
        </div>
      ) : (
        <div className="fv2-page">
          <button className="fv2-close" type="button" onClick={onClose} aria-label="Fechar ficha do produto"><IcClose /></button>
          <div className="fv2-main">
            <div className="fv2-mosaic">
              <button className="fv2-mosaic-cover" type="button" onClick={() => photos.length && setLightboxIndex(0)} style={cover?.url ? { backgroundImage: `url(${cover.url})` } : undefined} aria-label="Ampliar galeria de fotos">
                <span className={`fv2-status ${product.rascunho ? "draft" : "ready"}`}><i />{product.rascunho ? "Rascunho" : product.status.replace(/_/g, " ")}</span>
              </button>
              <div className="fv2-mosaic-side">
                <div className="fv2-thumb" style={otherPhotos[0]?.url ? { backgroundImage: `url(${otherPhotos[0].url})` } : undefined} />
                <button className="fv2-thumb fv2-thumb-more" type="button" onClick={() => photos.length && setLightboxIndex(0)}>
                  <IcImages /><span>Ver {photos.length} foto{photos.length === 1 ? "" : "s"}</span>
                </button>
              </div>
            </div>

            <div className="fv2-head">
              <h2>{product.nome}</h2>
              <p className="fv2-address"><IcPin /> {[product.bairro, product.cidade, product.uf].filter(Boolean).join(" · ") || "Endereço não informado"} · Captado por: {product.captado_por_nome ?? "Não informado"}</p>
            </div>

            <div className="fv2-specs">
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcRuler /></span><strong>{product.summary_area ?? "—"} <em>m²</em></strong><small>a partir de</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcBed /></span><strong>{product.dormitorios ?? "—"}</strong><small>dormitório(s)</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcBath /></span><strong>{product.suites ?? "—"}</strong><small>suíte(s)</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcCar /></span><strong>{product.vagas ?? "—"}</strong><small>vaga(s)</small></div>
            </div>

            <nav className="fv2-tabs">
              {([["resumo", "Resumo"], ["localizacao", "Localização"], ["proprietario", "Proprietário"], ["unidades", "Unidades"], ["galeria", "Galeria"]] as const).map(([key, label]) => (
                (key !== "proprietario" || product.origem === "terceiros") && <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
              ))}
            </nav>

            {message && <div className={`detail-message ${message.includes("salv") || message.includes("atualiz") || message.includes("adicionado") ? "success" : ""}`}>{message}</div>}

            <div className="fv2-tab-body">
              {tab === "resumo" && <>
                <div className="fv2-registration">
                  <span className="fv2-registration-ic"><IcSeal /></span>
                  <div><strong>Cadastro completo</strong><small>{product.completion.completed} de {product.completion.total} blocos preenchidos</small></div>
                  <b>{completionPct}%</b>
                </div>
                <div className="fv2-chips">{Object.entries(product.completion.checks).map(([key, ok]) => <span key={key} className={ok ? "done" : ""}><IcCheck />{completionLabels[key] ?? key}</span>)}</div>
                <div className={product.descricao ? "fv2-desc" : "fv2-desc empty"}>
                  {product.descricao ? <p>{product.descricao}</p> : <><span>Nenhuma descrição cadastrada ainda.</span><button type="button" onClick={() => setEditing(true)}>Adicionar descrição</button></>}
                </div>
                <div className="fv2-cost-tiles">
                  <div className="fv2-tile"><small>CONDOMÍNIO</small><strong>{product.condominio_valor ? money.format(product.condominio_valor) : "—"}</strong></div>
                  <div className="fv2-tile"><small>IPTU</small><strong>{product.iptu ? money.format(product.iptu) : "—"}</strong></div>
                  <div className="fv2-tile"><small>OUTROS CUSTOS</small><strong>{product.outros_custos ? money.format(product.outros_custos) : "—"}</strong></div>
                </div>
              </>}

              {tab === "localizacao" && <>
                <h3 className="fv2-loc-title">{[product.endereco, product.numero].filter(Boolean).join(", ") || "Endereço não cadastrado"}</h3>
                <p className="fv2-loc-sub">{[product.bairro, product.cidade].filter(Boolean).join(" · ")}{product.uf ? ` — ${product.uf}` : ""}{product.cep ? ` · CEP ${product.cep}` : ""}</p>
                {product.condominios && <div className="fv2-condo"><span className="fv2-condo-ic"><IcBuilding /></span><div><strong>{product.condominios.nome}</strong><small>Condomínio associado</small></div></div>}
                <div className="fv2-map">
                  {mapCoord ? <iframe title="Mapa do imóvel" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoord.lon - 0.006}%2C${mapCoord.lat - 0.005}%2C${mapCoord.lon + 0.006}%2C${mapCoord.lat + 0.005}&layer=mapnik&marker=${mapCoord.lat}%2C${mapCoord.lon}`} />
                    : mapQuery ? <iframe title="Mapa do imóvel" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} />
                    : <div className="fv2-map-placeholder">Endereço não cadastrado.</div>}
                </div>
              </>}

              {tab === "proprietario" && product.origem === "terceiros" && <>
                <div className="fv2-owner-block">
                  <div className="fv2-owner-lead">
                    <span className="fv2-avatar">{initials(product.proprietarios?.nome)}</span>
                    <div><strong>{product.proprietarios?.nome ?? "—"}</strong><small>Proprietária</small></div>
                  </div>
                  <div className="fv2-contact-pills">
                    {product.proprietarios?.telefone && <a className="fv2-pill" href={`tel:${product.proprietarios.telefone}`}><IcPhone />{product.proprietarios.telefone}</a>}
                    {product.proprietarios?.email && <a className="fv2-pill" href={`mailto:${product.proprietarios.email}`}><IcMail />{product.proprietarios.email}</a>}
                  </div>
                </div>
                <div className="fv2-cost-tiles">
                  <div className="fv2-tile"><small>ACESSO</small><strong>{acessoLabel(product.acesso_tipo)}</strong></div>
                  <div className="fv2-tile"><small>CÓDIGO</small><strong>{product.acesso_codigo || "—"}</strong></div>
                  <div className="fv2-tile"><small>AUTORIZAÇÃO</small><strong>{product.acesso_instrucoes || "—"}</strong></div>
                </div>
              </>}

              {tab === "unidades" && <div className="fv2-units">{product.unidades.length ? <><div className="fv2-unit-head"><span>Unidade / Origem</span><span>Tipologia</span><span>Área</span><span>Vagas</span><span>Valor</span><span>Status</span></div>{product.unidades.map((unit) => { const ind = Boolean(unit.de_terceiros); return <button type="button" className="fv2-unit-row" key={unit.id} onClick={() => setUnitDetail(unit)}><span className="fv2-unit-main"><span className="fv2-unit-num">{unit.numero || "—"}</span><span className={`fv2-unit-origin ${ind ? "indic" : "constru"}`}>{ind ? "Indicação" : "Construtora"}</span>{ind && (unit.captador_nome || unit.proprietario_nome) && <small className="fv2-unit-sub">👤 {unit.captador_nome ?? "—"}{unit.proprietario_nome ? ` · Prop.: ${unit.proprietario_nome}` : ""}</small>}</span><span className="fv2-unit-c">{unit.tipologia || "—"}</span><span className="fv2-unit-c">{unit.area_m2 ?? "—"} m²</span><span className="fv2-unit-c">{unit.vagas ?? 0} vaga(s)</span><strong className="fv2-unit-val">{money.format(unit.valor_promo ?? unit.valor_tabela ?? 0)}</strong><i className={`fv2-unit-status ${unit.disponivel ? "on" : "off"}`}>{unit.disponivel ? "Disponível" : "Indisponível"}</i></button>; })}</> : <p className="empty-media">Nenhuma unidade individual cadastrada.</p>}</div>}

              {tab === "galeria" && mediaLibrary}
            </div>
          </div>

          <aside className="fv2-side">
            <div className="fv2-price-card">
              <small>VALOR DO IMÓVEL</small>
              <strong>{product.summary_price ? money.format(product.summary_price) : "Sob consulta"}</strong>
              {product.summary_price && product.summary_area ? <span className="fv2-price-m2">{money.format(Math.round(product.summary_price / product.summary_area))} por m²</span> : null}
              <div className="fv2-side-costs">
                <div><span>Condomínio</span><b>{product.condominio_valor ? money.format(product.condominio_valor) : "—"}</b></div>
                <div><span>IPTU</span><b>{product.iptu ? money.format(product.iptu) : "—"}</b></div>
                <div><span>Outros custos</span><b>{product.outros_custos ? money.format(product.outros_custos) : "—"}</b></div>
              </div>
            </div>

            <div className="fv2-actions">
              <button className="fv2-btn fv2-btn-lead" type="button" onClick={() => setLeadPanelOpen(!leadPanelOpen)}><IcLink /> Vincular lead{product.leads.some((lead) => lead.linked) ? ` · ${product.leads.filter((lead) => lead.linked).length}` : ""}</button>
              {leadPanelOpen && <div className="fv2-lead-panel"><div className="lead-link-form"><select value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">Selecione um lead...</option>{product.leads.filter((lead) => !lead.linked).map((lead) => <option value={lead.id} key={lead.id}>{lead.nome || "Lead sem nome"} · {lead.telefone || "sem telefone"}</option>)}</select><button className="primary-action" disabled={busy || !leadId} type="button" onClick={() => void productAction("linkLead", leadId)}>Vincular</button></div><div className="linked-leads">{product.leads.filter((lead) => lead.linked).map((lead) => <span key={lead.id}><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone}</small><button type="button" disabled={busy} onClick={() => void productAction("unlinkLead", lead.id)}>×</button></span>)}</div></div>}
              <button className="fv2-btn fv2-btn-outline" type="button" onClick={() => setEditing(true)}><IcEdit /> Editar produto</button>
              <div className="fv2-action-row">
                <button className={product.is_favorite ? "fv2-btn fv2-btn-outline active" : "fv2-btn fv2-btn-outline"} disabled={busy} type="button" onClick={() => void productAction("toggleFavorite", !product.is_favorite)}><IcStar /> {product.is_favorite ? "Favorito" : "Favoritar"}</button>
                <button className="fv2-btn fv2-btn-icon" type="button" aria-label="Compartilhar" title="Compartilhar"><IcShare /></button>
              </div>
              {publishButton}
            </div>

            {product.origem === "terceiros" && <div className="fv2-person-card">
              <span className="fv2-avatar">{initials(product.proprietarios?.nome)}</span>
              <div><strong>{product.proprietarios?.nome ?? "—"}</strong><small>Proprietária{product.proprietarios?.telefone ? ` · ${product.proprietarios.telefone}` : ""}</small></div>
            </div>}

            <div className="fv2-person-card">
              <span className="fv2-avatar purple">{initials(product.captado_por_nome)}</span>
              <div><strong>{product.captado_por_nome ?? "Não informado"}</strong><small>Corretor da captação</small></div>
            </div>
          </aside>
        </div>
      )}
    </aside>
    {lightboxIndex !== null && photos[lightboxIndex]?.url && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Galeria ampliada"><button className="lightbox-close" type="button" onClick={() => setLightboxIndex(null)} aria-label="Fechar galeria">×</button><button className="lightbox-nav previous" type="button" onClick={() => setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)} aria-label="Foto anterior">‹</button><div className="lightbox-image watermarked-preview"><img src={photos[lightboxIndex].url ?? ""} alt={photos[lightboxIndex].categoria || photos[lightboxIndex].nome || "Foto ampliada do imóvel"} /></div><div><strong>{photos[lightboxIndex].categoria || "Foto do imóvel"}</strong><span>{lightboxIndex + 1} de {photos.length}</span></div><button className="lightbox-nav next" type="button" onClick={() => setLightboxIndex((lightboxIndex + 1) % photos.length)} aria-label="Próxima foto">›</button></div>}
    {documentPreview?.url && <div className="document-preview-modal" role="dialog" aria-modal="true" aria-label="Visualizar apresentação"><header><strong>{documentPreview.nome || "Apresentação do produto"}</strong><button type="button" onClick={() => setDocumentPreview(null)} aria-label="Fechar apresentação">×</button></header><div className="document-frame watermarked-preview"><iframe src={documentPreview.url} title={documentPreview.nome || "Apresentação do produto"} /></div></div>}
    {pendingDelete && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão"><div><strong>Excluir este arquivo?</strong><p>{pendingDelete.nome || "O arquivo selecionado"} será removido definitivamente da galeria e do armazenamento.</p><footer><button type="button" onClick={() => setPendingDelete(null)}>Cancelar</button><button className="danger" disabled={busy} type="button" onClick={() => { const id = pendingDelete.id; setPendingDelete(null); void mediaAction("deleteMedia", id); }}>Excluir arquivo</button></footer></div></div>}
    {unitDetail && (() => { const u = unitDetail; const ind = Boolean(u.de_terceiros); return <div className="ficha-v2 fv2-unit-detail-ov" role="dialog" aria-modal="true" aria-label="Detalhe da unidade" onMouseDown={(event) => { if (event.target === event.currentTarget) setUnitDetail(null); }}>
      <div className="fv2-unit-detail">
        <div className="fv2-ud-head"><h2>Unidade {u.numero || "—"}</h2><button type="button" onClick={() => setUnitDetail(null)} aria-label="Fechar"><IcClose /></button></div>
        <div className="fv2-ud-body">
          <div className="fv2-ud-badges"><span className={`fv2-unit-origin ${ind ? "indic" : "constru"}`}>{ind ? "Indicação" : "Construtora"}</span>{ind && u.aprovacao && u.aprovacao !== "aprovado" && <span className={`fv2-ud-aprov ${u.aprovacao}`}>{u.aprovacao === "pendente" ? "⏳ Pendente" : "✕ Reprovado"}</span>}<span className={`fv2-unit-status ${u.disponivel ? "on" : "off"}`}>{u.disponivel ? "Disponível" : "Indisponível"}</span></div>
          <div className="fv2-ud-sec">Dados da unidade</div>
          <div className="fv2-cost-tiles"><div className="fv2-tile"><small>TIPOLOGIA</small><strong>{u.tipologia || "—"}</strong></div><div className="fv2-tile"><small>ÁREA</small><strong>{u.area_m2 ?? "—"} m²</strong></div><div className="fv2-tile"><small>VAGAS</small><strong>{u.vagas ?? 0}</strong></div><div className="fv2-tile"><small>VALOR</small><strong>{money.format(u.valor_promo ?? u.valor_tabela ?? 0)}</strong></div></div>
          <div className="fv2-ud-sec">Proprietário</div>
          {ind && u.proprietario_nome ? <div className="fv2-person-card"><span className="fv2-avatar">{initials(u.proprietario_nome)}</span><div><strong>{u.proprietario_nome}</strong><small>{u.proprietario_contato || "Sem contato"}</small></div></div> : <p className="fv2-ud-empty">Sem proprietário — unidade da construtora.</p>}
          <div className="fv2-ud-sec">Corretor indicador</div>
          {ind && u.captador_nome ? <div className="fv2-person-card"><span className="fv2-avatar purple">{initials(u.captador_nome)}</span><div><strong>{u.captador_nome}</strong><small>Indicou esta unidade</small></div></div> : <p className="fv2-ud-empty">Sem indicador — unidade da construtora.</p>}
          <div className="fv2-ud-sec">Acesso</div>
          <div className="fv2-cost-tiles"><div className="fv2-tile"><small>TIPO</small><strong>{acessoLabel(u.acesso_tipo)}</strong></div><div className="fv2-tile"><small>CÓDIGO</small><strong>{u.acesso_codigo || "—"}</strong></div><div className="fv2-tile"><small>INSTRUÇÕES</small><strong>{u.acesso_instrucoes || "—"}</strong></div></div>
          {ind && <><div className="fv2-ud-sec">Fotos da unidade</div>{(() => { const um = (product?.midias ?? []).filter((m) => m.unidade_id === u.id && m.tipo === "foto" && m.url); return um.length ? <div className="fv2-ud-gallery">{um.map((m, i) => <button key={m.id} type="button" onClick={() => setUnitLightbox({ items: um.map((x) => ({ url: x.url ?? "", label: x.categoria || x.nome || "Foto da unidade" })), index: i })} className="fv2-ud-photo watermarked-preview" style={{ backgroundImage: `url(${m.url})` }} aria-label="Ampliar foto da unidade" />)}</div> : <p className="fv2-ud-empty">Nenhuma foto enviada para esta unidade ainda.</p>; })()}</>}
        </div>
        {canPublish && ind && u.aprovacao === "pendente" && <div className="fv2-ud-foot"><button type="button" className="fv2-ud-reject" disabled={busy} onClick={() => void decideUnit(u.id, false)}>✕ Reprovar</button><button type="button" className="fv2-ud-approve" disabled={busy} onClick={() => void decideUnit(u.id, true)}>✓ Aprovar</button></div>}
      </div>
    </div>; })()}
    {unitLightbox && unitLightbox.items[unitLightbox.index]?.url && <div className="photo-lightbox unit-lightbox" role="dialog" aria-modal="true" aria-label="Foto da unidade ampliada"><button className="lightbox-close" type="button" onClick={() => setUnitLightbox(null)} aria-label="Fechar galeria">×</button>{unitLightbox.items.length > 1 && <button className="lightbox-nav previous" type="button" onClick={() => setUnitLightbox((s) => s && ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length }))} aria-label="Foto anterior">‹</button>}<div className="lightbox-image watermarked-preview"><img src={unitLightbox.items[unitLightbox.index].url} alt={unitLightbox.items[unitLightbox.index].label} /></div><div><span>{unitLightbox.index + 1} de {unitLightbox.items.length}</span></div>{unitLightbox.items.length > 1 && <button className="lightbox-nav next" type="button" onClick={() => setUnitLightbox((s) => s && ({ ...s, index: (s.index + 1) % s.items.length }))} aria-label="Próxima foto">›</button>}</div>}
  </div>;
}
