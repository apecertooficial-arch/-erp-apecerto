"use client";

/* 8 · PRIVACIDADE E QUALIDADE DO TRACKING — artboard 9a, em duas colunas.
 *
 * Esta tela agora lê DADO REAL via /api/inteligencia/privacidade (RPC
 * intel_privacidade, gated por is_equipe). O layout é idêntico ao publicado; só
 * o corpo de usarDados mudou. O que não tem fonte (Google Tag, Clarity, CRM,
 * qualidade de eventos, atribuição) aparece como — com motivo — nunca demo,
 * nunca zero inventado. O demo vira fixture (demoPrivacidade), fora da produção. */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, TRACO } from "../dado";
import { Cabecalho, ChipsEventos } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ConsentTupla, PrivacidadePayload } from "../../../lib/inteligencia/tipos";

type Estado = "bom" | "aviso";

type Dados = {
  totalPageviews: number | null;
  niveis: { rotulo: string; pct: number | null; cor: string; foot: string }[];
  semanas: { rotulo: string; essenciais: number; analytics: number; marketing: number }[];
  liberacoes: { nivel: string; propria: string; tag: string; clarity: string; coletado: string }[];
  regras: string[];
  fontes: { rotulo: string; estado: Estado; selo: string; nota: string; diagnostico?: boolean }[];
  horas: { altura: number; cor: string; queda?: boolean }[];
  qualidade: { l: string; r: string; corR?: string; sub?: string }[];
  atribuicao: { l: string; r: string; sub?: string }[];
  eventos: string[];
  atualizado: string;
};

const SELO: Record<Estado, { fundo: string; cor: string; ponto: string }> = {
  bom: { fundo: "#E4F6EC", cor: "#1E7A46", ponto: "#1FA85A" },
  aviso: { fundo: "#FDF1D9", cor: "#8A6A15", ponto: "#F2A82C" },
};

export function PrivacidadeTracking({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<PrivacidadePayload>("privacidade", accessToken, recorte);
  const d = mapearPrivacidade(leitura.payload);

  return (
    <div className="int-secao">
      <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        {/* ESQUERDA — consentimento */}
        <div className="int-col">
          <Cabecalho eyebrow="CONSENTIMENTO" titulo="O que as pessoas escolheram" nota={`${recorte.periodo} · ${fmt.inteiro(d.totalPageviews)} visualizações no total`} />
          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {d.niveis.map((n) => (
              <div className="intp-kpi" key={n.rotulo}>
                <span className="intp-kpi-rotulo">{n.rotulo}</span>
                <strong className="int-valor" style={{ fontSize: 24, color: n.cor }}>{fmt.porcento(n.pct, 0)}</strong>
                <small className="intp-kpi-foot">{n.foot}</small>
              </div>
            ))}
          </div>

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">
              Evolução das escolhas <small style={{ fontWeight: 600, color: "#9A938B" }}>· por semana</small>
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 110 }}>
              {d.semanas.map((s) => (
                <div key={s.rotulo} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, height: "100%" }}>
                  <span style={{ display: "block", height: `${s.marketing}%`, borderRadius: "4px 4px 0 0", background: "#FF9A4D" }} />
                  <span style={{ display: "block", height: `${s.analytics}%`, background: "#B24DDD" }} />
                  <span style={{ display: "block", height: `${s.essenciais}%`, borderRadius: "0 0 4px 4px", background: "#E4DFD9" }} />
                  <small style={{ fontSize: 10, color: "#9A938B", textAlign: "center", paddingTop: 3 }}>{s.rotulo}</small>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, fontWeight: 600, color: "#6E6760" }}>
              <span><span style={{ color: "#C9C2BA" }}>●</span> essenciais</span>
              <span><span style={{ color: "#B24DDD" }}>●</span> Analytics</span>
              <span><span style={{ color: "#FF9A4D" }}>●</span> Marketing</span>
            </div>
          </div>

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">O que cada nível libera</span>
            <table className="intp-tabela">
              <thead>
                <tr>
                  <th>Nível</th>
                  <th>Coleta própria</th>
                  <th>Google Tag</th>
                  <th>Clarity</th>
                  <th>O que é coletado</th>
                </tr>
              </thead>
              <tbody>
                {d.liberacoes.map((l) => (
                  <tr key={l.nivel}>
                    <td data-rotulo="Nível" className="forte">{l.nivel}</td>
                    <td data-rotulo="Coleta própria" style={{ color: l.propria === "não" ? "#9A938B" : "#1E7A46", fontWeight: 700 }}>{l.propria}</td>
                    <td data-rotulo="Google Tag" style={{ color: l.tag === "não" ? "#9A938B" : "#1E7A46", fontWeight: 700 }}>{l.tag}</td>
                    <td data-rotulo="Clarity" style={{ color: l.clarity === "não" ? "#9A938B" : "#1E7A46", fontWeight: 700 }}>{l.clarity}</td>
                    <td data-rotulo="O que é coletado">{l.coletado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="intp-kpi-foot">explicação por nível abre no “?” de cada linha, em linguagem simples</small>
          </div>

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Regras que esta tela garante</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {d.regras.map((r) => (
                <span key={r} style={{ fontSize: 11, fontWeight: 600, background: "#FAF8F6", border: "1px solid #F2EFEC", color: "#4D4842", borderRadius: 999, padding: "5px 11px" }}>{r}</span>
              ))}
            </div>
            <div style={{ background: "#FDF1D9", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B5700A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }} aria-hidden="true">
                <path d="M12 3v18M7 7h10M5 7l-2 6h4L5 7ZM19 7l-2 6h4l-2-6ZM8 21h8" />
              </svg>
              <small style={{ fontSize: 11, color: "#7A5E12", lineHeight: 1.5 }}>
                Esta tela descreve o comportamento implementado — a revisão jurídica final é do responsável da empresa e não é substituída por este painel.
              </small>
            </div>
          </div>
        </div>

        {/* DIREITA — saúde técnica */}
        <div className="int-col">
          <Cabecalho eyebrow="SAÚDE TÉCNICA" titulo="A coleta está de pé?" cor="#8B00CC" nota="fonte parada aparece como atenção, nunca como zero" />
          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {d.fontes.map((f) => (
              <div className="intp-kpi" key={f.rotulo}>
                <span className="intp-kpi-rotulo">{f.rotulo}</span>
                <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, background: SELO[f.estado].fundo, color: SELO[f.estado].cor, borderRadius: 999, padding: "4px 10px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: SELO[f.estado].ponto }} />
                  {f.selo}
                </span>
                {f.diagnostico ? (
                  <small style={{ fontSize: 11, color: "#B5700A", fontWeight: 600 }}>
                    {f.nota} ·{" "}
                    <button type="button" onClick={() => recorte.irPara("alertas")} style={{ border: 0, background: "none", padding: 0, fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: "#B5700A", textDecoration: "underline", cursor: "pointer" }}>diagnóstico</button>
                  </small>
                ) : (
                  <small className="intp-kpi-foot">{f.nota}</small>
                )}
              </div>
            ))}
          </div>

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">
              Eventos por hora <small style={{ fontWeight: 600, color: "#9A938B" }}>· hoje</small>
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 90 }}>
              {d.horas.map((h, i) => (
                <span
                  key={`h-${i}`}
                  title={h.queda ? "queda brusca detectada — alerta disparado" : undefined}
                  style={{ flex: 1, height: `${h.altura}%`, borderRadius: "4px 4px 0 0", background: h.cor }}
                />
              ))}
            </div>
            <small className="intp-kpi-foot">
              barras por hora do dia (fuso de São Paulo) — quedas bruscas viram alerta e anotação nas outras páginas
            </small>
          </div>

          <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Qualidade dos eventos</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.qualidade.map((q) => (
                  <div key={q.l}>
                    <div className="intp-linha-kv">
                      <span>{q.l}</span>
                      <b style={q.corR ? { color: q.corR } : undefined}>{q.r}</b>
                    </div>
                    {q.sub ? <small className="intp-linha-sub">{q.sub}</small> : null}
                  </div>
                ))}
              </div>
              <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("alertas")}>Abrir diagnóstico completo →</button>
              <small className="intp-kpi-foot">qualidade de eventos depende de fonte ainda não ligada à Inteligência</small>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Atribuição</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.atribuicao.map((a) => (
                  <div key={a.l}>
                    <div className="intp-linha-kv">
                      <span>{a.l}</span>
                      <b>{a.r}</b>
                    </div>
                    {a.sub ? <small className="intp-linha-sub">{a.sub}</small> : null}
                  </div>
                ))}
              </div>
              <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={() => recorte.irPara("aquisicao")}>Ver o não atribuído em Aquisição →</button>
              <small className="intp-kpi-foot">volume não atribuído nunca é redistribuído entre canais</small>
            </div>
          </div>
        </div>
      </div>

      <Cabecalho eyebrow="O QUE É COLETADO" titulo="Lista fechada, declarada nesta tela" cor="#8B00CC" />
      <ChipsEventos titulo={`Eventos coletados · ${d.eventos.length}`} itens={d.eventos} foot="nada fora desta lista aparece no painel como se já existisse" />

      <RodapeFontes
        fontes={["coleta própria (site-track)", "registro de consentimento"]}
        pendencias={["Google Tag, Clarity e CRM ainda não conectados à Inteligência", "qualidade de eventos e atribuição dependem de fontes externas"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

/* PONTO ÚNICO DE TROCA PARA O BANCO — agora lê a RPC via hook. */
const CORES_NIVEL: Record<string, string> = { essential: "#1F1C1A", analytics: "#66009A", marketing: "#CC5800" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function pvNivel(consent: ConsentTupla[], nivel: string): number {
  return consent.find((c) => c.nivel === nivel)?.pageviews ?? 0;
}
function corHora(frac: number): string {
  if (frac >= 0.85) return "#FF7000";
  if (frac >= 0.4) return "#FF9A4D";
  return "#FFD3B0";
}
function rotuloSemana(iso: string): string {
  const ini = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(ini.getTime())) return iso;
  const fim = new Date(ini.getTime() + 6 * 86_400_000);
  return `${ini.getDate()}–${fim.getDate()} ${MESES[fim.getMonth()]}`;
}
function hhmm(iso: string | null): string {
  if (!iso) return TRACO;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? TRACO : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function minutosDesde(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 60_000));
}

const LIBERACOES: Dados["liberacoes"] = [
  { nivel: "Essencial", propria: "sim, sem cookie", tag: "não", clarity: "não", coletado: "página e ação, sem identificador persistente" },
  { nivel: "Analytics", propria: "sim", tag: "sim", clarity: "sim", coletado: "sessão, mapas de calor e gravações" },
  { nivel: "Marketing", propria: "sim", tag: "sim", clarity: "sim", coletado: "+ atribuição de campanha e remarketing" },
];
const REGRAS: string[] = [
  "essencial sem cookies", "sem fingerprinting", "sem IP bruto", "sem user agent bruto",
  "eventos retidos 90 dias", "hash antifraude 48 h", "acesso restrito à equipe", "política de privacidade acessível",
];

const vazioPrivacidade: Dados = {
  totalPageviews: null,
  niveis: [
    { rotulo: "Somente essenciais", pct: null, cor: CORES_NIVEL.essential, foot: TRACO },
    { rotulo: "Analytics", pct: null, cor: CORES_NIVEL.analytics, foot: TRACO },
    { rotulo: "Marketing", pct: null, cor: CORES_NIVEL.marketing, foot: TRACO },
  ],
  semanas: [],
  liberacoes: LIBERACOES,
  regras: REGRAS,
  fontes: [
    { rotulo: "Coleta própria", estado: "aviso", selo: "carregando", nota: "aguardando conexão" },
    { rotulo: "Google Tag", estado: "aviso", selo: TRACO, nota: "aguardando conexão" },
    { rotulo: "Microsoft Clarity", estado: "aviso", selo: TRACO, nota: "aguardando conexão" },
    { rotulo: "Sincronização com CRM", estado: "aviso", selo: TRACO, nota: "aguardando conexão" },
  ],
  horas: [],
  qualidade: [
    { l: "Páginas sem tracking", r: TRACO },
    { l: "Eventos rejeitados ou inválidos", r: TRACO },
    { l: "Possíveis duplicidades", r: TRACO },
    { l: "Imóveis sem código", r: TRACO },
    { l: "Leads sem sincronização com o CRM", r: TRACO },
  ],
  atribuicao: [
    { l: "Cobertura de UTMs", r: TRACO },
    { l: "Volume não atribuído", r: TRACO },
    { l: "UTMs ausentes em anúncios ativos", r: TRACO },
    { l: "Erros de sincronização · 24 h", r: TRACO },
    { l: "Última verificação", r: TRACO },
  ],
  eventos: [],
  atualizado: TRACO,
};

function mapearPrivacidade(p: PrivacidadePayload | null): Dados {
  if (!p) return vazioPrivacidade;
  const totalPv = p.total_pageviews;
  const pct = (n: string) => (totalPv > 0 ? (100 * pvNivel(p.consentimento, n)) / totalPv : null);
  const maxHora = Math.max(1, ...p.eventos_por_hora_hoje.map((h) => h.eventos));
  const horas = p.eventos_por_hora_hoje.map((h) => ({ altura: Math.max(6, Math.round((100 * h.eventos) / maxHora)), cor: corHora(h.eventos / maxHora) }));
  const minColeta = minutosDesde(p.ultimo_evento_em);
  const coletaBoa = minColeta !== null && minColeta <= 30;

  return {
    totalPageviews: totalPv,
    niveis: [
      { rotulo: "Somente essenciais", pct: pct("essential"), cor: CORES_NIVEL.essential, foot: `${fmt.inteiro(pvNivel(p.consentimento, "essential"))} visualizações` },
      { rotulo: "Analytics", pct: pct("analytics"), cor: CORES_NIVEL.analytics, foot: `${fmt.inteiro(pvNivel(p.consentimento, "analytics"))} visualizações · habilita GA4 e gravação` },
      { rotulo: "Marketing", pct: pct("marketing"), cor: CORES_NIVEL.marketing, foot: `${fmt.inteiro(pvNivel(p.consentimento, "marketing"))} visualizações` },
    ],
    semanas: p.semanas.map((s) => {
      const tot = s.essenciais + s.analytics + s.marketing || 1;
      return {
        rotulo: rotuloSemana(s.semana_inicio),
        essenciais: Math.round((100 * s.essenciais) / tot),
        analytics: Math.round((100 * s.analytics) / tot),
        marketing: Math.round((100 * s.marketing) / tot),
      };
    }),
    liberacoes: LIBERACOES,
    regras: REGRAS,
    fontes: [
      { rotulo: "Coleta própria", estado: coletaBoa ? "bom" : "aviso", selo: coletaBoa ? "operando" : "sem sinal recente", nota: minColeta === null ? "sem eventos no período" : `último evento há ${minColeta} min` },
      { rotulo: "Google Tag", estado: "aviso", selo: "não conectada", nota: "integração não conectada" },
      { rotulo: "Microsoft Clarity", estado: "aviso", selo: "não conectada", nota: "integração não conectada" },
      { rotulo: "Sincronização com CRM", estado: "aviso", selo: "não conectada", nota: "integração não conectada" },
    ],
    horas,
    qualidade: [
      { l: "Páginas sem tracking", r: TRACO, sub: "o que não é medido não alerta" },
      { l: "Eventos rejeitados ou inválidos", r: TRACO },
      { l: "Possíveis duplicidades", r: TRACO },
      { l: "Imóveis sem código", r: TRACO },
      { l: "Leads sem sincronização com o CRM", r: TRACO, sub: "fonte do CRM ainda não ligada" },
    ],
    atribuicao: [
      { l: "Cobertura de UTMs", r: p.cobertura_utm === null ? TRACO : `${String(p.cobertura_utm).replace(".", ",")}%` },
      { l: "Volume não atribuído", r: TRACO },
      { l: "UTMs ausentes em anúncios ativos", r: TRACO },
      { l: "Erros de sincronização · 24 h", r: TRACO },
      { l: "Última verificação", r: hhmm(p.atualizado_em) },
    ],
    eventos: p.eventos_por_tipo.map((e) => e.evento),
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só para Storybook/teste. NUNCA é usado na rota de produção. */
export const demoPrivacidade: Dados = {
  totalPageviews: 24_618,
  niveis: [
    { rotulo: "Somente essenciais", pct: 61, cor: "#1F1C1A", foot: "15.017 visualizações" },
    { rotulo: "Analytics", pct: 31, cor: "#66009A", foot: "7.632 visualizações · habilita GA4 e gravação" },
    { rotulo: "Marketing", pct: 8, cor: "#CC5800", foot: "1.969 visualizações" },
  ],
  semanas: [
    { rotulo: "21–27 jul", essenciais: 55, analytics: 26, marketing: 7 },
    { rotulo: "28–3 ago", essenciais: 56, analytics: 28, marketing: 7 },
    { rotulo: "4–10 ago", essenciais: 54, analytics: 30, marketing: 8 },
    { rotulo: "11–17 ago", essenciais: 52, analytics: 32, marketing: 8 },
  ],
  liberacoes: LIBERACOES,
  regras: REGRAS,
  fontes: [
    { rotulo: "Coleta própria", estado: "bom", selo: "operando", nota: "último evento há 2 min" },
    { rotulo: "Google Tag", estado: "bom", selo: "operando", nota: "último evento há 6 min" },
    { rotulo: "Microsoft Clarity", estado: "aviso", selo: "atenção", nota: "sem evento há 3 h", diagnostico: true },
    { rotulo: "Sincronização com CRM", estado: "aviso", selo: "3 pendentes", nota: "2 erros nas últimas 24 h" },
  ],
  horas: [
    { altura: 52, cor: "#FFD3B0" }, { altura: 44, cor: "#FFD3B0" }, { altura: 38, cor: "#FFD3B0" }, { altura: 46, cor: "#FFD3B0" },
    { altura: 60, cor: "#FFD3B0" }, { altura: 72, cor: "#FF9A4D" }, { altura: 18, cor: "#F4A6A2", queda: true }, { altura: 70, cor: "#FF9A4D" },
    { altura: 78, cor: "#FF9A4D" }, { altura: 84, cor: "#FF7000" }, { altura: 76, cor: "#FF9A4D" }, { altura: 64, cor: "#FF9A4D" },
  ],
  qualidade: [
    { l: "Páginas sem tracking", r: "2", corR: "#B5700A", sub: "o que não é medido não alerta" },
    { l: "Eventos rejeitados ou inválidos", r: "118 (0,3%)" },
    { l: "Possíveis duplicidades", r: "42" },
    { l: "Imóveis sem código", r: "12", sub: "418 eventos em “não identificado”" },
    { l: "Leads sem sincronização com o CRM", r: "3", corR: "#D93E3E", sub: "desde 14 ago · crítico" },
  ],
  atribuicao: [
    { l: "Cobertura de UTMs", r: "74%" },
    { l: "Volume não atribuído", r: "11%", sub: "sem UTM 48% · sem consentimento 39% · referência perdida 13%" },
    { l: "UTMs ausentes em anúncios ativos", r: "3", sub: "41 leads sem origem por mês" },
    { l: "Erros de sincronização · 24 h", r: "2" },
    { l: "Última verificação", r: "hoje, 14:30" },
  ],
  eventos: [
    "page_view", "consent_update", "view_item", "view_inventory", "generate_lead", "whatsapp_click", "phone_click", "social_click",
    "sara_open", "sara_search", "sara_results", "sara_error", "favorite_toggle", "gallery_interaction", "property_search", "cta_click",
    "owner_cta_click", "form_start", "filter_change", "scroll_depth",
  ],
  atualizado: "14:30",
};
