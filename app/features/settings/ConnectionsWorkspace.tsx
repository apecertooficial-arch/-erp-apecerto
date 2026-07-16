"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type Inst = { id: number; nome: string; instancia_dapi: string; conectada: boolean; status_dapi: string | null; corretor_id: number | null };

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

  return <div className="connections-workspace">
    <header><div><span>CONFIGURAÇÕES</span><h1>Conexões</h1><p>{isAdmin ? "Todas as instâncias da imobiliária." : "Suas instâncias de WhatsApp — conecte ou reconecte pelo QR."}</p></div><button type="button" onClick={() => void load()}>↻ Atualizar</button></header>
    {error && <div className="connections-error">{error}</div>}
    {disconnected.length > 0 && <div className="connections-warn">⚠ {disconnected.length} instância{disconnected.length === 1 ? "" : "s"} desconectada{disconnected.length === 1 ? "" : "s"} — reconecte para não perder atendimentos.</div>}
    {loading ? <div className="connections-loading">Carregando conexões…</div> : <div className="connections-grid">{instances.map((inst) => <article className={inst.conectada ? "conn-card connected" : "conn-card"} key={inst.id}><div className="conn-status"><i />{inst.conectada ? "Conectada" : (inst.status_dapi || "Offline")}</div><strong>{inst.nome}</strong><button type="button" onClick={() => void openQr(inst)}>{inst.conectada ? "Reconectar" : "Conectar (QR)"}</button></article>)}{!instances.length && <p className="connections-empty">Nenhuma instância associada a você. Fale com o administrador.</p>}</div>}
    {qr && <div className="qr-modal-scrim" onClick={() => setQr(null)}><div className="qr-modal" onClick={(event) => event.stopPropagation()}><header><strong>Conectar · {qr.nome}</strong><button type="button" onClick={() => setQr(null)}>×</button></header>{qr.status === "connected" ? <div className="qr-connected">✓ Conectada com sucesso!</div> : qr.image ? <><img src={qr.image} alt="QR Code da instância" /><p>Abra o WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie. Atualiza sozinho.</p></> : <p className="qr-status">{qr.status === "carregando" ? "Gerando QR…" : qr.status === "erro" ? "Não foi possível gerar o QR. Verifique a apikey da instância." : `Status: ${qr.status}. Aguardando QR…`}</p>}<footer><button type="button" disabled={qrBusy} onClick={() => { const inst = instances.find((item) => item.id === qr.id); if (inst) void openQr(inst, true); }}>Gerar novo QR</button><button type="button" onClick={() => setQr(null)}>Fechar</button></footer></div></div>}
  </div>;
}
