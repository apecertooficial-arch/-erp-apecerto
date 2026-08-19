"use client";

/* 2 · AQUISIÇÃO E CAMPANHAS — artboard 3a. Agora lê dado real via
 * /api/inteligencia/aquisicao (RPC intel_aquisicao). Leads por origem, negócios e
 * conversão lead→negócio vêm do CRM; visualizações e intenção da telemetria.
 * Custo/CPL/custo por negócio/ROAS (contas de mídia) e atribuição de primeiro/
 * último toque seguem — até serem conectados. Demo virou fixture. */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, TRACO } from "../dado";
import { Banner, Cabecalho, GavetaLateral, GradeKpis, Tabela, type Celula, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { AquisicaoPayload } from "../../../lib/inteligencia/tipos";

type Linha = {
  origem: string; midia: string; campanha: string; detalheCampanha?: string; utm: string;
  vis: number | null; intencao: number | null; leads: number | null; negocios: number | null; visitas: number | null; vendas: number | null;
  pagLead: number | null; leadNeg: number | null; custo: number | null; cpl: number | null; custoNeg: number | null; roas: number | null;
  paga?: boolean; naoAtribuido?: boolean; motivos?: string;
};
type Serie = { rotulo: string; chip: string; cor: string; fundo: string; texto: string; ligada: boolean; ponto: boolean };
type Dados = {
  visualizacoes: number | null; intencao: number | null; leads: number | null; negocios: number | null; visitas: number | null; vendas: number | null;
  linhas: Linha[]; series: Serie[]; primeiroToque: { l: string; r: string }[]; ultimoToque: { l: string; r: string }[];
  naoAtribuido: { vis: string; leads: string; negocios: string; motivos: string }; atualizado: string;
};
type Coluna = { chave: string; titulo: string; num?: boolean; cinza?: boolean };

const COLUNAS: Coluna[] = [
  { chave: "origem", titulo: "Origem" }, { chave: "midia", titulo: "Mídia" }, { chave: "campanha", titulo: "Campanha · conteúdo · termo" },
  { chave: "vis", titulo: "Vis. página", num: true }, { chave: "intencao", titulo: "Intenção", num: true }, { chave: "leads", titulo: "Leads", num: true },
  { chave: "negocios", titulo: "Negócios", num: true }, { chave: "visitas", titulo: "Visitas", num: true }, { chave: "vendas", titulo: "Vendas", num: true },
  { chave: "pagLead", titulo: "Pág→lead", num: true }, { chave: "leadNeg", titulo: "Lead→neg.", num: true },
  { chave: "custo", titulo: "Custo", num: true, cinza: true }, { chave: "cpl", titulo: "CPL", num: true, cinza: true },
  { chave: "custoNeg", titulo: "Custo/neg.", num: true, cinza: true }, { chave: "roas", titulo: "ROAS", num: true, cinza: true },
];
const CINZA = "#C9C2BA";

function celula(l: Linha, c: Coluna): Celula {
  switch (c.chave) {
    case "origem": return { texto: l.origem, forte: true, cor: l.naoAtribuido ? "#66009A" : undefined };
    case "midia": return { texto: l.midia };
    case "campanha": return { texto: l.campanha, forte: !!l.paga, sub: l.detalheCampanha };
    case "vis": return { texto: fmt.inteiro(l.vis), num: true };
    case "intencao": return { texto: fmt.inteiro(l.intencao), num: true };
    case "leads": return { texto: fmt.inteiro(l.leads), num: true };
    case "negocios": return { texto: fmt.inteiro(l.negocios), num: true, forte: true };
    case "visitas": return { texto: fmt.inteiro(l.visitas), num: true };
    case "vendas": return { texto: fmt.inteiro(l.vendas), num: true };
    case "pagLead": return { texto: fmt.porcento(l.pagLead, 2), num: true };
    case "leadNeg": return { texto: fmt.porcento(l.leadNeg, 0), num: true, forte: (l.leadNeg ?? 0) >= 70, cor: (l.leadNeg ?? 0) >= 70 ? "#1E7A46" : undefined };
    case "custo": return { texto: l.custo === null ? TRACO : fmt.dinheiro(l.custo), num: true, cor: CINZA };
    case "cpl": return { texto: l.cpl === null ? TRACO : fmt.dinheiro(l.cpl), num: true, cor: CINZA };
    case "custoNeg": return { texto: l.custoNeg === null ? TRACO : fmt.dinheiro(l.custoNeg), num: true, cor: CINZA };
    default: return { texto: l.roas === null ? TRACO : `${l.roas.toFixed(1).replace(".", ",")}x`, num: true, cor: CINZA };
  }
}

export function AquisicaoCampanhas({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<AquisicaoPayload>("aquisicao", accessToken, recorte);
  const d = mapearAquisicao(leitura.payload);
  const [visiveis, setVisiveis] = useState<string[]>(COLUNAS.map((c) => c.chave));
  const [menu, setMenu] = useState<"colunas" | "ordem" | null>(null);
  const [ordem, setOrdem] = useState("Leads");
  const [aberta, setAberta] = useState<Linha | null>(null);

  const colunas = COLUNAS.filter((c) => visiveis.includes(c.chave));

  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: d.visualizacoes, texto: fmt.inteiro(d.visualizacoes) },
    { rotulo: "Ações de intenção", bruto: d.intencao, texto: fmt.inteiro(d.intencao) },
    { rotulo: "Leads", bruto: d.leads, texto: fmt.inteiro(d.leads) },
    { rotulo: "Negócios · visitas · vendas", bruto: d.negocios, texto: `${fmt.inteiro(d.negocios)} · ${fmt.inteiro(d.visitas)} · ${fmt.inteiro(d.vendas)}` },
  ];

  const alternarColuna = (chave: string) => {
    setVisiveis((v) => (v.includes(chave) ? (v.length > 1 ? v.filter((x) => x !== chave) : v) : COLUNAS.map((c) => c.chave).filter((c) => v.includes(c) || c === chave)));
  };

  const botaoMenu = { minHeight: 32, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #E4DFD9", borderRadius: 999, background: "#fff", color: "#4D4842", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" } as const;
  const caixaMenu = { position: "absolute" as const, top: 38, right: 0, zIndex: 20, minWidth: 220, background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(31,28,26,0.16)", padding: 10, display: "flex", flexDirection: "column" as const, gap: 2 };

  return (
    <div className="int-secao">
      <Banner
        tom="aviso"
        forte="Custos de mídia ainda não conectados."
        texto="Conecte Google Ads e Meta Ads para visualizar CPL, custo por negócio e ROAS. As colunas existem e ficam vazias — nenhum número é estimado."
        botao={{ rotulo: "Conectar Google Ads e Meta Ads", go: () => recorte.irPara("privacidade") }}
      />

      <GradeKpis itens={kpis} colunas={4} />

      <div className="int-duas par-115">
        <div className="int-col">
          <Cabecalho eyebrow="EVOLUÇÃO POR CANAL" titulo="Leads por origem no período" cor="#8B00CC" nota="tendência ilustrativa — série temporal por dia entra no próximo lote" />
          <div className="intp-cartao" style={{ flex: 1 }}>
            <svg width="100%" height="190" viewBox="0 0 560 190" preserveAspectRatio="none" role="img" aria-label="Leads por origem (ilustrativo)">
              <line x1="0" y1="47" x2="560" y2="47" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="95" x2="560" y2="95" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="142" x2="560" y2="142" stroke="#F2EFEC" strokeWidth="1" />
              <polyline points="0,110 51,96 102,104 153,80 204,90 255,64 306,76 357,52 408,66 459,40 510,54 560,32" fill="none" stroke="#FF7000" strokeWidth="2.5" />
              <polyline points="0,124 51,118 102,122 153,106 204,112 255,98 306,104 357,90 408,96 459,84 510,90 560,78" fill="none" stroke="#8B00CC" strokeWidth="2.5" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {d.series.map((s) => (
                <button key={s.rotulo} type="button" onClick={() => recorte.filtrar(s.chip)} style={{ minHeight: 30, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6, border: `1.5px solid ${s.cor}`, borderRadius: 999, background: s.fundo, color: s.texto, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.cor, flex: "none" }} />
                  {s.rotulo}
                </button>
              ))}
            </div>
            <small className="intp-kpi-foot">clicar em uma série aplica o filtro de origem à página inteira</small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="ATRIBUIÇÃO" titulo="Origem do lead" cor="#8B00CC" />
          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Origens que mais trazem lead</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.ultimoToque.map((o) => (
                  <button key={o.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Origem: ${o.l}`)}>
                    <div className="intp-linha-kv"><span>{o.l}</span><b>{o.r}</b></div>
                  </button>
                ))}
              </div>
              <small className="intp-kpi-foot">origem registrada no lead (CRM)</small>
            </div>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Primeiro toque (site)</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.primeiroToque.map((o) => (
                  <div key={o.l} className="intp-linha-kv"><span>{o.l}</span><b>{o.r}</b></div>
                ))}
              </div>
              <small className="intp-kpi-foot">atribuição de primeiro toque depende de UTM + consentimento (baixa cobertura hoje)</small>
            </div>
          </div>
          <div className="intp-cartao" style={{ background: "#F7ECFC", color: "#66009A", boxShadow: "none", flex: 1, gap: 6 }}>
            <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>Não atribuído — mostrado, nunca escondido</span>
            <strong style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#66009A" }}>
              {d.naoAtribuido.leads} <small style={{ fontSize: 12, fontWeight: 600 }}>leads sem origem</small>
            </strong>
            <small style={{ fontSize: 11, color: "#66009A", lineHeight: 1.5 }}>{d.naoAtribuido.motivos}</small>
          </div>
        </div>
      </div>

      <div className="intp-cab" style={{ position: "relative", alignItems: "flex-end" }}>
        <div>
          <span className="intp-cab-eyebrow" style={{ color: "#FF7000" }}>TABELA DETALHADA</span>
          <h2>Origem e conversão, lado a lado</h2>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, position: "relative" }}>
          <button type="button" style={botaoMenu} onClick={() => setMenu((m) => (m === "colunas" ? null : "colunas"))} aria-expanded={menu === "colunas"}>Escolher colunas</button>
          <button type="button" style={botaoMenu} onClick={() => setMenu((m) => (m === "ordem" ? null : "ordem"))} aria-expanded={menu === "ordem"}>Ordenar: {ordem.toLocaleLowerCase("pt-BR")}</button>
          {menu === "colunas" ? (
            <div style={caixaMenu} role="group" aria-label="Escolher colunas">
              {COLUNAS.map((c) => (
                <button key={c.chave} type="button" onClick={() => alternarColuna(c.chave)} style={{ minHeight: 32, display: "flex", alignItems: "center", gap: 9, border: 0, background: "none", padding: "4px 6px", borderRadius: 9, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#4D4842", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 15, height: 15, borderRadius: 5, flex: "none", display: "grid", placeItems: "center", border: visiveis.includes(c.chave) ? "1.5px solid #FF7000" : "1.5px solid #E4DFD9", background: visiveis.includes(c.chave) ? "#FF7000" : "#fff", color: "#fff", fontSize: 10, fontWeight: 700 }}>{visiveis.includes(c.chave) ? "✓" : ""}</span>
                  {c.titulo}
                </button>
              ))}
            </div>
          ) : null}
          {menu === "ordem" ? (
            <div style={caixaMenu} role="group" aria-label="Ordenar por">
              {COLUNAS.filter((c) => c.num).map((c) => (
                <button key={c.chave} type="button" onClick={() => { setOrdem(c.titulo); setMenu(null); }} style={{ minHeight: 32, display: "flex", alignItems: "center", border: 0, background: ordem === c.titulo ? "#FFF3EA" : "none", padding: "4px 8px", borderRadius: 9, fontFamily: "inherit", fontSize: 12, fontWeight: ordem === c.titulo ? 700 : 600, color: ordem === c.titulo ? "#CC5800" : "#4D4842", cursor: "pointer", textAlign: "left" }}>{c.titulo}</button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="int-tabela-roxa">
        <Tabela
          key={`${ordem}-${visiveis.join(",")}`}
          colunas={colunas.map((c) => ({ titulo: c.titulo, num: c.num }))}
          ordenadaEm={colunas.some((c) => c.titulo === ordem) ? ordem : undefined}
          linhas={d.linhas.map((l) => ({
            chave: `${l.origem}-${l.campanha}`,
            destaque: !!l.naoAtribuido,
            abrir: () => setAberta(l),
            celulas: colunas.map((c) => celula(l, c)),
          }))}
          foot={`${d.linhas.length} origens · clicar na linha abre o drawer · custo/CPL/ROAS ficam — até as contas de mídia serem conectadas`}
        />
      </div>

      <GavetaLateral
        aberta={!!aberta}
        titulo={aberta ? (aberta.campanha === TRACO ? aberta.origem : aberta.campanha) : ""}
        sub={aberta ? `${aberta.origem} · ${aberta.midia}` : undefined}
        fechar={() => setAberta(null)}
        rodape={aberta ? (
          <button type="button" className="int-btn" onClick={() => { recorte.filtrar(`Origem: ${aberta.origem}`); setAberta(null); }}>Filtrar a página por esta linha</button>
        ) : null}
      >
        {aberta ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {COLUNAS.slice(3).map((c) => {
                const cel = celula(aberta, c);
                return (<div className="intp-detalhe-linha" key={c.chave}><span>{c.titulo}</span><b style={c.cinza ? { color: CINZA } : undefined}>{cel.texto}</b></div>);
              })}
            </div>
            <div className="intp-detalhe-aviso">Custo, CPL, custo por negócio e ROAS ficam com “—” até Google Ads e Meta Ads serem conectados. Nenhum valor é estimado a partir de média.</div>
          </>
        ) : null}
      </GavetaLateral>

      <RodapeFontes
        fontes={["coleta própria (site)", "leads / negócios (CRM Funil 2.0)"]}
        pendencias={["Google Ads e Meta Ads não conectados (custo, CPL, custo por negócio, ROAS)", "atribuição de primeiro/último toque depende de UTM + consentimento"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

const CORES = ["#FF7000", "#8B00CC", "#B24DDD", "#4D4842", "#C9C2BA"];

const vazioAquisicao: Dados = {
  visualizacoes: null, intencao: null, leads: null, negocios: null, visitas: null, vendas: null,
  linhas: [], series: [], primeiroToque: [], ultimoToque: [],
  naoAtribuido: { vis: "—", leads: "—", negocios: "—", motivos: "aguardando conexão" }, atualizado: "—",
};

function mapearAquisicao(p: AquisicaoPayload | null): Dados {
  if (!p) return vazioAquisicao;
  const linhas: Linha[] = p.linhas.map((l) => ({
    origem: l.origem, midia: "—", campanha: TRACO, utm: "—",
    vis: null, intencao: null, leads: l.leads, negocios: l.negocios, visitas: null, vendas: null,
    pagLead: null, leadNeg: l.leadNeg, custo: null, cpl: null, custoNeg: null, roas: null,
  }));
  const series: Serie[] = p.linhas.slice(0, 5).map((l, i) => ({ rotulo: l.origem, chip: `Origem: ${l.origem}`, cor: CORES[i] ?? "#C9C2BA", fundo: "#FFF3EA", texto: "#4D4842", ligada: true, ponto: true }));
  const toque = p.linhas.slice(0, 3).map((l) => ({ l: l.origem, r: `${fmt.inteiro(l.leads)} leads` }));

  return {
    visualizacoes: p.visualizacoes, intencao: p.intencao, leads: p.leads, negocios: p.negocios, visitas: p.visitas, vendas: p.vendas,
    linhas, series,
    primeiroToque: [{ l: "site (com UTM)", r: "—" }],
    ultimoToque: toque,
    naoAtribuido: { vis: "—", leads: fmt.inteiro(p.nao_atribuido), negocios: "—", motivos: "leads sem origem registrada — nunca redistribuído artificialmente entre canais." },
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoAquisicao: Dados = {
  visualizacoes: 24_618, intencao: 2_310, leads: 312, negocios: 187, visitas: 96, vendas: 14,
  linhas: [
    { origem: "Instagram orgânico", midia: "orgânico", campanha: "perfil-bio", utm: "instagram / social", vis: 5_204, intencao: 612, leads: 84, negocios: 52, visitas: 27, vendas: 4, pagLead: 1.61, leadNeg: 62, custo: null, cpl: null, custoNeg: null, roas: null },
  ],
  series: [{ rotulo: "Instagram", chip: "Origem: Instagram orgânico", cor: "#FF7000", fundo: "#FFF3EA", texto: "#CC5800", ligada: true, ponto: true }],
  primeiroToque: [{ l: "Instagram", r: "96 leads" }],
  ultimoToque: [{ l: "Direto", r: "88 leads" }],
  naoAtribuido: { vis: "4.372", leads: "56", negocios: "27", motivos: "sem UTM 48% · sem consentimento 39%." },
  atualizado: "14:28",
};
