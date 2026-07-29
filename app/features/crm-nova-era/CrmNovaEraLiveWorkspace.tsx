"use client";
/**
 * CrmNovaEraLiveWorkspace — experiência FUNCIONAL do CRM Nova Era, ligada ao
 * backend real ncrm_* (via /api/ncrm). Reaproveita os componentes puros do
 * protótipo (LeadCard, CadenceTimeline, WorkQueue) e as regras (rules.ts).
 *
 * Regras respeitadas:
 *  - Movimentação SOMENTE por RPC (o servidor chama ncrm_*); sem UPDATE direto.
 *  - Nada de otimismo permanente: recarrega do banco após a confirmação.
 *  - 4 colunas apenas (novo/tentando_contato/em_atendimento/em_acompanhamento);
 *    cadência, visita e proposta NÃO são colunas.
 *  - Erros de transição aparecem em linguagem simples.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLUNAS, SEVERIDADE_PADRAO,
  calcularAtraso, ordenarFilaHoje, calcularIndicadores, montarTimeline,
  type ColunaChave, type LeadNova,
} from "./lib/rules";
import { LeadCard } from "./components/LeadCard";
import { PainelPiloto, DiagnosticoLegado } from "./components/PainelPiloto";
import { WorkQueue } from "./components/WorkQueue";
import {
  mapEstadoToLead, enriquecerComEventos,
  type EstadoRow, type EventoRow, type PropostaRow,
} from "./live/adapter";

const MAX_TENTATIVAS = 4; // config v1 publicada (seed). O banco é a fonte da verdade.

type Vista = "quadro" | "fila" | "gerencial";
type SessionProfile = { userId: string; role: string; name: string };

async function api(path: string, token: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json } as { ok: boolean; status: number; json: Record<string, unknown> };
}

export function CrmNovaEraLiveWorkspace({ accessToken, profile }: { accessToken: string; profile: SessionProfile }) {
  const agora = useMemo(() => new Date().toISOString(), []);
  const [itens, setItens] = useState<EstadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("quadro");
  const [selId, setSelId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<LeadNova | null>(null);
  const [detalheLeadId, setDetalheLeadId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const leads = useMemo(() => itens.map(mapEstadoToLead), [itens]);

  const carregarQuadro = useCallback(async () => {
    setLoading(true); setErro(null);
    const { ok, json } = await api(`/api/ncrm?scope=board&limit=120`, accessToken);
    if (!ok) { setErro((json.error as string) || "Falha ao carregar o quadro."); setLoading(false); return; }
    setItens((json.itens as EstadoRow[]) ?? []);
    setLoading(false);
  }, [accessToken]);

  // Carga inicial: busca o quadro no banco (padrão fetch-on-mount).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregarQuadro(); }, [carregarQuadro]);

  const abrirLead = useCallback(async (id: string) => {
    setSelId(id);
    const { ok, json } = await api(`/api/ncrm?negocio=${id}`, accessToken);
    if (!ok) { setToast((json.error as string) || "Não foi possível abrir o lead."); return; }
    const base = mapEstadoToLead(json.estado as EstadoRow);
    setDetalhe(enriquecerComEventos(base, (json.eventos as EventoRow[]) ?? [], (json.propostas as PropostaRow[]) ?? []));
    setDetalheLeadId((json.estado as EstadoRow).negocios?.lead_id ?? null);
  }, [accessToken]);

  const executar = useCallback(async (payload: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setToast(null);
    const { ok, status, json } = await api(`/api/ncrm`, accessToken, { method: "PATCH", body: JSON.stringify(payload) });
    setBusy(false);
    if (!ok) {
      setToast((json.mensagem as string) || (json.error as string) || "Ação não permitida.");
      if (status === 409) { await carregarQuadro(); if (selId) await abrirLead(selId); } // versão mudou → recarrega
      return;
    }
    setToast("Ação registrada.");
    await carregarQuadro();
    if (selId) await abrirLead(selId);
  }, [accessToken, busy, carregarQuadro, selId, abrirLead]);

  // Visita ATÔMICA: uma RPC cria a visita real e encaminha (rollback integral em falha). Sem estado pendente em memória.
  const agendarVisita = useCallback(async (negocioId: number, versao: number, leadId: number | null, date: string, startTime: string) => {
    if (!leadId) { setToast("Lead sem vínculo para agendar visita."); return; }
    await executar({ action: "agendarVisita", negocioId, versao, leadId, data: date, horaInicio: startTime,
      idem: `ui:agendarVisita:${negocioId}:${date}:${startTime}` });
  }, [executar]);

  const porColuna = useMemo(() => {
    const m: Record<ColunaChave, LeadNova[]> = { novo: [], tentando_contato: [], em_atendimento: [], em_acompanhamento: [] };
    for (const l of leads) if (!l.visitaAgendadaEm && !l.proposta && !l.descartadoMotivo && !l.nutricao) m[l.coluna].push(l);
    return m;
  }, [leads]);

  const fila = useMemo(() => ordenarFilaHoje(leads, agora, SEVERIDADE_PADRAO), [leads, agora]);
  const indic = useMemo(() => calcularIndicadores(leads, agora, SEVERIDADE_PADRAO), [leads, agora]);

  return (
    <div className="nova-crm-root" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="nova-crm-toolbar">
        <div className="nova-crm-seg" role="tablist">
          <button className={vista === "quadro" ? "on" : ""} onClick={() => setVista("quadro")}>Quadro</button>
          <button className={vista === "fila" ? "on" : ""} onClick={() => setVista("fila")}>Central de atenção</button>
          {profile.role !== "corretor" && (
            <button className={vista === "gerencial" ? "on" : ""} onClick={() => setVista("gerencial")}>Visão gerencial</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {["admin", "executivo"].includes(profile.role) && <IngestAdminControl accessToken={accessToken} />}
          <button className="nova-crm-btn ghost" onClick={() => void carregarQuadro()} disabled={loading}>↻ Atualizar</button>
        </div>
      </div>

      {erro && <div className="nova-crm-notice" style={{ color: "var(--nc-red, #b42318)" }}>{erro}</div>}
      {loading && <div className="nova-crm-empty">Carregando carteira…</div>}

      {!loading && !erro && (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}>
            {vista === "quadro" && (
              <div className="nova-crm-board">
                {COLUNAS.map((c) => (
                  <section key={c.chave} className="nova-crm-col">
                    <header className="nova-crm-col-head">
                      <b>{c.titulo}</b> <span className="nova-crm-count">{porColuna[c.chave].length}</span>
                      <small>{c.descricao}</small>
                    </header>
                    <div className="nova-crm-col-body">
                      {porColuna[c.chave].length === 0 && <div className="nova-crm-empty">Sem leads.</div>}
                      {porColuna[c.chave].map((l) => (
                        <LeadCard key={l.id} lead={l} atraso={calcularAtraso(l, agora, SEVERIDADE_PADRAO)}
                          maxTentativas={MAX_TENTATIVAS} selected={selId === l.id} onOpen={() => void abrirLead(l.id)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {vista === "fila" && (
              <div className="nova-crm-fila-wrap">
                <div className="nova-crm-indic">
                  <span>Vencidas: <b>{indic.vencidas}</b></span>
                  <span>Aguardando você: <b>{indic.respostasAguardando}</b></span>
                  <span>Novos sem atuação: <b>{indic.novosSemAtuacao}</b></span>
                  <span>Visitas: <b>{indic.visitasAgendadas}</b></span>
                  <span>Propostas: <b>{indic.propostasRegistradas}</b></span>
                </div>
                <WorkQueue itens={fila} selectedId={selId} onOpenAction={(id) => void abrirLead(id)} />
                {/* Regra 1: carteira antiga (não migrada) separada e SÓ leitura — nunca some com a fila Nova Era. */}
                {["admin", "executivo", "gerente"].includes(profile.role) && <DiagnosticoLegado accessToken={accessToken} />}
              </div>
            )}

            {vista === "gerencial" && profile.role !== "corretor" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {["admin", "executivo"].includes(profile.role) && <PainelPiloto accessToken={accessToken} />}
                <PainelGerencial leads={leads} agora={agora} accessToken={accessToken} />
              </div>
            )}
          </div>

          {detalhe && (
            <LivePanel
              lead={detalhe} busy={busy} accessToken={accessToken} leadId={detalheLeadId}
              onClose={() => { setSelId(null); setDetalhe(null); setDetalheLeadId(null); }}
              onExecutar={executar} onToast={setToast}
              onCriarVisita={(date, start) => agendarVisita(Number(detalhe.id), itens.find((i) => String(i.negocio_id) === detalhe.id)?.versao ?? 1, detalheLeadId, date, start)}
              versao={itens.find((i) => String(i.negocio_id) === detalhe.id)?.versao ?? 1}
            />
          )}
        </div>
      )}

      {toast && <div className="nova-crm-toast" onAnimationEnd={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

/* --------------------------- Painel do lead (live) --------------------------- */
function LivePanel({
  lead, versao, busy, accessToken, leadId, onClose, onExecutar, onToast, onCriarVisita,
}: {
  lead: LeadNova; versao: number; busy: boolean; accessToken: string; leadId: number | null;
  onClose: () => void;
  onExecutar: (p: Record<string, unknown>) => void | Promise<void>;
  onToast: (m: string) => void;
  onCriarVisita: (date: string, startTime: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState<null | "tentativa" | "concluir" | "visita" | "proposta" | "descarte" | "nutricao">(null);
  const [sara, setSara] = useState<Record<string, unknown> | null>(null);
  const [saraLoad, setSaraLoad] = useState(false);
  const [prefill, setPrefill] = useState<{ proximaTipo?: string; prazo?: string }>({});
  const timeline = montarTimeline(lead);
  const emSaida = !!(lead.visitaAgendadaEm || lead.proposta || lead.descartadoMotivo || lead.nutricao);

  async function analisarSara() {
    setSaraLoad(true); setSara(null);
    const res = await fetch(`/api/ncrm/sara?negocio=${lead.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = await res.json().catch(() => ({}));
    setSaraLoad(false);
    if (!res.ok) { onToast((j.error as string) || "Sara indisponível."); return; }
    setSara(j.sugestao ?? j);
  }

  return (
    <aside className="nova-crm-panel" aria-label={`Ficha de ${lead.nome}`}>
      <div className="nova-crm-panel-head">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div><h2>{lead.nome}</h2><div className="sub">{lead.corretorNome} · {lead.telefone}</div></div>
          <button className="nova-crm-btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="nova-crm-panel-next">
          <b>{lead.proximaAcaoTitulo ?? "Definir próxima ação"}</b>
          <span> · {lead.proximaAcaoEm ? new Date(lead.proximaAcaoEm).toLocaleString("pt-BR") : "—"}</span>
        </div>
      </div>

      {emSaida ? (
        <div className="nova-crm-panel-body">
          <div className="nova-crm-saida-resumo">
            {lead.visitaAgendadaEm && "Encaminhado para o Pipe de Visitas."}
            {lead.proposta && "Encaminhado para a Esteira de Vendas (proposta registrada — não é venda)."}
            {lead.descartadoMotivo && `Descartado: ${lead.descartadoMotivo}.`}
            {lead.nutricao && "Em nutrição."}
          </div>
        </div>
      ) : (
        <div className="nova-crm-panel-body">
          {/* Coach: o que fazer agora */}
          <div className="nova-crm-coach">
            <b>O que fazer agora</b>
            <p>{lead.respondeu
              ? "Cliente já respondeu — conclua a ação comercial e defina o próximo passo."
              : "Cliente ainda não respondeu — registre a tentativa; o banco calcula o próximo passo da cadência."}</p>
          </div>

          {/* Sara (sugestão) */}
          <div className="nova-crm-sara">
            <button className="nova-crm-btn" onClick={() => void analisarSara()} disabled={saraLoad}>
              {saraLoad ? "Analisando…" : "🧠 Analisar com a Sara"}
            </button>
            {sara && (
              <div className="nova-crm-sara-card">
                <div><b>Sugestão da Sara</b> — você decide (a Sara não altera nada sozinha).</div>
                <ul className="nova-crm-tl-list">
                  <li><b>Próxima ação:</b> {String(sara.proxima_acao ?? "—")}</li>
                  <li><b>Temperatura:</b> {String(sara.temperatura ?? "—")} · <b>Risco:</b> {String(sara.risco_abandono ?? "—")}</li>
                  <li><b>Visita:</b> {String(sara.possibilidade_visita ?? "—")} · <b>Proposta:</b> {String(sara.possibilidade_proposta ?? "—")}</li>
                  <li><b>Confiança:</b> {Math.round(Number(sara.confianca ?? 0) * 100)}%</li>
                  {Array.isArray(sara.evidencias) && (sara.evidencias as string[]).length > 0 && (
                    <li><b>Evidências:</b> {(sara.evidencias as string[]).slice(0, 3).join(" · ")}</li>
                  )}
                </ul>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="nova-crm-btn" disabled={busy} onClick={async () => {
                    // registra a DECISÃO HUMANA "aceita" (auditável) antes de abrir o formulário
                    const r = await fetch(`/api/ncrm/sara`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ negocioId: Number(lead.id), baseVersao: versao, decisao: "aceita", sugestao: sara }) });
                    if (!r.ok) { onToast("Falha ao registrar o aceite — tente novamente."); return; }
                    const tipo = sara.possibilidade_proposta === "alta" ? "preparar_proposta" : sara.possibilidade_visita === "alta" ? "agendar_visita" : "entender_necessidade";
                    const prazo = typeof sara.prazo_sugerido === "string" ? sara.prazo_sugerido.slice(0, 16) : undefined;
                    setPrefill({ proximaTipo: tipo, prazo });
                    setForm(lead.respondeu ? "concluir" : "tentativa"); // humano confirma no formulário
                  }}>Aceitar e confirmar no formulário</button>
                  <button className="nova-crm-btn ghost" disabled={busy} onClick={async () => {
                    const r = await fetch(`/api/ncrm/sara`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ negocioId: Number(lead.id), baseVersao: versao, decisao: "rejeitada", sugestao: sara }) });
                    if (!r.ok) { onToast("Falha ao registrar a rejeição — tente novamente."); return; } // não engole o erro
                    onToast("Sugestão rejeitada — feedback registrado.");
                    setSara(null);
                  }}>Rejeitar</button>
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="nova-crm-acoes">
            {!lead.respondeu && <button className="nova-crm-btn" onClick={() => setForm("tentativa")}>Registrar tentativa</button>}
            {lead.respondeu && <button className="nova-crm-btn" onClick={() => setForm("concluir")}>Concluir ação</button>}
            <button className="nova-crm-btn" onClick={() => setForm("visita")}>Agendar visita</button>
            <button className="nova-crm-btn" onClick={() => setForm("proposta")}>Registrar proposta</button>
            <button className="nova-crm-btn ghost" onClick={() => setForm("descarte")}>Descartar</button>
            <button className="nova-crm-btn ghost" onClick={() => setForm("nutricao")}>Nutrição</button>
          </div>

          {form && (
            <FormAcao tipo={form} lead={lead} versao={versao} busy={busy} leadId={leadId} inicial={prefill} accessToken={accessToken}
              onCancel={() => { setForm(null); setPrefill({}); }}
              onCriarVisita={onCriarVisita}
              onSubmit={async (p) => { await onExecutar(p); setForm(null); setPrefill({}); }} />
          )}

          <ConversaLead accessToken={accessToken} negocioId={Number(lead.id)} />

          {/* Trilha */}
          <div className="nova-crm-tl-wrap">
            <b>Histórico</b>
            <ul className="nova-crm-tl-list">
              {timeline.map((e, i) => (
                <li key={i}>
                  <span>{new Date(e.em).toLocaleString("pt-BR")}</span> — {e.tipo}
                  {e.numero ? ` #${e.numero}` : ""} {e.resultado ? `(${e.resultado})` : ""}
                </li>
              ))}
              {timeline.length === 0 && <li>Sem eventos ainda.</li>}
            </ul>
          </div>
        </div>
      )}
    </aside>
  );
}

/* --------------------------- Conversa real do lead --------------------------- */
type MsgConversa = { id: string; direcao: string | null; tipo: string | null; conteudo: string | null; media_url: string | null; enviado_em: string | null; criado_em: string | null; status: string | null; transcricao: string | null };
function ConversaLead({ accessToken, negocioId }: { accessToken: string; negocioId: number }) {
  const [msgs, setMsgs] = useState<MsgConversa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/ncrm/conversa?negocio=${negocioId}&limit=60`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!vivo) return; if (ok) setMsgs((j.mensagens as MsgConversa[]) ?? []); else setErro((j.error as string) || "Conversa indisponível."); })
      .catch(() => { if (vivo) setErro("Conversa indisponível."); });
    return () => { vivo = false; };
  }, [accessToken, negocioId]);
  return (
    <div className="nova-crm-tl-wrap">
      <b>Conversa (WhatsApp)</b>
      {erro && <div className="nova-crm-hint">{erro}</div>}
      {!msgs && !erro && <div className="nova-crm-hint">Carregando conversa…</div>}
      {msgs && msgs.length === 0 && <div className="nova-crm-hint">Sem mensagens para este lead.</div>}
      {msgs && msgs.length > 0 && (
        <ul className="nova-crm-tl-list" style={{ maxHeight: 260, overflow: "auto" }}>
          {msgs.map((m) => (
            <li key={m.id} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 0" }}>
              <span>{(m.direcao || "?").toUpperCase()} · {m.enviado_em ? new Date(m.enviado_em).toLocaleString("pt-BR") : (m.criado_em ? new Date(m.criado_em).toLocaleString("pt-BR") : "—")} {m.status ? `· ${m.status}` : ""}</span>
              {m.tipo === "audio" && m.media_url && <audio controls preload="none" src={m.media_url} style={{ maxWidth: "100%" }} />}
              {(m.tipo === "imagem" || m.tipo === "foto") && m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer">imagem</a>}
              {m.conteudo && <span>{m.conteudo}</span>}
              {m.transcricao && <span style={{ fontStyle: "italic", color: "var(--nc-muted)" }}>“{m.transcricao}”</span>}
              {!m.conteudo && !m.transcricao && !m.media_url && <span className="nova-crm-hint">({m.tipo || "mensagem"})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------- Formulários de ação --------------------------- */
function FormAcao({
  tipo, lead, versao, busy, leadId, inicial, accessToken, onCancel, onSubmit, onCriarVisita,
}: {
  tipo: "tentativa" | "concluir" | "visita" | "proposta" | "descarte" | "nutricao";
  lead: LeadNova; versao: number; busy: boolean; leadId: number | null;
  inicial?: { proximaTipo?: string; prazo?: string }; accessToken: string;
  onCancel: () => void; onSubmit: (p: Record<string, unknown>) => void | Promise<void>;
  onCriarVisita: (date: string, startTime: string) => void | Promise<void>;
}) {
  const [canal, setCanal] = useState("whatsapp");
  const [resultado, setResultado] = useState(tipo === "concluir" ? "acao_concluida" : "nao_respondeu");
  const [obs, setObs] = useState("");
  const [proximaTipo, setProximaTipo] = useState(inicial?.proximaTipo ?? "entender_necessidade");
  const [proximaEm, setProximaEm] = useState(inicial?.prazo ?? "");
  const [valor, setValor] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [produtos, setProdutos] = useState<Array<{ id: string; rotulo: string }>>([]);
  const [produtoBusca, setProdutoBusca] = useState("");
  const [produtosErro, setProdutosErro] = useState<string | null>(null);
  const [forma, setForma] = useState("");
  const [vData, setVData] = useState("");
  const [vHora, setVHora] = useState("");
  const [motivo, setMotivo] = useState("sem_interesse");
  const [detalhe, setDetalhe] = useState("");
  const base = { negocioId: Number(lead.id), versao };
  const respondeuAgora = resultado === "respondeu" || resultado === "pediu_retorno";
  const proxIso = proximaEm ? new Date(proximaEm).toISOString() : null;

  // Carrega produtos/empreendimentos VISÍVEIS (RLS) para o select — o usuário nunca digita UUID.
  useEffect(() => {
    if (tipo !== "proposta") return;
    const ctrl = new AbortController();
    const q = produtoBusca.trim();
    const t = setTimeout(() => {
      void fetch(`/api/ncrm/produtos${q ? `?q=${encodeURIComponent(q)}` : ""}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctrl.signal })
        .then((r) => r.ok ? r.json() : Promise.reject(new Error("falha")))
        .then((j: { produtos?: Array<{ id: string; rotulo: string }> }) => { setProdutos(j.produtos ?? []); setProdutosErro(null); })
        .catch((e) => { if (e?.name !== "AbortError") setProdutosErro("Não foi possível carregar os produtos."); });
    }, 250);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [tipo, produtoBusca, accessToken]);

  return (
    <div className="nova-crm-form">
      {tipo === "tentativa" && (
        <>
          <label>Canal
            <select value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="ligacao">Ligação</option><option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option><option value="presencial">Presencial</option>
            </select>
          </label>
          <label>Resultado
            <select value={resultado} onChange={(e) => setResultado(e.target.value)}>
              <option value="nao_respondeu">Não respondeu</option><option value="respondeu">Respondeu</option>
              <option value="pediu_retorno">Pediu retorno</option><option value="telefone_invalido">Telefone inválido</option>
              <option value="sem_interesse">Sem interesse</option><option value="contato_inadequado">Contato inadequado</option>
            </select>
          </label>
          {respondeuAgora && (
            <>
              <label>Próxima ação comercial
                <select value={proximaTipo} onChange={(e) => setProximaTipo(e.target.value)}>
                  <option value="entender_necessidade">Entender necessidade</option>
                  <option value="enviar_opcoes">Enviar opções</option>
                  <option value="ligar_retorno">Ligar para retorno</option>
                  <option value="agendar_visita">Agendar visita</option>
                  <option value="preparar_proposta">Preparar proposta</option>
                </select>
              </label>
              <label>Prazo<input type="datetime-local" value={proximaEm} onChange={(e) => setProximaEm(e.target.value)} /></label>
            </>
          )}
          <label>Observação<input value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy} onClick={() => onSubmit({
              action: "registrarTentativa", ...base, canal, resultado, obs,
              proximaTipo: respondeuAgora ? proximaTipo : null,
              proximaTitulo: respondeuAgora ? proximaTipo.replace(/_/g, " ") : null,
              proximaEm: respondeuAgora ? proxIso : null,
            })}>Registrar</button>
          </div>
        </>
      )}

      {tipo === "concluir" && (
        <>
          <label>Resultado<input value={resultado} onChange={(e) => setResultado(e.target.value)} /></label>
          <label>Próxima ação
            <select value={proximaTipo} onChange={(e) => setProximaTipo(e.target.value)}>
              <option value="entender_necessidade">Entender necessidade</option>
              <option value="enviar_opcoes">Enviar opções</option>
              <option value="ligar_retorno">Ligar para retorno</option>
              <option value="agendar_visita">Agendar visita</option>
              <option value="preparar_proposta">Preparar proposta</option>
            </select>
          </label>
          <label>Prazo<input type="datetime-local" value={proximaEm} onChange={(e) => setProximaEm(e.target.value)} /></label>
          <label>Observação<input value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy} onClick={() => onSubmit({
              action: "concluirAcao", ...base, resultado, obs,
              proximaTipo, proximaTitulo: proximaTipo.replace(/_/g, " "), proximaEm: proxIso,
            })}>Concluir</button>
          </div>
        </>
      )}

      {tipo === "visita" && (
        <>
          <p className="nova-crm-hint">Agenda uma visita REAL (mesmo fluxo do CRM/Agenda). Só depois de criada, o lead vai ao Pipe de Visitas. Intenção de visitar não conta.</p>
          <label>Data<input type="date" value={vData} onChange={(e) => setVData(e.target.value)} /></label>
          <label>Hora de início<input type="time" value={vHora} onChange={(e) => setVHora(e.target.value)} /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy || !vData || !vHora || !leadId} onClick={() => onCriarVisita(vData, vHora)}>Criar visita e encaminhar</button>
          </div>
        </>
      )}

      {tipo === "proposta" && (
        <>
          <p className="nova-crm-hint">Proposta ≠ venda. Cria a solicitação REAL na Esteira (venda_solicitacoes, pendente) e encaminha — sem contabilizar venda, atômico (rollback se qualquer etapa falhar).</p>
          <label>Buscar produto/empreendimento<input value={produtoBusca} onChange={(e) => setProdutoBusca(e.target.value)} placeholder="digite o nome ou bairro" /></label>
          <label>Produto/empreendimento
            <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">— selecione pelo nome —</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
            </select>
          </label>
          {produtosErro && <p className="nova-crm-hint" style={{ color: "#b91c1c" }}>{produtosErro}</p>}
          <label>Valor (R$)<input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
          <label>Forma de pagamento<input value={forma} onChange={(e) => setForma(e.target.value)} placeholder="opcional" /></label>
          <label>Observação<input value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy || !valor || !produtoId} onClick={() => onSubmit({ action: "registrarPropostaEsteira", ...base, produtoId, valor: Number(valor), forma: forma || null, obs })}>Registrar proposta na Esteira</button>
          </div>
        </>
      )}

      {tipo === "descarte" && (
        <>
          <label>Motivo
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="sem_interesse">Sem interesse</option><option value="sem_perfil_financeiro">Sem perfil financeiro</option>
              <option value="numero_invalido">Número inválido</option><option value="ja_comprou_concorrente">Já comprou concorrente</option>
              <option value="duplicado">Duplicado</option><option value="outro">Outro</option>
            </select>
          </label>
          {motivo === "outro" && <label>Detalhe<input value={detalhe} onChange={(e) => setDetalhe(e.target.value)} /></label>}
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy} onClick={() => onSubmit({ action: "saidaDescarte", ...base, motivo, detalhe: detalhe || null })}>Descartar</button>
          </div>
        </>
      )}

      {tipo === "nutricao" && (
        <>
          <label>Motivo<input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: compra futura" /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy} onClick={() => onSubmit({ action: "saidaNutricao", ...base, motivo: obs || null })}>Enviar para nutrição</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------- Controle admin do Ingest ----------------------- */
/** Visível só para admin/executivo. INDICADOR de status (só leitura) + DESATIVAÇÃO
 *  emergencial. NÃO ativa: o ÚNICO caminho de ativação é PainelPiloto → ModalAtivacao
 *  (confirmação digitada "ATIVAR"). Aqui não existe botão nem chamada de ativação. */
function IngestAdminControl({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<{ ativo: boolean; ativo_desde: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await fetch(`/api/ncrm/ingest`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) { setErro((j.mensagem as string) || (j.error as string) || "Falha ao consultar o ingest."); setStatus(null); return; }
    setStatus({ ativo: Boolean(j.ativo), ativo_desde: (j.ativo_desde as string) ?? null });
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  // SOMENTE desativação emergencial (kill-switch). Nunca ativa.
  const desativar = useCallback(async () => {
    setBusy(true); setErro(null); setConfirmar(false);
    const r = await fetch(`/api/ncrm/ingest`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "desativar" }) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(false);
    if (!r.ok) { setErro((j.mensagem as string) || (j.error as string) || "Operação não permitida."); return; }
    await carregar();
  }, [accessToken, carregar]);

  const rotulo = status == null ? "Ingest: —" : status.ativo
    ? `Ingest ativo${status.ativo_desde ? ` desde ${new Date(status.ativo_desde).toLocaleString("pt-BR")}` : ""}`
    : "Ingest desligado";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
      <span title="Reconciliação de mensagens (ativação só pelo Painel do piloto)" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 8, background: status?.ativo ? "#16a34a" : "#9ca3af", display: "inline-block" }} />
        {rotulo}
      </span>
      {/* Ativação NÃO fica aqui: só em Visão gerencial → Painel do piloto → digitar "ATIVAR". */}
      {status?.ativo && !confirmar && (
        <button className="nova-crm-btn ghost" disabled={busy} onClick={() => setConfirmar(true)} style={{ color: "#b91c1c" }}>Desativar ingest (emergência)</button>
      )}
      {status?.ativo && confirmar && (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Desativar o ingest agora?
          <button className="nova-crm-btn" disabled={busy} onClick={() => void desativar()} style={{ color: "#b91c1c" }}>Confirmar</button>
          <button className="nova-crm-btn ghost" disabled={busy} onClick={() => setConfirmar(false)}>Cancelar</button>
        </span>
      )}
      {erro && <span style={{ color: "#b91c1c" }}>{erro}</span>}
    </div>
  );
}

/* --------------------------- Visão gerencial --------------------------- */
function PainelGerencial({ leads, agora, accessToken }: { leads: LeadNova[]; agora: string; accessToken: string }) {
  const [m, setM] = useState<Record<string, number> | null>(null);
  const [erroM, setErroM] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/ncrm/metricas`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!vivo) return; if (ok) setM(j.metricas as Record<string, number>); else setErroM((j.error as string) || "Falha nas métricas."); })
      .catch(() => { if (vivo) setErroM("Falha nas métricas."); });
    return () => { vivo = false; };
  }, [accessToken]);

  // Fallback (página atual) — claramente rotulado até a métrica agregada carregar.
  const ativosPg = leads.filter((l) => !l.visitaAgendadaEm && !l.proposta && !l.descartadoMotivo && !l.nutricao).length;
  const atrasadosPg = leads.filter((l) => !l.visitaAgendadaEm && !l.proposta && !l.descartadoMotivo && !l.nutricao && calcularAtraso(l, agora, SEVERIDADE_PADRAO).atrasadoMin > 0).length;

  if (m) {
    const kpis: [string, number | string][] = [
      ["Carteira autorizada", m.total], ["Ativos", m.ativos], ["Taxa de resposta", `${m.taxa_resposta_pct}%`],
      ["Visitas agendadas", m.visitas_agendadas], ["Propostas (não venda)", m.propostas], ["Atrasados", m.atrasados],
      ["Sem próxima ação", m.sem_proxima_acao], ["Descartados", m.descartados], ["Nutrição", m.nutricao],
    ];
    return (
      <div className="nova-crm-kpis">
        {kpis.map(([k, v]) => (<article key={k} className="nova-crm-kpi"><span className="v">{v}</span><span className="k">{k}</span></article>))}
        <p className="nova-crm-hint" style={{ gridColumn: "1/-1" }}>Agregado sobre a carteira autorizada (RLS). Proposta não é venda; a venda permanece na Esteira.</p>
      </div>
    );
  }
  return (
    <div className="nova-crm-kpis">
      <article className="nova-crm-kpi"><span className="v">{ativosPg}</span><span className="k">Ativos (página atual)</span></article>
      <article className="nova-crm-kpi"><span className="v">{atrasadosPg}</span><span className="k">Atrasados (página atual)</span></article>
      <p className="nova-crm-hint" style={{ gridColumn: "1/-1" }}>{erroM ? `Métrica agregada indisponível: ${erroM}` : "Carregando métrica agregada da carteira autorizada…"} Os números acima são apenas da página carregada.</p>
    </div>
  );
}
