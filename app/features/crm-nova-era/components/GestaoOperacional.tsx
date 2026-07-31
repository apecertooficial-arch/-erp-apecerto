"use client";
/**
 * GESTÃO OPERACIONAL (Fase 5, Etapas D/E): aderência por corretor + totais reais do banco
 * (ncrm_gestao_painel; nunca só os cards carregados) + configuração de cadência (admin).
 * Fiscaliza sem punir: aderência classificada, escalonamento sinalizado, drill-down por corretor.
 */
import { useCallback, useEffect, useState } from "react";

type Json = Record<string, unknown>;

async function get(path: string, token: string): Promise<{ ok: boolean; json: Json }> {
  const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  return { ok: r.ok, json: (await r.json().catch(() => ({}))) as Json };
}
async function post(path: string, token: string, body: Json): Promise<{ ok: boolean; json: Json }> {
  const r = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, json: (await r.json().catch(() => ({}))) as Json };
}

const ADERENCIA_ROTULO: Record<string, { txt: string; cor: string; fundo: string }> = {
  em_dia: { txt: "Em dia", cor: "#16a34a", fundo: "#e8f7ef" },
  atencao: { txt: "Atenção", cor: "#a16207", fundo: "#fdf3e2" },
  critico: { txt: "Crítico", cor: "#b91c1c", fundo: "#fdeaea" },
};

export function GestaoOperacional({ accessToken, onDrill }: { accessToken: string; onDrill: (corretorId: number) => void }) {
  const [dados, setDados] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { ok, json } = await get("/api/ncrm/gestao", accessToken);
    if (!ok) { setErro((json.error as string) || "Falha ao carregar a gestão."); return; }
    setErro(null); setDados(json);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const tot = (dados?.totais ?? {}) as Json;
  const corretores = (dados?.corretores ?? []) as Json[];

  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b>Operação — aderência à cadência</b>
        <button className="nova-crm-btn ghost" onClick={() => void carregar()}>↻ Atualizar</button>
      </div>
      {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}

      {dados && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
            <span>Ativos: <b>{String(tot.ativos ?? 0)}</b></span>
            <span>Taxa de resposta: <b>{String(tot.taxa_resposta_pct ?? 0)}%</b></span>
            <span>Visitas: <b>{String(tot.visitas ?? 0)}</b></span>
            <span>Propostas (não venda): <b>{String(tot.propostas ?? 0)}</b></span>
            <span>Sara pendentes: <b>{String(tot.sara_pendentes ?? 0)}</b></span>
            <span>Sara aprovadas/rejeitadas: <b>{String(tot.sara_aprovadas ?? 0)}/{String(tot.sara_rejeitadas ?? 0)}</b></span>
            <span>Justificativas (7d): <b>{String(tot.justificativas_7d ?? 0)}</b></span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#6b7280" }}>
                  <th style={{ padding: 6 }}>Corretor</th><th>Carteira</th><th>Novos</th><th>Respondidos</th>
                  <th>Aguardando</th><th>Atrasados</th><th>Sem próx. ação</th><th>SLA 1ª resposta</th>
                  <th>Escalar</th><th>Aderência</th><th></th>
                </tr>
              </thead>
              <tbody>
                {corretores.map((c) => {
                  const ad = ADERENCIA_ROTULO[String(c.aderencia)] ?? ADERENCIA_ROTULO.em_dia;
                  return (
                    <tr key={String(c.corretor_id)} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 6, fontWeight: 600 }}>{String(c.corretor_nome ?? "—")}</td>
                      <td>{String(c.carteira_ativa ?? 0)}</td>
                      <td>{String(c.novos ?? 0)}</td>
                      <td>{String(c.respondidos ?? 0)}</td>
                      <td>{String(c.aguardando_corretor ?? 0)}</td>
                      <td style={{ color: Number(c.atrasados) > 0 ? "#b91c1c" : undefined }}>{String(c.atrasados ?? 0)}</td>
                      <td>{String(c.sem_proxima_acao ?? 0)}</td>
                      <td>{Number(c.sla_min_medio ?? 0).toFixed(0)} min</td>
                      <td style={{ color: Number(c.escalar) > 0 ? "#b91c1c" : undefined }}>{String(c.escalar ?? 0)}</td>
                      <td><span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: ad.cor, background: ad.fundo }}>{ad.txt}</span></td>
                      <td><button className="nova-crm-btn ghost" onClick={() => onDrill(Number(c.corretor_id))}>Abrir leads</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            Agregação real do banco (RLS por papel). Escalonamento sinaliza itens vencidos além do limite configurado — sem punição automática e sem bloqueio de WhatsApp.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------- Configuração de cadência (admin; auditada) ------------------- */
export function CadenciaConfig({ accessToken }: { accessToken: string }) {
  const [cfg, setCfg] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    const { ok, json } = await get("/api/ncrm/cadencia-config", accessToken);
    if (!ok) { setErro((json.error as string) || "Falha ao carregar a configuração."); return; }
    setErro(null); setCfg(json);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = useCallback(async (patch: Json) => {
    setBusy(true); setMsg(null);
    const { ok, json } = await post("/api/ncrm/cadencia-config", accessToken, patch);
    setBusy(false);
    if (!ok) { setMsg((json.erro as string) || (json.error as string) || "Falha ao salvar."); return; }
    setCfg(json); setMsg("Configuração salva (auditada).");
  }, [accessToken]);

  if (!cfg) return <div style={{ fontSize: 12, color: "#6b7280" }}>{erro ?? "Carregando configuração…"}</div>;

  const num = (k: string) => Number(cfg[k] ?? 0);
  const campo = (k: string, rotulo: string, min: number, max: number) => (
    <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
      {rotulo}
      <input type="number" min={min} max={max} defaultValue={num(k)} disabled={busy}
        onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== num(k)) void salvar({ [k]: v }); }}
        style={{ width: 90 }} />
    </label>
  );

  return (
    <div style={{ border: "1px dashed #9ca3af", borderRadius: 8, padding: 12, marginTop: 12 }}>
      <b style={{ fontSize: 13 }}>Cadência — configuração (admin)</b>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
        {campo("max_tentativas", "Máx. tentativas", 1, 12)}
        {campo("hora_inicio", "Hora início", 0, 23)}
        {campo("hora_fim", "Hora fim", 1, 24)}
        {campo("tolerancia_min", "Tolerância (min)", 0, 240)}
        {campo("escalonar_apos_horas", "Escalonar após (h)", 1, 168)}
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
        Intervalos atuais (min): {JSON.stringify(cfg.intervalos_min)} · dias úteis: {JSON.stringify(cfg.dias_uteis)} · TZ America/Sao_Paulo.
        Prazos são ajustados para dentro da janela comercial. Nenhum disparo automático novo é criado por esta configuração.
      </p>
      {msg && <p style={{ fontSize: 12, color: msg.includes("salva") ? "#16a34a" : "#b91c1c" }}>{msg}</p>}
    </div>
  );
}
