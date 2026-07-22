"use client";

import { useCallback, useEffect, useState } from "react";

type Config = {
  janela_inicio: string; janela_fim: string; receber_ate: string;
  modo_fora_janela: "quem_veio_no_dia" | "todos_do_bloco" | "nao_distribuir";
  modo_rodizio: "fila_circular" | "placar_justo";
  fds_exige_presencas: number;
  failover_envio: boolean; failover_transfere_lead: boolean; resgate_orfaos: boolean;
};

const RODIZIOS: Array<{ v: Config["modo_rodizio"]; t: string; d: string }> = [
  { v: "fila_circular", t: "Fila circular — sempre o próximo da fila", d: "Cada corretor recebe na sua vez e vai para o fim da fila. Sem compensação: quem ficou para trás (offline, instância caída) não acumula prioridade." },
  { v: "placar_justo", t: "Placar justo — prioriza quem recebeu menos", d: "O sistema compensa: quem tem menos leads no placar do dia recebe primeiro, até equilibrar a carteira de todos." },
];
type Ocorrencia = { quando: string; evento: string; status: string; lead_nome: string | null; motivo: string };
type UltimoLead = { nome: string; quando: string; corretor: string; como: string; abordagem_ok: boolean };
type Saude = {
  orfaosAgora: number; naFilaAgora: number; entradas24h: number; enviosOk24h: number;
  falhasDefinitivas24h: number; failovers24h: number; foraJanela24h: number;
  semAbordagemFunil: number; instanciasConectadas: number; instanciasTotal: number;
  ultimosLeads?: UltimoLead[];
  ocorrencias: Ocorrencia[];
};

/* Ocorrências agrupadas: as tentativas do failover geram várias linhas para o mesmo lead
   no mesmo minuto — aqui viram UMA linha com o contador de tentativas. */
type OcorrenciaGrupo = Ocorrencia & { repeticoes: number };
function agruparOcorrencias(list: Ocorrencia[]): OcorrenciaGrupo[] {
  const out: OcorrenciaGrupo[] = [];
  for (const o of list) {
    const prev = out[out.length - 1];
    if (prev && prev.lead_nome === o.lead_nome && prev.quando === o.quando && prev.status === o.status) {
      prev.repeticoes += 1;
      continue;
    }
    out.push({ ...o, repeticoes: 1 });
  }
  return out;
}

const MODOS: Array<{ v: Config["modo_fora_janela"]; t: string; d: string }> = [
  { v: "quem_veio_no_dia", t: "Distribuir entre quem compareceu no dia", d: "Fora da janela (noite/madrugada), o lead vai pelo rodízio justo só para quem esteve online durante o dia. Recomendado." },
  { v: "todos_do_bloco", t: "Distribuir entre todos os corretores", d: "Fora da janela, distribui entre todos os corretores ativos do bloco, mesmo quem não compareceu." },
  { v: "nao_distribuir", t: "Não distribuir fora da janela", d: "Lead aguarda a próxima janela; o resgate automático distribui quando alguém ficar elegível. A abordagem NÃO sai na hora." },
];

/* Painel Regras de Distribuição & Abordagem — vive dentro de Configurações. */
export function DistributionConfig({ accessToken }: { accessToken: string }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saude, setSaude] = useState<Saude | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [atualizadoAs, setAtualizadoAs] = useState("");

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setNotice("");
    try {
      const res = await fetch("/api/distribuicao", { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json() as { config?: Config; saude?: Saude; error?: string };
      if (!res.ok) { if (!silencioso) setNotice(data.error || "Sem permissão."); return; }
      if (data.config) setCfg((atual) => atual && silencioso ? atual : { ...data.config!, janela_inicio: data.config!.janela_inicio.slice(0, 5), janela_fim: data.config!.janela_fim.slice(0, 5), receber_ate: data.config!.receber_ate.slice(0, 5) });
      setSaude(data.saude ?? null);
      setAtualizadoAs(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch { if (!silencioso) setNotice("Falha ao carregar as regras de distribuição."); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  // Atualização automática: o painel se mantém vivo sozinho a cada 30 segundos
  // (silencioso: não sobrescreve o que você estiver editando nas regras).
  useEffect(() => {
    const timer = window.setInterval(() => { void load(true); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/distribuicao", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({
        janelaInicio: cfg.janela_inicio, janelaFim: cfg.janela_fim, receberAte: cfg.receber_ate,
        modoForaJanela: cfg.modo_fora_janela, modoRodizio: cfg.modo_rodizio, fdsExigePresencas: cfg.fds_exige_presencas,
        failoverEnvio: cfg.failover_envio, failoverTransfereLead: cfg.failover_transfere_lead, resgateOrfaos: cfg.resgate_orfaos,
      }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setNotice(data.error || "Não foi possível salvar."); return; }
      setNotice("Regras de distribuição salvas — valem imediatamente para os próximos leads.");
    } catch { setNotice("Falha ao salvar."); }
    finally { setBusy(false); }
  };

  if (!cfg) return <section className="settings-card"><p className="settings-hint">{notice || "Carregando as regras de distribuição…"}</p></section>;

  const sw = (key: keyof Pick<Config, "failover_envio" | "failover_transfere_lead" | "resgate_orfaos">, title: string, sub: string) => (
    <label className="presence-switch"><input type="checkbox" checked={cfg[key]} onChange={(e) => setCfg({ ...cfg, [key]: e.target.checked })} /><div><strong>{title}</strong><small>{sub}</small></div></label>
  );

  return <div className="dist-config">
    {saude && <section className="settings-card dist-health">
      <h2><span className="sc-ico shield">⚖</span>Saúde da distribuição — agora {atualizadoAs && <span className="dist-upd">· atualizado às {atualizadoAs} (renova a cada 30s)</span>}</h2>
      <div className="dist-last">
        <h3>Quem recebeu os últimos leads</h3>
        {(saude.ultimosLeads ?? []).map((u, i) => <div className="dist-last-row" key={i}>
          <b>{u.quando}</b>
          <span className="dl-main"><strong>{u.nome}</strong> · {u.como}{u.abordagem_ok ? " · abordagem entregue ✓" : " · ⚠ sem abordagem ainda"}</span>
          <span className={`dl-cor ${u.corretor.startsWith("—") ? "sem" : ""}`}>{u.corretor}</span>
        </div>)}
        {(saude.ultimosLeads ?? []).length === 0 && <p className="settings-hint">Nenhum lead recente.</p>}
      </div>
      <div className="dist-kpis">
        <article className={saude.orfaosAgora > 0 ? "warn" : "ok"}><strong>{saude.orfaosAgora}</strong><span>Leads sem corretor</span></article>
        <article><strong>{saude.naFilaAgora}</strong><span>Na fila do motor</span></article>
        <article><strong>{saude.entradas24h}</strong><span>Leads entraram · 24h</span></article>
        <article className="ok"><strong>{saude.enviosOk24h}</strong><span>Mensagens entregues · 24h</span></article>
        <article className={saude.falhasDefinitivas24h > 0 ? "bad" : "ok"}><strong>{saude.falhasDefinitivas24h}</strong><span>Falhas definitivas · 24h</span></article>
        <article><strong>{saude.failovers24h}</strong><span>Failovers acionados · 24h</span></article>
        <article><strong>{saude.foraJanela24h}</strong><span>Distribuídos fora da janela · 24h</span></article>
        <article className={saude.instanciasConectadas < saude.instanciasTotal ? "warn" : "ok"}><strong>{saude.instanciasConectadas}/{saude.instanciasTotal}</strong><span>Instâncias conectadas</span></article>
      </div>
      <div className="dist-occ">
        <header><h3>Últimas ocorrências (o porquê de cada falha)</h3><button type="button" onClick={() => void load()}>↻ Atualizar</button></header>
        {agruparOcorrencias(saude.ocorrencias ?? []).map((o, i) => <div className={`dist-occ-row ${o.status === "erro" ? "erro" : "alerta"}`} key={i}><b>{o.quando}</b><em>{o.status === "erro" ? "ERRO" : "alerta"}</em>{o.repeticoes > 1 && <span className="occ-n">×{o.repeticoes} tentativas</span>}<span title={o.motivo}><strong>{o.lead_nome || "—"}</strong> · {o.motivo}</span></div>)}
        {(saude.ocorrencias ?? []).length === 0 && <p className="settings-hint">Nenhuma ocorrência nas últimas 48h — tudo fluindo. ✓</p>}
      </div>
    </section>}

    <section className="settings-card settings-presence">
      <h2><span className="sc-ico shield">⚖</span>Regras de distribuição & abordagem</h2>
      <p>O princípio: <b>todo lead que entra é distribuído e recebe a abordagem — sempre.</b> Aqui você comanda como o sistema garante isso.</p>

      <div className="presence-cfg-grid">
        <label>Janela começa<input type="time" value={cfg.janela_inicio} onChange={(e) => setCfg({ ...cfg, janela_inicio: e.target.value })} /></label>
        <label>Janela termina<input type="time" value={cfg.janela_fim} onChange={(e) => setCfg({ ...cfg, janela_fim: e.target.value })} /></label>
        <label>Recebe leads até<input type="time" value={cfg.receber_ate} onChange={(e) => setCfg({ ...cfg, receber_ate: e.target.value })} /></label>
        <label>Fim de semana exige (dias de presença na semana)<input type="number" min={0} max={5} value={cfg.fds_exige_presencas} onChange={(e) => setCfg({ ...cfg, fds_exige_presencas: Number(e.target.value) })} /></label>
      </div>

      <div className="dist-modo">
        <span className="presence-dias-label">Como o rodízio escolhe o corretor?</span>
        {RODIZIOS.map((m) => <label className={`dist-modo-opt ${cfg.modo_rodizio === m.v ? "on" : ""}`} key={m.v}>
          <input type="radio" name="modo-rodizio" checked={cfg.modo_rodizio === m.v} onChange={() => setCfg({ ...cfg, modo_rodizio: m.v })} />
          <div><strong>{m.t}</strong><small>{m.d}</small></div>
        </label>)}
      </div>

      <div className="dist-modo">
        <span className="presence-dias-label">Fora da janela ({cfg.janela_fim} → {cfg.janela_inicio}), o que fazer com o lead?</span>
        {MODOS.map((m) => <label className={`dist-modo-opt ${cfg.modo_fora_janela === m.v ? "on" : ""}`} key={m.v}>
          <input type="radio" name="modo-fora-janela" checked={cfg.modo_fora_janela === m.v} onChange={() => setCfg({ ...cfg, modo_fora_janela: m.v })} />
          <div><strong>{m.t}</strong><small>{m.d}</small></div>
        </label>)}
      </div>

      {sw("failover_envio", "Failover de envio (nunca deixar de abordar)", "Se o envio falhar numa instância, tenta a outra do corretor; esgotou, passa para a próxima instância conectada da operação até entregar.")}
      {sw("failover_transfere_lead", "Transferir o lead para quem enviou", "Quando o failover envia por outro corretor, o lead passa para ele — o cliente responde no WhatsApp de quem mandou. Desligado, o lead fica com o corretor original.")}
      {sw("resgate_orfaos", "Resgate automático de leads sem corretor", "A cada 15 minutos, qualquer lead que tenha ficado sem dono é redistribuído assim que houver corretor elegível.")}

      {notice && <div className="presence-cfg-notice">{notice}</div>}
      <footer className="settings-form-footer"><span>As regras valem para o motor imediatamente após salvar.</span><div><button type="button" className="presence-cfg-save settings-save" disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "✓ Salvar regras"}</button></div></footer>
    </section>
  </div>;
}
