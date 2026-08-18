"use client";

/* ATENDIMENTO E SLA — artboard 15a.
 * Quem está esperando resposta agora, e há quanto tempo. Esta é a tela de fila:
 * o valor dela é a ação dos próximos minutos, não o relatório do mês.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Fila = { chave: string; nome: string; meio: string; volume: number | null; cor: string; det: Detalhe };
type Dados = {
  mediana: number | null;
  p90: number | null;
  percentualSla: number | null;
  variacaoSla: number | null;
  semResposta: number | null;
  filas: Fila[];
  faixas: { faixa: string; leads: number | null; locacao: number | null; venda: number | null; maisAntigo: string }[];
  atualizado: string;
};

export function AtendimentoSla({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "1º contato · mediana", bruto: d.mediana, texto: fmt.duracaoMin(d.mediana), tom: "ruim", tile: "vermelho", foot: "meta 5 min" },
    { rotulo: "1º contato · P90", bruto: d.p90, texto: fmt.duracaoMin(d.p90), tile: "ambar", foot: "9 de cada 10 respondidos até aqui" },
    { rotulo: "% dentro do SLA", bruto: d.percentualSla, texto: fmt.porcento(d.percentualSla, 0), tom: "ruim", tile: "vermelho", chip: fmt.pontos(d.variacaoSla), chipTom: "ruim", foot: "vs. período anterior" },
    { rotulo: "Sem resposta agora", bruto: d.semResposta, texto: fmt.inteiro(d.semResposta), tom: "ruim", tile: "laranja", foot: "fila de ação · atualiza em tempo real" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="TEMPO DE RESPOSTA" titulo="Como o time está atendendo agora" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={4} />

      <ListaComDetalhe
        eyebrow="FILAS DE AÇÃO"
        titulo="O que precisa de alguém agora"
        nota="cada linha abre a lista de pessoas conforme a permissão · fila vazia aparece como zero, não desaparece"
        linhas={d.filas.map((f) => ({ chave: f.chave, nome: f.nome, meio: f.meio, fim: fmt.inteiro(f.volume), cor: f.cor, abrir: () => setDetalhe(f.det) }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="DISTRIBUIÇÃO DO TEMPO" titulo="Onde os leads estão caindo" cor="#8B00CC" nota="clique numa faixa para filtrar a página" />
      <Tabela
        colunas={[{ titulo: "Faixa de tempo" }, { titulo: "Leads", num: true }, { titulo: "Locação", num: true }, { titulo: "Venda", num: true }, { titulo: "Mais antigo" }]}
        ordenadaEm="Leads"
        linhas={d.faixas.map((f) => ({
          chave: f.faixa,
          destaque: f.faixa.startsWith("Acima"),
          abrir: () => recorte.filtrar(`Tempo: ${f.faixa}`),
          celulas: [
            { texto: f.faixa, forte: true },
            { texto: fmt.inteiro(f.leads), num: true },
            { texto: fmt.inteiro(f.locacao), num: true },
            { texto: fmt.inteiro(f.venda), num: true },
            { texto: f.maisAntigo },
          ],
        }))}
        foot="soma das faixas = leads do período · lead sem registro de primeira resposta entra na última faixa, nunca é descartado"
      />

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
  mediana: 21,
  p90: 130,
  percentualSla: 22,
  variacaoSla: -5,
  semResposta: 9,
  filas: [
    { chave: "sem-resposta", nome: "Leads novos sem primeira resposta", meio: "crítico", volume: 9, cor: "#D93E3E", det: { titulo: "Sem primeira resposta", sub: "9 leads · espera média 41 min", linhas: [["Equipe Locação", "7"], ["Equipe Venda", "2"], ["Mais antigo", "1h52"], ["Responsável ausente", "3"]], aviso: "Nome e telefone só com permissão de dados pessoais." } },
    { chave: "followup", nome: "Follow-ups vencidos", meio: "disciplina", volume: 57, cor: "#B5700A", det: { titulo: "Follow-ups vencidos", sub: "57 negócios", linhas: [["Vencidos hoje", "18"], ["Há mais de 3 dias", "24"], ["Sem próxima ação", "26"], ["Concentrados em", "Carlos e Rafael"]], aviso: "A lista abre no Funil 2.0, onde a ação acontece." } },
    { chave: "parados", nome: "Negócios parados 7+ dias", meio: "pipeline", volume: 21, cor: "#B5700A", det: { titulo: "Negócios parados", sub: "sem movimento há 7 dias", linhas: [["Em atendimento", "11"], ["Qualificado", "6"], ["Proposta", "4"], ["Valor envolvido", "— campo ausente no CRM"]], aviso: "Valor só aparece quando o campo existir; nunca estimado por média." } },
    { chave: "visitas", nome: "Visitas sem feedback", meio: "pós-visita", volume: 12, cor: "#B5700A", det: { titulo: "Visitas sem feedback", sub: "12 visitas realizadas", linhas: [["Mais de 48 h", "7"], ["Equipe Venda", "5"], ["Equipe Locação", "7"], ["Efeito", "não entra na qualidade"]], aviso: "Sem feedback registrado, a visita não conta para a análise de conversão." } },
    { chave: "mensagens", nome: "Mensagens sem retorno", meio: "WhatsApp", volume: 44, cor: "#D93E3E", det: { titulo: "Mensagens sem retorno", sub: "44 conversas", linhas: [["Cliente falou por último", "44"], ["Há mais de 24 h", "19"], ["Corretor com mais casos", "Carlos (12)"], ["Fonte", "wa_mensagens"]], aviso: "Conteúdo da conversa não é exibido nesta tela." } },
  ],
  faixas: [
    { faixa: "Dentro de 5 min", leads: 107, locacao: 32, venda: 75, maisAntigo: "—" },
    { faixa: "5 a 15 min", leads: 94, locacao: 33, venda: 61, maisAntigo: "—" },
    { faixa: "15 a 60 min", leads: 138, locacao: 96, venda: 42, maisAntigo: "48 min" },
    { faixa: "Acima de 60 min", leads: 147, locacao: 118, venda: 29, maisAntigo: "1h52" },
  ],
  atualizado: "14:32",
};
