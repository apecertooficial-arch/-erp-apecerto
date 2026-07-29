"use client";
/**
 * CARTEIRA ANTIGA — classificação assistida (Fase 6 PR B). Centro administrativo separado.
 * A prévia é SOMENTE LEITURA: não cria atendimento, não move negócio, não envia mensagem,
 * não altera o CRM antigo, não cria visita/proposta e não altera venda.
 * A migração só acontece item a item, com confirmação digitada. Não existe "aprovar todos".
 */
import { useCallback, useState } from "react";

type Analise = {
  resumo: string | null; etapa_sugerida: string | null; temperatura: string | null; risco: string | null;
  proxima_acao: string | null; prazo: string | null; justificativa: string | null;
  evidencias: string[]; confianca: number | null; contexto_qualidade: string; evidencia_insuficiente: boolean;
  versao_modelo: string | null; analisado_em: string | null;
};
type Item = {
  negocio_id: number; cliente: string | null; corretor: string; etapa_antiga: string; origem: string | null;
  ultima_interacao: string | null; mensagens: number; respondeu: boolean; tem_conversa: boolean;
  tem_transcricao: boolean; audios_sem_transcricao: number; ja_migrado: boolean; analise: Analise | null;
};

const ETAPAS = [
  { v: "novo", t: "Novo" }, { v: "tentando_contato", t: "Tentando contato" },
  { v: "em_atendimento", t: "Em atendimento" }, { v: "em_acompanhamento", t: "Em acompanhamento" },
];
const TIPOS = [
  { v: "retornar_contato", t: "Retornar contato" }, { v: "entender_necessidade", t: "Entender a necessidade" },
  { v: "enviar_opcoes", t: "Enviar opções" }, { v: "ligar_retorno", t: "Ligar de retorno" },
  { v: "agendar_visita", t: "Agendar visita" }, { v: "preparar_proposta", t: "Preparar proposta" },
  { v: "avaliar_descarte", t: "Avaliar descarte" }, { v: "outro", t: "Outro" },
];
const QUALIDADE: Record<string, string> = { insuficiente: "Sem base suficiente", parcial: "Base parcial", boa: "Base boa" };

function dataCurta(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function emDiasISO(dias: number): string {
  const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(10, 0, 0, 0); return d.toISOString();
}

export function CarteiraAntiga({ accessToken }: { accessToken: string }) {
  const [filtros, setFiltros] = useState({ busca: "", corretor: "", respondeu: "", conversa: "", atraso_horas: "", quantidade: "10" });
  const [itens, setItens] = useState<Item[] | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [ajustes, setAjustes] = useState<Record<number, { etapa: string; tipo: string; titulo: string; prazo: string }>>({});
  const [confirmacao, setConfirmacao] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const gerarPrevia = useCallback(async () => {
    setOcupado("previa"); setErro(null); setMsg(null);
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v.trim()) p.set(k, v.trim());
    const r = await fetch(`/api/ncrm/carteira-antiga?${p.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as { itens?: Item[]; error?: string; erro?: string };
    setOcupado(null);
    if (!r.ok) { setErro(j.error ?? j.erro ?? "Não foi possível gerar a prévia."); return; }
    setItens(j.itens ?? []); setSel(new Set());
    setMsg(`Prévia gerada com ${(j.itens ?? []).length} cliente(s). Nada foi alterado.`);
  }, [accessToken, filtros]);

  const pedirLeitura = useCallback(async () => {
    const ids = Array.from(sel);
    if (ids.length === 0) { setErro("Selecione ao menos um cliente."); return; }
    setOcupado("analise"); setErro(null); setMsg(null);
    const r = await fetch("/api/ncrm/carteira-antiga", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "analisar", negocios: ids }),
    });
    const j = (await r.json().catch(() => ({}))) as { analisados?: number; error?: string; erro?: string };
    setOcupado(null);
    if (!r.ok) { setErro(j.error ?? j.erro ?? "A Sara não conseguiu ler agora."); return; }
    setMsg(`Leitura concluída para ${j.analisados ?? 0} de ${ids.length} cliente(s).`);
    await gerarPrevia();
  }, [accessToken, sel, gerarPrevia]);

  const aprovar = useCallback(async (it: Item) => {
    const a = ajustes[it.negocio_id] ?? {
      etapa: it.analise?.etapa_sugerida ?? "em_acompanhamento",
      tipo: "retornar_contato",
      titulo: it.analise?.proxima_acao ?? "",
      prazo: it.analise?.prazo ?? emDiasISO(1),
    };
    if (!a.titulo.trim()) { setErro("Escreva a próxima ação antes de migrar."); return; }
    setOcupado(`aprovar-${it.negocio_id}`); setErro(null); setMsg(null);
    const r = await fetch("/api/ncrm/carteira-antiga", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "aprovar", negocioId: it.negocio_id, etapa: a.etapa, proximaTipo: a.tipo,
        proximaTitulo: a.titulo.trim(), prazo: a.prazo, confirmacao: confirmacao[it.negocio_id] ?? "",
      }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; erro?: string };
    setOcupado(null);
    if (!r.ok || j.ok === false) {
      const e = j.erro ?? j.error ?? "";
      setErro(e === "confirmacao_obrigatoria" ? "Digite MIGRAR para confirmar este cliente."
        : e === "ja_existe_atendimento" ? "Este cliente já está no CRM Nova Era."
        : "Não foi possível migrar este cliente.");
      return;
    }
    setMsg("Cliente migrado. Ele continua igual no CRM antigo.");
    await gerarPrevia();
  }, [accessToken, ajustes, confirmacao, gerarPrevia]);

  const campo = (k: keyof typeof filtros, rotulo: string, tipo = "text") => (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
      {rotulo}
      <input type={tipo} value={filtros[k]} onChange={(e) => setFiltros((f) => ({ ...f, [k]: e.target.value }))}
        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, minWidth: 130 }} />
    </label>
  );

  return (
    <section style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 12 }}>
      <header>
        <h3 style={{ margin: 0, fontSize: 16 }}>Carteira antiga</h3>
        <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 13 }}>
          Gere uma prévia de até 10 clientes por vez para decidir quais valem entrar no CRM Nova Era.
          A prévia não altera nada: nenhum cliente é movido, nenhuma mensagem é enviada e o CRM antigo continua igual.
        </p>
      </header>

      <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 12, background: "#fff",
                    display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        {campo("busca", "Nome do cliente")}
        {campo("corretor", "Corretor (código)")}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
          Respondeu?
          <select value={filtros.respondeu} onChange={(e) => setFiltros((f) => ({ ...f, respondeu: e.target.value }))}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
            <option value="">Todos</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
          Tem conversa?
          <select value={filtros.conversa} onChange={(e) => setFiltros((f) => ({ ...f, conversa: e.target.value }))}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
            <option value="">Todos</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
        {campo("atraso_horas", "Parado há (horas)", "number")}
        <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
          Quantidade (máx. 10)
          <input type="number" min={1} max={10} value={filtros.quantidade}
            onChange={(e) => setFiltros((f) => ({ ...f, quantidade: e.target.value }))}
            style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, width: 90 }} />
        </label>
        <button className="nova-crm-btn" disabled={ocupado === "previa"} onClick={() => void gerarPrevia()}>
          {ocupado === "previa" ? "Gerando…" : "Gerar prévia"}
        </button>
      </div>

      {erro && <p style={{ color: "#b91c1c", fontSize: 12.5, margin: 0 }}>{erro}</p>}
      {msg && <p style={{ color: "#166534", fontSize: 12.5, margin: 0 }}>{msg}</p>}

      {itens && itens.length === 0 && (
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Nenhum cliente encontrado com esses filtros.</p>
      )}

      {itens && itens.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "#475569" }}>{sel.size} selecionado(s)</span>
          <button className="nova-crm-btn ghost" disabled={ocupado === "analise" || sel.size === 0} onClick={() => void pedirLeitura()}>
            {ocupado === "analise" ? "A Sara está lendo…" : "Pedir leitura da Sara"}
          </button>
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {(itens ?? []).map((it) => {
          const a = it.analise;
          const aj = ajustes[it.negocio_id] ?? {
            etapa: a?.etapa_sugerida ?? "em_acompanhamento", tipo: "retornar_contato",
            titulo: a?.proxima_acao ?? "", prazo: a?.prazo ?? emDiasISO(1),
          };
          const mudou = a?.etapa_sugerida && aj.etapa !== a.etapa_sugerida;
          return (
            <li key={it.negocio_id} style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 12, background: "#fff" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <input type="checkbox" checked={sel.has(it.negocio_id)} disabled={it.ja_migrado}
                  aria-label={`Selecionar ${it.cliente ?? "cliente"}`}
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(it.negocio_id)) n.delete(it.negocio_id); else n.add(it.negocio_id); return n; })}
                  style={{ width: 16, height: 16, marginTop: 3, cursor: "pointer" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <b style={{ fontSize: 14 }}>{it.cliente ?? "Sem nome"}</b>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{it.corretor} · {it.etapa_antiga}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>último contato {dataCurta(it.ultima_interacao)}</span>
                    {it.ja_migrado && <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", background: "#dcfce7", borderRadius: 999, padding: "1px 8px" }}>já migrado</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {it.mensagens} mensagem(ns) · {it.respondeu ? "o cliente já respondeu" : "o cliente nunca respondeu"}
                    {it.audios_sem_transcricao > 0 && ` · ${it.audios_sem_transcricao} áudio(s) sem transcrição`}
                  </div>

                  {!a && <p style={{ fontSize: 12.5, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "6px 10px", margin: "8px 0 0" }}>
                    Ainda sem leitura da Sara. Selecione e peça a leitura para ver a sugestão.
                  </p>}

                  {a && (
                    <div style={{ marginTop: 8, borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                      {a.evidencia_insuficiente && (
                        <p style={{ fontSize: 12.5, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "6px 10px", margin: "0 0 8px" }}>
                          A conversa não dá base suficiente para uma conclusão. Confie na sua leitura antes de migrar.
                        </p>
                      )}
                      {a.resumo && <p style={{ margin: "0 0 6px", fontSize: 13 }}>{a.resumo}</p>}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                        <span>Sugestão: <b>{ETAPAS.find((e) => e.v === a.etapa_sugerida)?.t ?? "—"}</b></span>
                        <span>Temperatura: <b>{a.temperatura ?? "—"}</b></span>
                        <span>Risco de esfriar: <b>{a.risco ?? "—"}</b></span>
                        <span>Confiança: <b>{a.confianca === null ? "—" : `${Math.round(a.confianca * 100)}%`}</b></span>
                        <span>{QUALIDADE[a.contexto_qualidade] ?? a.contexto_qualidade}</span>
                      </div>
                      {a.justificativa && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#334155" }}>Por quê: {a.justificativa}</p>}
                      {a.evidencias.length > 0 && (
                        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "#475569" }}>
                          {a.evidencias.slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {!it.ja_migrado && (
                    <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
                        Etapa
                        <select value={aj.etapa} onChange={(e) => setAjustes((m) => ({ ...m, [it.negocio_id]: { ...aj, etapa: e.target.value } }))}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
                          {ETAPAS.map((e) => <option key={e.v} value={e.v}>{e.t}</option>)}
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
                        Tipo da próxima ação
                        <select value={aj.tipo} onChange={(e) => setAjustes((m) => ({ ...m, [it.negocio_id]: { ...aj, tipo: e.target.value } }))}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13 }}>
                          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569", flex: 1, minWidth: 200 }}>
                        Próxima ação
                        <input value={aj.titulo} placeholder="O que será feito, em uma frase"
                          onChange={(e) => setAjustes((m) => ({ ...m, [it.negocio_id]: { ...aj, titulo: e.target.value } }))}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13 }} />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
                        Digite MIGRAR
                        <input value={confirmacao[it.negocio_id] ?? ""} placeholder="MIGRAR"
                          onChange={(e) => setConfirmacao((c) => ({ ...c, [it.negocio_id]: e.target.value }))}
                          style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, width: 110 }} />
                      </label>
                      <button className="nova-crm-btn" disabled={ocupado === `aprovar-${it.negocio_id}`} onClick={() => void aprovar(it)}>
                        {ocupado === `aprovar-${it.negocio_id}` ? "Migrando…" : "Migrar este cliente"}
                      </button>
                      {mudou && <span style={{ fontSize: 12, color: "#92400e" }}>Você alterou a etapa sugerida pela Sara.</span>}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
