"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";

type Lead = { id: number; nome: string | null; telefone: string | null; tags: string[] | null; status: string | null; origem: string | null; disparo_optout: boolean };
type Deal = { id: number; lead_id: number; stage_id: number | null; empreendimento_id: string | null; status: string };
type Stage = { id: number; pipeline_id: number; nome: string; rotulo: string | null };
type Approach = { id: number; nome: string; mensagens: unknown; produto_id: number | null };
type Product = { id: string; nome: string; bairro: string | null };
type Recent = { id: number; lead_id: number | null; telefone: string; texto: string | null; quando: string; status: string | null; resultado: string | null; criado_em: string | null };
type CampaignData = { leads: Lead[]; deals: Deal[]; stages: Stage[]; approaches: Approach[]; products: Product[]; recent: Recent[] };

function approachText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return String((first as Record<string, unknown>).texto ?? (first as Record<string, unknown>).mensagem ?? "");
  }
  return "";
}

export function CampaignWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<CampaignData>({ leads: [], deals: [], stages: [], approaches: [], products: [], recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("crm");
  const [stage, setStage] = useState("");
  const [destinationStage, setDestinationStage] = useState("");
  const [tag, setTag] = useState("");
  const [product, setProduct] = useState("");
  const [selectedApproaches, setSelectedApproaches] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [rate, setRate] = useState("20");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [period, setPeriod] = useState("7");
  const [days, setDays] = useState("weekdays");
  const [csvLeads, setCsvLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    const response = await fetch("/api/campaigns", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json() as CampaignData & { error?: string };
    if (!response.ok) setError(body.error ?? "Não foi possível carregar os disparos."); else setData(body);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [accessToken]);
  const tags = useMemo(() => [...new Set(data.leads.flatMap((lead) => lead.tags ?? []))].sort(), [data.leads]);
  const dealByLead = useMemo(() => new Map(data.deals.map((deal) => [deal.lead_id, deal])), [data.deals]);
  const eligible = useMemo(() => {
    const base = origin === "excel" ? csvLeads : data.leads;
    return base.filter((lead) => {
      const deal = dealByLead.get(lead.id);
      return !lead.disparo_optout && (!stage || deal?.stage_id === Number(stage)) && (!tag || (lead.tags ?? []).includes(tag)) && (!product || deal?.empreendimento_id === product);
    });
  }, [origin, csvLeads, data.leads, dealByLead, stage, tag, product]);
  const valid = eligible.filter((lead) => Boolean(lead.telefone));
  const invalid = eligible.length - valid.length;
  const selectedStage = data.stages.find((item) => String(item.id) === stage);
  const destinationStages = data.stages.filter((item) => item.pipeline_id === selectedStage?.pipeline_id && String(item.id) !== stage);

  const approachVariants = useMemo(() => selectedApproaches.map((id) => approachText(data.approaches.find((a) => a.id === id)?.mensagens)).filter(Boolean), [selectedApproaches, data.approaches]);
  const variants = useMemo(() => { const list = [...approachVariants]; if (message.trim()) list.push(message.trim()); return [...new Set(list)]; }, [approachVariants, message]);
  function toggleApproach(id: number) { setSelectedApproaches((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }

  function importCsv(file?: File) {
    if (!file) return;
    void file.text().then((text) => {
      const rows = text.split(/\r?\n/).map((line) => line.split(/[;,]/)).filter((row) => row.some(Boolean));
      const header = rows.shift()?.map((item) => item.trim().toLowerCase()) ?? [];
      const nameIndex = header.findIndex((item) => /nome|name/.test(item)); const phoneIndex = header.findIndex((item) => /telefone|phone|celular/.test(item));
      const imported = rows.map((row, index) => ({ id: 10_000_000 + index, nome: row[nameIndex] ?? `Contato ${index + 1}`, telefone: row[phoneIndex] ?? null, tags: [], status: "importado", origem: "excel", disparo_optout: false }));
      setCsvLeads(imported); setOrigin("excel"); setNotice(`${imported.length} contatos importados da planilha.`);
    });
  }

  async function schedule() {
    if (!valid.length || !variants.length) { setNotice("Selecione um público válido e ao menos uma abordagem (ou escreva a mensagem)."); return; }
    if (!window.confirm(`Agendar ${valid.length} mensagens${variants.length > 1 ? `, distribuídas entre ${variants.length} variações` : ""}? Elas serão processadas pelo provedor conectado.`)) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/campaigns", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: valid.filter((lead) => lead.id < 10_000_000).map((lead) => lead.id), messages: variants, message: variants[0], rate: Number(rate), start: `${startDate}T${startTime}:00`, sourceStageId: Number(stage), destinationStageId: Number(destinationStage) }) });
    const body = await response.json() as { error?: string; scheduled?: number };
    if (!response.ok) setNotice(body.error ?? "Não foi possível agendar."); else { setNotice(`${body.scheduled} mensagens agendadas.`); await load(); }
    setBusy(false);
  }

  return <div className="campaign-workspace">
    <header className="workspace-top"><div><h1>Disparos</h1><p>Campanhas de mensagens por segmento — com cadência e IA</p></div><label className="workspace-search">⌕ <input placeholder="Buscar lead, telefone, bairro..." /></label></header>
    {loading ? <div className="workspace-loading">Carregando campanhas...</div> : error ? <div className="workspace-error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div> : <main className="campaign-main">
      <div className="campaign-grid"><div className="campaign-left">
        <section className="campaign-card"><h2>Público-alvo</h2><div className="campaign-fields">
          <label>Origem de saída<select value={origin} onChange={(event) => { setOrigin(event.target.value); setStage(""); setDestinationStage(""); }}><option value="crm">Leads existentes</option><option value="excel">Base nova · Excel/CSV</option></select></label>
          <label>Etapa de saída<select value={stage} onChange={(event) => { setStage(event.target.value); setDestinationStage(""); }} disabled={origin === "excel"}><option value="">Selecione de onde os leads sairão</option>{data.stages.map((item) => <option value={item.id} key={item.id}>{item.rotulo || item.nome}</option>)}</select></label>
          <label>Etapa de destino<select value={destinationStage} onChange={(event) => setDestinationStage(event.target.value)} disabled={origin === "excel" || !stage}><option value="">Selecione para onde irão após o envio</option>{destinationStages.map((item) => <option value={item.id} key={item.id}>{item.rotulo || item.nome}</option>)}</select></label>
          <label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)} disabled={origin === "excel"}><option value="">Todas as tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Produto associado<select value={product} onChange={(event) => setProduct(event.target.value)} disabled={origin === "excel"}><option value="">Qualquer produto</option>{data.products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
        </div>{origin === "excel" && <label className="csv-upload">＋ Selecionar planilha CSV<input hidden type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} /></label>}
        <div className="audience-count"><strong>{eligible.length}</strong><span>leads elegíveis neste segmento</span></div><div className="audience-quality"><span>✓ Válidos: <b>{valid.length}</b></span><span>⚠ Sem telefone: <b>{invalid}</b></span><span>⊘ Opt-out removidos automaticamente</span></div>{stage && destinationStage && <div className="campaign-flow-note"><b>{selectedStage?.rotulo || selectedStage?.nome}</b><span>→</span><b>{data.stages.find((item) => String(item.id) === destinationStage)?.rotulo || data.stages.find((item) => String(item.id) === destinationStage)?.nome}</b><small>O lead muda de etapa somente depois que o envio for confirmado.</small></div>}</section>
        <section className="campaign-card message-card"><header><h2>Mensagem</h2><button type="button" onClick={() => setMessage(`Olá {primeiro_nome}! Separei uma oportunidade que combina com o seu perfil. Posso te enviar os detalhes?`)}>✦ Gerar template com IA</button></header><div className="approach-multiselect">{data.approaches.map((item) => <button type="button" className={selectedApproaches.includes(item.id) ? "chip active" : "chip"} onClick={() => toggleApproach(item.id)} key={item.id}>{selectedApproaches.includes(item.id) ? "✓ " : "+ "}{item.nome}</button>)}{!data.approaches.length && <span className="approach-multiselect-empty">Nenhuma abordagem cadastrada ainda.</span>}</div>{selectedApproaches.length > 0 && <div className="approach-previews">{selectedApproaches.map((id) => { const a = data.approaches.find((x) => x.id === id); const txt = approachText(a?.mensagens); return <div className="approach-preview" key={id}><strong>{a?.nome}</strong><p>{txt.replaceAll("{primeiro_nome}", valid[0]?.nome?.split(/\s+/)[0] ?? "cliente") || "(sem texto)"}</p></div>; })}</div>}<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Mensagem personalizada (opcional — conta como mais uma variação). Use {primeiro_nome}." rows={5} /><small>{variants.length} variação{variants.length === 1 ? "" : "ões"} · {valid.length} leads serão divididos entre elas{variants.length > 1 ? " proporcionalmente" : ""}</small></section>
      </div><aside className="campaign-card cadence-card"><h2>Cadência</h2><label>Velocidade<select value={rate} onChange={(event) => setRate(event.target.value)}><option value="10">Lento · 10/h</option><option value="20">Normal · 20/h</option><option value="50">Rápido · 50/h</option><option value="60">Super rápido · 60/h</option></select></label><div><label>Início<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>Fim<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div><label>Data inicial<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="1">1 dia</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option></select></label><label>Dias<select value={days} onChange={(event) => setDays(event.target.value)}><option value="weekdays">Seg a Sex</option><option value="all">Todos os dias</option><option value="saturday">Seg a Sáb</option></select></label><button className="schedule-button" type="button" disabled={busy || origin === "excel" || !valid.length || !variants.length || !stage || !destinationStage} onClick={() => void schedule()}>➤ {busy ? "Agendando..." : "Agendar disparo"}</button>{origin === "excel" && <p>Revise e cadastre a base nova no CRM antes de agendar o envio.</p>}{notice && <div className="campaign-notice">{notice}</div>}</aside></div>
      <section className="recent-campaigns"><h2>Disparos recentes</h2>{data.recent.length ? data.recent.slice(0, 12).map((item) => <article key={item.id}><span>➤</span><div><strong>{item.telefone}</strong><small>{item.texto?.slice(0, 80) || "Mensagem sem texto"} · {new Date(item.quando).toLocaleString("pt-BR")}</small></div><b className={`campaign-status ${item.status ?? ""}`}>{item.status ?? "agendado"}</b></article>) : <div className="campaign-empty">Nenhum disparo registrado.</div>}</section>
    </main>}
  </div>;
}
