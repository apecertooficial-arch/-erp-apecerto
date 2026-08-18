"use client";

/* INTELIGÊNCIA — Imóveis e procura.
 *
 * Dois lados na mesma tela: o ESTÓQUE que temos anunciado (anuncios_site) e a
 * PROCURA que chega (captação de proprietário por bairro). O cruzamento dos dois
 * responde a pergunta que o CEO faz: onde falta imóvel e onde sobra.
 *
 * O que a tela não tem: visualização, favorito e lead POR IMÓVEL — depende de
 * telemetria por item, que ainda não chega ao ERP. Esses cartões continuam na tela
 * com traço e "aguardando conexão".
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Linha, Tabela } from "./CascaInteligencia";
import { dinheiro, inteiro, num, pct, tem, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

export function Imoveis({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const estoque = useMemo(() => dados?.estoque ?? null, [dados]);
  const proprietarios = dados?.proprietarios ?? null;

  const publicados = num(estoque?.publicados);
  const bairrosEstoque = estoque?.porBairro ?? [];
  const bairrosProcura = proprietarios?.porBairro ?? [];
  const maiorEstoque = bairrosEstoque.reduce((m, b) => Math.max(m, num(b.total)), 0);

  /* Cruzamento: bairro que aparece na procura e não aparece no estóque é demanda
     sem oferta — a informação mais acionável desta tela. */
  const mapaEstoque = new Map(bairrosEstoque.map((b) => [b.chave.toLowerCase(), num(b.total)]));
  const demandaSemOferta = bairrosProcura
    .filter((b) => b.chave !== "não informado" && !mapaEstoque.get(b.chave.toLowerCase()))
    .slice(0, 6);

  const kpis = [
    { rotulo: "Anúncios publicados", valor: estoque ? inteiro(publicados) : null, nota: "no site hoje" },
    { rotulo: "Preço mediano", valor: estoque?.precoMediano ? dinheiro(estoque.precoMediano) : null, nota: estoque ? `${inteiro(estoque.comPreco)} anúncio(s) com preço` : "mediana do estóque" },
    { rotulo: "Em destaque", valor: estoque ? inteiro(estoque.destaque) : null, nota: pct(estoque?.destaque, publicados) ? `${pct(estoque?.destaque, publicados)} do estóque` : "marcados como destaque" },
    { rotulo: "Visões por imóvel", valor: null, nota: "", aguardando: true },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  return (
    <CascaInteligencia
      slug="imoveis" grupo="digital" titulo="Imóveis e procura"
      apoio="O que temos anunciado, o que o mercado está oferecendo e onde a procura não encontra imóvel."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>O ESTÓQUE DE HOJE</span>
            <h2>O que está no ar</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} aguardando={k.aguardando} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>POR BAIRRO</span>
            <h2>Onde estão os imóveis anunciados</h2>
            <div className="ape-int-linhas">
              {bairrosEstoque.length ? bairrosEstoque.map((b) => (
                <Linha
                  key={b.chave}
                  nome={b.chave}
                  valor={inteiro(b.total)}
                  extra={pct(b.total, publicados)}
                  largura={maiorEstoque > 0 ? (100 * num(b.total)) / maiorEstoque : 0}
                />
              )) : <Linha nome="Bairros do estóque" valor={null} extra="aguardando conexão" largura={0} />}
              <small>Estóque atual, não do período: anúncio no ar hoje. Anúncio sem bairro aparece como “não informado”.</small>
            </div>
          </section>

          <section className="ape-int-secao">
            <span>PROCURA x OFERTA</span>
            <h2>Onde a procura não encontra imóvel</h2>
            <div className="ape-int-cartoes">
              <article className="ape-int-cartao">
                <b>Demanda sem oferta</b>
                {demandaSemOferta.length ? demandaSemOferta.map((b) => (
                  <div className="ape-int-par" key={b.chave}>
                    <span>{b.chave}</span>
                    <b>{inteiro(b.total)} captação(ões)</b>
                    <span className="ape-int-chip atencao">sem anúncio</span>
                  </div>
                )) : <small>Nenhum bairro com captação e sem anúncio no período — ou a captação do período não informou bairro.</small>}
                <small>Bairro que aparece na captação e não aparece no estóque: oferta chegando onde não temos produto.</small>
              </article>
              <article className="ape-int-cartao">
                <b>Busca dentro do site</b>
                <div className="ape-int-par"><span>Filtros mais usados</span><b>—</b></div>
                <div className="ape-int-par"><span>Buscas sem resultado</span><b>—</b></div>
                <div className="ape-int-par"><span>Imóvel mais visto</span><b>—</b></div>
                <div className="ape-int-par"><span>Favoritos</span><b>—</b></div>
                <small>aguardando conexão — depende dos eventos property_search, view_item e favorite_toggle chegarem ao ERP.</small>
              </article>
            </div>
          </section>

          <section className="ape-int-secao">
            <span>SITUAÇÃO DO ANÚNCIO</span>
            <h2>Estágio e status do estóque</h2>
            <Tabela colunas={["Corte", "Valor", "Anúncios", "Participação"]}>
              {(estoque?.porFinalidade ?? []).map((f) => (
                <tr key={`est-${f.chave}`}>
                  <td>Estágio</td><td><b>{f.chave}</b></td><td>{inteiro(f.total)}</td><td>{pct(f.total, publicados) ?? "—"}</td>
                </tr>
              ))}
              {(estoque?.porStatus ?? []).map((s) => (
                <tr key={`sta-${s.chave}`}>
                  <td>Status</td><td><b>{s.chave}</b></td><td>{inteiro(s.total)}</td><td>{pct(s.total, publicados) ?? "—"}</td>
                </tr>
              ))}
              {!estoque && (
                <tr><td>Estágio e status</td><td>—</td><td>—</td><td>aguardando conexão</td></tr>
              )}
            </Tabela>
          </section>

          <div className="ape-int-aviso">
            <b>Como ler.</b> Estóque é foto de agora (o que está no ar), procura é do período escolhido — os dois não se somam.
            Desempenho por imóvel (visualização, galeria, favorito, lead) entra quando a telemetria por item chegar ao ERP; até lá esses campos ficam com traço.
            {tem(proprietarios?.recebidas) ? ` Base da procura: ${inteiro(proprietarios?.recebidas)} captação(ões) no período.` : ""}
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Procura entre {dados.periodo.inicio} e {dados.periodo.fim} · estóque na leitura de {dados.periodo.fim} · fonte: anuncios_site + captacoes_portal.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
