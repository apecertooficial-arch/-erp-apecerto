"use client";

/* 5 · CONVERSÃO E CRM — artboard 5a, com FUNIL E JORNADA na mesma faixa.
 *
 * Estrutura do desenho (1,25fr · 1fr):
 *   ESQUERDA
 *     1. funil comercial de 9 etapas, com “perdido” fechando a lista
 *     2. quatro indicadores do atendimento (tempo, fila, parados, taxa de perda)
 *     3. tempos medianos entre etapas em barras roxas · motivos de perda
 *     4. conversão por corretor · conversão por corte (comprador, locatário,
 *        proprietário, campanha, imóvel)
 *     5. faixa “Pipeline e valor fechado”, com o selo de dado ausente
 *   DIREITA
 *     6. jornada individual do lead, do primeiro clique ao resultado
 *     7. “Como o perfil Corretor vê esta área”, com “Solicitar acesso”
 *   8. rodapé de fontes
 *
 * Pipeline e valor fechado não são calculados: o campo de valor não existe no
 * Funil 2.0, então nascem “—” com o motivo — nunca zero fictício.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, TRACO, Valor } from "../dado";
import { Cabecalho, Funil, LinhaDoTempo, type Etapa } from "../pecas";

type Jornada = { titulo: string; quando: string; cor: string };

type Dados = {
  primeiroAtendimento: number | null;
  semAtendimento: number | null;
  parados: number | null;
  taxaPerda: number | null;
  variacaoPerda: number | null;
  pipelineValor: number | null;
  valorFechado: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string; perdaFinal?: boolean }[];
  tempos: { l: string; r: string; largura: number }[];
  motivos: { l: string; r: string; outros?: boolean }[];
  perdidos: number | null;
  corretores: { iniciais: string; nome: string; negocios: number | null; contato: string; tomContato: "ambar" | "vermelho" | "verde"; visitas: number | null; fechados: number | null; conv: number | null }[];
  cortes: { l: string; leads: number | null; negocios: number | null; conv: number | null }[];
  lead: { nome: string; iniciais: string; papel: string; entrada: string; corretora: string; consentimento: string; jornada: Jornada[]; contato: string; etapa: string };
  atualizado: string;
};

const CORES_CONTATO = { verde: "#1E7A46", ambar: "#B5700A", vermelho: "#D93E3E" } as const;

export function ConversaoCrm({ recorte }: PropsTela) {
  const d = usarDados();
  const [motivoAberto, setMotivoAberto] = useState<string | null>(null);

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    perdaFinal: e.perdaFinal,
    detalhes: () => recorte.filtrar(`Etapa: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <div className="int-duas par-125">
        {/* ESQUERDA — funil, indicadores, tempos, cortes */}
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL COMERCIAL" titulo="Do lead recebido à chave na mão" cor="#8B00CC" />
          <Funil etapas={etapas} foot="taxa sobre a etapa anterior · perdido = % dos negócios criados · “detalhes” lista as pessoas da etapa, conforme permissão" />

          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Tempo até 1º atendimento</span>
              <Valor bruto={d.primeiroAtendimento} texto={fmt.duracaoMin(d.primeiroAtendimento)} />
              <small className="intp-kpi-foot">mediana · meta 5 min</small>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Leads sem atendimento</span>
              <Valor bruto={d.semAtendimento} texto={fmt.inteiro(d.semAtendimento)} tom="ruim" />
              <button type="button" className="int-link" style={{ fontWeight: 700, alignSelf: "flex-start" }} onClick={() => recorte.irPara("atendimento")}>Abrir fila de ação →</button>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Negócios parados</span>
              <Valor bruto={d.parados} texto={fmt.inteiro(d.parados)} tom="atencao" />
              <small className="intp-kpi-foot">sem movimento há 7+ dias</small>
            </div>
            <div className="intp-kpi">
              <span className="intp-kpi-rotulo">Taxa de perda</span>
              <Valor bruto={d.taxaPerda} texto={fmt.porcento(d.taxaPerda)} />
              <span className="intp-kpi-chip tom-ruim">{fmt.pontos(d.variacaoPerda)} vs. anterior</span>
            </div>
          </div>

          <div className="intp-grade" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Tempo mediano entre etapas</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {d.tempos.map((t) => (
                  <div key={t.l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 168, fontWeight: 600, color: "#4D4842" }}>{t.l}</span>
                    <span style={{ flex: 1, height: 8, borderRadius: 999, background: "#F2EFEC" }}>
                      <span style={{ display: "block", height: "100%", borderRadius: 999, background: "#B24DDD", width: `${t.largura}%` }} />
                    </span>
                    <b style={{ width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.r}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">
                Motivos de perda <small style={{ fontWeight: 600, color: "#9A938B" }}>· {fmt.inteiro(d.perdidos)} negócios</small>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {d.motivos.map((m) => (
                  <button
                    key={m.l}
                    type="button"
                    className="intp-linha-btn"
                    onClick={() => {
                      setMotivoAberto(m.l);
                      recorte.filtrar(`Motivo: ${m.l}`);
                    }}
                  >
                    <div className="intp-linha-kv">
                      <span style={m.outros ? { color: "#9A938B" } : undefined}>{m.l}</span>
                      <b style={m.outros ? { color: "#6E6760" } : undefined}>{m.r}</b>
                    </div>
                    {motivoAberto === m.l ? <small className="intp-linha-sub">recorte aplicado à página</small> : null}
                  </button>
                ))}
              </div>
              <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>clicar em um motivo lista os negócios</small>
            </div>
          </div>

          <div className="intp-grade" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Conversão por corretor</span>
              <table className="intp-tabela">
                <thead>
                  <tr>
                    <th>Corretor</th>
                    <th className="num">Negócios</th>
                    <th className="num">1º contato</th>
                    <th className="num">Visitas</th>
                    <th className="num">Fechados</th>
                    <th className="num">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {d.corretores.map((c) => (
                    <tr key={c.nome} onClick={() => recorte.filtrar(`Corretor: ${c.nome}`)}>
                      <td data-rotulo="Corretor" className="forte">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 999, background: "#F7ECFC", color: "#66009A", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>{c.iniciais}</span>
                          {c.nome}
                        </span>
                      </td>
                      <td data-rotulo="Negócios" className="num">{fmt.inteiro(c.negocios)}</td>
                      <td data-rotulo="1º contato" className="num forte" style={{ color: CORES_CONTATO[c.tomContato] }}>{c.contato}</td>
                      <td data-rotulo="Visitas" className="num">{fmt.inteiro(c.visitas)}</td>
                      <td data-rotulo="Fechados" className="num">{fmt.inteiro(c.fechados)}</td>
                      <td data-rotulo="Conv." className="num forte">{fmt.porcento(c.conv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <small className="intp-kpi-foot">1º contato = mediana · verde ≤5 min (meta) · âmbar 5–15 min · vermelho acima de 15 min</small>
            </div>

            <div className="intp-cartao">
              <span className="intp-cartao-titulo">Conversão por corte</span>
              <table className="intp-tabela">
                <thead>
                  <tr>
                    <th>Corte</th>
                    <th className="num">Leads</th>
                    <th className="num">Negócios</th>
                    <th className="num">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cortes.map((c) => (
                    <tr key={c.l} onClick={() => recorte.filtrar(`Corte: ${c.l}`)}>
                      <td data-rotulo="Corte" className="forte">{c.l}</td>
                      <td data-rotulo="Leads" className="num">{fmt.inteiro(c.leads)}</td>
                      <td data-rotulo="Negócios" className="num">{fmt.inteiro(c.negocios)}</td>
                      <td data-rotulo="Conv." className="num forte">{fmt.porcento(c.conv, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <small className="intp-kpi-foot" style={{ marginTop: "auto" }}>trocar o corte: tipo de lead · campanha · imóvel</small>
            </div>
          </div>

          <div className="intp-cartao" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "16px 18px", flexWrap: "wrap" }}>
            <span className="intp-tile tile-ambar">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M16 12h.01M2 10h20" />
              </svg>
            </span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="intp-cartao-titulo">Pipeline e valor fechado</span>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6E6760", lineHeight: 1.5 }}>
                Aparecem quando o campo de valor do negócio existir no Funil 2.0. Sem campo confiável, não mostramos número — nem zero. Pipeline {fmt.dinheiro(d.pipelineValor)} · valor fechado {fmt.dinheiro(d.valorFechado)}.
              </p>
            </div>
            <span className="int-pendencia" style={{ flex: "none" }}>aguardando dado do CRM</span>
          </div>
        </div>

        {/* DIREITA — jornada individual e o recorte do perfil Corretor */}
        <div className="int-col">
          <Cabecalho eyebrow="JORNADA INDIVIDUAL" titulo="Um lead, do primeiro clique ao resultado" cor="#8B00CC" />
          <div className="intp-cartao" style={{ boxShadow: "0 8px 24px rgba(31,28,26,0.10)", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 999, background: "#F7ECFC", color: "#66009A", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>{d.lead.iniciais}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{d.lead.nome}</b>
                <small style={{ display: "block", fontSize: 11, color: "#9A938B" }}>
                  {d.lead.papel} · entrou {d.lead.entrada} · {d.lead.corretora}
                </small>
              </div>
              <span className="intp-cartao-chip tom-roxo" style={{ flex: "none" }}>{d.lead.consentimento}</span>
            </div>

            <LinhaDoTempo eventos={d.lead.jornada} />

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="intp-detalhe-linha"><span>Tempo até o primeiro contato</span><b>{d.lead.contato}</b></div>
              <div className="intp-detalhe-linha"><span>Etapa atual</span><b>{d.lead.etapa}</b></div>
              <div className="intp-detalhe-linha"><span>Valor do negócio</span><b>{TRACO}</b></div>
              <div className="intp-detalhe-linha"><span>Telefone e e-mail</span><b>{TRACO}</b></div>
            </div>

            <div style={{ background: "#FAF8F6", borderRadius: 12, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#66009A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }} aria-hidden="true">
                <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <small style={{ fontSize: 11, color: "#6E6760", lineHeight: 1.5 }}>
                Sem IP bruto, sem user agent, sem identificador técnico — só o que serve para atender bem a pessoa. Telefone, e-mail e valor do negócio dependem de permissão e do campo no CRM, e ficam com “—”.
              </small>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="int-btn" onClick={() => recorte.irPara("atendimento")}>Abrir a ficha no Funil 2.0</button>
              <button type="button" className="int-link" style={{ fontWeight: 700 }} onClick={() => recorte.filtrar(`Lead: ${d.lead.nome}`)}>Filtrar a página por este lead</button>
            </div>
          </div>

          <div className="intp-cartao">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#66009A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span className="intp-cartao-titulo">Como o perfil Corretor vê esta área</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#4D4842", lineHeight: 1.5 }}>
              “Você vê os números agregados. O detalhe por pessoa depende de permissão de dados pessoais.”
            </p>
            <button type="button" className="int-btn" style={{ alignSelf: "flex-start", height: 34, fontSize: 12 }} onClick={() => recorte.irPara("privacidade")}>Solicitar acesso</button>
          </div>
        </div>
      </div>

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "motivos de perda", "visitas"]}
        pendencias={["valor de pipeline e valor fechado (campo ausente no CRM)", "dados pessoais do lead dependem de permissão"]}
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
  primeiroAtendimento: 18,
  semAtendimento: 9,
  parados: 21,
  taxaPerda: 39.6,
  variacaoPerda: 2.1,
  pipelineValor: null,
  valorFechado: null,
  perdidos: 74,
  etapas: [
    { nome: "Lead recebido", volume: 312, largura: 100, taxa: "100%" },
    { nome: "Negócio criado", volume: 187, largura: 60, taxa: "59,9%", perda: "−125" },
    { nome: "Distribuído para corretor", volume: 183, largura: 59, taxa: "97,9%", perda: "−4" },
    { nome: "Primeiro contato", volume: 164, largura: 53, taxa: "89,6%", perda: "−19" },
    { nome: "Qualificado", volume: 128, largura: 41, taxa: "78,0%", perda: "−36" },
    { nome: "Visita agendada", volume: 96, largura: 31, taxa: "75,0%", perda: "−32" },
    { nome: "Proposta", volume: 31, largura: 10, taxa: "32,3%", perda: "−65" },
    { nome: "Venda ou locação", volume: 14, largura: 5, taxa: "45,2%", perda: "−17" },
    { nome: "Perdido", volume: 74, largura: 24, taxa: "39,6%", perda: "motivos ↓", perdaFinal: true },
  ],
  tempos: [
    { l: "Lead → negócio", r: "11 min", largura: 4 },
    { l: "Negócio → distribuição", r: "4 min", largura: 2 },
    { l: "Distribuição → 1º contato", r: "18 min", largura: 7 },
    { l: "1º contato → qualificado", r: "1,4 d", largura: 24 },
    { l: "Qualificado → visita", r: "2,8 d", largura: 46 },
    { l: "Visita → proposta", r: "5,2 d", largura: 72 },
    { l: "Proposta → fechamento", r: "8,5 d", largura: 100 },
  ],
  motivos: [
    { l: "Sem resposta", r: "26" },
    { l: "Preço acima do orçamento", r: "18" },
    { l: "Fechou com outra imobiliária", r: "12" },
    { l: "Adiou a mudança", r: "10" },
    { l: "Outros", r: "8", outros: true },
  ],
  corretores: [
    { iniciais: "AB", nome: "Ana Beatriz", negocios: 52, contato: "9 min", tomContato: "ambar", visitas: 28, fechados: 5, conv: 9.6 },
    { iniciais: "CM", nome: "Carlos Mendes", negocios: 48, contato: "14 min", tomContato: "ambar", visitas: 26, fechados: 4, conv: 8.3 },
    { iniciais: "FL", nome: "Fernanda Lima", negocios: 45, contato: "22 min", tomContato: "vermelho", visitas: 23, fechados: 3, conv: 6.7 },
    { iniciais: "RS", nome: "Rafael Souza", negocios: 38, contato: "41 min", tomContato: "vermelho", visitas: 19, fechados: 2, conv: 5.3 },
  ],
  cortes: [
    { l: "Comprador", leads: 208, negocios: 131, conv: 63 },
    { l: "Locatário", leads: 81, negocios: 47, conv: 58 },
    { l: "Proprietário", leads: 23, negocios: 9, conv: 39 },
    { l: "Campanha: moema-prontos-ago", leads: 32, negocios: 23, conv: 72 },
    { l: "Imóvel: Apê Canário 71", leads: 38, negocios: 26, conv: 68 },
  ],
  lead: {
    nome: "Mariana C.",
    iniciais: "M",
    papel: "compradora",
    entrada: "12 ago, 14:07",
    corretora: "corretora Ana Beatriz",
    consentimento: "consentiu Analytics",
    contato: "9 min",
    etapa: "Visita agendada",
    jornada: [
      { titulo: "Chegou pelo Instagram (bio)", quando: "12 ago 13:52 · entrou pela home", cor: "#FF9A4D" },
      { titulo: "Buscou imóveis", quando: "13:55 · Moema · 2 dorms · até R$ 5.500/mês", cor: "#FF9A4D" },
      { titulo: "Abriu o Apê Canário 71 · MO-104", quando: "13:58 · viu 12 fotos da galeria · leu até o fim da página", cor: "#FF9A4D" },
      { titulo: "Chamou no WhatsApp", quando: "14:05 · na página do imóvel", cor: "#FF7000" },
      { titulo: "Virou lead e entrou no Funil 2.0", quando: "14:07 · negócio #4812 criado automaticamente", cor: "#8B00CC" },
      { titulo: "Distribuída para Ana Beatriz", quando: "14:11 · regra de rodízio da equipe", cor: "#8B00CC" },
      { titulo: "Primeiro contato em 9 minutos", quando: "14:16 · 4 min acima da meta de 5 min", cor: "#B5700A" },
      { titulo: "Visita agendada", quando: "15 ago · sábado, 10h · em atendimento", cor: "#1FA85A" },
    ],
  },
  atualizado: "14:28",
};
