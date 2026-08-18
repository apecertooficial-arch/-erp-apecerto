"use client";

/* AUTOMAÇÕES — a tela do módulo. Uma só.
 *
 * Biblioteca na frente (cada automação lida como sequência, com selos, abas,
 * busca, contadores e ações por cartão) e o construtor por dentro.
 *
 * O CONSTRUTOR NÃO FOI REIMPLEMENTADO. O automationBuilderRuntime.js (159 KB)
 * continua sendo montado exatamente como antes — mesmo import dinâmico, mesmo
 * mount(host, {authToken, supabaseUrl, publishableKey}), mesmo unmount na saída.
 * O título por bloco entra por decoração de DOM (decorarBlocos.ts), sem tocar no
 * motor: bloco sem título mostra o tipo, como hoje.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExplicadorAutomacoes } from "./ExplicadorAutomacoes";
import { decorarBlocos, type MapaTitulos } from "./decorarBlocos";
import "../../styles/automation-builder.css";

type OriginalAutomationBuilder = {
  mount: (host: HTMLDivElement, context: { authToken: string; supabaseUrl: string; publishableKey: string }) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

/* Os 12 tipos do runtime (TYPES) traduzidos para rótulo e cor da marca. As chaves
   são os `type` gravados em mapa.automation.blocks — quem manda é o compile() do
   construtor, não um nome inventado aqui. */
const TIPOS: Record<string, { rotulo: string; tint: string; tinta: string }> = {
  trigger: { rotulo: "Início", tint: "#FFE4D1", tinta: "#CC5800" },
  "field-operation": { rotulo: "Operações de campos", tint: "#F2EFEC", tinta: "#6E6760" },
  condition: { rotulo: "Condição", tint: "#FDF1D9", tinta: "#B5700A" },
  action: { rotulo: "Ação", tint: "#E4F6EC", tinta: "#127A44" },
  randomizer: { rotulo: "Randomizador", tint: "#F7ECFC", tinta: "#66009A" },
  distribution: { rotulo: "Distribuir leads (roleta)", tint: "#F7ECFC", tinta: "#66009A" },
  "distribution-simple": { rotulo: "Distribuir lead (simples)", tint: "#F7ECFC", tinta: "#66009A" },
  chat: { rotulo: "Mensagem", tint: "#FFE4D1", tinta: "#CC5800" },
  "send-approach": { rotulo: "Enviar abordagem", tint: "#EBD1F5", tinta: "#4A0070" },
  time: { rotulo: "Espera", tint: "#F2EFEC", tinta: "#6E6760" },
  api: { rotulo: "API", tint: "#FBE5E5", tinta: "#B32C2C" },
  "ai-agent": { rotulo: "Agente de IA", tint: "#F7ECFC", tinta: "#66009A" },
};

const FAM_TIPO: Record<string, string> = {
  gatilho: "trigger", mapeamento: "field-operation", condicao: "condition", acao: "action",
  randomizador: "randomizer", distribuicao: "distribution", distribuicao_simples: "distribution-simple",
  mensagem: "chat", espera: "time", api: "api", agente: "ai-agent",
};

type Passo = { rotulo: string; tint: string; tinta: string };
type Automacao = {
  id: number; nome: string; grupo: string | null; ativa: boolean;
  status: "publicado" | "rascunho"; arquivada: boolean; passos: Passo[]; blocos: number;
};
type Filtro = "todas" | "rodando" | "desligadas" | "rascunhos" | "arquivadas";

type MapaEditor = { blocks?: Record<string, { x?: number; y?: number; fam?: string }>; wires?: Array<{ from: string; port: string; to: string }> };
type Mapa = { editor?: MapaEditor; automation?: { blocks?: Array<{ id?: string; type?: string; options?: Record<string, unknown>; presentation?: { x?: number; y?: number } }> } };

function lerPassos(mapa: unknown): { passos: Passo[]; blocos: number } {
  const m = (mapa ?? {}) as Mapa;
  const editor = m.editor?.blocks ?? {};
  const blocos = m.automation?.blocks ?? [];
  const bruto = blocos.length
    ? blocos.map((b) => ({ tipo: String(b.type ?? ""), y: editor[String(b.id)]?.y ?? b.presentation?.y ?? 0 }))
    : Object.entries(editor).map(([, eb]) => ({ tipo: FAM_TIPO[String(eb.fam ?? "")] ?? "", y: eb.y ?? 0 }));
  const passos = bruto.slice().sort((a, b) => a.y - b.y)
    .map((b) => TIPOS[b.tipo] ?? { rotulo: b.tipo || "Bloco", tint: "#F2EFEC", tinta: "#6E6760" });
  return { passos, blocos: bruto.length };
}

/* Ligações do fluxo. editor.wires é a fonte; automação antiga só tem os ponteiros
   dentro de options (nextBlockId, trueNextBlockId…) e o próprio runtime deriva
   deles no hydrate — fazemos igual, varrendo qualquer chave *BlockId. */
function lerLigacoes(m: Mapa): Array<{ from: string; to: string }> {
  const w = m.editor?.wires ?? [];
  if (w.length) return w.map((x) => ({ from: String(x.from), to: String(x.to) }));
  const saida: Array<{ from: string; to: string }> = [];
  (m.automation?.blocks ?? []).forEach((b) => {
    const o = (b.options ?? {}) as Record<string, unknown>;
    Object.keys(o).forEach((k) => { if (/BlockId$/.test(k) && o[k]) saida.push({ from: String(b.id), to: String(o[k]) }); });
  });
  return saida;
}

const Ico = ({ d, tam = 15 }: { d: string; tam?: number }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const D_AJUDA = "M12 17h.01M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4";
const D_COPIA = "M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3M5 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z";
const D_LIGA = "M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0";
const D_LIXO = "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6";

export function AutomationsWorkspace({ accessToken }: { accessToken: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const [tela, setTela] = useState<"biblioteca" | "construtor">("biblioteca");
  const [abrirId, setAbrirId] = useState<number | null>(null);
  const [lista, setLista] = useState<Automacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [remontar, setRemontar] = useState(0);
  const [arranjando, setArranjando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [passosAbertos, setPassosAbertos] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const titulosRef = useRef<MapaTitulos>({});

  const cab = useMemo(
    () => ({ apikey: publishableKey ?? "", Authorization: `Bearer ${accessToken}` }),
    [accessToken, publishableKey],
  );

  const carregar = useCallback(async () => {
    if (!supabaseUrl || !publishableKey) { setErro("Configuração pública do Supabase não encontrada."); return; }
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?select=id,nome,grupo,ativa,status,arquivada,mapa&order=id.asc`, { headers: cab });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      const linhas = (await r.json()) as Array<Record<string, unknown>>;
      setLista(linhas.map((l) => {
        const { passos, blocos } = lerPassos(l.mapa);
        return {
          id: Number(l.id), nome: String(l.nome ?? "—"), grupo: (l.grupo as string) ?? null,
          ativa: l.ativa === true,
          status: (String(l.status ?? "publicado") === "rascunho" ? "rascunho" : "publicado") as "publicado" | "rascunho",
          arquivada: l.arquivada === true, passos, blocos,
        };
      }));
      setErro(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar automações."); }
  }, [cab, publishableKey, supabaseUrl]);

  /* A PRIMEIRA CARGA É EFEITO DE PROPÓSITO. `carregar` é a única fonte da lista e
     ele grava estado (setLista/setErro) — não existe nada derivável na
     renderização, os dados vêm do banco. Mesmo caso, mesma solução já adotada em
     ManagerPanelMobile.tsx e RelatoriosMobile.tsx. */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  /* TÍTULO POR BLOCO — coluna automacoes.titulos (jsonb), fora de mapa.
     Salvar volta atrás se o banco recusar: a tela não pode mostrar um nome que
     não foi gravado. */
  const salvarTitulo = useCallback(async (blocoId: string, valor: string) => {
    if (!supabaseUrl || abrirId == null) return;
    const antes = { ...titulosRef.current };
    const depois = { ...antes };
    if (valor) depois[blocoId] = valor; else delete depois[blocoId];
    titulosRef.current = depois;
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${abrirId}`, {
        method: "PATCH",
        headers: { ...cab, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ titulos: depois }),
      });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      setAviso(valor ? `Bloco nomeado: "${valor}".` : "Nome do bloco removido.");
    } catch (e) {
      titulosRef.current = antes;
      setAviso(e instanceof Error ? e.message : "Não foi possível salvar o nome do bloco.");
    }
    setRemontar((v) => v + 1);
  }, [abrirId, cab, supabaseUrl]);

  /* Construtor original. Os títulos são buscados ANTES de montar, para o primeiro
     desenho já sair nomeado. Quando o gestor chegou aqui clicando numa automação,
     o único gancho possível é o próprio item da coluna do runtime
     (.sb-item[data-id]): ele não expõe openAutomacao. Tentamos por alguns segundos
     e desistimos em silêncio — sem o clique ele fica na tela inicial dele. */
  useEffect(() => {
    if (tela !== "construtor") return;
    let ativo = true;
    let builder: OriginalAutomationBuilder | null = null;
    let pararDecoracao: (() => void) | null = null;
    if (!supabaseUrl || !publishableKey) {
      if (hostRef.current) hostRef.current.innerHTML = '<div class="original-automation-error">Configuração pública do Supabase não encontrada.</div>';
      return;
    }
    void (async () => {
      if (abrirId != null) {
        try {
          const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${abrirId}&select=titulos`, { headers: cab });
          if (r.ok) titulosRef.current = ((await r.json())[0]?.titulos ?? {}) as MapaTitulos;
        } catch { titulosRef.current = {}; }
      } else { titulosRef.current = {}; }
      if (!ativo) return;
      const { default: mod } = await import("./automationBuilderRuntime.js");
      if (!ativo || !hostRef.current) return;
      builder = mod as OriginalAutomationBuilder;
      builder.mount(hostRef.current, { authToken: accessToken, supabaseUrl, publishableKey });
      pararDecoracao = decorarBlocos(
        hostRef.current,
        () => titulosRef.current,
        (blocoId, atual) => {
          const novo = window.prompt("Nome deste bloco (deixe vazio para voltar ao tipo):", atual);
          if (novo === null) return;
          void salvarTitulo(blocoId, novo.trim());
        },
      );
      if (abrirId == null) return;
      let tentativas = 0;
      const tentar = () => {
        if (!ativo) return;
        const item = hostRef.current?.querySelector<HTMLElement>(`.sb-item[data-id="${abrirId}"]`);
        if (item) { item.click(); return; }
        if (tentativas++ < 40) setTimeout(tentar, 150);
      };
      setTimeout(tentar, 200);
    })().catch((e: unknown) => {
      if (!ativo || !hostRef.current) return;
      hostRef.current.innerHTML = `<div class="original-automation-error">${e instanceof Error ? e.message : "Erro ao carregar Automações."}</div>`;
    });
    return () => { ativo = false; pararDecoracao?.(); builder?.unmount(); };
  }, [tela, abrirId, remontar, accessToken, cab, publishableKey, salvarTitulo, supabaseUrl]);

  /* ORGANIZAR NA HORIZONTAL.
     O canvas do runtime sempre foi horizontal por dentro — entrada na ESQUERDA do
     cartão (.in-dot), saídas à direita, fio saindo na horizontal. O que ficava
     vertical eram as POSIÇÕES salvas: automação antiga nasceu com x fixo e y
     crescente. Reposicionamos onde as posições moram (mapa.editor.blocks[i].x/y) e
     remontamos para reidratar. Altura vem MEDIDA do cartão renderizado: estimar
     por tipo já nos custou sobreposição. Nada além de x/y é tocado. */
  const organizarH = useCallback(async () => {
    if (!supabaseUrl || !publishableKey || abrirId == null) { setAviso("Abra uma automação para organizar."); return; }
    setArranjando(true); setAviso(null);
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${abrirId}&select=mapa`, { headers: cab });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      const mapa = ((await r.json())[0]?.mapa ?? {}) as Mapa;
      const blocos = mapa.editor?.blocks;
      if (!blocos || !Object.keys(blocos).length) { setAviso("Esta automação não tem blocos para organizar."); return; }
      const ids = Object.keys(blocos);
      const ligacoes = lerLigacoes(mapa).filter((l) => blocos[l.from] && blocos[l.to]);
      const saidas: Record<string, string[]> = {};
      ids.forEach((i) => { saidas[i] = []; });
      ligacoes.forEach((l) => saidas[l.from].push(l.to));
      const ehAlvo: Record<string, boolean> = {};
      ligacoes.forEach((l) => { ehAlvo[l.to] = true; });
      const col: Record<string, number> = {};
      const raizes = ids.filter((i) => !ehAlvo[i]);
      const pilha = [...(raizes.length ? raizes : [ids[0]])];
      pilha.forEach((i) => { col[i] = 0; });
      let guarda = 0;
      while (pilha.length && guarda++ < 6000) {
        const i = pilha.shift() as string;
        saidas[i].forEach((j) => {
          const c = (col[i] ?? 0) + 1;
          if (col[j] == null || col[j] < c) { col[j] = c; pilha.push(j); }
        });
      }
      ids.forEach((i) => { if (col[i] == null) col[i] = 0; });
      const alturas: Record<string, number> = {};
      ids.forEach((i) => {
        const el = hostRef.current?.querySelector<HTMLElement>(`.node[data-id="${i}"]`);
        alturas[i] = el?.offsetHeight || 260;
      });
      const LARG = 340, GX = 140, GY = 44, PADX = 80, PADY = 80;
      const porColuna: Record<number, string[]> = {};
      ids.slice().sort((a, b) => (col[a] - col[b]) || ((blocos[a].y ?? 0) - (blocos[b].y ?? 0)))
        .forEach((i) => { (porColuna[col[i]] = porColuna[col[i]] || []).push(i); });
      Object.keys(porColuna).forEach((c) => {
        let y = PADY;
        porColuna[Number(c)].forEach((i) => {
          blocos[i].x = PADX + Number(c) * (LARG + GX);
          blocos[i].y = y;
          y += alturas[i] + GY;
        });
      });
      const p = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${abrirId}`, {
        method: "PATCH",
        headers: { ...cab, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ mapa }),
      });
      if (!p.ok) throw new Error(`Supabase respondeu ${p.status} ao salvar as posições`);
      setRemontar((v) => v + 1);
      setAviso("Fluxo organizado da esquerda para a direita.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível organizar o fluxo.");
    } finally { setArranjando(false); }
  }, [abrirId, cab, publishableKey, supabaseUrl]);

  /* AÇÕES POR CARTÃO — os quatro botões do rodapé. Escrevem na tabela automacoes,
     os mesmos campos que o construtor escreve. Duplicar e excluir pedem
     confirmação: são irreversíveis e esta lista é operação de verdade. */
  const alternarAtiva = useCallback(async (a: Automacao) => {
    if (!supabaseUrl) return;
    setOcupado(a.id); setAviso(null);
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${a.id}`, {
        method: "PATCH",
        headers: { ...cab, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ativa: !a.ativa }),
      });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      await carregar();
      setAviso(`"${a.nome}" ${a.ativa ? "desligada" : "ligada"}.`);
    } catch (e) { setAviso(e instanceof Error ? e.message : "Não foi possível mudar o estado."); }
    finally { setOcupado(null); }
  }, [cab, carregar, supabaseUrl]);

  const duplicar = useCallback(async (a: Automacao) => {
    if (!supabaseUrl) return;
    if (!confirm(`Duplicar "${a.nome}"? A cópia nasce como rascunho desligado.`)) return;
    setOcupado(a.id); setAviso(null);
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${a.id}&select=nome,grupo,mapa,titulos`, { headers: cab });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      const base = (await r.json())[0] as { nome?: string; grupo?: string | null; mapa?: unknown; titulos?: unknown };
      const p = await fetch(`${supabaseUrl}/rest/v1/automacoes`, {
        method: "POST",
        headers: { ...cab, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ nome: `${base.nome ?? a.nome} (cópia)`, grupo: base.grupo ?? null, mapa: base.mapa ?? {}, titulos: base.titulos ?? {}, ativa: false, status: "rascunho", arquivada: false }),
      });
      if (!p.ok) throw new Error(`Supabase respondeu ${p.status} ao duplicar`);
      await carregar();
      setAviso("Cópia criada como rascunho desligado.");
    } catch (e) { setAviso(e instanceof Error ? e.message : "Não foi possível duplicar."); }
    finally { setOcupado(null); }
  }, [cab, carregar, supabaseUrl]);

  const excluir = useCallback(async (a: Automacao) => {
    if (!supabaseUrl) return;
    if (!confirm(`Excluir "${a.nome}"? Isto não volta atrás.`)) return;
    setOcupado(a.id); setAviso(null);
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${a.id}`, { method: "DELETE", headers: { ...cab, Prefer: "return=minimal" } });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      await carregar();
      setAviso(`"${a.nome}" excluída.`);
    } catch (e) { setAviso(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setOcupado(null); }
  }, [cab, carregar, supabaseUrl]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista ?? []).filter((a) => {
      if (filtro === "arquivadas") { if (!a.arquivada) return false; } else if (a.arquivada) return false;
      if (filtro === "rodando" && !a.ativa) return false;
      if (filtro === "desligadas" && a.ativa) return false;
      if (filtro === "rascunhos" && a.status !== "rascunho") return false;
      if (q && !a.nome.toLowerCase().includes(q) && !(a.grupo ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lista, filtro, busca]);

  const contas = useMemo(() => {
    const t = lista ?? [];
    const vivas = t.filter((a) => !a.arquivada);
    return {
      total: vivas.length, rodando: vivas.filter((a) => a.ativa).length,
      rascunhos: vivas.filter((a) => a.status === "rascunho").length,
      arquivadas: t.filter((a) => a.arquivada).length,
      blocos: vivas.reduce((s, a) => s + a.blocos, 0),
    };
  }, [lista]);

  const abas: Array<[Filtro, string, number]> = [
    ["todas", "Todas", contas.total], ["rodando", "Rodando", contas.rodando],
    ["desligadas", "Desligadas", contas.total - contas.rodando],
    ["rascunhos", "Rascunhos", contas.rascunhos], ["arquivadas", "Arquivadas", contas.arquivadas],
  ];

  if (tela === "construtor") {
    return (
      <div className="automations-v2-shell apn-shell">
        <header className="apn-topo-construtor">
          <button type="button" className="apn-voltar" onClick={() => { setTela("biblioteca"); setAbrirId(null); setAviso(null); void carregar(); }}>← Automações</button>
          <div className="apn-topo-txt"><span>CONSTRUTOR</span><h1>Blocos, portas e ligações do fluxo</h1></div>
          <button type="button" className="apn-arranjo" onClick={() => void organizarH()} disabled={arranjando || abrirId == null} title="Reposiciona os blocos da esquerda para a direita seguindo os fios. Salve o que estiver aberto antes.">
            {arranjando ? "Organizando…" : "Organizar na horizontal"}
          </button>
          <span className="apn-chip apn-chip-ok">{contas.total} automações</span>
        </header>
        {aviso && <div className="apn-aviso-arranjo">{aviso}</div>}
        <div className="original-automation-host" ref={hostRef} />
        <ExplicadorAutomacoes accessToken={accessToken} />
      </div>
    );
  }

  return (
    <div className="apn-shell">
      <header className="apn-topo">
        <div>
          <span className="apn-eyebrow">ROTINAS QUE RODAM SOZINHAS</span>
          <h1>Automações</h1>
          <p>Cada automação é uma sequência que o sistema executa no lugar do corretor.</p>
        </div>
        <button type="button" className="apn-cta" onClick={() => { setAbrirId(null); setTela("construtor"); }}>+ Nova automação</button>
      </header>

      {erro && <div className="apn-erro">{erro} <button type="button" onClick={() => void carregar()}>tentar de novo</button></div>}
      {aviso && <div className="apn-aviso-arranjo">{aviso}</div>}

      <section className="apn-secao">
        <span className="apn-eyebrow">O QUE ESTÁ CADASTRADO</span>
        <h2>Como as rotinas estão trabalhando</h2>
        <div className="apn-kpis">
          {[
            { ico: "⚡", n: contas.rodando, r: "Automações rodando", p: `de ${contas.total} cadastradas`, tint: "#FFE4D1", tinta: "#CC5800" },
            { ico: "▤", n: contas.blocos, r: "Blocos no total", p: "somando os fluxos em operação", tint: "#F7ECFC", tinta: "#66009A" },
            { ico: "○", n: contas.rascunhos, r: "Rascunhos", p: "ainda não publicados", tint: "#FDF1D9", tinta: "#B5700A" },
            { ico: "⤓", n: contas.arquivadas, r: "Arquivadas", p: "fora da operação", tint: "#F2EFEC", tinta: "#6E6760" },
          ].map((k) => (
            <article key={k.r} className="apn-kpi">
              <span className="apn-tile" style={{ background: k.tint, color: k.tinta }}>{k.ico}</span>
              <strong>{lista ? k.n : "—"}</strong>
              <span className="apn-kpi-rot">{k.r}</span>
              <small>{k.p}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="apn-secao">
        <span className="apn-eyebrow">BIBLIOTECA DE ROTINAS</span>
        <h2>As automações da imobiliária</h2>
        <div className="apn-filtros">
          {abas.map(([k, r, n]) => (
            <button key={k} type="button" className={`apn-aba ${filtro === k ? "ativa" : ""}`} onClick={() => setFiltro(k)}>{r} · {n}</button>
          ))}
          <label className="apn-busca">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar automação" />
          </label>
          <span className="apn-contador">{visiveis.length} de {contas.total} automações</span>
        </div>

        {!lista && !erro && <div className="apn-vazio">Carregando as automações do banco…</div>}
        {lista && visiveis.length === 0 && <div className="apn-vazio">Nada aqui com esse filtro.</div>}

        <div className="apn-lista">
          {visiveis.map((a) => (
            <article key={a.id} className={`apn-card ${a.ativa ? "" : "off"}`}>
              <div className="apn-card-topo">
                <span className="apn-tile" style={{ background: "#FFE4D1", color: "#CC5800" }}>⚡</span>
                <div className="apn-card-nome">
                  <strong>{a.nome}</strong>
                  <p>{a.grupo ? `${a.grupo} · ` : ""}{a.blocos} bloco{a.blocos === 1 ? "" : "s"}</p>
                </div>
                <div className="apn-selos">
                  {a.arquivada && <span className="apn-chip apn-chip-neutro">ARQUIVADA</span>}
                  <span className={`apn-chip ${a.status === "publicado" ? "apn-chip-ok" : "apn-chip-alerta"}`}>{a.status === "publicado" ? "PUBLICADO" : "RASCUNHO"}</span>
                  <span className={`apn-chip ${a.ativa ? "apn-chip-laranja" : "apn-chip-neutro"}`}>{a.ativa ? "ATIVO" : "INATIVO"}</span>
                </div>
              </div>

              <div className="apn-fluxo">
                <span className="apn-eyebrow apn-eyebrow-roxo">O QUE ELA FAZ, NA ORDEM</span>
                <div className="apn-passos">
                  {a.passos.length === 0 && <span className="apn-sem-passo">Sem blocos no mapa.</span>}
                  {a.passos.map((p, i) => (
                    <span key={i} className="apn-passo" style={{ background: p.tint, color: p.tinta }}>{p.rotulo}</span>
                  ))}
                </div>
              </div>

              {passosAbertos === a.id && (
                <ol className="apn-detalhe">
                  {a.passos.length === 0 && <li>Esta automação não tem blocos no mapa.</li>}
                  {a.passos.map((p, i) => (
                    <li key={i}><b style={{ color: p.tinta }}>{i + 1}.</b> {p.rotulo}</li>
                  ))}
                </ol>
              )}

              <footer className="apn-card-pe">
                <button type="button" className="apn-abrir" onClick={() => { setAbrirId(a.id); setTela("construtor"); }}>Abrir construtor</button>
                <button type="button" className="apn-ico" title="Ver os passos, um por linha" aria-label="Ver os passos" onClick={() => setPassosAbertos(passosAbertos === a.id ? null : a.id)}><Ico d={D_AJUDA} /></button>
                <button type="button" className="apn-ico" title="Duplicar esta automação" aria-label="Duplicar" disabled={ocupado === a.id} onClick={() => void duplicar(a)}><Ico d={D_COPIA} /></button>
                <button type="button" className={`apn-ico ${a.ativa ? "on" : ""}`} title={a.ativa ? "Desligar (para de rodar)" : "Ligar (passa a rodar)"} aria-label={a.ativa ? "Desligar" : "Ligar"} disabled={ocupado === a.id} onClick={() => void alternarAtiva(a)}><Ico d={D_LIGA} /></button>
                <button type="button" className="apn-ico danger" title="Excluir esta automação" aria-label="Excluir" disabled={ocupado === a.id} onClick={() => void excluir(a)}><Ico d={D_LIXO} /></button>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <ExplicadorAutomacoes accessToken={accessToken} />
    </div>
  );
}
