"use client";

import { useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";

export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 6) { setMessage("A nova senha precisa de pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setMessage("As senhas não conferem."); return; }
    setLoading(true);
    const { error } = await getBrowserSupabaseClient().auth.updateUser({ password });
    setLoading(false);
    if (error) { setMessage(error.message || "Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo."); return; }
    setPassword(""); setConfirm("");
    setDone(true);
    setMessage("Senha redefinida com sucesso.");
  }

  return (
    <div className="auth-layer">
      <section className="auth-card auth-card-v2" aria-labelledby="reset-title">
        <div className="auth-brand"><span><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14 16 5l12 9v13H7V15" /><path d="m11 15 4 4 7-8" /></svg></span><strong>apê<span>certo</span></strong></div>
        <div className="auth-welcome"><span>REDEFINIR SENHA</span><h2 id="reset-title">Criar nova senha</h2><p>Escolha uma nova senha para acessar o ERP.</p></div>
        {done ? (
          <>
            <div className="auth-error" role="status" style={{ background: "#e6f7ed", color: "#14854a", borderColor: "#bde7cb" }}>{message}</div>
            <button className="primary-action" type="button" onClick={onDone}>Entrar no ERP</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>Nova senha<div className="auth-password"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required placeholder="Mínimo 6 caracteres" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Ocultar" : "Mostrar"}</button></div></label>
            <label>Confirmar nova senha<input type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required placeholder="Repita a senha" /></label>
            {message && <div className="auth-error" role="alert">{message}</div>}
            <button className="primary-action" disabled={loading} type="submit">{loading ? "Salvando..." : "Redefinir senha"}</button>
          </form>
        )}
        <small>🔒 Autenticação protegida pelo Supabase.</small>
      </section>
    </div>
  );
}
