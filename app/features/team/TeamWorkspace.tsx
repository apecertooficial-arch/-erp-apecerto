"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity */

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type User = { id: string; nome: string; role: string; ativo: boolean };
type Broker = { id: number; nome: string; email: string | null; telefone: string | null; usuario_id: string | null; ativo: boolean; online: boolean; no_escritorio: boolean; ultima_presenca: string | null; doc_rg_path: string | null; doc_rg_nome: string | null; doc_rg_em: string | null; doc_contrato_path: string | null; doc_contrato_nome: string | null; doc_contrato_em: string | null };
type Instance = { id: number; nome: string; telefone: string | null; ativa: boolean; conectada: boolean; status_dapi: string | null; corretor_id: number | null };
type Link = { corretor_id: number; instancia_id: number };
type TeamData = { users: User[]; brokers: Broker[]; instances: Instance[]; links: Link[] };

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const roleLabel = (role?: string) => ({ admin: "Admin", gestor: "Gestor", corretor: "Corretor", financeiro: "Financeiro", atendimento: "Atendimento" }[role ?? ""] ?? role ?? "Corretor");

export function TeamWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<TeamData>({ users: [], brokers: [], instances: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState("Todos os perfis");
  const [status, setStatus] = useState("Todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [online, setOnline] = useState(false);
  const [active, setActive] = useState(true);
  const [selectedInstances, setSelectedInstances] = useState<number[]>([]);
  const [instanceQuery, setInstanceQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const rgInput = useRef<HTMLInputElement>(null);
  const contractInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError("");
    const response = await fetch("/api/team", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json() as TeamData & { error?: string };
    if (!response.ok) setError(body.error ?? "Não foi possível carregar a equipe.");
    else setData(body);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [accessToken]);
  const usersById = useMemo(() => new Map(data.users.map((user) => [user.id, user])), [data.users]);
  const selected = data.brokers.find((broker) => broker.id === selectedId) ?? null;
  const linked = (brokerId: number) => data.links.filter((link) => link.corretor_id === brokerId).map((link) => data.instances.find((instance) => instance.id === link.instancia_id)).filter((item): item is Instance => Boolean(item));
  const filtered = data.brokers.filter((broker) => {
    const user = broker.usuario_id ? usersById.get(broker.usuario_id) : undefined;
    return (profile === "Todos os perfis" || roleLabel(user?.role) === profile) && (status === "Todos" || (status === "Ativos" ? broker.ativo : status === "Inativos" ? !broker.ativo : broker.online));
  });

  function openBroker(broker: Broker) {
    setSelectedId(broker.id); setOnline(broker.online); setActive(broker.ativo); setSelectedInstances(linked(broker.id).map((instance) => instance.id)); setInstanceQuery("");
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setToast("");
    const response = await fetch("/api/team", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveBroker", brokerId: selected.id, online, active, instanceIds: selectedInstances }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setToast(body.error ?? "Não foi possível salvar."); else { setToast("Alterações salvas."); await load(); }
    setSaving(false);
  }

  async function uploadDocument(type: "rg" | "contrato", file?: File) {
    if (!selected || !file) return;
    setSaving(true); setToast("Enviando documento...");
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const path = `corretor/${selected.id}/${type}_${Date.now()}.${extension}`;
    const supabase = getBrowserSupabaseClient();
    const { error: uploadError } = await supabase.storage.from("corretor-docs").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
    if (uploadError) { setToast(uploadError.message); setSaving(false); return; }
    const response = await fetch("/api/team", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveDocument", brokerId: selected.id, type, path, name: file.name }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setToast(body.error ?? "Arquivo enviado, mas não foi vinculado."); else { setToast("Documento salvo."); await load(); }
    setSaving(false);
  }

  async function viewDocument(path: string | null) {
    if (!path) return;
    const { data: signed, error: signedError } = await getBrowserSupabaseClient().storage.from("corretor-docs").createSignedUrl(path, 3600);
    if (signedError || !signed?.signedUrl) { setToast(signedError?.message ?? "Não foi possível abrir o arquivo."); return; }
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  }

  return <div className="team-workspace">
    <header className="workspace-top"><div><h1>Usuários</h1><p>{data.brokers.length} usuários · gestão de acessos da equipe</p></div><label className="workspace-search">⌕ <input placeholder="Buscar usuário..." /></label></header>
    <main className="team-main">
      <div className="team-filters"><span>▽</span>{["Todos os perfis", "Admin", "Gestor", "Corretor", "Financeiro", "Atendimento"].map((item) => <button className={profile === item ? "active" : ""} onClick={() => setProfile(item)} type="button" key={item}>{item}</button>)}<i />{["Todos", "Ativos", "Online", "Inativos"].map((item) => <button className={status === item ? "active" : ""} onClick={() => setStatus(item)} type="button" key={item}>{item}</button>)}</div>
      {loading ? <div className="workspace-loading">Carregando equipe...</div> : error ? <div className="workspace-error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div> : <section className="team-table">
        <div className="team-head"><span>Usuário</span><span>Perfil</span><span>Instâncias</span><span>Status</span><span>Online</span><span>Ações</span></div>
        {filtered.map((broker) => { const user = broker.usuario_id ? usersById.get(broker.usuario_id) : undefined; const instances = linked(broker.id); return <button className="team-row" onClick={() => openBroker(broker)} type="button" key={broker.id}>
          <span className="team-person"><b>{initials(broker.nome)}</b><em><strong>{broker.nome}</strong><small>{broker.email ?? "Sem e-mail"}</small></em></span><span><mark>{roleLabel(user?.role)}</mark></span><span className="team-instances">{instances.length ? instances.slice(0, 2).map((instance) => <i key={instance.id}>{instance.nome}</i>) : "—"}{instances.length > 2 && <i>+{instances.length - 2}</i>}</span><span><i className={broker.ativo ? "status-active" : "status-inactive"}>{broker.ativo ? "Ativo" : "Inativo"}</i></span><span className="online-state"><i className={broker.online ? "on" : ""} />{broker.online ? "Online" : "Offline"}</span><span><b className="row-action">Editar</b></span>
        </button>; })}
      </section>}
    </main>
    {selected && <div className="team-drawer-scrim" onClick={() => setSelectedId(null)}><aside className="team-drawer" onClick={(event) => event.stopPropagation()}>
      <header><div className="team-person"><b>{initials(selected.nome)}</b><em><strong>{selected.nome}</strong><small>{selected.email ?? "Sem e-mail"}</small></em></div><button type="button" onClick={() => setSelectedId(null)}>×</button></header>
      <div className="team-drawer-body">
        <label className="team-switch-row"><span><strong>Online agora</strong><small>Disponível para receber leads no rodízio.</small></span><input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} /><i /></label>
        <label className="team-switch-row"><span><strong>Usuário ativo</strong><small>Permite acesso ao ERP e às funções liberadas.</small></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><i /></label>
        <h3>Instâncias de WhatsApp</h3>
        <details className="instance-picker"><summary>Selecionar instâncias <b>{selectedInstances.length || ""}</b></summary><div><input value={instanceQuery} onChange={(event) => setInstanceQuery(event.target.value)} placeholder="Pesquisar instância..." />{data.instances.filter((instance) => instance.nome.toLowerCase().includes(instanceQuery.toLowerCase())).map((instance) => <label key={instance.id}><input type="checkbox" checked={selectedInstances.includes(instance.id)} onChange={() => setSelectedInstances((current) => current.includes(instance.id) ? current.filter((id) => id !== instance.id) : [...current, instance.id])} /><span><strong>{instance.nome}</strong><small>{instance.telefone ?? instance.status_dapi ?? "Sem telefone"}</small></span><i className={instance.conectada ? "connected" : ""}>{instance.conectada ? "Conectada" : "Offline"}</i></label>)}</div></details>
        <div className="selected-instance-chips">{selectedInstances.map((id) => { const instance = data.instances.find((item) => item.id === id); return instance ? <button type="button" onClick={() => setSelectedInstances((current) => current.filter((item) => item !== id))} key={id}>✓ {instance.nome} ×</button> : null; })}</div>
        <p className="team-hint">O corretor vê apenas conversas das instâncias selecionadas.</p>
        <h3>Documentos</h3>
        <div className="document-card"><span>▤</span><div><strong>Documento (RG/CNH)</strong><small>{selected.doc_rg_nome ?? "Nenhum arquivo enviado"}</small></div>{selected.doc_rg_path && <button type="button" onClick={() => void viewDocument(selected.doc_rg_path)}>Abrir</button>}<button type="button" onClick={() => rgInput.current?.click()}>{selected.doc_rg_path ? "Trocar" : "Adicionar"}</button></div>
        <div className="document-card purple"><span>▧</span><div><strong>Contrato de parceria</strong><small>{selected.doc_contrato_nome ?? "Nenhum arquivo enviado"}</small></div>{selected.doc_contrato_path && <button type="button" onClick={() => void viewDocument(selected.doc_contrato_path)}>Abrir</button>}<button type="button" onClick={() => contractInput.current?.click()}>{selected.doc_contrato_path ? "Trocar" : "Adicionar"}</button></div>
        <input ref={rgInput} hidden type="file" accept="application/pdf,image/*" onChange={(event) => void uploadDocument("rg", event.target.files?.[0])} />
        <input ref={contractInput} hidden type="file" accept="application/pdf,image/*" onChange={(event) => void uploadDocument("contrato", event.target.files?.[0])} />
        {toast && <div className="team-toast">{toast}</div>}
      </div>
      <footer><button type="button" className="save-team" disabled={saving} onClick={() => void save()}>✓ {saving ? "Salvando..." : "Salvar alterações"}</button><button type="button" onClick={() => setSelectedId(null)}>Fechar</button></footer>
    </aside></div>}
  </div>;
}
