"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MODULE_CAPABILITIES, MODULE_ORDER, MODULE_LABELS, ACTION_LABELS,
  ACCESS_LEVELS, actionsForLevel, levelForActions,
  label, type PermissionMap, type AccessLevel,
} from "../../lib/permissions";

type Perms = PermissionMap;
type Perfil = { id: string; nome: string; is_system: boolean; permissoes: Perms; atualizado_em?: string | null };
type Usuario = { id: string; nome: string; role: string; ativo: boolean; permissoes: Perms | null };

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    const res = await fetch("/api/permissions", { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = (await res.json()) as { perfis?: Perfil[]; usuarios?: Usuario[]; error?: string };
    if (!res.ok) throw new Error(json.error || "Não foi possível carregar as permissões.");
    setPerfis(json.perfis ?? []);
    setUsuarios(json.usuarios ?? []);
  };
  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar.")); }, [accessToken]);

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

  // Define o nível de acesso de um módulo (escreve o conjunto de ações correspondente).
  const setLevel = (mod: string, level: AccessLevel) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      const acts = actionsForLevel(mod, level);
      if (acts.length) next[mod] = acts; else delete next[mod];
      return next;
    });
  };
  const toggleExpand = (mod: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(mod)) next.delete(mod); else next.add(mod);
    return next;
  });

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
              <div className="perms-levels">
                {MODULE_ORDER.map((m) => {
                  const lvl = levelForActions(m, draft[m] ?? []);
                  const caps = MODULE_CAPABILITIES[m] ?? [];
                  const open = expanded.has(m);
                  return (
                    <div className={`perm-row ${open ? "open" : ""}`} key={m}>
                      <div className="perm-row-head">
                        <strong className="perm-row-name">{label(MODULE_LABELS, m)}</strong>
                        <div className="perm-seg" role="group" aria-label={`Nível de acesso · ${label(MODULE_LABELS, m)}`}>
                          {ACCESS_LEVELS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              className={`plvl ${lvl === opt.key ? "active" : ""}`}
                              onClick={() => setLevel(m, opt.key)}
                              title={opt.hint}
                            >{opt.label}</button>
                          ))}
                          {lvl === "custom" && <span className="plvl-custom" title="Ajuste manual — não corresponde a um nível">Personalizado</span>}
                        </div>
                        <button type="button" className="perm-personalizar" onClick={() => toggleExpand(m)}>{open ? "Fechar" : "Personalizar"}</button>
                      </div>
                      {open && (
                        <div className="perm-detail">
                          {caps.map((a) => {
                            const on = has(m, a);
                            return (
                              <button
                                key={a}
                                type="button"
                                role="switch"
                                aria-checked={on}
                                className={`perm-chip ${on ? "on" : "off"}`}
                                onClick={() => toggle(m, a)}
                              >{label(ACTION_LABELS, a)}<span>{on ? "Sim" : "Não"}</span></button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
