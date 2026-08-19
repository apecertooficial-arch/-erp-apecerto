"use client";

/* 7 · SARA — artboard 8a. Agora lê dado real via /api/inteligencia/sara (RPC
 * intel_sara, eventos sara_* da telemetria). Hoje a Sara ainda NÃO envia eventos
 * para a Inteligência: os números vêm 0 — é o contrato funcionando, não bug.
 * Temas/bairros/faixas/resultados dependem de eventos de busca (ausentes) e ficam
 * vazios. Demo virou fixture. */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, Valor } from "../dado";
import { Cabecalho, Funil, type Etapa } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { SaraPayload } from "../../../lib/inteligencia/tipos";

type Dados = {
  aberturas: number | null; buscas: number | null; buscaConcluida: number | null; mediaResultados: number | null;
  semResultado: number | null; erros: number | null; dispositivos: { l: string; r: string }[];
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string }[];
  temas: { l: string; r: string }[]; bairros: { l: string; r: string; outros?: boolean }[]; finalidade: { locacao: number; venda: number };
  faixas: { l: string; r: string }[];
  cliques: { imovel: string; apresentado: number | null; clicado: number | null; intencao: number | null; leads: number | null }[];
  bannerTitulo: string; bannerStats: { v: string; l: string }[]; atualizado: string;
};

export function Sara({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<SaraPayload>("sara", accessToken, recorte);
  const d = mapearSara(leitura.payload);

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome, largura: e.largura, volume: e.volume, volumeTexto: fmt.inteiro(e.volume), taxa: e.taxa, perda: e.perda, roxo: true,
    detalhes: () => recorte.filtrar(`Etapa da Sara: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <section style={{ background: "#8B00CC", borderRadius: 24, padding: "20px 26px", color: "#fff", display: "flex", gap: 24, alignItems: "center", boxShadow: "0 12px 28px rgba(139,0,204,0.24)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.75)" }}>SARA · LEITURA DO PERÍODO</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.01em", color: "#fff" }}>{d.bannerTitulo}</h2>
        </div>
        <div style={{ display: "flex", gap: 18, flex: "none", textAlign: "center" }}>
          {d.bannerStats.map((s) => (
            <div key={s.l}>
              <strong style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fff" }}>{s.v}</strong><br />
              <small style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{s.l}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="int-duas par-115">
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL DA SARA" titulo="Da conversa ao negócio" cor="#8B00CC" />
          <Funil etapas={etapas} foot="roxo = funil da Sara · a Sara ainda não envia eventos para a Inteligência — por isso os volumes vêm 0" />

          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Aberturas</span><Valor bruto={d.aberturas} texto={fmt.inteiro(d.aberturas)} /></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Buscas</span><Valor bruto={d.buscas} texto={fmt.inteiro(d.buscas)} /></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Busca concluída</span><Valor bruto={d.buscaConcluida} texto={fmt.porcento(d.buscaConcluida, 0)} motivo="amostra" /><small className="intp-kpi-foot">com pelo menos 1 resultado</small></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Média de resultados</span><Valor bruto={d.mediaResultados} texto={d.mediaResultados === null ? undefined : d.mediaResultados.toFixed(1).replace(".", ",")} motivo="amostra" /><small className="intp-kpi-foot">imóveis por busca respondida</small></div>
          </div>

          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Buscas sem resultado</span><Valor bruto={d.semResultado} texto={fmt.inteiro(d.semResultado)} tom="ruim" /><button type="button" className="int-link" style={{ fontWeight: 700, alignSelf: "flex-start" }} onClick={() => recorte.irPara("proprietarios")}>Vira demanda sem estoque →</button></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Erros da Sara</span><Valor bruto={d.erros} texto={fmt.inteiro(d.erros)} tom="atencao" /></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Celular vs. desktop</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {d.dispositivos.map((x) => (<div key={x.l} className="intp-linha-kv"><span>{x.l}</span><b>{x.r}</b></div>))}
              </div>
            </div>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="O QUE AS PESSOAS PEDEM" titulo="Sempre em agregado — nunca o texto digitado" cor="#8B00CC" />
          <div className="intp-cartao" style={{ flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8 }}>
            <span className="intp-cartao-titulo">Temas, bairros e faixas</span>
            <p style={{ margin: 0, fontSize: 12.5, color: "#6E6760", lineHeight: 1.55 }}>
              Estes agregados dependem dos eventos de busca da Sara (<code>sara_search</code>, <code>sara_results</code>), que ainda não chegam à Inteligência. Assim que a Sara publicar esses eventos, temas, bairros, faixas e resultados mais clicados aparecem aqui — em agregado, nunca o texto digitado.
            </p>
          </div>
        </div>
      </div>

      <RodapeFontes
        fontes={["eventos da Sara (site-track)"]}
        pendencias={["Sara ainda não envia sara_open/sara_search/sara_results à Inteligência", "texto digitado não é armazenado (decisão de privacidade)"]}
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

function mapearSara(p: SaraPayload | null): Dados {
  if (!p) {
    return { aberturas: null, buscas: null, buscaConcluida: null, mediaResultados: null, semResultado: null, erros: null, dispositivos: [], etapas: [], temas: [], bairros: [], finalidade: { locacao: 0, venda: 0 }, faixas: [], cliques: [], bannerTitulo: "Aguardando conexão da Sara.", bannerStats: [{ v: "—", l: "buscas" }, { v: "—", l: "leads" }, { v: "—", l: "negócios" }], atualizado: "—" };
  }
  const semEventos = p.sara_open === 0 && p.sara_search === 0;
  return {
    aberturas: p.sara_open, buscas: p.sara_search,
    buscaConcluida: p.sara_search > 0 ? Math.round((100 * p.sara_results) / p.sara_search) : null,
    mediaResultados: null,
    semResultado: Math.max(0, p.sara_search - p.sara_results),
    erros: p.sara_error,
    dispositivos: [],
    etapas: [
      { nome: "1 · Sara aberta", volume: p.sara_open, largura: 100, taxa: "100%" },
      { nome: "2 · Busca enviada", volume: p.sara_search, largura: p.sara_open > 0 ? Math.round((100 * p.sara_search) / p.sara_open) : 0 },
      { nome: "3 · Resultados apresentados", volume: p.sara_results, largura: p.sara_open > 0 ? Math.round((100 * p.sara_results) / p.sara_open) : 0 },
    ],
    temas: [], bairros: [], finalidade: { locacao: 0, venda: 0 }, faixas: [], cliques: [],
    bannerTitulo: semEventos
      ? "A Sara ainda não está enviando eventos para a Inteligência. Os números aparecem em 0 até a integração de eventos (sara_open, sara_search, sara_results) ser ligada."
      : `A Sara registrou ${fmt.inteiro(p.sara_search)} buscas e ${fmt.inteiro(p.sara_results)} respostas com resultado no período.`,
    bannerStats: [
      { v: fmt.inteiro(p.sara_search), l: "buscas" },
      { v: fmt.inteiro(p.sara_open), l: "aberturas" },
      { v: fmt.inteiro(p.sara_error), l: "erros" },
    ],
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoSara: Dados = {
  aberturas: 2_104, buscas: 1_482, buscaConcluida: 91, mediaResultados: 6.4, semResultado: 133, erros: 21,
  dispositivos: [{ l: "Celular", r: "1.678 ab." }, { l: "Desktop", r: "426 ab." }],
  etapas: [{ nome: "1 · Sara aberta", volume: 2_104, largura: 100, taxa: "100%" }],
  temas: [{ l: "2 dormitórios", r: "512" }], bairros: [{ l: "Moema Pássaros", r: "44%" }], finalidade: { locacao: 58, venda: 42 },
  faixas: [{ l: "R$ 4–6 mil/mês", r: "38%" }],
  cliques: [{ imovel: "Apê Canário 71 · MO-104", apresentado: 412, clicado: 186, intencao: 64, leads: 12 }],
  bannerTitulo: "A Sara respondeu 91% das buscas e gerou 47 leads.", bannerStats: [{ v: "1.482", l: "buscas" }, { v: "47", l: "leads" }, { v: "28", l: "negócios" }],
  atualizado: "14:28",
};
