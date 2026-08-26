"use client";

import { useState, type FormEvent } from "react";

type CondominiumWizardProps = {
  accessToken: string;
  onClose: () => void;
  onSaved: () => void;
};

const initialForm = { name: "", zipCode: "", address: "", number: "", complement: "", neighborhood: "", city: "São Paulo", state: "SP" };

export function CondominiumWizard({ accessToken, onClose, onSaved }: CondominiumWizardProps) {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function update(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/condominiums", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o condomínio.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o condomínio.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Cadastrar condomínio">
    <button className="modal-scrim" type="button" onClick={onClose} aria-label="Fechar cadastro" />
    <form className="capture-panel" onSubmit={submit}>
      <header className="capture-header"><div><span className="eyebrow">REFERÊNCIA DO PRÉDIO</span><h2>Cadastrar condomínio</h2><p>Condomínio é referência, não é imóvel à venda. As unidades continuarão com preço, fotos, proprietário e aprovação próprios.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="capture-body"><div className="form-section"><h3>Identificação e endereço</h3><div className="field-grid">
        <label>Nome do condomínio<input required value={form.name} onChange={(event) => update("name", event.target.value)} autoFocus /></label>
        <label>CEP<input value={form.zipCode} onChange={(event) => update("zipCode", event.target.value)} inputMode="numeric" /></label>
        <label>Endereço<input required value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
        <label>Número<input value={form.number} onChange={(event) => update("number", event.target.value)} /></label>
        <label>Complemento<input value={form.complement} onChange={(event) => update("complement", event.target.value)} /></label>
        <label>Bairro<input value={form.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} /></label>
        <label>Cidade<input required value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
        <label>UF<input required maxLength={2} value={form.state} onChange={(event) => update("state", event.target.value.toUpperCase())} /></label>
      </div><div className="unit-independent-note"><div><strong>Nenhuma unidade será criada automaticamente.</strong><span>Depois, o corretor poderá associar um apartamento a esta referência sem perder o controle do imóvel.</span></div></div>{message && <div className="detail-message" role="alert">{message}</div>}</div></div>
      <footer className="capture-footer"><button className="ghost-action" type="button" onClick={onClose}>Cancelar</button><button className="primary-action" disabled={busy} type="submit">{busy ? "Salvando..." : "Cadastrar condomínio"}</button></footer>
    </form>
  </div>;
}
