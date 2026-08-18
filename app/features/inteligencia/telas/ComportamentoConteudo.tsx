"use client";

/* 3 · COMPORTAMENTO E CONTEÚDO — artboard 4a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. páginas: mais acessadas · de entrada · maior intenção · acesso alto e
 *      conversão baixa (os quatro cartões lado a lado)
 *   2. tabela de páginas com a leitura ao lado
 *   3. ações de intenção · outras interações · dispositivos
 *   4. banner do Clarity parcial
 *   5. rodapé de fontes
 *
 * Página com 0 lead mostra 0, porque zero é dado. A leitura vem sempre ao lado,
 * para o número virar tarefa e não julgamento.
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
  maisAcessadas: { l: string; r: string }[];
  entradas: { l: string; r: string }[];
  maiorIntencao: { l: string; r: string }[];
  correcao: { l: string; r: string; sub: string }[];
  interacoes: { l: string; r: string; chip: string }[];
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
      {/* 1 · PÁGINAS — os quatro cartões do artboard */}
      <Cabecalho eyebrow="PÁGINAS" titulo="Onde as pessoas chegam, o que prende e o que precisa de conserto" nota={recorte.periodo} />
      <CartoesLista
        colunas={4}
        cartoes={[
          { titulo: "Mais acessadas", linhas: d.maisAcessadas.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Página: ${x.l}`) })), foot: "visualizações no período" },
          { titulo: "Páginas de entrada", linhas: d.entradas.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Entrada: ${x.l}`) })), foot: "primeira página da visita" },
          { titulo: "Maior intenção e lead", linhas: d.maiorIntencao.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Página: ${x.l}`) })), foot: "intenções · leads na página" },
          { titulo: "Acesso alto, conversão baixa", chip: "fila de correção", chipTom: "aviso", linhas: d.correcao, foot: "sempre com o motivo ao lado" },
        ]}
      />

      {/* 2 · TABELA DE PÁGINAS */}
      <Cabecalho eyebrow="TABELA DE PÁGINAS" titulo="Cada página, do acesso ao lead" cor="#8B00CC" nota="clique na linha para filtrar · clique no cabeçalho para ordenar" />
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

      {/* 3 · INTERAÇÕES E DISPOSITIVOS */}
      <Cabecalho eyebrow="AÇÕES DE INTENÇÃO" titulo="O que fazem além de ler" />
      <GradeKpis itens={kpis} colunas={4} />
      <CartoesLista
        colunas={2}
        cartoes={[
          {
            titulo: "Outras interações",
            linhas: d.interacoes.map((i) => ({ l: i.l, r: i.r, abrir: () => recorte.filtrar(i.chip) })),
            foot: "clicar num evento filtra a página · estes não contam como intenção",
          },
          {
            titulo: "Desktop · tablet · celular",
            linhas: d.dispositivos.map((x) => ({ ...x, abrir: () => recorte.filtrar(`Dispositivo: ${x.l}`) })),
            foot: "somas batem com a Visão do digital",
          },
        ]}
      />

      {/* 4 · BANNER DO CLARITY */}
      <Banner
        tom="aviso"
        forte="Clarity sem eventos há 3 h"
        texto="— mapas de calor e gravações deste período podem estar incompletos. Gravações existem só para quem consentiu Analytics (7.938 sessões disponíveis). Os números desta tela vêm da coleta própria, que segue de pé."
        botao={{ rotulo: "Ver diagnóstico", go: () => recorte.irPara("privacidade") }}
      />

      {/* 5 · RODAPÉ */}
      <RodapeFontes
        fontes={["coleta própria", "Google Tag", "Clarity (parcial)"]}
        pendencias={["Clarity sem evento há 3 h (mapas e gravações parciais)", "2 páginas sem tracking", "consentimento Analytics em 31%"]}
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
  maisAcessadas: [
    { l: "/imoveis (busca)", r: "6.912" },
    { l: "/ (home)", r: "4.086" },
    { l: "Apê Canário 71", r: "1.486" },
    { l: "Apê Gaivota 402", r: "1.240" },
  ],
  entradas: [
    { l: "/ (home)", r: "3.418" },
    { l: "/imoveis (busca)", r: "2.874" },
    { l: "Apê Canário 71", r: "912" },
    { l: "/blog/guia-moema", r: "846" },
  ],
  maiorIntencao: [
    { l: "Apê Canário 71", r: "312 · 38" },
    { l: "Apê Pavão 88", r: "264 · 31" },
    { l: "/imoveis (busca)", r: "228 · 24" },
    { l: "Apê Sabiá 12", r: "176 · 19" },
  ],
  correcao: [
    { l: "/blog/guia-moema", r: "2.180 · 0", sub: "sem CTA de imóvel na página" },
    { l: "Apê Gaivota 402", r: "1.240 · 2", sub: "galeria pouco aberta — revisar fotos" },
    { l: "/sobre", r: "934 · 1", sub: "sem caminho para a busca" },
  ],
  interacoes: [
    { l: "Mudança de filtros", r: "3.842", chip: "Evento: filter_change" },
    { l: "Pesquisa de imóveis", r: "2.914", chip: "Evento: property_search" },
    { l: "Galeria (abrir / interagir)", r: "4.216", chip: "Evento: gallery_interaction" },
    { l: "Favoritos", r: "618", chip: "Evento: favorite_toggle" },
  ],
  dispositivos: [
    { l: "Celular", r: "14.464 vis · 185 leads", corR: "#66009A" },
    { l: "Desktop", r: "8.842 vis · 118 leads" },
    { l: "Tablet", r: "1.312 vis · 9 leads" },
  ],
  paginas: [
    { pagina: "/imoveis (busca)", visualizacoes: 6_912, entradas: 2_874, intencao: 228, leads: 24, motivo: "topo de busca · sem ação pendente" },
    { pagina: "/ (home)", visualizacoes: 4_086, entradas: 3_418, intencao: 196, leads: 18, motivo: "entrada principal" },
    { pagina: "/blog/guia-moema", visualizacoes: 2_180, entradas: 846, intencao: 12, leads: 0, motivo: "sem CTA de imóvel na página" },
    { pagina: "Apê Canário 71", visualizacoes: 1_486, entradas: 912, intencao: 312, leads: 38, motivo: "melhor conversão do período" },
    { pagina: "Apê Gaivota 402", visualizacoes: 1_240, entradas: 214, intencao: 31, leads: 2, motivo: "galeria pouco aberta — revisar fotos" },
    { pagina: "/sobre", visualizacoes: 934, entradas: 402, intencao: 8, leads: 1, motivo: "sem caminho para a busca" },
  ],
  atualizado: "14:28",
};
