"use client";

/* VISÃO DO DONO
 *
 * Esta tela não tenta resumir a empresa em um "score" inventado. Ela começa
 * pela fotografia disponível, explicita o escopo de cada número e transforma
 * somente fatos observados no banco em prioridades. Dados anuais, do período e
 * de estoque atual nunca são apresentados como se fossem o mesmo recorte.
 */

import "../../../styles/inteligencia-dono.css";
import type { MetaInteligencia, VisaoCeoPayload } from "../../../lib/inteligencia/tipos";
import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt } from "../dado";
import { EsqueletoAviso, EsqueletoCartoes, EsqueletoKpis } from "../esqueleto";
import { Cabecalho, CartoesLista, GradeKpis, IconeInt, type Kpi, type NomeIcone } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";

type TomPrioridade = "critico" | "atencao" | "bom" | "neutro";

type Prioridade = {
  chave: string;
  tom: TomPrioridade;
  etiqueta: string;
  icone: NomeIcone;
  titulo: string;
  explicacao: string;
  evidencia: string;
  alvo: string;
  acao: string;
};

function horaSaoPaulo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function intervaloDaMeta(meta: MetaInteligencia | null): string {
  if (!meta) return "período não informado";
  const inicio = new Date(meta.periodo.inicio);
  const fim = new Date(meta.periodo.fim);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return meta.periodo.rotulo;
  const formatar = (data: Date) => data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${formatar(inicio)} a ${formatar(fim)}`;
}

function prioridadesDe(p: VisaoCeoPayload): Prioridade[] {
  const cobertura = p.meta_vgv_ano > 0 ? (100 * p.vgv_ano) / p.meta_vgv_ano : null;
  const faltaMeta = Math.max(0, p.meta_vgv_ano - p.vgv_ano);

  return [
    p.sla.aguardando > 0
      ? {
          chave: "atendimento",
          tom: "critico",
          etiqueta: "AGIR AGORA",
          icone: "relogio",
          titulo: `${fmt.inteiro(p.sla.aguardando)} pessoas aguardam resposta`,
          explicacao: "A fila existe neste momento. Priorizar os casos mais antigos reduz perda por demora.",
          evidencia: `mediana ${fmt.duracaoMin(p.sla.mediana_min)} · P90 ${fmt.duracaoMin(p.sla.p90_min)}`,
          alvo: "atendimento",
          acao: "Abrir fila de atendimento",
        }
      : {
          chave: "atendimento",
          tom: "bom",
          etiqueta: "SEM PENDÊNCIA",
          icone: "check",
          titulo: "Nenhuma pessoa aguardando resposta",
          explicacao: "A fila atual não apresenta backlog nas fontes disponíveis.",
          evidencia: `atualizado ${horaSaoPaulo(p.atualizado_em)}`,
          alvo: "atendimento",
          acao: "Ver atendimento",
        },
    p.vendas_sem_comissao > 0
      ? {
          chave: "comissao",
          tom: "atencao",
          etiqueta: "CORRIGIR DADO",
          icone: "dinheiro",
          titulo: `${fmt.inteiro(p.vendas_sem_comissao)} vendas sem percentual de comissão`,
          explicacao: "Sem esse cadastro, o resultado financeiro e os valores a pagar ficam incompletos.",
          evidencia: `${fmt.dinheiro(p.comissoes_total)} calculados nas vendas do recorte`,
          alvo: "financeiro",
          acao: "Revisar financeiro",
        }
      : {
          chave: "comissao",
          tom: "bom",
          etiqueta: "DADO COMPLETO",
          icone: "check",
          titulo: "Vendas do recorte com comissão cadastrada",
          explicacao: "Não há venda sinalizada sem percentual de comissão neste recorte.",
          evidencia: `${fmt.dinheiro(p.comissoes_total)} calculados`,
          alvo: "financeiro",
          acao: "Ver financeiro",
        },
    p.negocios_f2_parados > 0
      ? {
          chave: "carteira-parada",
          tom: "atencao",
          etiqueta: "REVISAR CARTEIRA",
          icone: "alerta",
          titulo: `${fmt.inteiro(p.negocios_f2_parados)} negócios abertos estão parados há 7+ dias`,
          explicacao: "É estoque atual, não produção do período. Uma carteira antiga desse tamanho exige limpeza, próxima ação ou encerramento.",
          evidencia: `${fmt.inteiro(p.negocios_f2_abertos)} negócios abertos no total`,
          alvo: "conversao",
          acao: "Revisar o funil",
        }
      : {
          chave: "carteira-parada",
          tom: "bom",
          etiqueta: "CARTEIRA ATIVA",
          icone: "check",
          titulo: "Nenhum negócio aberto parado há mais de 7 dias",
          explicacao: "A carteira atual não tem negócio sem movimentação acima do limite observado.",
          evidencia: `${fmt.inteiro(p.negocios_f2_abertos)} negócios abertos`,
          alvo: "conversao",
          acao: "Ver funil",
        },
    p.leads_carga_historica > 0
      ? {
          chave: "carga-historica",
          tom: "neutro",
          etiqueta: "CONTEXTO DO DADO",
          icone: "pessoas",
          titulo: `${fmt.inteiro(p.leads_carga_historica)} registros da base Aquário entraram no recorte`,
          explicacao: "A carga histórica continua visível, mas foi separada da aquisição operacional para não inflar a leitura de crescimento.",
          evidencia: `${fmt.inteiro(p.leads_operacionais)} leads operacionais no mesmo período`,
          alvo: "aquisicao",
          acao: "Ver origens",
        }
      : {
          chave: "carga-historica",
          tom: "bom",
          etiqueta: "RECORTE LIMPO",
          icone: "check",
          titulo: "Nenhuma carga histórica misturada ao período",
          explicacao: "Todos os registros do cartão de leads pertencem ao fluxo operacional conhecido.",
          evidencia: `${fmt.inteiro(p.leads_operacionais)} leads operacionais`,
          alvo: "aquisicao",
          acao: "Ver aquisição",
        },
    faltaMeta > 0
      ? {
          chave: "meta",
          tom: "neutro",
          etiqueta: "ACOMPANHAR",
          icone: "tendencia",
          titulo: `${fmt.dinheiro(faltaMeta)} para a meta anual`,
          explicacao: "O número é anual e não muda com o seletor de período. Ele aparece separado para evitar comparação indevida.",
          evidencia: `${fmt.porcento(cobertura, 0)} da meta anual realizada`,
          alvo: "vendas",
          acao: "Abrir vendas",
        }
      : {
          chave: "meta",
          tom: "bom",
          etiqueta: "META ANUAL",
          icone: "tendencia",
          titulo: "Meta anual atingida",
          explicacao: "O VGV anual realizado alcançou ou superou a meta cadastrada.",
          evidencia: `${fmt.porcento(cobertura, 0)} da meta anual`,
          alvo: "vendas",
          acao: "Ver composição das vendas",
        },
  ];
}

export function VisaoEmpresa({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<VisaoCeoPayload>("empresa", accessToken, recorte);

  if (leitura.estado === "carregando") {
    return (
      <div className="int-secao intd-secao">
        <Cabecalho eyebrow="SAÚDE DO NEGÓCIO" titulo="Montando a fotografia da empresa" nota={recorte.periodo} />
        <EsqueletoAviso texto="Buscando os indicadores reais da operação." />
        <EsqueletoKpis colunas={5} />
        <EsqueletoCartoes colunas={3} linhas={3} />
      </div>
    );
  }

  if (leitura.estado === "erro") {
    return (
      <div className="int-secao intd-secao">
        <BlocoSemDado
          titulo="Não foi possível atualizar a Visão do dono"
          motivo="fonte"
          detalhe={`${leitura.erro ?? "A fonte não respondeu."} Nenhum número anterior ou estimado foi colocado no lugar.`}
        />
      </div>
    );
  }

  const p = leitura.payload;
  if (!p) {
    return (
      <div className="int-secao intd-secao">
        <BlocoSemDado titulo="Ainda não há uma fotografia disponível" detalhe="A consulta terminou sem dados. Ajuste o período ou verifique as fontes declaradas abaixo." />
      </div>
    );
  }

  const cobertura = p.meta_vgv_ano > 0 ? (100 * p.vgv_ano) / p.meta_vgv_ano : null;
  const pendencias = Number(p.sla.aguardando > 0) + Number(p.vendas_sem_comissao > 0) + Number(p.negocios_f2_parados > 0);
  const prioridades = prioridadesDe(p);
  const kpis: Kpi[] = [
    { rotulo: `Leads operacionais · ${recorte.periodo}`, bruto: p.leads_operacionais, texto: fmt.inteiro(p.leads_operacionais), tile: "laranja", foot: `${fmt.inteiro(p.leads)} registros no total · ${fmt.inteiro(p.leads_carga_historica)} da carga Aquário` },
    { rotulo: `Vendas · ${recorte.periodo}`, bruto: p.vendas, texto: fmt.inteiro(p.vendas), tile: "verde", foot: "vendas pagas ou concluídas no recorte" },
    { rotulo: `VGV · ${recorte.periodo}`, bruto: p.vgv, texto: fmt.dinheiro(p.vgv), tile: "roxo", foot: "somente vendas do período selecionado" },
    { rotulo: "Negócios abertos · agora", bruto: p.negocios_f2_abertos, texto: fmt.inteiro(p.negocios_f2_abertos), tile: "ambar", foot: "estoque atual do Funil 2.0, independentemente da criação" },
    { rotulo: "Meta de VGV · ano", bruto: cobertura, texto: fmt.porcento(cobertura, 0), tile: "roxo", foot: `${fmt.dinheiro(p.vgv_ano)} de ${fmt.dinheiro(p.meta_vgv_ano)}` },
  ];

  return (
    <div className="int-secao intd-secao">
      <section className={`intd-resumo ${pendencias ? "com-pendencia" : "sem-pendencia"}`}>
        <div className="intd-resumo-principal">
          <span className="intd-eyebrow">SAÚDE DO NEGÓCIO</span>
          <div className="intd-status-linha">
            <span className="intd-status-icone"><IconeInt nome={pendencias ? "alerta" : "check"} tamanho={20} /></span>
            <div>
              <h2>{pendencias ? `${pendencias} ${pendencias === 1 ? "frente exige" : "frentes exigem"} sua decisão` : "Nenhuma pendência crítica nas fontes disponíveis"}</h2>
              <p>Conclusão limitada aos dados conectados. A central não estima caixa, lucro ou previsão que ainda não existam no ERP.</p>
            </div>
          </div>
        </div>
        <div className="intd-resumo-contexto">
          <span>Fotografia consultada</span>
          <strong>{intervaloDaMeta(leitura.meta)}</strong>
          <small>atualizada {horaSaoPaulo(leitura.meta?.atualizadoEm ?? p.atualizado_em)}</small>
          <span className={`intd-cobertura ${leitura.meta?.parcial ? "parcial" : "completa"}`}>
            {leitura.meta?.parcial ? "cobertura parcial" : "fontes completas"}
          </span>
        </div>
      </section>

      <Cabecalho eyebrow="FOTOGRAFIA" titulo="Cinco números para entender a empresa" nota="cada cartão declara o próprio escopo" />
      <GradeKpis itens={kpis} colunas={5} />

      <Cabecalho eyebrow="DECISÕES" titulo="O que merece sua atenção" nota="prioridades geradas apenas por regras verificáveis" cor="#8B00CC" />
      <div className="intd-prioridades">
        {prioridades.map((item) => (
          <article className={`intd-prioridade tom-${item.tom}`} key={item.chave}>
            <div className="intd-prioridade-topo">
              <span className="intd-prioridade-icone"><IconeInt nome={item.icone} tamanho={17} /></span>
              <span className="intd-prioridade-etiqueta">{item.etiqueta}</span>
            </div>
            <h3>{item.titulo}</h3>
            <p>{item.explicacao}</p>
            <small>{item.evidencia}</small>
            <button type="button" className="int-link" onClick={() => recorte.irPara(item.alvo)}>{item.acao} →</button>
          </article>
        ))}
      </div>

      <Cabecalho eyebrow="QUATRO FRENTES" titulo="Aprofunde somente onde precisar" />
      <CartoesLista
        colunas={4}
        cartoes={[
          {
            titulo: "Atendimento",
            chip: "situação atual",
            chipTom: p.sla.aguardando > 0 ? "ruim" : "bom",
            linhas: [
              { l: "Aguardando resposta", r: fmt.inteiro(p.sla.aguardando), corR: p.sla.aguardando > 0 ? "#D93E3E" : "#1E7A46" },
              { l: "Espera mediana", r: fmt.duracaoMin(p.sla.mediana_min) },
              { l: "P90 da espera", r: fmt.duracaoMin(p.sla.p90_min) },
            ],
            link: { rotulo: "Abrir atendimento →", go: () => recorte.irPara("atendimento") },
          },
          {
            titulo: "Comercial",
            chip: recorte.periodo,
            chipTom: "neutro",
            linhas: [
              { l: "Leads operacionais", r: fmt.inteiro(p.leads_operacionais) },
              { l: "Vendas concluídas", r: fmt.inteiro(p.vendas) },
              { l: "VGV do recorte", r: fmt.dinheiro(p.vgv) },
            ],
            link: { rotulo: "Abrir vendas →", go: () => recorte.irPara("vendas") },
          },
          {
            titulo: "Financeiro",
            chip: recorte.periodo,
            chipTom: p.vendas_sem_comissao > 0 ? "aviso" : "bom",
            linhas: [
              { l: "Comissões calculadas", r: fmt.dinheiro(p.comissoes_total) },
              { l: "Vendas sem comissão", r: fmt.inteiro(p.vendas_sem_comissao), corR: p.vendas_sem_comissao > 0 ? "#B5700A" : "#1E7A46" },
              { l: "Lucro e caixa", r: "—", sub: "fonte ainda não conectada" },
            ],
            link: { rotulo: "Abrir financeiro →", go: () => recorte.irPara("financeiro") },
          },
          {
            titulo: "Pessoas e qualidade",
            chip: "aprofundamento",
            chipTom: "roxo",
            linhas: [
              { l: "Corretores", r: "ver operação" },
              { l: "Qualidade", r: "ver avaliações" },
              { l: "Ranking público", r: "não utilizado" },
            ],
            link: { rotulo: "Abrir qualidade →", go: () => recorte.irPara("qualidade") },
          },
        ]}
      />

      <section className="intd-transparencia">
        <div className="intd-transparencia-topo">
          <div>
            <span className="intd-eyebrow">TRANSPARÊNCIA DOS NÚMEROS</span>
            <h2>O que esta leitura sabe — e o que ainda não sabe</h2>
          </div>
          <span>atualizado {horaSaoPaulo(leitura.meta?.atualizadoEm ?? p.atualizado_em)}</span>
        </div>
        <div className="intd-fontes">
          {(leitura.meta?.fontes ?? []).map((fonte) => (
            <div className="intd-fonte" key={fonte.nome}>
              <i className={`status-${fonte.status}`} />
              <span><b>{fonte.nome}</b>{fonte.motivo ? ` — ${fonte.motivo}` : ""}</span>
            </div>
          ))}
          {leitura.meta?.cobertura ? <div className="intd-fonte"><i className="status-parcial" /><span><b>Cobertura:</b> {leitura.meta.cobertura}</span></div> : null}
        </div>
        {(leitura.meta?.avisos ?? []).length ? (
          <div className="intd-avisos">
            {(leitura.meta?.avisos ?? []).map((aviso) => <span key={aviso}>{aviso}</span>)}
          </div>
        ) : null}
      </section>
    </div>
  );
}
