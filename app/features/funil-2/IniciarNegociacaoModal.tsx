"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { LeadFunil2, NegocioVinculadoFunil2 } from "./modelo";

type Produto = { id: string; nome: string; origem: string; bairro: string | null; cidade: string | null };
type Solicitacao = { id: string; negocio_id: number | null; produto_id: string | null; vgv: number | null; status: string; criado_em: string };
type Processo = { id: string; negocio_id: number | null; aprovacao_status: string | null };

function dinheiro(valor: number | null | undefined) {
  return valor == null ? "Valor não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
}

export function IniciarNegociacaoModal({ accessToken, lead, negocios, onClose, onSent, onOpenEsteira }: {
  accessToken: string;
  lead: LeadFunil2;
  negocios: NegocioVinculadoFunil2[];
  onClose: () => void;
  onSent: () => Promise<void>;
  onOpenEsteira: (solicitacaoId?: string) => void;
}) {
  const tituloId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const origemRef = useRef<HTMLElement | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmada, setConfirmada] = useState<Solicitacao | null>(null);
  const [form, setForm] = useState(() => ({
    negocioId: String(negocios.find((item) => item.id === lead.origem_negocio_id)?.id ?? negocios[0]?.id ?? ""),
    produtoId: negocios.find((item) => item.id === lead.origem_negocio_id)?.empreendimento_id ?? negocios[0]?.empreendimento_id ?? "",
    vgv: String(negocios.find((item) => item.id === lead.origem_negocio_id)?.valor ?? negocios[0]?.valor ?? ""),
    payment: "",
    notes: "",
  }));

  const negocioId = Number(form.negocioId);
  const pendente = useMemo(() => solicitacoes.find((item) => item.negocio_id === negocioId && item.status === "pendente") ?? null, [negocioId, solicitacoes]);
  const processo = useMemo(() => processos.find((item) => item.negocio_id === negocioId) ?? null, [negocioId, processos]);

  useEffect(() => {
    origemRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const quadro = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("select, input, button")?.focus());
    return () => { cancelAnimationFrame(quadro); requestAnimationFrame(() => origemRef.current?.focus()); };
  }, []);

  useEffect(() => {
    const onKey = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !busy) { evento.preventDefault(); onClose(); return; }
      if (evento.key !== "Tab") return;
      const focaveis = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? []);
      if (!focaveis.length) return;
      const primeiro = focaveis[0]; const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    const controle = new AbortController();
    const ids = negocios.map((item) => item.id).join(",");
    void fetch(`/api/crm/sales?modo=prepararSolicitacao&negocioIds=${encodeURIComponent(ids)}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controle.signal })
      .then(async (response) => ({ response, json: await response.json().catch(() => ({})) as { error?: string; products?: Produto[]; solicitacoes?: Solicitacao[]; processes?: Processo[] } }))
      .then(({ response, json }) => {
        if (!response.ok) throw new Error(json.error || "Não foi possível preparar a negociação.");
        setProdutos(json.products ?? []); setSolicitacoes(json.solicitacoes ?? []); setProcessos(json.processes ?? []);
      })
      .catch((reason) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Não foi possível preparar a negociação."); })
      .finally(() => setCarregando(false));
    return () => controle.abort();
  }, [accessToken, negocios]);

  const trocarNegocio = (id: string) => {
    const negocio = negocios.find((item) => String(item.id) === id);
    setForm((atual) => ({ ...atual, negocioId: id, produtoId: negocio?.empreendimento_id ?? "", vgv: String(negocio?.valor ?? "") }));
    setError(""); setConfirmada(null);
  };

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (busy || carregando || pendente || processo) return;
    if (!navigator.onLine) { setError("Sem conexão. Nenhuma solicitação foi enviada."); return; }
    const vgv = Number(form.vgv);
    if (!Number.isSafeInteger(negocioId) || !form.produtoId || !Number.isFinite(vgv) || vgv <= 0) { setError("Selecione o negócio, o produto e informe um valor maior que zero."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/crm/sales", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "solicitar", dealId: negocioId, productId: form.produtoId, vgv, payment: form.payment, notes: form.notes }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; solicitacaoId?: string; status?: string; solicitacao?: Solicitacao };
      if (!response.ok) {
        if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente antes de enviar.");
        if (response.status === 403) throw new Error(result.error || "Você não pode iniciar a negociação deste negócio.");
        if (response.status === 409) throw new Error(result.error || "Este negócio já possui uma solicitação ou venda em andamento.");
        throw new Error(result.error || "Não foi possível enviar a negociação.");
      }
      if (result.status !== "pendente" || !result.solicitacaoId) throw new Error("A Esteira não confirmou a solicitação pendente. Nenhum sucesso foi presumido.");
      const salva = result.solicitacao ?? { id: result.solicitacaoId, negocio_id: negocioId, produto_id: form.produtoId, vgv, status: "pendente", criado_em: new Date().toISOString() };
      setConfirmada(salva); setSolicitacoes((atuais) => [...atuais.filter((item) => item.id !== salva.id), salva]);
      await onSent();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a negociação.");
    } finally { setBusy(false); }
  }

  const existente = confirmada ?? pendente;
  return <div className="f2-modal-overlay" onMouseDown={(evento) => { if (evento.target === evento.currentTarget && !busy) onClose(); }}>
    <div ref={dialogRef} className="f2-modal f2-modal-negociacao-canonica" role="dialog" aria-modal="true" aria-label="Iniciar negociação" aria-labelledby={tituloId}>
      <header><div><span className="f2-eyebrow">ESTEIRA DE VENDAS</span><h2 id={tituloId}>Iniciar negociação</h2><p>Envie o negócio para aprovação. A entrada na Esteira não será aprovada automaticamente.</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar Iniciar negociação">×</button></header>
      {carregando ? <div className="f2-modal-carregando" role="status">Carregando contratos da Esteira…</div> : <form onSubmit={(evento) => void salvar(evento)}>
        <div className="f2-lead-escolhido fixo"><span>CLIENTE</span><strong>{lead.nome}</strong><small>{lead.telefone || lead.email || "Contato não informado"}</small></div>
        <div className="f2-modal-grade">
          <label className="amplo">Negócio<select required value={form.negocioId} onChange={(evento) => trocarNegocio(evento.target.value)}>{negocios.map((item) => <option value={item.id} key={item.id}>Negócio #{item.id} · {item.pipeline || "Pipeline"} · {dinheiro(item.valor)}</option>)}</select></label>
          <label className="amplo">Produto<select required value={form.produtoId} onChange={(evento) => setForm((atual) => ({ ...atual, produtoId: evento.target.value }))}><option value="">Selecione</option>{produtos.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.bairro || item.cidade ? ` · ${[item.bairro, item.cidade].filter(Boolean).join(" / ")}` : ""}</option>)}</select></label>
          <label>Valor da negociação<input required type="number" min="0.01" step="0.01" value={form.vgv} onChange={(evento) => setForm((atual) => ({ ...atual, vgv: evento.target.value }))} /></label>
          <label>Forma de pagamento <small>opcional</small><input maxLength={120} value={form.payment} onChange={(evento) => setForm((atual) => ({ ...atual, payment: evento.target.value }))} /></label>
          <label className="amplo">Observações <small>opcional</small><textarea maxLength={500} value={form.notes} onChange={(evento) => setForm((atual) => ({ ...atual, notes: evento.target.value }))} /></label>
        </div>
        {processo && <div className="f2-duplicado" role="status"><strong>Este negócio já está na Esteira</strong><span>Status de aprovação: {processo.aprovacao_status || "em andamento"}.</span><button type="button" onClick={() => onOpenEsteira()}>Abrir na Esteira</button></div>}
        {existente && <div className="f2-modal-sucesso" role="status"><strong>Negociação enviada — aguardando aprovação</strong><span>A solicitação foi confirmada pela fonte canônica e ainda não virou venda.</span><button type="button" onClick={() => onOpenEsteira(existente.id)}>Abrir na Esteira</button></div>}
        {error && <p className="f2-modal-erro" role="alert">{error}</p>}
        <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="f2-modal-primary" disabled={busy || Boolean(existente) || Boolean(processo) || !form.negocioId || !form.produtoId || Number(form.vgv) <= 0}>{busy ? "Enviando…" : "Enviar para aprovação"}</button></footer>
      </form>}
    </div>
  </div>;
}
