"use client";

/* 4 · IMÓVEIS E PROCURA — artboard 6a. Agora lê dado real via
 * /api/inteligencia/imoveis (RPC intel_imoveis). Views de imóvel, buscas e
 * mudanças de filtro vêm da telemetria. A tabela por imóvel e as leituras
 * complementares dependem do código de imóvel na telemetria — hoje o site publica
 * page_path genérico, então essas quebras ficam com —. Demo virou fixture. */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, Tabela, type Celula, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ImoveisPayload } from "../../../lib/inteligencia/tipos";

type Imovel = {
  nome: string; codigo: string; visualizacoes: number | null; intencao: number | null;
  leads: number | null; negocios: number | null; visitas: number | null; imovelLead: number | null; dias: number | null; status: "ativo" | "pausado";
};
type Dados = { views: number | null; buscas: number | null; filtros: number | null; paginas: number | null; imoveis: Imovel[]; atualizado: string };
type Coluna = { chave: string; titulo: string; num?: boolean };

const COLUNAS: Coluna[] = [
  { chave: "imovel", titulo: "Página / imóvel" }, { chave: "vis", titulo: "Vis.", num: true }, { chave: "intencao", titulo: "Views de item", num: true },
  { chave: "leads", titulo: "Leads", num: true }, { chave: "negocios", titulo: "Negócios", num: true }, { chave: "visitas", titulo: "Visitas", num: true },
  { chave: "imovelLead", titulo: "Item→lead", num: true }, { chave: "dias", titulo: "Dias", num: true }, { chave: "status", titulo: "Status" },
];

function celula(i: Imovel, c: Coluna): Celula {
  switch (c.chave) {
    case "imovel": return { texto: i.nome, forte: true, sub: i.codigo };
    case "vis": return { texto: fmt.inteiro(i.visualizacoes), num: true };
    case "intencao": return { texto: fmt.inteiro(i.intencao), num: true };
    case "leads": return { texto: fmt.inteiro(i.leads), num: true, forte: true };
    case "negocios": return { texto: fmt.inteiro(i.negocios), num: true };
    case "visitas": return { texto: fmt.inteiro(i.visitas), num: true };
    case "imovelLead": return { texto: fmt.porcento(i.imovelLead, 2), num: true };
    case "dias": return { texto: fmt.inteiro(i.dias), num: true };
    default: return i.status === "ativo" ? { texto: "", chip: "ativo", chipTom: "bom" } : { texto: "", chip: "pausado", chipTom: "neutro" };
  }
}

export function ImoveisProcura({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<ImoveisPayload>("imoveis", accessToken, recorte);
  const d = mapearImoveis(leitura.payload);
  const [aberto, setAberto] = useState<string>(d.imoveis[0]?.codigo ?? "");
  const imovel = d.imoveis.find((i) => i.codigo === aberto) ?? d.imoveis[0] ?? null;

  const kpis: Kpi[] = [
    { rotulo: "Views de imóvel", bruto: d.views, texto: fmt.inteiro(d.views), tile: "laranja", icone: "casa", foot: "evento view_item no período" },
    { rotulo: "Buscas de imóvel", bruto: d.buscas, texto: fmt.inteiro(d.buscas), tom: "bom", tile: "verde", foot: "evento property_search" },
    { rotulo: "Mudanças de filtro", bruto: d.filtros, texto: fmt.inteiro(d.filtros), tom: "atencao", tile: "ambar", foot: "evento filter_change" },
    { rotulo: "Páginas de imóvel", bruto: d.paginas, texto: fmt.inteiro(d.paginas), tile: "roxo", foot: "com pelo menos 1 acesso" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="A PROCURA" titulo="O que a demanda está dizendo" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="TABELA PRINCIPAL" titulo="Cada página de imóvel, do acesso à visita" cor="#8B00CC" nota="a quebra por imóvel depende do código de imóvel no evento — hoje o site publica page_path genérico" />
      <Tabela
        colunas={COLUNAS.map((c) => ({ titulo: c.titulo, num: c.num }))}
        ordenadaEm="Vis."
        linhas={d.imoveis.map((i) => ({
          chave: i.codigo, destaque: i.codigo === aberto, abrir: () => setAberto(i.codigo),
          celulas: COLUNAS.map((c) => celula(i, c)),
        }))}
        foot="leads, negócios e visitas por imóvel ficam — até a atribuição por imóvel existir · nenhum valor é estimado"
      />

      <div className="intp-cartao">
        <span className="intp-cartao-titulo">Leituras complementares</span>
        <p style={{ margin: 0, fontSize: 12.5, color: "#4D4842", lineHeight: 1.55 }}>
          Bairros e faixas mais procurados, venda vs. locação por imóvel, filtros mais usados e “demanda sem estoque” dependem do <b>código de imóvel</b> e dos <b>filtros de busca</b> chegarem no evento. Hoje a telemetria traz a intenção agregada (views, buscas, filtros), mas ainda não o imóvel específico — por isso essas quebras ficam com “—”. Quando o site incluir o código no evento, elas preenchem sozinhas.
        </p>
      </div>

      {imovel ? (
        <div className="intp-cartao" style={{ boxShadow: "0 8px 24px rgba(31,28,26,0.10)", gap: 12 }}>
          <b style={{ fontSize: 15 }}>{imovel.nome} <small style={{ color: "#9A938B" }}>{imovel.codigo}</small></b>
          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {[{ v: fmt.inteiro(imovel.visualizacoes), l: "visualizações" }, { v: fmt.inteiro(imovel.intencao), l: "views de item" }, { v: fmt.inteiro(imovel.leads), l: "leads" }].map((t) => (
              <div key={t.l} style={{ background: "#FAF8F6", borderRadius: 12, padding: "10px 12px" }}>
                <strong style={{ fontSize: 20, fontWeight: 700 }}>{t.v}</strong><br /><small className="intp-kpi-foot">{t.l}</small>
              </div>
            ))}
          </div>
          <div className="intp-detalhe-aviso">Origem do acesso, leads e próxima visita por imóvel dependem da atribuição por código de imóvel e ficam com “—” enquanto não vierem. Nenhum valor é estimado.</div>
        </div>
      ) : null}

      <RodapeFontes
        fontes={["coleta própria (site)"]}
        pendencias={["código de imóvel não vem no evento (quebra por imóvel)", "atribuição de leads/visitas por imóvel ainda não ligada"]}
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

const vazioImoveis: Dados = { views: null, buscas: null, filtros: null, paginas: null, imoveis: [], atualizado: "—" };

function mapearImoveis(p: ImoveisPayload | null): Dados {
  if (!p) return vazioImoveis;
  return {
    views: p.view_item, buscas: p.property_search, filtros: p.filter_change, paginas: p.paginas.length,
    imoveis: p.paginas.map((x) => ({
      nome: x.pagina, codigo: x.pagina, visualizacoes: x.pageviews, intencao: x.view_item,
      leads: null, negocios: null, visitas: null, imovelLead: null, dias: null, status: "ativo",
    })),
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoImoveis: Dados = {
  views: 3_240, buscas: 1_812, filtros: 3_842, paginas: 31,
  imoveis: [
    { nome: "Apê Canário 71", codigo: "MO-104", visualizacoes: 1_486, intencao: 312, leads: 38, negocios: 26, visitas: 14, imovelLead: 2.56, dias: 34, status: "ativo" },
  ],
  atualizado: "14:28",
};
