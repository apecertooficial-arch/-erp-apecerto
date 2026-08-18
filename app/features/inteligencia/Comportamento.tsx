"use client";

/* INTELIGÊNCIA — Comportamento e conteúdo.
 *
 * O que as pessoas fazem no site, por página. Dado real do GA4: visualizações e
 * entradas por caminho. O corte útil para decisão é "muito acesso, pouca saída
 * para lead" — e ele só pode ser calculado por página quando o lead carregar a
 * página de origem, o que ainda não acontece. Enquanto isso a tela mostra a
 * proporção de leads sobre o total de sessões da casa, deixando claro que é taxa
 * geral e não taxa da página.
 *
 * Rolagem, cliques de intenção, galeria e Clarity dependem de eventos e de
 * consentimento — entram como aguardando conexão.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Tabela, Vazio } from "./CascaInteligencia";
import { decimal, inteiro, num, pct, tem, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

export function Comportamento({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const ga4 = useMemo(() => dados?.analytics ?? null, [dados]);
  const totais = ga4?.totais ?? null;
  const paginas = ga4?.paginas ?? [];
  const leadsDoSite = dados?.digital?.leadsDoSite;

  const entradas = paginas.reduce((t, p) => t + num(p.entradas), 0);
  const maisVista = paginas[0] ?? null;
  const maiorEntrada = paginas.slice().sort((a, b) => num(b.entradas) - num(a.entradas))[0] ?? null;

  const kpis = [
    { rotulo: "Visualizações de página", valor: totais ? inteiro(totais.visualizacoes) : null, nota: `${inteiro(paginas.length)} página(s) no recorte` },
    { rotulo: "Página mais vista", valor: maisVista ? inteiro(maisVista.visualizacoes) : null, nota: maisVista ? maisVista.pagina : "aguardando leitura do GA4" },
    { rotulo: "Porta de entrada", valor: maiorEntrada ? inteiro(maiorEntrada.entradas) : null, nota: maiorEntrada ? `entradas em ${maiorEntrada.pagina}` : "primeira página da sessão" },
    { rotulo: "Sessão → lead (geral)", valor: totais && totais.sessoes > 0 && tem(leadsDoSite) ? pct(leadsDoSite, totais.sessoes) : null, nota: "taxa da casa — não é taxa por página" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;
  const maiorVisualizacao = paginas.reduce((maior, p) => Math.max(maior, num(p.visualizacoes)), 0);

  return (
    <CascaInteligencia
      slug="comportamento" grupo="digital" titulo="Comportamento e conteúdo"
      apoio="O que as pessoas abrem e por onde entram. Rolagem, cliques de intenção e gravações dependem de evento e consentimento."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>O CONTEÚDO DO PERÍODO</span>
            <h2>O que está sendo lido</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>PÁGINA POR PÁGINA</span>
            <h2>Onde a atenção está</h2>
            {paginas.length ? (
              <>
                <div className="ape-int-linhas">
                  {paginas.map((p) => (
                    <div className="ape-int-linha" key={p.pagina}>
                      <span>{p.pagina}</span>
                      <span className="ape-int-barra"><i style={{ width: `${maiorVisualizacao > 0 ? Math.min(100, (100 * num(p.visualizacoes)) / maiorVisualizacao) : 0}%` }} /></span>
                      <b>{inteiro(p.visualizacoes)}</b>
                      <em>{pct(p.entradas, entradas) ?? "—"}</em>
                    </div>
                  ))}
                  <small>Volume = visualizações; percentual = participação desta página nas entradas do recorte. As 12 páginas mais vistas do período.</small>
                </div>

                <Tabela colunas={["Página", "Visualizações", "Entradas", "Entrada/visualização"]} ordenaveis={[0, 1, 2, 3]}>
                  {paginas.map((p) => (
                    <tr key={p.pagina}>
                      <td><b>{p.pagina}</b></td>
                      <td>{inteiro(p.visualizacoes)}</td>
                      <td>{inteiro(p.entradas)}</td>
                      <td>{pct(p.entradas, p.visualizacoes) ?? "—"}</td>
                    </tr>
                  ))}
                </Tabela>
              </>
            ) : (
              <Vazio
                titulo="Leitura de páginas aguardando conexão"
                apoio="O GA4 não devolveu páginas para este período. Nada foi preenchido com estimativa — e um recorte vazio não significa site sem acesso, significa leitura indisponível."
              />
            )}
          </section>

          <section className="ape-int-secao">
            <span>O QUE FALTA MEDIR</span>
            <h2>Aguardando conexão</h2>
            <div className="ape-int-pendencias">
              <article className="ape-int-pendencia">
                <b>lead por página</b>
                <span>Para dizer “muito acesso, pouca conversão” por página, o lead precisa carregar a página de origem. Hoje a taxa existe só no total da casa — e está rotulada assim.</span>
              </article>
              <article className="ape-int-pendencia">
                <b>rolagem e cliques de intenção</b>
                <span>WhatsApp, telefone, início de formulário, galeria e profundidade de rolagem dependem dos eventos da coleta própria chegarem ao ERP.</span>
              </article>
              <article className="ape-int-pendencia">
                <b>mapas e gravações (Clarity)</b>
                <span>Não conectado. Quando entrar, só existirão sessões com consentimento de Analytics — nunca para quem escolheu apenas o essencial.</span>
              </article>
            </div>
          </section>

          <div className="ape-int-aviso">
            <b>Como ler.</b> Entrada é a primeira página da sessão: uma página com muita entrada e pouca visualização total costuma ser porta de saída também.
            {totais && totais.taxaEngajamento !== null ? ` Engajamento geral do período: ${decimal(totais.taxaEngajamento)}%.` : ""}
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} · fonte: GA4 (propriedade configurada no servidor).
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
