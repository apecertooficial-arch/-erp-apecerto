"use client";

/* 8 · PRIVACIDADE E QUALIDADE DO TRACKING — artboard 9a, em duas colunas.
 *
 * Estrutura do desenho:
 *   ESQUERDA · CONSENTIMENTO
 *     1. três níveis (essenciais · Analytics · Marketing)
 *     2. evolução das escolhas por semana, em barras empilhadas
 *     3. “o que cada nível libera” em tabela
 *     4. “regras que esta tela garante” em chips + nota jurídica
 *   DIREITA · SAÚDE TÉCNICA
 *     5. quatro fontes com selo de estado (fonte parada = atenção, nunca zero)
 *     6. eventos por hora, com a barra vermelha da queda às 9h
 *     7. qualidade dos eventos · atribuição
 *   8. lista fechada dos eventos coletados
 *   9. rodapé de fontes
 *
 * É a única tela autorizada a dizer “não confie ainda”. Nada fora da lista de
 * eventos aparece no painel como se já existisse.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, ChipsEventos } from "../pecas";

type Estado = "bom" | "aviso";

type Dados = {
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

export function PrivacidadeTracking({ recorte }: PropsTela) {
  const d = usarDados();

  return (
    <div className="int-secao">
      <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        {/* ESQUERDA — consentimento */}
        <div className="int-col">
          <Cabecalho eyebrow="CONSENTIMENTO" titulo="O que as pessoas escolheram" nota={`${recorte.periodo} · 24.618 visualizações no total`} />
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
              barra vermelha = queda brusca às 9h (instabilidade do site) — o alerta dispara sozinho e aparece como anotação nas outras páginas
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
              <small className="intp-kpi-foot">lead sem sincronizar vira alerta crítico com dono — evento inválido não é corrigido no escuro, entra na contagem de rejeitados</small>
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
      <ChipsEventos titulo={`Eventos coletados hoje · ${d.eventos.length}`} itens={d.eventos} foot="nada fora desta lista aparece no painel como se já existisse" />

      <RodapeFontes
        fontes={["coleta própria", "Google Tag", "fila de sincronização", "registro de consentimento"]}
        pendencias={["Clarity sem evento há 3 h", "3 leads sem sincronização com o CRM", "2 páginas sem tracking", "12 imóveis sem código", "UTMs ausentes em 3 anúncios"]}
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
  liberacoes: [
    { nivel: "Essencial", propria: "sim, sem cookie", tag: "não", clarity: "não", coletado: "página e ação, sem identificador persistente" },
    { nivel: "Analytics", propria: "sim", tag: "sim", clarity: "sim", coletado: "sessão, mapas de calor e gravações" },
    { nivel: "Marketing", propria: "sim", tag: "sim", clarity: "sim", coletado: "+ atribuição de campanha e remarketing" },
  ],
  regras: [
    "essencial sem cookies",
    "sem fingerprinting",
    "sem IP bruto",
    "sem user agent bruto",
    "eventos retidos 90 dias",
    "hash antifraude 48 h",
    "acesso restrito à equipe",
    "política de privacidade acessível",
  ],
  fontes: [
    { rotulo: "Coleta própria", estado: "bom", selo: "operando", nota: "último evento há 2 min" },
    { rotulo: "Google Tag", estado: "bom", selo: "operando", nota: "último evento há 6 min" },
    { rotulo: "Microsoft Clarity", estado: "aviso", selo: "atenção", nota: "sem evento há 3 h", diagnostico: true },
    { rotulo: "Sincronização com CRM", estado: "aviso", selo: "3 pendentes", nota: "2 erros nas últimas 24 h" },
  ],
  horas: [
    { altura: 52, cor: "#FFD3B0" },
    { altura: 44, cor: "#FFD3B0" },
    { altura: 38, cor: "#FFD3B0" },
    { altura: 46, cor: "#FFD3B0" },
    { altura: 60, cor: "#FFD3B0" },
    { altura: 72, cor: "#FF9A4D" },
    { altura: 18, cor: "#F4A6A2", queda: true },
    { altura: 70, cor: "#FF9A4D" },
    { altura: 78, cor: "#FF9A4D" },
    { altura: 84, cor: "#FF7000" },
    { altura: 76, cor: "#FF9A4D" },
    { altura: 64, cor: "#FF9A4D" },
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
