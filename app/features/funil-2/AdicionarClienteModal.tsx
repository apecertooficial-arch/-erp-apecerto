"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

type CorretorPermitido = { corretor_id: number; nome: string; is_self: boolean };
type Duplicado = { id: number; nome: string; telefone: string | null; email: string | null; funilLeadId?: string | null };

const esperar = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function AdicionarClienteModal({ accessToken, onClose, onCreated }: {
  accessToken: string;
  onClose: () => void;
  onCreated: (funilLeadId: string) => void;
}) {
  const tituloId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const origemRef = useRef<HTMLElement | null>(null);
  const ativoRef = useRef(true);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", cpfCnpj: "", endereco: "", corretorId: "" });
  const [corretores, setCorretores] = useState<CorretorPermitido[]>([]);
  const [podeEscolher, setPodeEscolher] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [buscandoDuplicidade, setBuscandoDuplicidade] = useState(false);
  const [duplicado, setDuplicado] = useState<Duplicado | null>(null);
  const [busy, setBusy] = useState(false);
  const [conciliando, setConciliando] = useState(false);
  const [leadPendenteId, setLeadPendenteId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    ativoRef.current = true;
    origemRef.current = document.activeElement as HTMLElement | null;
    const quadro = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("input")?.focus());
    return () => { ativoRef.current = false; cancelAnimationFrame(quadro); requestAnimationFrame(() => origemRef.current?.focus()); };
  }, []);

  useEffect(() => {
    const onKey = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !busy && !conciliando) { evento.preventDefault(); onClose(); return; }
      if (evento.key !== "Tab") return;
      const focaveis = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]') ?? []);
      if (!focaveis.length) return;
      const primeiro = focaveis[0]; const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, conciliando, onClose]);

  useEffect(() => {
    const controle = new AbortController();
    void fetch("/api/funil2/clientes?modo=opcoes", { headers: { Authorization: `Bearer ${accessToken}` }, signal: controle.signal })
      .then(async (response) => ({ response, json: await response.json().catch(() => ({})) as { error?: string; corretores?: CorretorPermitido[]; corretorProprioId?: number | null; podeEscolher?: boolean } }))
      .then(({ response, json }) => {
        if (!response.ok) throw new Error(json.error || "Não foi possível preparar o cadastro.");
        const lista = json.corretores ?? [];
        setCorretores(lista); setPodeEscolher(json.podeEscolher === true);
        const inicial = json.corretorProprioId ?? lista.find((item) => item.is_self)?.corretor_id ?? lista[0]?.corretor_id;
        setForm((atual) => ({ ...atual, corretorId: inicial ? String(inicial) : "" }));
      })
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Não foi possível preparar o cadastro."); })
      .finally(() => setCarregando(false));
    return () => controle.abort();
  }, [accessToken]);

  const alterar = (campo: keyof typeof form, valor: string) => { setForm((atual) => ({ ...atual, [campo]: valor })); setDuplicado(null); setError(""); };

  async function verificarDuplicidade(): Promise<{ ok: boolean; lead: Duplicado | null }> {
    if ((!form.telefone.trim() && !form.email.trim() && !form.cpfCnpj.trim()) || buscandoDuplicidade) return { ok: true, lead: null };
    setBuscandoDuplicidade(true); setError("");
    try {
      const params = new URLSearchParams({ modo: "duplicidade", telefone: form.telefone, email: form.email, cpfCnpj: form.cpfCnpj });
      const response = await fetch(`/api/funil2/clientes?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json().catch(() => ({})) as { error?: string; duplicado?: boolean; lead?: Omit<Duplicado, "funilLeadId">; funilLeadId?: string | null };
      if (!response.ok) throw new Error(result.error || "Não foi possível verificar duplicidade.");
      const encontrado = result.duplicado && result.lead ? { ...result.lead, funilLeadId: result.funilLeadId } : null;
      setDuplicado(encontrado);
      return { ok: true, lead: encontrado };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível verificar duplicidade.");
      return { ok: false, lead: null };
    } finally { setBuscandoDuplicidade(false); }
  }

  async function aguardarCard(leadId: number) {
    setLeadPendenteId(leadId);
    setConciliando(true);
    for (let tentativa = 0; tentativa < 35 && ativoRef.current; tentativa += 1) {
      if (tentativa > 0) await esperar(2_000);
      const response = await fetch(`/api/funil2/clientes?modo=reconciliar&leadId=${leadId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json().catch(() => ({})) as { error?: string; conciliado?: boolean; funilLeadId?: string | null };
      if (!response.ok) throw new Error(result.error || "Não foi possível confirmar a entrada no Funil.");
      if (result.conciliado && result.funilLeadId) { setLeadPendenteId(null); onCreated(result.funilLeadId); return; }
    }
    throw new Error("Cliente salvo. A entrada no Funil ainda está sendo conciliada; use “Verificar entrada” para confirmar antes de cadastrar novamente.");
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (busy || conciliando) return;
    if (!navigator.onLine) { setError("Sem conexão. O cadastro não foi enviado."); return; }
    if (!form.nome.trim() || (!form.telefone.trim() && !form.email.trim())) { setError("Informe o nome e pelo menos telefone ou e-mail."); return; }
    const verificacao = await verificarDuplicidade();
    if (!verificacao.ok || verificacao.lead) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/funil2/clientes", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "criar", idempotencyKey, ...form, corretorId: Number(form.corretorId) }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; leadId?: number; funilLeadId?: string | null; duplicado?: Omit<Duplicado, "funilLeadId"> };
      if (response.status === 409 && result.duplicado) { setDuplicado({ ...result.duplicado, funilLeadId: result.funilLeadId }); return; }
      if (!response.ok && response.status !== 202) throw new Error(result.error || "Não foi possível adicionar o cliente.");
      if (result.funilLeadId) { onCreated(result.funilLeadId); return; }
      if (!result.leadId) throw new Error("O servidor não confirmou a identidade criada.");
      await aguardarCard(result.leadId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível adicionar o cliente.");
    } finally { setBusy(false); setConciliando(false); }
  }

  return <div className="f2-modal-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget && !busy && !conciliando) onClose(); }}>
    <div ref={dialogRef} className="f2-modal f2-modal-cliente" role="dialog" aria-modal="true" aria-label="Adicionar cliente" aria-labelledby={tituloId}>
      <header><div><span className="f2-eyebrow">FUNIL</span><h2 id={tituloId}>Adicionar cliente</h2><p>Cadastre uma pessoa que ainda não existe. Nenhuma mensagem será enviada.</p></div><button type="button" disabled={busy || conciliando} onClick={onClose} aria-label="Fechar Adicionar cliente">×</button></header>
      {carregando ? <div className="f2-modal-carregando" role="status">Carregando permissões…</div> : <form onSubmit={(evento) => void salvar(evento)}>
        <div className="f2-modal-grade">
          <label>Nome completo<input required maxLength={160} autoComplete="name" value={form.nome} onChange={(evento) => alterar("nome", evento.target.value)} /></label>
          <label>Telefone<input inputMode="tel" autoComplete="tel" maxLength={40} placeholder="DDD + número" value={form.telefone} onChange={(evento) => alterar("telefone", evento.target.value)} onBlur={() => void verificarDuplicidade()} /></label>
          <label>E-mail<input type="email" autoComplete="email" maxLength={180} value={form.email} onChange={(evento) => alterar("email", evento.target.value)} onBlur={() => void verificarDuplicidade()} /></label>
          <label>CPF/CNPJ <small>opcional</small><input inputMode="numeric" maxLength={18} value={form.cpfCnpj} onChange={(evento) => alterar("cpfCnpj", evento.target.value)} onBlur={() => void verificarDuplicidade()} /></label>
          <label className="amplo">Endereço <small>opcional</small><input maxLength={300} value={form.endereco} onChange={(evento) => alterar("endereco", evento.target.value)} /></label>
          <label className="amplo">Responsável<select required disabled={!podeEscolher || busy || conciliando} value={form.corretorId} onChange={(evento) => alterar("corretorId", evento.target.value)}><option value="">Selecione</option>{corretores.map((item) => <option key={item.corretor_id} value={item.corretor_id}>{item.nome}{item.is_self ? " (você)" : ""}</option>)}</select></label>
        </div>
        {buscandoDuplicidade && <p className="f2-modal-info" role="status">Verificando duplicidade…</p>}
        {duplicado && <div className="f2-duplicado" role="alert"><strong>Este cliente já existe</strong><span>{duplicado.nome} · {duplicado.telefone || duplicado.email || `#${duplicado.id}`}</span>{duplicado.funilLeadId ? <button type="button" onClick={() => onCreated(duplicado.funilLeadId!)}>Abrir ficha existente</button> : <small>O registro existe, mas ainda não possui cartão visível neste Funil.</small>}</div>}
        {conciliando && <p className="f2-modal-info" role="status">Cliente criado. Confirmando a entrada no Funil…</p>}
        {error && <p className="f2-modal-erro" role="alert">{error}</p>}
        {leadPendenteId && !conciliando && <button type="button" className="f2-modal-reconciliar" onClick={() => void aguardarCard(leadPendenteId).catch((reason) => { setConciliando(false); setError(reason instanceof Error ? reason.message : "Não foi possível confirmar a entrada."); })}>Verificar entrada</button>}
        <footer><button type="button" disabled={busy || conciliando} onClick={onClose}>Cancelar</button><button type="submit" className="f2-modal-primary" disabled={busy || conciliando || carregando || !form.nome.trim() || (!form.telefone.trim() && !form.email.trim()) || !form.corretorId}>{busy || conciliando ? "Confirmando…" : "Adicionar cliente"}</button></footer>
      </form>}
    </div>
  </div>;
}
