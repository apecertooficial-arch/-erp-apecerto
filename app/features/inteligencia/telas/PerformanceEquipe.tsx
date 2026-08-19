"use client";

/* 11 · PERFORMANCE DA EQUIPE — artboard 16a. Agora lê dado real via
 * /api/inteligencia/equipe (RPC intel_equipe). Os 4 pilares e o rollup por equipe
 * vêm do CRM (Funil 2.0). Qualidade de conversa, cobertura de horário e presença
 * não têm fonte ligada -> — / barras vazias. Demo virou fixture. */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, IconeInt, Tabela, type NomeIcone } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { EquipePayload } from "../../../lib/inteligencia/tipos";

type LinhaPilar = { l: string; r: string; cor?: string; forte?: boolean };
type Criterio = { nome: string; nota: number | null; largura: number };
type Cobertura = { periodo: string; percentual: number | null; cor: string };

type Equipe = {
  nome: string; iniciais: string; leads: number | null; sla: number | null; mediana: number | null; p90: number | null;
  qualidade: number | null; amostra: number | null; leadVenda: number | null; vendas: number | null; vgv: number | null;
  vencidos: number | null; ajuda: string;
};

type Dados = {
  velocidade: LinhaPilar[]; cobertura: Cobertura[]; notaQualidade: number | null; amostraQualidade: number | null;
  criterios: Criterio[]; conversao: LinhaPilar[]; disciplina: LinhaPilar[]; equipes: Equipe[]; totais: string; atualizado: string;
};

const nota = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));

function Pilar({ numero, titulo, icone, tile, children, link }: {
  numero: number; titulo: string; icone: NomeIcone; tile: "laranja" | "roxo" | "verde" | "ambar";
  children: React.ReactNode; link: { rotulo: string; go: () => void };
}) {
  return (
    <div className="intp-cartao">
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span className={`intp-tile tile-${tile}`}><IconeInt nome={icone} tamanho={15} /></span>
        <span className="intp-cartao-titulo">{numero} · {titulo}</span>
      </div>
      {children}
      <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={link.go}>{link.rotulo}</button>
    </div>
  );
}

function Linhas({ itens }: { itens: LinhaPilar[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
      {itens.map((i) => (
        <div key={i.l} style={{ display: "flex", gap: 8, borderBottom: "1px solid #F7F5F2", paddingBottom: 4 }}>
          <span style={{ flex: 1, color: "#4D4842", fontWeight: 600 }}>{i.l}</span>
          <b style={{ fontVariantNumeric: "tabular-nums", color: i.cor ?? "#1F1C1A", fontWeight: i.forte ? 700 : 600 }}>{i.r}</b>
        </div>
      ))}
    </div>
  );
}

export function PerformanceEquipe({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<EquipePayload>("equipe", accessToken, recorte);
  const d = mapearEquipe(leitura.payload);

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="OS 4 PILARES" titulo="A empresa inteira, no período" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""} · sem nota geral única`} />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <Pilar numero={1} titulo="Velocidade e disponibilidade" icone="relogio" tile="ambar" link={{ rotulo: "Ver por corretor →", go: () => recorte.irPara("corretores") }}>
          <Linhas itens={d.velocidade} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", color: "#9A938B", marginTop: 4 }}>COBERTURA POR HORÁRIO</span>
          <span style={{ display: "flex", gap: 4 }}>
            {d.cobertura.map((c) => (
              <span key={c.periodo} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ display: "block", height: 7, borderRadius: 999, background: c.cor }} />
                <small style={{ fontSize: 9.5, color: "#9A938B", textAlign: "center" }}>{c.periodo} {fmt.porcento(c.percentual, 0)}</small>
              </span>
            ))}
          </span>
        </Pilar>

        <Pilar numero={2} titulo="Qualidade de atendimento" icone="faisca" tile="roxo" link={{ rotulo: "Abrir Qualidade →", go: () => recorte.irPara("qualidade") }}>
          <strong style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{nota(d.notaQualidade)}</strong>
          <small className="intp-kpi-foot">n = {fmt.inteiro(d.amostraQualidade)} avaliações · avaliação por IA aguardando conexão</small>
          <div>
            {d.criterios.map((c) => (
              <div className="intp-crit" key={c.nome} style={{ gridTemplateColumns: "104px 1fr 34px" }}>
                <span className="intp-crit-rot" style={{ fontSize: 11 }}>{c.nome}</span>
                <span className="intp-crit-trilha" style={{ height: 7 }}><span className="intp-crit-barra" style={{ height: 7, width: `${c.largura}%` }} /></span>
                <b className="intp-crit-nota" style={{ fontSize: 11.5 }}>{nota(c.nota)}</b>
              </div>
            ))}
          </div>
        </Pilar>

        <Pilar numero={3} titulo="Conversão e resultado" icone="tendencia" tile="verde" link={{ rotulo: "Abrir Vendas e previsão →", go: () => recorte.irPara("vendas") }}>
          <Linhas itens={d.conversao} />
        </Pilar>

        <Pilar numero={4} titulo="Disciplina de processo" icone="check" tile="laranja" link={{ rotulo: "Abrir Central de alertas →", go: () => recorte.irPara("alertas") }}>
          <Linhas itens={d.disciplina} />
        </Pilar>
      </div>

      <Cabecalho eyebrow="POR EQUIPE" titulo="Onde cada equipe precisa de ajuda" cor="#8B00CC" nota="clicar num pilar abre a visão por pessoa em Gerentes / Corretores" />
      <Tabela
        colunas={[
          { titulo: "Equipe" }, { titulo: "Leads", num: true }, { titulo: "% SLA", num: true }, { titulo: "1ª resp. med · P90" },
          { titulo: "Qualidade" }, { titulo: "Lead→venda", num: true }, { titulo: "Vendas · VGV" }, { titulo: "Follow-ups venc.", num: true }, { titulo: "Precisa de ajuda em" },
        ]}
        ordenadaEm="Leads"
        linhas={d.equipes.map((e) => ({
          chave: e.nome,
          abrir: () => recorte.irPara("gerentes"),
          celulas: [
            { texto: e.nome, forte: true },
            { texto: fmt.inteiro(e.leads), num: true },
            { texto: fmt.porcento(e.sla, 0), num: true, forte: true, cor: (e.sla ?? 100) < 20 ? "#D93E3E" : "#B5700A" },
            { texto: `${fmt.duracaoMin(e.mediana)} · ${fmt.duracaoMin(e.p90)}`, cor: (e.p90 ?? 0) > 120 ? "#D93E3E" : undefined },
            { texto: `${nota(e.qualidade)} (n=${fmt.inteiro(e.amostra)})` },
            { texto: fmt.porcento(e.leadVenda), num: true, forte: true },
            { texto: `${fmt.inteiro(e.vendas)} · ${fmt.dinheiro(e.vgv)}` },
            { texto: fmt.inteiro(e.vencidos), num: true, cor: (e.vencidos ?? 0) >= 30 ? "#D93E3E" : undefined },
            { texto: "", chip: e.ajuda, chipTom: "aviso" as const },
          ],
        }))}
        foot={`a linha abre a página do gerente · ${d.totais}`}
      />

      <div className="intp-cartao" style={{ background: "#FBF6FE", boxShadow: "none", border: "1px solid #EBD1F5" }}>
        <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>Regras de justiça (valem para toda a área)</span>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "#66009A" }}>
          ninguém é classificado com amostra menor que 8 avaliações · a comparação considera origem e qualidade dos leads, tipo, preço e finalidade do imóvel · volume de mensagens não pontua · lead duplicado ou inválido não penaliza · avaliações automatizadas são contestáveis e revisíveis · uso do ERP não é jornada de trabalho · ausência de registro nunca vira nota zero.
        </p>
      </div>

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "vendas", "comissões"]}
        pendencias={["qualidade de atendimento (avaliação por IA)", "escala/ponto e cobertura de horário não integrados"]}
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

const CRITERIOS = ["Cordialidade", "Clareza", "Escrita", "Condução", "Personalização", "Qualificação", "Objeções"];
const COBERTURA_PERIODOS = ["manhã", "tarde", "noite", "fds"];

function pilaresVazios(): Pick<Dados, "cobertura" | "criterios"> {
  return {
    cobertura: COBERTURA_PERIODOS.map((p) => ({ periodo: p, percentual: null, cor: "#E4DFD9" })),
    criterios: CRITERIOS.map((n) => ({ nome: n, nota: null, largura: 0 })),
  };
}

const vazioEquipe: Dados = {
  velocidade: [], ...pilaresVazios(), notaQualidade: null, amostraQualidade: null,
  conversao: [], disciplina: [], equipes: [], totais: "—", atualizado: "—",
};

function mapearEquipe(p: EquipePayload | null): Dados {
  if (!p) return vazioEquipe;
  const convLead = p.leads > 0 ? Math.round((1000 * p.vendas) / p.leads) / 10 : null;

  return {
    velocidade: [
      { l: "Leads recebidos", r: fmt.inteiro(p.leads) },
      { l: "1ª resposta med · P90", r: `${fmt.duracaoMin(p.sla.mediana_min)} · ${fmt.duracaoMin(p.sla.p90_min)}`, cor: "#D93E3E", forte: true },
      { l: "% no SLA (5 min)", r: "—" },
      { l: "Presença / disponibilidade", r: "—" },
      { l: "Atividade observada no ERP", r: "—" },
    ],
    ...pilaresVazios(),
    notaQualidade: null,
    amostraQualidade: null,
    conversao: [
      { l: "Leads → negócios → visitas", r: `${fmt.inteiro(p.leads)} · ${fmt.inteiro(p.negocios)} · ${fmt.inteiro(p.visitas)}` },
      { l: "Propostas → vendas", r: `— · ${fmt.inteiro(p.vendas)}` },
      { l: "Conversão lead → venda", r: fmt.porcento(convLead, 1), forte: true },
      { l: "VGV", r: fmt.dinheiro(p.vgv) },
      { l: "Receita atribuída (comissão)", r: fmt.dinheiro(p.comissao_bruta) },
      { l: "Comissão dos corretores", r: fmt.dinheiro(p.comissao_pessoas) },
      { l: "Ciclo médio de venda", r: "—" },
    ],
    disciplina: [
      { l: "Follow-ups vencidos", r: fmt.inteiro(p.followups_vencidos), cor: p.followups_vencidos > 0 ? "#D93E3E" : undefined, forte: p.followups_vencidos > 0 },
      { l: "Negócios sem próxima ação", r: fmt.inteiro(p.negocios_sem_proxima) },
      { l: "Visitas sem feedback", r: fmt.inteiro(p.visitas_sem_feedback) },
      { l: "Perdas sem motivo", r: fmt.inteiro(p.perdas_sem_motivo) },
      { l: "Etapas desatualizadas", r: "—" },
      { l: "Propostas sem atualização", r: "—" },
    ],
    equipes: p.equipes.map((e) => ({
      nome: e.nome,
      iniciais: "",
      leads: e.leads,
      sla: null,
      mediana: e.mediana,
      p90: e.p90,
      qualidade: null,
      amostra: null,
      leadVenda: e.lead_venda,
      vendas: e.vendas,
      vgv: e.vendas > 0 ? e.vgv : null,
      vencidos: e.vencidos,
      ajuda: (e.mediana ?? 0) > 15 ? "velocidade de resposta" : "—",
    })),
    totais: `leads ${fmt.inteiro(p.leads)} · vendas ${fmt.inteiro(p.vendas)} · VGV ${fmt.dinheiro(p.vgv)}`,
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoEquipe: Dados = {
  velocidade: [
    { l: "Leads recebidos", r: "486" },
    { l: "1ª resposta med · P90", r: "14 min · 1 h 52", cor: "#D93E3E", forte: true },
  ],
  cobertura: [
    { periodo: "manhã", percentual: 92, cor: "#1FA85A" },
    { periodo: "tarde", percentual: 88, cor: "#1FA85A" },
    { periodo: "noite", percentual: 41, cor: "#FF9A4D" },
    { periodo: "fds", percentual: 16, cor: "#D93E3E" },
  ],
  notaQualidade: 4.3, amostraQualidade: 182,
  criterios: [
    { nome: "Cordialidade", nota: 4.7, largura: 94 },
    { nome: "Objeções", nota: 3.8, largura: 76 },
  ],
  conversao: [
    { l: "Leads → negócios → visitas", r: "486 · 274 · 118" },
    { l: "VGV", r: "R$ 18,4 mi" },
  ],
  disciplina: [{ l: "Follow-ups feitos · vencidos", r: "412 · 57", cor: "#D93E3E", forte: true }],
  equipes: [
    { nome: "Equipe Juliana Prado", iniciais: "JP", leads: 261, sla: 31, mediana: 9, p90: 58, qualidade: 4.5, amostra: 104, leadVenda: 4.9, vendas: 13, vgv: 11_200_000, vencidos: 23, ajuda: "cobertura de fim de semana" },
  ],
  totais: "leads 486 · vendas 21 · VGV R$ 18,4 mi",
  atualizado: "14:32",
};
