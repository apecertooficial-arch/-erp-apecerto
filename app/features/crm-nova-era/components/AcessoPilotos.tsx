"use client";
/**
 * ACESSO AO CRM NOVA ERA (Fase 6) — liberação de pilotos POR NOME.
 * ------------------------------------------------------------------
 * O admin busca o usuário pelo nome e clica em Liberar/Remover; o identificador
 * é interno (nunca digitado). Samuel permanece sempre autorizado. Toda mudança
 * é auditada no banco e respeita o limite configurável (padrão: 2 pilotos).
 */
import { useCallback, useEffect, useMemo, useState } from "react";

type Json = Record<string, unknown>;
type Usuario = {
  usuario_id: string; nome: string | null; papel: string | null; equipe: string | null;
  status: string; acesso: "sempre" | "admin" | "piloto" | "sem_acesso"; ultimo_acesso: string | null;
};

const ACESSO_ROTULO: Record<string, { txt: string; cor: string }> = {
  sempre: { txt: "Sempre autorizado", cor: "#1d4ed8" },
  admin: { txt: "Administrador", cor: "#7c3aed" },
  piloto: { txt: "Piloto liberado", cor: "#16a34a" },
  sem_acesso: { txt: "Sem acesso", cor: "#6b7280" },
};

export function AcessoPilotos({ accessToken }: { accessToken: string }) {
  const [dados, setDados] = useState<Json | null>(null);
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/ncrm/pilotos", { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    if (!r.ok) { setMsg((j.error as string) || "Falha ao carregar os usuários."); return; }
    setDados(j);
  }, [accessToken]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const agir = useCallback(async (action: string, extra: Json) => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/ncrm/pilotos", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const j = (await r.json().catch(() => ({}))) as Json;
    setBusy(false);
    if (!r.ok) {
      const erro = String(j.erro ?? "");
      setMsg(erro === "limite_atingido" ? `Limite de pilotos atingido (${j.limite}). Remova alguém ou aumente o limite.`
        : erro === "usuario_sempre_autorizado" ? "Este usuário é sempre autorizado e não pode ser removido."
        : erro === "nao_era_piloto" ? "Este usuário não estava liberado como piloto."
        : (j.error as string) || "Não foi possível concluir.");
      return;
    }
    setMsg("Acesso atualizado e registrado na auditoria.");
    await carregar();
  }, [accessToken, carregar]);

  const usuarios = (dados?.usuarios ?? []) as Usuario[];
  const limite = Number(dados?.limite ?? 2);
  const ativos = Number(dados?.pilotos_ativos ?? 0);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q ? usuarios.filter((u) => (u.nome ?? "").toLowerCase().includes(q)) : usuarios;
    return base.slice(0, 40);
  }, [usuarios, busca]);

  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <b>Acesso ao CRM Nova Era</b>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          {ativos} de {limite} piloto(s) · o administrador e o responsável pelo piloto têm acesso permanente
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", flexWrap: "wrap" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa pelo nome…"
          style={{ flex: 1, minWidth: 220, padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }} />
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          Limite de pilotos
          <input type="number" min={0} max={50} defaultValue={limite} disabled={busy} style={{ width: 70 }}
            onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== limite) void agir("limite", { limite: v }); }} />
        </label>
        <button className="nova-crm-btn ghost" onClick={() => void carregar()}>↻</button>
      </div>

      {msg && <p style={{ fontSize: 12, color: msg.includes("atualizado") ? "#16a34a" : "#b91c1c" }}>{msg}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#6b7280" }}>
              <th style={{ padding: 6 }}>Nome</th><th>Papel</th><th>Equipe</th><th>Situação</th><th>Acesso</th><th>Último acesso</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => {
              const a = ACESSO_ROTULO[u.acesso] ?? ACESSO_ROTULO.sem_acesso;
              return (
                <tr key={u.usuario_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 6, fontWeight: 600 }}>{u.nome ?? "—"}</td>
                  <td>{u.papel ?? "—"}</td>
                  <td>{u.equipe ?? "—"}</td>
                  <td>{u.status}</td>
                  <td><span style={{ color: a.cor, fontWeight: 700 }}>{a.txt}</span></td>
                  <td>{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString("pt-BR") : "nunca"}</td>
                  <td style={{ textAlign: "right" }}>
                    {u.acesso === "sem_acesso" && (
                      <button className="nova-crm-btn" disabled={busy} onClick={() => void agir("liberar", { usuarioId: u.usuario_id })}>Liberar</button>
                    )}
                    {u.acesso === "piloto" && (
                      <button className="nova-crm-btn ghost" disabled={busy} onClick={() => void agir("remover", { usuarioId: u.usuario_id })}>Remover</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
        Corretor liberado enxerga apenas a própria carteira; gerente enxerga a equipe autorizada. A empresa inteira nunca é liberada automaticamente.
        O CRM de produção continua disponível para todos.
      </p>
    </div>
  );
}
