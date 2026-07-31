"use client";
/**
 * REVISÃO DA SARA — painel do admin (Fase 1 do item 1).
 *
 * Para que serve: transformar 47 sugestões que ninguém nunca julgou em um
 * PLACAR. Enquanto o placar não bater 85% em 50 decisões, o modo `assist` não
 * é destravado — a Sara continua sem mexer em nada sozinha.
 *
 * O corretor NÃO vê esta tela. No celular dele a Sara aparece só como uma linha
 * de orientação no card ("Sara: ligar hoje à tarde"), junto do botão verde do
 * WhatsApp. Julgar etapa não é trabalho de corretor.
 *
 * Contrato: aprovar/rejeitar NÃO move o lead, não confirma contato, não inicia
 * SLA e não conclui tarefa. Grava a decisão + evento auditável com
 * aplicado=false. Tudo via /api/ncrm/sara/*, com JWT do usuário.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { LOTE_MAX } from "../../../api/ncrm/sara/decidir/logica";

type Json = Record<string, unknown>;

export type ItemRevisao = {
  analise_id: number;
  negocio_id: number;
  lead_nome: string | null;
  etapa_real: string;
  etapa_na_analise: string | null;
  etapa_sugerida: string | null;
  proxima_acao_sugerida: string | null;
  prazo_sugerido: string | null;
  justificativa: string | null;
  evidencias: string[];
  confianca: number;
  analisado_em: string;
  estado_mudou: boolean;
  na_whitelist: boolean;
  classe: "avanco" | "regressao" | "nada_a_mudar" | "sem_sugestao";
};

/* Rótulos em português de gente. "regressao" na tela do gestor não ajuda. */
export const ROTULO_CLASSE: Record<ItemRevisao["classe"], string> = {
  avanco: "Avança a etapa",
  regressao: "Volta o lead para trás",
  nada_a_mudar: "Só sugere a próxima ação",
  sem_sugestao: "Sem sugestão de etapa",
};

export const COR_CLASSE: Record<ItemRevisao["classe"], string> = {
  avanco: "#16a34a",
  regressao: "#b45309",
  nada_a_mudar: "#6b7280",
  sem_sugestao: "#9ca3af",
};

const ETAPA: Record<string, string> = {
  novo: "Novo",
  tentando_contato: "Tentando contato",
  em_atendimento: "Em atendimento",
  em_acompanhamento: "Em acompanhamento",
};
const etapaRotulo = (e: string | null) => (e ? ETAPA[e] ?? e : "—");

/* null vira "—", não "0%": com 0 decisões a taxa volta nula do banco, e mostrar
   "Taxa geral: 0%" faria a Sara parecer reprovada antes de ser julgada. */
function pct(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}
function quando(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* -------------------------------- Placar -------------------------------- */
export function Placar({ p }: { p: Json | null }) {
  if (!p) return null;
  /* A barra mede a MESMA amostra do gatilho: decisões sobre transições da
     whitelist. Medir o total daria falsa sensação de progresso. */
  const decididas = Number(p.decididas_avanco ?? 0);
  const minima = Number((p.meta as Json)?.amostra_minima ?? 50);
  const taxaMin = Number((p.meta as Json)?.taxa_minima ?? 0.85);
  const atingiu = p.atingiu_meta === true;
  const progresso = Math.min(100, Math.round((decididas / Math.max(minima, 1)) * 100));

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12, background: atingiu ? "#f0fdf4" : "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b>Placar da Sara</b>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          Meta para soltar a Sara: {pct(taxaMin)} de aprovação em {minima} decisões
        </span>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "8px 0", fontSize: 13 }}>
        <span>Decididas: <b>{decididas}</b></span>
        <span>Aprovadas: <b style={{ color: "#16a34a" }}>{String(p.aprovadas ?? 0)}</b></span>
        <span>Rejeitadas: <b style={{ color: "#b91c1c" }}>{String(p.rejeitadas ?? 0)}</b></span>
        <span>Pendentes: <b>{String(p.pendentes ?? 0)}</b></span>
        <span>Taxa geral: <b>{pct(p.taxa_aprovacao)}</b></span>
        <span title="Só as transições que a whitelist do banco permite. É ESTA que decide a Fase 2 — a taxa geral é contaminada por regressões que o banco recusaria de qualquer forma.">
          Taxa nos avanços: <b>{pct(p.taxa_avanco)}</b> ({String(p.decididas_avanco ?? 0)} decididas)
        </span>
      </div>

      <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${progresso}%`, height: "100%", background: atingiu ? "#16a34a" : "#2563eb" }} />
      </div>

      <p style={{ fontSize: 12, margin: "8px 0 0", color: atingiu ? "#166534" : "#374151" }}>
        {atingiu
          ? "Meta atingida. Agora dá para avaliar o destravamento do modo assist — a Sara passa a atualizar a etapa sozinha e o corretor só executa a próxima ação."
          : `Faltam ${String(p.faltam_para_amostra ?? 0)} decisões sobre transições permitidas para fechar a amostra. Até lá a Sara permanece em ${String(p.modo_sara ?? "observer")} e não altera nada.`}
      </p>

      {Number(p.acoes_aplicadas ?? 0) > 0 && (
        <p style={{ fontSize: 12, color: "#b45309", margin: "4px 0 0" }}>
          Atenção: {String(p.acoes_aplicadas)} ação(ões) já aplicada(s) pela Sara. Esperado nesta fase: 0.
        </p>
      )}
    </div>
  );
}

/* --------------------------------- Card --------------------------------- */
function CardRevisao({ i, marcado, onMarcar, onDecidir, busy }: {
  i: ItemRevisao;
  marcado: boolean;
  onMarcar: (id: number, v: boolean) => void;
  onDecidir: (ids: number[], d: "aprovada" | "rejeitada") => void;
  busy: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <li style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 8, listStyle: "none" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => onMarcar(i.analise_id, e.target.checked)}
          aria-label={`Selecionar sugestão do lead ${i.lead_nome ?? i.negocio_id}`}
          style={{ marginTop: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 14 }}>{i.lead_nome ?? `Negócio ${i.negocio_id}`}</b>
            <span style={{ fontSize: 11, color: COR_CLASSE[i.classe], fontWeight: 600 }}>{ROTULO_CLASSE[i.classe]}</span>
          </div>

          <div style={{ fontSize: 13, margin: "4px 0" }}>
            {etapaRotulo(i.etapa_real)}
            {i.classe !== "nada_a_mudar" && i.classe !== "sem_sugestao" && (
              <> <span style={{ color: "#9ca3af" }}>→</span> <b>{etapaRotulo(i.etapa_sugerida)}</b></>
            )}
            <span style={{ color: "#6b7280", marginLeft: 8 }}>confiança {pct(i.confianca)}</span>
          </div>

          {i.proxima_acao_sugerida && (
            <div style={{ fontSize: 13, color: "#374151" }}>
              Próxima ação: <b>{i.proxima_acao_sugerida}</b>
              {i.prazo_sugerido && <span style={{ color: "#6b7280" }}> · {quando(i.prazo_sugerido)}</span>}
            </div>
          )}

          {i.justificativa && <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0" }}>{i.justificativa}</p>}

          {i.estado_mudou && (
            <p style={{ fontSize: 12, color: "#b45309", margin: "4px 0" }}>
              O lead mudou de etapa depois desta análise. Sugestão provavelmente vencida.
            </p>
          )}
          {i.classe === "regressao" && (
            <p style={{ fontSize: 12, color: "#b45309", margin: "4px 0" }}>
              O banco não permite esta transição nem com a Sara solta. Rejeitar aqui é sinal de ajuste no prompt dela.
            </p>
          )}

          {i.evidencias?.length > 0 && (
            <>
              <button type="button" className="nova-crm-btn ghost" style={{ fontSize: 11, marginTop: 4 }} onClick={() => setAberto((v) => !v)}>
                {aberto ? "Ocultar" : `Ver o que ela leu (${i.evidencias.length})`}
              </button>
              {aberto && (
                <ul style={{ fontSize: 12, color: "#374151", margin: "6px 0 0", paddingLeft: 18 }}>
                  {i.evidencias.map((e, k) => <li key={k}>{String(e)}</li>)}
                </ul>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" className="nova-crm-btn" disabled={busy} onClick={() => onDecidir([i.analise_id], "aprovada")}>
              Faz sentido
            </button>
            <button type="button" className="nova-crm-btn ghost" disabled={busy} onClick={() => onDecidir([i.analise_id], "rejeitada")}>
              Não faz sentido
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

/* -------------------------------- Painel -------------------------------- */
export function PainelSaraRevisao({ accessToken }: { accessToken: string }) {
  const [itens, setItens] = useState<ItemRevisao[] | null>(null);
  const [placar, setPlacar] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetch("/api/ncrm/sara/revisao", { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = (await r.json().catch(() => ({}))) as Json;
      if (!r.ok) {
        setErro(r.status === 403
          ? "Somente administradores revisam a Sara."
          : ((j.error as string) || (j.erro as string) || "Falha ao carregar a revisão."));
        setItens([]);
        return;
      }
      setItens(((j.itens as ItemRevisao[]) ?? []).map((i) => ({ ...i, evidencias: (i.evidencias ?? []) as string[] })));
      setPlacar((j.placar as Json) ?? null);
      setSel(new Set());
    } catch {
      /* Queda de rede não pode deixar a tela em "Carregando…" para sempre. */
      setErro("Sem conexão com o servidor.");
      setItens([]);
    }
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const decidir = useCallback(async (ids: number[], decisao: "aprovada" | "rejeitada") => {
    if (ids.length === 0) return;
    if (ids.length > LOTE_MAX) { setErro(`Máximo de ${LOTE_MAX} por vez.`); return; }
    setBusy(true); setAviso(null);
    const corpo = ids.length === 1 ? { analiseId: ids[0], decisao } : { analiseIds: ids, decisao };
    try {
      const r = await fetch("/api/ncrm/sara/decidir", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = (await r.json().catch(() => ({}))) as Json;
      if (!r.ok) { setErro((j.error as string) || (j.erro as string) || "Falha ao registrar a decisão."); return; }
      if (typeof j.falhas === "number" && j.falhas > 0) {
        setAviso(`${String(j.confirmadas ?? 0)} registrada(s), ${String(j.falhas)} sem permissão ou já decidida(s).`);
      }
      await carregar();
    } catch {
      setErro("Sem conexão com o servidor. Nada foi registrado.");
    } finally {
      setBusy(false);
    }
  }, [accessToken, carregar]);

  const marcar = useCallback((id: number, v: boolean) => {
    setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  }, []);

  const lista = itens ?? [];
  const marcados = useMemo(() => [...sel], [sel]);
  /* Selecionar tudo respeita o teto do banco. */
  const todosIds = useMemo(() => lista.slice(0, LOTE_MAX).map((i) => i.analise_id), [lista]);

  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b>Revisão da Sara (admin)</b>
        <button type="button" className="nova-crm-btn ghost" disabled={busy} onClick={() => void carregar()}>↻ Atualizar</button>
      </div>

      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
        Julgar aqui <b>não move nenhum lead</b>: não muda etapa, não marca contato, não inicia SLA e não conclui tarefa.
        Cada decisão vira evento auditável e alimenta o placar que autoriza a próxima fase.
      </p>

      <Placar p={placar} />

      {erro && <p style={{ color: "#b91c1c" }}>{erro}</p>}
      {aviso && <p style={{ color: "#b45309", fontSize: 13 }}>{aviso}</p>}

      {itens === null && <p style={{ fontSize: 13, color: "#6b7280" }}>Carregando…</p>}
      {itens !== null && lista.length === 0 && !erro && (
        <p style={{ fontSize: 13, color: "#6b7280" }}>Nada para revisar. Quando a Sara analisar novas conversas, aparecem aqui.</p>
      )}

      {lista.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="nova-crm-btn ghost" disabled={busy} onClick={() => setSel(new Set(todosIds))}>
              Selecionar {todosIds.length}
            </button>
            <button type="button" className="nova-crm-btn ghost" disabled={busy || marcados.length === 0} onClick={() => setSel(new Set())}>
              Limpar
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="nova-crm-btn" disabled={busy || marcados.length === 0} onClick={() => void decidir(marcados, "aprovada")}>
              Faz sentido ({marcados.length})
            </button>
            <button type="button" className="nova-crm-btn ghost" disabled={busy || marcados.length === 0} onClick={() => void decidir(marcados, "rejeitada")}>
              Não faz sentido ({marcados.length})
            </button>
          </div>

          <ul style={{ margin: 0, padding: 0 }}>
            {lista.map((i) => (
              <CardRevisao key={i.analise_id} i={i} marcado={sel.has(i.analise_id)} onMarcar={marcar} onDecidir={decidir} busy={busy} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
