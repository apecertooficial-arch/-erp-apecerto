"use client";

/* 17 · CENTRAL DE ALERTAS — artboard 21a, na íntegra.
 *
 * Ordem dos blocos igual à do desenho:
 *   1. quatro números por gravidade
 *   2. os cinco críticos (lista + detalhe), com dono na linha
 *   3. reconhecer / acompanhar
 *   4. tabela completa dos alertas, com gravidade, dono e prazo
 *   5. resolvidos nos últimos 30 dias · para onde cada alerta leva
 *   6. rodapé de fontes
 *
 * Alerta sem dono é alerta perdido: a tela exige o responsável na própria linha.
 * Reconhecer registra quem viu e quando — não fecha o alerta e não altera dado.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, ListaComDetalhe, Tabela, type Detalhe, type Kpi } from "../pecas";

type Alerta = { chave: string; nome: string; area: string; gravidade: "crítico" | "atenção"; dono: string; prazo: string; alvo: string; det: Detalhe };
type Dados = {
  criticos: number | null;
  atencao: number | null;
  reconhecidos: number | null;
  resolvidos: number | null;
  alertas: Alerta[];
  resolvidosLista: { l: string; r: string; sub?: string }[];
  atualizado: string;
};

export function CentralAlertas({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [reconhecidos, setReconhecidos] = useState<string[]>([]);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Críticos", bruto: d.criticos, texto: fmt.inteiro(d.criticos), tom: "ruim", tile: "vermelho", foot: "todos com dono definido" },
    { rotulo: "Atenção", bruto: d.atencao, texto: fmt.inteiro(d.atencao), tom: "atencao", tile: "ambar", foot: "sem prazo estourado" },
    { rotulo: "Reconhecidos", bruto: (d.reconhecidos ?? 0) + reconhecidos.length, texto: fmt.inteiro((d.reconhecidos ?? 0) + reconhecidos.length), tile: "roxo", foot: "em acompanhamento" },
    { rotulo: "Resolvidos", bruto: d.resolvidos, texto: fmt.inteiro(d.resolvidos), tom: "bom", tile: "verde", foot: "nos últimos 30 dias" },
  ];

  const criticos = d.alertas.filter((a) => a.gravidade === "crítico");

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="O QUE EXIGE AÇÃO HOJE" titulo="Com prova e responsável" nota="filas críticas em tempo real" />
      <GradeKpis itens={kpis} colunas={4} />

      <ListaComDetalhe
        eyebrow="OS CINCO CRÍTICOS"
        titulo="Abertos agora"
        nota="resolver, atribuir e reconhecer ficam registrados na Auditoria · alerta reconhecido continua na lista até ser resolvido"
        linhas={criticos.map((a) => ({
          chave: a.chave,
          nome: a.nome,
          meio: `${a.area} · ${a.dono}`,
          fim: reconhecidos.includes(a.chave) ? "reconhecido" : "crítico",
          cor: reconhecidos.includes(a.chave) ? "#8B00CC" : "#D93E3E",
          ativa: detalhe?.titulo === a.det.titulo,
          abrir: () => setDetalhe(a.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
        rodape={
          <CartoesLista
            colunas={1}
            cartoes={[
              {
                titulo: "Reconhecer e acompanhar",
                chip: "nada executa sozinho",
                chipTom: "aviso",
                linhas: criticos.map((a) => ({
                  l: a.nome,
                  r: reconhecidos.includes(a.chave) ? "reconhecido ✓" : "reconhecer",
                  sub: reconhecidos.includes(a.chave) ? "registrado na Auditoria" : undefined,
                  abrir: () => setReconhecidos((atuais) => (atuais.includes(a.chave) ? atuais : [...atuais, a.chave])),
                })),
                foot: "reconhecer registra quem viu e quando; não fecha o alerta e não altera dado do ERP",
              },
            ]}
          />
        }
      />

      <Cabecalho eyebrow="TODOS OS ALERTAS" titulo="Gravidade, dono e prazo em uma linha" cor="#8B00CC" nota="clique na linha para abrir a evidência · clique no cabeçalho para ordenar" />
      <Tabela
        colunas={[{ titulo: "Alerta" }, { titulo: "Área" }, { titulo: "Gravidade" }, { titulo: "Dono" }, { titulo: "Prazo" }, { titulo: "Situação" }]}
        linhas={d.alertas.map((a) => ({
          chave: `t-${a.chave}`,
          destaque: a.gravidade === "crítico",
          abrir: () => setDetalhe(a.det),
          celulas: [
            { texto: a.nome, forte: true },
            { texto: a.area },
            a.gravidade === "crítico" ? { texto: "", chip: "crítico", chipTom: "ruim" as const } : { texto: "", chip: "atenção", chipTom: "aviso" as const },
            { texto: a.dono },
            { texto: a.prazo },
            reconhecidos.includes(a.chave) ? { texto: "", chip: "reconhecido", chipTom: "roxo" as const } : { texto: "", chip: "aberto", chipTom: "neutro" as const },
          ],
        }))}
        foot="alerta sem dono não entra nesta lista — apareceria como pendência de configuração da regra"
      />

      <Cabecalho eyebrow="HISTÓRICO E CAMINHOS" titulo="O que foi resolvido e para onde cada alerta leva" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Resolvidos · 30 dias", linhas: d.resolvidosLista, foot: "cada resolução fica registrada na Auditoria" },
          { titulo: "Atendimento", linhas: [{ l: "9 leads sem primeira resposta", r: "abrir →", abrir: () => recorte.irPara("atendimento") }, { l: "44 mensagens sem retorno", r: "abrir →", abrir: () => recorte.irPara("atendimento") }], foot: "a ação acontece no Funil 2.0" },
          { titulo: "Financeiro e dado", linhas: [{ l: "2 vendas sem % de comissão", r: "abrir →", abrir: () => recorte.irPara("financeiro") }, { l: "7 leads sem sincronizar", r: "abrir →", abrir: () => recorte.irPara("privacidade") }], foot: "pessoa que pediu contato e ninguém viu é prioridade máxima" },
        ]}
      />

      <RodapeFontes
        fontes={["motor de regras", "leads", "negócios", "fila de sincronização", "comissões"]}
        pendencias={["escala não integrada — cobertura de sábado é inferida por atividade"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  criticos: 5,
  atencao: 18,
  reconhecidos: 8,
  resolvidos: 23,
  alertas: [
    { chave: "sem-resposta", nome: "9 leads sem primeira resposta", area: "atendimento", gravidade: "crítico", dono: "Marcos Vilela", prazo: "hoje", alvo: "atendimento", det: { titulo: "Leads sem resposta", sub: "regra: SLA de 5 min", linhas: [["Volume", "9"], ["Dono", "Marcos Vilela"], ["Espera máxima", "1h52"], ["Ação", "distribuir e chamar"]], aviso: "Abre a fila em Atendimento e SLA, onde a ação acontece." } },
    { chave: "sync", nome: "7 leads sem sincronizar com o CRM", area: "tracking", gravidade: "crítico", dono: "produto", prazo: "hoje", alvo: "privacidade", det: { titulo: "Leads sem sincronizar", sub: "site → Funil 2.0", linhas: [["Volume", "7"], ["Desde", "14 ago"], ["Dono", "produto"], ["Ação", "reprocessar fila"]], aviso: "Pessoas que pediram contato e ninguém viu: prioridade máxima." } },
    { chave: "carga", nome: "Carlos sobrecarregado", area: "carga", gravidade: "crítico", dono: "Marcos Vilela", prazo: "3 dias", alvo: "corretores", det: { titulo: "Sobrecarga", sub: "46 de 40 negócios", linhas: [["Acima da capacidade", "15%"], ["Dono", "Marcos Vilela"], ["Sugestão", "mover 6 para Pedro"], ["Efeito esperado", "SLA +8 pp"]], aviso: "Sugestão gerada por regra; a decisão é do gerente." } },
    { chave: "comissao", nome: "2 vendas sem % de comissão", area: "financeiro", gravidade: "crítico", dono: "Financeiro", prazo: "hoje", alvo: "financeiro", det: { titulo: "Comissão bloqueada", sub: "cálculo suspenso", linhas: [["Vendas", "2"], ["Valor envolvido", "R$ 1,9 mi"], ["Dono", "Financeiro"], ["Ação", "preencher o percentual"]], aviso: "Comissão nunca é estimada por média." } },
    { chave: "sabado", nome: "Sábado sem cobertura", area: "escala", gravidade: "crítico", dono: "Marcos Vilela", prazo: "7 dias", alvo: "gerentes", det: { titulo: "Cobertura de sábado", sub: "18% no SLA", linhas: [["Leads no sábado", "62"], ["Atendidos no prazo", "11"], ["Dono", "Marcos Vilela"], ["Ação", "definir plantão"]], aviso: "Sem escala integrada, a tela mostra atividade, não ausência." } },
    { chave: "visitas", nome: "12 visitas sem feedback", area: "pós-visita", gravidade: "atenção", dono: "Juliana Prado", prazo: "5 dias", alvo: "atendimento", det: { titulo: "Visitas sem feedback", sub: "12 visitas realizadas", linhas: [["Mais de 48 h", "7"], ["Dono", "Juliana Prado"], ["Efeito", "fora da análise de qualidade"], ["Ação", "cobrar registro"]], aviso: "Sem feedback registrado, a visita não conta para a conversão." } },
    { chave: "utm", nome: "UTMs ausentes em 3 anúncios", area: "atribuição", gravidade: "atenção", dono: "marketing", prazo: "7 dias", alvo: "aquisicao", det: { titulo: "UTMs ausentes", sub: "3 anúncios ativos", linhas: [["Anúncios", "3"], ["Leads sem origem", "41 por mês"], ["Dono", "marketing"], ["Ação", "corrigir os links"]], aviso: "Volume não atribuído nunca é redistribuído entre canais." } },
    { chave: "clarity", nome: "Clarity sem eventos há 3 h", area: "tracking", gravidade: "atenção", dono: "produto", prazo: "hoje", alvo: "comportamento", det: { titulo: "Clarity parado", sub: "fonte parcial", linhas: [["Sem evento há", "3 h"], ["Efeito", "mapas e gravações parciais"], ["Dono", "produto"], ["Ação", "verificar script"]], aviso: "A coleta própria segue de pé: os números do painel não dependem do Clarity." } },
    { chave: "repasse", nome: "1 repasse sem data", area: "financeiro", gravidade: "atenção", dono: "Financeiro", prazo: "3 dias", alvo: "financeiro", det: { titulo: "Repasse sem data", sub: "fora de qualquer mês", linhas: [["Repasses", "1"], ["Efeito", "não entra no fechamento"], ["Dono", "Financeiro"], ["Ação", "datar o repasse"]], aviso: "Sem data, o valor não é atribuído a nenhum período." } },
  ],
  resolvidosLista: [
    { l: "Fila de distribuição travada", r: "16 ago", sub: "dono produto · 2 h para resolver" },
    { l: "5 imóveis sem código", r: "14 ago", sub: "dono cadastro" },
    { l: "Meta de agosto não cadastrada", r: "11 ago", sub: "dono Financeiro" },
  ],
  atualizado: "14:32",
};
