"use client";

/* Icone de modulo — FONTE UNICA.
 *
 * Antes disto o mesmo desenho vivia em dois lugares: `NavIcon` (privado,
 * dentro do AppShell, cobrindo todos os modulos, 19px) e `IconeBarra` (dentro
 * do ErpShell, so os quatro da barra inferior, 22px). A folha "Mais" precisa
 * do conjunto completo em 18px, e uma terceira copia garantiria que um dia os
 * tres desenhos do mesmo modulo ficassem diferentes.
 *
 * `AppShell.NavIcon` ainda nao foi migrado para ca — e a proxima linha da
 * limpeza, nao entrou aqui para nao mexer na sidebar do desktop no mesmo PR
 * da folha do celular.
 *
 * SEM CLASSE, SEM WRAPPER: devolve o <svg> cru. A barra inferior depende
 * disso — `correcoes-celular.css` troca o icone do CRM com
 * `.app-bottom-nav > a[href^="/crm"] > svg { display: none }`, seletor de
 * filho direto que quebraria se o svg ganhasse uma caixa em volta.
 */

import type { ModuleName } from "./module-map";

/** Itens que nao sao modulo mas aparecem na navegacao do celular. */
export type IconeExtra = "Mais" | "Perfil" | "Sair";

export function IconeModulo({ modulo, tamanho = 19 }: { modulo: ModuleName | IconeExtra; tamanho?: number }) {
  const c = {
    width: tamanho,
    height: tamanho,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  /* --- barra inferior --- */
  if (modulo === "Início") return <svg {...c}><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
  if (modulo === "CRM") return <svg {...c}><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg>;
  if (modulo === "Calendário") return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
  if (modulo === "Notificações") return <svg {...c}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;

  /* --- rotina --- */
  if (modulo === "Produtos") return <svg {...c}><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01" /></svg>;
  if (modulo === "Projetos e Tarefas") return <svg {...c}><path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11" /><path d="m3 6.5 1.6 1.6L7.5 5" /><path d="m3 12 1.6 1.6L7.5 10.5" /><path d="m3 17.5 1.6 1.6L7.5 16" /></svg>;

  /* --- gestao --- */
  if (modulo === "Minha Equipe") return <svg {...c}><path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 21v-1a3 3 0 0 1 3-3M20 21v-1a3 3 0 0 0-3-3" /></svg>;
  if (modulo === "Performance") return <svg {...c}><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>;
  if (modulo === "Financeiro") return <svg {...c}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h.01" /></svg>;
  if (modulo === "Auditoria") return <svg {...c}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
  if (modulo === "Usuários") return <svg {...c}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6" /></svg>;
  if (modulo === "Perfis e Permissões") return <svg {...c}><path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5v-6Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (modulo === "Automações") return <svg {...c}><path d="m13 2-9 12h8l-1 8 9-12h-8Z" /></svg>;
  if (modulo === "Agentes de IA") return <svg {...c}><path d="M10 3 8.7 8.7 3 10l5.7 1.3L10 17l1.3-5.7L17 10l-5.7-1.3ZM18 15l-.7 2.3L15 18l2.3.7L18 21l.7-2.3L21 18l-2.3-.7Z" /></svg>;
  if (modulo === "Abordagens" || modulo === "Disparos") return <svg {...c}><path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" /></svg>;

  /* --- ferramentas --- */
  if (modulo === "Chat ao Vivo") return <svg {...c}><path d="M7.8 20A9 9 0 1 0 4 16l-2 6Z" /></svg>;
  if (modulo === "Financiamento") return <svg {...c}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h8" /></svg>;
  if (modulo === "Base de conhecimento") return <svg {...c}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z" /><path d="M4 5.5v14A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>;
  if (modulo === "Configurações") return <svg {...c}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></svg>;

  /* --- conta e navegacao --- */
  if (modulo === "Perfil") return <svg {...c}><path d="M16 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21" /><circle cx="9" cy="7" r="3.6" /><path d="M22 21v-1.8a4 4 0 0 0-3-3.8M16.5 3.4a3.6 3.6 0 0 1 0 7" /></svg>;
  if (modulo === "Sair") return <svg {...c}><rect x="3.5" y="10.5" width="17" height="11" rx="2.6" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" /></svg>;
  if (modulo === "Mais") return <svg {...c}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;

  /* Modulo novo sem desenho proprio: interrogacao, nunca nada. Icone ausente
     vira item sem alvo visual e o dedo erra. */
  return <svg {...c}><circle cx="12" cy="12" r="10" /><path d="M9 9a3 3 0 1 1 4.5 2.6C12.6 12.1 12 12.7 12 14M12 18h.01" /></svg>;
}
