"use client";
/* Doc §15 — Perfil completo do corretor aberto pelo botão do rodapé da sidebar. */

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";

type ProfileBroker = { id: number; nome: string | null; email: string | null; telefone: string | null; creci: string | null; foto_path: string | null; ativo: boolean; online: boolean; notif_leads: boolean; notif_mensagens: boolean; notif_som: boolean };
type ProfileData = {
  usuario: { id: string; nome: string | null; role: string; ativo: boolean } | null;
  corretor: ProfileBroker | null;
  instancias: Array<{ id: number; nome: string | null; telefone: string | null; conectada: boolean; ativa: boolean }>;
};

export function ProfilePanel({ email, onClose, onPreviewLogin, onSaved }: { email: string; onClose: () => void; onPreviewLogin: () => void; onSaved: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creci, setCreci] = useState("");
  const [online, setOnline] = useState(false);
  const [notifLeads, setNotifLeads] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getBrowserSupabaseClient().rpc("meu_perfil").then(async ({ data: result, error: rpcError }) => {
      if (rpcError) { setError(rpcError.message); return; }
      const profile = result as ProfileData;
      setData(profile);
      setName(profile.corretor?.nome || profile.usuario?.nome || "");
      setPhone(profile.corretor?.telefone || "");
      setCreci(profile.corretor?.creci || "");
      setOnline(profile.corretor?.online ?? false);
      setNotifLeads(profile.corretor?.notif_leads ?? true);
      setNotifMessages(profile.corretor?.notif_mensagens ?? true);
      setNotifSound(profile.corretor?.notif_som ?? true);
      if (profile.corretor?.foto_path) {
        const { data: signed } = await getBrowserSupabaseClient().storage.from("corretor-docs").createSignedUrl(profile.corretor.foto_path, 3600);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }
    });
  }, []);

  async function uploadPhoto(file?: File) {
    if (!file || !data) return;
    setSaving(true); setError(""); setMessage("");
    const supabase = getBrowserSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const path = `avatares/${userData.user?.id ?? "anon"}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("corretor-docs").upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
    if (uploadError) { setError(uploadError.message); setSaving(false); return; }
    const { error: rpcError } = await supabase.rpc("atualizar_meu_perfil", { p_foto_path: path });
    if (rpcError) { setError(rpcError.message); setSaving(false); return; }
    const { data: signed } = await supabase.storage.from("corretor-docs").createSignedUrl(path, 3600);
    if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
    setMessage("Foto atualizada."); setSaving(false);
  }

  async function save() {
    setSaving(true); setError(""); setMessage("");
    const supabase = getBrowserSupabaseClient();
    if (password || passwordConfirm) {
      if (password.length < 6) { setError("A nova senha precisa de pelo menos 6 caracteres."); setSaving(false); return; }
      if (password !== passwordConfirm) { setError("As senhas não conferem."); setSaving(false); return; }
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) { setError(passwordError.message); setSaving(false); return; }
      setPassword(""); setPasswordConfirm("");
    }
    const { data: result, error: rpcError } = await supabase.rpc("atualizar_meu_perfil", {
      p_nome: name || null, p_telefone: phone || null, p_creci: creci,
      p_online: data?.corretor ? online : null,
      p_notif_leads: data?.corretor ? notifLeads : null,
      p_notif_mensagens: data?.corretor ? notifMessages : null,
      p_notif_som: data?.corretor ? notifSound : null,
    });
    if (rpcError) { setError(rpcError.message); setSaving(false); return; }
    setData(result as ProfileData);
    setMessage("Perfil salvo com sucesso.");
    setSaving(false);
    onSaved();
  }

  async function signOut() {
    await getBrowserSupabaseClient().auth.signOut();
    onClose();
  }

  const roleLabel = data?.usuario?.role === "admin" ? "Admin" : data?.usuario?.role === "gestor" ? "Gestor" : "Corretor";
  const initial = (name || email || "C").trim().slice(0, 1).toUpperCase();

  return <div className="profile-drawer-scrim" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="profile-drawer" aria-label="Meu perfil">
      <header>
        <div className="profile-hero">
          <button className="profile-avatar" type="button" onClick={() => photoInput.current?.click()} title="Trocar foto">
            {avatarUrl ? <img src={avatarUrl} alt="Foto do perfil" /> : <span>{initial}</span>}
            <i>✎</i>
          </button>
          <input ref={photoInput} hidden type="file" accept="image/*" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
          <div><small>MEU PERFIL</small><h2>{name || "—"}</h2><p>{roleLabel} · {email}</p></div>
        </div>
        <button className="profile-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      {error && <div className="profile-note error">{error}</div>}
      {message && <div className="profile-note ok">{message}</div>}
      {!data && !error && <div className="profile-loading">Carregando seu perfil…</div>}
      {data && <main>
        <section>
          <h3>Dados pessoais</h3>
          <div className="profile-grid">
            <label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" /></label>
            <label>Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 90000-0000" /></label>
            <label>CRECI<input value={creci} onChange={(event) => setCreci(event.target.value)} placeholder="CRECI-SP 000000" /></label>
            <label>E-mail de acesso<input value={email} disabled /></label>
          </div>
        </section>
        <section>
          <h3>Segurança</h3>
          <div className="profile-grid">
            <label>Nova senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" /></label>
            <label>Confirmar nova senha<input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></label>
          </div>
          <p className="profile-hint">Deixe em branco para manter a senha atual.</p>
        </section>
        {data.corretor && <section>
          <h3>Disponibilidade</h3>
          <label className="profile-toggle"><input type="checkbox" checked={online} onChange={(event) => setOnline(event.target.checked)} /><div><strong>Disponível para receber leads</strong><small>A roleta só distribui para você quando está online e dentro do horário do escritório.</small></div></label>
        </section>}
        {data.corretor && <section>
          <h3>Notificações</h3>
          <label className="profile-toggle"><input type="checkbox" checked={notifLeads} onChange={(event) => setNotifLeads(event.target.checked)} /><div><strong>Novos leads e leads aguardando</strong><small>Alertas da Central de atenção sobre leads.</small></div></label>
          <label className="profile-toggle"><input type="checkbox" checked={notifMessages} onChange={(event) => setNotifMessages(event.target.checked)} /><div><strong>Novas mensagens de clientes</strong><small>Avisos de mensagens recebidas no WhatsApp.</small></div></label>
          <label className="profile-toggle"><input type="checkbox" checked={notifSound} onChange={(event) => setNotifSound(event.target.checked)} /><div><strong>Som de alerta</strong><small>Tocar som quando um alerta novo chegar.</small></div></label>
        </section>}
        {data.corretor && <section>
          <h3>Minhas instâncias de WhatsApp</h3>
          {data.instancias.length === 0 && <p className="profile-hint">Nenhuma instância vinculada ao seu usuário. Fale com a administração.</p>}
          <div className="profile-instances">{data.instancias.map((instance) => <span className={instance.conectada ? "connected" : ""} key={instance.id}><i>{instance.conectada ? "●" : "○"}</i>{instance.nome || instance.telefone || `Instância ${instance.id}`}<small>{instance.conectada ? "Conectada" : "Desconectada"}</small></span>)}</div>
          <p className="profile-hint">Para reconectar pelo QR, use Configurações → Conexões.</p>
        </section>}
      </main>}
      <footer>
        <button className="profile-logout" type="button" onClick={() => void signOut()}>⎋ Sair da conta</button>
        <div>
          <button className="profile-preview" type="button" onClick={onPreviewLogin}>Prévia da tela de login</button>
          <button className="profile-save" type="button" disabled={saving || !data} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar alterações"}</button>
        </div>
      </footer>
    </aside>
  </div>;
}
