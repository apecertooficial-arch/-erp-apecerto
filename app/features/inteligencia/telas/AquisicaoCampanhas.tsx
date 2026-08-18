"use client";

/* 2 · AQUISIÇÃO E CAMPANHAS — artboard 3a, com o layout de DUAS COLUNAS do protótipo.
 *
 * Estrutura do desenho (era coluna única na publicação):
 *   1. banner de custo não conectado, com o botão "Conectar Google Ads e Meta Ads"
 *   2. quatro indicadores do período, sem cabeçalho acima (como no artboard)
 *   3. EVOLUÇÃO POR CANAL (esquerda, mais larga) ao lado de ATRIBUIÇÃO (direita):
 *      primeira origem conhecida · origem atual, um ao lado do outro, e embaixo o
 *      cartão roxo "Não atribuído — mostrado, nunca escondido"
 *   4. TABELA DETALHADA com as 15 colunas do desenho, "Escolher colunas" e
 *      "Ordenar: negócios" no cabeçalho da seção; clicar na linha abre a gaveta
 *      da campanha
 *   5. rodapé de fontes
 *
 * Regras que a tela mantém: os chips de série incluem os canais DESLIGADOS
 * (Desconhecido, Google Ads, Indicação); a linha "Não atribuído" aparece sempre,
 * em roxo, e nunca é redistribuída entre canais; Custo, CPL, Custo/neg. e ROAS
 * existem como coluna e ficam com "—" até as contas de mídia entrarem.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, TRACO } from "../dado";
import { Banner, Cabecalho, GavetaLateral, GradeKpis, Tabela, type Celula, type Kpi } from "../pecas";

type Linha = {
  origem: string;
  midia: string;
  campanha: string;
  detalheCampanha?: string;
  utm: string;
  vis: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  visitas: number | null;
  vendas: number | null;
  pagLead: number | null;
  leadNeg: number | null;
  custo: number | null;
  cpl: number | null;
  custoNeg: number | null;
  roas: number | null;
  paga?: boolean;
  naoAtribuido?: boolean;
  motivos?: string;
};

type Serie = { rotulo: string; chip: string; cor: string; fundo: string; texto: string; ligada: boolean; ponto: boolean };

type Dados = {
  visualizacoes: number | null;
  intencao: number | null;
  leads: number | null;
  negocios: number | null;
  visitas: number | null;
  vendas: number | null;
  linhas: Linha[];
  series: Serie[];
  primeiroToque: { l: string; r: string }[];
  ultimoToque: { l: string; r: string }[];
  naoAtribuido: { vis: string; leads: string; negocios: string; motivos: string };
  atualizado: string;
};

type Coluna = { chave: string; titulo: string; num?: boolean; cinza?: boolean };

/* As 15 colunas do artboard, na ordem do desenho. "Escolher colunas" liga e
   desliga cada uma; nenhuma é inventada e nenhuma soma valor estimado. */
const COLUNAS: Coluna[] = [
  { chave: "origem", titulo: "Origem" },
  { chave: "midia", titulo: "Mídia" },
  { chave: "campanha", titulo: "Campanha · conteúdo · termo" },
  { chave: "vis", titulo: "Vis. página", num: true },
  { chave: "intencao", titulo: "Intenção", num: true },
  { chave: "leads", titulo: "Leads", num: true },
  { chave: "negocios", titulo: "Negócios", num: true },
  { chave: "visitas", titulo: "Visitas", num: true },
  { chave: "vendas", titulo: "Vendas", num: true },
  { chave: "pagLead", titulo: "Pág→lead", num: true },
  { chave: "leadNeg", titulo: "Lead→neg.", num: true },
  { chave: "custo", titulo: "Custo", num: true, cinza: true },
  { chave: "cpl", titulo: "CPL", num: true, cinza: true },
  { chave: "custoNeg", titulo: "Custo/neg.", num: true, cinza: true },
  { chave: "roas", titulo: "ROAS", num: true, cinza: true },
];

const CINZA = "#C9C2BA";

function celula(l: Linha, c: Coluna): Celula {
  switch (c.chave) {
    case "origem":
      return { texto: l.origem, forte: true, cor: l.naoAtribuido ? "#66009A" : undefined };
    case "midia":
      return { texto: l.midia };
    case "campanha":
      return { texto: l.campanha, forte: !!l.paga, sub: l.detalheCampanha };
    case "vis":
      return { texto: fmt.inteiro(l.vis), num: true };
    case "intencao":
      return { texto: fmt.inteiro(l.intencao), num: true };
    case "leads":
      return { texto: fmt.inteiro(l.leads), num: true };
    case "negocios":
      return { texto: fmt.inteiro(l.negocios), num: true, forte: true };
    case "visitas":
      return { texto: fmt.inteiro(l.visitas), num: true };
    case "vendas":
      return { texto: fmt.inteiro(l.vendas), num: true };
    case "pagLead":
      return { texto: fmt.porcento(l.pagLead, 2), num: true };
    case "leadNeg":
      return { texto: fmt.porcento(l.leadNeg, 0), num: true, forte: (l.leadNeg ?? 0) >= 70, cor: (l.leadNeg ?? 0) >= 70 ? "#1E7A46" : undefined };
    case "custo":
      return { texto: l.custo === null ? (l.paga ? "não conectado" : TRACO) : fmt.dinheiro(l.custo), num: true, cor: CINZA };
    case "cpl":
      return { texto: l.cpl === null ? TRACO : fmt.dinheiro(l.cpl), num: true, cor: CINZA };
    case "custoNeg":
      return { texto: l.custoNeg === null ? TRACO : fmt.dinheiro(l.custoNeg), num: true, cor: CINZA };
    default:
      return { texto: l.roas === null ? TRACO : `${l.roas.toFixed(1).replace(".", ",")}x`, num: true, cor: CINZA };
  }
}

export function AquisicaoCampanhas({ recorte }: PropsTela) {
  const d = usarDados();
  const [visiveis, setVisiveis] = useState<string[]>(COLUNAS.map((c) => c.chave));
  const [menu, setMenu] = useState<"colunas" | "ordem" | null>(null);
  const [ordem, setOrdem] = useState("Negócios");
  const [aberta, setAberta] = useState<Linha | null>(null);

  const colunas = COLUNAS.filter((c) => visiveis.includes(c.chave));

  const kpis: Kpi[] = [
    { rotulo: "Visualizações de página", bruto: d.visualizacoes, texto: fmt.inteiro(d.visualizacoes), chip: "▲ +12,4%", chipTom: "bom" },
    { rotulo: "Ações de intenção", bruto: d.intencao, texto: fmt.inteiro(d.intencao), chip: "▲ +15,2%", chipTom: "bom" },
    { rotulo: "Leads", bruto: d.leads, texto: fmt.inteiro(d.leads), chip: "▲ +9,5%", chipTom: "bom" },
    { rotulo: "Negócios · visitas · vendas", bruto: d.negocios, texto: `${fmt.inteiro(d.negocios)} · ${fmt.inteiro(d.visitas)} · ${fmt.inteiro(d.vendas)}`, chip: "▲ +6,3% em negócios", chipTom: "bom" },
  ];

  const alternarColuna = (chave: string) => {
    setVisiveis((v) => (v.includes(chave) ? (v.length > 1 ? v.filter((x) => x !== chave) : v) : COLUNAS.map((c) => c.chave).filter((c) => v.includes(c) || c === chave)));
  };

  const botaoMenu = { minHeight: 32, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #E4DFD9", borderRadius: 999, background: "#fff", color: "#4D4842", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer" } as const;
  const caixaMenu = { position: "absolute" as const, top: 38, right: 0, zIndex: 20, minWidth: 220, background: "#fff", borderRadius: 14, boxShadow: "0 12px 30px rgba(31,28,26,0.16)", padding: 10, display: "flex", flexDirection: "column" as const, gap: 2 };

  return (
    <div className="int-secao">
      {/* 1 · BANNER DE CUSTO */}
      <Banner
        tom="aviso"
        forte="Custos de mídia ainda não conectados."
        texto="Conecte Google Ads e Meta Ads para visualizar CPL, custo por negócio e ROAS. As colunas existem e ficam vazias — nenhum número é estimado."
        botao={{ rotulo: "Conectar Google Ads e Meta Ads", go: () => recorte.irPara("privacidade") }}
      />

      {/* 2 · INDICADORES DO PERÍODO */}
      <GradeKpis itens={kpis} colunas={4} />

      {/* 3 · EVOLUÇÃO POR CANAL + ATRIBUIÇÃO, lado a lado */}
      <div className="int-duas par-115">
        <div className="int-col">
          <Cabecalho eyebrow="EVOLUÇÃO POR CANAL" titulo="Leads por origem ao longo do período" cor="#8B00CC" />
          <div className="intp-cartao" style={{ flex: 1 }}>
            <svg width="100%" height="190" viewBox="0 0 560 190" preserveAspectRatio="none" role="img" aria-label="Leads por origem ao longo do período">
              <line x1="0" y1="47" x2="560" y2="47" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="95" x2="560" y2="95" stroke="#F2EFEC" strokeWidth="1" />
              <line x1="0" y1="142" x2="560" y2="142" stroke="#F2EFEC" strokeWidth="1" />
              <polyline points="0,110 51,96 102,104 153,80 204,90 255,64 306,76 357,52 408,66 459,40 510,54 560,32" fill="none" stroke="#FF7000" strokeWidth="2.5" />
              <polyline points="0,124 51,118 102,122 153,106 204,112 255,98 306,104 357,90 408,96 459,84 510,90 560,78" fill="none" stroke="#8B00CC" strokeWidth="2.5" />
              <polyline points="0,150 51,142 102,146 153,130 204,136 255,118 306,126 357,108 408,116 459,100 510,108 560,94" fill="none" stroke="#B24DDD" strokeWidth="2" />
              <polyline points="0,158 51,154 102,156 153,148 204,152 255,144 306,148 357,140 408,144 459,136 510,140 560,132" fill="none" stroke="#4D4842" strokeWidth="2" />
              <polyline points="0,170 51,166 102,168 153,162 204,166 255,158 306,162 357,154 408,158 459,150 510,154 560,148" fill="none" stroke="#C9C2BA" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {d.series.map((s) => (
                <button
                  key={s.rotulo}
                  type="button"
                  onClick={() => recorte.filtrar(s.chip)}
                  title={s.ligada ? "filtrar a página por esta origem" : "série desligada no gráfico — clique para filtrar a página por ela"}
                  style={{
                    minHeight: 30,
                    padding: "0 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: s.ligada ? `1.5px solid ${s.cor}` : "1px solid #E4DFD9",
                    borderRadius: 999,
                    background: s.fundo,
                    color: s.texto,
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: s.ligada ? 700 : 600,
                    cursor: "pointer",
                  }}
                >
                  {s.ponto ? <span style={{ width: 8, height: 8, borderRadius: 999, background: s.cor, flex: "none" }} /> : null}
                  {s.rotulo}
                </button>
              ))}
            </div>
            <small className="intp-kpi-foot">clicar em uma série aplica o filtro de origem à página inteira</small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="ATRIBUIÇÃO" titulo="Primeiro toque vs. toque atual" cor="#8B00CC" />
          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Primeira origem conhecida</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.primeiroToque.map((o) => (
                  <button key={o.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Primeiro toque: ${o.l}`)}>
                    <div className="intp-linha-kv">
                      <span>{o.l}</span>
                      <b>{o.r}</b>
                    </div>
                  </button>
                ))}
              </div>
              <small className="intp-kpi-foot">primeira atribuição persistida após consentimento</small>
            </div>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Origem atual · último toque</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.ultimoToque.map((o) => (
                  <button key={o.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(`Último toque: ${o.l}`)}>
                    <div className="intp-linha-kv">
                      <span>{o.l}</span>
                      <b>{o.r}</b>
                    </div>
                  </button>
                ))}
              </div>
              <small className="intp-kpi-foot">atribuição da visita que gerou o lead</small>
            </div>
          </div>
          <div className="intp-cartao" style={{ background: "#F7ECFC", color: "#66009A", boxShadow: "none", flex: 1, gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.2 9.3a3 3 0 0 1 5.6 1c0 2-2.8 2.3-2.8 4" />
                <path d="M12 17h.01" />
              </svg>
              <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>Não atribuído — mostrado, nunca escondido</span>
            </div>
            <strong style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#66009A" }}>
              {d.naoAtribuido.vis} <small style={{ fontSize: 12, fontWeight: 600 }}>visualizações</small> · {d.naoAtribuido.leads} <small style={{ fontSize: 12, fontWeight: 600 }}>leads</small> · {d.naoAtribuido.negocios}{" "}
              <small style={{ fontSize: 12, fontWeight: 600 }}>negócios</small>
            </strong>
            <small style={{ fontSize: 11, color: "#66009A", lineHeight: 1.5 }}>{d.naoAtribuido.motivos}</small>
          </div>
        </div>
      </div>

      {/* 4 · TABELA DETALHADA */}
      <div className="intp-cab" style={{ position: "relative", alignItems: "flex-end" }}>
        <div>
          <span className="intp-cab-eyebrow" style={{ color: "#FF7000" }}>TABELA DETALHADA</span>
          <h2>Origem, mídia e campanha, lado a lado</h2>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, position: "relative" }}>
          <button type="button" style={botaoMenu} onClick={() => setMenu((m) => (m === "colunas" ? null : "colunas"))} aria-expanded={menu === "colunas"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16M15 4v16" />
            </svg>
            Escolher colunas
          </button>
          <button type="button" style={botaoMenu} onClick={() => setMenu((m) => (m === "ordem" ? null : "ordem"))} aria-expanded={menu === "ordem"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h13M4 12h9M4 18h5" />
              <path d="m17 14 3 3 3-3" />
            </svg>
            Ordenar: {ordem.toLocaleLowerCase("pt-BR")}
          </button>

          {menu === "colunas" ? (
            <div style={caixaMenu} role="group" aria-label="Escolher colunas">
              {COLUNAS.map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  onClick={() => alternarColuna(c.chave)}
                  style={{ minHeight: 32, display: "flex", alignItems: "center", gap: 9, border: 0, background: "none", padding: "4px 6px", borderRadius: 9, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#4D4842", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ width: 15, height: 15, borderRadius: 5, flex: "none", display: "grid", placeItems: "center", border: visiveis.includes(c.chave) ? "1.5px solid #FF7000" : "1.5px solid #E4DFD9", background: visiveis.includes(c.chave) ? "#FF7000" : "#fff", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                    {visiveis.includes(c.chave) ? "✓" : ""}
                  </span>
                  {c.titulo}
                </button>
              ))}
              <small className="intp-kpi-foot" style={{ padding: "4px 6px" }}>colunas desligadas continuam existindo no dado — nada é apagado</small>
            </div>
          ) : null}

          {menu === "ordem" ? (
            <div style={caixaMenu} role="group" aria-label="Ordenar por">
              {COLUNAS.filter((c) => c.num).map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  onClick={() => {
                    setOrdem(c.titulo);
                    setMenu(null);
                  }}
                  style={{ minHeight: 32, display: "flex", alignItems: "center", border: 0, background: ordem === c.titulo ? "#FFF3EA" : "none", padding: "4px 8px", borderRadius: 9, fontFamily: "inherit", fontSize: 12, fontWeight: ordem === c.titulo ? 700 : 600, color: ordem === c.titulo ? "#CC5800" : "#4D4842", cursor: "pointer", textAlign: "left" }}
                >
                  {c.titulo}
                </button>
              ))}
              <small className="intp-kpi-foot" style={{ padding: "4px 6px" }}>o cabeçalho da tabela também ordena, com um clique</small>
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
          foot="mostrando 8 de 24 linhas · clicar na linha abre o drawer da campanha"
          acaoFinal={<button type="button" className="int-link" style={{ fontWeight: 700 }}>Ver todas →</button>}
        />
      </div>

      {/* GAVETA DA CAMPANHA — 420px, ao lado da tabela */}
      <GavetaLateral
        aberta={!!aberta}
        titulo={aberta ? (aberta.campanha === TRACO ? aberta.origem : aberta.campanha) : ""}
        sub={aberta ? `${aberta.origem} · ${aberta.midia} · utm ${aberta.utm}` : undefined}
        fechar={() => setAberta(null)}
        rodape={
          aberta ? (
            <button
              type="button"
              className="int-btn"
              onClick={() => {
                recorte.filtrar(`Origem: ${aberta.origem}${aberta.campanha !== TRACO ? ` · ${aberta.campanha}` : ""}`);
                setAberta(null);
              }}
            >
              Filtrar a página por esta linha
            </button>
          ) : null
        }
      >
        {aberta ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {COLUNAS.slice(3).map((c) => {
                const cel = celula(aberta, c);
                return (
                  <div className="intp-detalhe-linha" key={c.chave}>
                    <span>{c.titulo}</span>
                    <b style={c.cinza ? { color: CINZA } : undefined}>{cel.texto}</b>
                  </div>
                );
              })}
            </div>
            <div className="intp-detalhe-aviso">
              {aberta.motivos ??
                "Custo, CPL, custo por negócio e ROAS ficam com “—” até Google Ads e Meta Ads serem conectados. Nenhum valor é estimado a partir de média."}
            </div>
          </>
        ) : null}
      </GavetaLateral>

      {/* 5 · RODAPÉ */}
      <RodapeFontes
        fontes={["coleta própria", "UTMs", "CRM Funil 2.0"]}
        pendencias={["Google Ads e Meta Ads não conectados (custo, CPL, custo por negócio, ROAS)", "UTMs ausentes em 3 anúncios"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO — enquanto a conexão não existe, a tela lê
   daqui. Campo nulo cai no contrato de dado ausente sem mexer no layout. */
function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  visualizacoes: 24_618,
  intencao: 2_310,
  leads: 312,
  negocios: 187,
  visitas: 96,
  vendas: 14,
  series: [
    { rotulo: "Instagram", chip: "Origem: Instagram orgânico", cor: "#FF7000", fundo: "#FFF3EA", texto: "#CC5800", ligada: true, ponto: true },
    { rotulo: "Google orgânico", chip: "Origem: Google orgânico", cor: "#8B00CC", fundo: "#F7ECFC", texto: "#66009A", ligada: true, ponto: true },
    { rotulo: "Meta Ads", chip: "Origem: Meta Ads", cor: "#B24DDD", fundo: "#F7ECFC", texto: "#66009A", ligada: true, ponto: true },
    { rotulo: "Direto", chip: "Origem: Direto", cor: "#4D4842", fundo: "#F2EFEC", texto: "#1F1C1A", ligada: true, ponto: true },
    { rotulo: "Desconhecido", chip: "Origem: Desconhecido", cor: "#C9C2BA", fundo: "#fff", texto: "#9A938B", ligada: false, ponto: true },
    { rotulo: "Google Ads", chip: "Origem: Google Ads", cor: "#C9C2BA", fundo: "#fff", texto: "#9A938B", ligada: false, ponto: false },
    { rotulo: "Indicação", chip: "Origem: Indicação", cor: "#C9C2BA", fundo: "#fff", texto: "#9A938B", ligada: false, ponto: false },
  ],
  primeiroToque: [
    { l: "Instagram", r: "96 leads" },
    { l: "Google orgânico", r: "74" },
    { l: "Meta Ads", r: "52" },
  ],
  ultimoToque: [
    { l: "Direto", r: "88 leads" },
    { l: "Instagram", r: "71" },
    { l: "Google orgânico", r: "60" },
  ],
  naoAtribuido: {
    vis: "4.372",
    leads: "56",
    negocios: "27",
    motivos: "motivos: sem UTM 48% · sem consentimento 39% · referência perdida 13%. Nunca redistribuído artificialmente entre os canais.",
  },
  linhas: [
    { origem: "Instagram orgânico", midia: "orgânico", campanha: "perfil-bio", utm: "instagram / social", vis: 5_204, intencao: 612, leads: 84, negocios: 52, visitas: 27, vendas: 4, pagLead: 1.61, leadNeg: 62, custo: null, cpl: null, custoNeg: null, roas: null },
    { origem: "Google orgânico", midia: "orgânico", campanha: TRACO, utm: "google / organic", vis: 6_120, intencao: 488, leads: 66, negocios: 41, visitas: 22, vendas: 3, pagLead: 1.08, leadNeg: 62, custo: null, cpl: null, custoNeg: null, roas: null },
    { origem: "Direto", midia: TRACO, campanha: TRACO, utm: "sem utm · acesso direto", vis: 3_208, intencao: 342, leads: 44, negocios: 29, visitas: 15, vendas: 2, pagLead: 1.37, leadNeg: 66, custo: null, cpl: null, custoNeg: null, roas: null },
    { origem: "Meta Ads", midia: "pago", campanha: "moema-prontos-ago", detalheCampanha: "· carrossel-gaivota · —", utm: "meta / cpc", vis: 2_860, intencao: 296, leads: 32, negocios: 23, visitas: 11, vendas: 2, pagLead: 1.12, leadNeg: 72, custo: null, cpl: null, custoNeg: null, roas: null, paga: true },
    { origem: "Meta Ads", midia: "pago", campanha: "locacao-mobiliado", detalheCampanha: "· reels-tour · —", utm: "meta / cpc", vis: 1_526, intencao: 132, leads: 15, negocios: 9, visitas: 6, vendas: 1, pagLead: 0.98, leadNeg: 60, custo: null, cpl: null, custoNeg: null, roas: null, paga: true },
    { origem: "Google Ads", midia: "pago", campanha: "apartamento-moema", detalheCampanha: "· anuncio-1 · “apartamento moema pronto”", utm: "google / cpc", vis: 916, intencao: 74, leads: 6, negocios: 4, visitas: 3, vendas: 1, pagLead: 0.66, leadNeg: 67, custo: null, cpl: null, custoNeg: null, roas: null, paga: true },
    { origem: "Indicação", midia: "indicação", campanha: TRACO, utm: "referral", vis: 412, intencao: 48, leads: 9, negocios: 2, visitas: 2, vendas: 0, pagLead: 2.18, leadNeg: 22, custo: null, cpl: null, custoNeg: null, roas: null },
    {
      origem: "Não atribuído",
      midia: TRACO,
      campanha: "sem UTM · sem consentimento · referência perdida",
      utm: "ausente",
      vis: 4_372,
      intencao: 318,
      leads: 56,
      negocios: 27,
      visitas: 10,
      vendas: 1,
      pagLead: 1.28,
      leadNeg: 48,
      custo: null,
      cpl: null,
      custoNeg: null,
      roas: null,
      naoAtribuido: true,
      motivos: "Esta linha nunca é redistribuída entre canais. Motivos: sem UTM 48% · sem consentimento 39% · referência perdida 13%.",
    },
  ],
  atualizado: "14:28",
};
