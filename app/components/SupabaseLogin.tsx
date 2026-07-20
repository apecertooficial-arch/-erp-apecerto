"use client";

import { useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";

export function SupabaseLogin({ onAuthenticated, preview = false, onClose }: { onAuthenticated: (accessToken: string) => void; preview?: boolean; onClose?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setMessage("Não foi possível entrar. Confira o mesmo e-mail e senha usados no ERP.");
      setLoading(false);
      return;
    }

    setPassword("");
    onAuthenticated(data.session.access_token);
  }

  async function resetPassword() {
    if (!email) { setMessage("Digite seu e-mail para receber a recuperação de senha."); return; }
    setLoading(true); setMessage("");
    const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await getBrowserSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo: redirectBase });
    setMessage(error ? "Não foi possível solicitar a recuperação agora." : "Enviamos as instruções de recuperação para o seu e-mail.");
    setLoading(false);
  }

  return (
    <div className={`login-split ${preview ? "preview" : ""}`}>
      {onClose && <button className="login-close" type="button" onClick={onClose} aria-label="Fechar prévia do login">×</button>}

      <aside className="login-hero" aria-hidden="true">
        <span className="login-hero-shape circle" />
        <span className="login-hero-shape square" />
        <span className="login-hero-shape panel" />
        <div className="login-hero-inner">
          <div className="login-hero-icon">
            <svg viewBox="0 0 32 32"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg>
          </div>
          <span className="login-hero-kicker">O ERP DA APÊCERTO</span>
          <strong className="login-hero-logo">apê<span>certo</span></strong>
          <h1>Tudo num só lugar. Efata!</h1>
          <p>Seu CRM, disparos, chat ao vivo e financeiro num só lugar. Bem-vindo de volta. 🔑</p>
          <em className="login-hero-pill"><i /> Plataforma 2.0 · Moema — SP</em>
        </div>
      </aside>

      <section className="login-form-side" aria-labelledby="login-title">
        <div className="login-form-inner">
          <div className="login-brand-pill">
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg>
            <strong>apê<span>certo</span></strong>
          </div>

          <div className="login-heading">
            <h2 id="login-title">Bem-vindo de volta</h2>
            <p>Acesse o sistema operacional da <b>apêcerto</b>.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="login-field">
              <span>E-mail</span>
              <div className="login-input">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required placeholder="voce@apecerto.com" />
              </div>
            </label>

            <label className="login-field">
              <span>Senha</span>
              <div className="login-input">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Sua senha" />
                <button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword
                    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.4 5.2A9.4 9.4 0 0 1 12 5c5 0 9 4.5 9 7-.4 1-1.2 2.1-2.3 3.1M6.2 6.2C3.9 7.6 2.4 9.8 2 12c.6 1.6 4 7 10 7a9.6 9.6 0 0 0 3.3-.6" /></svg>
                    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7s-9-4.5-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>}
                </button>
              </div>
            </label>

            <button type="button" className="login-forgot" disabled={loading} onClick={() => void resetPassword()}>Esqueci minha senha</button>

            <button className="login-submit" disabled={loading} type="submit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 5-5.5" /></svg>
              {loading ? "Entrando..." : "Entrar no sistema"}
            </button>

            {message && <div className="login-error" role="alert">{message}</div>}

            <div className="login-secure">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
              <div><strong>Acesso seguro</strong><span>Entre com o mesmo e-mail e senha cadastrados no Supabase.</span></div>
            </div>
          </form>

          <footer className="login-foot"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg> <b>apê</b><b className="p">certo</b> · acesso restrito à equipe</footer>

          {preview && <mark className="login-preview-tag">Prévia visual — sua sessão atual continua ativa</mark>}
        </div>
      </section>
    </div>
  );
}
