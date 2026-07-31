"use client";

/* Sessao unica do ERP.
 *
 * Antes, todo o bootstrap de autenticacao vivia dentro de ProductCatalog. Como
 * o ERP inteiro era uma rota so, isso funcionava por acidente: o componente
 * nunca desmontava.
 *
 * Com URL por modulo, cada troca de rota desmontaria o componente e refaria
 * login. Por isso o bootstrap sobe para um Provider montado no layout do grupo
 * (erp) -- layouts do App Router persistem entre rotas irmas, entao a sessao
 * carrega UMA vez.
 *
 * Este arquivo NAO fala com Supabase alem do que ProductCatalog ja fazia:
 * getSession, refreshSession e onAuthStateChange. Nenhuma regra nova de
 * autenticacao, nenhum token em log.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { SupabaseLogin } from "../../components/SupabaseLogin";
import { ResetPassword } from "../../components/ResetPassword";

export type SessionProfile = {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "gestor" | "corretor";
  perfil?: string | null;
  active: boolean;
  brokerId: number | null;
  online: boolean;
  permissoes?: Record<string, string[]> | null;
};

/* Mesmo conjunto que ProductCatalog usava. Papel de gestao nao vem de slug de
   permissao, vem do perfil real -- por isso fica separado. */
export const MANAGER_ROLES = new Set(["admin", "executivo", "diretor", "gerente", "gestor_comercial", "gestor_equipe"]);

export type EstadoDados = "loading" | "live" | "auth" | "error";

export type ErpSessionValue = {
  accessToken: string | null;
  profile: SessionProfile | null;
  /** true depois que /api/session respondeu (com sucesso OU erro).
      Distingue "ainda carregando" de "carregou e veio vazio" -- o menu depende disso. */
  perfilCarregado: boolean;
  estado: EstadoDados;
  role: "admin" | "gestor" | "corretor";
  isManager: boolean;
  permissoes: Record<string, string[]> | null;
  /** Badges numericos que os modulos publicam para a navegacao (ex.: Produtos pendentes). */
  badges: Record<string, number>;
  publicarBadge: (chave: string, valor: number) => void;
  recarregarPerfil: () => Promise<void>;
};

/* Exportado para permitir teste de renderizacao do shell sem subir Supabase.
   Producao continua usando o Provider abaixo; ninguem monta o Ctx na mao. */
export const ErpSessionCtx = createContext<ErpSessionValue | null>(null);
const Ctx = ErpSessionCtx;

export function useErpSession(): ErpSessionValue {
  const valor = useContext(Ctx);
  if (!valor) throw new Error("useErpSession precisa estar dentro de <ErpSessionProvider>.");
  return valor;
}

export function ErpSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [estado, setEstado] = useState<EstadoDados>("loading");
  /* Recovery e lido do hash UMA vez, na inicializacao preguicosa do estado.
     Fazer isso dentro do efeito disparava render em cascata (react-hooks/set-state-in-effect). */
  const [recoveryMode, setRecoveryMode] = useState(
    () => typeof window !== "undefined" && window.location.hash.includes("type=recovery"),
  );
  const [badges, setBadges] = useState<Record<string, number>>({});

  const publicarBadge = useCallback((chave: string, valor: number) => {
    setBadges((atual) => (atual[chave] === valor ? atual : { ...atual, [chave]: valor }));
  }, []);

  const carregarPerfil = useCallback(async (token: string) => {
    try {
      const resposta = await fetch("/api/session", { headers: { Authorization: `Bearer ${token}` } });
      if (!resposta.ok) throw new Error("perfil indisponivel");
      setProfile(await resposta.json() as SessionProfile);
      setEstado("live");
    } catch {
      // Perfil indisponivel nao derruba a sessao, mas TAMBEM nao libera menu:
      // perfilCarregado vira true com permissoes nulas => podeVer() fecha.
      setProfile(null);
      setEstado("error");
    } finally {
      setPerfilCarregado(true);
    }
  }, []);

  const recarregarPerfil = useCallback(async () => {
    if (accessToken) await carregarPerfil(accessToken);
  }, [accessToken, carregarPerfil]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let ativo = true;

    const ehRecovery = typeof window !== "undefined" && window.location.hash.includes("type=recovery");

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo || ehRecovery) return;
      if (!data.session) {
        setEstado("auth");
        setPerfilCarregado(true);
        return;
      }
      const expiraLogo = Number(data.session.expires_at || 0) * 1000 <= Date.now() + 60_000;
      if (expiraLogo) {
        const renovada = await supabase.auth.refreshSession();
        if (!ativo) return;
        if (renovada.data.session) {
          setAccessToken(renovada.data.session.access_token);
          await carregarPerfil(renovada.data.session.access_token);
          return;
        }
      }
      setAccessToken(data.session.access_token);
      await carregarPerfil(data.session.access_token);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY") { setRecoveryMode(true); return; }
      if (sessao) {
        setAccessToken(sessao.access_token);
        setEstado((atual) => (atual === "auth" ? "loading" : atual));
      } else {
        setAccessToken(null);
        setProfile(null);
        setPerfilCarregado(true);
        setEstado("auth");
      }
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  const valor = useMemo<ErpSessionValue>(() => ({
    accessToken,
    profile,
    perfilCarregado,
    estado,
    role: profile?.role ?? "corretor",
    isManager: MANAGER_ROLES.has(profile?.perfil ?? ""),
    permissoes: profile?.permissoes ?? null,
    badges,
    publicarBadge,
    recarregarPerfil,
  }), [accessToken, profile, perfilCarregado, estado, badges, publicarBadge, recarregarPerfil]);

  if (recoveryMode) {
    return (
      <div className="login-page">
        <ResetPassword onDone={() => {
          setRecoveryMode(false);
          void (async () => {
            const { data } = await getBrowserSupabaseClient().auth.getSession();
            if (data.session) {
              setAccessToken(data.session.access_token);
              await carregarPerfil(data.session.access_token);
            } else {
              setEstado("auth");
              setPerfilCarregado(true);
            }
          })();
        }} />
      </div>
    );
  }

  if (estado === "auth" && !accessToken) {
    return (
      <div className="login-page">
        <SupabaseLogin onAuthenticated={(token) => {
          setAccessToken(token);
          void carregarPerfil(token);
        }} />
      </div>
    );
  }

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
