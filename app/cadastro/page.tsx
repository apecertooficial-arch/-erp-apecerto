"use client";
/* Autocadastro por link de convite — /cadastro?t=<token>.
   O gestor gera o link em Usuários; o corretor preenche os próprios dados
   (nome, telefone, e-mail e senha) e já sai com acesso criado.
   Toda a validação e criação roda na edge function cadastro-publico. */

/* eslint-disable react-hooks/set-state-in-effect -- validação inicial do token, mesmo padrão de /definir-senha */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";

type Estado = "carregando" | "valido" | "invalido" | "usado" | "expirado" | "erro" | "pronto";

const MOTIVO_TEXTO: Record<string, string> = {
  invalido: "Este link de cadastro não é válido. Peça um novo para o time da ApêCerto.",
  usado: "Este link já foi usado por outro cadastro. Peça um novo para o time da ApêCerto.",
  expirado: "Este link expirou. Peça um novo para o time da ApêCerto.",
  erro: "Não foi possível abrir o link agora. Tente novamente em instantes.",
  nome_invalido: "Informe seu nome completo.",
  email_invalido: "Confira o e-mail digitado — ele não parece válido.",
  senha_curta: "A senha precisa ter pelo menos 8 caracteres.",
  email_ja_cadastrado: "Este e-mail já tem cadastro no ERP. Fale com o time da ApêCerto para recuperar o acesso.",
};

export default function CadastroPage() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [token, setToken] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function invoke(action: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await getBrowserSupabaseClient().functions.invoke("cadastro-publico", { body: { action, token: extra.token ?? token, ...extra } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try { return await ctx.json() as { ok: boolean; motivo?: string }; } catch { /* cai no throw */ }
      }
      throw error;
    }
    return data as { ok: boolean; motivo?: string };
  }

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    if (!t) { setEstado("invalido"); return; }
    setToken(t);
    void (async () => {
      try {
        const r = await invoke("validar", { token: t });
        if (r.ok) setEstado("valido");
        else setEstado((r.motivo as Estado) || "invalido");
      } catch { setEstado("erro"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar() {
    setAviso("");
    if (nome.trim().length < 2) { setAviso("Informe seu nome completo."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setAviso("Confira o e-mail digitado."); return; }
    if (senha.length < 8) { setAviso("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirma) { setAviso("As duas senhas não são iguais."); return; }
    setSalvando(true);
    try {
      const r = await invoke("registrar", { nome: nome.trim(), email: email.trim().toLowerCase(), telefone: telefone.trim() || null, senha });
      if (r.ok) setEstado("pronto");
      else if (r.motivo === "usado" || r.motivo === "expirado" || r.motivo === "invalido") setEstado(r.motivo);
      else setAviso(MOTIVO_TEXTO[r.motivo || "erro"] || "Não foi possível concluir o cadastro. Tente novamente.");
    } catch { setAviso("Não foi possível concluir o cadastro agora. Tente novamente."); }
    finally { setSalvando(false); }
  }

  return (
    <div className="auth-layer">
      <section className="auth-card auth-card-v2" aria-labelledby="cad-title">
        <div className="auth-brand"><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg></span><strong>apê<span>certo</span></strong></div>

        {estado === "carregando" && <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="cad-title">Abrindo seu cadastro…</h2><p>Um instante enquanto validamos o seu link.</p></div>}

        {(estado === "invalido" || estado === "usado" || estado === "expirado" || estado === "erro") && (
          <>
            <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="cad-title">Link indisponível</h2><p>{MOTIVO_TEXTO[estado]}</p></div>
            <Link className="primary-action" href="/" style={{ textAlign: "center", textDecoration: "none" }}>Ir para o login</Link>
          </>
        )}

        {estado === "valido" && (
          <>
            <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="cad-title">Crie seu acesso</h2><p>Preencha seus dados para entrar no ERP da ApêCerto.</p></div>
            <form onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
              <label>Nome completo<div className="auth-password"><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Seu nome e sobrenome" required /></div></label>
              <label>Telefone / WhatsApp<div className="auth-password"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="(11) 90000-0000" /></div></label>
              <label>E-mail<div className="auth-password"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" required /></div></label>
              <label>Senha<div className="auth-password"><input type={mostrar ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" required /><button type="button" onClick={() => setMostrar(!mostrar)}>{mostrar ? "Ocultar" : "Mostrar"}</button></div></label>
              <label>Confirmar senha<div className="auth-password"><input type={mostrar ? "text" : "password"} value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" placeholder="Repita a senha" required /></div></label>
              {aviso && <div className="auth-error" role="alert">{aviso}</div>}
              <button className="primary-action" disabled={salvando} type="submit">{salvando ? "Criando acesso…" : "Criar meu acesso"}</button>
            </form>
            <small>🔒 Autenticação protegida pelo Supabase. Sua senha fica só com você.</small>
          </>
        )}

        {estado === "pronto" && (
          <>
            <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="cad-title">Cadastro concluído! ✅</h2><p>Pronto, {nome.trim() || "corretor"}. Agora é só entrar no ERP com o seu e-mail e a senha que você acabou de criar.</p></div>
            <Link className="primary-action" href="/" style={{ textAlign: "center", textDecoration: "none" }}>Ir para o login</Link>
          </>
        )}
      </section>
    </div>
  );
}
