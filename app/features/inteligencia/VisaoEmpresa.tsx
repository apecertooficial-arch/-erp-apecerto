"use client";

/* INTELIGÊNCIA — Visão da empresa.
 *
 * Consome /api/inteligencia. Nenhum número desta tela é inventado: cada KPI é
 * lido de um bloco do endpoint e, quando o bloco não veio, o cartão mostra
 * "aguardando dado" — nunca 0, nunca estimativa. É a mesma regra dos 10 estados
 * aprovados no canvas (2b e 24a).
 *
 * O selo do topo diz de onde vem o que está na tela: "DADO REAL · hh:mm" com a
 * hora de São Paulo, ou "aguardando dado" quando nenhum bloco foi confirmado.
 * Nunca existe selo de demonstração aqui: a tela de produção mostra real ou vazio.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Pendencias, Vazio } from "./CascaInteligencia";
import {
  dinheiro, inteiro, lerEmpresa, num, pct, tem, useInteligencia, type Numero,
} from "./dados";
import "../../styles/inteligencia.css";

export function VisaoEmpresa({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const fluxo = empresa?.fluxo ?? {};
  const leadsDoSite = dados?.digital?.leadsDoSite;

  const temMeta = tem(empresa?.metaVgv) && num(empresa?.metaVgv) > 0;
  const kpis = [
    { rotulo: "Leads recebidos", valor: tem(fluxo.leads) ? inteiro(fluxo.leads) : null, nota: "fora do Bolsão", definicao: "Leads operacionais recebidos no período, excluindo a base de Bolsão.", origem: "Funil 2.0" },
    { rotulo: "Leads do site", valor: tem(leadsDoSite) ? inteiro(leadsDoSite) : null, nota: "confirmados em site_leads", definicao: "Cadastros confirmados que chegaram pelos formulários do site.", origem: "site_leads" },
    { rotulo: "Negócios criados", valor: tem(fluxo.negocios) ? inteiro(fluxo.negocios) : null, nota: "vinculados no Funil 2.0", definicao: "Oportunidades que viraram negócio operacional no CRM.", origem: "Funil 2.0" },
    { rotulo: "Visitas marcadas", valor: tem(fluxo.visitasMarcadas) ? inteiro(fluxo.visitasMarcadas) : null, nota: tem(fluxo.visitasRealizadas) ? `${inteiro(fluxo.visitasRealizadas)} realizadas` : "realizadas aguardando dado", definicao: "Visitas agendadas no período; a nota mostra quantas foram realizadas.", origem: "Agenda" },
    { rotulo: "Vendas e locações", valor: tem(empresa?.vendas) ? inteiro(empresa?.vendas) : null, nota: "somente concluídas", definicao: "Negócios concluídos como venda ou locação no período.", origem: "Financeiro" },
    { rotulo: "VGV assinado", valor: tem(empresa?.vgv) ? dinheiro(empresa?.vgv) : null, nota: "não é receita", definicao: "Valor dos imóveis nos negócios assinados; não representa comissão recebida.", origem: "Financeiro" },
    { rotulo: "Lead → negócio", valor: pct(fluxo.negocios, fluxo.leads), nota: "negócios ÷ leads do período", definicao: "Razão entre negócios criados e leads recebidos no mesmo período; não é análise de coorte.", origem: "Funil 2.0" },
    { rotulo: "Cobertura da meta", valor: temMeta ? `${inteiro(empresa?.atingimentoVgvPct)}%` : null, nota: temMeta ? `meta de ${dinheiro(empresa?.metaVgv)}` : "meta não cadastrada no ERP", definicao: "VGV assinado dividido pela meta de VGV cadastrada.", origem: "Metas + Financeiro" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  const etapas: Array<{ nome: string; valor: Numero; base: Numero }> = [
    { nome: "Leads recebidos", valor: fluxo.leads, base: fluxo.leads },
    { nome: "Negócios criados", valor: fluxo.negocios, base: fluxo.leads },
    { nome: "Visitas marcadas", valor: fluxo.visitasMarcadas, base: fluxo.negocios },
    { nome: "Visitas realizadas", valor: fluxo.visitasRealizadas, base: fluxo.visitasMarcadas },
    { nome: "Vendas e locações", valor: empresa?.vendas, base: fluxo.visitasRealizadas },
  ];
  const topo = etapas.reduce((maior, e) => Math.max(maior, num(e.valor)), 0);
  const funilTemDado = etapas.some((e) => tem(e.valor));
  const maiorPerda = etapas.slice(1).map((etapa, indice) => {
    const anterior = etapas[indice];
    const perda = tem(etapa.valor) && tem(anterior.valor)
      ? Math.max(0, num(anterior.valor) - num(etapa.valor))
      : 0;
    return { de: anterior.nome, para: etapa.nome, perda };
  }).reduce((maior, atual) => atual.perda > maior.perda ? atual : maior, { de: "—", para: "—", perda: 0 });
  const midiaPendente = (dados?.pendencias ?? []).some((p) => p.chave.toLowerCase().includes("midia"));

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="" grupo="empresa" titulo="Visão executiva"
      apoio="Do acesso no site até a venda no Funil 2.0 — o que melhorou, o que piorou e onde agir."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-diagnostico" aria-label="Resumo executivo do período">
            <a href={`/inteligencia/conversao?periodo=${periodo}`}>
              <span className="ape-int-tile verde"><i className="ape-int-ic ic-ok" /></span>
              <div><small>MELHOR SINAL</small><strong>{tem(empresa?.vendas) ? `${inteiro(empresa?.vendas)} fechamento(s) confirmado(s)` : "Resultado aguardando dado"}</strong><p>{tem(empresa?.vgv) ? `${dinheiro(empresa?.vgv)} em VGV assinado no período.` : "O financeiro ainda não confirmou o VGV do período."}</p></div>
              <b aria-hidden="true">→</b>
            </a>
            <a href={`/inteligencia/conversao?periodo=${periodo}`}>
              <span className="ape-int-tile vermelho"><i className="ape-int-ic ic-alerta" /></span>
              <div><small>MAIOR PERDA DO FUNIL</small><strong>{maiorPerda.perda > 0 ? `${maiorPerda.de} → ${maiorPerda.para}` : "Sem perda comparável"}</strong><p>{maiorPerda.perda > 0 ? `${inteiro(maiorPerda.perda)} não avançaram entre essas etapas. Abra a conversão para investigar.` : "As etapas ainda não têm base suficiente para apontar o maior vazamento."}</p></div>
              <b aria-hidden="true">→</b>
            </a>
            <a href={`/inteligencia/aquisicao?periodo=${periodo}`}>
              <span className="ape-int-tile ambar"><i className="ape-int-ic ic-radar" /></span>
              <div><small>MERECE ATENÇÃO</small><strong>{midiaPendente ? "Custo de mídia não conectado" : temMeta ? `${inteiro(empresa?.atingimentoVgvPct)}% da meta coberta` : "Meta de VGV não cadastrada"}</strong><p>{midiaPendente ? "Conecte Google Ads e Meta Ads para enxergar CPL, custo por negócio e retorno." : temMeta ? `${dinheiro(Math.max(0, num(empresa?.metaVgv) - num(empresa?.vgv)))} ainda estão descobertos.` : "Sem uma meta cadastrada, a visão executiva não consegue medir cobertura."}</p></div>
              <b aria-hidden="true">→</b>
            </a>
          </section>

          <section className="ape-int-secao">
            <span>OS NÚMEROS DO PERÍODO</span>
            <h2>Como a imobiliária está girando</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} {...k} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>LEITURA PARA DECIDIR</span>
            <h2>Resultado, risco e próximo movimento</h2>
            <div className="ape-int-decisoes">
              <article><span className="ape-int-tile verde"><i className="ape-int-ic ic-ok" /></span><div><b>Resultado confirmado</b><strong>{tem(empresa?.vendas) ? `${inteiro(empresa?.vendas)} fechamento(s)` : "—"}</strong><small>{tem(empresa?.vgv) ? `${dinheiro(empresa?.vgv)} de VGV assinado` : "VGV aguardando dado"}</small></div></article>
              <article><span className="ape-int-tile ambar"><i className="ape-int-ic ic-alerta" /></span><div><b>Risco financeiro</b><strong>{tem(empresa?.vendasPendentes) ? `${inteiro(empresa?.vendasPendentes)} pendência(s)` : "—"}</strong><small>{tem(empresa?.vgvPendente) ? `${dinheiro(empresa?.vgvPendente)} ainda não concluído` : "valor pendente aguardando dado"}</small></div></article>
              <article><span className="ape-int-tile roxo"><i className="ape-int-ic ic-radar" /></span><div><b>Próximo movimento</b><strong>{temMeta ? `${inteiro(empresa?.atingimentoVgvPct)}% da meta` : "Cadastrar meta"}</strong><small>{temMeta ? `${dinheiro(Math.max(0, num(empresa?.metaVgv) - num(empresa?.vgv)))} ainda descoberto` : "sem meta, não existe cobertura confiável"}</small></div></article>
            </div>
          </section>

          <section className="ape-int-secao">
            <span>DO LEAD À CHAVE NA MÃO</span>
            <h2>Onde as pessoas param</h2>
            {funilTemDado ? (
              <div className="ape-int-linhas">
                {etapas.map((e) => (
                  <div className="ape-int-linha" key={e.nome}>
                    <span>{e.nome}</span>
                    <span className="ape-int-barra"><i style={{ width: `${topo > 0 ? Math.min(100, (100 * num(e.valor)) / topo) : 0}%` }} /></span>
                    <b>{tem(e.valor) ? inteiro(e.valor) : "—"}</b>
                    <em>{pct(e.valor, e.base) ?? "—"}</em>
                  </div>
                ))}
                <small>Taxa sempre sobre a etapa anterior. Volume do período, não coorte das mesmas pessoas.</small>
              </div>
            ) : (
              <Vazio titulo="Sem movimento neste período" apoio={`Nenhuma etapa do funil registrou volume entre ${dados.periodo?.inicio} e ${dados.periodo?.fim}.`} />
            )}
          </section>

          <Pendencias lista={dados.pendencias ?? []} />

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · fuso America/Sao_Paulo · {confirmados} de {kpis.length} indicadores confirmados.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
