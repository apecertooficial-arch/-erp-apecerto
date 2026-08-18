"use client";

/* CORRETORES — artboard 18a.
 * Lista gerencial com a mesma régua para todos: verde ≤5 min, âmbar 5–15,
 * vermelho acima de 15. Quem não tem amostra não é classificado — e a tela diz
 * por quê, em vez de mostrar zero.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Corretor = {
  nome: string;
  equipe: string;
  primeiraResposta: number | null;
  negocios: number | null;
  visitas: number | null;
  conversao: number | null;
  vencidos: number | null;
  novato?: boolean;
  det: Detalhe;
};

type Dados = { ativos: number | null; melhor: number | null; pior: number | null; conversaoMedia: number | null; corretores: Corretor[]; atualizado: string };

const corDoTempo = (min: number | null, novato?: boolean) => {
  if (novato || min === null) return "#8B00CC";
  if (min <= 5) return "#1FA85A";
  if (min <= 15) return "#B5700A";
  return "#D93E3E";
};

export function Corretores({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Corretores ativos", bruto: d.ativos, texto: fmt.inteiro(d.ativos), tile: "roxo", foot: "1 novato sem amostra" },
    { rotulo: "Melhor 1º contato", bruto: d.melhor, texto: fmt.duracaoMin(d.melhor), tom: "bom", tile: "verde", foot: "Ana Beatriz" },
    { rotulo: "Pior 1º contato", bruto: d.pior, texto: fmt.duracaoMin(d.pior), tom: "ruim", tile: "vermelho", foot: "Rafael Souza" },
    { rotulo: "Conversão média", bruto: d.conversaoMedia, texto: fmt.porcento(d.conversaoMedia), tile: "laranja", foot: "lead → venda" },
  ];

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="A RÉGUA DA CASA" titulo="Seis pessoas, mesma medida" nota="verde ≤5 min · âmbar 5–15 · vermelho acima de 15" />
      <GradeKpis itens={kpis} colunas={4} />

      <Banner
        tom="tint-roxo"
        forte="Sobrecarga é contexto obrigatório."
        texto="Antes de cobrar tempo de resposta, a tela mostra a carga: 46 de 40 no Carlos. Cobrar sem tratar carga gera atrito sem resultado."
        botao={{ rotulo: "Ver carga em Gerentes", go: () => recorte.irPara("gerentes") }}
      />

      <ListaComDetalhe
        eyebrow="LISTA GERENCIAL"
        titulo="Quem precisa de ajuda, e em quê"
        nota="amostra mínima de 8 atendimentos · uso do ERP não é jornada de trabalho"
        linhas={d.corretores.map((c) => ({
          chave: c.nome,
          nome: c.nome,
          meio: c.novato ? "novato · sem amostra" : `${fmt.duracaoMin(c.primeiraResposta)} · ${fmt.inteiro(c.negocios)} negócios`,
          fim: c.novato ? "não classificar" : fmt.porcento(c.conversao),
          cor: corDoTempo(c.primeiraResposta, c.novato),
          abrir: () => setDetalhe(c.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
      />

      <Cabecalho eyebrow="TABELA COMPLETA" titulo="Cada corretor, do tempo à venda" cor="#8B00CC" nota="clique na linha para filtrar a página" />
      <Tabela
        colunas={[{ titulo: "Corretor" }, { titulo: "Equipe" }, { titulo: "1º contato", num: true }, { titulo: "Negócios", num: true }, { titulo: "Visitas", num: true }, { titulo: "Conversão", num: true }, { titulo: "Vencidos", num: true }, { titulo: "Situação" }]}
        ordenadaEm="Negócios"
        linhas={d.corretores.map((c) => ({
          chave: c.nome,
          destaque: (c.primeiraResposta ?? 0) > 30,
          abrir: () => recorte.filtrar(`Corretor: ${c.nome}`),
          celulas: [
            { texto: c.nome, forte: true },
            { texto: c.equipe },
            { texto: fmt.duracaoMin(c.primeiraResposta), num: true, cor: corDoTempo(c.primeiraResposta, c.novato) },
            { texto: fmt.inteiro(c.negocios), num: true },
            { texto: fmt.inteiro(c.visitas), num: true },
            { texto: c.novato ? "—" : fmt.porcento(c.conversao), num: true },
            { texto: fmt.inteiro(c.vencidos), num: true },
            c.novato ? { texto: "", chip: "sem amostra (mín. 8)", chipTom: "roxo" as const } : { texto: "", chip: "classificado", chipTom: "neutro" as const },
          ],
        }))}
        foot="novato entra na tabela, mas sem classificação e sem cor de alerta — ausência de amostra nunca vira nota zero"
      />

      <RodapeFontes
        fontes={["negócios", "wa_mensagens", "visitas", "avaliações de conversa"]}
        pendencias={["escala/ponto não integrado", "comissão individual só para CEO e Financeiro"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  ativos: 6,
  melhor: 9,
  pior: 41,
  conversaoMedia: 7.5,
  corretores: [
    { nome: "Ana Beatriz", equipe: "Venda", primeiraResposta: 9, negocios: 52, visitas: 28, conversao: 9.6, vencidos: 3, det: { titulo: "Ana Beatriz", sub: "equipe Venda", linhas: [["Negócios", "52"], ["1º contato (mediana)", "9 min"], ["Visitas", "28"], ["Vendas", "5"]], aviso: "Comissão individual só para CEO e Financeiro." } },
    { nome: "Carlos Mendes", equipe: "Locação", primeiraResposta: 14, negocios: 48, visitas: 21, conversao: 8.3, vencidos: 12, det: { titulo: "Carlos Mendes", sub: "equipe Locação", linhas: [["Negócios", "48"], ["Carga", "46 de 40"], ["Mensagens sem retorno", "12"], ["Locações", "4"]], aviso: "Sobrecarga é contexto obrigatório antes de qualquer cobrança." } },
    { nome: "Fernanda Lima", equipe: "Venda", primeiraResposta: 22, negocios: 45, visitas: 18, conversao: 6.7, vencidos: 8, det: { titulo: "Fernanda Lima", sub: "equipe Venda", linhas: [["Negócios", "45"], ["1º contato (mediana)", "22 min"], ["Conversas avaliadas", "5 — abaixo do mínimo"], ["Nota de qualidade", "— não exibida"]], aviso: "Sem amostra de 8 conversas, a nota de qualidade não é exibida." } },
    { nome: "Rafael Souza", equipe: "Locação", primeiraResposta: 41, negocios: 38, visitas: 12, conversao: 5.3, vencidos: 14, det: { titulo: "Rafael Souza", sub: "equipe Locação", linhas: [["Negócios", "38"], ["P90 no sábado", "3h20"], ["Follow-ups vencidos", "14"], ["Coaching", "retomada de proposta"]], aviso: "Uso do ERP não é jornada de trabalho: ausência de registro não é preguiça." } },
    { nome: "Letícia Alves", equipe: "Venda", primeiraResposta: 12, negocios: 31, visitas: 14, conversao: 7.1, vencidos: 5, det: { titulo: "Letícia Alves", sub: "equipe Venda", linhas: [["Negócios", "31"], ["1º contato (mediana)", "12 min"], ["Visitas", "14"], ["Vendas", "2"]], aviso: "Comissão individual só para CEO e Financeiro." } },
    { nome: "Pedro Costa", equipe: "Locação", primeiraResposta: null, negocios: 18, visitas: 2, conversao: null, vencidos: 0, novato: true, det: { titulo: "Pedro Costa", sub: "admitido há 9 dias", linhas: [["Leads", "18"], ["Atendimentos", "6"], ["Nota de qualidade", "— não exibida"], ["Regra", "mínimo de 8"]], aviso: "Sem amostra não há classificação — nem para o gestor, nem para ele." } },
  ],
  atualizado: "14:28",
};
