"use client";
/* Aquário — seção de Configurações (só gestor): sobe leads para a piscina de pescaria.
   O corretor NÃO vê esta tela; ele só pesca pelo funil do CRM. */
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type AquarioRow = { nome: string; telefone: string; email: string };

function parseAquarioLinhas(texto: string): { validas: AquarioRow[]; invalidas: string[] } {
  const validas: AquarioRow[] = []; const invalidas: string[] = [];
  for (const raw of texto.split(/\r?\n/)) {
    const linha = raw.trim();
    if (!linha) continue;
    const baixa = linha.toLowerCase();
    if (baixa.includes("nome") && baixa.includes("telefone")) continue; // cabeçalho do molde
    const partes = linha.split(/[;,\t]/).map((p) => p.trim().replace(/^"|"$/g, "")).filter(Boolean);
    let nome = "", telefone = "", email = "";
    const sobras: string[] = [];
    for (const parte of partes) {
      const digitos = parte.replace(/\D/g, "");
      if (!email && parte.includes("@")) email = parte.toLowerCase();
      else if (!telefone && digitos.length >= 8 && digitos.length / Math.max(parte.length, 1) > 0.5) telefone = parte;
      else sobras.push(parte);
    }
    nome = sobras.join(" ").trim();
    if (nome && telefone) validas.push({ nome, telefone, email });
    else invalidas.push(linha);
  }
  return { validas, invalidas };
}

export function AquarioConfig({ accessToken }: { accessToken: string }) {
  const [aba, setAba] = useState<"planilha" | "colar">("planilha");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [disponiveis, setDisponiveis] = useState<number | null>(null);
  const [resultado, setResultado] = useState<{ importados: number; duplicados: number; invalidos: number } | null>(null);
  const { validas, invalidas } = useMemo(() => parseAquarioLinhas(texto), [texto]);

  const carregarStatus = async () => {
    const { data } = await getBrowserSupabaseClient().rpc("aquario_status");
    const r = data && typeof data === "object" ? data as Record<string, unknown> : {};
    setDisponiveis(Number(r.disponiveis ?? 0));
  };
  useEffect(() => { void carregarStatus(); }, []);

  const baixarMolde = () => {
    const blob = new Blob(["nome;telefone;email\nMaria Silva;(11) 99999-0000;maria@email.com\nJoão Souza;11988887777;\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "molde-aquario.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const lerArquivo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { setTexto(String(reader.result ?? "")); setErro(null); setResultado(null); };
    reader.onerror = () => setErro("Não foi possível ler o arquivo. Salve a planilha como CSV e tente de novo.");
    reader.readAsText(file, "utf-8");
  };

  const importar = async () => {
    if (!validas.length) { setErro("Nenhum lead válido — cada linha precisa de nome e telefone."); return; }
    setBusy(true); setErro(null);
    try {
      const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "aquarioImportar", rows: validas }) });
      const result = await response.json() as { error?: string; importados?: number; duplicados?: number; invalidos?: number };
      if (!response.ok) throw new Error(result.error || "Não foi possível importar.");
      setResultado({ importados: Number(result.importados ?? 0), duplicados: Number(result.duplicados ?? 0), invalidos: Number(result.invalidos ?? 0) });
      setTexto("");
      await carregarStatus();
    } catch (reason) { setErro(reason instanceof Error ? reason.message : "Não foi possível importar."); }
    finally { setBusy(false); }
  };

  return <section className="settings-card aq-config">
    <h2><span className="sc-ico shield">🐟</span>Aquário — subir leads para pescaria</h2>
    <p>Os leads entram na etapa <b>🐟 Aquário</b> do funil <b>sem corretor e sem automação</b>, com a tag Aquário. Cada corretor pesca os seus pelo botão <b>🎣 Pescar um lead</b> no CRM — sempre o mais antigo primeiro, sem escolher a dedo.</p>
    <div className="aq-config-status"><span className="aq-fish-ico">🐟</span><div><strong>{disponiveis ?? "…"}</strong><small>{disponiveis === 1 ? "lead esperando" : "leads esperando"} no aquário agora</small></div><button type="button" onClick={() => void carregarStatus()}>↻ Atualizar</button></div>

    <nav className="aq-tabs">
      <button type="button" className={aba === "planilha" ? "active" : ""} onClick={() => setAba("planilha")}>📄 Planilha (CSV)</button>
      <button type="button" className={aba === "colar" ? "active" : ""} onClick={() => setAba("colar")}>📋 Colar lista</button>
    </nav>
    {aba === "planilha" && <div className="aq-pane">
      <p>Use o molde: colunas <b>nome; telefone; email</b> (e-mail é opcional). No Excel, salve como <b>CSV</b>.</p>
      <button type="button" className="aq-molde" onClick={baixarMolde}>⬇ Baixar molde (molde-aquario.csv)</button>
      <label className="aq-file">Escolher arquivo CSV<input type="file" accept=".csv,.txt" onChange={(event) => { const f = event.target.files?.[0]; if (f) lerArquivo(f); event.target.value = ""; }} /></label>
    </div>}
    {aba === "colar" && <div className="aq-pane">
      <p>Cole uma linha por lead — eu identifico sozinho o que é nome, telefone e e-mail (separe por vírgula, ponto e vírgula ou tab).</p>
      <textarea rows={7} value={texto} onChange={(event) => { setTexto(event.target.value); setResultado(null); }} placeholder={"Maria Silva; (11) 99999-0000; maria@email.com\nJoão Souza, 11988887777"} />
    </div>}
    {texto.trim() && <div className="aq-preview">
      <strong>{validas.length} {validas.length === 1 ? "lead pronto" : "leads prontos"} para importar</strong>
      {invalidas.length > 0 && <em>⚠ {invalidas.length} linha(s) ignorada(s) — faltou nome ou telefone: {invalidas.slice(0, 3).join(" · ")}{invalidas.length > 3 ? "…" : ""}</em>}
      <div className="aq-preview-rows">{validas.slice(0, 6).map((r, i) => <span key={i}><b>{r.nome}</b> · {r.telefone}{r.email ? ` · ${r.email}` : ""}</span>)}{validas.length > 6 && <span>… e mais {validas.length - 6}</span>}</div>
    </div>}
    {erro && <div className="settings-toast">{erro}</div>}
    {resultado && <div className="aq-result">
      <div className="aq-result-num ok"><strong>{resultado.importados}</strong><span>importados</span></div>
      <div className="aq-result-num"><strong>{resultado.duplicados}</strong><span>duplicados (já existiam)</span></div>
      <div className="aq-result-num"><strong>{resultado.invalidos}</strong><span>inválidos</span></div>
    </div>}
    <footer className="settings-form-footer"><span>Duplicados (telefone já no CRM) são ignorados automaticamente.</span><button type="button" className="settings-save" disabled={busy || !validas.length} onClick={() => void importar()}>{busy ? "Importando…" : `⬆ Importar ${validas.length || ""} leads no aquário`}</button></footer>
  </section>;
}
