"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import type { ProductQuality } from "./quality";
import { isProductManagerRole } from "./access";
import { MoneyInput } from "./MoneyInput";
import { applyOfficialWatermark } from "./watermark";

type Media = { id: string; tipo: "foto" | "video" | "pdf" | "apresentacao"; storage_path: string; categoria: string | null; nome: string | null; is_capa: boolean; url: string | null; unidade_id?: string | null };
type Unit = { id: string; codigo?: string | null; numero: string | null; tipologia: string | null; area_m2: number | null; vagas: number | null; valor_tabela: number | null; valor_promo: number | null; disponivel: boolean; publicado?: boolean; de_terceiros?: boolean; captador_nome?: string | null; proprietario_nome?: string | null; proprietario_contato?: string | null; acesso_tipo?: string | null; acesso_codigo?: string | null; acesso_instrucoes?: string | null; aprovacao?: string | null; reprovacao_motivo?: string | null; mine?: boolean; pode_editar?: boolean };
type Owner = { nome: string; email: string; telefone: string };
type Condo = { id: string; nome: string; endereco: string; numero: string | null; bairro: string | null; cidade: string; uf: string; cep: string | null };
type LeadOption = { id: number; nome: string | null; telefone: string | null; linked: boolean };
type ProductDetailData = {
  id: string; nome: string; titulo: string | null; slug: string | null; slogan: string | null; finalidade: string | null;
  lazer: string[] | null; diferenciais: string[] | null; incorporadora: string | null; descricao: string | null; status: string; origem: string;
  preco: number | null; condominio_valor: number | null; iptu: number | null; outros_custos: number | null;
  area_util: number | null; dormitorios: number | null; suites: number | null; vagas: number | null; banheiros: number | null;
  endereco: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null;
  acesso_tipo: string | null; acesso_codigo: string | null; acesso_instrucoes: string | null; tour_url: string | null; rascunho: boolean; publicado?: boolean; site_published?: boolean;
  condominios: Condo | null; proprietarios: Owner | null; unidades: Unit[]; midias: Media[];
  summary_price: number | null; summary_area: number | null;
  completion: { checks: Record<string, boolean>; completed: number; total: number };
  quality: ProductQuality;
  is_favorite: boolean; leads: LeadOption[];
  aprovacao?: string | null; captado_por_nome?: string | null; mine?: boolean; pode_editar?: boolean; codigo?: string | null;
  latitude?: number | null; longitude?: number | null;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const mediaCategories = ["Fachada", "Sala", "Cozinha", "Dormitório", "Banheiro", "Varanda", "Piscina", "Lazer", "Planta", "Tabela", "Apresentação", "Outros"];
const editableFields = ["nome", "titulo", "slogan", "finalidade", "lazer", "diferenciais", "incorporadora", "descricao", "preco", "condominio_valor", "iptu", "outros_custos", "area_util", "dormitorios", "suites", "vagas", "banheiros", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "cep", "acesso_tipo", "acesso_codigo", "acesso_instrucoes", "tour_url"] as const;

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
const IcStar = () => <Svg size={18}><path d="M12 3l2.6 5.5 6 .9-4.3 4.2 1 6L12 17l-5.3 2.6 1-6L3.4 9.4l6-.9z" /></Svg>;
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

export function ProductDetail({ productId, accessToken, sessionRole = "corretor", initialUnitId, initialEditing = false, captadorScore = null, onClose, onChanged }: { productId: string; accessToken: string; sessionRole?: string; initialUnitId?: string | null; initialEditing?: boolean; captadorScore?: number | null; onClose: () => void; onChanged: () => void }) {
  const canPublish = isProductManagerRole(sessionRole);
  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [draft, setDraft] = useState<Record<string, string | number | null>>({});
  const [owner, setOwner] = useState<Owner | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [condominiums, setCondominiums] = useState<Condo[]>([]);
  const [condominiumId, setCondominiumId] = useState("");
  const [newCondominiumName, setNewCondominiumName] = useState("");
  const [editing, setEditing] = useState(Boolean(initialEditing));
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
  const [tab, setTab] = useState<"resumo" | "site" | "localizacao" | "proprietario" | "unidades" | "galeria">("resumo");
  const [unitDetail, setUnitDetail] = useState<Unit | null>(null);
  const [unitEdit, setUnitEdit] = useState<Unit | null>(null);
  const [unitLightbox, setUnitLightbox] = useState<{ items: { url: string; label: string }[]; index: number } | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState<{ label: string; unitId?: string } | null>(null);

  const load = useCallback(async () => {
    setMessage("");
    const response = await fetch(`/api/product?id=${encodeURIComponent(productId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível abrir o produto.");
    const next = result.product as ProductDetailData;
    setProduct(next);
    if (next.pode_editar === false) setEditing(false);
    setOwner(next.proprietarios ?? { nome: "", email: "", telefone: "" });
    setUnits(next.unidades.filter((unit) => !unit.de_terceiros));
    setCondominiumId(next.condominios?.id ?? "");
    setNewCondominiumName(next.condominios?.nome ?? "");
    setDraft(Object.fromEntries(editableFields.map((field) => {
      const value = next[field];
      return [field, Array.isArray(value) ? value.join(", ") : value ?? (field === "preco" ? next.summary_price : field === "area_util" ? next.summary_area : "")];
    })));
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
  const focusedUnit = useMemo(() => initialUnitId && product ? product.unidades.find((unit) => unit.id === initialUnitId) ?? null : null, [initialUnitId, product]);
  const focusedUnitMedia = useMemo(() => focusedUnit ? (product?.midias ?? []).filter((item) => item.unidade_id === focusedUnit.id) : [], [focusedUnit, product]);
  const focusedUnitOwnPhotos = useMemo(() => focusedUnitMedia.filter((item) => item.tipo === "foto" && item.url), [focusedUnitMedia]);
  const focusedUnitReferencePhotos = useMemo(() => photos.filter((item) => item.url), [photos]);
  // Alguns apartamentos antigos herdaram a capa do condomínio sem receber cópias
  // próprias. Nesse caso a imagem precisa continuar abrindo, mas sempre identificada
  // como referência do prédio para não ser confundida com uma foto da unidade.
  const focusedUnitUsesReferencePhotos = focusedUnitOwnPhotos.length === 0 && focusedUnitReferencePhotos.length > 0;
  const focusedUnitPhotos = focusedUnitUsesReferencePhotos ? focusedUnitReferencePhotos : focusedUnitOwnPhotos;
  const focusedUnitCover = focusedUnitPhotos.find((item) => item.is_capa) ?? focusedUnitPhotos[0];
  const focusedUnitPhotoScope = focusedUnitUsesReferencePhotos ? "condomínio de referência" : "apartamento";
  const focusedUnitPrice = focusedUnit ? (focusedUnit.valor_promo ?? focusedUnit.valor_tabela) : null;
  const focusedUnitPublished = Boolean(product?.site_published && focusedUnit?.publicado !== false && focusedUnit?.disponivel && focusedUnit?.aprovacao === "aprovado");

  const addressLine = useMemo(() => [product?.endereco, product?.numero, product?.bairro, product?.cidade, product?.uf, product?.cep].filter(Boolean).join(", "), [product]);
  // Query pro embed do Google (por texto) — sempre com cidade/UF/Brasil pra melhorar o acerto.
  const mapQuery = useMemo(() => addressLine ? encodeURIComponent(`${addressLine}${product?.cidade ? "" : ", São Paulo, SP"}, Brasil`) : "", [addressLine, product]);
  useEffect(() => {
    if (tab !== "localizacao" || !product) return;
    // Se já tem coordenada salva, usa o OpenStreetMap direto.
    if (product.latitude != null && product.longitude != null) {
      return;
    }
    // Sem coordenada: mostra o embed do Google na hora (render abaixo) e dispara o
    // geocoding NO SERVIDOR só pra CACHEAR — na próxima abertura já vem OSM.
    void fetch(`/api/geocode?id=${product.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {});
  }, [tab, product, accessToken]);

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
      for (const originalFile of Array.from(files)) {
        const file = originalFile.type.startsWith("image/") ? await applyOfficialWatermark(originalFile) : originalFile;
        const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
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

  async function publishAction(publish: boolean, unitId?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: unitId ? (publish ? "publishUnit" : "unpublishUnit") : (publish ? "publish" : "unpublish"), unidadeId: unitId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a ação.");
      await load(); onChanged(); setConfirmUnpublish(null); setMessage(publish ? "Imóvel publicado novamente no site." : "Imóvel retirado do ar. O cadastro, a aprovação e a disponibilidade foram mantidos.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao publicar."); } finally { setBusy(false); }
  }

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

  async function saveUnit() {
    if (!unitEdit) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "updateUnit", unidadeId: unitEdit.id, unidade: unitEdit }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar a unidade.");
      setUnitEdit(null); setUnitDetail(null); await load(); onChanged(); setMessage(result.approval === "pendente" ? "Unidade atualizada e reenviada para aprovação." : "Unidade atualizada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao salvar a unidade."); } finally { setBusy(false); }
  }

  async function uploadUnitMedia(files: FileList | null, unit: Unit) {
    if (!files?.length) return;
    setBusy(true); setMessage("");
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sua sessão expirou.");
      for (const originalFile of Array.from(files)) {
        const file = originalFile.type.startsWith("image/") ? await applyOfficialWatermark(originalFile) : originalFile;
        const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${auth.user.id}/${productId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("empreendimentos").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("midias").insert({ empreendimento_id: productId, unidade_id: unit.id, storage_path: path, tipo: mediaType(file), categoria: "Unidade", nome: file.name, is_capa: false });
        if (insertError) { await supabase.storage.from("empreendimentos").remove([path]); throw insertError; }
      }
      await load(); onChanged(); setMessage("Mídia da unidade adicionada com a marca d’água oficial.");
    } catch (error) { setMessage(error instanceof Error ? `Falha no upload: ${error.message}` : "Falha no upload."); } finally { setBusy(false); }
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

  async function decideProduct(approve: boolean) {
    const motivo = approve ? null : (window.prompt("Motivo da reprovação:", "") ?? "");
    if (!approve && !motivo?.trim()) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/capture", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: approve ? "approve" : "reject", motivo }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a revisão.");
      await load(); onChanged(); setMessage(approve ? "Imóvel aprovado e liberado para o site." : "Imóvel devolvido ao corretor com o motivo informado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao revisar o produto."); } finally { setBusy(false); }
  }

  const captadorLabel = useMemo(() => {
    if (!product) return "Estoque ApêCerto";
    if (product.captado_por_nome) return product.captado_por_nome;
    const names = Array.from(new Set(product.unidades.map((unit) => unit.captador_nome).filter((name): name is string => Boolean(name))));
    return names.length ? names.join(", ") : "Estoque ApêCerto";
  }, [product]);
  const completionPct = product?.quality.score ?? 0;
  const completionLabels: Record<string, string> = { basics: "Dados básicos", location: "Endereço", owner: "Proprietário", costs: "Custos", access: "Acesso", media: "Fotos, vídeo e capa", units: "Unidades" };
  const otherPhotos = photos.filter((item) => item.id !== cover?.id);

  async function deleteProduct() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "deleteProduct" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Não foi possível excluir o produto."); setConfirmDeleteProduct(false); return; }
      onChanged(); onClose();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao excluir."); } finally { setBusy(false); }
  }

  const publishButton = product && (canPublish
    ? (product.aprovacao === "pendente" && !product.rascunho
      ? <div className="fv2-review-actions"><button className="fv2-btn fv2-btn-ghost" type="button" disabled={busy} onClick={() => void decideProduct(false)}>✕ Solicitar correção</button><button className="fv2-btn fv2-btn-publish" type="button" disabled={busy || !product.quality.readyForSite} title={product.quality.readyForSite ? "Aprovar e publicar no site" : product.quality.blocking.join(" · ")} onClick={() => void decideProduct(true)}><IcCheck /> Aprovar e publicar</button></div>
      : !product.site_published
        ? <button className="fv2-btn fv2-btn-publish" type="button" disabled={busy || !product.quality.readyForSite} title={product.quality.readyForSite ? "Publicar no site" : product.quality.blocking.join(" · ")} onClick={() => void publishAction(true)}><IcCheck /> {product.quality.readyForSite ? "Publicar no site" : "Complete o cadastro para publicar"}</button>
        : <button className="fv2-btn fv2-btn-unpublish" type="button" disabled={busy} onClick={() => setConfirmUnpublish({ label: product.nome })}><IcRotate /> Tirar imóvel do ar</button>)
    : (product.aprovacao === "pendente"
      ? <button className="fv2-btn fv2-btn-ghost" type="button" disabled title="Aguardando aprovação do gestor"><IcClock /> Aguardando aprovação</button>
      : (product.mine && (product.rascunho || product.aprovacao === "reprovado")
        ? <button className="fv2-btn fv2-btn-publish" type="button" disabled={busy || !product.quality.readyForSite} title={product.quality.readyForSite ? "Enviar para aprovação" : product.quality.blocking.join(" · ")} onClick={() => void submitRequest()}><IcSend /> {product.quality.readyForSite ? "Enviar para aprovação" : "Complete antes de enviar"}</button>
        : null)));

  const mediaLibrary = product && <section className="detail-section media-library fv2-media">
    <div className="section-row"><div><h3>Galeria e materiais{product?.tour_url ? <a className="fv2-tour-link" href={product.tour_url} target="_blank" rel="noreferrer">Tour virtual</a> : null}</h3><small>{photos.length} fotos · {videos.length} vídeos · {presentations.length} apresentações</small></div>{product?.pode_editar !== false && <button className={editImages ? "edit-images-btn active" : "edit-images-btn"} type="button" onClick={() => setEditImages(!editImages)}>{editImages ? "✓ Concluir edição" : "✎ Editar imagens"}</button>}</div>
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
      {!product ? <div className="detail-loading">{message || "Carregando dados reais do produto..."}</div> : focusedUnit ? (
        <div className="fv2-page fv2-unit-product">
          <button className="fv2-close" type="button" onClick={onClose} aria-label="Fechar ficha do apartamento"><IcClose /></button>
          <div className="fv2-main">
            <div className="fv2-mosaic">
              <button className="fv2-mosaic-cover" type="button" onClick={() => focusedUnitPhotos.length && setUnitLightbox({ items: focusedUnitPhotos.map((item) => ({ url: item.url ?? "", label: focusedUnitUsesReferencePhotos ? `Condomínio · ${item.categoria || item.nome || "Foto do prédio"}` : item.categoria || item.nome || "Foto do apartamento" })), index: 0 })} style={focusedUnitCover?.url ? { backgroundImage: `url(${focusedUnitCover.url})` } : undefined} aria-label={`Ampliar fotos do ${focusedUnitPhotoScope}`}>
                <span className={`fv2-status ${focusedUnit.aprovacao === "aprovado" ? "ready" : "draft"}`}><i />{focusedUnit.aprovacao === "pendente" ? "Aguardando aprovação" : focusedUnit.aprovacao === "reprovado" ? "Correção solicitada" : "Aprovado"}</span>
                {focusedUnitUsesReferencePhotos && <span className="unit-reference-photo-badge">Fotos do condomínio</span>}
              </button>
              <div className="fv2-mosaic-side">
                <div className="fv2-thumb" style={focusedUnitPhotos[1]?.url ? { backgroundImage: `url(${focusedUnitPhotos[1].url})` } : undefined} />
                <button className="fv2-thumb fv2-thumb-more" type="button" disabled={!focusedUnitPhotos.length} onClick={() => focusedUnitPhotos.length && setUnitLightbox({ items: focusedUnitPhotos.map((item) => ({ url: item.url ?? "", label: focusedUnitUsesReferencePhotos ? `Condomínio · ${item.categoria || item.nome || "Foto do prédio"}` : item.categoria || item.nome || "Foto do apartamento" })), index: 0 })}>
                  <IcImages /><span>{focusedUnitPhotos.length ? `Ver ${focusedUnitPhotos.length} foto${focusedUnitPhotos.length === 1 ? "" : "s"} ${focusedUnitUsesReferencePhotos ? "do condomínio" : "da unidade"}` : "Nenhuma foto cadastrada"}</span>
                </button>
              </div>
            </div>

            <div className="fv2-head">
              <span className="unit-product-eyebrow">APARTAMENTO INDIVIDUAL</span>
              <h2>{product.nome} · Un. {focusedUnit.numero || "s/n"}{focusedUnit.codigo && <span className="cod-imovel">{focusedUnit.codigo}</span>}</h2>
              <p className="fv2-address"><IcPin /> {[product.bairro, product.cidade, product.uf].filter(Boolean).join(" · ") || "Endereço não informado"} · Captado por: {focusedUnit.captador_nome || "—"}</p>
              <p className="unit-condo-reference"><IcBuilding /> Condomínio de referência: <strong>{product.condominios?.nome || product.nome}</strong></p>
            </div>

            <div className="fv2-specs">
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcRuler /></span><strong>{focusedUnit.area_m2 ?? "—"} <em>m²</em></strong><small>área do apartamento</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcBed /></span><strong>{focusedUnit.tipologia || "—"}</strong><small>tipologia própria</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcCar /></span><strong>{focusedUnit.vagas ?? 0}</strong><small>vaga(s)</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcSeal /></span><strong>{focusedUnit.disponivel ? "Sim" : "Não"}</strong><small>disponível</small></div>
            </div>

            <nav className="fv2-tabs" aria-label="Dados do apartamento">
              {([["resumo", "Resumo"], ["proprietario", "Proprietário e acesso"], ["galeria", "Galeria da unidade"], ["localizacao", "Condomínio e localização"]] as const).map(([key, label]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
            </nav>

            {message && <div className={`detail-message ${message.includes("salv") || message.includes("atualiz") || message.includes("aprova") ? "success" : ""}`}>{message}</div>}
            <div className="fv2-tab-body">
              {tab === "resumo" && <>
                <div className="unit-independent-note"><IcSeal /><div><strong>Este apartamento é um produto independente</strong><span>Preço, aprovação, proprietário, acesso e fotos pertencem à unidade. O condomínio serve somente como referência de prédio e localização.</span></div></div>
                {focusedUnit.aprovacao === "reprovado" && focusedUnit.reprovacao_motivo && <div className="approval-reason"><strong>Correção solicitada:</strong> {focusedUnit.reprovacao_motivo}</div>}
                <div className="fv2-cost-tiles">
                  <div className="fv2-tile"><small>NÚMERO</small><strong>{focusedUnit.numero || "—"}</strong></div>
                  <div className="fv2-tile"><small>CÓDIGO AP</small><strong>{focusedUnit.codigo || "—"}</strong></div>
                  <div className="fv2-tile"><small>ORIGEM</small><strong>{focusedUnit.de_terceiros ? "Captação individual" : "Estoque da construtora"}</strong></div>
                </div>
              </>}

              {tab === "proprietario" && <>
                {focusedUnit.proprietario_nome ? <div className="fv2-owner-block"><div className="fv2-owner-lead"><span className="fv2-avatar">{initials(focusedUnit.proprietario_nome)}</span><div><strong>{focusedUnit.proprietario_nome}</strong><small>Proprietário deste apartamento</small></div></div>{focusedUnit.proprietario_contato && <div className="fv2-contact-pills"><a className="fv2-pill" href={`tel:${focusedUnit.proprietario_contato}`}><IcPhone />{focusedUnit.proprietario_contato}</a></div>}</div> : <p className="fv2-ud-empty">Proprietário não informado para esta unidade.</p>}
                <div className="fv2-cost-tiles"><div className="fv2-tile"><small>ACESSO</small><strong>{acessoLabel(focusedUnit.acesso_tipo)}</strong></div><div className="fv2-tile"><small>CÓDIGO</small><strong>{focusedUnit.acesso_codigo || "—"}</strong></div><div className="fv2-tile"><small>INSTRUÇÕES</small><strong>{focusedUnit.acesso_instrucoes || "—"}</strong></div></div>
                <div className="fv2-person-card unit-captor-card"><span className="fv2-avatar purple">{initials(focusedUnit.captador_nome)}</span><div><strong>{focusedUnit.captador_nome || "Sem captador"}</strong><small>Corretor responsável por esta unidade</small></div></div>
              </>}

              {tab === "galeria" && <>{focusedUnitUsesReferencePhotos && <div className="unit-reference-media-note"><IcBuilding /><div><strong>Fotos do condomínio de referência</strong><span>Este apartamento ainda não possui fotos próprias. As imagens abaixo são do prédio e estão identificadas para não serem confundidas com a unidade.</span></div></div>}{focusedUnitPhotos.length ? <div className="focused-unit-gallery">{focusedUnitPhotos.map((item, index) => <button key={item.id} type="button" className="watermarked-preview" onClick={() => setUnitLightbox({ items: focusedUnitPhotos.map((photo) => ({ url: photo.url ?? "", label: focusedUnitUsesReferencePhotos ? `Condomínio · ${photo.categoria || photo.nome || "Foto do prédio"}` : photo.categoria || photo.nome || "Foto do apartamento" })), index })}><img src={item.url ?? ""} alt={focusedUnitUsesReferencePhotos ? `Condomínio · ${item.categoria || item.nome || "Foto do prédio"}` : item.categoria || item.nome || "Foto do apartamento"} /></button>)}</div> : <p className="empty-media">Nenhuma foto foi cadastrada para este apartamento nem para o condomínio de referência.</p>}{focusedUnit.pode_editar && <label className="fv2-btn fv2-btn-outline focused-unit-upload">＋ Adicionar fotos ou vídeos da unidade<input hidden multiple type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => void uploadUnitMedia(event.target.files, focusedUnit)} /></label>}</>}

              {tab === "localizacao" && <>
                <h3 className="fv2-loc-title">{[product.endereco, product.numero].filter(Boolean).join(", ") || "Endereço não cadastrado"}</h3>
                <p className="fv2-loc-sub">{[product.bairro, product.cidade].filter(Boolean).join(" · ")}{product.uf ? ` — ${product.uf}` : ""}{product.cep ? ` · CEP ${product.cep}` : ""}</p>
                <div className="fv2-condo"><span className="fv2-condo-ic"><IcBuilding /></span><div><strong>{product.condominios?.nome || product.nome}</strong><small>Vínculo de prédio — não define o preço nem a identidade deste apartamento</small></div></div>
                <div className="fv2-map">{mapQuery ? <iframe title="Mapa do apartamento" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} /> : <div className="fv2-map-placeholder">Endereço não cadastrado.</div>}</div>
              </>}
            </div>
          </div>

          <aside className="fv2-side">
            <div className="fv2-price-card unit-price-card">
              <small>VALOR DESTA UNIDADE</small>
              <strong>{focusedUnitPrice ? money.format(focusedUnitPrice) : "Sob consulta"}</strong>
              {focusedUnitPrice && focusedUnit.area_m2 ? <span className="fv2-price-m2">{money.format(Math.round(focusedUnitPrice / focusedUnit.area_m2))} por m²</span> : null}
              <div className="fv2-side-costs"><div><span>Condomínio</span><b>Não informado na unidade</b></div><div><span>IPTU</span><b>Não informado na unidade</b></div><div><span>Prédio de referência</span><b>{product.condominios?.nome || product.nome}</b></div></div>
            </div>
            <div className="fv2-actions">
              {focusedUnit.pode_editar && <button className="fv2-btn fv2-btn-outline" type="button" disabled={busy} onClick={() => setUnitEdit({ ...focusedUnit })}><IcEdit /> Editar apartamento</button>}
              {canPublish && focusedUnit.de_terceiros && focusedUnit.aprovacao === "pendente" && <div className="focused-unit-decision"><button type="button" className="fv2-ud-reject" disabled={busy} onClick={() => void decideUnit(focusedUnit.id, false)}>✕ Reprovar</button><button type="button" className="fv2-ud-approve" disabled={busy} onClick={() => void decideUnit(focusedUnit.id, true)}>✓ Aprovar unidade</button></div>}
              {canPublish && focusedUnit.aprovacao === "aprovado" && (focusedUnitPublished
                ? <button className="fv2-btn fv2-btn-unpublish" type="button" disabled={busy} onClick={() => setConfirmUnpublish({ unitId: focusedUnit.id, label: `${product.nome} · Un. ${focusedUnit.numero || "s/n"}` })}><IcRotate /> Tirar imóvel do ar</button>
                : <button className="fv2-btn fv2-btn-publish" type="button" disabled={busy || !focusedUnit.disponivel} title={focusedUnit.disponivel ? "Publicar este apartamento no site" : "A unidade precisa estar disponível"} onClick={() => void publishAction(true, focusedUnit.id)}><IcCheck /> Publicar imóvel no site</button>)}
            </div>
            <div className="fv2-person-card"><span className="fv2-avatar purple">{initials(focusedUnit.captador_nome)}</span><div><strong>{focusedUnit.captador_nome || "Sem captador"}</strong><small>Captador desta unidade</small></div></div>
          </aside>
        </div>
      ) : editing ? (
        <div className="fv2-edit">
          <div className="fv2-edit-head"><h2>Editar produto</h2><button className="fv2-btn fv2-btn-ghost" type="button" onClick={() => setEditing(false)}>Cancelar edição</button></div>
          {message && <div className={`detail-message ${message.includes("salv") || message.includes("atualiz") || message.includes("adicionado") ? "success" : ""}`}>{message}</div>}
          {mediaLibrary}<div className="detail-form">
            <h3>Conteúdo que aparece no site</h3>
            <p className="form-guidance">Preencha estes campos com linguagem comercial. A nota é recalculada automaticamente depois de salvar.</p>
            <div className="field-grid"><label>Título comercial<input value={draft.titulo ?? ""} onChange={(event) => setDraft({ ...draft, titulo: event.target.value })} placeholder="Ex.: Apartamento pronto para morar em Moema" /></label><label>Finalidade<select value={draft.finalidade ?? ""} onChange={(event) => setDraft({ ...draft, finalidade: event.target.value })}><option value="">Selecione</option><option value="venda">Venda</option><option value="aluguel">Aluguel</option><option value="lancamento">Lançamento</option></select></label></div>
            <label>Chamada curta (slogan)<input value={draft.slogan ?? ""} onChange={(event) => setDraft({ ...draft, slogan: event.target.value })} placeholder="Uma frase curta que valorize o imóvel" /></label>
            <label>Descrição completa<textarea rows={5} minLength={80} value={draft.descricao ?? ""} onChange={(event) => setDraft({ ...draft, descricao: event.target.value })} /><small>{String(draft.descricao ?? "").trim().length}/80 caracteres mínimos</small></label>
            <div className="field-grid"><label>Lazer e áreas comuns<input value={draft.lazer ?? ""} onChange={(event) => setDraft({ ...draft, lazer: event.target.value })} placeholder="Piscina, academia, salão de festas" /></label><label>Diferenciais<input value={draft.diferenciais ?? ""} onChange={(event) => setDraft({ ...draft, diferenciais: event.target.value })} placeholder="Varanda gourmet, vista livre, reformado" /></label></div>
            <label>Tour virtual (link Matterport ou 360º)<input type="url" placeholder="https://..." value={draft.tour_url ?? ""} onChange={(event) => setDraft({ ...draft, tour_url: event.target.value })} /></label>
            <h3>Dados do imóvel</h3>
            <div className="field-grid">
              {(["nome", "incorporadora", "area_util", "dormitorios", "suites", "vagas", "banheiros"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}<input type={["area_util","dormitorios","suites","vagas","banheiros"].includes(field) ? "number" : "text"} value={draft[field] ?? ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
            </div>
            <MoneyInput key={`principal-${draft.finalidade}`} defaultMode={draft.finalidade === "aluguel" ? "reais" : "milhares"} label={draft.finalidade === "aluguel" ? "Aluguel mensal" : "Preço do imóvel"} value={draft.preco} onChange={(value) => setDraft({ ...draft, preco: value })} />
            <h3>Endereço e custos</h3><div className="field-grid">
              {(["endereco", "numero", "complemento", "bairro", "cidade", "uf", "cep", "condominio_valor", "iptu", "outros_custos"] as const).map((field) => <label key={field}>{field.replaceAll("_", " ")}<input type={["condominio_valor","iptu","outros_custos"].includes(field) ? "number" : "text"} value={draft[field] ?? ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
            </div>
            <label>Condomínio associado<select value={condominiumId} onChange={(event) => { setCondominiumId(event.target.value); if (event.target.value) setNewCondominiumName(""); }}><option value="">Cadastrar novo com o endereço acima</option>{condominiums.map((item) => <option value={item.id} key={item.id}>{item.nome} · {item.bairro ?? item.cidade}</option>)}</select></label>{!condominiumId && <label>Nome do novo condomínio<input value={newCondominiumName} onChange={(event) => setNewCondominiumName(event.target.value)} placeholder="Nome do condomínio" /></label>}
            {product.origem === "terceiros" && <><h3>Acesso ao imóvel</h3><div className="field-grid"><label>Tipo<input value={draft.acesso_tipo ?? ""} onChange={(event) => setDraft({ ...draft, acesso_tipo: event.target.value })} /></label><label>Código digital<input value={draft.acesso_codigo ?? ""} onChange={(event) => setDraft({ ...draft, acesso_codigo: event.target.value })} /></label></div><label>Instruções<textarea rows={3} value={draft.acesso_instrucoes ?? ""} onChange={(event) => setDraft({ ...draft, acesso_instrucoes: event.target.value })} /></label>{owner && <><h3>Proprietário</h3><div className="field-grid">{(["nome", "email", "telefone"] as const).map((field) => <label key={field}>{field}<input value={owner[field]} onChange={(event) => setOwner({ ...owner, [field]: event.target.value })} /></label>)}</div></>}</>}
            <h3>Estoque da construtora</h3><div className="section-row"><small>{draft.finalidade === "aluguel" ? "Edite o estoque da construtora em valor cheio. Indicações individuais ficam protegidas na aba Unidades." : "Edite o estoque da construtora. Indicações individuais ficam protegidas na aba Unidades."}</small><button className="secondary-action" type="button" onClick={() => setUnits([...units, { id: crypto.randomUUID(), numero: "", tipologia: "", area_m2: null, vagas: 0, valor_tabela: null, valor_promo: null, disponivel: true }])}>＋ Unidade</button></div><div className="edit-units">{units.map((unit, index) => <div key={unit.id}><span>{index + 1}</span><input aria-label="Número" value={unit.numero ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, numero: event.target.value } : item))} placeholder="Unidade" /><input aria-label="Tipologia" value={unit.tipologia ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, tipologia: event.target.value } : item))} placeholder="Tipologia" /><input aria-label="Área" type="number" value={unit.area_m2 ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, area_m2: event.target.value ? Number(event.target.value) : null } : item))} placeholder="m²" /><input aria-label="Vagas" type="number" value={unit.vagas ?? ""} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, vagas: event.target.value ? Number(event.target.value) : null } : item))} /><MoneyInput compact defaultMode={draft.finalidade === "aluguel" ? "reais" : "milhares"} label={`Preço da unidade ${unit.numero || index + 1}`} value={unit.valor_tabela} onChange={(value) => setUnits(units.map((item) => item.id === unit.id ? { ...item, valor_tabela: value } : item))} /><label><input type="checkbox" checked={unit.disponivel} onChange={(event) => setUnits(units.map((item) => item.id === unit.id ? { ...item, disponivel: event.target.checked } : item))} /> disponível</label><button type="button" aria-label="Remover unidade" onClick={() => setUnits(units.filter((item) => item.id !== unit.id))}>×</button></div>)}</div>
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
              <h2>{product.nome}{product.codigo && <span className="cod-imovel">{product.codigo}</span>}</h2>
              <p className="fv2-address"><IcPin /> {[product.bairro, product.cidade, product.uf].filter(Boolean).join(" · ") || "Endereço não informado"} · Captado por: {captadorLabel}</p>
            </div>

            <div className="fv2-specs">
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcRuler /></span><strong>{product.summary_area ?? "—"} <em>m²</em></strong><small>a partir de</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcBed /></span><strong>{product.dormitorios ?? "—"}</strong><small>dormitório(s)</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcBath /></span><strong>{product.suites ?? "—"}</strong><small>suíte(s)</small></div>
              <div className="fv2-spec"><span className="fv2-spec-ic"><IcCar /></span><strong>{product.vagas ?? "—"}</strong><small>vaga(s)</small></div>
            </div>

            <nav className="fv2-tabs">
              {([["resumo", "Resumo"], ["site", "Conteúdo do site"], ["localizacao", "Localização"], ["proprietario", "Proprietário"], ["unidades", "Unidades"], ["galeria", "Galeria"]] as const).map(([key, label]) => (
                (key !== "proprietario" || (product.origem === "terceiros" && product.proprietarios)) && <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
              ))}
            </nav>

            {message && <div className={`detail-message ${message.includes("salv") || message.includes("atualiz") || message.includes("adicionado") ? "success" : ""}`}>{message}</div>}

            <div className="fv2-tab-body">
              {tab === "resumo" && <>
                <div className={`fv2-registration quality-${product.quality.level}`}>
                  <span className="fv2-registration-ic"><IcSeal /></span>
                  <div><strong>Qualidade {product.quality.label.toLowerCase()}</strong><small>{product.quality.readyForSite ? "Apto para publicação no site" : `${product.quality.blocking.length} item(ns) impedem a publicação`}</small></div>
                  <b>{completionPct}%</b>
                </div>
                <div className="quality-dimensions">{Object.entries(product.quality.dimensions).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value.score}/{value.max}</strong><i><b style={{ width: `${Math.round((value.score / value.max) * 100)}%` }} /></i></div>)}</div>
                {product.quality.blocking.length > 0 && <div className="quality-blockers"><strong>Corrija antes de publicar</strong>{product.quality.blocking.map((item) => <button type="button" key={item} onClick={() => { if (product.pode_editar !== false) setEditing(true); }}>⚠ {item}{product.pode_editar !== false && <span>Corrigir</span>}</button>)}</div>}
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

              {tab === "site" && <div className="site-content-review">
                <div className="site-content-head"><div><small>COMO O IMÓVEL SERÁ APRESENTADO</small><h3>{product.titulo || product.nome}</h3><p>{product.slogan || "Adicione uma chamada curta para valorizar este imóvel."}</p></div><span className={`quality-badge ${product.quality.level}`}>Nota {product.quality.score}</span></div>
                <div className="site-content-grid"><div><small>FINALIDADE</small><strong>{product.finalidade || "Não informada"}</strong></div><div><small>FOTOS</small><strong>{photos.length}</strong></div><div><small>VÍDEOS / TOUR</small><strong>{videos.length + (product.tour_url ? 1 : 0)}</strong></div><div><small>STATUS</small><strong>{product.site_published ? "Publicado no site" : product.aprovacao === "aprovado" ? "Fora do ar — pode editar" : product.quality.readyForSite ? "Pronto para publicar" : "Bloqueado"}</strong></div></div>
                <section><h4>Descrição</h4><p>{product.descricao || "Nenhuma descrição cadastrada."}</p></section>
                <section><h4>Lazer e áreas comuns</h4><div className="site-content-tags">{product.lazer?.length ? product.lazer.map((item) => <span key={item}>{item}</span>) : <em>Não informado</em>}</div></section>
                <section><h4>Diferenciais</h4><div className="site-content-tags">{product.diferenciais?.length ? product.diferenciais.map((item) => <span key={item}>{item}</span>) : <em>Não informado</em>}</div></section>
                <div className="site-content-actions">{product.pode_editar !== false && <button className="fv2-btn fv2-btn-outline" type="button" onClick={() => setEditing(true)}><IcEdit /> Editar conteúdo</button>}{product.site_published && <a className="fv2-btn fv2-btn-ghost" href={`https://apecerto.com/?imovel=${encodeURIComponent(product.slug || product.id)}`} target="_blank" rel="noreferrer"><IcLink /> Ver este imóvel no site</a>}</div>
              </div>}

              {tab === "localizacao" && <>
                <h3 className="fv2-loc-title">{[product.endereco, product.numero].filter(Boolean).join(", ") || "Endereço não cadastrado"}</h3>
                <p className="fv2-loc-sub">{[product.bairro, product.cidade].filter(Boolean).join(" · ")}{product.uf ? ` — ${product.uf}` : ""}{product.cep ? ` · CEP ${product.cep}` : ""}</p>
                {product.condominios && <div className="fv2-condo"><span className="fv2-condo-ic"><IcBuilding /></span><div><strong>{product.condominios.nome}</strong><small>Condomínio associado</small></div></div>}
                <div className="fv2-map">
                  {mapQuery ? <iframe title="Mapa do imóvel" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} />
                    : <div className="fv2-map-placeholder">Endereço não cadastrado.</div>}
                </div>
              </>}

              {tab === "proprietario" && product.origem === "terceiros" && product.proprietarios && <>
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

              {tab === "unidades" && <div className="fv2-units">{product.unidades.length ? <><div className="fv2-unit-head"><span>Unidade / Origem</span><span>Tipologia</span><span>Área</span><span>Vagas</span><span>Valor</span><span>Status</span></div>{product.unidades.map((unit) => { const ind = Boolean(unit.de_terceiros); return <button type="button" className="fv2-unit-row" key={unit.id} onClick={() => setUnitDetail(unit)}><span className="fv2-unit-main"><span className="fv2-unit-num">{unit.numero || "—"}{unit.codigo ? <em className="fv2-unit-cod">{unit.codigo}</em> : null}</span><span className={`fv2-unit-origin ${ind ? "indic" : "constru"}`}>{ind ? "Indicação" : "Construtora"}</span>{ind && (unit.captador_nome || unit.proprietario_nome) && <small className="fv2-unit-sub">👤 {unit.captador_nome ?? "—"}{unit.proprietario_nome ? ` · Prop.: ${unit.proprietario_nome}` : ""}</small>}</span><span className="fv2-unit-c">{unit.tipologia || "—"}</span><span className="fv2-unit-c">{unit.area_m2 ?? "—"} m²</span><span className="fv2-unit-c">{unit.vagas ?? 0} vaga(s)</span><strong className="fv2-unit-val">{money.format(unit.valor_promo ?? unit.valor_tabela ?? 0)}</strong><i className={`fv2-unit-status ${unit.disponivel ? "on" : "off"}`}>{unit.disponivel ? "Disponível" : "Indisponível"}</i></button>; })}</> : <p className="empty-media">Nenhuma unidade individual cadastrada.</p>}</div>}

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
              {product.pode_editar !== false && <button className="fv2-btn fv2-btn-outline" type="button" onClick={() => setEditing(true)}><IcEdit /> Editar produto</button>}
              <div className="fv2-action-row">
                <button className={product.is_favorite ? "fv2-btn fv2-btn-outline active" : "fv2-btn fv2-btn-outline"} disabled={busy} type="button" onClick={() => void productAction("toggleFavorite", !product.is_favorite)}><IcStar /> {product.is_favorite ? "Favorito" : "Favoritar"}</button>
              </div>
              {publishButton}
              {canPublish && <button className="fv2-btn fv2-btn-ghost" type="button" disabled={busy} onClick={() => setConfirmDeleteProduct(true)}>Excluir produto</button>}
            </div>

            {product.origem === "terceiros" && product.proprietarios && <div className="fv2-person-card">
              <span className="fv2-avatar">{initials(product.proprietarios?.nome)}</span>
              <div><strong>{product.proprietarios?.nome ?? "—"}</strong><small>Proprietária{product.proprietarios?.telefone ? ` · ${product.proprietarios.telefone}` : ""}</small></div>
            </div>}

            {(() => {
              const captadores = product.captado_por_nome ? [product.captado_por_nome] : Array.from(new Set((product.unidades ?? []).map((u) => u.captador_nome).filter((n): n is string => Boolean(n))));
              const rotulo = captadores.length ? captadores.join(", ") : "Estoque ApêCerto";
              const legenda = captadores.length > 1 ? "Corretores das captações" : captadores.length === 1 ? "Corretor da captação" : "Prédio sem captador vinculado";
              return <div className="fv2-person-card">
                <span className="fv2-avatar purple">{initials(captadores[0] ?? "ApêCerto")}</span>
                <div><strong>{rotulo}</strong><small>{legenda}{typeof captadorScore === "number" && captadores.length === 1 ? ` · nota ${captadorScore}` : ""}</small></div>
              </div>;
            })()}
          </aside>
        </div>
      )}
    </aside>
    {lightboxIndex !== null && photos[lightboxIndex]?.url && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Galeria ampliada"><button className="lightbox-close" type="button" onClick={() => setLightboxIndex(null)} aria-label="Fechar galeria">×</button><button className="lightbox-nav previous" type="button" onClick={() => setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)} aria-label="Foto anterior">‹</button><div className="lightbox-image watermarked-preview"><img src={photos[lightboxIndex].url ?? ""} alt={photos[lightboxIndex].categoria || photos[lightboxIndex].nome || "Foto ampliada do imóvel"} /></div><div><strong>{photos[lightboxIndex].categoria || "Foto do imóvel"}</strong><span>{lightboxIndex + 1} de {photos.length}</span></div><button className="lightbox-nav next" type="button" onClick={() => setLightboxIndex((lightboxIndex + 1) % photos.length)} aria-label="Próxima foto">›</button></div>}
    {documentPreview?.url && <div className="document-preview-modal" role="dialog" aria-modal="true" aria-label="Visualizar apresentação"><header><strong>{documentPreview.nome || "Apresentação do produto"}</strong><button type="button" onClick={() => setDocumentPreview(null)} aria-label="Fechar apresentação">×</button></header><div className="document-frame watermarked-preview"><iframe src={documentPreview.url} title={documentPreview.nome || "Apresentação do produto"} /></div></div>}
    {pendingDelete && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão"><div><strong>Excluir este arquivo?</strong><p>{pendingDelete.nome || "O arquivo selecionado"} será removido definitivamente da galeria e do armazenamento.</p><footer><button type="button" onClick={() => setPendingDelete(null)}>Cancelar</button><button className="danger" disabled={busy} type="button" onClick={() => { const id = pendingDelete.id; setPendingDelete(null); void mediaAction("deleteMedia", id); }}>Excluir arquivo</button></footer></div></div>}
    {confirmDeleteProduct && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão do produto"><div><strong>Excluir este produto definitivamente?</strong><p><strong>{product?.nome || "Este produto"}</strong> e todas as suas unidades, fotos e vínculos serão removidos para sempre. Esta ação não pode ser desfeita.</p><footer><button type="button" onClick={() => setConfirmDeleteProduct(false)}>Cancelar</button><button className="danger" disabled={busy} type="button" onClick={() => void deleteProduct()}>Excluir para sempre</button></footer></div></div>}
    {confirmUnpublish && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar retirada do imóvel do site"><div><strong>Tirar este imóvel do ar?</strong><p><strong>{confirmUnpublish.label}</strong> desaparecerá do site imediatamente. O cadastro, a aprovação e a disponibilidade serão preservados para você editar e publicar novamente depois.</p><footer><button type="button" onClick={() => setConfirmUnpublish(null)}>Cancelar</button><button className="danger" disabled={busy} type="button" onClick={() => void publishAction(false, confirmUnpublish.unitId)}>Tirar do ar</button></footer></div></div>}
    {unitDetail && (() => {
      const u = unitDetail;
      const ind = Boolean(u.de_terceiros);
      const unitMedia = (product?.midias ?? []).filter((m) => m.unidade_id === u.id && m.tipo === "foto" && m.url);
      return <div className="ficha-v2 fv2-unit-detail-ov" role="dialog" aria-modal="true" aria-label="Detalhe da unidade" onMouseDown={(event) => { if (event.target === event.currentTarget) setUnitDetail(null); }}>
        <div className="fv2-unit-detail">
          <div className="fv2-ud-head"><div><h2>Unidade {u.numero || "—"}</h2>{u.codigo && <span className="cod-imovel">{u.codigo}</span>}</div><button type="button" onClick={() => setUnitDetail(null)} aria-label="Fechar"><IcClose /></button></div>
          <div className="fv2-ud-body">
            <div className="fv2-ud-badges"><span className={`fv2-unit-origin ${ind ? "indic" : "constru"}`}>{ind ? "Indicação" : "Construtora"}</span>{ind && u.aprovacao && u.aprovacao !== "aprovado" && <span className={`fv2-ud-aprov ${u.aprovacao}`}>{u.aprovacao === "pendente" ? "⏳ Pendente" : "✕ Reprovado"}</span>}<span className={`fv2-unit-status ${u.disponivel ? "on" : "off"}`}>{u.disponivel ? "Disponível" : "Indisponível"}</span></div>
            {u.aprovacao === "reprovado" && u.reprovacao_motivo && <div className="approval-reason"><strong>Correção solicitada:</strong> {u.reprovacao_motivo}</div>}
            <div className="fv2-ud-sec">Dados da unidade</div>
            <div className="fv2-cost-tiles"><div className="fv2-tile"><small>TIPOLOGIA</small><strong>{u.tipologia || "—"}</strong></div><div className="fv2-tile"><small>ÁREA</small><strong>{u.area_m2 ?? "—"} m²</strong></div><div className="fv2-tile"><small>VAGAS</small><strong>{u.vagas ?? 0}</strong></div><div className="fv2-tile"><small>VALOR</small><strong>{money.format(u.valor_promo ?? u.valor_tabela ?? 0)}</strong></div></div>
            <div className="fv2-ud-sec">Proprietário</div>
            {ind && u.proprietario_nome ? <div className="fv2-person-card"><span className="fv2-avatar">{initials(u.proprietario_nome)}</span><div><strong>{u.proprietario_nome}</strong><small>{u.proprietario_contato || "Sem contato"}</small></div></div> : <p className="fv2-ud-empty">{ind ? "Dados protegidos — visíveis apenas ao captador e à gestão." : "Sem proprietário — unidade da construtora."}</p>}
            <div className="fv2-ud-sec">Corretor indicador</div>
            {ind && u.captador_nome ? <div className="fv2-person-card"><span className="fv2-avatar purple">{initials(u.captador_nome)}</span><div><strong>{u.captador_nome}</strong><small>Indicou esta unidade</small></div></div> : <p className="fv2-ud-empty">Sem indicador — unidade da construtora.</p>}
            <div className="fv2-ud-sec">Acesso</div>
            <div className="fv2-cost-tiles"><div className="fv2-tile"><small>TIPO</small><strong>{acessoLabel(u.acesso_tipo)}</strong></div><div className="fv2-tile"><small>CÓDIGO</small><strong>{u.acesso_codigo || "—"}</strong></div><div className="fv2-tile"><small>INSTRUÇÕES</small><strong>{u.acesso_instrucoes || "—"}</strong></div></div>
            {ind && <><div className="fv2-ud-sec">Fotos da unidade</div>{unitMedia.length ? <div className="fv2-ud-gallery">{unitMedia.map((m, i) => <button key={m.id} type="button" onClick={() => setUnitLightbox({ items: unitMedia.map((x) => ({ url: x.url ?? "", label: x.categoria || x.nome || "Foto da unidade" })), index: i })} className="fv2-ud-photo watermarked-preview" style={{ backgroundImage: `url(${m.url})` }} aria-label="Ampliar foto da unidade" />)}</div> : <p className="fv2-ud-empty">Nenhuma foto enviada para esta unidade ainda.</p>}{u.pode_editar && <label className="fv2-btn fv2-btn-outline">＋ Adicionar fotos ou vídeos<input hidden multiple type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => void uploadUnitMedia(event.target.files, u)} /></label>}</>}
          </div>
          {(u.pode_editar || (canPublish && ind && u.aprovacao === "pendente")) && <div className="fv2-ud-foot">{u.pode_editar && <button type="button" className="fv2-btn fv2-btn-outline" disabled={busy} onClick={() => setUnitEdit({ ...u })}><IcEdit /> Editar unidade</button>}{canPublish && ind && u.aprovacao === "pendente" && <><button type="button" className="fv2-ud-reject" disabled={busy} onClick={() => void decideUnit(u.id, false)}>✕ Reprovar</button><button type="button" className="fv2-ud-approve" disabled={busy} onClick={() => void decideUnit(u.id, true)}>✓ Aprovar</button></>}</div>}
        </div>
      </div>;
    })()}
    {unitEdit && <div className="modal-layer fv2-unit-edit-layer" role="dialog" aria-modal="true" aria-label="Editar unidade">
      <button className="modal-scrim" type="button" onClick={() => setUnitEdit(null)} aria-label="Fechar edição" />
      <section className="capture-panel fv2-unit-edit-panel">
        <header className="capture-header"><div><span className="eyebrow">{unitEdit.codigo || "UNIDADE"}</span><h2>Editar unidade {unitEdit.numero || ""}</h2><p>Ao salvar, uma correção feita pelo corretor volta para aprovação.</p></div><button className="icon-button" type="button" onClick={() => setUnitEdit(null)} aria-label="Fechar">×</button></header>
        <div className="capture-body"><div className="form-section"><div className="field-grid"><label>Número<input value={unitEdit.numero ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, numero: event.target.value })} /></label><label>Tipologia<input value={unitEdit.tipologia ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, tipologia: event.target.value })} /></label><label>Área (m²)<input type="number" min="0" value={unitEdit.area_m2 ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, area_m2: event.target.value ? Number(event.target.value) : null })} /></label><label>Vagas<input type="number" min="0" value={unitEdit.vagas ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, vagas: event.target.value ? Number(event.target.value) : null })} /></label></div><div className="unit-money-grid"><MoneyInput label="Valor de tabela" value={unitEdit.valor_tabela} onChange={(value) => setUnitEdit({ ...unitEdit, valor_tabela: value })} /><MoneyInput label="Valor promocional" value={unitEdit.valor_promo} onChange={(value) => setUnitEdit({ ...unitEdit, valor_promo: value })} /></div><h3>Proprietário</h3><div className="field-grid"><label>Nome<input value={unitEdit.proprietario_nome ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, proprietario_nome: event.target.value })} /></label><label>Contato<input value={unitEdit.proprietario_contato ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, proprietario_contato: event.target.value })} /></label></div><h3>Acesso</h3><div className="field-grid"><label>Tipo<input value={unitEdit.acesso_tipo ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, acesso_tipo: event.target.value })} /></label><label>Código<input value={unitEdit.acesso_codigo ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, acesso_codigo: event.target.value })} /></label></div><label>Instruções<textarea rows={4} value={unitEdit.acesso_instrucoes ?? ""} onChange={(event) => setUnitEdit({ ...unitEdit, acesso_instrucoes: event.target.value })} /></label><label className="toggle"><input type="checkbox" checked={unitEdit.disponivel} onChange={(event) => setUnitEdit({ ...unitEdit, disponivel: event.target.checked })} /> Unidade disponível</label></div></div>
        <footer className="capture-footer"><button className="ghost-action" type="button" onClick={() => setUnitEdit(null)}>Cancelar</button><button className="primary-action" type="button" disabled={busy} onClick={() => void saveUnit()}>{busy ? "Salvando..." : "Salvar unidade"}</button></footer>
      </section>
    </div>}
    {unitLightbox && unitLightbox.items[unitLightbox.index]?.url && <div className="photo-lightbox unit-lightbox" role="dialog" aria-modal="true" aria-label="Foto do imóvel ampliada"><button className="lightbox-close" type="button" onClick={() => setUnitLightbox(null)} aria-label="Fechar galeria">×</button>{unitLightbox.items.length > 1 && <button className="lightbox-nav previous" type="button" onClick={() => setUnitLightbox((s) => s && ({ ...s, index: (s.index - 1 + s.items.length) % s.items.length }))} aria-label="Foto anterior">‹</button>}<div className="lightbox-image watermarked-preview"><img src={unitLightbox.items[unitLightbox.index].url} alt={unitLightbox.items[unitLightbox.index].label} /></div><div><strong>{unitLightbox.items[unitLightbox.index].label}</strong><span>{unitLightbox.index + 1} de {unitLightbox.items.length}</span></div>{unitLightbox.items.length > 1 && <button className="lightbox-nav next" type="button" onClick={() => setUnitLightbox((s) => s && ({ ...s, index: (s.index + 1) % s.items.length }))} aria-label="Próxima foto">›</button>}</div>}
  </div>;
}
