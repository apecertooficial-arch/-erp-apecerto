"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ModuleName } from "../features/system/module-map";
import { pathDoModulo, podeVer } from "../features/system/erp-routes";
import "../styles/menu-marca-dagua-icone.css";

/* GRUPOS DO MENU — ordem aprovada no desenho.

   Notificações e Base de conhecimento saíram de SISTEMA e entraram no fim de
   FERRAMENTAS: as duas são rotina de trabalho, não administração do sistema.
   Ajuda ficou em SISTEMA, como último item. A ordem VISUAL de cada grupo vem de
   redesign-apecerto-menu.css (`order` por href) — estes arrays definem quem
   pertence a qual grupo; a folha define em que posição aparece. Mexer em um sem
   olhar o outro faz item saltar de lugar.

   Nenhum item foi removido em relação ao publicado. */
const adminMainItems: ModuleName[] = ["Início", "CRM", "Produtos", "Financeiro", "Tracking 360"];
const adminToolItems: ModuleName[] = ["Abordagens", "Automações", "Financiamento", "Chat ao Vivo", "Disparos", "Calendário", "Projetos e Tarefas", "Agentes de IA", "Marca d'Água", "Notificações", "Base de conhecimento"];
const adminSystemItems: ModuleName[] = ["Usuários", "Perfis e Permissões", "Auditoria", "Configurações", "Ajuda"];
const brokerMainItems: ModuleName[] = ["Início", "CRM", "Produtos", "Financeiro"];
const brokerToolItems: ModuleName[] = ["Chat ao Vivo", "Financiamento", "Disparos", "Calendário", "Marca d'Água", "Notificações"];
const brokerSystemItems: ModuleName[] = ["Configurações", "Ajuda"];

const rotulosMenu: Partial<Record<ModuleName, string>> = { CRM: "CRM · Meu Dia" };

function NavIcon({ item }: { item: ModuleName }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (item === "Início") return <svg {...common}><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
  if (item === "CRM") return <svg {...common}><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg>;
  if (item === "Produtos") return <svg {...common}><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01" /></svg>;
  if (item === "Financeiro") return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h.01" /></svg>;
  if (item === "Tracking 360") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="m3 8 7-5 6 7 6-8" /></svg>;
  if (item === "Abordagens" || item === "Disparos") return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" /></svg>;
  if (item === "Automações") return <svg {...common}><path d="m13 2-9 12h8l-1 8 9-12h-8Z" /></svg>;
  if (item === "Financiamento") return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h8" /></svg>;
  if (item === "Chat ao Vivo") return <svg {...common}><path d="M7.8 20A9 9 0 1 0 4 16l-2 6Z" /></svg>;
  if (item === "Calendário") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
  if (item === "Agentes de IA") return <svg {...common}><path d="M10 3 8.7 8.7 3 10l5.7 1.3L10 17l1.3-5.7L17 10l-5.7-1.3ZM18 15l-.7 2.3L15 18l2.3.7L18 21l.7-2.3L21 18l-2.3-.7Z" /></svg>;
  if (item === "Projetos e Tarefas") return <svg {...common}><rect x="3" y="3" width="7" height="13" rx="1.5" /><rect x="14" y="3" width="7" height="8" rx="1.5" /><path d="M3 20h7M14 15h7" /></svg>;
  if (item === "Usuários") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6" /></svg>;
  if (item === "Notificações") return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;
  if (item === "Base de conhecimento") return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z" /><path d="M4 5.5v14A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>;
  if (item === "Marca d'Água") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 6.5C12 6.5 8.3 11.4 8.3 14.2A3.7 3.7 0 0 0 15.7 14.2C15.7 11.4 12 6.5 12 6.5Z" /><path d="m5.6 18.4 12.8-12.8" /></svg>;
  if (item === "Auditoria") return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
  if (item === "Configurações") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>;
  if (item === "Minha Equipe") return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 21v-1a3 3 0 0 1 3-3M20 21v-1a3 3 0 0 0-3-3" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9 9a3 3 0 1 1 4.5 2.6C12.6 12.1 12 12.7 12 14M12 18h.01" /></svg>;
}

function NavGroup({ label, items, activeItem, onNavigate, badges }: { label: string; items: ModuleName[]; activeItem: ModuleName; onNavigate: (item: ModuleName) => void; badges?: Partial<Record<ModuleName, number>> }) {
  return (
    <section className="nav-group">
      <span className="nav-label">{label}</span>
      {items.map((item) => {
        const badge = badges?.[item] ?? 0;
        return (
          <Link className={`nav-item ${item === activeItem ? "active" : ""}`} key={item} href={pathDoModulo(item)} onClick={() => onNavigate(item)} aria-current={item === activeItem ? "page" : undefined}>
            <span className="nav-icon" aria-hidden="true"><NavIcon item={item} /></span>
            <span>{rotulosMenu[item] ?? item}</span>
            {item === "CRM" && <small>20</small>}
            {item === "Automações" && <small>2</small>}
            {item === "Produtos" && badge > 0 && <small className="nav-badge-pending" title={`${badge} produto(s) aguardando aprovação`}>{badge}</small>}
          </Link>
        );
      })}
    </section>
  );
}

export function AppShell({ children, activeItem, onNavigate, onOpenProfile, sessionRole = "corretor", sessionName = "Corretor", modulePermissions = null, isManager = false, temCorretorVinculado = false, badges, perfilCarregado = false }: { children: ReactNode; activeItem: ModuleName; onNavigate: (item: ModuleName) => void; onOpenProfile?: () => void; sessionRole?: "admin" | "gestor" | "corretor"; sessionName?: string; modulePermissions?: Record<string, string[]> | null; isManager?: boolean; temCorretorVinculado?: boolean; badges?: Partial<Record<ModuleName, number>>; perfilCarregado?: boolean }) {
  const isBroker = sessionRole === "corretor";
  const [navCollapsed, setNavCollapsed] = useState(false);
  /* Doc §14 — sem "ver" no módulo, ele some do menu. Regra única em
     features/system/erp-routes.ts, porque o menu do celular usa a MESMA.
     Isto controla EXPOSIÇÃO DE MENU, não autorização de dados. */
  const canSee = (item: ModuleName) =>
    podeVer(item, { role: sessionRole, permissoes: modulePermissions, carregado: perfilCarregado, isManager, temCorretorVinculado });

  const mainItems = (isBroker ? brokerMainItems : adminMainItems).filter(canSee);
  const toolItems = (isBroker ? brokerToolItems : adminToolItems).filter(canSee);
  // "Minha Equipe" é liberada por papel real (isManager), não por slug — regra vive em podeVer().
  if (canSee("Minha Equipe") && !toolItems.includes("Minha Equipe")) toolItems.unshift("Minha Equipe");
  const systemItems = (isBroker ? brokerSystemItems : adminSystemItems).filter(canSee);
  const initial = sessionName.trim().slice(0, 1).toUpperCase() || "C";
  const roleLabel = sessionRole === "admin" ? "Admin" : sessionRole === "gestor" ? "Gestor" : "Corretor";
  return (
    <div className={`app-shell ${navCollapsed ? "nav-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg></span><strong>apê<span>certo</span></strong><button className="nav-collapse-btn" type="button" onClick={() => setNavCollapsed((v) => !v)} title={navCollapsed ? "Expandir menu" : "Minimizar menu"} aria-label="Minimizar menu">{navCollapsed ? "»" : "«"}</button></div>
        <nav>
          <NavGroup label="PRINCIPAL" items={mainItems} activeItem={activeItem} onNavigate={onNavigate} badges={badges} />
          <NavGroup label="FERRAMENTAS" items={toolItems} activeItem={activeItem} onNavigate={onNavigate} badges={badges} />
          <NavGroup label="SISTEMA" items={systemItems} activeItem={activeItem} onNavigate={onNavigate} badges={badges} />
        </nav>
        <button className="profile" type="button" onClick={onOpenProfile} title="Abrir meu perfil"><span>{initial}</span><div><strong>{sessionName}</strong><small>{roleLabel} · apêcerto</small></div><i>⌄</i></button>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
