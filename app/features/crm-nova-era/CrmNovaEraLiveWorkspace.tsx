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
        <button className="nova-crm-btn ghost" onClick={() => void carregarQuadro()} disabled={loading}>↻ Atualizar</button>
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
              </div>
            )}

            {vista === "gerencial" && profile.role !== "corretor" && (
              <PainelGerencial leads={leads} agora={agora} />
            )}
          </div>

          {detalhe && (
            <LivePanel
              lead={detalhe} busy={busy} accessToken={accessToken}
              onClose={() => { setSelId(null); setDetalhe(null); }}
              onExecutar={executar} onToast={setToast}
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
  lead, versao, busy, accessToken, onClose, onExecutar, onToast,
}: {
  lead: LeadNova; versao: number; busy: boolean; accessToken: string;
  onClose: () => void;
  onExecutar: (p: Record<string, unknown>) => void | Promise<void>;
  onToast: (m: string) => void;
}) {
  const [form, setForm] = useState<null | "tentativa" | "concluir" | "visita" | "proposta" | "descarte" | "nutricao">(null);
  const [sara, setSara] = useState<Record<string, unknown> | null>(null);
  const [saraLoad, setSaraLoad] = useState(false);
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
                <div><b>Sugestão da Sara</b> (você decide — a Sara não altera nada sozinha)</div>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(sara, null, 2)}</pre>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="nova-crm-btn" disabled={busy} onClick={() => setForm(lead.respondeu ? "concluir" : "tentativa")}>Aplicar manualmente</button>
                  <button className="nova-crm-btn ghost" onClick={() => {
                    void fetch(`/api/ncrm/sara`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ negocioId: Number(lead.id), decisao: "rejeitada", sugestao: sara }) });
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
            <FormAcao tipo={form} lead={lead} versao={versao} busy={busy}
              onCancel={() => setForm(null)}
              onSubmit={async (p) => { await onExecutar(p); setForm(null); }} />
          )}

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

/* --------------------------- Formulários de ação --------------------------- */
function FormAcao({
  tipo, lead, versao, busy, onCancel, onSubmit,
}: {
  tipo: "tentativa" | "concluir" | "visita" | "proposta" | "descarte" | "nutricao";
  lead: LeadNova; versao: number; busy: boolean;
  onCancel: () => void; onSubmit: (p: Record<string, unknown>) => void | Promise<void>;
}) {
  const [canal, setCanal] = useState("whatsapp");
  const [resultado, setResultado] = useState(tipo === "concluir" ? "acao_concluida" : "nao_respondeu");
  const [obs, setObs] = useState("");
  const [proximaTipo, setProximaTipo] = useState("entender_necessidade");
  const [proximaEm, setProximaEm] = useState("");
  const [valor, setValor] = useState("");
  const [visitaId, setVisitaId] = useState("");
  const [motivo, setMotivo] = useState("sem_interesse");
  const [detalhe, setDetalhe] = useState("");
  const base = { negocioId: Number(lead.id), versao };
  const respondeuAgora = resultado === "respondeu" || resultado === "pediu_retorno";
  const proxIso = proximaEm ? new Date(proximaEm).toISOString() : null;

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
          <p className="nova-crm-hint">Cole o ID real da visita já agendada no módulo de Agenda/Visitas. A intenção de visitar não conta como visita.</p>
          <label>ID da visita<input value={visitaId} onChange={(e) => setVisitaId(e.target.value)} placeholder="uuid da visita" /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy || !visitaId} onClick={() => onSubmit({ action: "saidaVisita", ...base, visitaId })}>Encaminhar ao Pipe de Visitas</button>
          </div>
        </>
      )}

      {tipo === "proposta" && (
        <>
          <p className="nova-crm-hint">Proposta ≠ venda. Registrar encaminha o lead à Esteira de Vendas sem contabilizar venda.</p>
          <label>Valor (R$)<input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
          <label>Observação<input value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <div className="nova-crm-form-actions">
            <button className="nova-crm-btn ghost" onClick={onCancel}>Cancelar</button>
            <button className="nova-crm-btn" disabled={busy || !valor} onClick={() => onSubmit({ action: "saidaProposta", ...base, valor: Number(valor), obs })}>Registrar proposta</button>
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

/* --------------------------- Visão gerencial --------------------------- */
function PainelGerencial({ leads, agora }: { leads: LeadNova[]; agora: string }) {
  const ativos = leads.filter((l) => !l.visitaAgendadaEm && !l.proposta && !l.descartadoMotivo && !l.nutricao);
  const responderam = leads.filter((l) => l.respondeu).length;
  const semProxima = ativos.filter((l) => !l.proximaAcaoEm).length;
  const visitas = leads.filter((l) => l.visitaAgendadaEm).length;
  const propostas = leads.filter((l) => l.proposta).length;
  const atrasados = ativos.filter((l) => calcularAtraso(l, agora, SEVERIDADE_PADRAO).atrasadoMin > 0).length;
  const taxaResp = leads.length ? Math.round((responderam / leads.length) * 100) : 0;
  const kpis = [
    ["Leads na carteira (página)", leads.length],
    ["Taxa de resposta", `${taxaResp}%`],
    ["Visitas encaminhadas", visitas],
    ["Propostas (não venda)", propostas],
    ["Atrasados", atrasados],
    ["Sem próxima ação", semProxima],
  ] as const;
  return (
    <div className="nova-crm-kpis">
      {kpis.map(([k, v]) => (
        <article key={k} className="nova-crm-kpi"><span className="v">{v}</span><span className="k">{k}</span></article>
      ))}
      <p className="nova-crm-hint" style={{ gridColumn: "1/-1" }}>
        Indicadores calculados sobre a página carregada. Proposta não é venda; a venda permanece no fluxo atual da Esteira.
      </p>
    </div>
  );
}
