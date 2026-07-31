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
import { ConviteInstalar } from "../../components/ConviteInstalar";
import { sairDaConta } from "../../lib/sair-da-conta";
import type { ModuleName } from "./module-map";
import { moduloDoPath, pathDoModulo, rotasModulo, itensDaNavegacao, gruposDoMais } from "./erp-routes";
import { IconeModulo, type IconeExtra } from "./IconeModulo";
import { useErpSession } from "./ErpSession";

/* Chevron do item da folha. Fica aqui e nao no IconeModulo porque nao e icone
   de modulo: e o mesmo desenho em toda linha, so dizendo "isto abre". */
function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* Item da folha "Mais". Vira <a> quando leva a uma rota e <button> quando
   dispara uma acao -- <a href="#"> com onClick quebra abrir-em-nova-aba,
   arrastar para a barra de favoritos e leitor de tela. */
function ItemMais({ icone, rotulo, href, onClick, className }: {
  icone: ModuleName | IconeExtra;
  rotulo: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const dentro = (
    <>
      <span className="ami-icone" aria-hidden="true"><IconeModulo modulo={icone} tamanho={18} /></span>
      <span>{rotulo}</span>
      <Chevron />
    </>
  );
  const classe = `app-mais-item${className ? ` ${className}` : ""}`;
  return href
    ? <Link href={href} className={classe} onClick={onClick}>{dentro}</Link>
    : <button type="button" className={classe} onClick={onClick}>{dentro}</button>;
}

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { profile, permissoes, role, isManager, perfilCarregado, badges, recarregarPerfil } = useErpSession();
  const [maisAberto, setMaisAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);

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
  const { barra: itensBarra, mais: noMais } = itensDaNavegacao({ role, permissoes, carregado: perfilCarregado, isManager });
  /* Agrupamento do print 13. A regra e pura e mora em erp-routes.ts: a casca
     so desenha o que ela devolve. */
  const grupos = gruposDoMais(noMais);

  // Trocar de rota volta o scroll pro topo. Sem setState aqui: a folha "Mais"
  // e fechada no proprio clique do link, que e onde a intencao acontece.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  // Voltar do Android/gesto do iOS fecha a folha antes de sair da rota.
  useEffect(() => {
    if (!maisAberto) return;
    const fechar = () => setMaisAberto(false);
    window.addEventListener("popstate", fechar);
    return () => window.removeEventListener("popstate", fechar);
  }, [maisAberto]);

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
            <strong>{moduloAtual}</strong>
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
            <IconeModulo modulo={m} tamanho={22} />
            <span>{rotasModulo[m].rotuloCurto ?? m}</span>
            {(badges[m] ?? 0) > 0 && <i className="abn-badge" aria-hidden="true">{(badges[m] ?? 0) > 99 ? "99+" : badges[m]}</i>}
          </Link>
        ))}
        <button type="button" onClick={() => setMaisAberto((v) => !v)} aria-expanded={maisAberto} className={maisAberto ? "active" : ""}>
          <IconeModulo modulo="Mais" tamanho={22} />
          <span>Mais</span>
        </button>
      </nav>

      {perfilAberto && (
        <ProfilePanel
          email={profile?.email ?? ""}
          onClose={() => setPerfilAberto(false)}
          onSaved={() => { void recarregarPerfil(); }}
        />
      )}

      {/* Folha "Mais" — desenho do print 13.
          Grupos por classe (Rotina / Gestao / Ferramentas) + Conta no fim.
          O corretor comum ve duas secoes; o admin ve quatro. Grupo vazio nao
          renderiza, entao ninguem leva rotulo orfao na tela. */}
      {maisAberto && (
        <div className="app-mais-overlay" role="dialog" aria-modal="true" aria-label="Mais" onClick={() => setMaisAberto(false)}>
          <div className="app-mais-folha" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>Mais</strong>
              <button type="button" onClick={() => setMaisAberto(false)} aria-label="Fechar" />
            </header>

            {grupos.length === 0 && (
              <p className="app-mais-vazio">Nenhum outro módulo liberado para o seu acesso.</p>
            )}

            {grupos.map((grupo) => (
              <section key={grupo.titulo} className="app-mais-grupo">
                <h2>{grupo.titulo}</h2>
                <div>
                  {grupo.itens.map((m) => (
                    <ItemMais
                      key={m}
                      icone={m}
                      rotulo={rotasModulo[m].rotuloCurto ?? m}
                      href={pathDoModulo(m)}
                      onClick={() => setMaisAberto(false)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Conta. Nao sao modulos: nao tem rota nem permissao, e por isso
                nao passam por gruposDoMais(). Aparecem sempre -- toda sessao
                tem um perfil e toda sessao pode ser encerrada. */}
            <section className="app-mais-grupo">
              <h2>Conta</h2>
              <div>
                <ItemMais
                  icone="Perfil"
                  rotulo="Meu perfil"
                  onClick={() => { setMaisAberto(false); setPerfilAberto(true); }}
                />
                <ItemMais
                  icone="Sair"
                  rotulo="Sair"
                  className="sair"
                  onClick={() => { void sairDaConta(); }}
                />
              </div>
            </section>

            <ConviteInstalar />
          </div>
        </div>
      )}
    </AppShell>
  );
}
