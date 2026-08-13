"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

/* FICHA DA VENDA - UM FORMULARIO SO (ago/2026).

   Substitui os dois componentes que existiam antes:
     - NovaVendaModal: wizard de 4 abas, so criava.
     - SaleDrawer ("Venda 360"): painel lateral, so mostrava, e o pouco que
       deixava editar eram 4 campos soltos.

   Agora e o mesmo formulario nos dois casos. `saleId === null` cria; com
   `saleId` edita. A diferenca de comportamento fica em `editando`, no espirito
   do CashModal, que ja fazia assim nesta mesma tela.

   O que mudou de verdade na aba Pagamentos: o repasse ao corretor deixou de ser
   um lancamento manual de caixa escondido em outra aba e virou agenda com
   previsao e baixa (pagamentos_comissao). Marcar "pago" gera o lancamento de
   caixa sozinho; desmarcar apaga. Nao lance comissao paga a mao no Fluxo de
   Caixa: o dinheiro seria contado duas vezes. */

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import type { FinanceData } from "./FinanceWorkspace";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);

const PAPEIS: Array<[string, string]> = [["corretor", "Corretor"], ["executivo", "Executivo"], ["gerente", "Taxa de gerente"], ["apecerto", "Apecerto"], ["indicacao", "Indicação"]];
const rotuloPapel = (valor: string) => PAPEIS.find(([id]) => id === valor)?.[1] ?? valor;

type DocRow = { nome: string; path: string; bucket: string; uploading?: boolean; error?: string };
type CommRow = { id?: string; papel: string; beneficiarioId: string; valor: string };
type ReceiptRow = { id?: string; numeroParcela: string; valor: string; dataPrevista: string; recebido: boolean };
type PayoutRow = { id?: string; comissaoId: string | null; beneficiarioId: string; papel: string; valor: string; ordem: number; dataPrevista: string; status: "previsto" | "pago"; dataPagamento: string };

export function VendaModal({ data, saleId, sessionRole = "corretor", onClose, onSave, onDelete }: {
  data: FinanceData;
  saleId: string | null;
  sessionRole?: "admin" | "gestor" | "corretor";
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onDelete: (saleId: string) => Promise<void>;
}) {
  const editando = Boolean(saleId);
  const isCorretor = sessionRole === "corretor";
  const somenteLeitura = isCorretor;
  const venda = saleId ? data.sales.find((item) => item.id === saleId) ?? null : null;
  const detalhe = saleId ? data.details.find((item) => item.id === saleId) : undefined;
  const empreendimentos = data.empreendimentos ?? [];
  const usuarios = data.users ?? [];
  const nomeUsuario = (id: string | null | undefined) => (id ? usuarios.find((u) => u.id === id)?.nome ?? "—" : "—");

  const [form, setForm] = useState(() => ({
    dataVenda: venda?.data_venda ?? hoje(),
    empreendimentoId: venda?.empreendimento_id ?? "",
    empreendimentoNome: venda?.empreendimento_nome ?? "",
    unidade: venda?.unidade_rotulo ?? detalhe?.unidade ?? "",
    vgv: venda ? String(venda.vgv) : "",
    percent: venda ? String(Number(venda.percentual_comissao || 0) * 100) : "",
    custos: venda ? String(venda.custos ?? 0) : "",
    payment: venda?.forma_pgto ?? "",
    status: venda?.status ?? "pendente",
    clienteNome: venda?.cliente_nome ?? "",
    proprietarioNome: venda?.proprietario_nome ?? "",
    notes: venda?.obs ?? "",
  }));

  const [commissions, setCommissions] = useState<CommRow[]>(() => saleId
    ? data.commissions.filter((c) => c.venda_id === saleId).map((c) => ({ id: c.id, papel: c.papel, beneficiarioId: c.beneficiario_id ?? "", valor: String(c.valor_final ?? 0) }))
    : []);
  const [receipts, setReceipts] = useState<ReceiptRow[]>(() => saleId
    ? data.receipts.filter((r) => r.venda_id === saleId).map((r) => ({ id: r.id, numeroParcela: String(r.numero_parcela), valor: String(r.valor_total ?? 0), dataPrevista: r.data_prevista ?? "", recebido: r.status === "recebido" }))
    : []);
  const [payouts, setPayouts] = useState<PayoutRow[]>(() => saleId
    ? (data.payouts ?? []).filter((p) => p.venda_id === saleId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((p) => ({ id: p.id, comissaoId: p.comissao_id, beneficiarioId: p.beneficiario_id ?? "", papel: p.papel, valor: String(p.valor ?? 0), ordem: p.ordem ?? 1, dataPrevista: p.data_prevista ?? "", status: p.status === "pago" ? "pago" : "previsto", dataPagamento: p.data_pagamento ?? "" }))
    : []);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* Cada gravacao refaz o GET inteiro no workspace (padrao da casa: mutate ->
     load). Sem este efeito, as listas locais ficariam presas no estado do
     momento em que a ficha abriu: adicionar uma comissao duas vezes criaria
     duplicata, e dar baixa num repasse nao mudaria o rotulo na tela.
     Ressincroniza so em modo edicao — na criacao nao existe nada no banco. */
  useEffect(() => {
    if (!saleId) return;
    setCommissions(data.commissions.filter((c) => c.venda_id === saleId).map((c) => ({ id: c.id, papel: c.papel, beneficiarioId: c.beneficiario_id ?? "", valor: String(c.valor_final ?? 0) })));
    setReceipts(data.receipts.filter((r) => r.venda_id === saleId).map((r) => ({ id: r.id, numeroParcela: String(r.numero_parcela), valor: String(r.valor_total ?? 0), dataPrevista: r.data_prevista ?? "", recebido: r.status === "recebido" })));
    setPayouts((data.payouts ?? []).filter((p) => p.venda_id === saleId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((p) => ({ id: p.id, comissaoId: p.comissao_id, beneficiarioId: p.beneficiario_id ?? "", papel: p.papel, valor: String(p.valor ?? 0), ordem: p.ordem ?? 1, dataPrevista: p.data_prevista ?? "", status: p.status === "pago" ? "pago" : "previsto", dataPagamento: p.data_pagamento ?? "" })));
  }, [data.commissions, data.receipts, data.payouts, saleId]);

  const vgvNumero = Number(form.vgv) || 0;
  const percentNumero = Number(form.percent) || 0;
  const comissaoBruta = vgvNumero * (percentNumero / 100);
  const somaComissoes = commissions.reduce((soma, item) => soma + (Number(item.valor) || 0), 0);
  const distribuido = Math.abs(comissaoBruta - somaComissoes) < 0.01;
  const somaRepassado = payouts.filter((p) => p.status === "pago").reduce((soma, p) => soma + (Number(p.valor) || 0), 0);
  const somaAgendado = payouts.filter((p) => p.status === "previsto").reduce((soma, p) => soma + (Number(p.valor) || 0), 0);
  const faltaAgendar = Math.max(0, somaComissoes - somaRepassado - somaAgendado);
  const repassadoDe = (linha: CommRow) => payouts.filter((p) => p.status === "pago" && ((linha.id && p.comissaoId === linha.id) || (!p.comissaoId && p.beneficiarioId === linha.beneficiarioId && p.papel === linha.papel))).reduce((soma, p) => soma + (Number(p.valor) || 0), 0);

  const executar = async (payload: Record<string, unknown>, mensagem: string) => {
    setError(null); setBusy(true);
    try { await onSave(payload); setAviso(mensagem); }
    catch (motivo) { setError(motivo instanceof Error ? motivo.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };

  const enviarDoc = async (file: File) => {
    const provisorio: DocRow = { nome: file.name, path: "", bucket: "esteira-docs", uploading: true };
    setDocs((linhas) => [...linhas, provisorio]);
    try {
      const supabase = getBrowserSupabaseClient();
      const nomeSeguro = file.name.replace(/[^\w.\-]+/g, "_");
      const caminho = `vendas/${form.dataVenda}/${Date.now()}_${nomeSeguro}`;
      const { error: falha } = await supabase.storage.from("esteira-docs").upload(caminho, file, { upsert: false });
      if (falha) throw new Error(falha.message);
      setDocs((linhas) => linhas.map((linha) => linha === provisorio ? { nome: file.name, path: caminho, bucket: "esteira-docs" } : linha));
    } catch (motivo) {
      setDocs((linhas) => linhas.map((linha) => linha === provisorio ? { ...linha, uploading: false, error: motivo instanceof Error ? motivo.message : "Falha no envio" } : linha));
    }
  };

  const camposDaVenda = () => ({
    dataVenda: form.dataVenda,
    empreendimentoId: form.empreendimentoId || null,
    empreendimentoNome: form.empreendimentoId ? (empreendimentos.find((e) => e.id === form.empreendimentoId)?.nome || form.empreendimentoNome) : form.empreendimentoNome,
    unidade: form.unidade,
    vgv: vgvNumero,
    percent: percentNumero,
    custos: Number(form.custos) || 0,
    payment: form.payment,
    status: form.status,
    clienteNome: form.clienteNome,
    proprietarioNome: form.proprietarioNome,
    notes: form.notes,
  });

  const criarVenda = () => {
    setError(null);
    if (!form.dataVenda || vgvNumero <= 0) { setError("Informe a data e o VGV da venda."); setStep(1); return; }
    if (docs.some((d) => d.uploading)) { setError("Aguarde o envio dos documentos terminar."); return; }
    void executar({
      action: "createSale",
      ...camposDaVenda(),
      commissions: commissions.filter((c) => Number(c.valor) > 0).map((c) => ({ papel: c.papel, beneficiarioId: c.beneficiarioId, valor: Number(c.valor) })),
      receipts: receipts.filter((r) => Number(r.valor) > 0).map((r) => ({ numeroParcela: Number(r.numeroParcela), valor: Number(r.valor), dataPrevista: r.dataPrevista })),
      payouts: payouts.filter((p) => Number(p.valor) > 0 && p.beneficiarioId).map((p) => ({ beneficiarioId: p.beneficiarioId, papel: p.papel, valor: Number(p.valor), ordem: p.ordem, dataPrevista: p.dataPrevista, status: p.status, dataPagamento: p.dataPagamento })),
      documentos: docs.filter((d) => d.path).map((d) => ({ nome: d.nome, path: d.path, bucket: d.bucket })),
    }, "Venda lançada.");
  };

  const salvarDados = () => {
    if (!saleId) return;
    if (!form.dataVenda || vgvNumero <= 0) { setError("Informe a data e o VGV da venda."); setStep(1); return; }
    void executar({ action: "updateSale", saleId, ...camposDaVenda() }, "Dados da venda salvos.");
  };

  const gerarRepasses = () => {
    const base = commissions.filter((c) => Number(c.valor) > 0 && c.beneficiarioId);
    if (base.length === 0) { setError("Lance as comissões antes de gerar a agenda de repasse."); setStep(2); return; }
    setError(null);
    setPayouts(base.map((c, indice) => ({
      comissaoId: c.id ?? null, beneficiarioId: c.beneficiarioId, papel: c.papel,
      valor: String(Number(c.valor) - repassadoDe(c)), ordem: indice + 1,
      dataPrevista: form.dataVenda, status: "previsto" as const, dataPagamento: "",
    })).filter((linha) => Number(linha.valor) > 0));
  };

  const cabecalho = venda
    ? `${venda.empreendimento_nome || "Venda"} · ${detalhe?.unidade || "Unidade não informada"}`
    : "Preencha os dados da venda, quem recebe comissão, os pagamentos e o cliente.";

  const abas: Array<[1 | 2 | 3 | 4, string]> = [[1, "Dados da venda"], [2, "Corretores & comissões"], [3, "Pagamentos"], [4, "Cliente & documentos"]];

  return <div className="crm-center-modal venda-modal-layer">
    <article className="venda-modal">
      <header className="venda-modal-head">
        <div>
          <span>{editando ? "FICHA DA VENDA" : "LANÇAMENTO DE VENDA"}</span>
          <h2>{editando ? "Editar venda" : "Nova venda"}</h2>
          <p>{cabecalho}</p>
        </div>
        <button aria-label="Fechar" type="button" onClick={onClose}>×</button>
      </header>

      {editando && <div className="venda-modal-kpis">
        <article><span>VGV</span><strong>{brl.format(vgvNumero)}</strong></article>
        {!isCorretor && <article><span>Comissão bruta</span><strong>{brl.format(comissaoBruta)}</strong></article>}
        {!isCorretor && <article><span>Repassado</span><strong className="positive">{brl.format(somaRepassado)}</strong></article>}
        {!isCorretor && <article><span>A repassar</span><strong className={somaComissoes - somaRepassado > 0.009 ? "negative" : "positive"}>{brl.format(Math.max(0, somaComissoes - somaRepassado))}</strong></article>}
        {isCorretor && <article><span>Minha comissão</span><strong className="positive">{brl.format(somaComissoes)}</strong></article>}
      </div>}

      <nav className="nova-venda-steps venda-modal-steps">
        {abas.map(([id, rotulo]) => <button className={step === id ? "active" : ""} type="button" onClick={() => setStep(id)} key={id}><b>{id}</b>{rotulo}</button>)}
      </nav>

      {error && <p className="modal-error">{error}</p>}
      {aviso && !error && <button className="venda-modal-ok" type="button" onClick={() => setAviso(null)}>{aviso} ×</button>}

      <div className="venda-modal-body">
        {step === 1 && <section className="nova-venda-section">
          <div className="nova-venda-row">
            <label>Data da venda<input disabled={somenteLeitura} type="date" value={form.dataVenda} onChange={(e) => setForm({ ...form, dataVenda: e.target.value })} /></label>
            <label>Status da venda<select disabled={somenteLeitura} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pendente">Pendente</option><option value="concluido">Concluído</option><option value="pago">Pago pela construtora</option><option value="distrato">Distrato</option>
            </select></label>
          </div>
          <label>Empreendimento / produto<select disabled={somenteLeitura} value={form.empreendimentoId} onChange={(e) => setForm({ ...form, empreendimentoId: e.target.value })}>
            <option value="">Selecione ou digite abaixo…</option>{empreendimentos.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}
          </select></label>
          {!form.empreendimentoId && <label><input disabled={somenteLeitura} placeholder="Nome do empreendimento" value={form.empreendimentoNome} onChange={(e) => setForm({ ...form, empreendimentoNome: e.target.value })} /></label>}
          <div className="nova-venda-row">
            <label>Unidade<input disabled={somenteLeitura} placeholder="Ex.: Apto 302, Lote 14" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} /></label>
            <label>VGV<input disabled={somenteLeitura} type="number" step="0.01" placeholder="0,00" value={form.vgv} onChange={(e) => setForm({ ...form, vgv: e.target.value })} /></label>
          </div>
          <div className="nova-venda-row">
            <label>Comissão total %<input disabled={somenteLeitura} type="number" step="0.01" min="0" max="100" placeholder="Ex.: 6" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} /></label>
            <label>Custos<input disabled={somenteLeitura} type="number" step="0.01" placeholder="0,00" value={form.custos} onChange={(e) => setForm({ ...form, custos: e.target.value })} /></label>
          </div>
          <label>Forma de pagamento<input disabled={somenteLeitura} placeholder="Ex.: Financiamento, À vista" value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })} /></label>
          <label>Observações<textarea disabled={somenteLeitura} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          {comissaoBruta > 0 && <p className="nova-venda-hint">Comissão bruta calculada: <b>{brl.format(comissaoBruta)}</b></p>}
          {editando && !somenteLeitura && <button className="save-sale" disabled={busy} type="button" onClick={salvarDados}>{busy ? "Salvando…" : "Salvar dados da venda"}</button>}
        </section>}

        {step === 2 && <section className="nova-venda-section">
          <div className="comm-head">
            <h3>Quem recebe comissão nesta venda</h3>
            {!isCorretor && <span className={distribuido ? "comm-ok" : "comm-warn"}>Distribuído {brl.format(somaComissoes)} de {brl.format(comissaoBruta)}{distribuido ? " ✓" : ` · falta ${brl.format(comissaoBruta - somaComissoes)}`}</span>}
          </div>
          {commissions.map((linha, indice) => <div className="comm-row venda-comm-row" key={linha.id ?? `nova-${indice}`}>
            <select disabled={somenteLeitura} value={linha.papel} onChange={(e) => setCommissions((l) => l.map((r, i) => i === indice ? { ...r, papel: e.target.value } : r))}>
              {PAPEIS.map(([id, rotulo]) => <option value={id} key={id}>{rotulo}</option>)}
            </select>
            <select disabled={somenteLeitura} value={linha.beneficiarioId} onChange={(e) => setCommissions((l) => l.map((r, i) => i === indice ? { ...r, beneficiarioId: e.target.value } : r))}>
              <option value="">Sem beneficiário</option>{usuarios.map((u) => <option value={u.id} key={u.id}>{u.nome}</option>)}
            </select>
            <input disabled={somenteLeitura} type="number" step="0.01" placeholder="Valor" value={linha.valor} onChange={(e) => setCommissions((l) => l.map((r, i) => i === indice ? { ...r, valor: e.target.value } : r))} />
            {editando && <em className="venda-comm-saldo">repassado {brl.format(repassadoDe(linha))}</em>}
            {!somenteLeitura && <>
              {editando && <button disabled={busy} title="Salvar valor" type="button" onClick={() => void executar(linha.id
                ? { action: "updateCommission", commissionId: linha.id, valor: Number(linha.valor) }
                : { action: "addCommission", saleId, papel: linha.papel, beneficiarioId: linha.beneficiarioId, valor: Number(linha.valor) }, "Comissão salva.")}>✓</button>}
              <button className="comm-del" disabled={busy} title="Remover" type="button" onClick={() => {
                if (editando && linha.id) { void executar({ action: "deleteCommission", commissionId: linha.id }, "Comissão removida."); }
                setCommissions((l) => l.filter((_, i) => i !== indice));
              }}>×</button>
            </>}
          </div>)}
          {commissions.length === 0 && <p className="finance-empty">Nenhuma comissão lançada nesta venda ainda.</p>}
          {!somenteLeitura && <button className="comm-add-btn" type="button" onClick={() => setCommissions((l) => [...l, { papel: "corretor", beneficiarioId: "", valor: "" }])}>＋ Adicionar participante</button>}
        </section>}

        {step === 3 && <section className="nova-venda-section">
          <div className="comm-head"><h3>Recebimentos — o que a construtora paga à imobiliária</h3></div>
          {receipts.map((linha, indice) => <div className="comm-row venda-receipt-row" key={linha.id ?? `nova-${indice}`}>
            <span className="venda-parcela">Parcela {linha.numeroParcela}</span>
            <input disabled={somenteLeitura} type="number" step="0.01" placeholder="Valor" value={linha.valor} onChange={(e) => setReceipts((l) => l.map((r, i) => i === indice ? { ...r, valor: e.target.value } : r))} />
            <input disabled={somenteLeitura} type="date" value={linha.dataPrevista} onChange={(e) => setReceipts((l) => l.map((r, i) => i === indice ? { ...r, dataPrevista: e.target.value } : r))} />
            <em className={linha.recebido ? "venda-tag ok" : "venda-tag"}>{linha.recebido ? "Recebido" : "A receber"}</em>
            {!somenteLeitura && editando && linha.id && <>
              <button disabled={busy} title="Salvar" type="button" onClick={() => void executar({ action: "saveReceipt", receiptId: linha.id, valor: Number(linha.valor), numeroParcela: Number(linha.numeroParcela), dataPrevista: linha.dataPrevista }, "Recebimento salvo.")}>✓</button>
              <button disabled={busy} title={linha.recebido ? "Desfazer baixa" : "Marcar como recebido"} type="button" onClick={() => void executar({ action: "settleReceipt", receiptId: linha.id, received: !linha.recebido }, linha.recebido ? "Baixa desfeita." : "Recebimento baixado.")}>{linha.recebido ? "↺" : "✓ baixar"}</button>
              <button className="comm-del" disabled={busy} title="Remover" type="button" onClick={() => void executar({ action: "deleteReceipt", receiptId: linha.id }, "Recebimento removido.")}>×</button>
            </>}
            {!somenteLeitura && !editando && <button className="comm-del" title="Remover" type="button" onClick={() => setReceipts((l) => l.filter((_, i) => i !== indice))}>×</button>}
          </div>)}
          {receipts.length === 0 && <p className="finance-empty">Nenhuma parcela de recebimento cadastrada.</p>}
          {!somenteLeitura && <button className="comm-add-btn" type="button" onClick={() => setReceipts((l) => [...l, { numeroParcela: String(l.length + 1), valor: "", dataPrevista: form.dataVenda, recebido: false }])}>＋ Adicionar parcela a receber</button>}

          {!isCorretor && <>
            <div className="comm-head venda-repasse-head">
              <h3>Repasses — o que a imobiliária paga às partes</h3>
              <span className={faltaAgendar > 0.009 ? "comm-warn" : "comm-ok"}>Pago {brl.format(somaRepassado)} · agendado {brl.format(somaAgendado)}{faltaAgendar > 0.009 ? ` · falta agendar ${brl.format(faltaAgendar)}` : " ✓"}</span>
            </div>
            <p className="nova-venda-hint">Marcar um repasse como pago lança a saída no fluxo de caixa automaticamente. Não lance comissão paga à mão no caixa — o valor seria contado duas vezes.</p>
            {payouts.map((linha, indice) => <div className={`comm-row venda-payout-row ${linha.status}`} key={linha.id ?? `nova-${indice}`}>
              <select disabled={somenteLeitura} value={linha.beneficiarioId} onChange={(e) => setPayouts((l) => l.map((r, i) => i === indice ? { ...r, beneficiarioId: e.target.value } : r))}>
                <option value="">Quem recebe…</option>{usuarios.map((u) => <option value={u.id} key={u.id}>{u.nome}</option>)}
              </select>
              <select disabled={somenteLeitura} value={linha.papel} onChange={(e) => setPayouts((l) => l.map((r, i) => i === indice ? { ...r, papel: e.target.value } : r))}>
                {PAPEIS.map(([id, rotulo]) => <option value={id} key={id}>{rotulo}</option>)}
              </select>
              <input disabled={somenteLeitura || linha.status === "pago"} type="number" step="0.01" placeholder="Valor" value={linha.valor} onChange={(e) => setPayouts((l) => l.map((r, i) => i === indice ? { ...r, valor: e.target.value } : r))} />
              {linha.status === "pago"
                ? <span className="venda-data-pgto">pago em {linha.dataPagamento ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${linha.dataPagamento}T12:00:00`)) : "—"}</span>
                : <input disabled={somenteLeitura} type="date" title="Previsão de pagamento" value={linha.dataPrevista} onChange={(e) => setPayouts((l) => l.map((r, i) => i === indice ? { ...r, dataPrevista: e.target.value } : r))} />}
              <em className={linha.status === "pago" ? "venda-tag ok" : "venda-tag aguardando"}>{linha.status === "pago" ? "Pago" : "A pagar"}</em>
              {!somenteLeitura && editando && <>
                {!linha.id && <button disabled={busy} title="Salvar repasse" type="button" onClick={() => void executar({ action: "savePayout", saleId, comissaoId: linha.comissaoId, beneficiarioId: linha.beneficiarioId, papel: linha.papel, valor: Number(linha.valor), ordem: linha.ordem, dataPrevista: linha.dataPrevista, status: "previsto" }, "Repasse agendado.")}>✓</button>}
                {linha.id && linha.status === "previsto" && <button disabled={busy} title="Salvar alterações" type="button" onClick={() => void executar({ action: "savePayout", payoutId: linha.id, saleId, comissaoId: linha.comissaoId, beneficiarioId: linha.beneficiarioId, papel: linha.papel, valor: Number(linha.valor), ordem: linha.ordem, dataPrevista: linha.dataPrevista, status: "previsto" }, "Repasse salvo.")}>✓</button>}
                {linha.id && <button className="venda-baixar" disabled={busy} type="button" onClick={() => void executar({ action: "settlePayout", payoutId: linha.id, pago: linha.status !== "pago", dataPagamento: linha.dataPagamento || hoje() }, linha.status === "pago" ? "Baixa desfeita e lançamento removido do caixa." : "Repasse pago e lançado no caixa.")}>{linha.status === "pago" ? "↺ desfazer" : "Marcar pago"}</button>}
                {linha.id && <button className="comm-del" disabled={busy} title="Remover" type="button" onClick={() => void executar({ action: "deletePayout", payoutId: linha.id }, "Repasse removido.")}>×</button>}
                {!linha.id && <button className="comm-del" title="Remover" type="button" onClick={() => setPayouts((l) => l.filter((_, i) => i !== indice))}>×</button>}
              </>}
              {!somenteLeitura && !editando && <button className="comm-del" title="Remover" type="button" onClick={() => setPayouts((l) => l.filter((_, i) => i !== indice))}>×</button>}
            </div>)}
            {payouts.length === 0 && <p className="finance-empty">Nenhum repasse agendado. Gere a agenda a partir das comissões ou adicione linha a linha.</p>}
            {!somenteLeitura && <div className="venda-payout-acoes">
              <button className="comm-add-btn" type="button" onClick={() => setPayouts((l) => [...l, { comissaoId: null, beneficiarioId: "", papel: "corretor", valor: "", ordem: l.length + 1, dataPrevista: form.dataVenda, status: "previsto", dataPagamento: "" }])}>＋ Adicionar repasse</button>
              <button className="comm-add-btn" type="button" onClick={gerarRepasses}>Gerar a partir das comissões</button>
            </div>}
          </>}
        </section>}

        {step === 4 && <section className="nova-venda-section">
          <div className="nova-venda-row">
            <label>Cliente<input disabled={somenteLeitura} value={form.clienteNome} onChange={(e) => setForm({ ...form, clienteNome: e.target.value })} placeholder="Nome do comprador" /></label>
            <label>Proprietário / vendedor<input disabled={somenteLeitura} value={form.proprietarioNome} onChange={(e) => setForm({ ...form, proprietarioNome: e.target.value })} placeholder="Nome do proprietário" /></label>
          </div>
          <div className="nova-venda-doc">
            {docs.map((doc, indice) => <div className="nova-venda-upload" key={`${doc.nome}-${indice}`}>
              <span>{doc.nome}</span>
              {doc.uploading ? <em>enviando…</em> : doc.error ? <em className="negative">{doc.error}</em> : <em className="positive">enviado</em>}
              {!somenteLeitura && <button className="nova-venda-del" type="button" onClick={() => setDocs((l) => l.filter((_, i) => i !== indice))}>×</button>}
            </div>)}
            {docs.length === 0 && <p className="finance-empty">Nenhum documento anexado nesta sessão.</p>}
            {!somenteLeitura && <label className="nova-venda-upload-label">Anexar documento<input type="file" onChange={(e) => { const file = e.target.files?.[0]; if (file) void enviarDoc(file); e.target.value = ""; }} /></label>}
          </div>
          {editando && !somenteLeitura && <button className="save-sale" disabled={busy} type="button" onClick={salvarDados}>{busy ? "Salvando…" : "Salvar cliente e documentos"}</button>}
        </section>}
      </div>

      <footer className="venda-modal-foot">
        <div>
          {step > 1 && <button type="button" onClick={() => setStep((v) => (v - 1) as 1 | 2 | 3 | 4)}>‹ Voltar</button>}
          {step < 4 && <button type="button" onClick={() => setStep((v) => (v + 1) as 1 | 2 | 3 | 4)}>Próximo ›</button>}
        </div>
        <div>
          {editando && !isCorretor && (!confirmDelete
            ? <button className="delete-sale" disabled={busy} type="button" onClick={() => setConfirmDelete(true)}>Apagar venda</button>
            : <span className="delete-sale-confirm venda-delete-inline">
                <b>Apagar? Comissões, recebimentos e repasses somem.</b>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
                <button className="danger" type="button" disabled={busy} onClick={() => { setBusy(true); void onDelete(saleId!).finally(() => setBusy(false)); }}>{busy ? "Apagando…" : "Confirmar"}</button>
              </span>)}
          <button type="button" onClick={onClose}>Fechar</button>
          {!editando && <button className="crm-primary" disabled={busy} type="button" onClick={criarVenda}>{busy ? "Lançando…" : "Lançar venda"}</button>}
        </div>
      </footer>
    </article>
  </div>;
}
