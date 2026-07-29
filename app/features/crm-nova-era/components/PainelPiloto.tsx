"use client";
/**
 * Painel administrativo do piloto (Fase 3, Regras 6 e 7) + Diagnóstico legado (Regra 1).
 * Visível SOMENTE para admin/executivo. Só leitura + operações autorizadas via endpoints
 * autenticados (nunca service_role). A ativação exige modal com confirmação DIGITADA,
 * mostra o corte, explica que NÃO há backfill, é idempotente e mostra o id de auditoria.
 * Não ativa Sara em execute. Nenhuma ação Nova Era é habilitada sobre itens legados.
 */
import { useCallback, useEffect, useState } from "react";

type Json = Record<string, unknown>;
async function get(path: string, token: string): Promise<{ ok: boolean; json: Json }> {
  const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { ok: r.ok, json };
}
async function post(path: string, token: string, body: Json): Promise<{ ok: boolean; json: Json }> {
  const r = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await r.json().catch(() => ({}))) as Json;
  return { ok: r.ok, json };
}
function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" && !Number.isNaN(Date.parse(v)) && v.includes("T")) return new Date(v).toLocaleString("pt-BR");
  return String(v);
}

/* ------------------------- Modal de ativação (Regra 6) ------------------------- */
function ModalAtivacao({ token, ativo, onFechar, onMudou }: { token: string; ativo: boolean; onFechar: () => void; onMudou: () => void }) {
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const corte = new Date().toLocaleString("pt-BR");
  const confirmado = texto.trim().toUpperCase() === "ATIVAR";

  const ativar = useCallback(async () => {
    setBusy(true); setErro(null);
    const { ok, json } = await post("/api/ncrm/ingest", token, { action: "ativar" });
    setBusy(false);
    if (!ok) { setErro((json.mensagem as string) || (json.error as string) || "Falha ao ativar."); return; }
    setResultado(`Ingest ativado. ativo_desde=${fmt(json.ativo_desde)}`);
    onMudou();
  }, [token, onMudou]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 20, width: 460, maxWidth: "92vw", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
        <h3 style={{ marginTop: 0 }}>Ativar ingestão a partir de agora</h3>
        {ativo ? (
          <p>O ingest já está <b>ativo</b>. A ativação é idempotente — não é possível ativar novamente.</p>
        ) : (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              A ativação define o <b>corte agora</b> (<b>{corte}</b>). <b>NÃO há backfill</b>: apenas mensagens novas ou
              atualizadas <b>após o corte</b> serão reconciliadas. Os alertas da carteira antiga <b>não</b> são migrados
              automaticamente. A Sara <b>permanece em observação</b> (não é ligada em execute).
            </p>
            <label style={{ fontSize: 13 }}>Digite <b>ATIVAR</b> para confirmar
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ATIVAR" style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
            {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}
            {resultado && <p style={{ color: "#16a34a" }}>{resultado}</p>}
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="nova-crm-btn ghost" onClick={onFechar}>Fechar</button>
          {!ativo && !resultado && (
            <button className="nova-crm-btn" disabled={!confirmado || busy} onClick={() => void ativar()}>Confirmar ativação</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Diagnóstico legado (Regra 1) ------------------------- */
export function DiagnosticoLegado({ accessToken }: { accessToken: string }) {
  const [d, setD] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const { ok, json } = await get("/api/ncrm/diagnostico-legado", accessToken);
    if (!ok) { setErro((json.error as string) || "Falha ao carregar diagnóstico."); return; }
    setErro(null); setD(json);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const diag = (d?.diagnostico ?? null) as Json | null;
  const faixas = (diag?.porFaixa ?? {}) as Record<string, number>;
  const rot: Record<string, string> = { sem_atraso: "Sem atraso/futuro", ate_24h: "Até 24h", de_24_48h: "24–48h", de_48_72h: "48–72h", mais_72h: "+72h" };
  return (
    <div style={{ border: "1px dashed #9ca3af", borderRadius: 8, padding: 12, marginTop: 12, background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Diagnóstico da carteira antiga — ainda não migrada</b>
        <span style={{ fontSize: 11, color: "#6b7280" }}>Somente leitura · sem ações do CRM Nova Era</span>
      </div>
      {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}
      {diag && (
        <>
          <p style={{ fontSize: 12, color: "#374151", margin: "6px 0" }}>
            Total legado considerado: <b>{fmt(diag.totalConsiderado)}</b> · já migrados (excluídos p/ evitar dupla contagem): <b>{fmt(diag.ignoradosJaMigrados)}</b>
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.keys(rot).map((k) => (
              <span key={k} style={{ fontSize: 12 }}>{rot[k]}: <b>{faixas[k] ?? 0}</b></span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{fmt(d?.observacao)}</p>
        </>
      )}
    </div>
  );
}

/* ------------------------- Painel do piloto (Regra 7) ------------------------- */
export function PainelPiloto({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<Json | null>(null);
  const [sara, setSara] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const [a, b] = await Promise.all([get("/api/ncrm/admin/status", accessToken), get("/api/ncrm/sara/modo", accessToken)]);
    if (!a.ok && !b.ok) setErro((a.json.error as string) || "Falha ao carregar o painel (migrations podem não estar aplicadas).");
    setStatus(a.ok ? a.json : null);
    setSara(b.ok ? b.json : null);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const definirModo = useCallback(async (modo: string) => {
    setBusy(true);
    const { ok, json } = await post("/api/ncrm/sara/modo", accessToken, { modo });
    setBusy(false);
    if (!ok) { setErro((json.mensagem as string) || (json.error as string) || "Falha ao definir modo."); return; }
    await carregar();
  }, [accessToken, carregar]);

  const ingest = (status?.ingest ?? {}) as Json;
  const ck = (status?.checkpoints ?? {}) as Json;
  const op = (status?.operacional ?? {}) as Json;
  const saraModo = (sara?.modo as string) ?? (((status?.sara ?? {}) as Json).modo as string) ?? "—";
  const ativo = ingest.ativo === true;
  const erros = (status?.erros_recentes ?? []) as unknown[];

  const linha = (k: string, v: unknown) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 13 }}><span style={{ color: "#6b7280" }}>{k}</span><b>{fmt(v)}</b></div>
  );

  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b>Painel do piloto (admin)</b>
        <button className="nova-crm-btn ghost" disabled={busy} onClick={() => void carregar()}>↻ Atualizar</button>
      </div>
      {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Ingestão</div>
          {linha("Status", ativo ? "ATIVO" : "Desligado")}
          {linha("Corte (ativo_desde)", ingest.ativo_desde)}
          {linha("Última execução", ck.ultima_execucao)}
          {linha("Último checkpoint", ck.ultimo_checkpoint_id)}
          {linha("Ingeridos (processados)", ck.processados)}
          {linha("Ignorados (noop)", ck.noop)}
          {linha("Com erro", ck.erros)}
          {linha("Fila de reconciliação", ck.fila_reconciliacao)}
          <div style={{ marginTop: 8 }}>
            <button className="nova-crm-btn" disabled={ativo} onClick={() => setModal(true)}>
              {ativo ? "Ingest já ativo" : "Ativar a partir de agora"}
            </button>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Operacional / Sara</div>
          {linha("Estados (carteira Nova Era)", op.estados)}
          {linha("Eventos ncrm", op.eventos)}
          {linha("Propostas ncrm", op.propostas)}
          {linha("Modo da Sara", saraModo)}
          {linha("Análises Sara", ((sara?.analises_total ?? ((status?.sara ?? {}) as Json).analises_total)))}
          {linha("Sugestões pendentes", ((sara?.analises_pendentes ?? ((status?.sara ?? {}) as Json).analises_pendentes)))}
          <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Modo Sara:</span>
            {["off", "observer", "suggest"].map((m) => (
              <button key={m} className={`nova-crm-btn ghost${saraModo === m ? " on" : ""}`} disabled={busy} onClick={() => void definirModo(m)}>{m}</button>
            ))}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>execute bloqueado nesta fase</span>
          </div>
        </div>
      </div>

      {Array.isArray(erros) && erros.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Erros recentes ({erros.length})</div>
          <ul style={{ fontSize: 12, color: "#b91c1c", margin: "4px 0 0", paddingLeft: 18 }}>
            {erros.slice(0, 5).map((e, i) => <li key={i}>{fmt((e as Json).ultimo_erro)} · negócio {fmt((e as Json).negocio_id)}</li>)}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 10, borderTop: "1px dashed #e5e7eb", paddingTop: 8, fontSize: 12, color: "#374151" }}>
        <b>Rollout controlado (Fase 5)</b>
        <p style={{ margin: "4px 0" }}>
          Pilotos: canário compilado (Samuel) + allowlist via <code>CRM_NOVA_ERA_ALLOWLIST</code>.
          Allowlist vazia = somente Samuel. O CRM antigo continua disponível para todos.
        </p>
        <p style={{ margin: "4px 0", color: "#6b7280" }}>
          Classificação assistida da carteira antiga pela Sara: <b>preparada, não executada</b> — depende de
          autorização futura. Nenhuma migração em massa é feita por este painel.
        </p>
      </div>

      {modal && <ModalAtivacao token={accessToken} ativo={ativo} onFechar={() => setModal(false)} onMudou={() => void carregar()} />}
    </div>
  );
}
