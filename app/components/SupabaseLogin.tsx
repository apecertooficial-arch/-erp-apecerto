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
    const { error } = await getBrowserSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMessage(error ? "Não foi possível solicitar a recuperação agora." : "Enviamos as instruções de recuperação para o seu e-mail.");
    setLoading(false);
  }

  return (
    <div className={`auth-layer ${preview ? "preview" : ""}`}>
      <section className="auth-card auth-card-v2" aria-labelledby="auth-title">
        {onClose && <button className="auth-close" type="button" onClick={onClose} aria-label="Fechar prévia do login">×</button>}
        <div className="auth-brand"><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg></span><strong>apê<span>certo</span></strong></div>
        <div className="auth-welcome"><span>PORTAL DO CORRETOR</span><h2 id="auth-title">Bem-vindo de volta</h2><p>Acesse seus leads, conversas, agenda e produtos em um só lugar.</p></div>
        <div className="auth-benefits"><span>◉ Leads em tempo real</span><span>◇ Agenda comercial</span><span>▤ Catálogo completo</span></div>
        <form onSubmit={handleSubmit}>
          <label>E-mail corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required placeholder="corretor@apecerto.com" /></label>
          <label>Senha<div className="auth-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Sua senha" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar" : "Mostrar"}</button></div></label>
          {message && <div className="auth-error" role="alert">{message}</div>}
          <div className="auth-form-actions"><label><input type="checkbox" /> Manter conectado</label><button type="button" disabled={loading} onClick={() => void resetPassword()}>Esqueci minha senha</button></div>
          <button className="primary-action" disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar no ERP"}</button>
        </form>
        <small>🔒 Autenticação protegida pelo Supabase. Sua senha não é armazenada no ERP.</small>
        {preview && <mark>Prévia visual — sua sessão atual continua ativa</mark>}
      </section>
    </div>
  );
}
