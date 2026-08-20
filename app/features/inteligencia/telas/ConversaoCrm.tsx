"use client";

/* CONVERSÃO E CRM — coorte do período para o funil; backlog atual aparece
 * separado. Não há jornada individual ou valor de pipeline sem vínculo/campo. */

import type { PropsTela } from "../CascaInteligencia";
import { BlocoSemDado, fmt, RodapeFontes, Valor } from "../dado";
import { EsqueletoAviso, EsqueletoKpis, EsqueletoTabela } from "../esqueleto";
import { Banner, Cabecalho, Funil, Tabela, type Etapa } from "../pecas";
import { useDadosInteligencia } from "../useDadosInteligencia";
import type { ConversaoPayload } from "../../../lib/inteligencia/tipos";

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function ConversaoCrm({ accessToken, recorte }: PropsTela) {
  const leitura = useDadosInteligencia<ConversaoPayload>("conversao", accessToken, recorte);

  if (leitura.estado === "carregando") {
    return <div className="int-secao"><EsqueletoAviso texto="Reconciliando o funil do período." /><EsqueletoKpis colunas={4} /><EsqueletoTabela colunas={4} linhas={6} /></div>;
  }
  if (leitura.estado === "erro") {
    return <div className="int-secao"><BlocoSemDado titulo="Não foi possível atualizar Conversão" motivo="fonte" detalhe={`${leitura.erro ?? "A fonte não respondeu."} O funil não foi substituído por valores ilustrativos.`} /></div>;
  }
  const p = leitura.payload;
  if (!p) return <div className="int-secao"><BlocoSemDado titulo="Conversão ainda sem leitura" detalhe="A consulta terminou sem dados para o período." /></div>;

  const maxV = Math.max(1, p.leads, ...p.etapas.map((e) => e.volume), p.ganho, p.perdido);
  const largura = (v: number) => Math.max(2, Math.round((100 * v) / maxV));
  const etapas: Etapa[] = [
    { nome: "Leads operacionais", volume: p.leads, largura: largura(p.leads), volumeTexto: fmt.inteiro(p.leads) },
    ...p.etapas.map((e) => ({ nome: e.etapa, volume: e.volume, largura: largura(e.volume), volumeTexto: fmt.inteiro(e.volume) })),
    { nome: "Ganho", volume: p.ganho, largura: largura(p.ganho), volumeTexto: fmt.inteiro(p.ganho) },
    { nome: "Perdido", volume: p.perdido, largura: largura(p.perdido), volumeTexto: fmt.inteiro(p.perdido), perdaFinal: true },
  ];
  const taxaPerda = p.negocios > 0 ? (100 * p.perdido) / p.negocios : null;

  return (
    <div className="int-secao">
      <Cabecalho eyebrow="CONVERSÃO E CRM" titulo="O que entrou no funil e o que exige ação agora" nota={recorte.periodo} />

      {p.leads_carga_historica > 0 ? (
        <Banner tom="aviso" forte="A carga Aquário não entra no funil de aquisição." texto={`${fmt.inteiro(p.leads_carga_historica)} registros históricos foram mantidos fora do cartão de leads operacionais para preservar a conversão do período.`} />
      ) : null}

      <div className="intp-grade" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div className="intp-kpi"><span className="intp-kpi-rotulo">Espera atual · mediana</span><Valor bruto={p.sla_mediana_min} texto={fmt.duracaoMin(p.sla_mediana_min)} /><small className="intp-kpi-foot">fila sem resposta dos últimos 7 dias</small></div>
        <div className="intp-kpi"><span className="intp-kpi-rotulo">Pessoas aguardando agora</span><Valor bruto={p.sem_atendimento} texto={fmt.inteiro(p.sem_atendimento)} tom="ruim" /><button type="button" className="int-link" style={{ fontWeight: 700, alignSelf: "flex-start" }} onClick={() => recorte.irPara("atendimento")}>Abrir atendimento →</button></div>
        <div className="intp-kpi"><span className="intp-kpi-rotulo">Negócios parados · agora</span><Valor bruto={p.parados} texto={fmt.inteiro(p.parados)} tom="atencao" /><small className="intp-kpi-foot">estoque aberto sem movimento há 7+ dias</small></div>
        <div className="intp-kpi"><span className="intp-kpi-rotulo">Perda da coorte</span><Valor bruto={taxaPerda} texto={fmt.porcento(taxaPerda, 1)} /><small className="intp-kpi-foot">perdidos ÷ negócios criados no período</small></div>
      </div>

      <div className="int-duas par-125">
        <div className="int-col">
          <Cabecalho eyebrow="COORTE DO PERÍODO" titulo="Negócios criados e estágio atual" cor="#8B00CC" />
          <Funil etapas={etapas} foot="cada negócio aparece conforme seu estágio atual; ganhos e perdas pertencem à mesma coorte de criação" />
        </div>
        <div className="int-col">
          <Cabecalho eyebrow="PRODUÇÃO DO PERÍODO" titulo="Registros confirmados" cor="#8B00CC" />
          <div className="intp-cartao">
            <div className="intp-detalhe-linha"><span>Leads operacionais</span><b>{fmt.inteiro(p.leads)}</b></div>
            <div className="intp-detalhe-linha"><span>Negócios criados</span><b>{fmt.inteiro(p.negocios)}</b></div>
            <div className="intp-detalhe-linha"><span>Visitas registradas</span><b>{fmt.inteiro(p.visitas)}</b></div>
            <div className="intp-detalhe-linha"><span>Vendas concluídas</span><b>{fmt.inteiro(p.vendas)}</b></div>
            <div className="intp-detalhe-linha"><span>VGV concluído</span><b>{fmt.dinheiro(p.valor_fechado)}</b></div>
          </div>
          <div className="intp-cartao">
            <span className="intp-cartao-titulo">Valor da carteira aberta</span>
            <strong style={{ fontSize: 22 }}>{fmt.dinheiro(p.pipeline_valor)}</strong>
            <small className="intp-kpi-foot">Hoje nenhum negócio aberto do Funil 2.0 possui valor válido; por isso o indicador permanece “—”.</small>
          </div>
        </div>
      </div>

      <Tabela
        colunas={[{ titulo: "Corretor" }, { titulo: "Negócios criados", num: true }, { titulo: "Vendas concluídas", num: true }, { titulo: "Relação vendas/negócios", num: true }]}
        ordenadaEm="Negócios criados"
        linhas={p.corretores.map((c) => ({
          chave: c.nome,
          celulas: [
            { texto: c.nome, forte: true },
            { texto: fmt.inteiro(c.negocios), num: true },
            { texto: fmt.inteiro(c.vendas), num: true },
            { texto: fmt.porcento(c.conv, 1), num: true, forte: true },
          ],
        }))}
        foot="relação operacional do mesmo período; não é atribuição individual de uma venda a um lead"
      />

      <RodapeFontes
        fontes={["leads", "negócios do Funil 2.0", "fila de WhatsApp", "visitas", "vendas"]}
        pendencias={["histórico de transição entre etapas não existe", "valor não preenchido nos negócios abertos", "site e CRM ainda sem vínculo suficiente para jornada individual"]}
        atualizado={hhmm(p.atualizado_em)}
      />
    </div>
  );
}
