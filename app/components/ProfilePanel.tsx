"use client";
/* Doc §15 — Perfil completo do corretor aberto pelo botão do rodapé da sidebar. */

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";

type ProfileBroker = { id: number; nome: string | null; email: string | null; telefone: string | null; creci: string | null; foto_path: string | null; ativo: boolean; online: boolean; notif_leads: boolean; notif_mensagens: boolean; notif_som: boolean };
type ProfileUser = { id: string; nome: string | null; role: string; ativo: boolean; email: string | null; telefone: string | null; superior_id: string | null; endereco_cep: string | null; endereco_logradouro: string | null; endereco_numero: string | null; endereco_complemento: string | null; endereco_bairro: string | null; endereco_cidade: string | null; endereco_uf: string | null };
type BankData = { titular_nome: string | null; titular_cpf: string | null; banco_nome: string | null; banco_codigo: string | null; agencia: string | null; conta: string | null; conta_tipo: string | null; pix_tipo: string | null; pix_chave: string | null };
type ProfileData = {
  usuario: ProfileUser | null;
  corretor: ProfileBroker | null;
  instancias: Array<{ id: number; nome: string | null; telefone: string | null; conectada: boolean; ativa: boolean }>;
  dados_bancarios: BankData | null;
};

const emptyBank: BankData = { titular_nome: "", titular_cpf: "", banco_nome: "", banco_codigo: "", agencia: "", conta: "", conta_tipo: null, pix_tipo: null, pix_chave: "" };
type Endereco = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string };
const emptyEndereco: Endereco = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

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
  const [endereco, setEndereco] = useState<Endereco>(emptyEndereco);
  const [bank, setBank] = useState<BankData>(emptyBank);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getBrowserSupabaseClient().rpc("meu_perfil").then(async ({ data: result, error: rpcError }) => {
      if (rpcError) { setError(rpcError.message); return; }
      const profile = result as ProfileData;
      setData(profile);
      setName(profile.corretor?.nome || profile.usuario?.nome || "");
      setPhone(profile.corretor?.telefone || profile.usuario?.telefone || "");
      setCreci(profile.corretor?.creci || "");
      setEndereco({ cep: profile.usuario?.endereco_cep || "", logradouro: profile.usuario?.endereco_logradouro || "", numero: profile.usuario?.endereco_numero || "", complemento: profile.usuario?.endereco_complemento || "", bairro: profile.usuario?.endereco_bairro || "", cidade: profile.usuario?.endereco_cidade || "", uf: profile.usuario?.endereco_uf || "" });
      if (profile.dados_bancarios) setBank({ ...emptyBank, ...profile.dados_bancarios });
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
      p_nome: name || undefined, p_telefone: phone || undefined, p_creci: creci,
      p_online: data?.corretor ? online : undefined,
      p_notif_leads: data?.corretor ? notifLeads : undefined,
      p_notif_mensagens: data?.corretor ? notifMessages : undefined,
      p_notif_som: data?.corretor ? notifSound : undefined,
      p_endereco_cep: endereco.cep || undefined, p_endereco_logradouro: endereco.logradouro || undefined,
      p_endereco_numero: endereco.numero || undefined, p_endereco_complemento: endereco.complemento || undefined,
      p_endereco_bairro: endereco.bairro || undefined, p_endereco_cidade: endereco.cidade || undefined,
      p_endereco_uf: (endereco.uf || "").toUpperCase().slice(0, 2) || undefined,
    });
    if (rpcError) { setError(rpcError.message); setSaving(false); return; }
    const hasBank = Object.values(bank).some((value) => value && String(value).trim());
    if (hasBank && data?.usuario?.id) {
      const { error: bankError } = await supabase.from("usuario_dados_bancarios").upsert({
        usuario_id: data.usuario.id,
        titular_nome: bank.titular_nome?.trim() || null, titular_cpf: bank.titular_cpf?.trim() || null,
        banco_nome: bank.banco_nome?.trim() || null, banco_codigo: bank.banco_codigo?.trim() || null,
        agencia: bank.agencia?.trim() || null, conta: bank.conta?.trim() || null,
        conta_tipo: bank.conta_tipo || null, pix_tipo: bank.pix_tipo || null, pix_chave: bank.pix_chave?.trim() || null,
      });
      if (bankError) { setError(`Perfil salvo, mas os dados bancários falharam: ${bankError.message}`); setSaving(false); return; }
    }
    setData(result as ProfileData);
    setMessage("Perfil salvo com sucesso.");
    setSaving(false);
    onSaved();
  }

  async function signOut() {
    await getBrowserSupabaseClient().auth.signOut();
    onClose();
  }

  const roleLabel = ({ admin: "Admin", diretor: "Diretor", gerente: "Gerente", executivo: "Executivo", gestor: "Gestor" } as Record<string, string>)[data?.usuario?.role ?? ""] ?? "Corretor";
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
          <h3>Endereço</h3>
          <div className="profile-grid">
            <label>CEP<input value={endereco.cep} onChange={(event) => setEndereco({ ...endereco, cep: event.target.value })} placeholder="00000-000" /></label>
            <label>Logradouro<input value={endereco.logradouro} onChange={(event) => setEndereco({ ...endereco, logradouro: event.target.value })} placeholder="Rua / Avenida" /></label>
            <label>Número<input value={endereco.numero} onChange={(event) => setEndereco({ ...endereco, numero: event.target.value })} placeholder="123" /></label>
            <label>Complemento<input value={endereco.complemento} onChange={(event) => setEndereco({ ...endereco, complemento: event.target.value })} placeholder="Apto / Bloco" /></label>
            <label>Bairro<input value={endereco.bairro} onChange={(event) => setEndereco({ ...endereco, bairro: event.target.value })} placeholder="Bairro" /></label>
            <label>Cidade<input value={endereco.cidade} onChange={(event) => setEndereco({ ...endereco, cidade: event.target.value })} placeholder="Cidade" /></label>
            <label>UF<input value={endereco.uf} onChange={(event) => setEndereco({ ...endereco, uf: event.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" maxLength={2} /></label>
          </div>
        </section>
        <section>
          <h3>Dados bancários (recebimento de comissão)</h3>
          <div className="profile-grid">
            <label>Nome do titular<input value={bank.titular_nome ?? ""} onChange={(event) => setBank({ ...bank, titular_nome: event.target.value })} placeholder="Como está no banco" /></label>
            <label>CPF/CNPJ do titular<input value={bank.titular_cpf ?? ""} onChange={(event) => setBank({ ...bank, titular_cpf: event.target.value })} placeholder="000.000.000-00" /></label>
            <label>Banco<input value={bank.banco_nome ?? ""} onChange={(event) => setBank({ ...bank, banco_nome: event.target.value })} placeholder="Ex.: Nubank, Itaú" /></label>
            <label>Código do banco<input value={bank.banco_codigo ?? ""} onChange={(event) => setBank({ ...bank, banco_codigo: event.target.value })} placeholder="Ex.: 260" /></label>
            <label>Agência<input value={bank.agencia ?? ""} onChange={(event) => setBank({ ...bank, agencia: event.target.value })} placeholder="0001" /></label>
            <label>Conta (com dígito)<input value={bank.conta ?? ""} onChange={(event) => setBank({ ...bank, conta: event.target.value })} placeholder="12345-6" /></label>
            <label>Tipo de conta<select value={bank.conta_tipo ?? ""} onChange={(event) => setBank({ ...bank, conta_tipo: event.target.value || null })}><option value="">Selecione…</option><option value="corrente">Corrente</option><option value="poupanca">Poupança</option><option value="pagamento">Pagamento</option></select></label>
            <label>Tipo de chave PIX<select value={bank.pix_tipo ?? ""} onChange={(event) => setBank({ ...bank, pix_tipo: event.target.value || null })}><option value="">Selecione…</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Chave aleatória</option></select></label>
            <label>Chave PIX<input value={bank.pix_chave ?? ""} onChange={(event) => setBank({ ...bank, pix_chave: event.target.value })} placeholder="Sua chave PIX" /></label>
          </div>
          <p className="profile-hint">Visível apenas para você e para a administração/financeiro — usado no pagamento de comissões.</p>
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
