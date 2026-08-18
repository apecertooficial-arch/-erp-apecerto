"use client";

/* 3 · COMPORTAMENTO E CONTEÚDO — artboard 4a, com as TRÊS COLUNAS do protótipo.
 *
 * Estrutura do desenho:
 *   1. PÁGINAS — quatro cartões: mais acessadas · de entrada · maior intenção ·
 *      acesso alto e conversão baixa (com a fila de correção)
 *   2. tabela de páginas, do acesso ao lead, com a leitura ao lado
 *   3. faixa de três colunas: ROLAGEM (até onde leem, em barras) · INTERAÇÕES
 *      (dez eventos com ícone, verde = conta como intenção) · DISPOSITIVOS
 *      (tabela com Vis., Engaj., Intenção, Leads e Pág→lead, celular em roxo)
 *   4. faixa final: JORNADA “o caminho mais comum antes do lead” em cinco passos
 *      ao lado de MAPAS E GRAVAÇÕES · Microsoft Clarity, com os botões de abrir
 *   5. rodapé de fontes
 *
 * Página com 0 lead mostra 0, porque zero é dado. Gravação e mapa existem só para
 * quem consentiu Analytics — a tela diz isso em vez de esconder o bloco.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Tabela } from "../pecas";

type Glifo = "whatsapp" | "filtros" | "telefone" | "busca" | "agenda" | "galeria" | "formulario" | "favorito" | "instagram" | "proprietario";

/* Ícones dos eventos — traço de 2px e terminal redondo, a construção do Lucide
   usada no desenho, sem acrescentar dependência ao projeto. */
function Ico({ g }: { g: Glifo }) {
  const c = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (g === "whatsapp") return <svg {...c}><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.2-5.6A8.4 8.4 0 1 1 21 11.5Z" /></svg>;
  if (g === "filtros") return <svg {...c}><path d="M4 7h11M4 12h5M4 17h14" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="12" r="2" /></svg>;
  if (g === "telefone") return <svg {...c}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" /></svg>;
  if (g === "busca") return <svg {...c}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.3-4.3" /></svg>;
  if (g === "agenda") return <svg {...c}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" /></svg>;
  if (g === "galeria") return <svg {...c}><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M21 7v12a2 2 0 0 1-2 2H7" /><circle cx="8" cy="8" r="1.6" /></svg>;
  if (g === "formulario") return <svg {...c}><path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h7" /><path d="M9 7h6M9 11h4" /><path d="m17 17 4-4 2 2-4 4h-2Z" /></svg>;
  if (g === "favorito") return <svg {...c}><path d="M12 20s-7-4.5-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.5 12 20 12 20Z" /></svg>;
  if (g === "instagram") return <svg {...c}><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" /><path d="M17.5 6.5h.01" /></svg>;
  return <svg {...c}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1Z" /><path d="M18 2v4M16 4h4" /></svg>;
}

const TILE: Record<"verde" | "laranja" | "roxo", { fundo: string; cor: string }> = {
  verde: { fundo: "#E4F6EC", cor: "#1FA85A" },
  laranja: { fundo: "#FFE4D1", cor: "#CC5800" },
  roxo: { fundo: "#F7ECFC", cor: "#66009A" },
};

type Dados = {
  paginas: { pagina: string; visualizacoes: number | null; entradas: number | null; intencao: number | null; leads: number | null; motivo: string }[];
  maisAcessadas: { l: string; r: string }[];
  entradas: { l: string; r: string }[];
  maiorIntencao: { l: string; r: string }[];
  correcao: { l: string; r: string; sub: string }[];
  rolagem: { marca: string; pct: number | null; altura: number }[];
  interacoes: { l: string; r: string; chip: string; g: Glifo; tile: "verde" | "laranja" | "roxo" }[];
  dispositivos: { nome: string; vis: number | null; engaj: number | null; intencao: number | null; leads: number | null; pagLead: number | null; ativo?: boolean }[];
  jornada: { passo: string; titulo: string; sub: string; fim?: boolean }[];
  jornadaResumo: { leads: string; nota: string; alternativos: string };
  clarity: { sessoes: number | null };
  atualizado: string;
};

export function ComportamentoConteudo({ recorte }: PropsTela) {
  const d = usarDados();

  return (
    <div className="int-secao">
      {/* 1 · PÁGINAS — os quatro cartões do artboard */}
      <Cabecalho eyebrow="PÁGINAS" titulo="Onde as pessoas chegam, o que prende e o que precisa de conserto" />
      <CartoesLista
        colunas={4}
        cartoes={[
          { titulo: "Mais acessadas", linhas: d.maisAcessadas.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Página: ${x.l}`) })), foot: "visualizações de página no período" },
          { titulo: "Páginas de entrada", linhas: d.entradas.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Entrada: ${x.l}`) })), foot: "primeira página da visita" },
          { titulo: "Maior intenção e lead", linhas: d.maiorIntencao.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Página: ${x.l}`) })), foot: "ações de intenção · leads gerados na página" },
          {
            titulo: "Acesso alto, conversão baixa",
            chip: "fila de correção",
            chipTom: "aviso",
            linhas: d.correcao,
            link: { rotulo: "Ver fila completa →", go: () => recorte.filtrar("Fila de correção de páginas") },
          },
        ]}
      />

      {/* 2 · TABELA DE PÁGINAS */}
      <Cabecalho eyebrow="TABELA DE PÁGINAS" titulo="Cada página, do acesso ao lead" cor="#8B00CC" nota="clique na linha para filtrar · clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Página" }, { titulo: "Visualizações", num: true }, { titulo: "Entradas", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Leitura" }]}
        ordenadaEm="Visualizações"
        linhas={d.paginas.map((p) => ({
          chave: p.pagina,
          destaque: p.leads !== null && p.leads <= 2 && (p.visualizacoes ?? 0) > 900,
          abrir: () => recorte.filtrar(`Página: ${p.pagina}`),
          celulas: [
            { texto: p.pagina, forte: true },
            { texto: fmt.inteiro(p.visualizacoes), num: true },
            { texto: fmt.inteiro(p.entradas), num: true },
            { texto: fmt.inteiro(p.intencao), num: true },
            { texto: fmt.inteiro(p.leads), num: true, cor: (p.leads ?? 9) <= 2 ? "#D93E3E" : undefined },
            { texto: p.motivo },
          ],
        }))}
        foot="página com 0 lead mostra zero, porque zero é dado · o motivo vem sempre ao lado, para virar tarefa e não julgamento"
      />

      {/* 3 · ROLAGEM · INTERAÇÕES · DISPOSITIVOS, em três colunas */}
      <div className="int-tres">
        <div className="int-col">
          <Cabecalho eyebrow="ROLAGEM" titulo="Até onde leem" cor="#8B00CC" />
          <div className="intp-cartao" style={{ flex: 1, gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 120 }}>
              {d.rolagem.map((b) => (
                <div key={b.marca} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 5, height: "100%" }}>
                  <b style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", textAlign: "center" }}>{fmt.porcento(b.pct, 0)}</b>
                  <span style={{ display: "block", height: `${b.altura}%`, borderRadius: "8px 8px 4px 4px", background: "linear-gradient(180deg,#FF9A4D,#FF7000)" }} />
                  <small style={{ fontSize: 11, color: "#6E6760", textAlign: "center", fontWeight: 600 }}>{b.marca}</small>
                </div>
              ))}
            </div>
            <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>
              % das visualizações que chegam a cada marca de rolagem · por página no drill-down · coletada desde 12 ago — ainda sem base de comparação
            </small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="INTERAÇÕES" titulo="O que fazem além de ler" cor="#8B00CC" />
          <div className="intp-cartao int-eventos" style={{ flex: 1 }}>
            {d.interacoes.map((i) => (
              <button key={i.l} type="button" className="intp-linha-btn" onClick={() => recorte.filtrar(i.chip)} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, padding: "5px 0" }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, background: TILE[i.tile].fundo, color: TILE[i.tile].cor, display: "grid", placeItems: "center", flex: "none" }}>
                  <Ico g={i.g} />
                </span>
                <span style={{ flex: 1, fontWeight: 600, color: "#4D4842" }}>{i.l}</span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{i.r}</b>
              </button>
            ))}
            <small className="intp-kpi-foot" style={{ gridColumn: "1 / -1", alignSelf: "end" }}>
              verde = conta como ação de intenção · clicar em um evento filtra a página · formulário: 371 iniciados · 312 enviados
            </small>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="DISPOSITIVOS" titulo="Desktop, tablet e celular" cor="#8B00CC" />
          <div className="int-tabela-roxa">
            <Tabela
              colunas={[{ titulo: "Dispositivo" }, { titulo: "Vis.", num: true }, { titulo: "Engaj.", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Pág→lead", num: true }]}
              ordenadaEm="Vis."
              linhas={d.dispositivos.map((x) => ({
                chave: x.nome,
                destaque: !!x.ativo,
                abrir: () => recorte.filtrar(`Dispositivo: ${x.nome.toLocaleLowerCase("pt-BR")}`),
                celulas: [
                  { texto: x.ativo ? `${x.nome} ●` : x.nome, forte: !!x.ativo, cor: x.ativo ? "#66009A" : undefined },
                  { texto: fmt.inteiro(x.vis), num: true, forte: !!x.ativo },
                  { texto: fmt.inteiro(x.engaj), num: true },
                  { texto: fmt.inteiro(x.intencao), num: true },
                  { texto: fmt.inteiro(x.leads), num: true },
                  { texto: fmt.porcento(x.pagLead, 2), num: true },
                ],
              }))}
              foot="roxo = linha do filtro ativo · somas batem com os totais da Visão executiva"
            />
          </div>
        </div>
      </div>

      {/* 4 · JORNADA + CLARITY, lado a lado */}
      <div className="int-duas par-120">
        <div className="int-col">
          <Cabecalho eyebrow="JORNADA" titulo="O caminho mais comum antes do lead" />
          <div className="intp-cartao" style={{ flex: 1, gap: 12 }}>
            <div className="int-jornada">
              {d.jornada.map((p, i) => (
                <div key={p.titulo} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: i === 0 ? "0 10px 0 0" : i === d.jornada.length - 1 ? "0 0 0 10px" : "0 10px", borderRight: i === d.jornada.length - 1 ? undefined : "1px dashed #E4DFD9" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 999, background: p.fim ? "#E4F6EC" : "#FFE4D1", color: p.fim ? "#1FA85A" : "#CC5800", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>
                    {p.fim ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      p.passo
                    )}
                  </span>
                  <b style={{ fontSize: 12 }}>{p.titulo}</b>
                  <small style={{ fontSize: 11, color: "#9A938B" }}>{p.sub}</small>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FAF8F6", borderRadius: 12, padding: "10px 14px", flexWrap: "wrap" }}>
              <b style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{d.jornadaResumo.leads}</b>
              <small style={{ fontSize: 12, color: "#6E6760" }}>{d.jornadaResumo.nota}</small>
              <button type="button" className="int-link" style={{ marginLeft: "auto", fontWeight: 700 }} onClick={() => recorte.filtrar("Caminhos alternativos antes do lead")}>
                {d.jornadaResumo.alternativos}
              </button>
            </div>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="MAPAS E GRAVAÇÕES" titulo="Microsoft Clarity" />
          <div className="intp-cartao" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6E6760" }}>Sessões consentidas disponíveis</span>
              <b style={{ marginLeft: "auto", fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{fmt.inteiro(d.clarity.sessoes)}</b>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a className="int-btn" href="https://clarity.microsoft.com" target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 150, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textDecoration: "none", lineHeight: "36px", fontSize: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21c4 0 6-2.6 6-5.6 0-4.4-4-5.4-3-9.4-3 1-5 3.6-5 6 0 1.4.6 2.4 1.4 3-.6.6-2.4 1.2-2.4 3.4 0 1.6 1 2.6 3 2.6Z" />
                </svg>
                Abrir mapas de calor ↗
              </a>
              <a className="int-btn" href="https://clarity.microsoft.com" target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 150, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, textDecoration: "none", lineHeight: "36px", fontSize: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="6" width="14" height="12" rx="2" />
                  <path d="m22 8-6 4 6 4V8Z" />
                </svg>
                Abrir gravações ↗
              </a>
            </div>
            <div style={{ background: "#FDF1D9", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B5700A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }} aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <small style={{ fontSize: 11, color: "#7A5E12", lineHeight: 1.5 }}>
                <b>Clarity sem eventos há 3h</b> — mapas e gravações deste período podem estar incompletos.{" "}
                <button type="button" onClick={() => recorte.irPara("privacidade")} style={{ border: 0, background: "none", padding: 0, fontFamily: "inherit", fontSize: 11, color: "#7A5E12", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>
                  Ver diagnóstico
                </button>
              </small>
            </div>
            <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>
              Gravações e mapas existem somente para quem consentiu Analytics. Quem escolheu só dados essenciais não é gravado — e a tela diz isso. Nada é incorporado no ERP: os botões abrem o Clarity em nova aba.
            </small>
          </div>
        </div>
      </div>

      {/* 5 · RODAPÉ */}
      <RodapeFontes
        fontes={["coleta própria", "Google Tag", "Clarity (parcial)"]}
        pendencias={["Clarity sem evento há 3 h (mapas e gravações parciais)", "2 páginas sem tracking", "consentimento Analytics em 31%"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO. */
function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  maisAcessadas: [
    { l: "/imoveis (busca)", r: "6.912" },
    { l: "/ (home)", r: "4.086" },
    { l: "Apê Canário 71 · MO-104", r: "1.486" },
    { l: "Apê Gaivota 402 · MO-118", r: "1.240" },
  ],
  entradas: [
    { l: "/ (home)", r: "3.418" },
    { l: "/imoveis (busca)", r: "2.874" },
    { l: "Apê Canário 71 · MO-104", r: "912" },
    { l: "/blog/guia-moema", r: "846" },
  ],
  maiorIntencao: [
    { l: "Apê Canário 71 · MO-104", r: "312 · 38 leads" },
    { l: "Apê Pavão 88 · MO-097", r: "264 · 31" },
    { l: "/imoveis (busca)", r: "228 · 24" },
    { l: "Apê Sabiá 12 · MO-121", r: "176 · 19" },
  ],
  correcao: [
    { l: "/blog/guia-moema", r: "2.180 vis. · 0 leads", sub: "sem CTA de imóvel na página" },
    { l: "Apê Gaivota 402 · MO-118", r: "1.240 vis. · 2 leads", sub: "galeria pouco aberta — revisar fotos" },
    { l: "/sobre", r: "934 vis. · 1 lead", sub: "sem caminho para a busca" },
  ],
  rolagem: [
    { marca: "25%", pct: 88, altura: 74 },
    { marca: "50%", pct: 64, altura: 53 },
    { marca: "75%", pct: 38, altura: 31 },
    { marca: "90%", pct: 19, altura: 15 },
  ],
  interacoes: [
    { l: "WhatsApp", r: "1.294", chip: "Evento: whatsapp_click", g: "whatsapp", tile: "verde" },
    { l: "Mudança de filtros", r: "3.842", chip: "Evento: filter_change", g: "filtros", tile: "laranja" },
    { l: "Telefone", r: "412", chip: "Evento: phone_click", g: "telefone", tile: "verde" },
    { l: "Pesquisa de imóveis", r: "2.914", chip: "Evento: property_search", g: "busca", tile: "laranja" },
    { l: "Agendamento de visita", r: "233", chip: "Evento: visit_schedule", g: "agenda", tile: "verde" },
    { l: "Galeria (abrir / interagir)", r: "4.216", chip: "Evento: gallery_interaction", g: "galeria", tile: "roxo" },
    { l: "Início de formulário", r: "371", chip: "Evento: form_start", g: "formulario", tile: "verde" },
    { l: "Favoritos", r: "618", chip: "Evento: favorite_toggle", g: "favorito", tile: "roxo" },
    { l: "Clique no Instagram", r: "186", chip: "Evento: instagram_click", g: "instagram", tile: "roxo" },
    { l: "CTA de proprietário", r: "74", chip: "Evento: owner_cta", g: "proprietario", tile: "laranja" },
  ],
  dispositivos: [
    { nome: "Celular", vis: 14_464, engaj: 6_480, intencao: 1_544, leads: 185, pagLead: 1.28, ativo: true },
    { nome: "Desktop", vis: 8_842, engaj: 4_412, intencao: 692, leads: 118, pagLead: 1.33 },
    { nome: "Tablet", vis: 1_312, engaj: 588, intencao: 74, leads: 9, pagLead: 0.69 },
  ],
  jornada: [
    { passo: "1", titulo: "Entra pela home", sub: "vindo do Instagram (bio)" },
    { passo: "2", titulo: "Busca imóveis", sub: "pesquisa + 2 a 3 filtros" },
    { passo: "3", titulo: "Abre um apê", sub: "e percorre a galeria" },
    { passo: "4", titulo: "Chama no WhatsApp", sub: "na página do imóvel" },
    { passo: "5", titulo: "Vira lead", sub: "entra no Funil 2.0", fim: true },
  ],
  jornadaResumo: { leads: "134 leads", nota: "seguiram este caminho — 43% do total", alternativos: "Ver caminhos alternativos (12) →" },
  clarity: { sessoes: 7_938 },
  paginas: [
    { pagina: "/imoveis (busca)", visualizacoes: 6_912, entradas: 2_874, intencao: 228, leads: 24, motivo: "topo de busca · sem ação pendente" },
    { pagina: "/ (home)", visualizacoes: 4_086, entradas: 3_418, intencao: 196, leads: 18, motivo: "entrada principal" },
    { pagina: "/blog/guia-moema", visualizacoes: 2_180, entradas: 846, intencao: 12, leads: 0, motivo: "sem CTA de imóvel na página" },
    { pagina: "Apê Canário 71 · MO-104", visualizacoes: 1_486, entradas: 912, intencao: 312, leads: 38, motivo: "melhor conversão do período" },
    { pagina: "Apê Gaivota 402 · MO-118", visualizacoes: 1_240, entradas: 214, intencao: 31, leads: 2, motivo: "galeria pouco aberta — revisar fotos" },
    { pagina: "/sobre", visualizacoes: 934, entradas: 402, intencao: 8, leads: 1, motivo: "sem caminho para a busca" },
  ],
  atualizado: "14:28",
};
