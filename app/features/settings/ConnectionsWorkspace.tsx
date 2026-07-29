"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

/* V7.2 — a tela passa a ler a FONTE CANÔNICA (`wa_v7_painel`), que materializa
   o último snapshot COMPLETO e válido do D-API. Antes, esta tela lia
   `dapi-qr → instancias` e mostrava 12 cartões enquanto o provedor tinha 10
   sessões: os dois registros órfãos da Tica apareciam como conexão quebrada.
   As ações de QR/reconexão continuam no `dapi-qr`, endereçadas pelo id legado
   da sessão canônica — sem criar duplicata local. */
type Sessao = {
  sessao_id: number; provider_session_id: string; nome: string | null;
  estado: "connected" | "disconnected" | "connecting" | "desconhecido";
  estado_em: string | null; sincronizacao_fresca: boolean; em_quarentena: boolean;
  corretor_id: number | null; corretor_nome: string | null; legado_instancia_id: number | null;
};
type Arquivada = { provider_session_id: string; arquivada_em: string; motivo: string | null; legado_instancia_id: number | null };
type Contagens = {
  total: number; conectadas: number; conectando: number; desconectadas: number;
  desconhecidas: number; arquivadas: number; em_quarentena: number;
  sincronizacao_fresca: boolean; ultimo_snapshot_completo_em: string | null;
};
type Painel = { contagens: Contagens | null; sessoes: Sessao[]; arquivadas: Arquivada[]; modo: string | null; gerado_em: string };


export function ConnectionsWorkspace({ accessToken }: { accessToken: string }) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<{ id: number; nome: string; status: string; image: string | null } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  /* UMA fórmula. A soma fecha com o total e o alerta usa exatamente os mesmos
     números dos cartões — antes os cartões diziam 9/1/2 e o alerta dizia 3. */
  const sessoes = useMemo(() => painel?.sessoes ?? [], [painel?.sessoes]);
  const c = painel?.contagens ?? null;
  /* `wa_v7_painel` filtra `sessoes` pelo usuário, mas as `contagens` da RPC
     ainda são globais. Calcular pelos cartões visíveis impede que a Tica veja
     o alerta da sessão desconectada da Kapri, por exemplo. Para admin, a lista
     contém toda a operação e produz os mesmos 10/9/1 do provedor. */
  const conectadas = sessoes.filter((item) => item.estado === "connected").length;
  const instaveis = sessoes.filter((item) => item.estado === "connecting").length;
  const desconectadas = sessoes.filter((item) => item.estado === "disconnected" || item.estado === "desconhecido").length;
  const arquivadas = painel?.arquivadas ?? [];
  const desatualizado = c ? !c.sincronizacao_fresca : false;
  // A RPC já filtra por capacidade: quem não pode ver tudo recebe `arquivadas`
  // vazio. Derivar daqui evita um segundo estado e um segundo round-trip.
  const isAdmin = arquivadas.length > 0;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: rpcError } = await getBrowserSupabaseClient().rpc("wa_v7_painel");
      if (rpcError) { setError("Não foi possível carregar o inventário de conexões."); return; }
      setPainel((data ?? null) as Painel | null);
    } catch { setError("Não foi possível carregar suas conexões."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, load]);

  /* V7.2 — exclusão física foi retirada da tela. Sessão que sai do provedor é
     ARQUIVADA automaticamente pelo inventário canônico (some da operação, some
     das contagens, o histórico continua). Apagar linha era irreversível e
     levava junto vínculos e credenciais. */

  const openQr = useCallback(async (inst: Sessao, restart = false) => {
    const legado = inst.legado_instancia_id;
    if (!legado) { setError("Esta sessão ainda não tem vínculo local; recarregue em alguns minutos."); return; }
    setQr({ id: legado, nome: inst.nome ?? inst.provider_session_id, status: "carregando", image: null }); setQrBusy(true);
    try {
      const { data } = await getBrowserSupabaseClient().functions.invoke("dapi-qr", { body: { action: restart ? "restart" : "qr", instanciaId: legado } });
      const result = (data ?? {}) as { status?: string; qrCodeImage?: string | null; conectada?: boolean; error?: string };
      setQr({ id: legado, nome: inst.nome ?? inst.provider_session_id, status: result.error || result.status || "desconhecido", image: result.qrCodeImage ?? null });
      if (result.conectada) await load();
    } catch { setQr((current) => current ? { ...current, status: "erro" } : current); }
    finally { setQrBusy(false); }
  }, [load]);
  useEffect(() => {
    if (!qr || qr.status === "connected" || qr.status === "erro") return;
    const timer = window.setTimeout(() => { const inst = sessoes.find((item) => item.legado_instancia_id === qr.id); if (inst) void openQr(inst); }, 4500);
    return () => window.clearTimeout(timer);
  }, [qr, sessoes, openQr]);


  return <div className="connections-workspace">
    {!loading && sessoes.length > 0 && <div className="conn-stats">
      <div className="conn-stat ok"><span>● Conectadas</span><strong>{conectadas}</strong></div>
      <div className="conn-stat warn"><span>● Instáveis</span><strong>{instaveis}</strong></div>
      <div className="conn-stat bad"><span>● Desconectadas</span><strong>{desconectadas}</strong></div>
    </div>}
    <header><div><span>CONFIGURAÇÕES</span><h1>Instâncias de WhatsApp</h1><p>{isAdmin ? "Todas as conexões da imobiliária." : "Suas instâncias de WhatsApp — conecte ou reconecte pelo QR."}</p></div><button type="button" onClick={() => void load()}>↻ Atualizar</button></header>
    {error && <div className="connections-error">{error}</div>}
    {desatualizado && <div className="connections-warn">⚠ Última sincronização com o D-API está atrasada. Os estados abaixo são o último snapshot completo válido — nada foi desconectado por causa disso.</div>}
    {desconectadas > 0 && <div className="connections-warn">⚠ {desconectadas} sessão{desconectadas === 1 ? "" : "es"} desconectada{desconectadas === 1 ? "" : "s"} no provedor — reconecte para não perder atendimentos.</div>}
    {loading ? <div className="connections-loading">Carregando conexões…</div> : <>
      <div className="connections-grid">{sessoes.map((inst) => { const conectada = inst.estado === "connected"; const unstable = inst.estado === "connecting"; return <article className={`conn-card ${conectada ? "connected" : unstable ? "unstable" : "off"}`} key={inst.sessao_id}><div className="conn-card-top"><span className="conn-status"><i />{conectada ? "CONECTADA" : inst.estado.toUpperCase()}</span><span className="conn-card-actions"><span className="conn-device" aria-hidden>▢</span></span></div><strong>{inst.nome ?? inst.provider_session_id}</strong>{inst.corretor_nome ? <small className="conn-num">👤 {inst.corretor_nome}</small> : <small className="conn-num">👤 sem vínculo operacional</small>}<small className="conn-sync">{inst.sincronizacao_fresca ? "Sincronizada agora" : "Estado conhecido · sincronização degradada"}</small><button type="button" onClick={() => void openQr(inst)}>{conectada ? "↻ Reconectar" : "▣ Conectar (QR)"}</button></article>; })}{!sessoes.length && <p className="connections-empty">Nenhuma sessão associada a você no inventário do provedor.</p>}</div>
      {isAdmin && arquivadas.length > 0 && <div className="connections-legacy"><h2>Registros legados arquivados ({arquivadas.length})</h2><p>Saíram do inventário do provedor. Não contam como conexão, não recebem envio e o histórico foi preservado.</p><ul>{arquivadas.map((a) => <li key={a.provider_session_id}><strong>{a.provider_session_id}</strong> — {a.motivo}</li>)}</ul></div>}
    </>}
    {qr && <div className="qr-modal-scrim" onClick={() => setQr(null)}><div className="qr-modal" onClick={(event) => event.stopPropagation()}><header><strong>Conectar · {qr.nome}</strong><button type="button" onClick={() => setQr(null)}>×</button></header>{qr.status === "connected" ? <div className="qr-connected">✓ Conectada com sucesso!</div> : qr.image ? <><img src={qr.image} alt="QR Code da instância" /><p>Abra o WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie. Atualiza sozinho.</p></> : <p className="qr-status">{qr.status === "carregando" ? "Gerando QR…" : qr.status === "erro" ? "Não foi possível gerar o QR. Verifique a apikey da instância." : `Status: ${qr.status}. Aguardando QR…`}</p>}<footer><button type="button" disabled={qrBusy} onClick={() => { const inst = sessoes.find((item) => item.legado_instancia_id === qr.id); if (inst) void openQr(inst, true); }}>Gerar novo QR</button><button type="button" onClick={() => setQr(null)}>Fechar</button></footer></div></div>}
  </div>;
}
