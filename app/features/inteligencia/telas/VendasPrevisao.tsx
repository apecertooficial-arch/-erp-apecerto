"use client";

/* 15 · VENDAS E PREVISÃO — artboard 19b. Agora lê dado real via
 * /api/inteligencia/vendas (RPC intel_vendas). Realizado vs meta, ritmo, pipeline
 * por etapa (Funil 2.0) e vendas do período são reais. Previsão ponderada e VGV
 * por etapa não têm fonte (sem valor por negócio, sem probabilidade) -> —.
 * Demo virou fixture. */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { VendasPayload } from "../../../lib/inteligencia/tipos";

type Etapa = { etapa: string; negocios: number | null; vgv: number | null; probabilidade: number | null; ponderado: number | null };
type Venda = { nome: string; corretor: string; vgv: number | null; ciclo: number | null; canal: string };

type Dados = {
  realizadoPercentual: number | null; realizado: number | null; meta: number | null; previsao: number | null;
  coberturaPrevisao: number | null; falta: number | null; concluidas: number | null; cicloMedio: number | null;
  ritmo: number | null; diasUteis: number | null;
  cobertura: { rotulo: string; valor: number | null; largura: number; tipo: "entra" | "sobra" | "meta" }[];
  equipes: { nome: string; valor: string; percentual: number | null }[];
  etapas: Etapa[]; totalEtapas: { negocios: number | null; vgv: number | null; ponderado: number | null };
  vendas: Venda[]; totalVendas: number | null; foraDaLista: number | null; atualizado: string;
};

export function VendasPrevisao({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<VendasPayload>("vendas", accessToken, recorte);
  const d = mapearVendas(leitura.payload);

  const kpis: Kpi[] = [
    { rotulo: "Realizado vs. meta", bruto: d.realizadoPercentual, texto: fmt.porcento(d.realizadoPercentual, 0), tile: "laranja", icone: "dinheiro", foot: `${fmt.dinheiro(d.realizado)} de ${fmt.dinheiro(d.meta)}` },
    { rotulo: "Previsão ponderada", bruto: d.previsao, texto: fmt.dinheiro(d.previsao), tom: "bom", tile: "verde", motivo: "integracao", detalhe: "sem probabilidade por etapa nem valor por negócio", foot: `cobre ${fmt.porcento(d.coberturaPrevisao, 0)} do que falta` },
    { rotulo: "Vendas concluídas", bruto: d.concluidas, texto: fmt.inteiro(d.concluidas), tile: "roxo", foot: `ciclo médio ${fmt.inteiro(d.cicloMedio)} dias` },
    { rotulo: "Ritmo necessário", bruto: d.ritmo, texto: `${fmt.dinheiro(d.ritmo)}/dia`, tom: "atencao", tile: "ambar", foot: `${fmt.inteiro(d.diasUteis)} dias úteis até o fim do mês` },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="COBERTURA DA META" titulo="O mês fecha? O pipeline responde — com probabilidade por etapa, não com torcida" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      <div className="intp-op-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Cobertura da meta</span>
          {d.cobertura.map((c) => (
            <div className="intp-casc-linha" key={c.rotulo} style={{ gridTemplateColumns: "152px 1fr 96px" }}>
              <span className={`intp-casc-rot${c.tipo === "sobra" ? " sobra" : ""}`}>{c.rotulo}</span>
              <span className="intp-casc-trilha">
                <span className={`intp-casc-barra ${c.tipo === "meta" ? "sai" : c.tipo}`} style={{ width: `${c.largura}%`, background: c.tipo === "meta" ? "#EFECE7" : undefined }} />
              </span>
              <b className={`intp-casc-valor${c.tipo === "sobra" ? " sobra" : ""}`}>{fmt.dinheiro(c.valor)}</b>
            </div>
          ))}
          <small className="intp-kpi-foot">o gap vira diagnóstico na Visão CEO</small>
        </div>

        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Metas por equipe</span>
          {d.equipes.map((e) => (
            <div key={e.nome} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ flex: 1, fontWeight: 600, color: "#4D4842" }}>{e.nome}</span>
                <b style={{ fontVariantNumeric: "tabular-nums", color: (e.percentual ?? 0) >= 80 ? "#1E7A46" : "#B5700A" }}>{e.valor} · {fmt.porcento(e.percentual, 0)}</b>
              </div>
              <span className="intp-casc-trilha"><span className="intp-casc-barra entra" style={{ width: `${Math.min(100, e.percentual ?? 0)}%` }} /></span>
            </div>
          ))}
          <small className="intp-kpi-foot">metas cadastradas por corretor · agrupadas por equipe</small>
        </div>
      </div>

      <div className="intp-op-duas">
        <div className="intp-cartao">
          <span className="intp-cartao-titulo">Pipeline por etapa · Funil 2.0</span>
          <div style={{ overflowX: "auto" }}>
            <table className="intp-tabela">
              <thead>
                <tr>
                  <th><span className="intp-th-btn" style={{ cursor: "default" }}>Etapa</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Negócios</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>VGV em aberto</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Prob.</span></th>
                  <th className="num"><span className="intp-th-btn" style={{ cursor: "default" }}>Ponderado</span></th>
                </tr>
              </thead>
              <tbody>
                {d.etapas.map((e) => (
                  <tr key={e.etapa} onClick={() => recorte.filtrar(`Etapa: ${e.etapa}`)}>
                    <td data-rotulo="Etapa" className="forte">{e.etapa}</td>
                    <td data-rotulo="Negócios" className="num">{fmt.inteiro(e.negocios)}</td>
                    <td data-rotulo="VGV em aberto" className="num">{fmt.dinheiro(e.vgv)}</td>
                    <td data-rotulo="Prob." className="num">{fmt.porcento(e.probabilidade, 0)}</td>
                    <td data-rotulo="Ponderado" className="num forte">{fmt.dinheiro(e.ponderado)}</td>
                  </tr>
                ))}
                <tr>
                  <td data-rotulo="Etapa" className="forte">Total</td>
                  <td data-rotulo="Negócios" className="num forte">{fmt.inteiro(d.totalEtapas.negocios)}</td>
                  <td data-rotulo="VGV em aberto" className="num forte">{fmt.dinheiro(d.totalEtapas.vgv)}</td>
                  <td data-rotulo="Prob." className="num">—</td>
                  <td data-rotulo="Ponderado" className="num forte" style={{ color: "#1E7A46" }}>{fmt.dinheiro(d.totalEtapas.ponderado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <small className="intp-kpi-foot">VGV por negócio e probabilidade por etapa ainda não existem no Funil 2.0 — por isso o ponderado fica —, nunca estimado por média</small>
        </div>

        <Tabela
          colunas={[{ titulo: "Venda" }, { titulo: "Corretor" }, { titulo: "VGV", num: true }, { titulo: "Ciclo", num: true }, { titulo: "Canal" }]}
          ordenadaEm="VGV"
          linhas={d.vendas.map((v) => ({
            chave: v.nome,
            abrir: () => recorte.filtrar(`Venda: ${v.nome}`),
            celulas: [
              { texto: v.nome, forte: true },
              { texto: v.corretor },
              { texto: fmt.dinheiro(v.vgv), num: true },
              { texto: `${fmt.inteiro(v.ciclo)} d`, num: true },
              { texto: v.canal },
            ],
          }))}
          foot={`mostrando ${d.vendas.length} de ${fmt.inteiro(d.totalVendas)} · a linha abre a ficha da venda`}
          acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todas →</button>}
        />
      </div>

      <Banner
        tom="aviso"
        forte={`${fmt.inteiro(d.foraDaLista)} vendas sem % válido de comissão`}
        texto="— o VGV aparece aqui, mas receita e contribuição ficam com “—” no Financeiro até o cadastro ser corrigido."
        botao={{ rotulo: "Resolver em Financeiro →", go: () => recorte.irPara("financeiro") }}
      />

      <RodapeFontes
        fontes={["vendas", "metas cadastradas", "negócios (Funil 2.0)"]}
        pendencias={["previsão ponderada (sem probabilidade/valor por etapa)", "vendas sem % válido de comissão"]}
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

const vazioVendas: Dados = {
  realizadoPercentual: null, realizado: null, meta: null, previsao: null, coberturaPrevisao: null, falta: null,
  concluidas: null, cicloMedio: null, ritmo: null, diasUteis: null,
  cobertura: [
    { rotulo: "Fechado", valor: null, largura: 2, tipo: "entra" },
    { rotulo: "+ previsão ponderada", valor: null, largura: 2, tipo: "sobra" },
    { rotulo: "Meta do ano", valor: null, largura: 2, tipo: "meta" },
  ],
  equipes: [], etapas: [], totalEtapas: { negocios: null, vgv: null, ponderado: null }, vendas: [],
  totalVendas: null, foraDaLista: null, atualizado: "—",
};

function mapearVendas(p: VendasPayload | null): Dados {
  if (!p) return vazioVendas;
  const pct = p.realizado_pct ?? 0;

  return {
    realizadoPercentual: p.realizado_pct,
    realizado: p.realizado,
    meta: p.meta,
    previsao: p.previsao,
    coberturaPrevisao: p.cobertura_previsao,
    falta: p.falta,
    concluidas: p.concluidas,
    cicloMedio: p.ciclo_medio,
    ritmo: p.ritmo,
    diasUteis: p.dias_uteis,
    cobertura: [
      { rotulo: "Fechado", valor: p.realizado, largura: Math.min(100, pct), tipo: "entra" },
      { rotulo: "+ previsão ponderada", valor: p.previsao, largura: Math.min(100, pct), tipo: "sobra" },
      { rotulo: "Meta do ano", valor: p.meta, largura: 100, tipo: "meta" },
    ],
    equipes: p.equipes.map((e) => ({
      nome: e.nome,
      valor: `${fmt.dinheiro(e.realizado)} de ${fmt.dinheiro(e.meta)}`,
      percentual: e.pct,
    })),
    etapas: p.etapas.map((e) => ({ etapa: e.etapa, negocios: e.negocios, vgv: e.vgv, probabilidade: e.probabilidade, ponderado: e.ponderado })),
    totalEtapas: p.total_etapas,
    vendas: p.vendas.map((v) => ({ nome: v.nome, corretor: v.corretor, vgv: v.vgv, ciclo: v.ciclo, canal: v.canal })),
    totalVendas: p.total_vendas,
    foraDaLista: p.fora_da_lista,
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoVendas: Dados = {
  realizadoPercentual: 77, realizado: 18_400_000, meta: 24_000_000, previsao: 6_100_000, coberturaPrevisao: 102, falta: 5_600_000,
  concluidas: 21, cicloMedio: 38, ritmo: 400_000, diasUteis: 14,
  cobertura: [
    { rotulo: "Fechado", valor: 18_400_000, largura: 77, tipo: "entra" },
    { rotulo: "+ previsão ponderada", valor: 24_500_000, largura: 100, tipo: "sobra" },
    { rotulo: "Meta de agosto", valor: 24_000_000, largura: 100, tipo: "meta" },
  ],
  equipes: [{ nome: "Equipe Juliana Prado", valor: "R$ 11,2 de 13 mi", percentual: 86 }],
  etapas: [{ etapa: "Proposta", negocios: 31, vgv: 4_200_000, probabilidade: 60, ponderado: 2_520_000 }],
  totalEtapas: { negocios: 255, vgv: 26_000_000, ponderado: 6_100_000 },
  vendas: [{ nome: "Apê Canário 71 · MO-104", corretor: "Ana Beatriz", vgv: 890_000, ciclo: 26, canal: "site" }],
  totalVendas: 21, foraDaLista: 3, atualizado: "14:32",
};
