"use client";

/* COMPORTAMENTO E CONTEÚDO — artboard 4a.
 * O que as pessoas fazem no site e onde perdem interesse. A fila de correção
 * sempre traz o motivo ao lado — acesso alto com conversão baixa não é acusação,
 * é tarefa.
 */

import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, CartoesLista, GradeKpis, Tabela, type Kpi } from "../pecas";

type Dados = {
  whatsapp: number | null;
  telefone: number | null;
  agendamento: number | null;
  formulario: number | null;
  paginas: { pagina: string; visualizacoes: number | null; entradas: number | null; intencao: number | null; leads: number | null; motivo: string }[];
  dispositivos: { l: string; r: string; corR?: string }[];
  atualizado: string;
};

export function ComportamentoConteudo({ recorte }: PropsTela) {
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "WhatsApp", bruto: d.whatsapp, texto: fmt.inteiro(d.whatsapp), tile: "verde", foot: "conta como intenção" },
    { rotulo: "Telefone", bruto: d.telefone, texto: fmt.inteiro(d.telefone), tile: "verde", foot: "conta como intenção" },
    { rotulo: "Agendamento de visita", bruto: d.agendamento, texto: fmt.inteiro(d.agendamento), tile: "laranja", foot: "pelo site" },
    { rotulo: "Início de formulário", bruto: d.formulario, texto: fmt.inteiro(d.formulario), tile: "ambar", foot: "371 iniciados · 312 enviados" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="AÇÕES DE INTENÇÃO" titulo="O que as pessoas fazem além de ler" nota={recorte.periodo} />
      <GradeKpis itens={kpis} colunas={4} />

      <Banner
        tom="aviso"
        forte="Clarity sem eventos há 3 h."
        texto="Mapas de calor e gravações deste período podem estar incompletos, e gravação existe só para quem consentiu Analytics. Os números desta tela vêm da coleta própria, que segue de pé."
        botao={{ rotulo: "Ver diagnóstico", go: () => recorte.irPara("privacidade") }}
      />

      <Cabecalho eyebrow="PÁGINAS" titulo="Onde chegam, o que prende e o que precisa de conserto" cor="#8B00CC" nota="clique numa página para filtrar" />
      <Tabela
        colunas={[{ titulo: "Página" }, { titulo: "Visualizações", num: true }, { titulo: "Entradas", num: true }, { titulo: "Intenção", num: true }, { titulo: "Leads", num: true }, { titulo: "Leitura" }]}
        ordenadaEm="Visualizações"
        linhas={d.paginas.map((p) => ({
          chave: p.pagina,
          destaque: p.leads !== null && p.leads <= 2 && (p.visualizacoes ?? 0) > 900,
          abrir: () => recorte.filtrar(`Página: ${p.pagina}`),
          celulas: [
            { texto: p.pagina, forte: true },
            { texto: fmt.inteiro(p.visualizacoes), num: true },
            { texto: fmt.inteiro(p.entradas), num: true },
            { texto: fmt.inteiro(p.intencao), num: true },
            { texto: fmt.inteiro(p.leads), num: true, cor: (p.leads ?? 9) <= 2 ? "#D93E3E" : undefined },
            { texto: p.motivo },
          ],
        }))}
        foot="página com 0 lead mostra zero, porque zero é dado · o motivo vem sempre ao lado, para virar tarefa e não julgamento"
      />

      <Cabecalho eyebrow="INTERAÇÕES E DISPOSITIVOS" titulo="Como navegam" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Outras interações", linhas: [{ l: "Mudança de filtros", r: "3.842", abrir: () => recorte.filtrar("Evento: filter_change") }, { l: "Pesquisa de imóveis", r: "2.914", abrir: () => recorte.filtrar("Evento: property_search") }, { l: "Galeria", r: "4.216", abrir: () => recorte.filtrar("Evento: gallery_interaction") }, { l: "Favoritos", r: "618" }], foot: "clicar num evento filtra a página" },
          { titulo: "Desktop · tablet · celular", linhas: d.dispositivos, foot: "somas batem com a Visão do digital" },
          { titulo: "Fila de correção", chip: "vira tarefa", chipTom: "aviso", linhas: [{ l: "/blog/guia-moema", r: "2.180 · 0", sub: "sem CTA de imóvel na página" }, { l: "Apê Gaivota 402", r: "1.240 · 2", sub: "galeria pouco aberta — revisar fotos" }, { l: "/sobre", r: "934 · 1", sub: "sem caminho para a busca" }], foot: "acesso · leads" },
        ]}
      />

      <RodapeFontes
        fontes={["coleta própria", "Google Tag"]}
        pendencias={["Clarity sem evento há 3 h (mapas e gravações parciais)", "2 páginas sem tracking"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  whatsapp: 1_294,
  telefone: 412,
  agendamento: 233,
  formulario: 371,
  paginas: [
    { pagina: "/imoveis (busca)", visualizacoes: 6_912, entradas: 2_874, intencao: 228, leads: 24, motivo: "topo de busca · sem ação pendente" },
    { pagina: "/ (home)", visualizacoes: 4_086, entradas: 3_418, intencao: 196, leads: 18, motivo: "entrada principal" },
    { pagina: "/blog/guia-moema", visualizacoes: 2_180, entradas: 846, intencao: 12, leads: 0, motivo: "sem CTA de imóvel na página" },
    { pagina: "Apê Canário 71", visualizacoes: 1_486, entradas: 912, intencao: 312, leads: 38, motivo: "melhor conversão do período" },
    { pagina: "Apê Gaivota 402", visualizacoes: 1_240, entradas: 214, intencao: 31, leads: 2, motivo: "galeria pouco aberta — revisar fotos" },
    { pagina: "/sobre", visualizacoes: 934, entradas: 402, intencao: 8, leads: 1, motivo: "sem caminho para a busca" },
  ],
  dispositivos: [
    { l: "Celular", r: "14.464 vis · 185 leads", corR: "#66009A" },
    { l: "Desktop", r: "8.842 vis · 118 leads" },
    { l: "Tablet", r: "1.312 vis · 9 leads" },
  ],
  atualizado: "14:28",
};
