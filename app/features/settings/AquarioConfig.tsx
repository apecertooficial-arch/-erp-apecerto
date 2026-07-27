"use client";
/* Aquário — seção de Configurações (só gestor): sobe leads para a piscina de pescaria.
   O corretor NÃO vê esta tela; ele só pesca pelo funil do CRM. */
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type AquarioRow = { nome: string; telefone: string; email: string };

function splitLinha(linha: string, sep: string): string[] {
  // Divide respeitando aspas ("Silva; Filho" não quebra no ; interno)
  const out: string[] = []; let cur = ""; let dentro = false;
  for (let i = 0; i < linha.length; i += 1) {
    const ch = linha[i];
    if (ch === '"') { if (dentro && linha[i + 1] === '"') { cur += '"'; i += 1; } else dentro = !dentro; }
    else if (ch === sep && !dentro) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectarSeparador(linha: string): string {
  const pv = (linha.match(/;/g) ?? []).length, vg = (linha.match(/,/g) ?? []).length, tb = (linha.match(/\t/g) ?? []).length;
  if (tb >= pv && tb >= vg) return "\t";
  return pv >= vg ? ";" : ",";
}

const COL_NOME = ["nome", "name", "nome completo", "full name", "fullname", "cliente", "lead", "nome do lead"];
const COL_FONE = ["telefone", "phone", "celular", "fone", "whatsapp", "tel", "mobile", "telemovel", "número", "numero"];
const COL_EMAIL = ["email", "e-mail", "mail"];

function parseAquarioLinhas(texto: string): { validas: AquarioRow[]; invalidas: string[] } {
  const validas: AquarioRow[] = []; const invalidas: string[] = [];
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return { validas, invalidas };
  const sep = detectarSeparador(linhas[0]);

  // Planilha com cabeçalho (exportações de outros sistemas): usa só as colunas certas
  const cab = splitLinha(linhas[0], sep).map((c) => c.toLowerCase().replace(/^"|"$/g, "").trim());
  const idxDe = (nomes: string[]) => { const i = cab.findIndex((c) => nomes.includes(c)); return i >= 0 ? i : cab.findIndex((c) => nomes.some((n) => n.length > 3 && c.includes(n)) && !c.startsWith("raw")); };
  const iNome = idxDe(COL_NOME), iFone = idxDe(COL_FONE), iMail = idxDe(COL_EMAIL);
  const comCabecalho = iNome >= 0 && iFone >= 0;

  for (const linha of comCabecalho ? linhas.slice(1) : linhas) {
    const baixa = linha.toLowerCase();
    if (!comCabecalho && baixa.includes("nome") && /telefone|celular|fone|whats|contato/.test(baixa)) continue; // cabeçalho do molde
    const partes = splitLinha(linha, sep).map((p) => p.replace(/^"|"$/g, "").trim());
    let nome = "", telefone = "", email = "";
    if (comCabecalho) {
      nome = partes[iNome] ?? "";
      telefone = partes[iFone] ?? "";
      email = (iMail >= 0 ? partes[iMail] ?? "" : "").toLowerCase();
      if (!/\d{8}/.test(telefone.replace(/\D/g, ""))) {
        // coluna de telefone vazia — tenta achar outra coluna que pareça telefone
        telefone = partes.find((p) => { const d = p.replace(/\D/g, ""); return d.length >= 8 && d.length / Math.max(p.length, 1) > 0.5; }) ?? "";
      }
      if (email && !email.includes("@")) email = "";
    }
    if (!comCabecalho || !nome || telefone.replace(/\D/g, "").length < 8) {
      // Sem cabeçalho (ou linha fora do padrão do cabeçalho): identifica cada pedaço sozinho
      const pedacos = linha.split(/[;,\t]/).map((p) => p.replace(/^"|"$/g, "").trim()).filter(Boolean);
      let n2 = "", t2 = "", e2 = "";
      const sobras: string[] = [];
      for (const parte of pedacos) {
        const digitos = parte.replace(/\D/g, "");
        if (!e2 && parte.includes("@")) e2 = parte.toLowerCase();
        else if (!t2 && digitos.length >= 8 && digitos.length / Math.max(parte.length, 1) > 0.5) t2 = parte;
        else sobras.push(parte);
      }
      const nomeCab = comCabecalho ? (partes[iNome] ?? "").trim() : "";
      n2 = (nomeCab.replace(/\D/g, "").length < 8 ? nomeCab : "") || sobras.join(" ").trim();
      if (n2 && t2.replace(/\D/g, "").length >= 8) { nome = n2; telefone = t2; email = email || e2; }
    }
    if (nome && telefone.replace(/\D/g, "").length >= 8) validas.push({ nome, telefone, email });
    else invalidas.push(linha);
  }
  return { validas, invalidas };
}

export function AquarioConfig({ accessToken }: { accessToken: string }) {
  const [aba, setAba] = useState<"planilha" | "colar">("planilha");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
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

  const lerArquivo = async (file: File) => {
    setErro(null); setResultado(null);
    try {
      const buf = await file.arrayBuffer();
      const nomeArq = file.name.toLowerCase();
      const bytes = new Uint8Array(buf.slice(0, 4));
      const pareceZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // xlsx = zip "PK"
      const pareceXlsAntigo = bytes[0] === 0xd0 && bytes[1] === 0xcf; // xls antigo (OLE)
      if (nomeArq.endsWith(".xlsx") || nomeArq.endsWith(".xls") || pareceZip || pareceXlsAntigo) {
        // Planilha Excel: converte a primeira aba para texto separado por ";"
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "array" });
        const primeira = wb.SheetNames[0];
        if (!primeira) { setErro("A planilha está vazia."); return; }
        // rawNumbers: telefone salvo como número no Excel sai completo (evita "5,56E+12")
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[primeira], { FS: ";", blankrows: false, rawNumbers: true });
        setTexto(csv);
        return;
      }
      // CSV/TXT: detecta a codificação (Excel-BR costuma salvar em Windows-1252 ou UTF-16)
      const b = new Uint8Array(buf);
      let textoLido: string;
      if (b[0] === 0xff && b[1] === 0xfe) textoLido = new TextDecoder("utf-16le").decode(buf);
      else if (b[0] === 0xfe && b[1] === 0xff) textoLido = new TextDecoder("utf-16be").decode(buf);
      else {
        textoLido = new TextDecoder("utf-8").decode(buf);
        if (textoLido.includes("�")) textoLido = new TextDecoder("windows-1252").decode(buf);
      }
      setTexto(textoLido);
    } catch {
      setErro("Não foi possível ler o arquivo. Tente salvar como CSV ou XLSX e envie de novo.");
    }
  };

  const importar = async () => {
    if (!validas.length) { setErro("Nenhum lead válido — cada linha precisa de nome e telefone."); return; }
    setBusy(true); setErro(null);
    const total = { importados: 0, duplicados: 0, invalidos: 0 };
    const LOTE = 1000;
    try {
      for (let i = 0; i < validas.length; i += LOTE) {
        setProgresso(`${Math.min(i + LOTE, validas.length)} de ${validas.length}`);
        const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "aquarioImportar", rows: validas.slice(i, i + LOTE) }) });
        const result = await response.json() as { error?: string; importados?: number; duplicados?: number; invalidos?: number };
        if (!response.ok) throw new Error(`${result.error || "Não foi possível importar."}${total.importados ? ` (${total.importados} já haviam entrado antes do erro)` : ""}`);
        total.importados += Number(result.importados ?? 0);
        total.duplicados += Number(result.duplicados ?? 0);
        total.invalidos += Number(result.invalidos ?? 0);
        setResultado({ ...total });
      }
      setTexto("");
      await carregarStatus();
    } catch (reason) { setErro(reason instanceof Error ? reason.message : "Não foi possível importar."); }
    finally { setBusy(false); setProgresso(null); }
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
      <p>Colunas: <b>nome, telefone, email</b> (e-mail é opcional). Aceita <b>Excel (.xlsx/.xls)</b> direto ou CSV — não precisa converter.</p>
      <button type="button" className="aq-molde" onClick={baixarMolde}>⬇ Baixar molde (molde-aquario.csv)</button>
      <label className="aq-file">Escolher planilha (Excel ou CSV)<input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(event) => { const f = event.target.files?.[0]; if (f) void lerArquivo(f); event.target.value = ""; }} /></label>
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
    <footer className="settings-form-footer"><span>Duplicados (telefone já no CRM) são ignorados automaticamente.</span><button type="button" className="settings-save" disabled={busy || !validas.length} onClick={() => void importar()}>{busy ? `Importando… ${progresso ?? ""}` : `⬆ Importar ${validas.length || ""} leads no aquário`}</button></footer>
  </section>;
}
