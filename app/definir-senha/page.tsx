"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";

type Estado = "carregando" | "valido" | "invalido" | "usado" | "expirado" | "erro" | "pronto";

const MOTIVO_TEXTO: Record<string, string> = {
  invalido: "Este link de acesso não é válido. Peça um novo para o time da ApêCerto.",
  usado: "Este link já foi usado para criar a senha. Se precisar trocar de novo, peça um novo link.",
  expirado: "Este link expirou. Peça um novo para o time da ApêCerto.",
  erro: "Não foi possível abrir o link agora. Tente novamente em instantes.",
};

export default function DefinirSenhaPage() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [nome, setNome] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function invoke(action: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await getBrowserSupabaseClient().functions.invoke("definir-senha", { body: { action, token: extra.token ?? token, ...extra } });
    if (error) throw error;
    return data as { ok: boolean; motivo?: string; nome?: string };
  }

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    if (!t) { setEstado("invalido"); return; }
    setToken(t);
    void (async () => {
      try {
        const r = await invoke("validar", { token: t });
        if (r.ok) { setNome(r.nome ?? null); setEstado("valido"); }
        else setEstado((r.motivo as Estado) || "invalido");
      } catch { setEstado("erro"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    setAviso("");
    if (senha.length < 8) { setAviso("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirma) { setAviso("As duas senhas não são iguais."); return; }
    setSalvando(true);
    try {
      const r = await invoke("definir", { senha });
      if (r.ok) { setNome(r.nome ?? nome); setEstado("pronto"); }
      else { setAviso(MOTIVO_TEXTO[r.motivo || "erro"] || "Não foi possível salvar a senha."); }
    } catch { setAviso("Não foi possível salvar a senha agora. Tente novamente."); }
    finally { setSalvando(false); }
  }

  return (
    <div className="auth-layer">
      <section className="auth-card auth-card-v2" aria-labelledby="ds-title">
        <div className="auth-brand"><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg></span><strong>apê<span>certo</span></strong></div>

        {estado === "carregando" && <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="ds-title">Abrindo seu acesso…</h2><p>Um instante enquanto validamos o seu link.</p></div>}

        {(estado === "invalido" || estado === "usado" || estado === "expirado" || estado === "erro") && (
          <>
            <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="ds-title">Link indisponível</h2><p>{MOTIVO_TEXTO[estado]}</p></div>
            <a className="primary-action" href="/" style={{ textAlign: "center", textDecoration: "none" }}>Ir para o login</a>
          </>
        )}

        {estado === "valido" && (
          <>
            <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="ds-title">{nome ? `Olá, ${nome}!` : "Crie sua senha"}</h2><p>Defina a senha que você vai usar para entrar no ERP da ApêCerto.</p></div>
            <form onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
              <label>Nova senha<div className="auth-password"><input type={mostrar ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" required /><button type="button" onClick={() => setMostrar(!mostrar)}>{mostrar ? "Ocultar" : "Mostrar"}</button></div></label>
              <label>Confirmar senha<div className="auth-password"><input type={mostrar ? "text" : "password"} value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" placeholder="Repita a senha" required /></div></label>
              {aviso && <div className="auth-error" role="alert">{aviso}</div>}
              <button className="primary-action" disabled={salvando} type="submit">{salvando ? "Salvando…" : "Salvar senha e entrar"}</button>
            </form>
            <small>🔒 Autenticação protegida pelo Supabase. Sua senha fica só com você.</small>
          </>
        )}

        {estado === "pronto" && (
          <>
            <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="ds-title">Senha criada! ✅</h2><p>{nome ? `Pronto, ${nome}. ` : ""}Agora é só entrar no ERP com o seu e-mail e a senha que você acabou de criar.</p></div>
            <a className="primary-action" href="/" style={{ textAlign: "center", textDecoration: "none" }}>Ir para o login</a>
          </>
        )}
      </section>
    </div>
  );
}
