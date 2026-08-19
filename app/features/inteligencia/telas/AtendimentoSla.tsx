"use client";

/* 10 · ATENDIMENTO E SLA — artboard 15a. Fila viva, agora com dado real via
 * /api/inteligencia/atendimento (RPC intel_atendimento). SLA = tempo que o lead
 * está esperando resposta do corretor (cliente_ultima > env_ultima). Nome do
 * lead vem mascarado. % no SLA de 5 min e taxa de resposta seguem — (sem marco
 * de 1º contato). Demo virou fixture. */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { AtendimentoPayload } from "../../../lib/inteligencia/tipos";

type Balde = { rotulo: string; marca: string; volume: number | null; largura: number; cor: string; corNum: string };
type Fila = { chave: string; nome: string; volume: number | null; cor: string; tom: string };
type Lead = { nome: string; responsavel: string | null; gerente: string | null; origem: string; espera: string; ultima: string; proxima: string };

type Dados = {
  mediana: number | null;
  p90: number | null;
  percentualSla: number | null;
  variacaoSla: number | null;
  taxaResposta: number | null;
  recebidas: number | null;
  enviadas: number | null;
  followFeitos: number | null;
  followVencidos: number | null;
  totalLeads: number | null;
  baldes: Balde[];
  filas: Fila[];
  leads: Lead[];
  filaAberta: string;
  totalFila: number | null;
  atualizado: string;
};

export function AtendimentoSla({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<AtendimentoPayload>("atendimento", accessToken, recorte);
  const d = mapearAtendimento(leitura.payload);
  const [filaAtiva, setFilaAtiva] = useState<string>("sla");

  const kpis: Kpi[] = [
    { rotulo: "Espera do lead · mediana", bruto: d.mediana, texto: fmt.duracaoMin(d.mediana), tom: "ruim", tile: "vermelho", chip: "quanto o lead espera resposta", chipTom: "aviso" },
    { rotulo: "Espera do lead · P90", bruto: d.p90, texto: fmt.duracaoMin(d.p90), tom: "atencao", tile: "ambar", foot: "10% dos leads esperaram mais que isso" },
    { rotulo: "% dentro do SLA (5 min)", bruto: d.percentualSla, texto: fmt.porcento(d.percentualSla, 0), tom: "ruim", tile: "vermelho", motivo: "integracao", detalhe: "sem marco de 1º contato — medimos o tempo de espera do backlog", chip: `${fmt.pontos(d.variacaoSla)} vs. anterior`, chipTom: "ruim" },
    { rotulo: "Mensagens e follow-ups", bruto: d.taxaResposta, texto: fmt.porcento(d.taxaResposta, 0), tile: "verde", motivo: "amostra", detalhe: "taxa de resposta depende de pareamento de mensagens", foot: `${fmt.inteiro(d.recebidas)} recebidas · ${fmt.inteiro(d.enviadas)} enviadas · follow-ups vencidos ${fmt.inteiro(d.followVencidos)}` },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="VELOCIDADE" titulo="Mediana, P90 e a distribuição — nunca só a média" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      {/* OS CINCO BALDES */}
      <div className="intp-baldes">
        {d.baldes.map((b) => (
          <div className="intp-balde" key={b.rotulo}>
            <span className="intp-balde-rot">
              <b>{b.rotulo}</b> {b.marca}
            </span>
            <strong className="intp-balde-num" style={{ color: b.corNum }}>{fmt.inteiro(b.volume)}</strong>
            <span className="intp-balde-trilha">
              <span className="intp-balde-barra" style={{ width: `${b.largura}%`, background: b.cor }} />
            </span>
          </div>
        ))}
      </div>
      <small className="intp-kpi-foot">
        {fmt.inteiro(d.totalLeads)} leads no período · clicar num balde abre a lista de quem está nele · a cobertura por gerente aparece em Gerentes
      </small>

      {/* FILAS DE AÇÃO + FILA ABERTA */}
      <div className="intp-op-duas">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Cabecalho eyebrow="FILAS DE AÇÃO" titulo="O que precisa de gente agora" cor="#8B00CC" />
          <div className="intp-fila">
            {d.filas.map((f) => (
              <button
                key={f.chave}
                type="button"
                className={`intp-fila-item${f.chave === filaAtiva ? " ativa" : ""}`}
                onClick={() => {
                  setFilaAtiva(f.chave);
                  recorte.filtrar(`Fila: ${f.nome}`);
                }}
              >
                <span className="intp-fila-dot" style={{ background: f.cor }} />
                <span className="intp-fila-nome">{f.nome}</span>
                <span className="intp-fila-num" style={{ color: f.tom }}>{fmt.inteiro(f.volume)}</span>
                <span className="intp-fila-seta">›</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Cabecalho eyebrow="FILA ABERTA" titulo={`${d.filaAberta} · ${fmt.inteiro(d.totalFila)}`} />
          <Tabela
            colunas={[{ titulo: "Lead" }, { titulo: "Responsável" }, { titulo: "Gerente" }, { titulo: "Origem" }, { titulo: "Espera", num: true }, { titulo: "Última interação" }, { titulo: "Próxima ação · etapa" }, { titulo: "" }]}
            ordenadaEm="Espera"
            linhas={d.leads.map((l) => ({
              chave: l.nome,
              destaque: l.responsavel === null,
              abrir: () => recorte.filtrar(`Lead: ${l.nome}`),
              celulas: [
                { texto: l.nome, forte: true },
                l.responsavel === null ? { texto: "sem responsável", cor: "#D93E3E" } : { texto: l.responsavel },
                { texto: l.gerente ?? "—" },
                { texto: l.origem },
                { texto: l.espera, num: true, forte: true, cor: "#D93E3E" },
                { texto: l.ultima },
                { texto: l.proxima },
                { texto: "abrir no CRM ↗", cor: "#CC5800" },
              ],
            }))}
            foot={`mostrando ${d.leads.length} de ${fmt.inteiro(d.totalFila)} · ordenado pelo maior tempo de espera`}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="cop-btn-primario" style={{ boxShadow: "none", background: "#FF7000" }}>Atribuir selecionados</button>
            <button type="button" className="cop-acao">Lembrar responsáveis</button>
            <button type="button" className="cop-acao">Reconhecer</button>
          </div>
          <small className="intp-kpi-foot">nada aqui executa sozinho: atribuir e lembrar pedem confirmação e ficam registrados na Auditoria</small>
        </div>
      </div>

      <RodapeFontes
        fontes={["leads", "wa_mensagens", "negócios"]}
        pendencias={["% no SLA de 5 min e taxa de resposta (sem marco de 1º contato)", "escala/ponto não integrado"]}
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

const BALDES_META = [
  { rotulo: "≤ 5 min", marca: "no SLA", cor: "#1FA85A", corNum: "#1E7A46", campo: "ate5" as const },
  { rotulo: "5–15 min", marca: "", cor: "#FFB570", corNum: "#1F1C1A", campo: "b5_15" as const },
  { rotulo: "15–30 min", marca: "", cor: "#FF9A4D", corNum: "#1F1C1A", campo: "b15_30" as const },
  { rotulo: "30–60 min", marca: "", cor: "#FF7000", corNum: "#B5700A", campo: "b30_60" as const },
  { rotulo: "> 60 min", marca: "crítico", cor: "#D93E3E", corNum: "#D93E3E", campo: "acima60" as const },
];

const vazioAtendimento: Dados = {
  mediana: null, p90: null, percentualSla: null, variacaoSla: null, taxaResposta: null,
  recebidas: null, enviadas: null, followFeitos: null, followVencidos: null, totalLeads: null,
  baldes: BALDES_META.map((b) => ({ rotulo: b.rotulo, marca: b.marca, volume: null, largura: 0, cor: b.cor, corNum: b.corNum })),
  filas: [
    { chave: "sem-resposta", nome: "Leads novos sem primeira resposta", volume: null, cor: "#D93E3E", tom: "#D93E3E" },
    { chave: "sla", nome: "Leads acima do SLA · aberto ao lado", volume: null, cor: "#FF7000", tom: "#CC5800" },
    { chave: "mensagens", nome: "Mensagens recebidas sem retorno", volume: null, cor: "#B5700A", tom: "#1F1C1A" },
    { chave: "followup", nome: "Follow-ups vencidos", volume: null, cor: "#B5700A", tom: "#1F1C1A" },
    { chave: "sem-acao", nome: "Negócios sem próxima ação", volume: null, cor: "#B5700A", tom: "#1F1C1A" },
  ],
  leads: [],
  filaAberta: "Leads acima do SLA",
  totalFila: null,
  atualizado: "—",
};

function mapearAtendimento(p: AtendimentoPayload | null): Dados {
  if (!p) return vazioAtendimento;
  const bmax = Math.max(1, p.baldes.ate5, p.baldes.b5_15, p.baldes.b15_30, p.baldes.b30_60, p.baldes.acima60);

  return {
    mediana: p.mediana_min,
    p90: p.p90_min,
    percentualSla: null,
    variacaoSla: null,
    taxaResposta: null,
    recebidas: p.recebidas,
    enviadas: p.enviadas,
    followFeitos: null,
    followVencidos: p.filas.followup_vencidos,
    totalLeads: p.total_leads,
    baldes: BALDES_META.map((b) => {
      const v = p.baldes[b.campo];
      return { rotulo: b.rotulo, marca: b.marca, volume: v, largura: Math.round((100 * v) / bmax), cor: b.cor, corNum: b.corNum };
    }),
    filas: [
      { chave: "sem-resposta", nome: "Leads novos sem primeira resposta", volume: p.filas.sem_resposta, cor: "#D93E3E", tom: "#D93E3E" },
      { chave: "sla", nome: "Leads acima do SLA · aberto ao lado", volume: p.filas.acima_sla, cor: "#FF7000", tom: "#CC5800" },
      { chave: "mensagens", nome: "Mensagens recebidas sem retorno", volume: p.filas.mensagens, cor: "#B5700A", tom: "#1F1C1A" },
      { chave: "followup", nome: "Follow-ups vencidos", volume: p.filas.followup_vencidos, cor: "#B5700A", tom: "#1F1C1A" },
      { chave: "sem-acao", nome: "Negócios sem próxima ação", volume: p.filas.sem_proxima, cor: "#B5700A", tom: "#1F1C1A" },
    ],
    leads: p.leads.map((l) => ({
      nome: l.nome,
      responsavel: l.responsavel,
      gerente: l.gerente,
      origem: l.origem,
      espera: fmt.duracaoMin(l.espera_min),
      ultima: l.ultima ? `recebida ${hhmm(l.ultima)}` : "nenhuma",
      proxima: l.proxima,
    })),
    filaAberta: "Leads acima do SLA",
    totalFila: p.filas.acima_sla,
    atualizado: hhmm(p.atualizado_em),
  };
}

/* Fixture — só Storybook/teste. NUNCA usado na rota de produção. */
export const demoAtendimento: Dados = {
  mediana: 14, p90: 112, percentualSla: 22, variacaoSla: -5, taxaResposta: 87,
  recebidas: 3_418, enviadas: 2_986, followFeitos: 412, followVencidos: 57, totalLeads: 486,
  baldes: [
    { rotulo: "≤ 5 min", marca: "no SLA", volume: 107, largura: 22, cor: "#1FA85A", corNum: "#1E7A46" },
    { rotulo: "5–15 min", marca: "", volume: 158, largura: 33, cor: "#FFB570", corNum: "#1F1C1A" },
    { rotulo: "15–30 min", marca: "", volume: 96, largura: 20, cor: "#FF9A4D", corNum: "#1F1C1A" },
    { rotulo: "30–60 min", marca: "", volume: 97, largura: 20, cor: "#FF7000", corNum: "#B5700A" },
    { rotulo: "> 60 min", marca: "crítico", volume: 28, largura: 6, cor: "#D93E3E", corNum: "#D93E3E" },
  ],
  filas: [
    { chave: "sem-resposta", nome: "Leads novos sem primeira resposta", volume: 9, cor: "#D93E3E", tom: "#D93E3E" },
    { chave: "sla", nome: "Leads acima do SLA · aberto ao lado", volume: 31, cor: "#FF7000", tom: "#CC5800" },
    { chave: "mensagens", nome: "Mensagens recebidas sem retorno", volume: 44, cor: "#B5700A", tom: "#1F1C1A" },
    { chave: "followup", nome: "Follow-ups vencidos", volume: 57, cor: "#B5700A", tom: "#1F1C1A" },
    { chave: "sem-acao", nome: "Negócios sem próxima ação", volume: 26, cor: "#B5700A", tom: "#1F1C1A" },
  ],
  filaAberta: "Leads acima do SLA",
  totalFila: 31,
  leads: [
    { nome: "Sônia R.", responsavel: null, gerente: null, origem: "Instagram orgânica", espera: "4 h 10", ultima: "nenhuma", proxima: "1º contato · lead novo" },
    { nome: "Paulo M.", responsavel: "Rafael Souza", gerente: "Marcos V.", origem: "Portal externo", espera: "1 h 47", ultima: "msg recebida 12:45", proxima: "responder · em atendimento" },
  ],
  atualizado: "14:32",
};
