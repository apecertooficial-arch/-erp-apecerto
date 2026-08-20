"use client";

/* 17 · CENTRAL DE ALERTAS — artboard 21a. Agora lê dado real via
 * /api/inteligencia/alertas (RPC intel_alertas). A central é SINTETIZADA dos
 * sinais operacionais reais (SLA, follow-ups, negócios parados, visitas sem
 * feedback, vendas sem comissão, metas sem cadastro). O motor crm_lead_alertas
 * ainda é nascente; tipos sem fonte aparecem com —. */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt, RodapeFontes } from "../dado";
import { EsqueletoAviso, EsqueletoCartoes, EsqueletoKpis } from "../esqueleto";
import { Cabecalho, CartoesLista, GradeKpis, IconeInt, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { AlertasPayload } from "../../../lib/inteligencia/tipos";

type Alerta = { chave: string; titulo: string; impacto: string; responsavel: string | null; acao: string; botao: string; alvo: string };

type Dados = {
  criticos: number | null; atencao: number | null; reconhecidos: number | null; resolvidos: number | null; totalAbertos: number | null;
  notaCriticos: string; notaAtencao: string; notaReconhecidos: string; notaResolvidos: string;
  alertas: Alerta[]; tipos: { l: string; r: string }[]; atualizado: string;
};

export function CentralAlertas({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<AlertasPayload>("alertas", accessToken, recorte);

  if (leitura.estado === "carregando") {
    return <div className="int-secao"><EsqueletoAviso texto="Atualizando os sinais operacionais." /><EsqueletoKpis colunas={4} /><EsqueletoCartoes colunas={3} linhas={3} /></div>;
  }
  if (leitura.estado === "erro") {
    return <div className="int-secao"><BlocoSemDado titulo="Não foi possível atualizar os sinais" motivo="fonte" detalhe={`${leitura.erro ?? "A fonte não respondeu."} Nenhum sinal anterior foi exibido como atual.`} /></div>;
  }
  const d = mapearAlertas(leitura.payload);

  const kpis: Kpi[] = [
    { rotulo: "Críticos abertos", bruto: d.criticos, texto: fmt.inteiro(d.criticos), tom: "ruim", tile: "vermelho", foot: d.notaCriticos },
    { rotulo: "Atenção", bruto: d.atencao, texto: fmt.inteiro(d.atencao), tom: "atencao", tile: "ambar", foot: d.notaAtencao },
    { rotulo: "Reconhecidos no motor", bruto: d.reconhecidos, texto: fmt.inteiro(d.reconhecidos), tile: "roxo", foot: d.notaReconhecidos },
    { rotulo: "Resolvidos no motor", bruto: d.resolvidos, texto: fmt.inteiro(d.resolvidos), tom: "bom", tile: "verde", foot: d.notaResolvidos },
  ];

  const abertos = d.alertas;

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="SINAIS OPERACIONAIS" titulo="Condições reais que merecem investigação" nota={`${fmt.inteiro(d.totalAbertos)} sinais no total`} />
      <GradeKpis itens={kpis} colunas={4} />

      <Cabecalho eyebrow="LEITURA ATUAL" titulo={`Os ${abertos.length} sinais prioritários`} cor="#8B00CC" nota="somente leitura · a ação acontece no módulo de origem" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {abertos.map((a) => (
          <div className="intp-cartao" key={a.chave} style={{ padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "78px 1fr 150px 168px auto", gap: 12, alignItems: "center" }}>
              <span className="intp-cartao-chip tom-ruim" style={{ justifySelf: "start" }}>crítico</span>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{a.titulo}</b>
                <small style={{ display: "block", fontSize: 11.5, color: "#9A938B", lineHeight: 1.45 }}>
                  impacto: {a.impacto} ·{" "}
                  <button type="button" className="int-link" style={{ fontSize: 11.5 }} onClick={() => recorte.filtrar(`Alerta: ${a.titulo}`)}>ver evidência</button>
                </small>
              </div>
              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#9A938B" }}>responsável</small>
                {a.responsavel === null ? <b style={{ fontSize: 12, color: "#D93E3E" }}>ninguém atribuído</b> : <b style={{ fontSize: 12 }}>{a.responsavel}</b>}
              </div>
              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#9A938B" }}>ação recomendada</small>
                <b style={{ fontSize: 12 }}>{a.acao}</b>
              </div>
              <button type="button" className="int-btn-primario" onClick={() => recorte.irPara(a.alvo)}>{a.botao}</button>
            </div>
          </div>
        ))}
        {abertos.length === 0 ? (
          <div className="intp-cartao" style={{ display: "flex", flexDirection: "row", gap: 10, alignItems: "center" }}>
            <span className="intp-tile tile-verde"><IconeInt nome="check" tamanho={15} /></span>
            <b style={{ fontSize: 13 }}>Nenhum sinal crítico foi identificado nas fontes disponíveis.</b>
          </div>
        ) : null}
      </div>
      <small className="intp-kpi-foot">esta tela identifica sinais; não cria, reconhece ou resolve alertas até existir persistência real no banco</small>

      <Cabecalho eyebrow="COBERTURA" titulo="Sinais por tipo" />
      <div className="intp-cartao">
        <span className="intp-cartao-titulo">Os {d.tipos.length} tipos consultados</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 14px" }}>
          {d.tipos.map((t) => (
            <div key={t.l} style={{ display: "flex", gap: 8, fontSize: 12, borderBottom: "1px solid #F7F5F2", paddingBottom: 4 }}>
              <span style={{ flex: 1, color: "#4D4842" }}>{t.l}</span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{t.r}</b>
            </div>
          ))}
        </div>
        <small className="intp-kpi-foot">tipo sem ocorrência aparece com 0 · tipo sem fonte aparece com —</small>
      </div>

      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Atendimento", linhas: [{ l: "Leads acima do SLA", r: "abrir →", abrir: () => recorte.irPara("atendimento") }, { l: "Mensagens sem retorno", r: "abrir →", abrir: () => recorte.irPara("atendimento") }], foot: "a ação acontece no Funil 2.0" },
          { titulo: "Financeiro e cadastro", linhas: [{ l: "Vendas sem % de comissão", r: "abrir →", abrir: () => recorte.irPara("financeiro") }, { l: "Metas sem cadastro", r: "abrir →", abrir: () => recorte.irPara("vendas") }], foot: "valores só para quem tem acesso financeiro" },
          { titulo: "Operação", linhas: [{ l: "Negócios parados", r: "abrir →", abrir: () => recorte.irPara("vendas") }, { l: "Visitas sem feedback", r: "abrir →", abrir: () => recorte.irPara("corretores") }], foot: "pessoa que pediu contato e ninguém viu é prioridade máxima" },
        ]}
      />

      <RodapeFontes
        fontes={["leads", "negócios", "vendas", "visitas", "wa_mensagens"]}
        pendencias={["motor de alertas (crm_lead_alertas) nascente", "cobertura de horário, repasses e sync sem fonte"]}
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

const vazioAlertas: Dados = {
  criticos: null, atencao: null, reconhecidos: null, resolvidos: null, totalAbertos: null,
  notaCriticos: "aguardando conexão", notaAtencao: "—", notaReconhecidos: "—", notaResolvidos: "—",
  alertas: [], tipos: [], atualizado: "—",
};

function mapearAlertas(p: AlertasPayload | null): Dados {
  if (!p) return vazioAlertas;
  const t = p.tipos;
  const criticos = t.sla_criticos + t.venda_sem_comissao;
  const atencao = t.followup + t.carga + t.meta_sem_cadastro;

  const candidatos: Alerta[] = [
    t.sla_criticos > 0 ? { chave: "sla", titulo: `${t.sla_criticos} leads acima do SLA sem resposta`, impacto: "leads esfriando · espera acima de 1 h", responsavel: null, acao: "atribuir e responder", botao: "Abrir Atendimento", alvo: "atendimento" } : null,
    t.venda_sem_comissao > 0 ? { chave: "com", titulo: `${t.venda_sem_comissao} vendas sem % de comissão`, impacto: "VGV sem cálculo de comissão nem contribuição", responsavel: "Financeiro", acao: "completar o cadastro", botao: "Abrir Financeiro", alvo: "financeiro" } : null,
    t.carga > 0 ? { chave: "carga", titulo: `${t.carga} corretores acima da capacidade`, impacto: "carteira acima do limite — risco de SLA", responsavel: null, acao: "redistribuir carteira", botao: "Abrir Corretores", alvo: "corretores" } : null,
    t.meta_sem_cadastro > 0 ? { chave: "meta", titulo: `${t.meta_sem_cadastro} corretores sem meta cadastrada`, impacto: "sem meta não há acompanhamento de resultado", responsavel: null, acao: "cadastrar metas", botao: "Abrir Vendas", alvo: "vendas" } : null,
    t.negocio_parado > 0 ? { chave: "parado", titulo: `${t.negocio_parado} negócios parados há mais de 7 dias`, impacto: "pipeline sem movimentação recente", responsavel: null, acao: "revisar e atualizar etapa", botao: "Abrir Vendas", alvo: "vendas" } : null,
  ].filter((a): a is Alerta => a !== null);

  return {
    criticos,
    atencao,
    reconhecidos: p.engine.reconhecidos,
    resolvidos: null,
    totalAbertos: criticos + atencao + t.negocio_parado,
    notaCriticos: `${t.sla_criticos} no SLA · ${t.venda_sem_comissao} de comissão`,
    notaAtencao: `${t.followup} follow-ups · ${t.carga} sobrecarga`,
    notaReconhecidos: "no motor de alertas",
    notaResolvidos: "resolvidos não são rastreados ainda",
    alertas: candidatos.slice(0, 5),
    tipos: [
      { l: "SLA de primeira resposta", r: fmt.inteiro(t.sla) },
      { l: "Follow-up vencido", r: fmt.inteiro(t.followup) },
      { l: "Mensagem sem retorno", r: fmt.inteiro(t.mensagem) },
      { l: "Negócio parado", r: fmt.inteiro(t.negocio_parado) },
      { l: "Visita sem feedback", r: fmt.inteiro(t.visita_sem_feedback) },
      { l: "Carga acima da capacidade", r: fmt.inteiro(t.carga) },
      { l: "Cobertura de horário", r: "—" },
      { l: "Queda de qualidade", r: "—" },
      { l: "Venda sem % de comissão", r: fmt.inteiro(t.venda_sem_comissao) },
      { l: "Repasse sem data", r: "—" },
      { l: "Lead sem sincronizar", r: "—" },
      { l: "UTM ausente em anúncio", r: "—" },
      { l: "Fonte de dado parada", r: fmt.inteiro(t.fonte_parada) },
      { l: "Meta sem cadastro", r: fmt.inteiro(t.meta_sem_cadastro) },
    ],
    atualizado: hhmm(p.atualizado_em),
  };
}
