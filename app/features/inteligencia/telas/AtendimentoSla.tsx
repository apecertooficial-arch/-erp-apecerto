"use client";

/* 10 · ATENDIMENTO E SLA — artboard 15a, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. VELOCIDADE — mediana, P90, % no SLA e mensagens/follow-ups (4 cartões)
 *   2. os CINCO BALDES de tempo, com barra embaixo (≤5 · 5–15 · 15–30 · 30–60 · >60)
 *   3. FILAS DE AÇÃO à esquerda + FILA ABERTA à direita, com a lista de leads e as
 *      ações em massa (atribuir, lembrar, reconhecer)
 *   4. rodapé de fontes
 *
 * Esta é a tela de fila: o valor dela é a ação dos próximos minutos, não o
 * relatório do mês.
 */

import { useState } from "react";
import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, Tabela, type Kpi } from "../pecas";

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

export function AtendimentoSla({ recorte }: PropsTela) {
  const d = usarDados();
  const [filaAtiva, setFilaAtiva] = useState<string>("sla");

  const kpis: Kpi[] = [
    { rotulo: "1º resposta · mediana", bruto: d.mediana, texto: fmt.duracaoMin(d.mediana), tom: "ruim", tile: "vermelho", chip: "meta 5 min", chipTom: "aviso" },
    { rotulo: "1º resposta · P90", bruto: d.p90, texto: fmt.duracaoMin(d.p90), tom: "atencao", tile: "ambar", foot: "10% dos leads esperaram mais que isso" },
    { rotulo: "% dentro do SLA (5 min)", bruto: d.percentualSla, texto: fmt.porcento(d.percentualSla, 0), tom: "ruim", tile: "vermelho", chip: `${fmt.pontos(d.variacaoSla)} vs. anterior`, chipTom: "ruim" },
    { rotulo: "Mensagens e follow-ups", bruto: d.taxaResposta, texto: fmt.porcento(d.taxaResposta, 0), tile: "verde", foot: `taxa de resposta · ${fmt.inteiro(d.recebidas)} recebidas · ${fmt.inteiro(d.enviadas)} enviadas · follow-ups ${fmt.inteiro(d.followFeitos)} feitos / ${fmt.inteiro(d.followVencidos)} vencidos` },
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
        {fmt.inteiro(d.totalLeads)} leads no período · clicar num balde abre a lista de quem está nele · quase todo o crítico é fim de semana — a cobertura aparece em Gerentes
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
        pendencias={["escala/ponto não integrado — a tela mostra atividade, não ausência"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  mediana: 14,
  p90: 112,
  percentualSla: 22,
  variacaoSla: -5,
  taxaResposta: 87,
  recebidas: 3_418,
  enviadas: 2_986,
  followFeitos: 412,
  followVencidos: 57,
  totalLeads: 486,
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
    { nome: "Marcos A.", responsavel: "Fernanda Lima", gerente: "Juliana P.", origem: "Site · Apê Canário 71", espera: "52 min", ultima: "whatsapp 13:40", proxima: "1º contato · lead novo" },
    { nome: "Beatriz L.", responsavel: "Carlos Mendes", gerente: "Marcos V.", origem: "Indicação", espera: "38 min", ultima: "form. do site 13:54", proxima: "1º contato · lead novo" },
  ],
  atualizado: "14:32",
};
