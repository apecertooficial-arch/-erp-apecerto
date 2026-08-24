"use client";

import { useMemo, useState } from "react";
import type { TagCatalogoFunil2 } from "./modelo";

const CORES = ["#FF7000", "#EA580C", "#FDBA74", "#10B981", "#3B82F6", "#7620B6", "#DC2626", "#000000"];

export function AssociarTagLead({
  leadId,
  catalogo,
  tagsAssociadas = [],
  accessToken,
  onSalvo,
  mobile = false,
  abertoInicial = false,
  onFechar,
}: {
  leadId: string;
  catalogo: TagCatalogoFunil2[];
  tagsAssociadas?: string[];
  accessToken: string;
  onSalvo: () => void;
  mobile?: boolean;
  abertoInicial?: boolean;
  onFechar?: () => void;
}) {
  const disponiveis = useMemo(() => {
    const nomes = new Set(tagsAssociadas.map((nome) => nome.trim().toLocaleLowerCase("pt-BR")));
    return catalogo.filter((tag) => !nomes.has(tag.nome.trim().toLocaleLowerCase("pt-BR")));
  }, [catalogo, tagsAssociadas]);
  const [aberto, setAberto] = useState(abertoInicial);
  const [tagId, setTagId] = useState("");
  const selecionada = useMemo(() => disponiveis.find((tag) => tag.id === tagId) ?? null, [disponiveis, tagId]);
  const [corManual, setCorManual] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const cor = corManual ?? selecionada?.cor ?? "#FF7000";

  async function associar() {
    if (!selecionada) { setErro("Escolha uma tag para associar."); return; }
    setSalvando(true); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "associarTag", leadId, tagId: selecionada.id, cor }),
      });
      const json = await resposta.json().catch(() => ({})) as { error?: string };
      if (!resposta.ok) throw new Error(json.error || "Não foi possível associar a tag.");
      setAberto(false); setTagId(""); setCorManual(null); onSalvo(); onFechar?.();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível associar a tag.");
    } finally { setSalvando(false); }
  }

  if (!aberto) return <button type="button" className={`f2-tag-associar${mobile ? " mobile" : ""}`} onClick={() => setAberto(true)}>＋ Associar tag</button>;

  return <section className={`f2-tag-editor${mobile ? " mobile" : ""}`} aria-label="Associar tag ao lead">
    <div className="f2-tag-editor-cab"><strong>Associar tag</strong><button type="button" onClick={() => { setAberto(false); setErro(""); onFechar?.(); }} aria-label="Fechar associação">×</button></div>
    {disponiveis.length ? <>
      <label>Tag
        <select value={selecionada?.id ?? ""} onChange={(evento) => { setTagId(evento.target.value); setCorManual(null); }}>
          <option value="">— escolha uma tag —</option>
          {disponiveis.map((tag) => <option key={tag.id} value={tag.id}>{tag.nome}</option>)}
        </select>
      </label>
      <label>Cor da tag
        <span className="f2-tag-cor-campo"><input type="color" value={cor} onChange={(evento) => setCorManual(evento.target.value.toUpperCase())} /><b>{cor}</b></span>
      </label>
      <div className="f2-tag-paleta" aria-label="Cores rápidas">{CORES.map((item) => <button key={item} type="button" aria-label={`Usar cor ${item}`} className={item === cor ? "ativa" : ""} style={{ backgroundColor: item }} onClick={() => setCorManual(item)} />)}</div>
      <div className="f2-tag-preview"><i style={{ backgroundColor: cor }} /><span>{selecionada?.nome}</span></div>
      {erro ? <p>{erro}</p> : null}
      <button type="button" className="f2-tag-confirmar" disabled={salvando || !selecionada} onClick={() => void associar()}>{salvando ? "Associando…" : "Associar ao lead"}</button>
    </> : <p>Todas as tags disponíveis já estão associadas a este lead.</p>}
  </section>;
}
