"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

const categories = ["Fachada", "Sala", "Cozinha", "Dormitório", "Suíte", "Banheiro", "Varanda", "Piscina", "Lazer", "Planta", "Vista", "Outros"] as const;

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
  warning: "nenhum" | "qualidade_ruim" | "duplicada" | "ambiente_incerto" | "nao_representa_imovel";
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

async function invokeErrorPayload(error: unknown) {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) return context.json().catch(() => ({}));
  return {};
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
    setPhase("analyzing"); setMessage(""); setUndo(null);
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.functions.invoke("ia-router", { body: {
      action: "organizar_fotos_produto",
      empreendimento_id: productId,
      unidade_id: unitId ?? null,
      media_ids: selectedPhotos.map((photo) => photo.id),
      tipo_imovel: propertyType.slice(0, 60),
    } });
    const payload = error ? await invokeErrorPayload(error) : data;
    if (payload?.partial === true) { setPhase("partial"); setMessage("A análise chegou incompleta. Nenhuma alteração foi aplicada."); return; }
    if (payload?.reason === "ia_indisponivel" || payload?.reason === "sem_chave") { setPhase("unavailable"); setMessage("A organização por IA está temporariamente indisponível. A edição manual continua funcionando."); return; }
    if (error || payload?.ok !== true || !Array.isArray(payload?.suggestions)) {
      setPhase("error");
      setMessage(payload?.reason === "timeout" ? "A análise demorou além do limite. Tente novamente mais tarde." : payload?.reason === "limite_temporario" ? "Limite temporário atingido. Aguarde alguns minutos." : "Não foi possível analisar as fotos. A edição manual não foi afetada.");
      return;
    }
    setSuggestions(payload.suggestions.map((item:Suggestion) => ({...item,accepted:true})));
    setSetVersion(String(payload.set_version ?? ""));
    setPhase("suggestions");
  }

  function updateSuggestion(mediaId:string, patch:Partial<Suggestion>) {
    setSuggestions((current) => current.map((item) => item.media_id === mediaId ? {...item,...patch} : item));
  }

  async function apply() {
    const accepted = suggestions.filter((item) => item.accepted);
    if (!accepted.length) { setMessage("Aceite ao menos uma sugestão antes de aplicar."); return; }
    const orders = new Set(accepted.map((item) => item.sort_order));
    if (orders.size !== accepted.length || accepted.some((item) => item.display_name.trim().length < 3 || item.alt_text.trim().length < 3)) {
      setMessage("Revise nomes, textos alternativos e ordens duplicadas antes de aplicar."); return;
    }
    setPhase("analyzing"); setMessage("");
    const response = await fetch("/api/product", {method:"PATCH",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({
      id:productId,action:"applyPhotoAiSuggestions",unitId:unitId??null,expectedVersion:setVersion,
      suggestions:accepted.map((item)=>({
        media_id:item.media_id,
        category:item.category,
        sort_order:item.sort_order,
        is_cover:item.is_cover,
        display_name:item.display_name,
        alt_text:item.alt_text,
        confidence:item.confidence,
      })),
    })});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) {
      setPhase("error"); setMessage(data?.code === "MEDIA_AI_CONFLICT" ? "A galeria mudou desde a análise. Analise novamente para não sobrescrever outra edição." : data?.error || "Não foi possível aplicar as sugestões."); return;
    }
    setUndo({version:String(data.versao),snapshot:Array.isArray(data.desfazer)?data.desfazer:[]});
    await onApplied();
    setPhase("applied"); setMessage("Sugestões aplicadas após sua confirmação.");
  }

  async function undoApply() {
    if (!undo?.snapshot.length) return;
    setPhase("undoing"); setMessage("");
    const response = await fetch("/api/product", {method:"PATCH",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({
      id:productId,action:"restorePhotoAiSuggestions",unitId:unitId??null,expectedVersion:undo.version,suggestions:undo.snapshot,
    })});
    const data = await response.json().catch(()=>({}));
    if (!response.ok) { setPhase("error"); setMessage(data?.error || "Não foi possível desfazer porque a galeria foi alterada."); return; }
    await onApplied(); setUndo(null); setSuggestions([]); setSelected(new Set()); setPhase("ready"); setMessage("A organização anterior foi restaurada.");
  }

  if (!photos.length) return null;

  return <section className="photo-ai-organizer" aria-label="Organizar fotos com IA">
    <header><div><span className="photo-ai-kicker">IA assistiva</span><strong>Organizar fotos com IA</strong><small>A IA apenas sugere. Você revisa tudo antes de aplicar.</small></div>{phase !== "suggestions" && <button className="photo-ai-action" type="button" disabled={disabled || selectedCount < 1 || phase === "analyzing"} onClick={() => setPhase("confirm")}>{phase === "analyzing" ? "Analisando..." : `Organizar ${selectedCount || ""} foto${selectedCount === 1 ? "" : "s"}`}</button>}</header>
    {(phase === "ready" || phase === "confirm" || phase === "error" || phase === "partial" || phase === "unavailable") && <>
      <div className="photo-ai-selection-toolbar"><button type="button" onClick={() => setSelected(new Set(photos.slice(0,20).map((photo)=>photo.id)))}>Selecionar até 20</button><button type="button" onClick={() => setSelected(new Set())}>Limpar</button><span>{selectedCount}/20 selecionadas</span></div>
      <div className="photo-ai-thumbs">{photos.map((photo) => <label key={photo.id} className={selected.has(photo.id) ? "selected" : ""}><input type="checkbox" checked={selected.has(photo.id)} onChange={() => togglePhoto(photo.id)} disabled={!selected.has(photo.id) && selectedCount >= 20} />{photo.url ? <img src={photo.url} alt={photo.alt_text || photo.categoria || "Foto do imóvel"} /> : <span>Sem prévia</span>}<small>{photo.categoria || "Sem categoria"}</small></label>)}</div>
    </>}
    {phase === "confirm" && <div className="photo-ai-confirm" role="alertdialog" aria-label="Confirmar envio das fotos"><strong>Confirme antes de enviar</strong><p>A OpenAI receberá somente as fotos selecionadas e dados comerciais mínimos para sugerir categoria, ordem, capa e texto alternativo. Nenhum proprietário, contato, endereço privado ou nota interna será enviado.</p><small>Dados da API não são usados para treinamento sem adesão voluntária. Logs de monitoramento podem ser mantidos por até 30 dias, salvo controles especiais aprovados.</small><div><button type="button" onClick={() => setPhase("ready")}>Cancelar</button><button className="photo-ai-action" type="button" onClick={() => void analyze()}>Confirmar e analisar</button></div></div>}
    {phase === "suggestions" && <div className="photo-ai-review"><div className="photo-ai-review-head"><div><strong>Revise o que mudou</strong><small>Altere, rejeite ou escolha outra capa antes de aplicar.</small></div><button type="button" onClick={() => {setSuggestions([]);setPhase("ready");}}>Descartar tudo</button></div>{suggestions.map((suggestion) => { const photo=photos.find((item)=>item.id===suggestion.media_id); return <article key={suggestion.media_id} className={suggestion.accepted ? "" : "rejected"}>{photo?.url && <img src={photo.url} alt={photo.alt_text || "Foto em revisão"} />}<div className="photo-ai-changes"><div><small>Categoria atual</small><span>{photo?.categoria || "Sem categoria"}</span><b>→</b><select value={suggestion.category} onChange={(event)=>updateSuggestion(suggestion.media_id,{category:event.target.value as Suggestion["category"]})}>{categories.map((category)=><option key={category}>{category}</option>)}</select></div><label>Nome de exibição<input maxLength={120} value={suggestion.display_name} onChange={(event)=>updateSuggestion(suggestion.media_id,{display_name:event.target.value})} /></label><label>Texto alternativo<input maxLength={220} value={suggestion.alt_text} onChange={(event)=>updateSuggestion(suggestion.media_id,{alt_text:event.target.value})} /></label><div className="photo-ai-inline"><label>Ordem<input type="number" min="0" max="19" value={suggestion.sort_order} onChange={(event)=>updateSuggestion(suggestion.media_id,{sort_order:Number(event.target.value)})} /></label><label className="photo-ai-cover"><input type="radio" name={`photo-ai-cover-${productId}-${unitId||"product"}`} checked={suggestion.is_cover} onChange={()=>setSuggestions((current)=>current.map((item)=>({...item,is_cover:item.media_id===suggestion.media_id})))} /> Melhor capa</label></div>{suggestion.warning!=="nenhum" && <p className="photo-ai-warning"><strong>{warningLabels[suggestion.warning]}</strong>{suggestion.warning_detail && ` · ${suggestion.warning_detail}`}</p>}<button className="photo-ai-reject" type="button" onClick={()=>updateSuggestion(suggestion.media_id,{accepted:!suggestion.accepted})}>{suggestion.accepted ? "Rejeitar esta sugestão" : "Aceitar novamente"}</button></div></article>})}<div className="photo-ai-review-actions"><button type="button" onClick={() => {setSuggestions([]);setPhase("ready");}}>Cancelar</button><button className="photo-ai-action" type="button" onClick={() => void apply()}>Aplicar sugestões aceitas</button></div></div>}
    {(phase === "analyzing" || phase === "undoing") && <div className="photo-ai-progress"><span aria-hidden="true" />{phase === "undoing" ? "Desfazendo com segurança..." : "Enviando versões otimizadas e analisando..."}</div>}
    {message && <p className={`photo-ai-message ${phase}`}>{message}</p>}
    {phase === "applied" && undo && <button className="photo-ai-undo" type="button" onClick={() => void undoApply()}>Desfazer aplicação</button>}
  </section>;
}
