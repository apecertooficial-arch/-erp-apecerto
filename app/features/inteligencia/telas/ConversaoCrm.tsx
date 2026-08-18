"use client";

/* CONVERSÃO E CRM — artboard 5a.
 * O que acontece depois que o lead entra: do primeiro contato à chave na mão.
 * O funil aqui é o comercial (9 etapas, com “perdido” fechando a lista).
 *
 * Auditoria de fidelidade: a JORNADA DO LEAD do artboard virou a gaveta lateral
 * de 420px, com a linha do tempo do atendimento — sem IP bruto e sem user agent.
 */

import { useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Cabecalho, CartoesLista, Funil, GavetaLateral, GradeKpis, LinhaDoTempo, type Etapa, type Kpi } from "../pecas";

type Jornada = { titulo: string; quando: string; cor: string };

type Dados = {
  primeiroAtendimento: number | null;
  semAtendimento: number | null;
  parados: number | null;
  taxaPerda: number | null;
  variacaoPerda: number | null;
  pipelineValor: number | null;
  valorFechado: number | null;
  etapas: { nome: string; volume: number | null; largura: number | null; taxa?: string; perda?: string; perdaFinal?: boolean }[];
  tempos: { l: string; r: string }[];
  motivos: { l: string; r: string }[];
  porCorretor: { l: string; r: string; sub?: string; corR?: string }[];
  lead: { nome: string; papel: string; entrada: string; corretora: string; jornada: Jornada[] };
  atualizado: string;
};

export function ConversaoCrm({ recorte }: PropsTela) {
  const [motivoAberto, setMotivoAberto] = useState<string | null>(null);
  const [jornadaAberta, setJornada] = useState(false);
  const d = usarDados();

  const kpis: Kpi[] = [
    { rotulo: "Tempo até 1º atendimento", bruto: d.primeiroAtendimento, texto: fmt.duracaoMin(d.primeiroAtendimento), tom: "atencao", tile: "ambar", foot: "mediana · meta 5 min" },
    { rotulo: "Leads sem atendimento", bruto: d.semAtendimento, texto: fmt.inteiro(d.semAtendimento), tom: "ruim", tile: "vermelho", foot: "fila aberta agora" },
    { rotulo: "Negócios parados", bruto: d.parados, texto: fmt.inteiro(d.parados), tom: "atencao", tile: "laranja", foot: "sem movimento há 7+ dias" },
    { rotulo: "Taxa de perda", bruto: d.taxaPerda, texto: fmt.porcento(d.taxaPerda), tom: "ruim", tile: "vermelho", chip: fmt.pontos(d.variacaoPerda), chipTom: "ruim", foot: "dos negócios criados" },
    { rotulo: "Valor de pipeline", bruto: d.pipelineValor, texto: fmt.dinheiro(d.pipelineValor), tile: "roxo", icone: "dinheiro", motivo: "integracao", detalhe: "campo de valor ausente no Funil 2.0", foot: "aparece quando o campo existir — nunca zero fictício" },
  ];

  const etapas: Etapa[] = d.etapas.map((e) => ({
    nome: e.nome,
    largura: e.largura,
    volume: e.volume,
    volumeTexto: fmt.inteiro(e.volume),
    taxa: e.taxa,
    perda: e.perda,
    perdaFinal: e.perdaFinal,
    detalhes: () => recorte.filtrar(`Etapa: ${e.nome}`),
  }));

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="DEPOIS QUE O LEAD ENTRA" titulo="Do primeiro contato à chave na mão" nota={`${recorte.periodo}${recorte.compararAnterior ? " · vs. anterior" : ""}`} />
      <GradeKpis itens={kpis} colunas={5} />

      <Cabecalho eyebrow="FUNIL COMERCIAL" titulo="Onde os negócios param" cor="#8B00CC" nota="taxa sobre a etapa anterior · perdido = % dos negócios criados" />
      <Funil etapas={etapas} foot="“detalhes” filtra a página pela etapa · etapa sem dado mostra “—” e continua na lista" />

      <Cabecalho eyebrow="ONDE O TEMPO E OS NEGÓCIOS SE PERDEM" titulo="Tempos, motivos e conversão por corretor" />
      <CartoesLista
        colunas={3}
        cartoes={[
          { titulo: "Tempo mediano entre etapas", linhas: d.tempos, foot: "etapa sem registro de data aparece com “—”" },
          {
            titulo: "Motivos de perda · 112",
            linhas: d.motivos.map((m) => ({ ...m, sub: motivoAberto === m.l ? "recorte aplicado à página" : undefined, abrir: () => { setMotivoAberto(m.l); recorte.filtrar(`Motivo: ${m.l}`); } })),
            foot: "clicar num motivo filtra a página inteira",
          },
          { titulo: "Conversão por corretor", linhas: d.porCorretor, foot: "verde ≤5 min · âmbar 5–15 · vermelho >15", link: { rotulo: "Abrir Corretores →", go: () => recorte.irPara("corretores") } },
        ]}
      />

      <CartoesLista
        colunas={2}
        cartoes={[
          {
            titulo: "Jornada individual",
            chip: "gaveta",
            chipTom: "roxo",
            linhas: [{ l: `${d.lead.nome} · ${d.lead.papel}`, r: "abrir a linha do tempo →", abrir: () => setJornada(true) }],
            foot: "a jornada abre sem IP bruto e sem user agent — só o que serve para atender a pessoa",
          },
          {
            titulo: "Pipeline e valor fechado",
            linhas: [
              { l: "Valor de pipeline", r: fmt.dinheiro(d.pipelineValor), corR: "#8A6A15" },
              { l: "Valor fechado", r: fmt.dinheiro(d.valorFechado), corR: "#8A6A15" },
            ],
            foot: "os dois aparecem quando o campo de valor existir no Funil 2.0 — nunca zero fictício",
          },
        ]}
      />

      <GavetaLateral
        aberta={jornadaAberta}
        titulo={`${d.lead.nome} — jornada do lead`}
        sub={`${d.lead.papel} · entrou ${d.lead.entrada} · ${d.lead.corretora}`}
        fechar={() => setJornada(false)}
        rodape={
          <>
            <button type="button" className="cop-acao" onClick={() => recorte.filtrar(`Lead: ${d.lead.nome}`)}>Filtrar a página por este lead</button>
            <button type="button" className="cop-acao" onClick={() => recorte.irPara("atendimento")}>Abrir a fila de atendimento →</button>
          </>
        }
      >
        <LinhaDoTempo eventos={d.lead.jornada} />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="intp-detalhe-linha"><span>Tempo até o primeiro contato</span><b>9 min</b></div>
          <div className="intp-detalhe-linha"><span>Etapa atual</span><b>Visita agendada</b></div>
          <div className="intp-detalhe-linha"><span>Valor do negócio</span><b>—</b></div>
          <div className="intp-detalhe-linha"><span>Telefone e e-mail</span><b>—</b></div>
        </div>
        <div className="intp-detalhe-aviso">
          Sem IP bruto, sem user agent, sem identificador técnico. Telefone e e-mail dependem de permissão de dados pessoais e ficam com “—” aqui; o valor do negócio aparece quando o campo existir no Funil 2.0.
        </div>
      </GavetaLateral>

      <RodapeFontes
        fontes={["leads", "negócios", "wa_mensagens", "motivos de perda", "visitas"]}
        pendencias={["valor de pipeline e valor fechado (campo ausente no CRM)", "dados pessoais do lead dependem de permissão"]}
        atualizado={d.atualizado}
      />
    </div>
  );
}

function usarDados(): Dados {
  return demo;
}

const demo: Dados = {
  primeiroAtendimento: 18,
  semAtendimento: 9,
  parados: 21,
  taxaPerda: 38.5,
  variacaoPerda: 2.1,
  pipelineValor: null,
  valorFechado: null,
  etapas: [
    { nome: "Lead recebido", volume: 486, largura: 100, taxa: "100%" },
    { nome: "Negócio criado", volume: 291, largura: 60, taxa: "59,9%", perda: "−195" },
    { nome: "Distribuído para corretor", volume: 285, largura: 59, taxa: "97,9%", perda: "−6" },
    { nome: "Primeiro contato", volume: 255, largura: 53, taxa: "89,5%", perda: "−30" },
    { nome: "Qualificado", volume: 128, largura: 41, taxa: "50,2%", perda: "−127" },
    { nome: "Visita agendada", volume: 96, largura: 31, taxa: "75,0%", perda: "−32" },
    { nome: "Proposta", volume: 46, largura: 15, taxa: "47,9%", perda: "−50" },
    { nome: "Venda ou locação", volume: 21, largura: 7, taxa: "45,7%", perda: "−25" },
    { nome: "Perdido", volume: 112, largura: 23, taxa: "38,5%", perdaFinal: true },
  ],
  tempos: [
    { l: "Distribuição → 1º contato", r: "18 min" },
    { l: "1º contato → qualificado", r: "1,4 d" },
    { l: "Qualificado → visita", r: "2,8 d" },
    { l: "Proposta → fechamento", r: "8,5 d" },
  ],
  motivos: [
    { l: "Sem resposta", r: "38" },
    { l: "Preço acima do orçamento", r: "27" },
    { l: "Fechou com outra imobiliária", r: "19" },
    { l: "Adiou a mudança", r: "16" },
    { l: "Sem motivo registrado", r: "12" },
  ],
  porCorretor: [
    { l: "Ana Beatriz", r: "52 neg · 9 min · 9,6%", sub: "1º contato âmbar: acima da meta de 5 min" },
    { l: "Carlos Mendes", r: "48 · 14 min · 8,3%" },
    { l: "Fernanda Lima", r: "45 · 22 min · 6,7%" },
    { l: "Rafael Souza", r: "38 · 41 min · 5,3%", corR: "#D93E3E" },
  ],
  lead: {
    nome: "Mariana C.",
    papel: "compradora",
    entrada: "12 ago, 14:07",
    corretora: "corretora Ana Beatriz",
    jornada: [
      { titulo: "Chegou pelo Instagram (bio)", quando: "12 ago 13:52 · entrou pela home", cor: "#FF9A4D" },
      { titulo: "Buscou imóveis", quando: "13:55 · Moema · 2 dorms · até R$ 5.500/mês", cor: "#FF9A4D" },
      { titulo: "Abriu o Apê Canário 71 · MO-104", quando: "13:58 · viu 12 fotos · leu até o fim", cor: "#FF9A4D" },
      { titulo: "Chamou no WhatsApp", quando: "14:05 · na página do imóvel", cor: "#FF7000" },
      { titulo: "Virou lead e entrou no Funil 2.0", quando: "14:07 · negócio criado automaticamente", cor: "#8B00CC" },
      { titulo: "Distribuída para Ana Beatriz", quando: "14:11 · regra de rodízio da equipe", cor: "#8B00CC" },
      { titulo: "Primeiro contato em 9 minutos", quando: "14:16 · 4 min acima da meta de 5 min", cor: "#B5700A" },
      { titulo: "Visita agendada", quando: "15 ago · sábado, 10h · em atendimento", cor: "#1FA85A" },
    ],
  },
  atualizado: "14:28",
};
