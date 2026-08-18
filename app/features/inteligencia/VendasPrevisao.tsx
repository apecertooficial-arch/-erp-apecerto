"use client";

/* INTELIGÊNCIA — Vendas e previsão.
 *
 * Realizado primeiro, estimativa depois: fato antes de projeção, sempre nessa
 * ordem. Duas regras do canvas (19b) que estão no código:
 *
 *  - previsão só aparece com valor informado no pipeline. Sem valor, o bloco fica
 *    DESLIGADO com o motivo — previsão aproximada é pior que previsão ausente;
 *  - cobertura da meta só existe com meta cadastrada no ERP; senão a tela diz que
 *    a meta não está cadastrada, em vez de exibir 0%.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Vazio } from "./CascaInteligencia";
import { decimal, dinheiro, inteiro, lerEmpresa, num, pct, tem, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

export function VendasPrevisao({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const fluxo = empresa?.fluxo ?? {};
  const pipeline = empresa?.pipelineQuente ?? {};
  const anterior = empresa?.anterior ?? {};

  const vgv = num(empresa?.vgv);
  const meta = num(empresa?.metaVgv);
  const temMeta = tem(empresa?.metaVgv) && meta > 0;
  const valorPipeline = num(pipeline.valor_informado);
  const temPipeline = tem(pipeline.valor_informado) && valorPipeline > 0;
  const oportunidades = num(pipeline.oportunidades);
  const comValor = num(pipeline.com_valor);
  const semValor = Math.max(0, oportunidades - comValor);
  const faltaMeta = temMeta ? Math.max(0, meta - vgv) : null;

  const comparacao = (atual: number, base: number) => base > 0 ? ({
    valor: `${decimal((100 * Math.abs(atual - base)) / base)}%`,
    rotulo: "vs. período anterior",
    direcao: atual > base ? "subiu" as const : atual < base ? "caiu" as const : "neutra" as const,
  }) : null;

  const kpis = [
    { rotulo: "Vendas e locações", valor: tem(empresa?.vendas) ? inteiro(empresa?.vendas) : null, nota: "somente concluídas", comparacao: tem(anterior.vendas) ? comparacao(num(empresa?.vendas), num(anterior.vendas)) : null, origem: "Financeiro" },
    { rotulo: "VGV assinado", valor: tem(empresa?.vgv) ? dinheiro(vgv) : null, nota: "não é receita", comparacao: tem(anterior.vgv) ? comparacao(vgv, num(anterior.vgv)) : null, origem: "Financeiro" },
    { rotulo: "Falta para a meta", valor: temMeta ? dinheiro(faltaMeta) : null, nota: temMeta ? `meta de ${dinheiro(meta)} · ${decimal(empresa?.atingimentoVgvPct)}% coberto` : "meta não cadastrada no ERP", tom: (temMeta && (faltaMeta ?? 0) > 0 ? "alerta" : "bom") as "alerta" | "bom", comparacao: null, origem: "Metas + Financeiro" },
    { rotulo: "VGV pendente", valor: tem(empresa?.vgvPendente) ? dinheiro(empresa?.vgvPendente) : null, nota: `${inteiro(empresa?.vendasPendentes)} venda(s) aguardando conclusão`, comparacao: null, origem: "Financeiro" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  const etapas = [
    { nome: "Negócios criados", valor: fluxo.negocios, base: fluxo.leads },
    { nome: "Visitas marcadas", valor: fluxo.visitasMarcadas, base: fluxo.negocios },
    { nome: "Visitas realizadas", valor: fluxo.visitasRealizadas, base: fluxo.visitasMarcadas },
    { nome: "Vendas e locações", valor: empresa?.vendas, base: fluxo.visitasRealizadas },
  ];

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="vendas" grupo="empresa" titulo="Vendas e previsão"
      apoio="Realizado primeiro, estimativa depois. Previsão só existe com valor informado no pipeline."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>O REALIZADO</span>
            <h2>O que foi assinado no período</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} {...k} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>A PREVISÃO</span>
            <h2>O que o pipeline sustenta</h2>
            {temPipeline ? (
              <div className="ape-int-cartoes">
                <article className="ape-int-cartao">
                  <b>Pipeline quente</b>
                  <div className="ape-int-par"><span>Oportunidades</span><b>{inteiro(oportunidades)}</b></div>
                  <div className="ape-int-par"><span>Com valor informado</span><b>{inteiro(comValor)}</b></div>
                  <div className="ape-int-par"><span>Valor informado</span><b>{dinheiro(valorPipeline)}</b></div>
                  <div className="ape-int-par"><span>Cobertura declarada</span><b>{pct(comValor, oportunidades) ?? "aguardando dado"}</b></div>
                  <small>{semValor > 0 ? `${inteiro(semValor)} oportunidade(s) sem valor ficam FORA da previsão — nunca entram por média.` : "Todas as oportunidades quentes têm valor informado."}</small>
                </article>
                <article className="ape-int-cartao">
                  <b>Cobertura da meta</b>
                  {temMeta ? (
                    <>
                      <div className="ape-int-par"><span>Assinado</span><b>{dinheiro(vgv)}</b></div>
                      <div className="ape-int-par"><span>Pipeline com valor</span><b>{dinheiro(valorPipeline)}</b></div>
                      <div className="ape-int-par"><span>Assinado + pipeline</span><b>{dinheiro(vgv + valorPipeline)}</b></div>
                      <div className="ape-int-par"><span>Meta</span><b>{dinheiro(meta)}</b></div>
                      <div className="ape-int-par">
                        <span>Falta</span>
                        <b>{dinheiro(Math.max(0, meta - vgv - valorPipeline))}</b>
                        <span className={vgv + valorPipeline >= meta ? "ape-int-chip bom" : "ape-int-chip atencao"}>{decimal((100 * (vgv + valorPipeline)) / meta)}%</span>
                      </div>
                      <small>Somatório simples, sem ponderação por probabilidade: a fonte não traz probabilidade por etapa, e inventá-la maquiaria a previsão.</small>
                    </>
                  ) : (
                    <small>Meta de VGV não cadastrada no ERP. Sem meta não há cobertura para calcular — e 0% seria mentira.</small>
                  )}
                </article>
              </div>
            ) : (
              <>
                <Vazio
                  titulo="Previsão desligada"
                  apoio={`${oportunidades > 0 ? `${inteiro(oportunidades)} oportunidade(s) no pipeline, nenhuma com valor informado.` : "Nenhuma oportunidade quente com valor no período."} Sem valor no negócio não existe previsão — aproximar por média seria inventar receita.`}
                />
                <div className="ape-int-pendencias">
                  <article className="ape-int-pendencia">
                    <b>valor do negócio</b>
                    <span>Preencha o valor no Funil 2.0 para a previsão ligar sozinha. Nada aqui é estimado enquanto o campo estiver vazio.</span>
                  </article>
                </div>
              </>
            )}
          </section>

          <section className="ape-int-secao">
            <span>CAMINHO ATÉ A VENDA</span>
            <h2>Onde o resultado está travando</h2>
            <div className="ape-int-linhas">
              {etapas.map((e) => (
                <div className="ape-int-par" key={e.nome}>
                  <span>{e.nome}</span>
                  <b>{tem(e.valor) ? inteiro(e.valor) : "aguardando dado"}</b>
                  <span className="ape-int-chip">{pct(e.valor, e.base) ?? "—"}</span>
                </div>
              ))}
              <small>Taxa sobre a etapa anterior. Volume do período, não coorte das mesmas pessoas — uma venda pode vir de lead de outro mês.</small>
            </div>
          </section>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · valores em reais, padrão brasileiro · {confirmados} de {kpis.length} indicadores confirmados.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
