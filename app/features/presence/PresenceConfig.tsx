"use client";

import { useCallback, useEffect, useState } from "react";

type Config = { ativa: boolean; dias: string; hora_inicio: string; hora_fim: string; intervalo_min: number; prazo_seg: number; corretores: number[] | null };
type Broker = { id: number; nome: string };

/* Painel inline da Regra de Presença — vive dentro de Configurações. */
export function PresenceConfig({ accessToken }: { accessToken: string }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [todos, setTodos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setNotice("");
    try {
      const res = await fetch("/api/presenca?config=1", { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json() as { config?: Config; corretores?: Broker[]; error?: string };
      if (!res.ok) { setNotice(data.error || "Sem permissão."); return; }
      const c = data.config ?? { ativa: false, dias: "weekdays", hora_inicio: "09:00", hora_fim: "18:00", intervalo_min: 15, prazo_seg: 60, corretores: null };
      setCfg({ ...c, hora_inicio: (c.hora_inicio || "09:00").slice(0, 5), hora_fim: (c.hora_fim || "18:00").slice(0, 5) });
      setTodos(c.corretores == null);
      setBrokers(data.corretores ?? []);
    } catch { setNotice("Falha ao carregar a configuração."); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/presenca", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({
        action: "saveConfig", ativa: cfg.ativa, dias: cfg.dias, horaInicio: cfg.hora_inicio, horaFim: cfg.hora_fim,
        intervaloMin: cfg.intervalo_min, prazoSeg: cfg.prazo_seg, corretores: todos ? null : (cfg.corretores ?? []),
      }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setNotice(data.error || "Não foi possível salvar."); return; }
      setNotice(cfg.ativa ? "Regra de presença salva e ATIVA." : "Regra de presença salva (desligada).");
    } catch { setNotice("Falha ao salvar."); }
    finally { setBusy(false); }
  };

  const toggleBroker = (id: number) => setCfg((c) => c ? { ...c, corretores: (c.corretores ?? []).includes(id) ? (c.corretores ?? []).filter((x) => x !== id) : [...(c.corretores ?? []), id] } : c);

  if (!cfg) return <section className="settings-card"><p className="settings-hint">{notice || "Carregando a regra de presença…"}</p></section>;

  return <section className="settings-card settings-presence">
    <h2><span className="sc-ico shield">🛡</span>Regra de presença do corretor</h2>
    <p>Pergunta na tela do corretor, dentro da janela escolhida, se ele ainda está conectado. Se ele não confirmar no prazo, sai do ar (fica offline) e para de receber leads até entrar de novo.</p>
    <label className="presence-switch"><input type="checkbox" checked={cfg.ativa} onChange={(e) => setCfg({ ...cfg, ativa: e.target.checked })} /><div><strong>Regra {cfg.ativa ? "ATIVA" : "desligada"}</strong><small>Quando ativa, o pop-up aparece nos dias e horários abaixo para os corretores selecionados.</small></div></label>
    <div className="presence-cfg-grid">
      <label>Dias<select value={cfg.dias} onChange={(e) => setCfg({ ...cfg, dias: e.target.value })}><option value="weekdays">Seg a Sex</option><option value="saturday">Seg a Sáb</option><option value="all">Todos os dias</option></select></label>
      <label>Início<input type="time" value={cfg.hora_inicio} onChange={(e) => setCfg({ ...cfg, hora_inicio: e.target.value })} /></label>
      <label>Fim<input type="time" value={cfg.hora_fim} onChange={(e) => setCfg({ ...cfg, hora_fim: e.target.value })} /></label>
      <label>Perguntar a cada (min)<input type="number" min={1} value={cfg.intervalo_min} onChange={(e) => setCfg({ ...cfg, intervalo_min: Number(e.target.value) })} /></label>
      <label>Prazo p/ responder (seg)<input type="number" min={15} value={cfg.prazo_seg} onChange={(e) => setCfg({ ...cfg, prazo_seg: Number(e.target.value) })} /></label>
    </div>
    <div className="presence-scope">
      <label className="presence-switch small"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /><div><strong>Todos os corretores</strong><small>Desmarque para escolher exatamente quem entra na regra.</small></div></label>
      {!todos && <div className="presence-broker-list">{brokers.map((b) => <button type="button" key={b.id} className={(cfg.corretores ?? []).includes(b.id) ? "on" : ""} onClick={() => toggleBroker(b.id)}>{(cfg.corretores ?? []).includes(b.id) ? "✓ " : ""}{b.nome}</button>)}{!brokers.length && <span className="presence-empty">Nenhum corretor ativo.</span>}</div>}
    </div>
    {notice && <div className="presence-cfg-notice">{notice}</div>}
    <footer className="settings-form-footer"><span>Alterações são registradas na auditoria.</span><div><button type="button" className="presence-cfg-save settings-save" disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "✓ Salvar regra"}</button></div></footer>
  </section>;
}
