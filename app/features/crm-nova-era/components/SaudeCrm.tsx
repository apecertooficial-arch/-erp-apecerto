"use client";
/**
 * SAÚDE DO CRM NOVA ERA (Fase 6 PR B) — monitoramento administrativo.
 * Todas as ações oferecidas aqui são seguras: nenhuma envia mensagem, cria visita/proposta,
 * altera venda, mexe no CRM antigo ou liga a Sara em modo de execução.
 */
import { useCallback, useEffect, useState } from "react";

type Json = Record<string, unknown>;
type Rotina = { nome: string; periodicidade: string; ligada: boolean };
type Canal = { rotulo: string; status: string; ultimo_sinal: string | null };
type AcaoLog = { acao: string; alvo: string | null; resultado: string; detalhe: string | null; em: string };

/** Rótulos de canal conectado usados pela integração de WhatsApp já existente. */
const CONECTADO = new Set(["connected", "conectado", "open"]);

const ACAO_ROTULO: Record<string, string> = {
  reprocessar_item: "Reprocessar uma mensagem",
  retentar_analise: "Pedir nova leitura da Sara",
  desligar_runner: "Desligar a leitura da Sara",
  desligar_entrada: "Desligar a entrada de conversas",
  religar_runner_observador: "Religar a leitura (só observação)",
  atualizar_diagnostico: "Atualizar diagnóstico",
  classificar_backlog: "Classificar a fila acumulada",
};
/** Ações que exigem uma palavra própria de confirmação. */
const CONFIRMACAO: Record<string, string> = { classificar_backlog: "CLASSIFICAR" };
function palavraDe(acao: string): string { return CONFIRMACAO[acao] ?? "CONFIRMAR"; }

function quando(s: unknown): string {
  if (typeof s !== "string") return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function num(v: unknown): string { return typeof v === "number" ? String(v) : "—"; }
/** Idade em minutos → texto curto. Encerrados nunca entram nesta conta. */
function idade(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "nenhuma";
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 12, background: "#fff" }}>
      <b style={{ fontSize: 13 }}>{titulo}</b>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}
function Linha({ r, v, alerta }: { r: string; v: string; alerta?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, borderTop: "1px solid #f8fafc", paddingTop: 3 }}>
      <span style={{ color: "#475569" }}>{r}</span>
      <b style={{ color: alerta ? "#b91c1c" : "#0f172a" }}>{v}</b>
    </div>
  );
}

export function SaudeCrm({ accessToken }: { accessToken: string }) {
  const [d, setD] = useState<Json | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pendente, setPendente] = useState<{ acao: string; alvo: string } | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [alvo, setAlvo] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await fetch("/api/ncrm/saude", { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    setCarregando(false);
    if (!r.ok) { setErro("Não foi possível carregar o diagnóstico agora."); return; }
    setErro(null); setD(j);
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const executar = useCallback(async () => {
    if (!pendente) return;
    setErro(null); setMsg(null);
    const r = await fetch("/api/ncrm/saude", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ acao: pendente.acao, alvo: pendente.alvo || null, confirmacao }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; detalhe?: string; erro?: string };
    if (!r.ok || j.ok === false) {
      setErro(j.erro === "confirmacao_obrigatoria" ? `Digite ${palavraDe(pendente.acao)} para executar.`
        : j.erro === "sara_fora_de_observacao" ? "Só é possível religar com a Sara em modo de observação."
        : "Não foi possível executar essa ação.");
      return;
    }
    const c = j as unknown as { fora_do_escopo?: number; sem_negocio_expirado?: number; reabilitados?: number };
    setMsg(pendente.acao === "classificar_backlog"
      ? `Fila classificada: ${c.fora_do_escopo ?? 0} fora do piloto, ${c.sem_negocio_expirado ?? 0} sem negócio, ${c.reabilitados ?? 0} reabilitados. Nada foi apagado.`
      : (j.detalhe ?? "Feito."));
    setPendente(null); setConfirmacao(""); setAlvo("");
    await carregar();
  }, [accessToken, pendente, confirmacao, carregar]);

  const ent = (d?.entrada ?? {}) as Json;
  const sara = (d?.sara ?? {}) as Json;
  const qual = (d?.qualidade ?? {}) as Json;
  const rotinas = (d?.rotinas ?? []) as Rotina[];
  const canais = (d?.canais ?? []) as Canal[];
  const acoes = (d?.acoes ?? []) as AcaoLog[];

  const pedir = (acao: string, precisaAlvo = false) => setPendente({ acao, alvo: precisaAlvo ? alvo : "" });

  return (
    <section style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Saúde do CRM Nova Era</h3>
          <p style={{ margin: "4px 0 0", color: "#475569", fontSize: 13 }}>
            Como está funcionando agora. Atualizado em {quando(d?.gerado_em)}.
          </p>
        </div>
        <button className="nova-crm-btn ghost" onClick={() => void carregar()}>{carregando ? "Atualizando…" : "Atualizar"}</button>
      </header>

      {erro && <p style={{ color: "#b91c1c", fontSize: 12.5, margin: 0 }}>{erro}</p>}
      {msg && <p style={{ color: "#166534", fontSize: 12.5, margin: 0 }}>{msg}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 10 }}>
        <Bloco titulo="Entrada de conversas">
          <Linha r="Situação" v={ent.ligada ? "Ligada" : "Desligada"} />
          <Linha r="A processar" v={num(ent.processaveis)} alerta={Number(ent.processaveis) > 50} />
          <Linha r="Aguardando o negócio" v={num(ent.aguardando_negocio)} />
          <Linha r="Falhas técnicas" v={num(ent.falhas_tecnicas)} alerta={Number(ent.falhas_tecnicas) > 0} />
          <Linha r="Espera mais antiga" v={idade(ent.idade_mais_antigo_min)} alerta={Number(ent.idade_mais_antigo_min) > 120} />
          <Linha r="Processados" v={num(ent.processados)} />
          <Linha r="Encerrados fora do piloto" v={num(ent.fora_do_piloto)} />
          <Linha r="Encerrados sem negócio" v={num(ent.sem_negocio_expirado)} />
          <Linha r="Encerrados por outro motivo" v={num(ent.encerrados_outros)} />
          <Linha r="Últimas 24 h" v={num(ent.volume_24h)} />
          <Linha r="Último processamento" v={quando(ent.ultimo_processado_em)} />
        </Bloco>

        <Bloco titulo="Leitura da Sara">
          <Linha r="Modo" v={sara.modo === "observer" ? "Só observa" : String(sara.modo ?? "—")} />
          <Linha r="Situação" v={sara.leitura_ligada ? "Ligada" : "Desligada"} />
          <Linha r="Última execução" v={quando(sara.ultima_execucao)} />
          <Linha r="Na fila" v={num(sara.fila)} />
          <Linha r="Com erro" v={num(sara.com_erro)} alerta={Number(sara.com_erro) > 0} />
          <Linha r="Retentativas acumuladas" v={num(sara.retentativas)} />
          <Linha r="Leituras nas últimas 24 h" v={num(sara.analises_24h)} />
          <Linha r="Modelo usado" v={String(sara.modelo ?? "—")} />
          <Linha r="Custo" v="não disponível com precisão" />
        </Bloco>

        <Bloco titulo="Qualidade dos dados">
          <Linha r="Atendimentos ativos" v={num(qual.atendimentos_ativos)} />
          <Linha r="Sem corretor" v={num(qual.sem_corretor)} alerta={Number(qual.sem_corretor) > 0} />
          <Linha r="Sem conversa" v={num(qual.sem_conversa)} alerta={Number(qual.sem_conversa) > 0} />
          <Linha r="Leads sem negócio (24 h)" v={num(qual.leads_sem_negocio_24h)} alerta={Number(qual.leads_sem_negocio_24h) > 0} />
          <Linha r="Áudios sem transcrição (7 d)" v={num(qual.audios_sem_transcricao_7d)} />
          <Linha r="Leituras sem evidência" v={num(qual.analises_sem_evidencia)} alerta={Number(qual.analises_sem_evidencia) > 0} />
          <Linha r="Migrações desfeitas" v={num(qual.duplicidades_impedidas)} />
        </Bloco>

        <Bloco titulo="Rotinas automáticas">
          {rotinas.length === 0 && <span style={{ fontSize: 12.5, color: "#64748b" }}>Sem informação disponível.</span>}
          {rotinas.map((r) => <Linha key={r.nome} r={r.nome} v={`${r.periodicidade} · ${r.ligada ? "ligada" : "desligada"}`} />)}
        </Bloco>

        <Bloco titulo="Canais de WhatsApp">
          {canais.length === 0 && <span style={{ fontSize: 12.5, color: "#64748b" }}>Nenhum canal cadastrado.</span>}
          {canais.map((c) => <Linha key={c.rotulo} r={c.rotulo} v={`${c.status} · ${quando(c.ultimo_sinal)}`} alerta={!CONECTADO.has(String(c.status).toLowerCase())} />)}
        </Bloco>
      </div>

      <div style={{ border: "1px solid var(--nc-line,#e5e7eb)", borderRadius: 10, padding: 12, background: "#fff" }}>
        <b style={{ fontSize: 13 }}>Ações seguras</b>
        <p style={{ margin: "4px 0 8px", fontSize: 12.5, color: "#475569" }}>
          Nenhuma destas ações envia mensagem, cria visita ou proposta, altera venda ou mexe no CRM antigo.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
            Item (mensagem ou atendimento)
            <input value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="opcional"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, minWidth: 180 }} />
          </label>
          <button className="nova-crm-btn ghost" onClick={() => pedir("reprocessar_item", true)}>Reprocessar mensagem</button>
          <button className="nova-crm-btn ghost" onClick={() => pedir("retentar_analise", true)}>Pedir nova leitura</button>
          <button className="nova-crm-btn ghost" onClick={() => pedir("desligar_runner")}>Desligar leitura da Sara</button>
          <button className="nova-crm-btn ghost" onClick={() => pedir("desligar_entrada")}>Desligar entrada</button>
          <button className="nova-crm-btn ghost" onClick={() => pedir("religar_runner_observador")}>Religar leitura (só observação)</button>
          <button className="nova-crm-btn ghost" onClick={() => pedir("classificar_backlog")}>Classificar fila acumulada</button>
        </div>

        {pendente && (
          <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <span style={{ fontSize: 12.5 }}>Confirmar: <b>{ACAO_ROTULO[pendente.acao] ?? pendente.acao}</b>{pendente.alvo ? ` (${pendente.alvo})` : ""}</span>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#475569" }}>
              Digite {palavraDe(pendente.acao)}
              <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={palavraDe(pendente.acao)}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 13, width: 130 }} />
            </label>
            <button className="nova-crm-btn" onClick={() => void executar()}>Executar</button>
            <button className="nova-crm-btn ghost" onClick={() => { setPendente(null); setConfirmacao(""); }}>Cancelar</button>
          </div>
        )}

        {acoes.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 2 }}>
            {acoes.slice(0, 8).map((a, i) => (
              <li key={i} style={{ fontSize: 12, color: "#475569", borderTop: "1px solid #f8fafc", paddingTop: 3 }}>
                {quando(a.em)} · {ACAO_ROTULO[a.acao] ?? a.acao} · {a.resultado}{a.detalhe ? ` · ${a.detalhe}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
