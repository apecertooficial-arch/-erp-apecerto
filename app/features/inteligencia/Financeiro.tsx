"use client";

/* INTELIGÊNCIA — Financeiro e comissões.
 *
 * A cascata desce só até onde o dado permite: VGV → receita bruta → comissões e
 * custos → contribuição estimada. O último degrau NÃO se chama lucro líquido, e a
 * tela repete isso: sem impostos e despesas fixas integradas, lucro não existe
 * aqui.
 *
 * Diferença de comportamento em relação às outras telas, de propósito (canvas
 * 20a e 27c): quando a consulta falha, esta tela NÃO mantém o número anterior na
 * frente — dinheiro errado na tela é pior que tela vazia.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Vazio } from "./CascaInteligencia";
import { decimal, dinheiro, inteiro, lerEmpresa, num, pct, tem, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

export function Financeiro({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const falhou = estado === "falhou";

  const vgv = num(empresa?.vgv);
  const receita = num(empresa?.receitaBruta);
  const custos = num(empresa?.custos);
  const contribuicao = num(empresa?.margemContribuicao);
  const temReceita = tem(empresa?.receitaBruta);

  const kpis = [
    { rotulo: "VGV assinado", valor: tem(empresa?.vgv) ? dinheiro(vgv) : null, nota: "valor dos imóveis — não é receita" },
    { rotulo: "Receita bruta", valor: temReceita ? dinheiro(receita) : null, nota: vgv > 0 && temReceita ? `${decimal((100 * receita) / vgv)}% do VGV` : "comissão da imobiliária" },
    { rotulo: "Custos registrados", valor: tem(empresa?.custos) ? dinheiro(custos) : null, nota: "custos diretos lançados no período" },
    { rotulo: "Contribuição estimada", valor: tem(empresa?.margemContribuicao) ? dinheiro(contribuicao) : null, nota: "não é lucro líquido" },
  ];
  const confirmados = falhou ? 0 : kpis.filter((k) => k.valor !== null).length;

  const cascata = [
    { nome: "VGV assinado", valor: empresa?.vgv, base: vgv },
    { nome: "Receita bruta de comissão", valor: empresa?.receitaBruta, base: vgv },
    { nome: "− Custos diretos", valor: empresa?.custos, base: vgv },
    { nome: "= Contribuição estimada", valor: empresa?.margemContribuicao, base: vgv },
  ];

  return (
    <CascaInteligencia
      slug="financeiro" grupo="empresa" titulo="Financeiro e comissões"
      apoio="Do VGV à contribuição estimada. A cascata para onde o dado para — e o último degrau não é lucro líquido."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      {/* temDado=false de propósito: aqui a falha esconde o número antigo. */}
      <Estados estado={estado} temDado={false} onTentar={tentarNovamente} />

      {dados && !falhou && (
        <>
          <section className="ape-int-secao">
            <span>OS QUATRO NÚMEROS</span>
            <h2>Quanto entrou e quanto sobrou</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>A CASCATA</span>
            <h2>Do assinado ao que sobra</h2>
            {temReceita ? (
              <div className="ape-int-linhas">
                {cascata.map((d) => (
                  <div className="ape-int-linha" key={d.nome}>
                    <span>{d.nome}</span>
                    <span className="ape-int-barra"><i style={{ width: `${d.base > 0 ? Math.min(100, (100 * num(d.valor)) / d.base) : 0}%` }} /></span>
                    <b>{tem(d.valor) ? dinheiro(d.valor) : "aguardando dado"}</b>
                    <em>{pct(d.valor, d.base) ?? "—"}</em>
                  </div>
                ))}
                <small>Percentual sobre o VGV do período. Contribuição estimada = receita − comissões − custos diretos lançados.</small>
              </div>
            ) : (
              <Vazio titulo="Nenhuma receita reconhecida no período" apoio={vgv > 0 ? `Há ${dinheiro(vgv)} de VGV assinado aguardando repasse. Vendido e recebido são coisas diferentes.` : "Sem VGV assinado e sem receita reconhecida neste período."} />
            )}
          </section>

          <section className="ape-int-secao">
            <span>O QUE FALTA PARA FECHAR A CONTA</span>
            <h2>Pendências que travam o cálculo</h2>
            <div className="ape-int-cartoes">
              <article className="ape-int-cartao">
                <b>VGV pendente</b>
                <div className="ape-int-par"><span>Vendas aguardando conclusão</span><b>{inteiro(empresa?.vendasPendentes)}</b></div>
                <div className="ape-int-par"><span>Valor envolvido</span><b>{tem(empresa?.vgvPendente) ? dinheiro(empresa?.vgvPendente) : "aguardando dado"}</b></div>
                <small>Entra na receita quando o repasse for reconhecido — nunca antes, e nunca por estimativa.</small>
              </article>
              <article className="ape-int-cartao">
                <b>Lucro líquido</b>
                <small>
                  Não é exibido nesta tela. Lucro exige impostos e despesas fixas, que não estão integrados: a cascata para em contribuição estimada de propósito.
                  Chamar contribuição de lucro seria o erro mais caro que esta área poderia cometer.
                </small>
              </article>
            </div>
          </section>

          <div className="ape-int-aviso">
            <b>Acesso restrito.</b> Esta tela é do CEO, diretoria e Financeiro. Comissão individual não aparece em telas de equipe, e gerente não vê a comissão de quem ele lidera.
            Comissão nunca é estimada por média: venda sem percentual definido fica pendente e nomeada, não calculada.
          </div>

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
