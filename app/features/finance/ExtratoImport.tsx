"use client";


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
import type { FinanceData } from "./FinanceWorkspace";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const dataCurta = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${iso}T12:00:00`)); } catch { return iso; } };

export type ExtratoImportacao = { id: string; banco: string | null; agencia: string | null; conta: string | null; titular: string | null; periodo_inicio: string | null; periodo_fim: string | null; saldo_abertura: number | null; saldo_fechamento: number | null; arquivo_nome: string | null; linhas_total: number; criado_em: string };
export type ExtratoLinha = { id: string; importacao_id: string; data: string; descricao: string; valor: number; saldo: number | null; situacao: string; sugestao: string; sugestao_lancamento_id: string | null; categoria_sugerida: string | null; lancamento_id: string | null };

type Celulas = Record<string, string | number>;
type LinhaLida = { data: string; descricao: string; valor: number; saldo: number | null };

/* Lê a planilha com a biblioteca xlsx, que já é dependência direta e cobre
   .xlsx e .csv.

   raw: true de propósito. Com raw: false o xlsx devolve o texto JÁ FORMATADO
   pela planilha, e aí "9980" chega como "9.980,00". A primeira versão desta
   tela tentava desmontar esse texto e errava em todo valor acima de mil: das
   11 linhas de um extrato real, 4 sumiram em silêncio — R$ 19.069. Com raw
   o número chega como número e não há o que interpretar. */
async function lerPlanilha(file: File): Promise<{ celulas: Celulas[]; erro?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const pasta = XLSX.read(buffer, { type: "array", raw: true });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    if (!aba) return { celulas: [], erro: "A planilha não tem nenhuma aba legível." };
    const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: "" }) as unknown as Array<Array<string | number>>;
    const letra = (indice: number) => { let nome = "", n = indice; do { nome = String.fromCharCode(65 + (n % 26)) + nome; n = Math.floor(n / 26) - 1; } while (n >= 0); return nome; };
    return { celulas: matriz.map((linha) => {
      const celula: Celulas = {};
      linha.forEach((valor, indice) => {
        if (valor === "" || valor === null || valor === undefined) return;
        celula[letra(indice)] = typeof valor === "number" ? valor : String(valor).trim();
      });
      return celula;
    }) };
  } catch (motivo) {
    return { celulas: [], erro: motivo instanceof Error ? `Não consegui abrir o arquivo: ${motivo.message}` : "Não consegui abrir o arquivo." };
  }
}

/* Só entra aqui o que chegou como texto. Cobre 1.234,56 e 1,234.56, e o caso
   ambíguo 9.980 (milhar em pt-BR, não 9 vírgula 98). Devolve NaN quando não
   entende — e quem chama é obrigado a tratar, nunca a ignorar. */
/* O \s do JavaScript ja cobre espaco nao-quebravel (U+00A0), que e o que os
   bancos costumam colocar entre R$ e o numero. Nao acrescente o caractere
   literal aqui: alem de redundante, ele nao sobrevive a toda ferramenta que
   move este arquivo. */
const soNumero = (bruto: string | number): number => {
  if (typeof bruto === "number") return bruto;
  const texto = String(bruto ?? "").replace(/\s|R\$/g, "");
  if (!texto) return NaN;
  const negativo = texto.startsWith("-") || /^\(.*\)$/.test(texto);
  let n = texto.replace(/[()+-]/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(n)) n = n.replace(/\./g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(n)) n = n.replace(/,/g, "");
  else if (n.lastIndexOf(",") > n.lastIndexOf(".")) n = n.replace(/\./g, "").replace(",", ".");
  else n = n.replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(n) || n === "" || n === ".") return NaN;
  const valor = Number(n);
  return Number.isFinite(valor) ? (negativo ? -valor : valor) : NaN;
};

const ehData = (v: string | number) => typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v.trim());
const paraIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

/* Devolve também o que NÃO conseguiu ler. Linha de extrato que o programa não
   entende não pode desaparecer calada: ou ela aparece na tela, ou vira um
   buraco no caixa que ninguém percebe. */
function interpretar(celulas: Celulas[]) {
  const linhas: LinhaLida[] = [];
  const naoLidas: string[] = [];
  for (const c of celulas) {
    const colunas = Object.keys(c).sort();
    const colData = colunas.find((k) => ehData(c[k]));
    if (!colData) continue;
    const resto = colunas.filter((k) => k !== colData);
    const colDescricao = resto.find((k) => typeof c[k] === "string" && String(c[k]).length > 3 && Number.isNaN(soNumero(c[k])));
    const numericas = resto.filter((k) => k !== colDescricao && !Number.isNaN(soNumero(c[k])));
    const descricao = colDescricao ? String(c[colDescricao]).trim() : "";
    if (numericas.length === 0) { naoLidas.push(`${c[colData]} · ${descricao || "sem descrição"} · sem valor numérico`); continue; }
    const valor = soNumero(c[numericas[0]]);
    if (!Number.isFinite(valor) || valor === 0) { naoLidas.push(`${c[colData]} · ${descricao || "sem descrição"} · valor ilegível`); continue; }
    linhas.push({ data: paraIso(String(c[colData])), descricao, valor, saldo: numericas[1] !== undefined ? soNumero(c[numericas[1]]) : null });
  }
  const textos = celulas.flatMap((c) => Object.values(c).filter((v): v is string => typeof v === "string"));
  const periodo = textos.find((v) => /\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/.test(v)) || "";
  const datasPeriodo = [...periodo.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((m) => paraIso(m[1]));
  const acharRotulado = (regex: RegExp) => {
    for (const c of celulas) {
      const chaves = Object.keys(c).sort();
      const i = chaves.findIndex((k) => typeof c[k] === "string" && regex.test(String(c[k])));
      if (i >= 0) { const proxima = chaves[i + 1]; if (proxima && c[proxima] !== undefined) return c[proxima]; }
    }
    return "";
  };
  const numeroRotulado = (regex: RegExp) => { const v = soNumero(acharRotulado(regex)); return Number.isFinite(v) ? v : null; };
  return {
    linhas,
    naoLidas,
    cabecalho: {
      titular: String(acharRotulado(/raz[ãa]o social/i) || ""),
      banco: String(acharRotulado(/^banco$/i) || ""),
      agencia: String(acharRotulado(/ag[êe]ncia/i) || ""),
      conta: String(acharRotulado(/^conta$/i) || ""),
      periodoInicio: datasPeriodo[0] || "",
      periodoFim: datasPeriodo[1] || "",
      saldoAbertura: numeroRotulado(/saldo de abertura/i),
      saldoFechamento: numeroRotulado(/saldo de fechamento/i),
    },
  };
}

const rotuloSugestao: Record<string, string> = { vincular: "Já existe no caixa", transferencia: "Transferência sua", novo: "Lançamento novo" };

const papelRotulo: Record<string, string> = { corretor: "Corretor", executivo: "Executivo", gerente: "Taxa de gerente", apecerto: "Apecerto", indicacao: "Indicação" };

type Edicao = { categoria: string; descricao: string; saleId: string; commissionId: string };

export function ExtratoImport({ importacoes, linhas, data, onMutate }: {
  importacoes: ExtratoImportacao[];
  linhas: ExtratoLinha[];
  data: FinanceData;
  onMutate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const categorias = data.categorias ?? [];
  const usuarioPorId = new Map((data.users ?? []).map((u) => [u.id, u]));
  const rotuloVenda = (venda: { empreendimento_nome: string | null; data_venda: string; vgv: number }) =>
    `${venda.empreendimento_nome || "Venda"} · ${dataCurta(venda.data_venda)} · ${brl.format(venda.vgv)}`;
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({});
  const [naoLidas, setNaoLidas] = useState<string[]>([]);
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
      setNaoLidas(lido.naoLidas);
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
      await onMutate({ action: "resolverLinhaExtrato", linhaId: linha.id, decisao,
        categoria: edicao?.categoria ?? linha.categoria_sugerida ?? "",
        descricao: edicao?.descricao ?? linha.descricao,
        saleId: edicao?.saleId || null,
        commissionId: edicao?.commissionId || null });
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

  /* O patch precisa cair sobre a linha, nao sobre um objeto vazio. Na primeira
     versao, mexer so na categoria zerava a descricao junto — e o campo ficava
     em branco na cara do usuario. */
  const editar = (linha: ExtratoLinha, patch: Partial<Edicao>) =>
    setEdicoes((atual) => ({ ...atual, [linha.id]: {
      categoria: atual[linha.id]?.categoria ?? linha.categoria_sugerida ?? "",
      descricao: atual[linha.id]?.descricao ?? linha.descricao,
      saleId: atual[linha.id]?.saleId ?? "",
      commissionId: atual[linha.id]?.commissionId ?? "",
      ...patch,
    } }));

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

    {naoLidas.length > 0 && <div className="extrato-nao-lidas">
      <strong>{naoLidas.length} linha(s) do arquivo eu não consegui ler e NÃO foram importadas:</strong>
      <ul>{naoLidas.slice(0, 8).map((texto, i) => <li key={i}>{texto}</li>)}</ul>
      {naoLidas.length > 8 && <span>…e mais {naoLidas.length - 8}.</span>}
      <span>Confira essas no extrato e lance à mão em Movimentações, senão vão faltar no caixa.</span>
    </div>}

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
      const categoriaEscolhida = edicao?.categoria ?? linha.categoria_sugerida ?? "";
      const natureza = categorias.find((c) => c.nome === categoriaEscolhida)?.natureza || "normal";
      const ehComissaoPaga = natureza === "comissao_paga";
      const ehComissao = ehComissaoPaga || natureza === "comissao_recebida";
      const comissoesDaVenda = edicao?.saleId ? (data.commissions ?? []).filter((c) => c.venda_id === edicao.saleId) : [];
      const faltaVenda = ehComissao && !edicao?.saleId;
      const faltaParte = ehComissaoPaga && Boolean(edicao?.saleId) && comissoesDaVenda.length > 0 && !edicao?.commissionId;
      return <article className={`extrato-linha ${linha.sugestao}`} key={linha.id}>
        <div className="extrato-linha-fato">
          <span className="extrato-data">{dataCurta(linha.data)}</span>
          <strong className={saida ? "negative" : "positive"}>{saida ? "−" : "+"}{brl.format(Math.abs(Number(linha.valor)))}</strong>
          <em className={`extrato-tag ${linha.sugestao}`}>{rotuloSugestao[linha.sugestao] ?? linha.sugestao}</em>
        </div>
        <p className="extrato-descricao" title={linha.descricao}>{linha.descricao}</p>
        {linha.sugestao !== "vincular" && <div className="extrato-linha-form">
          <label>Descrição no caixa<input value={edicao?.descricao ?? linha.descricao} onChange={(e) => editar(linha, { descricao: e.target.value })} /></label>
          <label>Categoria<select value={categoriaEscolhida} onChange={(e) => editar(linha, { categoria: e.target.value, saleId: "", commissionId: "" })}>
            <option value="">Escolha…</option>
            {categorias.filter((c) => c.tipo === "ambos" || c.tipo === (saida ? "saida" : "entrada")).map((c) => <option value={c.nome} key={c.id}>{c.nome}</option>)}
          </select></label>
          {ehComissao && <label className="extrato-largo">Venda relacionada (obrigatória)<select value={edicao?.saleId ?? ""} onChange={(e) => editar(linha, { saleId: e.target.value, commissionId: "" })}>
            <option value="">Selecione a venda…</option>
            {(data.sales ?? []).map((venda) => <option value={venda.id} key={venda.id}>{rotuloVenda(venda)}</option>)}
          </select></label>}
          {ehComissaoPaga && edicao?.saleId && (comissoesDaVenda.length > 0
            ? <label className="extrato-largo">Comissão / corretor que está sendo pago<select value={edicao?.commissionId ?? ""} onChange={(e) => editar(linha, { commissionId: e.target.value })}>
                <option value="">Selecione a parte…</option>
                {comissoesDaVenda.map((c) => <option value={c.id} key={c.id}>{papelRotulo[c.papel] || c.papel}{c.beneficiario_id ? ` · ${usuarioPorId.get(c.beneficiario_id)?.nome || "sem nome"}` : ""} · {brl.format(c.valor_final)}</option>)}
              </select></label>
            : <p className="extrato-aviso-inline">Esta venda ainda não tem comissões distribuídas. Abra a ficha dela em “Vendas &amp; comissões” e cadastre os participantes antes de lançar o pagamento.</p>)}
        </div>}
        <div className="extrato-linha-botoes">
          {linha.sugestao === "vincular"
            ? <button className="extrato-primario" type="button" disabled={busy} onClick={() => void resolver(linha, "vincular")}>É o mesmo lançamento</button>
            : <button className="extrato-primario" type="button" disabled={busy || faltaVenda || faltaParte} title={faltaVenda ? "Escolha a venda desta comissão" : faltaParte ? "Escolha quem está sendo pago" : undefined} onClick={() => void resolver(linha, "lancar")}>Lançar no caixa</button>}
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
