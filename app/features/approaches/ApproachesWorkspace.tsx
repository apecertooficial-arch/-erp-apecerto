"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";

type MessagePart = { name?: string; options?: { text?: string; valor?: number; unidade?: string; url?: string; caption?: string } };
type Approach = { id: number; nome: string; mensagens: MessagePart[] | unknown; produto_id: number | null; ativo: boolean; ordem: number; criado_em: string };
type Product = { id: number; nome: string; ativo: boolean; criado_em: string };
type Data = { approaches: Approach[]; products: Product[] };

const partName = (part: MessagePart) => part.name === "delay" ? "Espera" : part.name === "wait-user-input" ? "Aguardar resposta" : part.name?.includes("media") ? "Mídia" : "Mensagem";

export function ApproachesWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const approaches = useMemo(() => (data?.approaches ?? []).filter((item) => item.produto_id === selectedProduct && item.nome.toLowerCase().includes(query.toLowerCase())), [data, selectedProduct, query]);
  const editing = data?.approaches.find((item) => item.id === selectedApproach) ?? null;
  const parts = editing && Array.isArray(editing.mensagens) ? editing.mensagens as MessagePart[] : [];

  function createProduct() { const name = window.prompt("Nome do produto:"); if (name?.trim()) void mutate({ action: "createProduct", name }); }
  function createApproach() { const name = window.prompt("Nome da abordagem:"); if (name?.trim()) void mutate({ action: "createApproach", name, productId: selectedProduct }); }
  function updatePart(index: number, patch: Partial<MessagePart["options"]>) { if (!editing) return; const next = parts.map((part, partIndex) => partIndex === index ? { ...part, options: { ...part.options, ...patch } } : part); setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, mensagens: next } : item) } : current); }
  function addPart(name: string) { if (!editing) return; const options = name === "delay" ? { valor: 5, unidade: "minutos" } : name === "send-media" ? { url: "", caption: "" } : { text: "" }; const next = [...parts, { name, options }]; setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, mensagens: next } : item) } : current); }
  function removePart(index: number) { if (!editing) return; const next = parts.filter((_, partIndex) => partIndex !== index); setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, mensagens: next } : item) } : current); }

  return <div className="approaches-workspace">
    <header><div><span>BIBLIOTECA COMERCIAL</span><h1>Abordagens</h1><p>Modelos de mensagens usados no chat, nas automações e nos disparos.</p></div><label>⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar abordagem" /></label></header>
    {notice && <button className="workspace-notice" type="button" onClick={() => setNotice(null)}>{notice} ×</button>}
    <main>
      <aside className="approach-products"><div><strong>Produtos</strong><small>{data?.products.length ?? 0} cadastrados</small></div><button className={selectedProduct === null ? "active" : ""} type="button" onClick={() => { setSelectedProduct(null); setSelectedApproach(null); }}><span>◇</span><b>Modelos gerais</b><em>{data?.approaches.filter((item) => item.produto_id === null).length ?? 0}</em></button>{data?.products.map((product) => <button className={selectedProduct === product.id ? "active" : ""} type="button" onClick={() => { setSelectedProduct(product.id); setSelectedApproach(null); }} key={product.id}><span>▥</span><b>{product.nome}</b><em>{data.approaches.filter((item) => item.produto_id === product.id).length}</em></button>)}<button className="approach-add-product" type="button" onClick={createProduct}>＋ novo produto</button></aside>
      <section className="approach-list"><header><div><span>{selectedProduct === null ? "SEM PRODUTO" : "PRODUTO"}</span><h2>{selectedProduct === null ? "Modelos gerais" : data?.products.find((item) => item.id === selectedProduct)?.nome}</h2></div><button type="button" onClick={createApproach}>＋ Nova abordagem</button></header>{approaches.map((approach) => { const count = Array.isArray(approach.mensagens) ? approach.mensagens.length : 0; return <article className={!approach.ativo ? "inactive" : ""} key={approach.id}><span>✉</span><div><strong>{approach.nome}</strong><small>{count} parte{count === 1 ? "" : "s"} · {approach.ativo ? "Ativa" : "Arquivada"}</small></div><button type="button" onClick={() => setSelectedApproach(approach.id)}>Editar mensagens</button><button type="button" aria-label={approach.ativo ? "Arquivar" : "Ativar"} onClick={() => void mutate({ action: "toggleApproach", id: approach.id, active: !approach.ativo })}>{approach.ativo ? "○" : "●"}</button><button className="danger" type="button" aria-label="Excluir" onClick={() => window.confirm("Excluir esta abordagem?") && void mutate({ action: "deleteApproach", id: approach.id })}>⌫</button></article>; })}{!approaches.length && <div className="approach-empty"><span>✉</span><strong>Nenhuma abordagem aqui</strong><p>Crie a primeira abordagem para este produto.</p></div>}</section>
    </main>
    {editing && <div className="approach-drawer-scrim" onClick={() => setSelectedApproach(null)}><aside onClick={(event) => event.stopPropagation()}><header><div><span>EDITOR DE ABORDAGEM</span><input value={editing.nome} onChange={(event) => setData((current) => current ? { ...current, approaches: current.approaches.map((item) => item.id === editing.id ? { ...item, nome: event.target.value } : item) } : current)} /></div><button type="button" onClick={() => setSelectedApproach(null)}>×</button></header><nav><button type="button" onClick={() => addPart("send-text-message")}>＋ Mensagem</button><button type="button" onClick={() => addPart("delay")}>＋ Espera</button><button type="button" onClick={() => addPart("wait-user-input")}>＋ Aguardar resposta</button><button type="button" onClick={() => addPart("send-media")}>＋ Mídia</button></nav><div className="approach-parts">{parts.map((part, index) => <article key={`${index}-${part.name}`}><header><span>{index + 1}</span><strong>{partName(part)}</strong><button type="button" onClick={() => removePart(index)}>Remover</button></header>{part.name === "delay" ? <div className="approach-delay"><input type="number" min="1" value={part.options?.valor ?? 5} onChange={(event) => updatePart(index, { valor: Number(event.target.value) })} /><select value={part.options?.unidade ?? "minutos"} onChange={(event) => updatePart(index, { unidade: event.target.value })}><option>segundos</option><option>minutos</option><option>horas</option><option>dias</option></select></div> : part.name?.includes("media") ? <><input value={part.options?.url ?? ""} onChange={(event) => updatePart(index, { url: event.target.value })} placeholder="Link do arquivo ou material" /><textarea value={part.options?.caption ?? ""} onChange={(event) => updatePart(index, { caption: event.target.value })} placeholder="Legenda da mídia" /></> : <textarea value={part.options?.text ?? ""} onChange={(event) => updatePart(index, { text: event.target.value })} placeholder="Escreva a mensagem. Use {primeiro_nome} para personalizar." />}</article>)}{!parts.length && <div className="approach-empty"><strong>Adicione a primeira mensagem</strong><p>Monte a sequência usando os botões acima.</p></div>}</div><footer><button type="button" onClick={() => setSelectedApproach(null)}>Cancelar</button><button className="primary" disabled={busy || !editing.nome.trim()} type="button" onClick={() => void mutate({ action: "updateApproach", id: editing.id, name: editing.nome, messages: parts })}>Salvar abordagem</button></footer></aside></div>}
  </div>;
}
