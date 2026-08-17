"use client";

/* Casca global do ERP.
 *
 * UMA arvore para os dois formatos. O desktop continua com a sidebar do
 * AppShell, intocada. O celular ganha cabecalho compacto + barra inferior +
 * folha "Mais". Quem some em cada largura e o CSS -- os filhos sao montados
 * uma vez so, nunca duplicados.
 *
 * A lista de modulos vem de erp-routes.ts, a mesma que a sidebar consome.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "../../components/AppShell";
import { ProfilePanel } from "../../components/ProfilePanel";
import { PresenceHeartbeat } from "../presence/PresenceHeartbeat";
import { PerformanceActivityHeartbeat } from "../performance/PerformanceActivityHeartbeat";
import type { ModuleName } from "./module-map";
import { moduloDoPath, pathDoModulo, rotasModulo, itensDaNavegacao } from "./erp-routes";
import { useErpSession } from "./ErpSession";

function IconeBarra({ modulo }: { modulo: ModuleName | "Mais" }) {
  const c = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (modulo === "Início") return <svg {...c}><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
  if (modulo === "CRM") return <svg {...c}><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg>;
  if (modulo === "Calendário") return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
  if (modulo === "Notificações") return <svg {...c}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;
  if (modulo === "Performance") return <svg {...c}><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>;
  if (modulo === "Minha Equipe") return <svg {...c}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21v-2a5 5 0 0 1 10 0v2M14 21v-1.5a4 4 0 0 1 7-2.6" /></svg>;
  if (modulo === "Produtos") return <svg {...c}><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01" /></svg>;
  if (modulo === "Configurações") return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  return <svg {...c}><path d="M4 12h16M4 6h16M4 18h16" /></svg>;
}

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { accessToken, profile, permissoes, role, isManager, perfilCarregado, badges, recarregarPerfil } = useErpSession();
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);

  const moduloAtual = moduloDoPath(pathname) ?? "Início";
  const primeiroNome = (profile?.name ?? "").trim().split(/\s+/)[0] || "corretor";
  const inicial = (profile?.name ?? "C").trim().slice(0, 1).toUpperCase();
  const dataDeHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date()).replace("-feira", "");
  /* Badge real: so o que os modulos publicam. Zero significa zero -- nada de
     numero decorativo. O publisher de Notificacoes chega junto com a rodada
     daquele modulo; ate la o sino aparece limpo, que e a verdade. */
  const naoLidas = badges["Notificações"] ?? 0;
  const rotuloSino = naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : "Notificações";
  const { barra: itensBarra, mais: itensMais } = itensDaNavegacao({ role, permissoes, carregado: perfilCarregado, isManager });
  const rotuloMobile = rotasModulo[moduloAtual].rotuloCurto ?? moduloAtual;

  // Trocar de rota volta o scroll pro topo. Sem setState aqui: a folha "Mais"
  // e fechada no proprio clique do link, que e onde a intencao acontece.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <AppShell
      activeItem={moduloAtual}
      onNavigate={() => undefined}
      onOpenProfile={() => setPerfilAberto(true)}
      sessionRole={role}
      sessionName={profile?.name ?? "Corretor"}
      modulePermissions={permissoes}
      isManager={isManager}
      perfilCarregado={perfilCarregado}
      badges={badges as Partial<Record<ModuleName, number>>}
    >
      {/* Cabecalho unico do celular. No Inicio ele vira a saudacao; nos demais
          modulos, o nome do modulo. Isso evita o titulo aparecer duas vezes --
          uma na barra e outra dentro do conteudo. */}
      <header className="app-mobile-top">
        <div className="amt-esq">
          {moduloAtual === "Início" ? (
            <>
              <strong>Olá, {primeiroNome}</strong>
              <small>{dataDeHoje}</small>
            </>
          ) : (
            <strong>{rotuloMobile}</strong>
          )}
        </div>
        <div className="amt-dir">
          <Link href={pathDoModulo("Notificações")} className="amt-sino" aria-label={rotuloSino}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" />
            </svg>
            {naoLidas > 0 && <b aria-hidden="true">{naoLidas > 99 ? "99+" : naoLidas}</b>}
          </Link>
          <button type="button" className="amt-perfil" onClick={() => setPerfilAberto(true)} aria-label="Abrir meu perfil">
            {inicial}
          </button>
        </div>
      </header>

      <div className="app-mobile-scroll">{children}</div>

      <nav className="app-bottom-nav" aria-label="Navegação principal">
        {itensBarra.map((m) => (
          <Link
            key={m}
            href={pathDoModulo(m)}
            className={m === moduloAtual ? "active" : ""}
            aria-current={m === moduloAtual ? "page" : undefined}
          >
            <IconeBarra modulo={m} />
            <span>{rotasModulo[m].rotuloCurto ?? m}</span>
            {(badges[m] ?? 0) > 0 && <i className="abn-badge" aria-hidden="true">{(badges[m] ?? 0) > 99 ? "99+" : badges[m]}</i>}
          </Link>
        ))}
        <button type="button" className={maisAberto ? "active" : ""} onClick={() => setMaisAberto(true)} aria-haspopup="dialog" aria-expanded={maisAberto}>
          <IconeBarra modulo="Mais" />
          <span>Mais</span>
        </button>
      </nav>

      {maisAberto && <div className="app-mais-overlay" role="presentation" onClick={() => setMaisAberto(false)}>
        <section className="app-mais-folha" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={(evento) => evento.stopPropagation()}>
          <header><strong>Mais</strong><button type="button" onClick={() => setMaisAberto(false)} aria-label="Fechar">×</button></header>
          {itensMais.length > 0 ? <div className="app-mais-grid">{itensMais.map((m) => <Link key={m} href={pathDoModulo(m)} onClick={() => setMaisAberto(false)}><IconeBarra modulo={m} /><span>{m}</span><b aria-hidden="true">›</b></Link>)}</div> : <p className="app-mais-vazio">Nenhuma outra opção disponível.</p>}
        </section>
      </div>}

      {perfilAberto && (
        <ProfilePanel
          email={profile?.email ?? ""}
          onClose={() => setPerfilAberto(false)}
          onSaved={() => { void recarregarPerfil(); }}
        />
      )}

      {/* A confirmação existia desde a V7.2, mas deixou de ser montada quando
          o ERP ganhou o layout persistente. Ela volta a viver na casca global:
          aparece em qualquer módulo e apenas para corretores vinculados. */}
      {role === "corretor" && accessToken && profile?.brokerId != null && (
        <PresenceHeartbeat accessToken={accessToken} initialOnline={profile.online} />
      )}

      {accessToken && profile?.brokerId != null && (
        <PerformanceActivityHeartbeat accessToken={accessToken} />
      )}

    </AppShell>
  );
}
