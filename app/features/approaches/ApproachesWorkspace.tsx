"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";

type MessagePart = { name?: string; options?: { text?: string; valor?: number; unidade?: string; url?: string; caption?: string } };
type Approach = { id: number; nome: string; mensagens: MessagePart[] | unknown; produto_id: number | null; empreendimento_id: string | null; grupo: string | null; ativo: boolean; ordem: number; criado_em: string };
type Product = { id: string; nome: string };
type Data = { approaches: Approach[]; products: Product[] };

const partName = (part: MessagePart) => part.name === "delay" ? "Espera" : part.name === "wait-user-input" ? "Aguardar resposta" : part.name?.includes("media") ? "Mídia" : "Mensagem";

const sampleName = "João";
const fillVars = (text: string) => text.replace(/\{\s*(primeiro_?nome|primeiroNome|nome|first_?name)\s*\}/gi, sampleName);
const isVideoUrl = (url: string) => /\.(mp4|mov|webm|m4v|3gp|avi|mkv)(\?|#|$)/i.test(url) || /video/i.test(url);
const isImageUrl = (url: string) => /\.(jpe?g|png|gif|webp|bmp|heic)(\?|#|$)/i.test(url);

function ApproachPreview({ nome, parts, onClose }: { nome: string; parts: MessagePart[]; onClose: () => void }) {
  const hora = "09:41";
  const enviaveis = parts.filter((p) => p.name !== "wait-user-input"); // wait não gera bolha, mas delay vira divisória
  return <div className="approach-preview-scrim" role="button" tabIndex={-1} onClick={onClose}>
    <div className="approach-preview-phone" onClick={(e) => e.stopPropagation()}>
      <div className="app-wa-topbar">
        <button type="button" className="app-wa-back" onClick={onClose} aria-label="Fechar">‹</button>
        <span className="app-wa-avatar">{sampleName.charAt(0)}</span>
        <div className="app-wa-peer"><strong>{sampleName} (cliente)</strong><small>online</small></div>
        <span className="app-wa-preview-tag">PRÉVIA · {nome || "Abordagem"}</span>
      </div>
      <div className="app-wa-body">
        <div className="app-wa-daysep"><span>Assim o cliente recebe</span></div>
        {enviaveis.length === 0 && <div className="app-wa-empty">Nenhuma mensagem para enviar ainda. Adicione mensagens ou mídia na abordagem.</div>}
        {enviaveis.map((part, i) => {
          if (part.name === "delay") {
            const v = part.options?.valor ?? 5; const u = part.options?.unidade ?? "minutos";
            return <div className="app-wa-delay" key={i}>⏱ espera {v} {u}</div>;
          }
          if (part.name?.includes("media")) {
            const url = (part.options?.url ?? "").trim();
            const caption = (part.options?.caption ?? "").trim();
            return <div className="app-wa-bubble out media" key={i}>
              <div className="app-wa-media">
                {!url ? <div className="app-wa-media-empty">🎬 mídia sem link<small>cole o link do vídeo/imagem na abordagem</small></div>
                  : isVideoUrl(url) ? <video src={url} controls preload="metadata" playsInline />
                  : isImageUrl(url) ? <img src={url} alt="Mídia da abordagem" />
                  : <a className="app-wa-media-file" href={url} target="_blank" rel="noreferrer">📎 abrir material</a>}
              </div>
              {caption && <p>{fillVars(caption)}</p>}
              <span className="app-wa-time">{hora} ✓✓</span>
            </div>;
          }
          const text = (part.options?.text ?? "").trim();
          return <div className="app-wa-bubble out" key={i}><p>{fillVars(text) || <em>(mensagem vazia)</em>}</p><span className="app-wa-time">{hora} ✓✓</span></div>;
        })}
      </div>
      <div className="app-wa-inputbar"><span>Mensagem</span><b>➤</b></div>
    </div>
  </div>;
}

export function ApproachesWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ nome: string; parts: MessagePart[] } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/approaches", { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json() as Data & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as abordagens.");
    setData(payload);
  }, [accessToken]);

  useEffect(() => { void load().catch((error: Error) => setNotice(error.message)); }, [load]);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/approaches", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.");
      await load(); setNotice("Alteração salva.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }

  /* Doc §11 — filtros por grupo e status */
  const [statusFilter, setStatusFilter] = useState<"todas" | "ativas" | "arquivadas">("todas");
  const [groupFilter, setGroupFilter] = useState("");
  const approaches = useMemo(() => (data?.approaches ?? []).filter((item) => (item.empreendimento_id ?? null) === selectedProduct && item.nome.toLowerCase().includes(query.toLowerCase()) && (statusFilter === "todas" || (statusFilter === "ativas" ? item.ativo : !item.ativo)) && (!groupFilter || (item.grupo || "Sem grupo") === groupFilter)), [data, selectedProduct, query, statusFilter, groupFilter]);
  const allGroups = useMemo(() => [...new Set((data?.approaches ?? []).filter((item) => (item.empreendimento_id ?? null) === selectedProduct).map((item) => item.grupo || "Sem grupo"))], [data, selectedProduct]);
  function duplicateApproach(approach: Approach) { void mutate({ action: "createApproach", name: `${approach.nome} (cópia)`, empreendimentoId: approach.empreendimento_id, grupo: approach.grupo ?? "", messages: Array.isArray(approach.mensagens) ? approach.mensagens : [] }); }
  function renameGroup(groupName: string) { const to = window.prompt(`Novo nome para o grupo "${groupName}":`, groupName === "Sem grupo" ? "" : groupName); if (to === null) return; void mutate({ action: "renameGroup", from: groupName === "Sem grupo" ? null : groupName, to: to.trim() || null, empreendimentoId: selectedProduct }); }
  function dissolveGroup(groupName: string) { if (!window.confirm(`Dissolver o grupo "${groupName}"? As abordagens vão para "Sem grupo" (nenhuma é excluída).`)) return; void mutate({ action: "renameGroup", from: groupName, to: null, empreendimentoId: selectedProduct }); }
  const groups = useMemo(() => { const map = new Map<string, Approach[]>(); approaches.forEach((item) => { const g = item.grupo || "Sem grupo"; if (!map.has(g)) map.set(g, []); map.get(g)!.push(item); }); return [...map.entries()]; }, [approaches]);
  const editing = data?.approaches.find((item) => item.id === selectedApproach) ?? null;
  const parts = editing && Array.isArray(editing.mensagens) ? editing.mensagens as MessagePart[] : [];

  function createApproach(grupo?: string) { const name = window.prompt("Nome da abordagem:"); if (!name?.trim()) return; const g = grupo ?? window.prompt("Grupo (ex.: Padrão, Unidade promocional):", "Padrão") ?? ""; void mutate({ action: "createApproach", name: name.trim(), empreendimentoId: selectedProduct, grupo: g.trim() }); }
  function createGroup() { const g = window.prompt("Nome do novo grupo:"); if (!g?.trim()) return; const name = window.prompt(`Nome da primeira abordagem do grupo "${g.trim()}":`, "Nova abordagem"); if (!name?.trim()) return; void mutate({ action: "createApproach", name: name.trim(), empreendimentoId: selectedProduct, grupo: g.trim() }); }
  const textPreviews = (approach: Approach) => Array.isArray(approach.mensagens) ? (approach.mensagens as MessagePart[]).filter((part) => part.options?.text?.trim()).map((part) => part.options!.text!.trim()) : [];
  function updatePart(index: number, patch: Partial<MessagePart["options"]>) { if (!editing) return; const next = parts.map((part, partIndex) => partIndex === index ? { ...part, options: { ...part.options, ...patch } } : part); setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, mensagens: next } : item) } : current); }
  function addPart(name: string) { if (!editing) return; const options = name === "delay" ? { valor: 5, unidade: "minutos" } : name === "send-media" ? { url: "", caption: "" } : { text: "" }; const next = [...parts, { name, options }]; setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, mensagens: next } : item) } : current); }
  function removePart(index: number) { if (!editing) return; const next = parts.filter((_, partIndex) => partIndex !== index); setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, mensagens: next } : item) } : current); }

  return <div className="approaches-workspace">
    <header><div><span>BIBLIOTECA COMERCIAL</span><h1>Abordagens</h1><p>Modelos de mensagens usados no chat, nas automações e nos disparos.</p></div><label>⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar abordagem" /></label></header>
    {notice && <button className="workspace-notice" type="button" onClick={() => setNotice(null)}>{notice} ×</button>}
    <main>
      <aside className="approach-products"><div><strong>Produtos</strong><small>{data?.products.length ?? 0} empreendimentos</small></div><button className={selectedProduct === null ? "active" : ""} type="button" onClick={() => { setSelectedProduct(null); setSelectedApproach(null); }}><span className="folder">🗀</span><b>Modelos gerais</b><em>{data?.approaches.filter((item) => !item.empreendimento_id).length ?? 0}</em></button>{data?.products.map((product) => <button className={selectedProduct === product.id ? "active" : ""} type="button" onClick={() => { setSelectedProduct(product.id); setSelectedApproach(null); }} key={product.id}><span>▥</span><b>{product.nome}</b><em>{data.approaches.filter((item) => item.empreendimento_id === product.id).length}</em></button>)}<button className="approach-add-group" type="button" onClick={createGroup}>＋ Novo grupo</button></aside>
      <section className="approach-list"><header><div><span>{selectedProduct === null ? "SEM PRODUTO" : "PRODUTO"}</span><h2>{selectedProduct === null ? "Modelos gerais" : data?.products.find((item) => item.id === selectedProduct)?.nome}</h2></div><button type="button" onClick={() => createApproach()}>＋ Nova abordagem</button></header>
      <div className="approach-filters">{(["todas", "ativas", "arquivadas"] as const).map((option) => <button className={statusFilter === option ? "active" : ""} type="button" onClick={() => setStatusFilter(option)} key={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</button>)}<select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Grupo"><option value="">Todos os grupos</option>{allGroups.map((groupName) => <option key={groupName}>{groupName}</option>)}</select></div>
      {groups.map(([groupName, items]) => <div className="approach-group" key={groupName}><div className="approach-group-head"><strong>▤ {groupName}</strong><span>{items.length} abordagem{items.length === 1 ? "" : "s"}</span><button type="button" onClick={() => createApproach(groupName)}>＋ neste grupo</button><button type="button" title="Renomear grupo" onClick={() => renameGroup(groupName)}>✎</button>{groupName !== "Sem grupo" && <button type="button" title="Dissolver grupo (abordagens vão para Sem grupo)" onClick={() => dissolveGroup(groupName)}>⌦</button>}</div><div className="approach-cards">{items.map((approach) => { const count = Array.isArray(approach.mensagens) ? approach.mensagens.length : 0; const texts = textPreviews(approach); return <article className={`approach-card ${!approach.ativo ? "inactive" : ""}`} key={approach.id}><header><span className="approach-card-ico">✉</span><div><strong>{approach.nome}</strong><div className="approach-card-tags"><em className={approach.ativo ? "on" : "off"}>{approach.ativo ? "ATIVA" : "ARQUIVADA"}</em><small>{count} parte{count === 1 ? "" : "s"}</small></div></div></header><div className="approach-card-msgs">{texts.slice(0, 2).map((text, i) => <div className="approach-msg-box" key={i}>{i === 0 && <span className="approach-var-tag">{texts.length} variaç{texts.length === 1 ? "ão" : "ões"}</span>}<p>{text}</p></div>)}{texts.length === 0 && <div className="approach-msg-box empty"><p>Sem mensagens ainda — clique em editar para montar a sequência.</p></div>}</div><footer><button className="approach-edit-btn" type="button" onClick={() => setSelectedApproach(approach.id)}>✎ Editar mensagens</button><button className="approach-ico-btn" type="button" title="Ver preview (como o cliente recebe)" aria-label="Preview" onClick={() => setPreview({ nome: approach.nome, parts: Array.isArray(approach.mensagens) ? approach.mensagens as MessagePart[] : [] })}>👁</button><button className="approach-ico-btn" type="button" title="Duplicar" aria-label="Duplicar" disabled={busy} onClick={() => duplicateApproach(approach)}>⧉</button><button className="approach-ico-btn" type="button" aria-label={approach.ativo ? "Arquivar" : "Ativar"} title={approach.ativo ? "Arquivar" : "Ativar"} onClick={() => void mutate({ action: "toggleApproach", id: approach.id, active: !approach.ativo })}>⏻</button><button className="approach-ico-btn danger" type="button" aria-label="Excluir" title="Excluir" onClick={() => window.confirm("Excluir esta abordagem?") && void mutate({ action: "deleteApproach", id: approach.id })}>🗑</button></footer></article>; })}<button className="approach-new-card" type="button" onClick={() => createApproach(groupName)}><span>＋</span><strong>Nova abordagem</strong><small>Crie um modelo com variações e IA</small></button></div></div>)}{!approaches.length && <div className="approach-empty"><span>✉</span><strong>Nenhuma abordagem aqui</strong><p>Crie a primeira abordagem para este produto — escolha um grupo (ex.: Padrão, Unidade promocional).</p></div>}</section>
    </main>
    {editing && <div className="approach-drawer-scrim" onClick={() => setSelectedApproach(null)}><aside onClick={(event) => event.stopPropagation()}><header><div><span>EDITOR DE ABORDAGEM</span><input value={editing.nome} onChange={(event) => setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, nome: event.target.value } : item) } : current)} /><input className="approach-grupo-input" value={editing.grupo ?? ""} placeholder="Grupo (ex.: Padrão)" onChange={(event) => setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, grupo: event.target.value } : item) } : current)} /></div><button type="button" onClick={() => setSelectedApproach(null)}>×</button></header><nav><button type="button" onClick={() => addPart("send-text-message")}>＋ Mensagem</button><button type="button" onClick={() => addPart("delay")}>＋ Espera</button><button type="button" onClick={() => addPart("wait-user-input")}>＋ Aguardar resposta</button><button type="button" onClick={() => addPart("send-media")}>＋ Mídia</button></nav><div className="approach-parts">{parts.map((part, index) => <article key={`${index}-${part.name}`}><header><span>{index + 1}</span><strong>{partName(part)}</strong><button type="button" onClick={() => removePart(index)}>Remover</button></header>{part.name === "delay" ? <div className="approach-delay"><input type="number" min="1" value={part.options?.valor ?? 5} onChange={(event) => updatePart(index, { valor: Number(event.target.value) })} /><select value={part.options?.unidade ?? "minutos"} onChange={(event) => updatePart(index, { unidade: event.target.value })}><option>segundos</option><option>minutos</option><option>horas</option><option>dias</option></select></div> : part.name?.includes("media") ? <><input value={part.options?.url ?? ""} onChange={(event) => updatePart(index, { url: event.target.value })} placeholder="Link do arquivo ou material" /><textarea value={part.options?.caption ?? ""} onChange={(event) => updatePart(index, { caption: event.target.value })} placeholder="Legenda da mídia" /></> : <textarea value={part.options?.text ?? ""} onChange={(event) => updatePart(index, { text: event.target.value })} placeholder="Escreva a mensagem. Use {primeiro_nome} para personalizar." />}</article>)}{!parts.length && <div className="approach-empty"><strong>Adicione a primeira mensagem</strong><p>Monte a sequência usando os botões acima.</p></div>}</div><footer><button type="button" onClick={() => setSelectedApproach(null)}>Cancelar</button><button type="button" className="approach-preview-btn" onClick={() => setPreview({ nome: editing.nome, parts })}>👁 Preview</button><button className="primary" disabled={busy || !editing.nome.trim()} type="button" onClick={() => void mutate({ action: "updateApproach", id: editing.id, name: editing.nome, messages: parts, grupo: editing.grupo ?? "" })}>Salvar abordagem</button></footer></aside></div>}
    {preview && <ApproachPreview nome={preview.nome} parts={preview.parts} onClose={() => setPreview(null)} />}
  </div>;
}
