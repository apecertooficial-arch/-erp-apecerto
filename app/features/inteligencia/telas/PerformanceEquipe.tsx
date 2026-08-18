"use client";

/* 11 · PERFORMANCE DA EQUIPE — artboard 16a, idêntico ao protótipo.
 *
 * Ordem do desenho:
 *   1. OS 4 PILARES — a empresa inteira no período, um cartão por pilar, cada um
 *      com a própria lista interna e o link para a página que o desdobra:
 *        1 Velocidade e disponibilidade  · com cobertura por horário
 *        2 Qualidade de atendimento      · com os 8 critérios em barras
 *        3 Conversão e resultado         · do lead ao VGV
 *        4 Disciplina de processo        · follow-ups, etapas, feedback
 *   2. POR EQUIPE — tabela larga com “precisa de ajuda em” na última coluna
 *   3. REGRAS DE JUSTIÇA — o que vale para a área inteira
 *
 * Nenhuma nota geral única: cada pilar responde por si, sem score opaco.
 */

import "../../../styles/inteligencia-blocos.css";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, IconeInt, Tabela, type NomeIcone } from "../pecas";

type LinhaPilar = { l: string; r: string; cor?: string; forte?: boolean };
type Criterio = { nome: string; nota: number | null; largura: number };
type Cobertura = { periodo: string; percentual: number | null; cor: string };

type Equipe = {
  nome: string;
  iniciais: string;
  leads: number | null;
  sla: number | null;
  mediana: number | null;
  p90: number | null;
  qualidade: number | null;
  amostra: number | null;
  leadVenda: number | null;
  vendas: number | null;
  vgv: number | null;
  vencidos: number | null;
  ajuda: string;
};

type Dados = {
  velocidade: LinhaPilar[];
  cobertura: Cobertura[];
  notaQualidade: number | null;
  amostraQualidade: number | null;
  criterios: Criterio[];
  conversao: LinhaPilar[];
  disciplina: LinhaPilar[];
  equipes: Equipe[];
  totais: string;
  atualizado: string;
};

const nota = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));

function Pilar({
  numero,
  titulo,
  icone,
  tile,
  children,
  link,
}: {
  numero: number;
  titulo: string;
  icone: NomeIcone;
  tile: "laranja" | "roxo" | "verde" | "ambar";
  children: React.ReactNode;
  link: { rotulo: string; go: () => void };
}) {
  return (
    <div className="intp-cartao">
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span className={`intp-tile tile-${tile}`}>
          <IconeInt nome={icone} tamanho={15} />
        </span>
        <span className="intp-cartao-titulo">
          {numero} · {titulo}
        </span>
      </div>
      {children}
      <button type="button" className="int-link" style={{ fontWeight: 700, marginTop: "auto", alignSelf: "flex-start" }} onClick={link.go}>
        {link.rotulo}
      </button>
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

export function PerformanceEquipe({ recorte }: PropsTela) {
  const d = usarDados();

  return (
    <div className="int-secao">
      {/* 1 · OS 4 PILARES */}
      <Cabecalho
        eyebrow="OS 4 PILARES"
        titulo="A empresa inteira, no período"
        nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""} · sem nota geral única`}
      />
      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <Pilar numero={1} titulo="Velocidade e disponibilidade" icone="relogio" tile="ambar" link={{ rotulo: "Ver por corretor →", go: () => recorte.irPara("corretores") }}>
          <Linhas itens={d.velocidade} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", color: "#9A938B", marginTop: 4 }}>COBERTURA POR HORÁRIO</span>
          <span style={{ display: "flex", gap: 4 }}>
            {d.cobertura.map((c) => (
              <span key={c.periodo} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ display: "block", height: 7, borderRadius: 999, background: c.cor }} />
                <small style={{ fontSize: 9.5, color: "#9A938B", textAlign: "center" }}>
                  {c.periodo} {fmt.porcento(c.percentual, 0)}
                </small>
              </span>
            ))}
          </span>
        </Pilar>

        <Pilar numero={2} titulo="Qualidade de atendimento" icone="faisca" tile="roxo" link={{ rotulo: "Abrir Qualidade →", go: () => recorte.irPara("qualidade") }}>
          <strong style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{nota(d.notaQualidade)}</strong>
          <small className="intp-kpi-foot">n = {fmt.inteiro(d.amostraQualidade)} avaliações · tendência estável</small>
          <div>
            {d.criterios.map((c) => (
              <div className="intp-crit" key={c.nome} style={{ gridTemplateColumns: "104px 1fr 34px" }}>
                <span className="intp-crit-rot" style={{ fontSize: 11 }}>{c.nome}</span>
                <span className="intp-crit-trilha" style={{ height: 7 }}>
                  <span className="intp-crit-barra" style={{ height: 7, width: `${c.largura}%` }} />
                </span>
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

      {/* 2 · POR EQUIPE */}
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

      {/* 3 · REGRAS DE JUSTIÇA */}
      <div className="intp-cartao" style={{ background: "#FBF6FE", boxShadow: "none", border: "1px solid #EBD1F5" }}>
        <span className="intp-cartao-titulo" style={{ color: "#66009A" }}>Regras de justiça (valem para toda a área)</span>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "#66009A" }}>
          ninguém é classificado com amostra menor que 8 avaliações · a comparação considera origem e qualidade dos leads, tipo, preço e finalidade do imóvel · volume de mensagens não pontua · lead duplicado ou inválido não penaliza · avaliações automatizadas são contestáveis e revisíveis · uso do ERP não é jornada de trabalho · ausência de registro nunca vira nota zero.
        </p>
      </div>

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "avaliações de conversa", "disponibilidade no ERP"]}
        pendencias={["conversas fora do ERP não são avaliadas", "escala/ponto não integrado", "método de avaliação aguardando decisão"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  velocidade: [
    { l: "Presença registrada", r: "96%" },
    { l: "Disponibilidade online", r: "78%" },
    { l: "Atividade observada no ERP", r: "6,2 h/dia" },
    { l: "Leads recebidos", r: "486" },
    { l: "1ª resposta med · P90", r: "14 min · 1 h 52", cor: "#D93E3E", forte: true },
    { l: "% no SLA (5 min)", r: "22%", cor: "#D93E3E", forte: true },
  ],
  cobertura: [
    { periodo: "manhã", percentual: 92, cor: "#1FA85A" },
    { periodo: "tarde", percentual: 88, cor: "#1FA85A" },
    { periodo: "noite", percentual: 41, cor: "#FF9A4D" },
    { periodo: "fds", percentual: 16, cor: "#D93E3E" },
  ],
  notaQualidade: 4.3,
  amostraQualidade: 182,
  criterios: [
    { nome: "Cordialidade", nota: 4.7, largura: 94 },
    { nome: "Clareza", nota: 4.5, largura: 90 },
    { nome: "Escrita", nota: 4.4, largura: 88 },
    { nome: "Condução", nota: 4.2, largura: 84 },
    { nome: "Personalização", nota: 4.1, largura: 82 },
    { nome: "Qualificação", nota: 3.9, largura: 78 },
    { nome: "Objeções", nota: 3.8, largura: 76 },
  ],
  conversao: [
    { l: "Leads → negócios → visitas", r: "486 · 274 · 118" },
    { l: "Propostas → vendas", r: "47 · 21" },
    { l: "Conversão lead → venda", r: "4,3%", forte: true },
    { l: "VGV", r: "R$ 18,4 mi" },
    { l: "Receita atribuída", r: "R$ 920 mil" },
    { l: "Comissão dos corretores", r: "R$ 488 mil" },
    { l: "Ciclo médio de venda", r: "38 dias" },
  ],
  disciplina: [
    { l: "Follow-ups feitos · vencidos", r: "412 · 57", cor: "#D93E3E", forte: true },
    { l: "Negócios sem próxima ação", r: "26" },
    { l: "Etapas desatualizadas", r: "19" },
    { l: "Visitas sem feedback", r: "12" },
    { l: "Perdas sem motivo", r: "7" },
    { l: "Propostas sem atualização", r: "6" },
    { l: "Alertas resolvidos", r: "23 de 31" },
  ],
  equipes: [
    { nome: "Equipe Juliana Prado", iniciais: "JP", leads: 261, sla: 31, mediana: 9, p90: 58, qualidade: 4.5, amostra: 104, leadVenda: 4.9, vendas: 13, vgv: 11_200_000, vencidos: 23, ajuda: "cobertura de fim de semana" },
    { nome: "Equipe Marcos Vilela", iniciais: "MV", leads: 225, sla: 14, mediana: 22, p90: 161, qualidade: 4.1, amostra: 78, leadVenda: 3.6, vendas: 8, vgv: 7_200_000, vencidos: 34, ajuda: "velocidade + qualificado→visita" },
  ],
  totais: "leads 261+225 = 486 · vendas 13+8 = 21 · VGV soma R$ 18,4 mi",
  atualizado: "14:32",
};
