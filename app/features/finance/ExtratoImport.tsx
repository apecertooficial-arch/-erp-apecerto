"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

/* IMPORTAR EXTRATO BANCÁRIO (ago/2026).

   Vale daqui pra frente: não existe backfill nem conciliação do histórico.
   Você sobe a planilha do banco, cada linha aparece com uma sugestão, e você
   confirma ou corrige. O que já foi importado antes não volta.

   A ordem das sugestões foi tirada de um extrato real do BTG e não é
   arbitrária:

   1. Casa com lançamento que já existe (mesmo valor, data próxima) -> vincular.
   2. Não casou e é Pix para o próprio titular da conta -> transferência entre
      contas, sugere ignorar.
   3. Resto -> lançamento novo, com categoria vinda de caixa_keywords.

   A ordem importa: naquele extrato, um Pix de R$ 9.980 para o próprio titular
   era, na verdade, uma comissão já lançada. Se a regra de transferência viesse
   antes da de casamento, esse dinheiro sumiria da conciliação. */

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const dataCurta = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${iso}T12:00:00`)); } catch { return iso; } };

export type ExtratoImportacao = { id: string; banco: string | null; agencia: string | null; conta: string | null; titular: string | null; periodo_inicio: string | null; periodo_fim: string | null; saldo_abertura: number | null; saldo_fechamento: number | null; arquivo_nome: string | null; linhas_total: number; criado_em: string };
export type ExtratoLinha = { id: string; importacao_id: string; data: string; descricao: string; valor: number; saldo: number | null; situacao: string; sugestao: string; sugestao_lancamento_id: string | null; categoria_sugerida: string | null; lancamento_id: string | null };

type Celulas = Record<string, string>;
type LinhaLida = { data: string; descricao: string; valor: number; saldo: number | null };

/* Lê a planilha com a biblioteca xlsx, que já é dependência direta do projeto
   e cobre .xlsx e .csv. Devolve as linhas como mapa de letra de coluna para
   texto — é assim que se fala de planilha ("a data está na coluna B"), e é o
   formato que extrato_layout guarda por banco. */
async function lerPlanilha(file: File): Promise<{ celulas: Celulas[]; erro?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const pasta = XLSX.read(buffer, { type: "array", raw: false, cellDates: false });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    if (!aba) return { celulas: [], erro: "A planilha não tem nenhuma aba legível." };
    const matriz = XLSX.utils.sheet_to_json<string[]>(aba, { header: 1, raw: false, defval: "" });
    const letra = (indice: number) => { let nome = "", n = indice; do { nome = String.fromCharCode(65 + (n % 26)) + nome; n = Math.floor(n / 26) - 1; } while (n >= 0); return nome; };
    return { celulas: matriz.map((linha) => {
      const celula: Celulas = {};
      linha.forEach((valor, indice) => { const texto = String(valor ?? "").trim(); if (texto) celula[letra(indice)] = texto; });
      return celula;
    }) };
  } catch (motivo) {
    return { celulas: [], erro: motivo instanceof Error ? `Não consegui abrir o arquivo: ${motivo.message}` : "Não consegui abrir o arquivo." };
  }
}

const soNumero = (valor: string) => Number(String(valor).replace(/\./g, (m, i, s: string) => (s.length - i - 1) % 4 === 3 ? "" : m).replace(/[^\d,.-]/g, "").replace(",", "."));
const paraIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

function interpretar(celulas: Celulas[]) {
  const achaCelula = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return m ? (celulas[Number(m[2]) - 1]?.[m[1]] ?? "") : ""; };
  const linhas: LinhaLida[] = [];
  for (const c of celulas) {
    const colunas = Object.keys(c);
    const colData = colunas.find((k) => /^\d{2}\/\d{2}\/\d{4}$/.test((c[k] || "").trim()));
    if (!colData) continue;
    const resto = colunas.filter((k) => k !== colData).sort();
    const colDescricao = resto.find((k) => (c[k] || "").length > 3 && !/^-?[\d.,]+$/.test((c[k] || "").trim()));
    const numericas = resto.filter((k) => /^-?[\d.,]+$/.test((c[k] || "").trim()));
    if (!colDescricao || numericas.length === 0) continue;
    const valor = soNumero(c[numericas[0]]);
    if (!Number.isFinite(valor) || valor === 0) continue;
    linhas.push({ data: paraIso(c[colData]), descricao: (c[colDescricao] || "").trim(), valor, saldo: numericas[1] ? soNumero(c[numericas[1]]) : null });
  }
  const periodo = celulas.map((c) => Object.values(c).find((v) => /\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/.test(v || ""))).find(Boolean) || "";
  const datasPeriodo = [...periodo.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((m) => paraIso(m[1]));
  const acharRotulado = (regex: RegExp) => {
    for (const c of celulas) {
      const chaves = Object.keys(c).sort();
      const i = chaves.findIndex((k) => regex.test(c[k] || ""));
      if (i >= 0) { const proxima = chaves[i + 1]; if (proxima && c[proxima]) return c[proxima]; }
    }
    return "";
  };
  return {
    linhas,
    cabecalho: {
      titular: acharRotulado(/raz[ãa]o social/i),
      banco: acharRotulado(/^banco$/i),
      agencia: acharRotulado(/ag[êe]ncia/i),
      conta: acharRotulado(/^conta$/i),
      periodoInicio: datasPeriodo[0] || "",
      periodoFim: datasPeriodo[1] || "",
      saldoAbertura: soNumero(acharRotulado(/saldo de abertura/i)) || null,
      saldoFechamento: soNumero(acharRotulado(/saldo de fechamento/i)) || null,
    },
    celulaBruta: achaCelula,
  };
}

const rotuloSugestao: Record<string, string> = { vincular: "Já existe no caixa", transferencia: "Transferência sua", novo: "Lançamento novo" };

export function ExtratoImport({ accessToken, importacoes, linhas, categorias, onMutate }: {
  accessToken: string;
  importacoes: ExtratoImportacao[];
  linhas: ExtratoLinha[];
  categorias: Array<{ id: string; nome: string; tipo: string }>;
  onMutate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<Record<string, { categoria: string; descricao: string }>>({});
  const inputArquivo = useRef<HTMLInputElement>(null);

  const ultima = importacoes[0] ?? null;
  const pendentes = useMemo(() => linhas.filter((l) => l.situacao === "pendente").sort((a, b) => b.data.localeCompare(a.data)), [linhas]);
  const conferencia = useMemo(() => {
    if (!ultima || ultima.saldo_abertura == null || ultima.saldo_fechamento == null) return null;
    const doArquivo = linhas.filter((l) => l.importacao_id === ultima.id).reduce((soma, l) => soma + Number(l.valor), 0);
    const diferenca = Number(ultima.saldo_abertura) + doArquivo - Number(ultima.saldo_fechamento);
    return { diferenca, ok: Math.abs(diferenca) < 1 };
  }, [ultima, linhas]);

  const enviar = async (file: File) => {
    setErro(null); setAviso(null); setBusy(true);
    try {
      const { celulas, erro: falha } = await lerPlanilha(file);
      if (falha) throw new Error(falha);
      const lido = interpretar(celulas);
      if (lido.linhas.length === 0) throw new Error("Não encontrei nenhum lançamento nesta planilha. Confira se é o extrato e não o comprovante.");
      await onMutate({ action: "importarExtrato", arquivoNome: file.name, ...lido.cabecalho, linhas: lido.linhas });
      setAviso(`${lido.linhas.length} linha(s) lida(s) de ${file.name}.`);
    } catch (motivo) {
      setErro(motivo instanceof Error ? motivo.message : "Não foi possível ler o arquivo.");
    } finally {
      setBusy(false);
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  };

  const resolver = async (linha: ExtratoLinha, decisao: "lancar" | "vincular" | "ignorar") => {
    setErro(null); setBusy(true);
    try {
      const edicao = edicoes[linha.id];
      await onMutate({ action: "resolverLinhaExtrato", linhaId: linha.id, decisao, categoria: edicao?.categoria ?? linha.categoria_sugerida ?? "", descricao: edicao?.descricao ?? linha.descricao });
    } catch (motivo) {
      setErro(motivo instanceof Error ? motivo.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  };

  const aceitarTudo = async () => {
    setErro(null); setBusy(true);
    try { await onMutate({ action: "resolverLoteExtrato", importacaoId: ultima?.id ?? null }); setAviso("Sugestões aplicadas. O que você já tinha editado foi respeitado."); }
    catch (motivo) { setErro(motivo instanceof Error ? motivo.message : "Não foi possível aplicar."); }
    finally { setBusy(false); }
  };

  const editar = (id: string, patch: Partial<{ categoria: string; descricao: string }>) =>
    setEdicoes((atual) => ({ ...atual, [id]: { categoria: atual[id]?.categoria ?? "", descricao: atual[id]?.descricao ?? "", ...patch } }));

  return <section className="extrato-painel">
    <header className="extrato-topo">
      <div>
        <h3>Importar extrato do banco</h3>
        <p>Suba a planilha do banco. Cada linha vem com uma sugestão — você confirma ou corrige. O que já foi importado antes não aparece de novo.</p>
      </div>
      <label className={`extrato-upload${busy ? " ocupado" : ""}`}>
        {busy ? "Lendo…" : "＋ Subir extrato"}
        <input ref={inputArquivo} type="file" accept=".xlsx,.csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviar(f); }} />
      </label>
    </header>

    {erro && <p className="extrato-erro">{erro}</p>}
    {aviso && !erro && <button className="extrato-aviso" type="button" onClick={() => setAviso(null)}>{aviso} ×</button>}

    {ultima && <div className="extrato-resumo">
      <article><span>Arquivo</span><strong>{ultima.arquivo_nome || "—"}</strong></article>
      <article><span>Período</span><strong>{ultima.periodo_inicio ? `${dataCurta(ultima.periodo_inicio)} a ${dataCurta(ultima.periodo_fim || ultima.periodo_inicio)}` : "—"}</strong></article>
      <article><span>Linhas</span><strong>{ultima.linhas_total}</strong></article>
      {conferencia && <article className={conferencia.ok ? "" : "alerta"}>
        <span>Confere com o saldo do banco</span>
        <strong>{conferencia.ok ? "Sim ✓" : `Falta ${brl.format(Math.abs(conferencia.diferenca))}`}</strong>
      </article>}
    </div>}

    {conferencia && !conferencia.ok && <p className="extrato-alerta">
      A soma das linhas não fecha com o saldo declarado pelo banco. Diferença de {brl.format(Math.abs(conferencia.diferenca))} — em geral significa linha faltando no arquivo. Centavos são arredondamento do próprio banco e podem ser ignorados.
    </p>}

    {pendentes.length > 0 && <div className="extrato-acoes-lote">
      <span><b>{pendentes.length}</b> linha(s) esperando sua decisão</span>
      <button type="button" disabled={busy} onClick={aceitarTudo}>Aceitar todas as sugestões</button>
    </div>}

    {pendentes.map((linha) => {
      const edicao = edicoes[linha.id];
      const saida = Number(linha.valor) < 0;
      return <article className={`extrato-linha ${linha.sugestao}`} key={linha.id}>
        <div className="extrato-linha-fato">
          <span className="extrato-data">{dataCurta(linha.data)}</span>
          <strong className={saida ? "negative" : "positive"}>{saida ? "−" : "+"}{brl.format(Math.abs(Number(linha.valor)))}</strong>
          <em className={`extrato-tag ${linha.sugestao}`}>{rotuloSugestao[linha.sugestao] ?? linha.sugestao}</em>
        </div>
        <p className="extrato-descricao" title={linha.descricao}>{linha.descricao}</p>
        {linha.sugestao !== "vincular" && <div className="extrato-linha-form">
          <label>Descrição no caixa<input value={edicao?.descricao ?? linha.descricao} onChange={(e) => editar(linha.id, { descricao: e.target.value })} /></label>
          <label>Categoria<select value={edicao?.categoria ?? linha.categoria_sugerida ?? ""} onChange={(e) => editar(linha.id, { categoria: e.target.value })}>
            <option value="">Escolha…</option>
            {categorias.filter((c) => c.tipo === "ambos" || c.tipo === (saida ? "saida" : "entrada")).map((c) => <option value={c.nome} key={c.id}>{c.nome}</option>)}
          </select></label>
        </div>}
        <div className="extrato-linha-botoes">
          {linha.sugestao === "vincular"
            ? <button className="extrato-primario" type="button" disabled={busy} onClick={() => void resolver(linha, "vincular")}>É o mesmo lançamento</button>
            : <button className="extrato-primario" type="button" disabled={busy} onClick={() => void resolver(linha, "lancar")}>Lançar no caixa</button>}
          {linha.sugestao === "vincular" && <button type="button" disabled={busy} onClick={() => void resolver(linha, "lancar")}>Não é — lançar novo</button>}
          <button type="button" disabled={busy} onClick={() => void resolver(linha, "ignorar")}>Ignorar</button>
        </div>
      </article>;
    })}

    {pendentes.length === 0 && <p className="extrato-vazio">
      {ultima ? "Nenhuma linha esperando decisão. Suba um extrato novo quando quiser." : "Nenhum extrato importado ainda. Suba a planilha do seu banco para começar."}
    </p>}
  </section>;
}
