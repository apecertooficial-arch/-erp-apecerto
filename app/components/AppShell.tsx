"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ModuleName } from "../features/system/module-map";
import { pathDoModulo, podeVer } from "../features/system/erp-routes";

const adminMainItems: ModuleName[] = ["Início", "CRM", "Performance", "Produtos", "Financeiro"];
const adminToolItems: ModuleName[] = ["Abordagens", "Automações", "Financiamento", "Chat ao Vivo", "Disparos", "Calendário", "Projetos e Tarefas", "Agentes de IA"];
const adminSystemItems: ModuleName[] = ["Usuários", "Perfis e Permissões", "Notificações", "Base de conhecimento", "Auditoria", "Configurações", "Ajuda"];
const brokerMainItems: ModuleName[] = ["Início", "CRM", "Performance", "Produtos", "Financeiro"];
const brokerToolItems: ModuleName[] = ["Chat ao Vivo", "Financiamento", "Disparos", "Calendário"];
const brokerSystemItems: ModuleName[] = ["Notificações", "Configurações", "Ajuda"];

function NavIcon({ item }: { item: ModuleName }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (item === "Início") return <svg {...common}><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
  if (item === "CRM") return <svg {...common}><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg>;
  if (item === "Performance") return <svg {...common}><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>;
  if (item === "Produtos") return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" /></svg>;
  if (item === "Financeiro") return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>;
  if (item === "Abordagens" || item === "Disparos") return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" /></svg>;
  if (item === "Automações") return <svg {...common}><path d="m13 2-9 12h8l-1 8 9-12h-8Z" /></svg>;
  if (item === "Financiamento") return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="18" /><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" /></svg>;
  if (item === "Chat ao Vivo") return <svg {...common}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
  if (item === "Calendário") return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
  if (item === "Agentes de IA") return <svg {...common}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
  if (item === "Projetos e Tarefas") return <svg {...common}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></svg>;
  if (item === "Usuários") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (item === "Notificações") return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;
  if (item === "Base de conhecimento") return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z" /><path d="M4 5.5v14A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>;
  if (item === "Auditoria") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
  if (item === "Configurações") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
  if (item === "Minha Equipe") return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 21v-1a3 3 0 0 1 3-3M20 21v-1a3 3 0 0 0-3-3" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></svg>;
}

function NavGroup({
  label,
  items,
  activeItem,
  onNavigate,
  badges,
  collapsed,
}: {
  label: string;
  items: ModuleName[];
  activeItem: ModuleName;
  onNavigate: (item: ModuleName) => void;
  badges?: Partial<Record<ModuleName, number>>;
  collapsed?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="nav-group">
      {!collapsed && <span className="nav-label">{label}</span>}
      {items.map((item) => {
        const badge = badges?.[item] ?? 0;
        const isActive = item === activeItem;
        return (
          <Link
            className={`nav-item ${isActive ? "active" : ""}`}
            key={item}
            href={pathDoModulo(item)}
            onClick={() => onNavigate(item)}
            aria-current={isActive ? "page" : undefined}
            title={collapsed ? item : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <NavIcon item={item} />
            </span>
            {!collapsed && <span>{item}</span>}
            {!collapsed && item === "CRM" && <small>20</small>}
            {!collapsed && item === "Automações" && <small>2</small>}
            {!collapsed && item === "Produtos" && badge > 0 && (
              <small className="nav-badge-pending" title={`${badge} produto(s) aguardando aprovação`}>
                {badge}
              </small>
            )}
            {collapsed && badge > 0 && <span className="nav-dot-badge" />}
          </Link>
        );
      })}
    </section>
  );
}

export function AppShell({
  children,
  activeItem,
  onNavigate,
  onOpenProfile,
  sessionRole = "corretor",
  sessionName = "Corretor",
  modulePermissions = null,
  isManager = false,
  badges,
  perfilCarregado = false,
}: {
  children: ReactNode;
  activeItem: ModuleName;
  onNavigate: (item: ModuleName) => void;
  onOpenProfile?: () => void;
  sessionRole?: "admin" | "gestor" | "corretor";
  sessionName?: string;
  modulePermissions?: Record<string, string[]> | null;
  isManager?: boolean;
  badges?: Partial<Record<ModuleName, number>>;
  perfilCarregado?: boolean;
}) {
  const isBroker = sessionRole === "corretor";
  const [navCollapsed, setNavCollapsed] = useState(false);

  const canSee = (item: ModuleName) =>
    podeVer(item, { role: sessionRole, permissoes: modulePermissions, carregado: perfilCarregado, isManager });

  const mainItems = (isBroker ? brokerMainItems : adminMainItems).filter(canSee);
  const toolItems = (isBroker ? brokerToolItems : adminToolItems).filter(canSee);
  if (canSee("Minha Equipe") && !toolItems.includes("Minha Equipe")) toolItems.unshift("Minha Equipe");
  const systemItems = (isBroker ? brokerSystemItems : adminSystemItems).filter(canSee);
  const initial = sessionName.trim().slice(0, 1).toUpperCase() || "C";
  const roleLabel = sessionRole === "admin" ? "Admin" : sessionRole === "gestor" ? "Gestor" : "Corretor";

  return (
    <div className={`app-shell ${navCollapsed ? "nav-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <Link href="/inicio" className="brand-link" aria-label="apêcerto ERP Início">
            {navCollapsed ? (
              <img src="/marca/simbolo-cores.png" alt="apêcerto" className="brand-symbol" />
            ) : (
              <img src="/marca/logo-cores.png" alt="apêcerto ERP" className="brand-logo" />
            )}
          </Link>
          <button
            className="nav-collapse-btn"
            type="button"
            onClick={() => setNavCollapsed((v) => !v)}
            title={navCollapsed ? "Expandir menu" : "Minimizar menu"}
            aria-label={navCollapsed ? "Expandir menu" : "Minimizar menu"}
          >
            {navCollapsed ? "»" : "«"}
          </button>
        </div>

        <nav>
          <NavGroup label="PRINCIPAL" items={mainItems} activeItem={activeItem} onNavigate={onNavigate} badges={badges} collapsed={navCollapsed} />
          <NavGroup label="FERRAMENTAS" items={toolItems} activeItem={activeItem} onNavigate={onNavigate} badges={badges} collapsed={navCollapsed} />
          <NavGroup label="SISTEMA" items={systemItems} activeItem={activeItem} onNavigate={onNavigate} badges={badges} collapsed={navCollapsed} />
        </nav>

        <button className="profile" type="button" onClick={onOpenProfile} title="Abrir meu perfil" aria-label="Abrir perfil de usuário">
          <span className="profile-avatar">{initial}</span>
          {!navCollapsed && (
            <div>
              <strong>{sessionName}</strong>
              <small>{roleLabel} · apêcerto</small>
            </div>
          )}
          {!navCollapsed && <i aria-hidden="true">⌄</i>}
        </button>
      </aside>

      <main className="workspace">{children}</main>
    </div>
  );
}

