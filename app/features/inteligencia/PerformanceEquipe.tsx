"use client";

/* INTELIGÊNCIA — Performance da equipe.
 *
 * Quatro pilares, nunca um score único: velocidade, qualidade, conversão e
 * disciplina. A regra de justiça aprovada no canvas (16a) está no código, não
 * apenas no texto: cada pilar mostra a base que usou, e pessoa com amostra abaixo
 * do mínimo entra numa lista própria — fora de qualquer comparação.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Vazio } from "./CascaInteligencia";
import {
  AMOSTRA_MINIMA, SLA_META_MIN, decimal, duracao, inteiro, lerEmpresa, mediaPonderada,
  num, pct, somar, useInteligencia, type Corretor,
} from "./dados";
import "../../styles/inteligencia.css";

export function PerformanceEquipe({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);

  const comSla = corretores.filter((c) => num(c.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA);
  const comNota = corretores.filter((c) => num(c.atendimento?.iaAmostra) >= AMOSTRA_MINIMA);
  const semAmostra = corretores.filter((c) => num(c.atendimento?.amostraTurnos) < AMOSTRA_MINIMA && num(c.atendimento?.iaAmostra) < AMOSTRA_MINIMA);

  const velocidade = mediaPonderada(comSla, (c) => c.atendimento?.sla5Pct, (c) => c.atendimento?.amostraTurnos);
  const qualidade = mediaPonderada(comNota, (c) => c.atendimento?.notaGeral, (c) => c.atendimento?.iaAmostra);
  const vendas = num(empresa?.vendas) || somar(corretores, (c) => c.producao?.vendas);
  const leads = num(empresa?.fluxo?.leads) || somar(corretores, (c) => c.producao?.leadsRecebidos);
  const vencidas = somar(corretores, (c) => c.meuDia?.acoesVencidas);
  const carteira = somar(corretores, (c) => c.meuDia?.carteiraAtiva);

  const pilares = [
    { rotulo: "Velocidade", valor: velocidade !== null ? `${decimal(velocidade)}%` : null, nota: `dentro de ${SLA_META_MIN} min · ${comSla.length} pessoa(s) com amostra`, tom: (velocidade !== null && velocidade < 50 ? "alerta" : "bom") as "alerta" | "bom" },
    { rotulo: "Qualidade", valor: qualidade !== null ? decimal(qualidade) : null, nota: comNota.length ? `${inteiro(somar(comNota, (c) => c.atendimento?.iaAmostra))} atendimentos avaliados` : "nenhuma avaliação com amostra mínima" },
    { rotulo: "Conversão", valor: pct(vendas, leads), nota: "vendas ÷ leads recebidos no período" },
    { rotulo: "Disciplina", valor: corretores.length ? inteiro(vencidas) : null, nota: `ações vencidas de ${inteiro(carteira)} na carteira`, tom: (vencidas > 0 ? "alerta" : "bom") as "alerta" | "bom" },
  ];
  const confirmados = pilares.filter((p) => p.valor !== null).length;

  const detalhe: Array<{ pilar: string; itens: Array<[string, string]> }> = [
    {
      pilar: "Velocidade e disponibilidade",
      itens: [
        ["Respostas medidas", inteiro(somar(corretores, (c) => c.atendimento?.amostraTurnos))],
        ["Dias com acesso ao ERP", inteiro(somar(corretores, (c) => c.diasComAcesso))],
        ["Tempo ativo no ERP", duracao(somar(corretores, (c) => c.minutosErp))],
        ["Pessoas com amostra suficiente", `${comSla.length} de ${corretores.length}`],
      ],
    },
    {
      pilar: "Conversão e resultado",
      itens: [
        ["Leads recebidos", inteiro(leads)],
        ["Visitas realizadas", inteiro(num(empresa?.fluxo?.visitasRealizadas) || somar(corretores, (c) => c.producao?.visitasRealizadas))],
        ["Vendas e locações", inteiro(vendas)],
        ["Visita → venda", pct(vendas, num(empresa?.fluxo?.visitasRealizadas) || somar(corretores, (c) => c.producao?.visitasRealizadas)) ?? "aguardando dado"],
      ],
    },
    {
      pilar: "Disciplina de processo",
      itens: [
        ["Carteira ativa", inteiro(carteira)],
        ["Em dia", pct(somar(corretores, (c) => c.meuDia?.carteiraEmDia), carteira) ?? "aguardando dado"],
        ["Sem próxima ação", inteiro(somar(corretores, (c) => c.meuDia?.semProximaAcao))],
        ["Visitas sem feedback", inteiro(num(empresa?.riscos?.visitas_sem_feedback))],
      ],
    },
    {
      pilar: "Qualidade do atendimento",
      itens: [
        ["Avaliações no período", inteiro(somar(corretores, (c) => c.atendimento?.iaAmostra))],
        ["Pessoas classificáveis", `${comNota.length} de ${corretores.length}`],
        ["Clareza", (() => { const v = mediaPonderada(comNota, (c) => c.atendimento?.clareza, (c) => c.atendimento?.iaAmostra); return v === null ? "sem amostra" : decimal(v); })()],
        ["Objecões", (() => { const v = mediaPonderada(comNota, (c) => c.atendimento?.objecoes, (c) => c.atendimento?.iaAmostra); return v === null ? "sem amostra" : decimal(v); })()],
      ],
    },
  ];

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="equipe" grupo="operacao" titulo="Performance da equipe"
      apoio="Quatro pilares, nunca um score único. Cada pilar mostra a base que usou."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>OS QUATRO PILARES</span>
            <h2>Como o time está trabalhando</h2>
            <div className="ape-int-kpis">
              {pilares.map((p) => <Kpi key={p.rotulo} rotulo={p.rotulo} valor={p.valor} nota={p.nota} tom={p.tom} />)}
            </div>
          </section>

          {corretores.length ? (
            <section className="ape-int-secao">
              <span>O QUE COMPÕE CADA PILAR</span>
              <h2>A composição, aberta</h2>
              <div className="ape-int-cartoes">
                {detalhe.map((d) => (
                  <article className="ape-int-cartao" key={d.pilar}>
                    <b>{d.pilar}</b>
                    {d.itens.map(([rotulo, valor]) => (
                      <div className="ape-int-par" key={rotulo}><span>{rotulo}</span><b>{valor}</b></div>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <Vazio titulo="Nenhum corretor com atividade neste período" apoio="Sem atividade confirmada não existe pilar para compor — e nada aqui é estimado." />
          )}

          {semAmostra.length > 0 && (
            <div className="ape-int-aviso">
              <b>Fora da comparação por amostra insuficiente:</b> {semAmostra.map((c) => c.nome).join(" · ")}.
              Abaixo de {AMOSTRA_MINIMA} atendimentos ninguém é classificado — nem para o gestor, nem para a própria pessoa.
            </div>
          )}

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · {corretores.length} corretor(es) com atividade · {confirmados} de 4 pilares confirmados.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
