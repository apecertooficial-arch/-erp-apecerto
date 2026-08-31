"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { LeadFunil2 } from "./modelo";

type Formulario = { nome: string; telefone: string; email: string; cpfCnpj: string; endereco: string };

function formularioDoLead(lead: LeadFunil2): Formulario {
  return {
    nome: lead.nome ?? "",
    telefone: lead.telefone ?? "",
    email: lead.email ?? "",
    cpfCnpj: lead.cpf_cnpj ?? "",
    endereco: lead.endereco ?? "",
  };
}

export function LeadDataEditor({ accessToken, lead, onSaved, onDirtyChange }: {
  accessToken: string;
  lead: LeadFunil2;
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [referencia, setReferencia] = useState<Formulario>(() => formularioDoLead(lead));
  const [form, setForm] = useState<Formulario>(() => formularioDoLead(lead));
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(lead.versaoDados ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflito, setConflito] = useState<Formulario | null>(null);
  const [success, setSuccess] = useState("");
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(referencia), [form, referencia]);
  const valido = Boolean(form.nome.trim() && (form.telefone.trim() || form.email.trim()));

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const beforeunload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeunload);
    return () => window.removeEventListener("beforeunload", beforeunload);
  }, [dirty]);

  const alterar = (campo: keyof Formulario, valor: string) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setError(""); setSuccess(""); setConflito(null);
  };
  const cancelar = () => { setForm(referencia); setError(""); setSuccess(""); setConflito(null); };

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (busy || !dirty || !valido) return;
    if (!navigator.onLine) { setError("Sem conexão. Seus dados continuam no formulário e não foram enviados."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/funil2/clientes", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "atualizar", f2LeadId: lead.id, expectedUpdatedAt, ...form }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; lead?: { nome?: string; telefone?: string | null; email?: string | null; cpf_cnpj?: string | null; endereco?: string | null; atualizado_em?: string | null }; atual?: { nome?: string; telefone?: string | null; email?: string | null; cpf_cnpj?: string | null; endereco?: string | null } };
      if (!response.ok) {
        if (response.status === 409) {
          if (result.atual) setConflito({ nome: result.atual.nome ?? "", telefone: result.atual.telefone ?? "", email: result.atual.email ?? "", cpfCnpj: result.atual.cpf_cnpj ?? "", endereco: result.atual.endereco ?? "" });
          throw new Error(result.error || "Os dados mudaram em outra sessão. Recarregue e revise antes de salvar.");
        }
        if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente sem fechar esta ficha.");
        if (response.status === 403) throw new Error("Você não tem permissão para editar este cliente.");
        throw new Error(result.error || "Não foi possível salvar as alterações.");
      }
      const confirmado: Formulario = {
        nome: result.lead?.nome ?? form.nome.trim(),
        telefone: result.lead?.telefone ?? "",
        email: result.lead?.email ?? "",
        cpfCnpj: result.lead?.cpf_cnpj ?? "",
        endereco: result.lead?.endereco ?? "",
      };
      setReferencia(confirmado); setForm(confirmado);
      setExpectedUpdatedAt(result.lead?.atualizado_em ?? expectedUpdatedAt);
      setSuccess("Alterações salvas e confirmadas pelo servidor.");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar as alterações.");
    } finally { setBusy(false); }
  }

  return <form className="f2-ficha-bloco f2-dados-editor" aria-label="Editar dados do lead" onSubmit={(evento) => void salvar(evento)}>
    <header><div><h3>Dados do lead</h3><small>Campos permitidos são gravados na identidade canônica do cliente.</small></div></header>
    <div className="f2-ficha-dados-form">
      <label>Nome<input required maxLength={160} value={form.nome} onChange={(evento) => alterar("nome", evento.target.value)} /></label>
      <label>Telefone<input inputMode="tel" autoComplete="tel" maxLength={40} value={form.telefone} onChange={(evento) => alterar("telefone", evento.target.value)} placeholder="DDD + número" /></label>
      <label>E-mail<input type="email" autoComplete="email" maxLength={180} value={form.email} onChange={(evento) => alterar("email", evento.target.value)} /></label>
      <label>CPF/CNPJ<input inputMode="numeric" maxLength={18} value={form.cpfCnpj} onChange={(evento) => alterar("cpfCnpj", evento.target.value)} /></label>
      <label className="f2-dados-endereco">Endereço<input maxLength={300} value={form.endereco} onChange={(evento) => alterar("endereco", evento.target.value)} /></label>
      <label>Origem<input readOnly value={lead.origem_cadastro || "Sem dado cadastrado"} /></label>
      <label>Responsável<input readOnly value={lead.corretor_nome || "Não definido"} /></label>
      <label>Negócio de origem<input readOnly value={`#${lead.origem_negocio_id}`} /></label>
    </div>
    <p className="f2-ficha-dados-aviso">Telefone, e-mail e CPF/CNPJ são normalizados e verificados contra duplicidade antes da gravação.</p>
    {error && <p className="f2-modal-erro" role="alert">{error}</p>}
    {conflito && <div className="f2-dados-conflito" role="status"><strong>Valores atuais no servidor</strong><span>Nome: {conflito.nome || "—"}</span><span>Telefone: {conflito.telefone || "—"}</span><span>E-mail: {conflito.email || "—"}</span><button type="button" onClick={() => { setForm(conflito); setReferencia(conflito); setConflito(null); setError(""); }}>Usar valores atuais</button></div>}
    {success && <p className="f2-modal-sucesso" role="status">{success}</p>}
    <footer className="f2-dados-acoes">
      <button type="button" disabled={busy || !dirty} onClick={cancelar}>Cancelar</button>
      <button type="submit" className="f2-modal-primary" disabled={busy || !dirty || !valido}>{busy ? "Salvando…" : "Salvar alterações"}</button>
    </footer>
  </form>;
}
