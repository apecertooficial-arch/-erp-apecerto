"use client";

/* CENTRAL DE ALERTAS — artboard 21a.
 * Gravidade, evidência, dono e ação. Alerta sem dono é alerta perdido: a tela
 * exige o responsável na própria linha. Resolver, atribuir e reconhecer ficam
 * registrados na Auditoria.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, GradeKpis, ListaComDetalhe, type Detalhe, type Kpi } from "../pecas";

type Alerta = { chave: string; nome: string; area: string; gravidade: "crítico" | "atenção"; dono: string; det: Detalhe; ir?: string };
type Dados = { criticos: number | null; atencao: number | null; reconhecidos: number | null; resolvidos: number | null; alertas: Alerta[]; atualizado: string };

export function CentralAlertas({ recorte }: PropsTela) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [reconhecidos, setReconhecidos] = useState<string[]>([]);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Críticos", bruto: d.criticos, texto: fmt.inteiro(d.criticos), tom: "ruim", tile: "vermelho", foot: "todos com dono definido" },
    { rotulo: "Atenção", bruto: d.atencao, texto: fmt.inteiro(d.atencao), tom: "atencao", tile: "ambar", foot: "sem prazo estourado" },
    { rotulo: "Reconhecidos", bruto: d.reconhecidos, texto: fmt.inteiro((d.reconhecidos ?? 0) + reconhecidos.length), tile: "roxo", foot: "em acompanhamento" },
    { rotulo: "Resolvidos", bruto: d.resolvidos, texto: fmt.inteiro(d.resolvidos), tom: "bom", tile: "verde", foot: "nos últimos 30 dias" },
  ];

  const criticos = d.alertas.filter((a) => a.gravidade === "crítico");

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="O QUE EXIGE AÇÃO HOJE" titulo="Com prova e responsável" nota={`${recorte.periodo} · filas críticas em tempo real`} />
      <GradeKpis itens={kpis} colunas={4} />

      <ListaComDetalhe
        eyebrow="OS CRÍTICOS"
        titulo="Abertos agora"
        nota="resolver, atribuir e reconhecer ficam registrados na Auditoria · alerta reconhecido continua na lista até ser resolvido"
        linhas={criticos.map((a) => ({
          chave: a.chave,
          nome: a.nome,
          meio: `${a.area} · ${a.dono}`,
          fim: reconhecidos.includes(a.chave) ? "reconhecido" : "crítico",
          cor: reconhecidos.includes(a.chave) ? "#8B00CC" : "#D93E3E",
          abrir: () => setDetalhe(a.det),
        }))}
        detalhe={detalhe}
        fechar={() => setDetalhe(null)}
        rodape={
          <CartoesLista
            colunas={1}
            cartoes={[
              {
                titulo: "Ações do alerta aberto",
                chip: "nada executa sozinho",
                chipTom: "aviso",
                linhas: criticos.slice(0, 3).map((a) => ({
                  l: a.nome,
                  r: reconhecidos.includes(a.chave) ? "reconhecido ✓" : "reconhecer",
                  abrir: () => setReconhecidos((atuais) => (atuais.includes(a.chave) ? atuais : [...atuais, a.chave])),
                })),
                foot: "reconhecer registra quem viu e quando; não fecha o alerta e não altera dado do ERP",
              },
            ]}
          />
        }
      />

      <Cabecalho eyebrow="PARA ONDE CADA ALERTA LEVA" titulo="O alerta é a porta, não o destino" cor="#8B00CC" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Atendimento", linhas: [{ l: "9 leads sem primeira resposta", r: "abrir →", abrir: () => recorte.irPara("atendimento") }, { l: "44 mensagens sem retorno", r: "abrir →", abrir: () => recorte.irPara("atendimento") }], foot: "a ação acontece no Funil 2.0" },
          { titulo: "Financeiro", linhas: [{ l: "2 vendas sem % de comissão", r: "abrir →", abrir: () => recorte.irPara("financeiro") }, { l: "1 repasse sem data", r: "abrir →", abrir: () => recorte.irPara("financeiro") }], foot: "valores só para quem tem acesso financeiro" },
          { titulo: "Dado e tracking", linhas: [{ l: "7 leads sem sincronizar", r: "abrir →", abrir: () => recorte.irPara("privacidade") }, { l: "UTMs ausentes em 3 anúncios", r: "abrir →", abrir: () => recorte.irPara("privacidade") }], foot: "pessoa que pediu contato e ninguém viu é prioridade máxima" },
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
    { chave: "sem-resposta", nome: "9 leads sem primeira resposta", area: "atendimento", gravidade: "crítico", dono: "Marcos Vilela", det: { titulo: "Leads sem resposta", sub: "regra: SLA de 5 min", linhas: [["Volume", "9"], ["Dono", "Marcos Vilela"], ["Espera máxima", "1h52"], ["Ação", "distribuir e chamar"]], aviso: "Abre a fila em Atendimento e SLA, onde a ação acontece." } },
    { chave: "sync", nome: "7 leads sem sincronizar com o CRM", area: "tracking", gravidade: "crítico", dono: "produto", det: { titulo: "Leads sem sincronizar", sub: "site → Funil 2.0", linhas: [["Volume", "7"], ["Desde", "14 ago"], ["Dono", "produto"], ["Ação", "reprocessar fila"]], aviso: "Pessoas que pediram contato e ninguém viu: prioridade máxima." } },
    { chave: "carga", nome: "Carlos sobrecarregado", area: "carga", gravidade: "crítico", dono: "Marcos Vilela", det: { titulo: "Sobrecarga", sub: "46 de 40 negócios", linhas: [["Acima da capacidade", "15%"], ["Dono", "Marcos Vilela"], ["Sugestão", "mover 6 para Pedro"], ["Efeito esperado", "SLA +8 pp"]], aviso: "Sugestão gerada por regra; a decisão é do gerente." } },
    { chave: "comissao", nome: "2 vendas sem % de comissão", area: "financeiro", gravidade: "crítico", dono: "Financeiro", det: { titulo: "Comissão bloqueada", sub: "cálculo suspenso", linhas: [["Vendas", "2"], ["Valor envolvido", "R$ 1,9 mi"], ["Dono", "Financeiro"], ["Ação", "preencher o percentual"]], aviso: "Comissão nunca é estimada por média." } },
    { chave: "sabado", nome: "Sábado sem cobertura", area: "escala", gravidade: "crítico", dono: "Marcos Vilela", det: { titulo: "Cobertura de sábado", sub: "18% no SLA", linhas: [["Leads no sábado", "62"], ["Atendidos no prazo", "11"], ["Dono", "Marcos Vilela"], ["Ação", "definir plantão"]], aviso: "Sem escala integrada, a tela mostra atividade, não ausência." } },
  ],
  atualizado: "14:32",
};
