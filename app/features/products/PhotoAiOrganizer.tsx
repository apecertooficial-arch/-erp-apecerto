"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { productFailureMessage, productResponse } from "./product-client";

const categories = ["Fachada", "Sala", "Cozinha", "Dormitório", "Suíte", "Banheiro", "Varanda", "Piscina", "Lazer", "Planta", "Vista", "Outros"] as const;
const warnings = ["nenhum", "qualidade_ruim", "duplicada", "ambiente_incerto", "nao_representa_imovel"] as const;
const safeReasons = new Set(["ia_indisponivel", "sem_permissao", "lote_invalido", "limite_temporario", "midias_invalidas", "versao_indisponivel", "imagem_indisponivel", "timeout", "network_error", "rate_limit", "provider_unavailable", "provider_rejected", "resposta_parcial"]);

type Photo = {
  id: string;
  url: string | null;
  categoria: string | null;
  nome: string | null;
  alt_text?: string | null;
  is_capa: boolean;
  ordem: number;
};

type Suggestion = {
  media_id: string;
  category: typeof categories[number];
  sort_order: number;
  is_cover: boolean;
  display_name: string;
  alt_text: string;
  warning: typeof warnings[number];
  warning_detail: string;
  confidence: number;
  accepted: boolean;
};

type UndoState = { version: string; snapshot: unknown[] };
type Phase = "ready" | "confirm" | "analyzing" | "suggestions" | "partial" | "error" | "unavailable" | "applied" | "undoing";

const warningLabels: Record<Suggestion["warning"], string> = {
  nenhum: "Sem alerta",
  qualidade_ruim: "Qualidade ruim",
  duplicada: "Possível duplicata",
  ambiente_incerto: "Ambiente incerto",
  nao_representa_imovel: "Pode não representar o imóvel",
};

function safeReason(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const reason = (value as { reason?: unknown }).reason;
  return typeof reason === "string" && safeReasons.has(reason) ? reason : "";
}

async function invokeReason(error: unknown) {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return "";
  const payload = await context.json().catch(() => null) as unknown;
  return safeReason(payload);
}

function parseSuggestions(value: unknown, mediaIds: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.ok !== true || typeof payload.set_version !== "string" || !/^[0-9a-f]{32}$/i.test(payload.set_version) || !Array.isArray(payload.suggestions)) return null;
  if (payload.suggestions.length !== mediaIds.length) return null;
  const allowedIds = new Set(mediaIds);
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  let coverCount = 0;
  const parsed: Suggestion[] = [];
  for (const raw of payload.suggestions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.media_id !== "string" || !allowedIds.has(item.media_id) || seenIds.has(item.media_id)) return null;
    if (typeof item.category !== "string" || !categories.includes(item.category as Suggestion["category"])) return null;
    if (!Number.isInteger(item.sort_order) || Number(item.sort_order) < 0 || Number(item.sort_order) >= mediaIds.length || seenOrders.has(Number(item.sort_order))) return null;
    if (typeof item.is_cover !== "boolean" || typeof item.display_name !== "string" || item.display_name.trim().length < 3 || item.display_name.trim().length > 120) return null;
    if (typeof item.alt_text !== "string" || item.alt_text.trim().length < 3 || item.alt_text.trim().length > 220) return null;
    if (typeof item.warning !== "string" || !warnings.includes(item.warning as Suggestion["warning"]) || typeof item.warning_detail !== "string" || item.warning_detail.length > 180) return null;
    if (typeof item.confidence !== "number" || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) return null;
    seenIds.add(item.media_id);
    seenOrders.add(Number(item.sort_order));
    if (item.is_cover) coverCount += 1;
    parsed.push({
      media_id: item.media_id,
      category: item.category as Suggestion["category"],
      sort_order: Number(item.sort_order),
      is_cover: item.is_cover,
      display_name: item.display_name.trim(),
      alt_text: item.alt_text.trim(),
      warning: item.warning as Suggestion["warning"],
      warning_detail: item.warning_detail.trim(),
      confidence: item.confidence,
      accepted: true,
    });
  }
  if (coverCount !== 1) return null;
  return { setVersion: payload.set_version, suggestions: parsed.sort((left, right) => left.sort_order - right.sort_order) };
}

function reasonMessage(reason: string) {
  if (reason === "limite_temporario" || reason === "rate_limit") return "O limite temporário da IA foi atingido. Aguarde alguns minutos.";
  if (reason === "timeout") return "A análise demorou além do limite. Tente novamente mais tarde.";
  if (reason === "sem_permissao") return "Você não tem permissão para organizar esta galeria.";
  if (reason === "midias_invalidas" || reason === "imagem_indisponivel" || reason === "lote_invalido") return "Uma ou mais fotos mudaram ou estão indisponíveis. Atualize a ficha e tente novamente.";
  if (reason === "ia_indisponivel") return "A organização por IA está temporariamente indisponível. A edição manual continua funcionando.";
  return "Não foi possível analisar as fotos. A edição manual continua funcionando.";
}

export function PhotoAiOrganizer({
  productId,
  unitId,
  propertyType,
  photos,
  accessToken,
  disabled = false,
  onApplied,
}: {
  productId: string;
  unitId?: string | null;
  propertyType: string;
  photos: Photo[];
  accessToken: string;
  disabled?: boolean;
  onApplied: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("ready");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [setVersion, setSetVersion] = useState("");
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [message, setMessage] = useState("");
  const selectedCount = selected.size;
  const selectedPhotos = useMemo(() => photos.filter((photo) => selected.has(photo.id)).slice(0, 20), [photos, selected]);

  function togglePhoto(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }

  async function analyze() {
    setPhase("analyzing");
    setMessage("");
    setUndo(null);
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.functions.invoke("ia-router", { body: {
      action: "organizar_fotos_produto",
      empreendimento_id: productId,
      unidade_id: unitId ?? null,
      media_ids: selectedPhotos.map((photo) => photo.id),
      tipo_imovel: propertyType.slice(0, 60),
    } });
    const reason = safeReason(data) || (error ? await invokeReason(error) : "");
    if ((data as { partial?: unknown } | null)?.partial === true || reason === "resposta_parcial") {
      setPhase("partial");
      setMessage("A análise chegou incompleta. Nenhuma alteração foi aplicada.");
      return;
    }
    const parsed = parseSuggestions(data, selectedPhotos.map((photo) => photo.id));
    if (error || !parsed) {
      setPhase(reason === "ia_indisponivel" ? "unavailable" : "error");
      setMessage(reasonMessage(reason));
      return;
    }
    setSuggestions(parsed.suggestions);
    setSetVersion(parsed.setVersion);
    setPhase("suggestions");
  }

  function updateSuggestion(mediaId: string, patch: Partial<Suggestion>) {
    setSuggestions((current) => current.map((item) => item.media_id === mediaId ? { ...item, ...patch } : item));
  }

  async function apply() {
    const accepted = suggestions.filter((item) => item.accepted);
    if (!accepted.length) {
      setMessage("Aceite ao menos uma sugestão antes de aplicar.");
      return;
    }
    const orders = new Set(accepted.map((item) => item.sort_order));
    if (orders.size !== accepted.length || accepted.some((item) => item.display_name.trim().length < 3 || item.alt_text.trim().length < 3)) {
      setMessage("Revise nomes, textos alternativos e ordens duplicadas antes de aplicar.");
      return;
    }
    setPhase("analyzing");
    setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({
        id: productId,
        action: "applyPhotoAiSuggestions",
        unitId: unitId ?? null,
        expectedVersion: setVersion,
        suggestions: accepted.map((item) => ({ media_id: item.media_id, category: item.category, sort_order: item.sort_order, is_cover: item.is_cover, display_name: item.display_name, alt_text: item.alt_text, confidence: item.confidence })),
      }) });
      const result = await productResponse(response, "Não foi possível aplicar as sugestões.");
      const snapshot = Array.isArray(result.desfazer) ? result.desfazer : [];
      if (typeof result.versao !== "string" || !snapshot.length) throw new Error("invalid_response");
      setUndo({ version: result.versao, snapshot });
      await onApplied();
      setPhase("applied");
      setMessage("Sugestões aplicadas após sua confirmação.");
    } catch (error) {
      setPhase("error");
      setMessage(productFailureMessage(error, "Não foi possível aplicar as sugestões."));
    }
  }

  async function undoApply() {
    if (!undo?.snapshot.length) return;
    setPhase("undoing");
    setMessage("");
    try {
      const response = await fetch("/api/product", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: productId, action: "restorePhotoAiSuggestions", unitId: unitId ?? null, expectedVersion: undo.version, suggestions: undo.snapshot }) });
      await productResponse(response, "Não foi possível desfazer porque a galeria foi alterada.");
      await onApplied();
      setUndo(null);
      setSuggestions([]);
      setSelected(new Set());
      setPhase("ready");
      setMessage("A organização anterior foi restaurada.");
    } catch (error) {
      setPhase("error");
      setMessage(productFailureMessage(error, "Não foi possível desfazer porque a galeria foi alterada."));
    }
  }

  if (!photos.length) return null;

  return <section className="photo-ai-organizer" aria-label="Organizar fotos com IA">
    <header><div><span className="photo-ai-kicker">IA assistiva</span><strong>Organizar fotos com IA</strong><small>A IA apenas sugere. Você revisa tudo antes de aplicar.</small></div>{phase !== "suggestions" && <button className="photo-ai-action" type="button" disabled={disabled || selectedCount < 1 || phase === "analyzing" || phase === "undoing"} onClick={() => setPhase("confirm")}>{phase === "analyzing" ? "Analisando..." : `Organizar ${selectedCount || ""} foto${selectedCount === 1 ? "" : "s"}`}</button>}</header>
    {(phase === "ready" || phase === "confirm" || phase === "error" || phase === "partial" || phase === "unavailable") && <>
      <div className="photo-ai-selection-toolbar"><button type="button" onClick={() => setSelected(new Set(photos.slice(0, 20).map((photo) => photo.id)))}>Selecionar até 20</button><button type="button" onClick={() => setSelected(new Set())}>Limpar</button><span>{selectedCount}/20 selecionadas</span></div>
      <div className="photo-ai-thumbs">{photos.map((photo) => <label key={photo.id} className={selected.has(photo.id) ? "selected" : ""}><input type="checkbox" checked={selected.has(photo.id)} onChange={() => togglePhoto(photo.id)} disabled={!selected.has(photo.id) && selectedCount >= 20} />{photo.url ? <img src={photo.url} alt={photo.alt_text || photo.categoria || "Foto do imóvel"} /> : <span>Sem prévia</span>}<small>{photo.categoria || "Sem categoria"}</small></label>)}</div>
    </>}
    {phase === "confirm" && <div className="photo-ai-confirm" role="alertdialog" aria-label="Confirmar envio das fotos"><strong>Confirme antes de enviar</strong><p>A OpenAI receberá somente versões otimizadas das fotos selecionadas e o tipo genérico do imóvel para sugerir categoria, ordem, capa e texto alternativo. Nenhum proprietário, contato, endereço privado ou nota interna será enviado.</p><div><button type="button" onClick={() => setPhase("ready")}>Cancelar</button><button className="photo-ai-action" type="button" onClick={() => void analyze()}>Confirmar e analisar</button></div></div>}
    {phase === "suggestions" && <div className="photo-ai-review"><div className="photo-ai-review-head"><div><strong>Revise o que mudou</strong><small>Altere, rejeite ou escolha outra capa antes de aplicar.</small></div><button type="button" onClick={() => { setSuggestions([]); setPhase("ready"); }}>Descartar tudo</button></div>{suggestions.map((suggestion) => { const photo = photos.find((item) => item.id === suggestion.media_id); return <article key={suggestion.media_id} className={suggestion.accepted ? "" : "rejected"}>{photo?.url && <img src={photo.url} alt={photo.alt_text || "Foto em revisão"} />}<div className="photo-ai-changes"><div><small>Categoria atual</small><span>{photo?.categoria || "Sem categoria"}</span><b>→</b><select value={suggestion.category} onChange={(event) => updateSuggestion(suggestion.media_id, { category: event.target.value as Suggestion["category"] })}>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select></div><label>Nome de exibição<input maxLength={120} value={suggestion.display_name} onChange={(event) => updateSuggestion(suggestion.media_id, { display_name: event.target.value })} /></label><label>Texto alternativo<input maxLength={220} value={suggestion.alt_text} onChange={(event) => updateSuggestion(suggestion.media_id, { alt_text: event.target.value })} /></label><div className="photo-ai-inline"><label>Ordem<input type="number" min="0" max="19" value={suggestion.sort_order} onChange={(event) => updateSuggestion(suggestion.media_id, { sort_order: Number(event.target.value) })} /></label><label className="photo-ai-cover"><input type="radio" name={`photo-ai-cover-${productId}-${unitId || "product"}`} checked={suggestion.is_cover} onChange={() => setSuggestions((current) => current.map((item) => ({ ...item, is_cover: item.media_id === suggestion.media_id })))} /> Melhor capa</label></div>{suggestion.warning !== "nenhum" && <p className="photo-ai-warning"><strong>{warningLabels[suggestion.warning]}</strong>{suggestion.warning_detail && ` · ${suggestion.warning_detail}`}</p>}<button className="photo-ai-reject" type="button" onClick={() => updateSuggestion(suggestion.media_id, { accepted: !suggestion.accepted })}>{suggestion.accepted ? "Rejeitar esta sugestão" : "Aceitar novamente"}</button></div></article>; })}<div className="photo-ai-review-actions"><button type="button" onClick={() => { setSuggestions([]); setPhase("ready"); }}>Cancelar</button><button className="photo-ai-action" type="button" onClick={() => void apply()}>Aplicar sugestões aceitas</button></div></div>}
    {(phase === "analyzing" || phase === "undoing") && <div className="photo-ai-progress" role="status"><span aria-hidden="true" />{phase === "undoing" ? "Desfazendo com segurança..." : "Enviando versões otimizadas e analisando..."}</div>}
    {message && <p className={`photo-ai-message ${phase}`}>{message}</p>}
    {phase === "applied" && undo && <button className="photo-ai-undo" type="button" onClick={() => void undoApply()}>Desfazer aplicação</button>}
  </section>;
}
