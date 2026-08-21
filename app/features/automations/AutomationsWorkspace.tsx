"use client";

/* AUTOMAÇÕES — entrada direta no construtor operacional.
 *
 * A lista duplicada que antecedia o construtor foi removida. A coluna lateral do
 * próprio runtime é a fonte única para localizar, criar e administrar fluxos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExplicadorAutomacoes } from "./ExplicadorAutomacoes";
import { CentralOperationsPanel } from "./CentralOperationsPanel";
import { decorarBlocos, type MapaTitulos } from "./decorarBlocos";
import "../../styles/automation-builder.css";

type OriginalAutomationBuilder = {
  mount: (host: HTMLDivElement, context: {
    authToken: string;
    supabaseUrl: string;
    publishableKey: string;
    onAutomationsLoaded: (automacoes: Array<{ arquivada?: boolean }>) => void;
    onAutomationOpened: (automacao: { id: number }) => void;
  }) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

type MapaEditor = { blocks?: Record<string, { x?: number; y?: number }>; wires?: Array<{ from: string; port: string; to: string }> };
type Mapa = { editor?: MapaEditor; automation?: { blocks?: Array<{ id?: string; type?: string; options?: Record<string, unknown>; presentation?: { x?: number; y?: number } }> } };

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

export function AutomationsWorkspace({ accessToken }: { accessToken: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const [abrirId, setAbrirId] = useState<number | null>(null);
  const [totalAutomacoes, setTotalAutomacoes] = useState(0);
  const [remontar, setRemontar] = useState(0);
  const [arranjando, setArranjando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const titulosRef = useRef<MapaTitulos>({});

  const cab = useMemo(
    () => ({ apikey: publishableKey ?? "", Authorization: `Bearer ${accessToken}` }),
    [accessToken, publishableKey],
  );

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

  /* Construtor original. A lateral do runtime abre a automação e informa o id ao
     invólucro para manter títulos e organização horizontal no fluxo selecionado. */
  useEffect(() => {
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
      builder.mount(hostRef.current, {
        authToken: accessToken,
        supabaseUrl,
        publishableKey,
        onAutomationsLoaded: (automacoes) => setTotalAutomacoes(automacoes.filter((a) => !a.arquivada).length),
        onAutomationOpened: (automacao) => setAbrirId(automacao.id),
      });
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
  }, [abrirId, remontar, accessToken, cab, publishableKey, salvarTitulo, supabaseUrl]);

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

  return (
    <div className="automations-v2-shell apn-shell">
      <header className="apn-topo-construtor">
        <div className="apn-topo-txt"><span>CENTRAL DE AUTOMAÇÕES</span><h1>Construtor de fluxos</h1></div>
        <button type="button" className="apn-arranjo" onClick={() => void organizarH()} disabled={arranjando || abrirId == null} title="Reposiciona os blocos da esquerda para a direita seguindo os fios. Salve o que estiver aberto antes.">
          {arranjando ? "Organizando…" : "Organizar na horizontal"}
        </button>
        <span className="apn-chip apn-chip-ok">{totalAutomacoes} automações</span>
      </header>
      <CentralOperationsPanel accessToken={accessToken} />
      {aviso && <div className="apn-aviso-arranjo">{aviso}</div>}
      <div className="original-automation-host" ref={hostRef} />
      <ExplicadorAutomacoes accessToken={accessToken} />
    </div>
  );
}
