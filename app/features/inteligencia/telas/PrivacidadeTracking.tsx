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

import { useMemo } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, ChipsEventos } from "../pecas";
import { useResumoInteligencia, type Tracking360Resumo } from "../usar-resumo";

type Estado = "bom" | "aviso";

type Dados = {
  totalObservado: number | null;
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
  const d = useDados(accessToken, recorte.periodo);

  return (
    <div className="int-secao">
      <div className="intp-grade" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        {/* ESQUERDA — consentimento */}
        <div className="int-col">
          <Cabecalho eyebrow="CONSENTIMENTO" titulo="O que as pessoas escolheram" nota={`${recorte.periodo} · ${fmt.inteiro(d.totalObservado)} sessões observadas`} />
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
              volume real recebido por hora; horário sem barra significa ausência de eventos, não ausência de visitantes
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
        pendencias={["saúde do Google Tag exige API externa", "Clarity ainda sem telemetria no ERP", "inventário automático de páginas ainda não conectado"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function pct(value: number | undefined, total: number | undefined) {
  return total && total > 0 ? (100 * (value ?? 0)) / total : null;
}

function useDados(accessToken: string, periodo: string): Dados {
  const { data } = useResumoInteligencia(accessToken, periodo);
  return useMemo(() => montarDados(data), [data]);
}

function montarDados(resumo: Tracking360Resumo | null): Dados {
  const health = resumo?.digital_health;
  const consent = health?.consent;
  const total = consent?.total;
  const maxHour = Math.max(1, ...(health?.hours_today ?? []).map((item) => item.eventos));
  const lastEvent = health?.quality?.last_event_at ? new Date(health.quality.last_event_at) : null;
  const minutesSinceLast = lastEvent ? Math.max(0, Math.round((Date.now() - lastEvent.getTime()) / 60_000)) : null;
  const attributionTotal = health?.attribution?.total;
  const delivery = resumo?.delivery_health;
  const deliveryProblems = (delivery?.failed ?? 0) + (delivery?.blocked ?? 0);

  return {
  totalObservado: total ?? null,
  niveis: [
    { rotulo: "Somente essenciais", pct: pct(consent?.essential, total), cor: "#1F1C1A", foot: `${fmt.inteiro(consent?.essential ?? null)} sessões` },
    { rotulo: "Analytics", pct: pct(consent?.analytics, total), cor: "#66009A", foot: `${fmt.inteiro(consent?.analytics ?? null)} sessões observadas` },
    { rotulo: "Marketing", pct: pct(consent?.marketing, total), cor: "#CC5800", foot: `${fmt.inteiro(consent?.marketing ?? null)} sessões observadas` },
  ],
  semanas: (health?.weeks ?? []).map((week) => ({
    rotulo: new Date(`${week.inicio}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    essenciais: pct(week.essential, week.total) ?? 0,
    analytics: pct(week.analytics, week.total) ?? 0,
    marketing: pct(week.marketing, week.total) ?? 0,
  })),
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
    { rotulo: "Coleta própria", estado: minutesSinceLast !== null && minutesSinceLast <= 120 ? "bom" : "aviso", selo: minutesSinceLast !== null && minutesSinceLast <= 120 ? "operando" : "atenção", nota: minutesSinceLast === null ? "nenhum evento no período" : `último evento há ${minutesSinceLast} min` },
    { rotulo: "Google Tag", estado: "aviso", selo: "verificação externa", nota: "o banco não confirma entrega ao Google", diagnostico: true },
    { rotulo: "Microsoft Clarity", estado: "aviso", selo: "não conectado", nota: "sem telemetria de saúde no ERP", diagnostico: true },
    { rotulo: "Sincronização com CRM", estado: (health?.crm_sync?.errors ?? 0) > 0 ? "aviso" : "bom", selo: (health?.crm_sync?.errors ?? 0) > 0 ? `${health?.crm_sync?.errors} erros` : "operando", nota: `${health?.crm_sync?.pending ?? 0} pendentes no período` },
    { rotulo: "Meta CAPI", estado: deliveryProblems > 0 ? "aviso" : "bom", selo: deliveryProblems > 0 ? `${deliveryProblems} falhas` : "operando", nota: `${delivery?.delivered ?? 0} entregues · ${delivery?.pending ?? 0} em processamento`, diagnostico: deliveryProblems > 0 },
  ],
  horas: (health?.hours_today ?? []).map((hour) => ({ altura: Math.max(3, Math.round((100 * hour.eventos) / maxHour)), cor: hour.eventos > 0 ? "#FF9A4D" : "#EFECE7" })),
  qualidade: [
    { l: "Páginas sem tracking", r: "não mensurado", corR: "#B5700A", sub: "exige inventário de rotas publicado" },
    { l: "Eventos fora da lista permitida", r: fmt.inteiro(health?.quality?.invalid_events ?? null) },
    { l: "Possíveis duplicidades", r: fmt.inteiro(health?.quality?.possible_duplicates ?? null) },
    { l: "Eventos coletados", r: fmt.inteiro(health?.quality?.total_events ?? null) },
    { l: "Leads com erro de sincronização", r: fmt.inteiro(health?.crm_sync?.errors ?? null), corR: (health?.crm_sync?.errors ?? 0) > 0 ? "#D93E3E" : undefined },
    { l: "Entregas à Meta com falha", r: fmt.inteiro(deliveryProblems), corR: deliveryProblems > 0 ? "#D93E3E" : undefined, sub: delivery?.last_error ?? undefined },
  ],
  atribuicao: [
    { l: "Cobertura de origem", r: fmt.porcento(pct(health?.attribution?.with_source, attributionTotal), 0) },
    { l: "Cobertura de campanha", r: fmt.porcento(pct(health?.attribution?.with_campaign, attributionTotal), 0) },
    { l: "Leads com click ID", r: fmt.inteiro(health?.attribution?.with_click_id ?? null), sub: "gclid, gbraid, wbraid ou fbclid" },
    { l: "Volume não atribuído", r: fmt.inteiro(attributionTotal !== undefined ? Math.max(0, attributionTotal - (health?.attribution?.with_source ?? 0)) : null) },
    { l: "Última verificação", r: health?.updated_at ? new Date(health.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—" },
  ],
  eventos: health?.events ?? [],
  atualizado: health?.updated_at ? new Date(health.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—",
  };
}
