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
import type { ModuleName } from "./module-map";
import { moduloDoPath, pathDoModulo, rotasModulo, itensDaNavegacao } from "./erp-routes";
import { useErpSession } from "./ErpSession";

/* UM icone por modulo. O fallback de tres tracos existia para todos os modulos
 * fora da barra inferior, e o resultado na folha "Mais" era uma coluna de
 * hamburgueres identicos: onze itens com o mesmo desenho nao ajudam ninguem a
 * achar nada. Tracado de 1.8 e cantos redondos, como o resto da marca. */
function IconeBarra({ modulo }: { modulo: ModuleName | "Mais" }) {
  const c = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (modulo === "Início") return <svg {...c}><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>;
  if (modulo === "Central de Comando") return <svg {...c}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M3 21h19" /></svg>;
  if (modulo === "CRM") return <svg {...c}><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg>;
  if (modulo === "Calendário") return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
  if (modulo === "Notificações") return <svg {...c}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>;
  if (modulo === "Minha Equipe") return <svg {...c}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21v-2a5 5 0 0 1 10 0v2M14 21v-1.5a4 4 0 0 1 7-2.6" /></svg>;
  if (modulo === "Produtos") return <svg {...c}><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M3 21h18M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01" /></svg>;
  if (modulo === "apêcerto Studio") return <svg {...c}><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 15h8M8 11h5M16.5 6.5v3M15 8h3"/></svg>;
  if (modulo === "Configurações") return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (modulo === "Projetos e Tarefas") return <svg {...c}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 2 2 2-3M3 12l2 2 2-3M3 18l2 2 2-3" /></svg>;
  if (modulo === "Abordagens") return <svg {...c}><path d="M21 12a8 8 0 0 1-11.4 7.2L3 21l1.8-6.6A8 8 0 1 1 21 12Z" /></svg>;
  if (modulo === "Automações") return <svg {...c}><path d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z" /></svg>;
  if (modulo === "Agentes de IA") return <svg {...c}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4v4M9 14h.01M15 14h.01M9.5 17h5" /></svg>;
  if (modulo === "Usuários") return <svg {...c}><circle cx="12" cy="8" r="3.4" /><path d="M5 21v-1.6A6.4 6.4 0 0 1 11.4 13h1.2A6.4 6.4 0 0 1 19 19.4V21" /></svg>;
  if (modulo === "Perfis e Permissões") return <svg {...c}><path d="M12 3l7 3v5.5c0 4.3-2.9 7.8-7 9.5-4.1-1.7-7-5.2-7-9.5V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (modulo === "Financeiro") return <svg {...c}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M7 12h.01M17 12h.01" /></svg>;
  if (modulo === "Tracking 360") return <svg {...c}><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="m3 8 7-5 6 7 6-8" /></svg>;
  if (modulo === "Auditoria") return <svg {...c}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h5M9 17h3" /></svg>;
  if (modulo === "Chat ao Vivo") return <svg {...c}><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" /><path d="M8 10h8M8 13h5" /></svg>;
  if (modulo === "Disparos") return <svg {...c}><path d="m3 11 18-8-8 18-2-7-8-3Z" /></svg>;
  if (modulo === "Financiamento") return <svg {...c}><path d="M3 10 12 4l9 6" /><path d="M5 10v9h14v-9M9 19v-5h6v5" /></svg>;
  if (modulo === "Base de conhecimento") return <svg {...c}><path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2Z" /><path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2Z" /></svg>;
  if (modulo === "Marca d'Água") return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 6.5C12 6.5 8.3 11.4 8.3 14.2A3.7 3.7 0 0 0 15.7 14.2C15.7 11.4 12 6.5 12 6.5Z" /><path d="m5.6 18.4 12.8-12.8" /></svg>;
  if (modulo === "Ajuda") return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.4M12 17h.01" /></svg>;
  return <svg {...c}><path d="M4 12h16M4 6h16M4 18h16" /></svg>;
}

/* Os grupos da folha "Mais" saem da classe A/B/C que erp-routes.ts ja atribui a
 * cada modulo -- nenhuma lista nova para manter em paralelo. */
const GRUPOS_MAIS = [
  { titulo: "Rotina", classe: "A" },
  { titulo: "Gestão", classe: "B" },
  { titulo: "De vez em quando", classe: "C" },
] as const;

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { profile, permissoes, role, isManager, perfilCarregado, badges, recarregarPerfil } = useErpSession();
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
  const temCorretorVinculado = profile?.brokerId != null;
  const { barra: itensBarra, mais: itensMais } = itensDaNavegacao({
    role,
    permissoes,
    carregado: perfilCarregado,
    isManager,
    temCorretorVinculado,
  });
  const rotuloMobile = rotasModulo[moduloAtual].rotuloCurto ?? moduloAtual;
  const gruposMais = GRUPOS_MAIS
    .map((grupo) => ({ titulo: grupo.titulo, itens: itensMais.filter((m) => rotasModulo[m].classe === grupo.classe) }))
    .filter((grupo) => grupo.itens.length > 0);

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
      temCorretorVinculado={temCorretorVinculado}
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

      {/* FOLHA "MAIS" -- desenho aprovado: uma coluna, agrupada, com o icone do
          modulo num quadrado branco. A grade de duas colunas anterior obrigava
          a ler em zigue-zague onze itens sem hierarquia. */}
      {maisAberto && <div className="ape-mais-fundo" role="presentation" onClick={() => setMaisAberto(false)}>
        <section className="ape-mais-folha" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={(evento) => evento.stopPropagation()}>
          <span className="ape-mais-alca" aria-hidden="true" />
          <header className="ape-mais-topo">
            <strong>Mais</strong>
            <button type="button" onClick={() => setMaisAberto(false)} aria-label="Fechar">×</button>
          </header>
          {gruposMais.length > 0 ? gruposMais.map((grupo) => (
            <div className="ape-mais-grupo" key={grupo.titulo}>
              <p className="ape-mais-titulo">{grupo.titulo}</p>
              <div className="ape-mais-itens">
                {grupo.itens.map((m) => (
                  <Link key={m} href={pathDoModulo(m)} onClick={() => setMaisAberto(false)}>
                    <span className="ape-mais-icone" aria-hidden="true"><IconeBarra modulo={m} /></span>
                    <span className="ape-mais-rotulo">{m}</span>
                    <b aria-hidden="true">›</b>
                  </Link>
                ))}
              </div>
            </div>
          )) : <p className="ape-mais-vazio">Nenhuma outra opção disponível.</p>}
        </section>
      </div>}

      {perfilAberto && (
        <ProfilePanel
          email={profile?.email ?? ""}
          onClose={() => setPerfilAberto(false)}
          onSaved={() => { void recarregarPerfil(); }}
        />
      )}

    </AppShell>
  );
}
