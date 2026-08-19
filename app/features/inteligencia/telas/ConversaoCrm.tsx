"use client";

/* 5 · CONVERSÃO E CRM — artboard 5a. Agora lê dado real via
 * /api/inteligencia/conversao (RPC intel_conversao). Funil comercial (Funil 2.0),
 * SLA, backlog, negócios parados e conversão por corretor vêm do CRM. Tempos
 * entre etapas, motivos de perda detalhados, cortes e a jornada individual do
 * lead dependem de fontes ainda não ligadas -> —. Pipeline e valor fechado
 * seguem — (campo de valor ausente no Funil 2.0). Demo virou fixture. */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes, Valor } from "../dado";
import { Cabecalho, Funil, type Etapa } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ConversaoPayload } from "../../../lib/inteligencia/tipos";

type Dados = {
  primeiroAtendimento: number | null; semAtendimento: number | null; parados: number | null; taxaPerda: number | null;
  pipelineValor: number | null; valorFechado: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string; perdaFinal?: boolean }[];
  corretores: { iniciais: string; nome: string; negocios: number | null; contato: string; tomContato: "ambar" | "vermelho" | "verde"; visitas: number | null; fechados: number | null; conv: number | null }[];
  atualizado: string;
};

const iniciaisDe = (nome: string) => nome.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function ConversaoCrm({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<ConversaoPayload>("conversao", accessToken, recorte);
  const d = mapearConversao(leitura.payload);

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome, largura: e.largura, volume: e.volume, volumeTexto: fmt.inteiro(e.volume), taxa: e.taxa, perda: e.perda, perdaFinal: e.perdaFinal,
    detalhes: () => recorte.filtrar(`Etapa: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <div className="int-duas par-125">
        <div className="int-col">
          <Cabecalho eyebrow="FUNIL COMERCIAL" titulo="Do lead recebido à chave na mão" cor="#8B00CC" nota="escopo: Funil 2.0 (operação)" />
          <Funil etapas={etapas} foot="volumes reais do Funil 2.0 · a taxa entre etapas e os motivos de perda detalhados entram quando o histórico de transição for agregado" />

          <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Espera do lead · mediana</span><Valor bruto={d.primeiroAtendimento} texto={fmt.duracaoMin(d.primeiroAtendimento)} /><small className="intp-kpi-foot">tempo esperando resposta do corretor</small></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Leads sem atendimento</span><Valor bruto={d.semAtendimento} texto={fmt.inteiro(d.semAtendimento)} tom="ruim" /><button type="button" className="int-link" style={{ fontWeight: 700, alignSelf: "flex-start" }} onClick={() => recorte.irPara("atendimento")}>Abrir fila de ação →</button></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Negócios parados</span><Valor bruto={d.parados} texto={fmt.inteiro(d.parados)} tom="atencao" /><small className="intp-kpi-foot">sem movimento há 7+ dias</small></div>
            <div className="intp-kpi"><span className="intp-kpi-rotulo">Taxa de perda</span><Valor bruto={d.taxaPerda} texto={fmt.porcento(d.taxaPerda, 1)} motivo="amostra" detalhe="poucos negócios fechados no período" /><small className="intp-kpi-foot">perdidos sobre negócios</small></div>
          </div>

          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Conversão por corretor</span>
            <table className="intp-tabela">
              <thead><tr><th>Corretor</th><th className="num">Negócios abertos</th><th className="num">Vendas</th><th className="num">Conv.</th></tr></thead>
              <tbody>
                {d.corretores.map((c) => (
                  <tr key={c.nome} onClick={() => recorte.filtrar(`Corretor: ${c.nome}`)}>
                    <td data-rotulo="Corretor" className="forte">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 999, background: "#F7ECFC", color: "#66009A", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>{c.iniciais}</span>
                        {c.nome}
                      </span>
                    </td>
                    <td data-rotulo="Negócios abertos" className="num">{fmt.inteiro(c.negocios)}</td>
                    <td data-rotulo="Vendas" className="num">{fmt.inteiro(c.fechados)}</td>
                    <td data-rotulo="Conv." className="num forte">{fmt.porcento(c.conv, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="intp-kpi-foot">tempo de 1º contato por corretor entra junto com o histórico de mensagens</small>
          </div>

          <div className="intp-cartao" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "16px 18px", flexWrap: "wrap" }}>
            <span className="intp-tile tile-ambar">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12h.01M2 10h20" /></svg>
            </span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="intp-cartao-titulo">Pipeline e valor fechado</span>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6E6760", lineHeight: 1.5 }}>Aparecem quando o campo de valor do negócio existir no Funil 2.0. Sem campo confiável, não mostramos número — nem zero. Pipeline {fmt.dinheiro(d.pipelineValor)} · valor fechado {fmt.dinheiro(d.valorFechado)}.</p>
            </div>
            <span className="int-pendencia" style={{ flex: "none" }}>aguardando dado do CRM</span>
          </div>
        </div>

        <div className="int-col">
          <Cabecalho eyebrow="JORNADA INDIVIDUAL" titulo="Um lead, do primeiro clique ao resultado" cor="#8B00CC" />
          <div className="intp-cartao" style={{ gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "#6E6760", lineHeight: 1.55 }}>
              A jornada individual cruza os eventos do site (primeiro clique, busca, WhatsApp) com o histórico do lead no Funil 2.0. Esse cruzamento depende do vínculo lead do site ↔ negócio, que hoje quase não existe (o site praticamente não alimenta o CRM). Quando o lead do site passar a cair no Funil 2.0 com o identificador, a linha do tempo por lead aparece aqui — sem IP bruto, sem user agent, só o que serve para atender.
            </p>
            <button type="button" className="int-btn" style={{ alignSelf: "flex-start", height: 34, fontSize: 12 }} onClick={() => recorte.irPara("atendimento")}>Abrir a fila no Funil 2.0</button>
          </div>
          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Como o perfil Corretor vê esta área</span>
            <p style={{ margin: 0, fontSize: 12, color: "#4D4842", lineHeight: 1.5 }}>“Você vê os números agregados. O detalhe por pessoa depende de permissão de dados pessoais.”</p>
          </div>
        </div>
      </div>

      <RodapeFontes
        fontes={["leads", "negócios (Funil 2.0)", "wa_mensagens", "visitas", "vendas"]}
        pendencias={["tempos entre etapas e motivos de perda (histórico de transição)", "valor de pipeline/fechado (campo ausente no CRM)", "jornada individual (vínculo site↔CRM)"]}
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

const vazioConversao: Dados = {
  primeiroAtendimento: null, semAtendimento: null, parados: null, taxaPerda: null, pipelineValor: null, valorFechado: null,
  etapas: [], corretores: [], atualizado: "—",
};

function mapearConversao(p: ConversaoPayload | null): Dados {
  if (!p) return vazioConversao;
  const total = p.negocios + p.ganho + p.perdido;
  const maxV = Math.max(1, p.leads, ...p.etapas.map((e) => e.volume), p.perdido);

  const etapas = [
    { nome: "Lead recebido", volume: p.leads, largura: 100, taxa: "100%" as string | undefined },
    ...p.etapas.map((e) => ({ nome: e.etapa, volume: e.volume, largura: Math.round((100 * e.volume) / maxV), taxa: undefined as string | undefined })),
    { nome: "Ganho", volume: p.ganho, largura: Math.round((100 * p.ganho) / maxV), taxa: undefined as string | undefined },
  ];
  const etapasFull = [...etapas, { nome: "Perdido", volume: p.perdido, largura: Math.round((100 * p.perdido) / maxV), taxa: undefined as string | undefined, perdaFinal: true }];

  return {
    primeiroAtendimento: p.sla_mediana_min,
    semAtendimento: p.sem_atendimento,
    parados: p.parados,
    taxaPerda: total > 0 ? Math.round((1000 * p.perdido) / total) / 10 : null,
    pipelineValor: null,
    valorFechado: null,
    etapas: etapasFull,
    corretores: p.corretores.map((c) => ({
      iniciais: iniciaisDe(c.nome), nome: c.nome, negocios: c.negocios, contato: "—", tomContato: "ambar", visitas: null, fechados: c.vendas, conv: c.conv,
    })),
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoConversao: Dados = {
  primeiroAtendimento: 18, semAtendimento: 9, parados: 21, taxaPerda: 39.6, pipelineValor: null, valorFechado: null,
  etapas: [{ nome: "Lead recebido", volume: 312, largura: 100, taxa: "100%" }, { nome: "Perdido", volume: 74, largura: 24, perdaFinal: true }],
  corretores: [{ iniciais: "AB", nome: "Ana Beatriz", negocios: 52, contato: "9 min", tomContato: "ambar", visitas: 28, fechados: 5, conv: 9.6 }],
  atualizado: "14:28",
};
