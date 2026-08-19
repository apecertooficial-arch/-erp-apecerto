"use client";

/* 3 · COMPORTAMENTO E CONTEÚDO — artboard 4a. Agora lê dado real via
 * /api/inteligencia/comportamento (RPC intel_comportamento). Páginas, eventos de
 * interação e dispositivos vêm da telemetria de site. Rolagem por marca, jornada
 * e Clarity (mapas/gravações) dependem de fontes ainda não ligadas -> — . Demo
 * virou fixture. */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Tabela } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ComportamentoPayload } from "../../../lib/inteligencia/tipos";

type Glifo = "whatsapp" | "filtros" | "telefone" | "busca" | "agenda" | "galeria" | "formulario" | "favorito" | "instagram" | "proprietario";

function Ico({ g }: { g: Glifo }) {
  const c = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (g === "whatsapp") return <svg {...c}><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.2-5.6A8.4 8.4 0 1 1 21 11.5Z" /></svg>;
  if (g === "filtros") return <svg {...c}><path d="M4 7h11M4 12h5M4 17h14" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="12" r="2" /></svg>;
  if (g === "telefone") return <svg {...c}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" /></svg>;
  if (g === "busca") return <svg {...c}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.3-4.3" /></svg>;
  if (g === "galeria") return <svg {...c}><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M21 7v12a2 2 0 0 1-2 2H7" /><circle cx="8" cy="8" r="1.6" /></svg>;
  if (g === "formulario") return <svg {...c}><path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h7" /><path d="M9 7h6M9 11h4" /></svg>;
  if (g === "favorito") return <svg {...c}><path d="M12 20s-7-4.5-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.5 12 20 12 20Z" /></svg>;
  return <svg {...c}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1Z" /></svg>;
}

const TILE: Record<"verde" | "laranja" | "roxo", { fundo: string; cor: string }> = {
  verde: { fundo: "#E4F6EC", cor: "#1FA85A" }, laranja: { fundo: "#FFE4D1", cor: "#CC5800" }, roxo: { fundo: "#F7ECFC", cor: "#66009A" },
};

type Dados = {
  paginas: { pagina: string; visualizacoes: number | null; entradas: number | null; intencao: number | null; leads: number | null; motivo: string }[];
  maisAcessadas: { l: string; r: string }[];
  rolagem: { marca: string; pct: number | null; altura: number }[];
  interacoes: { l: string; r: string; chip: string; g: Glifo; tile: "verde" | "laranja" | "roxo" }[];
  dispositivos: { nome: string; vis: number | null; engaj: number | null; intencao: number | null; leads: number | null; pagLead: number | null }[];
  clarity: { sessoes: number | null };
  atualizado: string;
};

export function ComportamentoConteudo({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<ComportamentoPayload>("comportamento", accessToken, recorte);
  const d = mapearComportamento(leitura.payload);

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="PÁGINAS" titulo="Onde as pessoas chegam e o que prende" />
      <CartoesLista
        colunas={2}
        cartoes={[
          { titulo: "Mais acessadas", linhas: d.maisAcessadas.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Página: ${x.l}`) })), foot: "visualizações de página no período" },
          { titulo: "Rolagem e conversão", linhas: [{ l: "Marcas de rolagem por página", r: "—", sub: "profundidade por marca (25/50/75/90) ainda não agregada" }], foot: "coletado, mas ainda sem agregação por marca" },
        ]}
      />

      <Cabecalho eyebrow="TABELA DE PÁGINAS" titulo="Cada página, do acesso ao lead" cor="#8B00CC" nota="entradas, intenção e leads por página dependem de atribuição por página (ainda não ligada)" />
      <Tabela
        colunas={[{ titulo: "Página" }, { titulo: "Visualizações", num: true }, { titulo: "Entradas", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Leitura" }]}
        ordenadaEm="Visualizações"
        linhas={d.paginas.map((p) => ({
          chave: p.pagina, abrir: () => recorte.filtrar(`Página: ${p.pagina}`),
          celulas: [
            { texto: p.pagina, forte: true }, { texto: fmt.inteiro(p.visualizacoes), num: true }, { texto: fmt.inteiro(p.entradas), num: true },
            { texto: fmt.inteiro(p.intencao), num: true }, { texto: fmt.inteiro(p.leads), num: true }, { texto: p.motivo },
          ],
        }))}
        foot="página com 0 lead mostra zero, porque zero é dado · entrada/intenção/lead por página seguem — até a atribuição por página existir"
      />

      <div className="int-tres">
        <div className="int-col">
          <Cabecalho eyebrow="ROLAGEM" titulo="Até onde leem" cor="#8B00CC" />
          <div className="intp-cartao" style={{ flex: 1, gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 120 }}>
              {d.rolagem.map((b) => (
                <div key={b.marca} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 5, height: "100%" }}>
                  <b style={{ fontSize: 13, textAlign: "center" }}>{fmt.porcento(b.pct, 0)}</b>
                  <span style={{ display: "block", height: `${b.altura}%`, borderRadius: "8px 8px 4px 4px", background: "linear-gradient(180deg,#FF9A4D,#FF7000)" }} />
                  <small style={{ fontSize: 11, color: "#6E6760", textAlign: "center", fontWeight: 600 }}>{b.marca}</small>
                </div>
              ))}
            </div>
            <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>a profundidade por marca ainda não é agregada — evento scroll_depth existe, o corte por 25/50/75/90 entra no próximo lote</small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="INTERAÇÕES" titulo="O que fazem além de ler" cor="#8B00CC" />
          <div className="intp-cartao int-eventos" style={{ flex: 1 }}>
            {d.interacoes.map((i) => (
              <button key={i.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(i.chip)} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, padding: "5px 0" }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, background: TILE[i.tile].fundo, color: TILE[i.tile].cor, display: "grid", placeItems: "center", flex: "none" }}><Ico g={i.g} /></span>
                <span style={{ flex: 1, fontWeight: 600, color: "#4D4842" }}>{i.l}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{i.r}</b>
              </button>
            ))}
            <small className="intp-kpi-foot" style={{ gridColumn: "1 / -1", alignSelf: "end" }}>verde = conta como ação de intenção · contagem real de eventos no período</small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="DISPOSITIVOS" titulo="Desktop, tablet e celular" cor="#8B00CC" />
          <div className="int-tabela-roxa">
            <Tabela
              colunas={[{ titulo: "Dispositivo" }, { titulo: "Vis.", num: true }, { titulo: "Engaj.", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Pág→lead", num: true }]}
              ordenadaEm="Vis."
              linhas={d.dispositivos.map((x) => ({
                chave: x.nome, abrir: () => recorte.filtrar(`Dispositivo: ${x.nome.toLocaleLowerCase("pt-BR")}`),
                celulas: [
                  { texto: x.nome, forte: true }, { texto: fmt.inteiro(x.vis), num: true }, { texto: fmt.inteiro(x.engaj), num: true },
                  { texto: fmt.inteiro(x.intencao), num: true }, { texto: fmt.inteiro(x.leads), num: true }, { texto: fmt.porcento(x.pagLead, 2), num: true },
                ],
              }))}
              foot="visualizações por dispositivo são reais; engajamento, intenção e lead por dispositivo dependem de fonte ainda não ligada"
            />
          </div>
        </div>
      </div>

      <div className="intp-cartao">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="intp-cartao-titulo">Mapas e gravações · Microsoft Clarity</span>
          <span className="intp-cartao-chip tom-aviso">não conectado</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "#4D4842", lineHeight: 1.55 }}>
          Mapas de calor e gravações existem apenas para quem consentiu Analytics e dependem do Microsoft Clarity, que ainda não está ligado à Inteligência. Sessões consentidas disponíveis: {fmt.inteiro(d.clarity.sessoes)}.
        </p>
      </div>

      <RodapeFontes
        fontes={["coleta própria (site)"]}
        pendencias={["rolagem por marca não agregada", "Clarity (mapas/gravações) não conectado", "atribuição por página (entrada/intenção/lead) ainda não ligada"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO — lê a RPC via hook. */
function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

const IMAP: { l: string; chip: string; g: Glifo; tile: "verde" | "laranja" | "roxo"; ev: string }[] = [
  { l: "WhatsApp", chip: "Evento: whatsapp_click", g: "whatsapp", tile: "verde", ev: "whatsapp_click" },
  { l: "Mudança de filtros", chip: "Evento: filter_change", g: "filtros", tile: "laranja", ev: "filter_change" },
  { l: "Telefone", chip: "Evento: phone_click", g: "telefone", tile: "verde", ev: "phone_click" },
  { l: "Pesquisa de imóveis", chip: "Evento: property_search", g: "busca", tile: "laranja", ev: "property_search" },
  { l: "Galeria", chip: "Evento: gallery_interaction", g: "galeria", tile: "roxo", ev: "gallery_interaction" },
  { l: "Início de formulário", chip: "Evento: form_start", g: "formulario", tile: "verde", ev: "form_start" },
  { l: "Favoritos", chip: "Evento: favorite_toggle", g: "favorito", tile: "roxo", ev: "favorite_toggle" },
  { l: "Ver imóvel", chip: "Evento: view_item", g: "galeria", tile: "laranja", ev: "view_item" },
];

const vazioComportamento: Dados = {
  paginas: [], maisAcessadas: [],
  rolagem: ["25%", "50%", "75%", "90%"].map((m) => ({ marca: m, pct: null, altura: 0 })),
  interacoes: IMAP.map((x) => ({ l: x.l, r: "—", chip: x.chip, g: x.g, tile: x.tile })),
  dispositivos: [], clarity: { sessoes: null }, atualizado: "—",
};

function mapearComportamento(p: ComportamentoPayload | null): Dados {
  if (!p) return vazioComportamento;
  const evMap: Record<string, number> = {};
  for (const e of p.eventos) evMap[e.evento] = e.total;

  return {
    paginas: p.paginas.map((x) => ({ pagina: x.pagina, visualizacoes: x.pageviews, entradas: null, intencao: null, leads: null, motivo: "—" })),
    maisAcessadas: p.paginas.slice(0, 4).map((x) => ({ l: x.pagina, r: fmt.inteiro(x.pageviews) })),
    rolagem: ["25%", "50%", "75%", "90%"].map((m) => ({ marca: m, pct: null, altura: 0 })),
    interacoes: IMAP.map((x) => ({ l: x.l, r: fmt.inteiro(evMap[x.ev] ?? 0), chip: x.chip, g: x.g, tile: x.tile })),
    dispositivos: p.dispositivos.map((x) => ({ nome: x.dispositivo, vis: x.pageviews, engaj: null, intencao: null, leads: null, pagLead: null })),
    clarity: { sessoes: null },
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoComportamento: Dados = {
  paginas: [{ pagina: "/imoveis (busca)", visualizacoes: 6_912, entradas: 2_874, intencao: 228, leads: 24, motivo: "topo de busca" }],
  maisAcessadas: [{ l: "/imoveis (busca)", r: "6.912" }],
  rolagem: [{ marca: "25%", pct: 88, altura: 74 }, { marca: "50%", pct: 64, altura: 53 }],
  interacoes: [{ l: "WhatsApp", r: "1.294", chip: "Evento: whatsapp_click", g: "whatsapp", tile: "verde" }],
  dispositivos: [{ nome: "Celular", vis: 14_464, engaj: 6_480, intencao: 1_544, leads: 185, pagLead: 1.28 }],
  clarity: { sessoes: 7_938 }, atualizado: "14:28",
};
