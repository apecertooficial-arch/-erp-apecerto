"use client";
/* Momentos do lead — seção de Configurações (só gestão).
   Edita o catálogo que alimenta o botão "Atualizar momento" do CRM e a ação
   "Definir momento do lead" das Automações: nome, cor, grupo, prazo de
   validade (em quantos dias fica desatualizado), ordem e ativo.
   Grava direto em lead_momento_catalogo — o RLS restringe escrita à gestão. */

/* eslint-disable react-hooks/set-state-in-effect -- carga inicial assíncrona, mesmo padrão do AquarioConfig */
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type MomentoRow = { slug: string; rotulo: string; grupo: string; ordem: number; cor: string | null; prazo_dias: number; ativo: boolean };

const slugify = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export function MomentosConfig() {
  const [rows, setRows] = useState<MomentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [novo, setNovo] = useState({ rotulo: "", grupo: "", prazo: "3", cor: "#8d2bd1" });

  const load = async () => {
    const { data, error } = await getBrowserSupabaseClient().from("lead_momento_catalogo").select("slug,rotulo,grupo,ordem,cor,prazo_dias,ativo").order("ordem");
    if (error) setMsg(error.message); else setRows((data ?? []) as MomentoRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const grupos = useMemo(() => [...new Set(rows.map((r) => r.grupo))], [rows]);

  const salvar = async (slug: string, patch: Partial<MomentoRow>) => {
    setBusy(true); setMsg(null);
    const { error } = await getBrowserSupabaseClient().from("lead_momento_catalogo").update(patch as never).eq("slug", slug);
    if (error) setMsg(error.message); else { setMsg("Salvo."); await load(); }
    setBusy(false);
  };

  const mover = async (slug: string, direcao: -1 | 1) => {
    const idx = rows.findIndex((r) => r.slug === slug);
    const alvo = rows[idx + direcao];
    if (!alvo) return;
    setBusy(true);
    const sb = getBrowserSupabaseClient();
    await sb.from("lead_momento_catalogo").update({ ordem: alvo.ordem } as never).eq("slug", slug);
    await sb.from("lead_momento_catalogo").update({ ordem: rows[idx].ordem } as never).eq("slug", alvo.slug);
    await load(); setBusy(false);
  };

  const criar = async () => {
    if (!novo.rotulo.trim() || !novo.grupo.trim()) { setMsg("Informe o nome e o grupo."); return; }
    setBusy(true); setMsg(null);
    let slug = slugify(novo.rotulo);
    if (rows.some((r) => r.slug === slug)) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;
    const ordem = Math.max(0, ...rows.map((r) => r.ordem)) + 1;
    const prazo = Math.max(1, Math.trunc(Number(novo.prazo) || 3));
    const { error } = await getBrowserSupabaseClient().from("lead_momento_catalogo").insert({ slug, rotulo: novo.rotulo.trim(), grupo: novo.grupo.trim(), ordem, cor: novo.cor, prazo_dias: prazo, ativo: true } as never);
    if (error) setMsg(error.message); else { setMsg("Momento criado."); setNovo({ rotulo: "", grupo: novo.grupo, prazo: "3", cor: novo.cor }); await load(); }
    setBusy(false);
  };

  if (loading) return <section className="settings-card"><h2>Momentos do lead</h2><p className="settings-hint">Carregando…</p></section>;

  return <section className="settings-card">
    <h2>Momentos do lead</h2>
    <p className="settings-hint">O que o corretor escolhe ao clicar em “Atualizar” no card, e o que a ação “Definir momento do lead” das Automações usa. O prazo define quando o selo muda de cor: verde dentro do prazo, amarelo na véspera de vencer, vermelho a partir do prazo.</p>
    {msg && <button type="button" className="finance-message" onClick={() => setMsg(null)}>{msg} ×</button>}

    {grupos.map((g) => <div className="momcfg-grupo" key={g}>
      <h3>{g}</h3>
      {rows.filter((r) => r.grupo === g).map((r) => {
        const idx = rows.findIndex((x) => x.slug === r.slug);
        return <div className={`momcfg-row ${r.ativo ? "" : "inativo"}`} key={r.slug}>
          <input type="color" title="Cor do momento" value={r.cor || "#8d2bd1"} disabled={busy} onChange={(e) => setRows((c) => c.map((x) => x.slug === r.slug ? { ...x, cor: e.target.value } : x))} onBlur={(e) => void salvar(r.slug, { cor: e.target.value })} />
          <input className="momcfg-nome" value={r.rotulo} disabled={busy} onChange={(e) => setRows((c) => c.map((x) => x.slug === r.slug ? { ...x, rotulo: e.target.value } : x))} onBlur={(e) => { const v = e.target.value.trim(); if (v) void salvar(r.slug, { rotulo: v }); }} />
          <label className="momcfg-prazo" title="Em quantos dias este momento fica desatualizado">
            <input type="number" min={1} max={365} value={r.prazo_dias} disabled={busy} onChange={(e) => setRows((c) => c.map((x) => x.slug === r.slug ? { ...x, prazo_dias: Number(e.target.value) } : x))} onBlur={(e) => { const v = Math.max(1, Math.trunc(Number(e.target.value) || 3)); void salvar(r.slug, { prazo_dias: v }); }} />
            <span>dias</span>
          </label>
          <div className="momcfg-acoes">
            <button type="button" title="Subir" disabled={busy || idx === 0} onClick={() => void mover(r.slug, -1)}>↑</button>
            <button type="button" title="Descer" disabled={busy || idx === rows.length - 1} onClick={() => void mover(r.slug, 1)}>↓</button>
            <button type="button" className={r.ativo ? "on" : ""} title={r.ativo ? "Desativar (some das listas, histórico fica)" : "Reativar"} disabled={busy} onClick={() => void salvar(r.slug, { ativo: !r.ativo })}>{r.ativo ? "Ativo" : "Inativo"}</button>
          </div>
        </div>;
      })}
    </div>)}

    <div className="momcfg-novo">
      <h3>Novo momento</h3>
      <div className="momcfg-novo-grid">
        <input placeholder="Nome (ex.: Aguardando documentação)" value={novo.rotulo} disabled={busy} onChange={(e) => setNovo({ ...novo, rotulo: e.target.value })} />
        <input placeholder="Grupo" list="momcfg-grupos" value={novo.grupo} disabled={busy} onChange={(e) => setNovo({ ...novo, grupo: e.target.value })} />
        <datalist id="momcfg-grupos">{grupos.map((g) => <option value={g} key={g} />)}</datalist>
        <label className="momcfg-prazo"><input type="number" min={1} max={365} value={novo.prazo} disabled={busy} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} /><span>dias</span></label>
        <input type="color" title="Cor" value={novo.cor} disabled={busy} onChange={(e) => setNovo({ ...novo, cor: e.target.value })} />
        <button type="button" className="crm-primary" disabled={busy || !novo.rotulo.trim() || !novo.grupo.trim()} onClick={() => void criar()}>＋ Adicionar</button>
      </div>
    </div>
  </section>;
}
