"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type Media = { id: string; tipo: "foto" | "video" | "pdf" | "apresentacao"; storage_path: string; categoria: string | null; nome: string | null; is_capa: boolean; url: string | null };
type Unit = { id: string; numero: string | null; tipologia: string | null; area_m2: number | null; vagas: number | null; valor_tabela: number | null; valor_promo: number | null; disponivel: boolean };
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

export function ProductDetail({ productId, accessToken, sessionRole = "corretor", onClose, onChanged }: { productId: string; accessToken: string; sessionRole?: string; onClose: () => void; onChanged: () => void }) {
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
  const photos = useMemo(() => product?.midias.filter((item) => item.tipo === "foto") ?? [], [product]);
  const videos = useMemo(() => product?.midias.filter((item) => item.tipo === "video") ?? [], [product]);
  const presentations = useMemo(() => product?.midias.filter((item) => item.tipo === "pdf" || item.tipo === "apresentacao") ?? [], [product]);
  const visibleMedia = mediaTab === "fotos" ? photos : mediaTab === "videos" ? videos : presentations;
  const cover = photos.find((item) => item.is_capa) ?? photos[0];

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

  async function submitRequest() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "solicitar" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar a solicitação.");
      await load(); onChanged(); setMessage("Solicitação enviada — aguardando aprovação do gestor.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao enviar solicitação."); } finally { setBusy(false); }
  }

  return <div className="modal-layer product-detail-layer">
    <button className="modal-scrim" type="button" onClick={onClose} aria-label="Fechar ficha do produto" />
    <aside className="product-detail-panel" aria-label="Ficha completa do produto">
      {!product ? <div className="detail-loading">{message || "Carregando dados reais do produto..."}</div> : <>
        <header className="detail-hero" style={cover?.url ? { backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.62)),url(${cover.url})` } : undefined}>
          <button className="icon-button" type="button" onClick={onClose}>×</button>
          <div><span>{product.rascunho ? "Rascunho" : product.status.replace("_", " ")}</span><h2>{product.nome}</h2><p>{product.bairro ?? "Bairro não informado"} · {product.cidade ?? "Cidade não informada"} · Captado por: {product.captado_por_nome ?? "Não informado"}</p></div>
        </header>
        <div className="detail-toolbar"><div><strong>{product.summary_price ? money.format(product.summary_price) : "Preço sob consulta"}</strong><small>{product.completion.completed}/{product.completion.total} blocos completos</small></div><div className="detail-actions"><button className="lead-subtle" type="button" onClick={() => setLeadPanelOpen(!leadPanelOpen)}>↗ Vincular lead{product.leads.some((lead) => lead.linked) ? ` · ${product.leads.filter((lead) => lead.linked).length}` : ""}</button><button className={product.is_favorite ? "favorite active" : "favorite"} disabled={busy} type="button" onClick={() => void productAction("toggleFavorite", !product.is_favorite)}>{product.is_favorite ? "★ Favorito" : "☆ Favoritar"}</button><button className="secondary-action" type="button" onClick={() => setEditing(!editing)}>{editing ? "Cancelar edição" : "Editar produto"}</button>{canPublish ? (product.rascunho ? <button className="publish-action" type="button" disabled={busy} title={product.completion.completed < product.completion.total ? `Faltam ${product.completion.total - product.completion.completed} bloco(s) para ficar 100% completo` : "Produto completo"} onClick={() => void publishAction(true)}>✓ Publicar produto{product.completion.completed < product.completion.total ? " (incompleto)" : ""}</button> : <button className="unpublish-action" type="button" disabled={busy} onClick={() => void publishAction(false)}>↩ Voltar a rascunho</button>) : (product.aprovacao === "pendente" ? <button className="secondary-action" type="button" disabled title="Aguardando aprovação do gestor">⏳ Aguardando aprovação</button> : (product.mine && (product.rascunho || product.aprovacao === "reprovado") ? <button className="publish-action" type="button" disabled={busy} onClick={() => void submitRequest()}>➤ Enviar solicitação</button> : null))}</div></div>
        {leadPanelOpen && <div className="top-lead-panel"><div className="lead-link-form"><select value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">Selecione um lead...</option>{product.leads.filter((lead) => !lead.linked).map((lead) => <option value={lead.id} key={lead.id}>{lead.nome || "Lead sem nome"} · {lead.telefone || "sem telefone"}</option>)}</select><button className="primary-action" disabled={busy || !leadId} type="button" onClick={() => void productAction("linkLead", leadId)}>Vincular</button></div><div className="linked-leads">{product.leads.filter((lead) => lead.linked).map((lead) => <span key={lead.id}><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone}</small><button type="button" disabled={busy} onClick={() => void productAction("unlinkLead", lead.id)}>×</button></span>)}</div></div>}
        <div className="detail-scroll">
          {message && <div className={`detail-message ${message.includes("salv") || message.includes("atualiz") || message.includes("adicionado") ? "success" : ""}`}>{message}</div>}
          {editing ? <div className="detail-form">
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
          </div> : <>
            <section className="detail-stats"><div><strong>{product.summary_area ?? "—"}</strong><span>m² a partir de</span></div><div><strong>{product.dormitorios ?? "—"}</strong><span>dormitórios</span></div><div><strong>{product.suites ?? "—"}</strong><span>suítes</span></div><div><strong>{product.vagas ?? "—"}</strong><span>vagas</span></div></section>
            <section className="completion-card"><div><strong>Completude do cadastro</strong><span>{Math.round((product.completion.completed / product.completion.total) * 100)}%</span></div>{Object.entries(product.completion.checks).map(([key, ok]) => <small className={ok ? "done" : ""} key={key}>{ok ? "✓" : "○"} {{ basics:"Dados básicos",location:"Endereço",owner:"Proprietário",costs:"Custos",access:"Acesso",media:"10 fotos + vídeo + capa",units:"Unidades" }[key] ?? key}</small>)}</section>
            <section className="detail-section"><h3>Resumo</h3><p>{product.descricao || "Sem descrição cadastrada."}</p><div className="detail-pairs"><span>Condomínio<strong>{product.condominio_valor ? money.format(product.condominio_valor) : "—"}</strong></span><span>IPTU<strong>{product.iptu ? money.format(product.iptu) : "—"}</strong></span><span>Outros custos<strong>{product.outros_custos ? money.format(product.outros_custos) : "—"}</strong></span></div></section>
            <section className="detail-section"><h3>Localização e condomínio</h3><p>{[product.endereco, product.numero, product.complemento, product.bairro, product.cidade, product.uf, product.cep].filter(Boolean).join(", ") || "Endereço não cadastrado."}</p>{product.condominios && <p><strong>{product.condominios.nome}</strong> · condomínio associado</p>}</section>
            {product.origem === "terceiros" && <section className="detail-section"><h3>Proprietário e acesso</h3><div className="detail-pairs"><span>Proprietário<strong>{product.proprietarios?.nome ?? "—"}</strong></span><span>Telefone<strong>{product.proprietarios?.telefone ?? "—"}</strong></span><span>E-mail<strong>{product.proprietarios?.email ?? "—"}</strong></span><span>Acesso<strong>{product.acesso_tipo ?? "—"}</strong></span><span>Código<strong>{product.acesso_codigo ?? "—"}</strong></span></div><p>{product.acesso_instrucoes || "Sem instruções de acesso."}</p></section>}
            <section className="detail-section"><div className="section-row"><div><h3>Unidades</h3><small>{product.unidades.length} cadastradas</small></div></div>{product.unidades.length ? <div className="unit-table">{product.unidades.map((unit) => <div key={unit.id}><span>{unit.numero || "—"}</span><span>{unit.tipologia || "—"}</span><span>{unit.area_m2 ?? "—"} m²</span><span>{unit.vagas ?? 0} vaga(s)</span><strong>{money.format(unit.valor_promo ?? unit.valor_tabela ?? 0)}</strong><i className={unit.disponivel ? "available" : ""}>{unit.disponivel ? "Disponível" : "Indisponível"}</i></div>)}</div> : <p>Nenhuma unidade individual cadastrada.</p>}</section>
            <section className="detail-section media-library">
              <div className="section-row"><div><h3>Galeria e materiais</h3><small>{photos.length} fotos · {videos.length} vídeos · {presentations.length} apresentações</small></div><button className={editImages ? "edit-images-btn active" : "edit-images-btn"} type="button" onClick={() => setEditImages(!editImages)}>{editImages ? "✓ Concluir edição" : "✎ Editar imagens"}</button></div>
              <div className="media-tabs"><button className={mediaTab === "fotos" ? "active" : ""} type="button" onClick={() => setMediaTab("fotos")}>Fotos ({photos.length})</button><button className={mediaTab === "videos" ? "active" : ""} type="button" onClick={() => setMediaTab("videos")}>Vídeos ({videos.length})</button><button className={mediaTab === "apresentacoes" ? "active" : ""} type="button" onClick={() => setMediaTab("apresentacoes")}>Apresentações ({presentations.length})</button></div>
              {editImages && <div className="material-upload">{mediaTab === "fotos" && <select value={category} onChange={(event) => setCategory(event.target.value)}>{mediaCategories.map((item) => <option key={item}>{item}</option>)}</select>}<label className="primary-action">＋ {mediaTab === "fotos" ? "Adicionar fotos" : mediaTab === "videos" ? "Adicionar vídeos" : "Adicionar apresentação PDF"}<input disabled={busy} multiple type="file" accept={mediaTab === "fotos" ? "image/*" : mediaTab === "videos" ? "video/*" : ".pdf,application/pdf,.ppt,.pptx"} onChange={(event) => void upload(event.target.files, mediaTab === "videos" ? "Tour" : mediaTab === "apresentacoes" ? "Apresentação" : undefined)} /></label></div>}
              {visibleMedia.length ? <div className="detail-gallery">{visibleMedia.map((item) => <article key={item.id}>
                {editImages && <button className="media-delete" disabled={busy} type="button" onClick={() => setPendingDelete(item)} aria-label={`Excluir ${item.nome ?? "arquivo"}`}>×</button>}
                {item.tipo === "foto" && item.url ? <button className="gallery-open watermarked-preview" type="button" onClick={() => setLightboxIndex(photos.findIndex((photo) => photo.id === item.id))}><img src={item.url} alt={item.categoria || item.nome || "Foto do imóvel"} /><span>Ampliar</span></button> : item.tipo === "video" && item.url ? <div className="watermarked-preview"><video src={item.url} controls preload="metadata" /></div> : item.url ? <button className="file-tile watermarked-preview" type="button" onClick={() => setDocumentPreview(item)}>Abrir {item.tipo === "pdf" ? "PDF" : "apresentação"}</button> : <div className="file-tile watermarked-preview">{item.tipo.toUpperCase()}</div>}
                {editImages ? <div><select aria-label={`Classificação de ${item.nome ?? "material"}`} value={item.categoria ?? "Outros"} onChange={(event) => void mediaAction("updateMedia", item.id, event.target.value)}>{mediaCategories.map((entry) => <option key={entry}>{entry}</option>)}</select><small>{item.nome}</small><div className="media-actions">{item.tipo === "foto" && <button disabled={busy || item.is_capa} type="button" onClick={() => void setCover(item.id)}>{item.is_capa ? "✓ Foto de capa" : "Usar como capa"}</button>}</div></div> : <div className="media-view-label"><strong>{item.categoria ?? "Outros"}{item.is_capa ? " · capa" : ""}</strong><small>{item.nome}</small></div>}
              </article>)}</div> : <p className="empty-media">Nenhum material nesta categoria. Use o botão acima para adicionar.</p>}
            </section>
          </>}
        </div>
      </>}
    </aside>
    {lightboxIndex !== null && photos[lightboxIndex]?.url && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Galeria ampliada"><button className="lightbox-close" type="button" onClick={() => setLightboxIndex(null)} aria-label="Fechar galeria">×</button><button className="lightbox-nav previous" type="button" onClick={() => setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length)} aria-label="Foto anterior">‹</button><div className="lightbox-image watermarked-preview"><img src={photos[lightboxIndex].url ?? ""} alt={photos[lightboxIndex].categoria || photos[lightboxIndex].nome || "Foto ampliada do imóvel"} /></div><div><strong>{photos[lightboxIndex].categoria || "Foto do imóvel"}</strong><span>{lightboxIndex + 1} de {photos.length}</span></div><button className="lightbox-nav next" type="button" onClick={() => setLightboxIndex((lightboxIndex + 1) % photos.length)} aria-label="Próxima foto">›</button></div>}
    {documentPreview?.url && <div className="document-preview-modal" role="dialog" aria-modal="true" aria-label="Visualizar apresentação"><header><strong>{documentPreview.nome || "Apresentação do produto"}</strong><button type="button" onClick={() => setDocumentPreview(null)} aria-label="Fechar apresentação">×</button></header><div className="document-frame watermarked-preview"><iframe src={documentPreview.url} title={documentPreview.nome || "Apresentação do produto"} /></div></div>}
    {pendingDelete && <div className="delete-confirm" role="dialog" aria-modal="true" aria-label="Confirmar exclusão"><div><strong>Excluir este arquivo?</strong><p>{pendingDelete.nome || "O arquivo selecionado"} será removido definitivamente da galeria e do armazenamento.</p><footer><button type="button" onClick={() => setPendingDelete(null)}>Cancelar</button><button className="danger" disabled={busy} type="button" onClick={() => { const id = pendingDelete.id; setPendingDelete(null); void mediaAction("deleteMedia", id); }}>Excluir arquivo</button></footer></div></div>}
  </div>;
}
