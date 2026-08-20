"use client";

import { useMemo, useState } from "react";
import type { PropsTela } from "../CascaInteligencia";
import { fmt, RodapeFontes } from "../dado";
import { Banner, Cabecalho, GradeKpis, Tabela } from "../pecas";
import { useResumoInteligencia, type CorretorOperacao } from "../usar-resumo";

function pior<T>(linhas: T[], valor: (linha: T) => number | null | undefined) {
  return linhas.reduce<T | null>((atual, linha) => !atual || (valor(linha) ?? -1) > (valor(atual) ?? -1) ? linha : atual, null);
}

function melhorConversao(linhas: CorretorOperacao[]) {
  return linhas
    .filter((linha) => linha.leads_novos >= 5 && linha.conversao_lead_visita !== null)
    .sort((a,b) => (b.conversao_lead_visita ?? 0) - (a.conversao_lead_visita ?? 0))[0] ?? null;
}

function Fonte({ nome, status, motivo }: { nome: string; status: string; motivo?: string }) {
  return <div className={`int-operacao-fonte status-${status}`}><i /><span><strong>{nome}</strong>{motivo ? ` — ${motivo}` : ""}</span></div>;
}

export function VisaoEmpresa({ accessToken, recorte }: PropsTela) {
  const { data, loading, error } = useResumoInteligencia(accessToken, recorte.periodo);
  const operacao = data?.operacao;
  const resumo = operacao?.operacao;
  const equipe = useMemo(() => operacao?.equipe ?? [], [operacao?.equipe]);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);

  const maisCritico = useMemo(() => pior(equipe, (linha) => linha.carteira_critica), [equipe]);
  const maisLento = useMemo(() => pior(equipe, (linha) => linha.resposta_mediana_min), [equipe]);
  const maisCancela = useMemo(() => pior(equipe, (linha) => linha.visitas_canceladas), [equipe]);
  const melhor = useMemo(() => melhorConversao(equipe), [equipe]);

  const selecionado = equipe.find((linha) => linha.corretor_id === selecionadoId) ?? maisCritico ?? equipe[0];

  if (loading) return <Banner tom="tint-roxo" forte="Carregando a operação real." texto="CRM, visitas, vendas, presença e qualidade estão sendo reconciliados." />;
  if (error) return <Banner forte="A Inteligência não respondeu." texto={error} />;

  const linhas = equipe.map((linha) => ({
    chave: String(linha.corretor_id),
    abrir: () => setSelecionadoId(linha.corretor_id),
    destaque: linha.corretor_id === selecionado?.corretor_id,
    celulas: [
      { texto: linha.nome, forte: true, sub: linha.no_escritorio_agora ? "no escritório agora" : undefined },
      { texto: fmt.inteiro(linha.leads_novos), num: true },
      { texto: fmt.inteiro(linha.carteira_aberta), num: true },
      { texto: fmt.inteiro(linha.carteira_critica), num: true, cor: linha.carteira_critica > 0 ? "#D93E3E" : undefined },
      { texto: fmt.duracaoMin(linha.resposta_mediana_min), num: true, cor: (linha.resposta_mediana_min ?? 0)>60 ? "#D93E3E" : undefined },
      { texto: `${fmt.inteiro(linha.visitas_realizadas)} / ${fmt.inteiro(linha.visitas_canceladas)}`, num: true },
      { texto: fmt.porcento(linha.realizacao_visita,0), num: true, forte: true },
      { texto: fmt.inteiro(linha.vendas), num: true },
      { texto: fmt.dinheiro(linha.vgv), num: true },
      { texto: linha.nota_ia === null ? "—" : `${linha.nota_ia.toFixed(1).replace(".",",")}/100`, num: true },
      { texto: fmt.inteiro(linha.dias_presenca), num: true },
    ],
  }));

  return (
    <div className="int-secao">
      <section className="int-decisao-resumo">
        <div>
          <span className="intp-cab-eyebrow">LEITURA DO DONO</span>
          <h2>{(resumo?.carteira_critica ?? 0) > 0 ? `${fmt.inteiro(resumo?.carteira_critica)} negócios precisam de ação` : "A carteira não tem sinal crítico no recorte"}</h2>
          <p>Prioridade: corrigir oportunidade esquecida, melhorar conversão em visita e reconhecer quem produz melhor com os leads que recebe.</p>
        </div>
        <strong className={(resumo?.sem_primeira_resposta ?? 0)>0 ? "ruim" : "bom"}>{fmt.inteiro(resumo?.sem_primeira_resposta)} sem 1ª resposta</strong>
      </section>

      <Cabecalho eyebrow="O QUE FAZER AGORA" titulo="A central já interpreta a operação" cor="#8B00CC" />
      <div className="int-decisao-acoes">
        <article className="critico">
          <span>1 · LIMPAR CARTEIRA</span>
          <h3>{maisCritico ? `${maisCritico.nome}: ${fmt.inteiro(maisCritico.carteira_critica)} negócios críticos` : "Sem carteira crítica"}</h3>
          <p>Antes de entregar mais leads, definir próxima ação ou encerrar oportunidades sem movimento.</p>
        </article>
        <article className={(maisLento?.resposta_mediana_min ?? 0)>60 ? "critico" : "atencao"}>
          <span>2 · CORRIGIR VELOCIDADE</span>
          <h3>{maisLento ? `${maisLento.nome}: mediana de ${fmt.duracaoMin(maisLento.resposta_mediana_min)}` : "Sem amostra de primeira resposta"}</h3>
          <p>Tempo alto de resposta reduz a chance de visita. O gestor deve atacar a fila, não apenas cobrar volume.</p>
        </article>
        <article className={melhor ? "positivo" : "atencao"}>
          <span>3 · DISTRIBUIR MELHOR</span>
          <h3>{melhor ? `${melhor.nome} converte ${fmt.porcento(melhor.conversao_lead_visita,1)} dos leads em visita` : "Ainda não há amostra suficiente"}</h3>
          <p>{melhor ? "A eficiência indica capacidade para receber mais oportunidades, desde que a carteira crítica permaneça controlada." : "A distribuição deve esperar uma amostra mínima de cinco leads."}</p>
        </article>
        <article className={(maisCancela?.visitas_canceladas ?? 0)>0 ? "atencao" : "positivo"}>
          <span>4 · QUALIFICAR VISITAS</span>
          <h3>{maisCancela ? `${maisCancela.nome}: ${fmt.inteiro(maisCancela.visitas_canceladas)} visitas canceladas` : "Sem cancelamentos no período"}</h3>
          <p>Cancelamento alto pede revisão de qualificação, confirmação e aderência do imóvel ao cliente.</p>
        </article>
      </div>

      <Cabecalho eyebrow="SAÚDE COMERCIAL" titulo="Poucos números para entender a empresa" nota={recorte.periodo} />
      <GradeKpis colunas={6} itens={[
        { rotulo: "Leads novos", bruto: resumo?.leads_novos, texto: fmt.inteiro(resumo?.leads_novos), tile: "laranja", foot: "aquisição operacional do período" },
        { rotulo: "Carteira crítica", bruto: resumo?.carteira_critica, texto: fmt.inteiro(resumo?.carteira_critica), tile: "vermelho", tom: (resumo?.carteira_critica ?? 0)>0 ? "ruim" : "bom", foot: `${fmt.inteiro(resumo?.carteira_aberta)} negócios abertos agora` },
        { rotulo: "Lead → visita", bruto: resumo?.conversao_lead_visita, texto: fmt.porcento(resumo?.conversao_lead_visita,1), tile: "verde", foot: "visitas realizadas" },
        { rotulo: "Visitas realizadas", bruto: resumo?.visitas_realizadas, texto: fmt.inteiro(resumo?.visitas_realizadas), tile: "roxo", foot: `${fmt.inteiro(resumo?.visitas_canceladas)} canceladas` },
        { rotulo: "Vendas e VGV", bruto: resumo?.vendas, texto: `${fmt.inteiro(resumo?.vendas)} · ${fmt.dinheiro(resumo?.vgv)}`, tile: "verde", foot: `ticket ${fmt.dinheiro(resumo?.ticket_medio)}` },
        { rotulo: "Qualidade da IA", bruto: resumo?.nota_ia, texto: resumo?.nota_ia === null || resumo?.nota_ia === undefined ? "—" : `${resumo.nota_ia.toFixed(1).replace(".",",")}/100`, tile: "roxo", foot: `${fmt.inteiro(resumo?.avaliacoes_ia)} avaliações` },
      ]} />

      <Cabecalho eyebrow="CORRETOR POR CORRETOR" titulo="Trabalho, conversão e resultado na mesma régua" nota="clique em uma linha para aprofundar sem abrir outra tela" />
      <Tabela
        colunas={[
          { titulo: "Corretor" }, { titulo: "Leads", num: true }, { titulo: "Carteira", num: true }, { titulo: "Críticos", num: true }, { titulo: "Resposta", num: true },
          { titulo: "Visitas R/C", num: true }, { titulo: "Realização", num: true }, { titulo: "Vendas", num: true }, { titulo: "VGV", num: true }, { titulo: "Nota IA", num: true }, { titulo: "Presenças", num: true },
        ]}
        linhas={linhas}
        ordenadaEm="VGV"
        foot="R/C = realizadas / canceladas. Presença é confirmação por dia; não representa jornada completa."
      />

      {selecionado ? (
        <section className="int-corretor-foco">
          <div className="int-corretor-foco-topo">
            <div><span className="intp-cab-eyebrow">CORRETOR EM FOCO</span><h2>{selecionado.nome}</h2></div>
            <span>{selecionado.no_escritorio_agora ? "No escritório agora" : `última presença ${fmt.hora(selecionado.ultima_presenca)}`}</span>
          </div>
          <div className="int-corretor-grade">
            <article>
              <h3>Carteira e velocidade</h3>
              <dl><div><dt>Leads novos</dt><dd>{fmt.inteiro(selecionado.leads_novos)}</dd></div><div><dt>Carteira aberta</dt><dd>{fmt.inteiro(selecionado.carteira_aberta)}</dd></div><div><dt>Críticos</dt><dd>{fmt.inteiro(selecionado.carteira_critica)}</dd></div><div><dt>Sem 1ª resposta</dt><dd>{fmt.inteiro(selecionado.sem_primeira_resposta)}</dd></div><div><dt>Resposta mediana</dt><dd>{fmt.duracaoMin(selecionado.resposta_mediana_min)}</dd></div></dl>
            </article>
            <article>
              <h3>Visitas e resultado</h3>
              <dl><div><dt>Agendadas</dt><dd>{fmt.inteiro(selecionado.visitas_agendadas)}</dd></div><div><dt>Realizadas</dt><dd>{fmt.inteiro(selecionado.visitas_realizadas)}</dd></div><div><dt>Canceladas</dt><dd>{fmt.inteiro(selecionado.visitas_canceladas)}</dd></div><div><dt>Vendas</dt><dd>{fmt.inteiro(selecionado.vendas)}</dd></div><div><dt>Ticket médio</dt><dd>{fmt.dinheiro(selecionado.ticket_medio)}</dd></div></dl>
            </article>
            <article>
              <h3>Atendimento observado</h3>
              <dl><div><dt>Nota da IA</dt><dd>{selecionado.nota_ia === null ? "—" : `${selecionado.nota_ia.toFixed(1).replace(".",",")}/100`}</dd></div><div><dt>Mensagens</dt><dd>{fmt.inteiro(selecionado.mensagens_texto)}</dd></div><div><dt>Áudios</dt><dd>{fmt.inteiro(selecionado.audios)}</dd></div><div><dt>Imagens</dt><dd>{fmt.inteiro(selecionado.imagens)}</dd></div><div><dt>Follow-ups vencidos</dt><dd>{fmt.inteiro(selecionado.followups_vencidos)}</dd></div></dl>
            </article>
            <article>
              <h3>Presença e captação</h3>
              <dl><div><dt>Dias com presença</dt><dd>{fmt.inteiro(selecionado.dias_presenca)}</dd></div><div><dt>Imóveis captados</dt><dd>{fmt.inteiro(selecionado.captacoes)}</dd></div><div><dt>Horas no ERP</dt><dd>—</dd></div><div><dt>Pulos na roleta</dt><dd>—</dd></div></dl>
              <small>{selecionado.horas_erp_motivo} {selecionado.pulos_distribuicao_motivo}</small>
            </article>
          </div>
          <div className="int-corretor-etapas">
            <h3>Carteira por etapa do Funil 2.0</h3>
            <div>{selecionado.etapas.map((etapa) => <span key={etapa.etapa}><b>{etapa.quantidade}</b>{etapa.etapa}</span>)}</div>
          </div>
        </section>
      ) : null}

      <section className="int-operacao-fontes">
        <Cabecalho eyebrow="CONFIABILIDADE" titulo="O que está medido — sem o aviso genérico de CRM pendente" cor="#8B00CC" />
        <div>{(operacao?.fontes ?? []).map((fonte) => <Fonte key={fonte.nome} {...fonte} />)}</div>
      </section>

      <RodapeFontes
        fontes={["CRM Funil 2.0", "visitas", "vendas", "perf_eventos", "ia_notas_atendimento", "corretor_presencas"]}
        pendencias={["sessão individual para horas reais", "histórico de elegibilidade/pulo da roleta"]}
        atualizado={fmt.hora(operacao?.atualizado_em)}
      />
    </div>
  );
}
