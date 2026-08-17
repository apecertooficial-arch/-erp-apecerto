"use client";

/* AUTOMAÇÕES — a tela do módulo. Uma só.
 *
 * Substitui a casca antiga (que era apenas o construtor solto dentro de um
 * cabeçalho) e traz a BIBLIOTECA na frente: cada automação lida como sequência,
 * com selos, abas, busca e contadores. Não existe rota paralela nem tela nova ao
 * lado — tentei isso em /automacoes-novo e estava errado: virou camada em vez de
 * substituição.
 *
 * O CONSTRUTOR NÃO FOI REIMPLEMENTADO. O automationBuilderRuntime.js (159 KB)
 * continua sendo montado exatamente como antes — mesmo import dinâmico, mesmo
 * mount(host, {authToken, supabaseUrl, publishableKey}), mesmo unmount na saída.
 * Nós, portas, arraste, zoom, gaveta, paleta, publicar, versões e monitor são os
 * dele. Fluxos, blocos e versões continuam no Supabase: nada aqui migra, reescreve
 * ou recria dado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExplicadorAutomacoes } from "./ExplicadorAutomacoes";
import "../../styles/automation-builder.css";

type OriginalAutomationBuilder = {
  mount: (host: HTMLDivElement, context: { authToken: string; supabaseUrl: string; publishableKey: string }) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

/* Os 12 tipos do runtime (TYPES) traduzidos para rótulo e cor da marca. As chaves
   são os `type` gravados em mapa.automation.blocks — não inventar nome novo aqui:
   quem manda é o compile() do construtor. */
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

type Passo = { rotulo: string; tint: string; tinta: string };
type Automacao = {
  id: number;
  nome: string;
  grupo: string | null;
  ativa: boolean;
  status: "publicado" | "rascunho";
  arquivada: boolean;
  passos: Passo[];
  blocos: number;
};

type Filtro = "todas" | "rodando" | "desligadas" | "rascunhos" | "arquivadas";

/* Ordem de leitura do fluxo: o editor guarda x/y de cada bloco, então a sequência
   visual (de cima para baixo) é a mesma que o gestor vê no canvas. Sem wires
   confiáveis em toda automação antiga, ordenar por y é o critério honesto.
   Automação com editor.blocks mas sem automation.blocks também é lida: aí o tipo
   sai da família gravada no editor (fam). */
const FAM_TIPO: Record<string, string> = {
  gatilho: "trigger", mapeamento: "field-operation", condicao: "condition", acao: "action",
  randomizador: "randomizer", distribuicao: "distribution", distribuicao_simples: "distribution-simple",
  mensagem: "chat", espera: "time", api: "api", agente: "ai-agent",
};

function lerPassos(mapa: unknown): { passos: Passo[]; blocos: number } {
  const m = (mapa ?? {}) as {
    editor?: { blocks?: Record<string, { x?: number; y?: number; fam?: string }> };
    automation?: { blocks?: Array<{ id?: string; type?: string; presentation?: { x?: number; y?: number } }> };
  };
  const editor = m.editor?.blocks ?? {};
  const blocos = m.automation?.blocks ?? [];

  const bruto = blocos.length
    ? blocos.map((b) => ({
        tipo: String(b.type ?? ""),
        y: editor[String(b.id)]?.y ?? b.presentation?.y ?? 0,
      }))
    : Object.entries(editor).map(([, eb]) => ({
        tipo: FAM_TIPO[String(eb.fam ?? "")] ?? "",
        y: eb.y ?? 0,
      }));

  const passos = bruto
    .slice()
    .sort((a, b) => a.y - b.y)
    .map((b) => TIPOS[b.tipo] ?? { rotulo: b.tipo || "Bloco", tint: "#F2EFEC", tinta: "#6E6760" });

  return { passos, blocos: bruto.length };
}

export function AutomationsWorkspace({ accessToken }: { accessToken: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const [tela, setTela] = useState<"biblioteca" | "construtor">("biblioteca");
  const [abrirId, setAbrirId] = useState<number | null>(null);
  const [lista, setLista] = useState<Automacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const hostRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    if (!supabaseUrl || !publishableKey) { setErro("Configuração pública do Supabase não encontrada."); return; }
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/automacoes?select=id,nome,grupo,ativa,status,arquivada,mapa&order=id.asc`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      const linhas = (await r.json()) as Array<Record<string, unknown>>;
      setLista(linhas.map((l) => {
        const { passos, blocos } = lerPassos(l.mapa);
        return {
          id: Number(l.id), nome: String(l.nome ?? "—"), grupo: (l.grupo as string) ?? null,
          ativa: l.ativa === true, status: (String(l.status ?? "publicado") === "rascunho" ? "rascunho" : "publicado"),
          arquivada: l.arquivada === true, passos, blocos,
        };
      }));
      setErro(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar automações."); }
  }, [accessToken, publishableKey, supabaseUrl]);

  useEffect(() => { void carregar(); }, [carregar]);

  /* Construtor original. Quando o gestor chegou aqui clicando numa automação, o
     único gancho possível é o próprio item da coluna do runtime (.sb-item[data-id]):
     ele não expõe openAutomacao. Tentamos por alguns segundos e desistimos em
     silêncio — sem o clique ele fica na tela inicial dele, que é estado legítimo. */
  useEffect(() => {
    if (tela !== "construtor") return;
    let ativo = true;
    let builder: OriginalAutomationBuilder | null = null;
    if (!supabaseUrl || !publishableKey) {
      if (hostRef.current) hostRef.current.innerHTML = '<div class="original-automation-error">Configuração pública do Supabase não encontrada.</div>';
      return;
    }
    void import("./automationBuilderRuntime.js").then(({ default: mod }) => {
      if (!ativo || !hostRef.current) return;
      builder = mod as OriginalAutomationBuilder;
      builder.mount(hostRef.current, { authToken: accessToken, supabaseUrl, publishableKey });
      if (abrirId == null) return;
      let tentativas = 0;
      const tentar = () => {
        if (!ativo) return;
        const item = hostRef.current?.querySelector<HTMLElement>(`.sb-item[data-id="${abrirId}"]`);
        if (item) { item.click(); return; }
        if (tentativas++ < 40) setTimeout(tentar, 150);
      };
      setTimeout(tentar, 200);
    }).catch((e: unknown) => {
      if (!ativo || !hostRef.current) return;
      hostRef.current.innerHTML = `<div class="original-automation-error">${e instanceof Error ? e.message : "Erro ao carregar Automações."}</div>`;
    });
    return () => { ativo = false; builder?.unmount(); };
  }, [tela, abrirId, accessToken, publishableKey, supabaseUrl]);

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
          <button type="button" className="apn-voltar" onClick={() => { setTela("biblioteca"); setAbrirId(null); void carregar(); }}>← Automações</button>
          <div className="apn-topo-txt"><span>CONSTRUTOR</span><h1>Blocos, portas e ligações do fluxo</h1></div>
          <span className="apn-chip apn-chip-ok">{contas.total} automações</span>
        </header>
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

              <footer className="apn-card-pe">
                <button type="button" className="apn-abrir" onClick={() => { setAbrirId(a.id); setTela("construtor"); }}>Abrir construtor</button>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <ExplicadorAutomacoes accessToken={accessToken} />
    </div>
  );
}
