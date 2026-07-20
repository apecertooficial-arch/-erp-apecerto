"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type Inst = { id: number; nome: string; instancia_dapi: string; conectada: boolean; status_dapi: string | null; corretor_id: number | null; numero_conectado: string | null };

function fmtFone(n: string | null): string {
  const d = String(n || "").replace(/\D/g, "");
  if (d.length < 10) return d;
  const br = d.startsWith("55") ? d.slice(2) : d;
  const ddd = br.slice(0, 2);
  const rest = br.slice(2);
  const fim = rest.slice(-4);
  const ini = rest.slice(0, rest.length - 4);
  return `+55 (${ddd}) ${ini}-${fim}`;
}

export function ConnectionsWorkspace({ accessToken }: { accessToken: string }) {
  const [instances, setInstances] = useState<Inst[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<{ id: number; nome: string; status: string; image: string | null } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data } = await getBrowserSupabaseClient().functions.invoke("dapi-qr", { body: { action: "list" } });
      const result = (data ?? {}) as { instancias?: Inst[]; isAdmin?: boolean; error?: string };
      if (result.error) setError(result.error);
      setInstances(result.instancias ?? []); setIsAdmin(Boolean(result.isAdmin));
    } catch { setError("Não foi possível carregar suas conexões."); }
    finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [accessToken]);

  async function deleteInstance(inst: Inst) {
    if (!window.confirm(`Excluir a instância "${inst.nome}"? Isso remove a conexão e os vínculos dela. Não dá para desfazer.`)) return;
    setError("");
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("excluir_instancia", { p_id: inst.id });
    if (rpcError) setError(rpcError.message); else await load();
  }

  async function openQr(inst: Inst, restart = false) {
    setQr({ id: inst.id, nome: inst.nome, status: "carregando", image: null }); setQrBusy(true);
    try {
      const { data } = await getBrowserSupabaseClient().functions.invoke("dapi-qr", { body: { action: restart ? "restart" : "qr", instanciaId: inst.id } });
      const result = (data ?? {}) as { status?: string; qrCodeImage?: string | null; conectada?: boolean; error?: string };
      setQr({ id: inst.id, nome: inst.nome, status: result.error || result.status || "desconhecido", image: result.qrCodeImage ?? null });
      if (result.conectada) await load();
    } catch { setQr((current) => current ? { ...current, status: "erro" } : current); }
    finally { setQrBusy(false); }
  }
  useEffect(() => {
    if (!qr || qr.status === "connected" || qr.status === "erro") return;
    const timer = window.setTimeout(() => { const inst = instances.find((item) => item.id === qr.id); if (inst) void openQr(inst); }, 4500);
    return () => window.clearTimeout(timer);
  }, [qr, instances]);

  const disconnected = instances.filter((item) => !item.conectada);
  const conectadas = instances.filter((item) => item.conectada).length;
  const instaveis = instances.filter((item) => !item.conectada && /connecting/i.test(item.status_dapi || "")).length;
  const desconectadas = instances.length - conectadas - instaveis;

  return <div className="connections-workspace">
    {!loading && instances.length > 0 && <div className="conn-stats">
      <div className="conn-stat ok"><span>● Conectadas</span><strong>{conectadas}</strong></div>
      <div className="conn-stat warn"><span>● Instáveis</span><strong>{instaveis}</strong></div>
      <div className="conn-stat bad"><span>● Desconectadas</span><strong>{desconectadas}</strong></div>
    </div>}
    <header><div><span>CONFIGURAÇÕES</span><h1>Instâncias de WhatsApp</h1><p>{isAdmin ? "Todas as conexões da imobiliária." : "Suas instâncias de WhatsApp — conecte ou reconecte pelo QR."}</p></div><button type="button" onClick={() => void load()}>↻ Atualizar</button></header>
    {error && <div className="connections-error">{error}</div>}
    {disconnected.length > 0 && <div className="connections-warn">⚠ {disconnected.length} instância{disconnected.length === 1 ? "" : "s"} desconectada{disconnected.length === 1 ? "" : "s"} — reconecte para não perder atendimentos.</div>}
    {loading ? <div className="connections-loading">Carregando conexões…</div> : <div className="connections-grid">{instances.map((inst) => { const unstable = !inst.conectada && /connecting/i.test(inst.status_dapi || ""); return <article className={`conn-card ${inst.conectada ? "connected" : unstable ? "unstable" : "off"}`} key={inst.id}><div className="conn-card-top"><span className="conn-status"><i />{inst.conectada ? "CONECTADA" : (inst.status_dapi || "OFFLINE")}</span><span className="conn-card-actions"><span className="conn-device" aria-hidden>▢</span>{isAdmin && <button type="button" className="conn-del" title="Excluir instância" aria-label="Excluir instância" onClick={() => void deleteInstance(inst)}>🗑</button>}</span></div><strong>{inst.nome}</strong>{inst.numero_conectado ? <small className="conn-num">📱 {fmtFone(inst.numero_conectado)}</small> : null}<small className="conn-sync">{inst.conectada ? "Sincronizada agora" : "Aguardando reconexão"}</small><button type="button" onClick={() => void openQr(inst)}>{inst.conectada ? "↻ Reconectar" : "▣ Conectar (QR)"}</button></article>; })}{!instances.length && <p className="connections-empty">Nenhuma instância associada a você. Fale com o administrador.</p>}</div>}
    {qr && <div className="qr-modal-scrim" onClick={() => setQr(null)}><div className="qr-modal" onClick={(event) => event.stopPropagation()}><header><strong>Conectar · {qr.nome}</strong><button type="button" onClick={() => setQr(null)}>×</button></header>{qr.status === "connected" ? <div className="qr-connected">✓ Conectada com sucesso!</div> : qr.image ? <><img src={qr.image} alt="QR Code da instância" /><p>Abra o WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie. Atualiza sozinho.</p></> : <p className="qr-status">{qr.status === "carregando" ? "Gerando QR…" : qr.status === "erro" ? "Não foi possível gerar o QR. Verifique a apikey da instância." : `Status: ${qr.status}. Aguardando QR…`}</p>}<footer><button type="button" disabled={qrBusy} onClick={() => { const inst = instances.find((item) => item.id === qr.id); if (inst) void openQr(inst, true); }}>Gerar novo QR</button><button type="button" onClick={() => setQr(null)}>Fechar</button></footer></div></div>}
  </div>;
}
