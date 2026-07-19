"use client";

import { useEffect, useMemo, useState } from "react";

type Perms = Record<string, string[]>;
type Perfil = { id: string; nome: string; is_system: boolean; permissoes: Perms; atualizado_em?: string | null };
type Usuario = { id: string; nome: string; role: string; ativo: boolean; permissoes: Perms | null };

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Início / Dashboard", crm: "CRM", leads: "Leads", pipeline: "Funil (Pipeline)", chat: "Chat ao Vivo",
  disparos: "Disparos", abordagens: "Abordagens", produtos: "Produtos", vendas: "Vendas", comissoes: "Comissões",
  financeiro: "Financeiro", fluxo_caixa: "Fluxo de caixa", metas: "Metas", performance: "Performance",
  calendario: "Calendário", automacoes: "Automações", agentes_ia: "Agentes de IA", notificacoes: "Notificações",
  configuracoes: "Configurações", usuarios: "Usuários", auditoria: "Auditoria",
};
const MODULE_ORDER = ["dashboard", "crm", "leads", "pipeline", "chat", "disparos", "abordagens", "produtos", "vendas", "comissoes", "financeiro", "fluxo_caixa", "metas", "performance", "calendario", "automacoes", "agentes_ia", "notificacoes", "configuracoes", "usuarios", "auditoria"];
const ACTION_LABELS: Record<string, string> = {
  ver: "Ver", criar: "Criar", editar: "Editar", excluir: "Excluir", exportar: "Exportar", importar: "Importar",
  aprovar: "Aprovar", enviar: "Enviar", cancelar: "Cancelar", conciliar: "Conciliar", mover: "Mover", reordenar: "Reordenar",
  atribuir: "Atribuir", atribuir_proprio: "Atribuir (próprio)", transferir: "Transferir", publicar: "Publicar",
  configurar: "Configurar", executar: "Executar", gerenciar_permissoes: "Gerenciar permissões", ver_conexoes: "Ver conexões",
  visualizar_historico: "Ver histórico", consultar_execucoes: "Consultar execuções",
};
const ACTION_ORDER = ["ver", "criar", "editar", "excluir", "exportar", "importar", "aprovar", "enviar", "cancelar", "conciliar", "mover", "reordenar", "atribuir", "atribuir_proprio", "transferir", "publicar", "configurar", "executar", "gerenciar_permissoes", "ver_conexoes", "visualizar_historico", "consultar_execucoes"];

const label = (dict: Record<string, string>, key: string) => dict[key] ?? key.replace(/_/g, " ");
const scopeOf = (id: string) => (id === "admin" || id === "auditor" || id === "financeiro" || id === "gestor_comercial" ? "todos" : id === "gestor_equipe" ? "equipe" : "proprio");
const SCOPE_LABEL: Record<string, string> = { proprio: "Somente os próprios dados", equipe: "Dados da própria equipe", todos: "Todos os dados da empresa" };

export function PermissionsWorkspace({ accessToken }: { accessToken: string }) {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tab, setTab] = useState<"perfis" | "usuarios">("perfis");
  const [selPerfil, setSelPerfil] = useState<string>("corretor");
  const [selUser, setSelUser] = useState<string>("");
  const [draft, setDraft] = useState<Perms>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/permissions", { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = (await res.json()) as { perfis?: Perfil[]; usuarios?: Usuario[]; error?: string };
    if (!res.ok) throw new Error(json.error || "Não foi possível carregar as permissões.");
    setPerfis(json.perfis ?? []);
    setUsuarios(json.usuarios ?? []);
  };
  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar.")); }, [accessToken]);

  // Catálogo: módulos e ações realmente usados em qualquer perfil (fonte da verdade do que o sistema verifica)
  const catalog = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const p of perfis) for (const [mod, acts] of Object.entries(p.permissoes || {})) { (map[mod] ??= new Set()); (acts || []).forEach((a) => map[mod].add(a)); }
    for (const m of MODULE_ORDER) map[m] ??= new Set(["ver"]);
    const modules = Object.keys(map).sort((a, b) => (MODULE_ORDER.indexOf(a) + 1 || 99) - (MODULE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
    const actionsByMod: Record<string, string[]> = {};
    for (const m of modules) actionsByMod[m] = [...map[m]].sort((a, b) => (ACTION_ORDER.indexOf(a) + 1 || 99) - (ACTION_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
    return { modules, actionsByMod };
  }, [perfis]);

  const perfilById = useMemo(() => new Map(perfis.map((p) => [p.id, p])), [perfis]);
  const userById = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);

  // Quando muda seleção, recarrega o rascunho
  useEffect(() => { if (tab === "perfis") setDraft(structuredClone(perfilById.get(selPerfil)?.permissoes ?? {})); }, [tab, selPerfil, perfilById]);
  useEffect(() => {
    if (tab !== "usuarios") return;
    const u = userById.get(selUser);
    if (!u) { setDraft({}); return; }
    const base = (u.permissoes && Object.keys(u.permissoes).length) ? u.permissoes : perfilById.get(u.role)?.permissoes ?? {};
    setDraft(structuredClone(base));
  }, [tab, selUser, userById, perfilById]);

  const toggle = (mod: string, act: string) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      const cur = new Set(next[mod] ?? []);
      if (cur.has(act)) cur.delete(act); else cur.add(act);
      if (cur.size) next[mod] = [...cur]; else delete next[mod];
      return next;
    });
  };
  const has = (mod: string, act: string) => (draft[mod] ?? []).includes(act);

  const saveProfile = async () => {
    setBusy(true); setMessage(null); setError(null);
    try {
      const res = await fetch("/api/permissions", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveProfile", perfilId: selPerfil, permissoes: draft }) });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error);
      setMessage(`Perfil "${perfilById.get(selPerfil)?.nome}" salvo.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setBusy(false); }
  };
  const saveUser = async (clear = false) => {
    setBusy(true); setMessage(null); setError(null);
    try {
      const res = await fetch("/api/permissions", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(clear ? { action: "clearUserOverride", userId: selUser } : { action: "saveUserOverride", userId: selUser, permissoes: draft }) });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error);
      setMessage(clear ? "Override removido — usuário voltou ao perfil." : "Permissões individuais salvas.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setBusy(false); }
  };

  const activeScope = tab === "perfis" ? scopeOf(selPerfil) : (userById.get(selUser) ? scopeOf(userById.get(selUser)!.role) : "proprio");
  const selUserObj = userById.get(selUser);

  return (
    <div className="perms-workspace">
      <header className="perms-head">
        <div><span>SEGURANÇA · CONTROLE DE ACESSO</span><h1>Perfis e Permissões</h1><p>Defina o que cada perfil e cada usuário pode ver e fazer. O bloqueio real é garantido no banco (RLS) — esta tela configura o comportamento por cima dele.</p></div>
        <div className="perms-tabs">
          <button className={tab === "perfis" ? "active" : ""} type="button" onClick={() => setTab("perfis")}>Perfis</button>
          <button className={tab === "usuarios" ? "active" : ""} type="button" onClick={() => setTab("usuarios")}>Por usuário</button>
        </div>
      </header>

      <div className="perms-note">🔒 <strong>Deny by default:</strong> o que não estiver marcado fica bloqueado. Dados financeiros e de outros corretores já são bloqueados no banco, independentemente destas marcações.</div>
      {message && <button className="perms-msg ok" type="button" onClick={() => setMessage(null)}>{message} ×</button>}
      {error && <button className="perms-msg err" type="button" onClick={() => setError(null)}>{error} ×</button>}

      <div className="perms-body">
        <aside className="perms-side">
          {tab === "perfis" ? (
            <>
              <span className="perms-side-label">Perfis do sistema</span>
              {perfis.map((p) => (
                <button key={p.id} type="button" className={`perms-side-item ${selPerfil === p.id ? "active" : ""}`} onClick={() => setSelPerfil(p.id)}>
                  <strong>{p.nome}</strong><small>{SCOPE_LABEL[scopeOf(p.id)]}</small>
                </button>
              ))}
            </>
          ) : (
            <>
              <span className="perms-side-label">Usuários</span>
              {usuarios.map((u) => (
                <button key={u.id} type="button" className={`perms-side-item ${selUser === u.id ? "active" : ""}`} onClick={() => setSelUser(u.id)}>
                  <strong>{u.nome}</strong><small>{perfilById.get(u.role)?.nome ?? u.role}{u.permissoes && Object.keys(u.permissoes).length ? " · override" : ""}</small>
                </button>
              ))}
            </>
          )}
        </aside>

        <section className="perms-main">
          <div className="perms-scope">
            <span>Escopo de dados</span>
            <strong>{SCOPE_LABEL[activeScope]}</strong>
            <small>O escopo é aplicado pelo banco (RLS). Corretor sempre limitado aos próprios dados.</small>
          </div>

          {tab === "usuarios" && !selUserObj ? (
            <div className="perms-empty">Selecione um usuário à esquerda para ver ou personalizar as permissões dele.</div>
          ) : (
            <>
              {tab === "usuarios" && selUserObj && (
                <div className="perms-userbar">
                  <span>{selUserObj.permissoes && Object.keys(selUserObj.permissoes).length ? "Este usuário tem permissões individuais (override) sobre o perfil." : `Sem override — seguindo o perfil "${perfilById.get(selUserObj.role)?.nome ?? selUserObj.role}". Ajuste abaixo para personalizar.`}</span>
                </div>
              )}
              <div className="perms-matrix-wrap">
                <table className="perms-matrix">
                  <thead>
                    <tr><th className="mod-col">Módulo</th>{ACTION_ORDER.filter((a) => catalog.modules.some((m) => catalog.actionsByMod[m].includes(a))).map((a) => <th key={a}>{label(ACTION_LABELS, a)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {catalog.modules.map((m) => {
                      const cols = ACTION_ORDER.filter((a) => catalog.modules.some((mm) => catalog.actionsByMod[mm].includes(a)));
                      return (
                        <tr key={m}>
                          <td className="mod-col"><strong>{label(MODULE_LABELS, m)}</strong></td>
                          {cols.map((a) => {
                            const applicable = catalog.actionsByMod[m].includes(a);
                            return <td key={a} className={applicable ? "" : "na"}>{applicable ? <input type="checkbox" checked={has(m, a)} onChange={() => toggle(m, a)} aria-label={`${label(MODULE_LABELS, m)} · ${label(ACTION_LABELS, a)}`} /> : <span>—</span>}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <footer className="perms-actions">
                {tab === "perfis" ? (
                  <>
                    <button className="perms-primary" type="button" disabled={busy} onClick={saveProfile}>{busy ? "Salvando…" : "Salvar perfil"}</button>
                    <button type="button" disabled={busy} onClick={() => setDraft(structuredClone(perfilById.get(selPerfil)?.permissoes ?? {}))}>Descartar alterações</button>
                  </>
                ) : (
                  <>
                    <button className="perms-primary" type="button" disabled={busy} onClick={() => saveUser(false)}>{busy ? "Salvando…" : "Salvar permissões deste usuário"}</button>
                    {selUserObj?.permissoes && Object.keys(selUserObj.permissoes).length ? <button type="button" disabled={busy} onClick={() => saveUser(true)}>Remover override (voltar ao perfil)</button> : null}
                  </>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
