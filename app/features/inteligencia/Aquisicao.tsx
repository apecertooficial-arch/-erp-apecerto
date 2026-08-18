"use client";

/* INTELIGÊNCIA — Aquisição e campanhas.
 *
 * Primeira tela do grupo Mercado e digital com dado real: sessões e engajamento
 * por canal, vindos do GA4. Duas coisas que a tela NÃO faz, de propósito:
 *
 *  - não chama sessão de "visitante único": sem consentimento não existe
 *    identificação persistente, e a definição aprovada usa sessões e
 *    visualizações de página;
 *  - não mostra CPL, custo por negócio nem ROAS enquanto Google Ads e Meta Ads
 *    não estiverem conectados — o bloco aparece vazio com o motivo.
 *
 * A ligação canal → lead → negócio ainda não existe: o GA4 traz o canal, o CRM
 * traz o lead, e nada liga os dois hoje. A tela declara isso em vez de estimar
 * atribuição.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Tabela, Vazio } from "./CascaInteligencia";
import { decimal, inteiro, lerEmpresa, num, pct, tem, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

export function Aquisicao({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const ga4 = useMemo(() => dados?.analytics ?? null, [dados]);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const totais = ga4?.totais ?? null;
  const origens = ga4?.origens ?? [];
  const leadsDoSite = dados?.digital?.leadsDoSite;

  const kpis = [
    { rotulo: "Sessões", valor: totais ? inteiro(totais.sessoes) : null, nota: "GA4 · não são visitantes únicos" },
    { rotulo: "Visualizações de página", valor: totais ? inteiro(totais.visualizacoes) : null, nota: totais && totais.sessoes > 0 ? `${decimal(totais.visualizacoes / totais.sessoes)} por sessão` : "eventos page_view válidos" },
    { rotulo: "Taxa de engajamento", valor: totais && totais.taxaEngajamento !== null ? `${decimal(totais.taxaEngajamento)}%` : null, nota: totais ? `${inteiro(totais.sessoesEngajadas)} sessões engajadas` : "sessão com interação além do page_view" },
    { rotulo: "Leads do site", valor: tem(leadsDoSite) ? inteiro(leadsDoSite) : null, nota: totais && totais.sessoes > 0 && tem(leadsDoSite) ? `${pct(leadsDoSite, totais.sessoes)} das sessões` : "confirmados em site_leads" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;
  const maiorCanal = origens.reduce((maior, o) => Math.max(maior, num(o.sessoes)), 0);

  return (
    <CascaInteligencia
      slug="aquisicao" grupo="digital" titulo="Aquisição e campanhas"
      apoio="De onde vem quem acessa o site. Custo e ROAS entram quando as mídias forem conectadas — nada aqui é estimado."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>O TRÁFEGO DO PERÍODO</span>
            <h2>Quanto o site recebeu</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>POR CANAL</span>
            <h2>Quem traz gente para o site</h2>
            {origens.length ? (
              <div className="ape-int-linhas">
                {origens.map((o) => (
                  <div className="ape-int-linha" key={o.origem}>
                    <span>{o.origem}</span>
                    <span className="ape-int-barra"><i style={{ width: `${maiorCanal > 0 ? Math.min(100, (100 * num(o.sessoes)) / maiorCanal) : 0}%` }} /></span>
                    <b>{inteiro(o.sessoes)}</b>
                    <em>{pct(o.engajadas, o.sessoes) ?? "—"}</em>
                  </div>
                ))}
                <small>Volume = sessões; percentual = engajamento do canal. Canal do GA4 (agrupamento padrão), com “não informado” visível em vez de redistribuído.</small>
              </div>
            ) : (
              <Vazio
                titulo="Tráfego por canal aguardando conexão"
                apoio="O GA4 respondeu sem linhas para este período, ou a leitura ainda não está liberada na propriedade. Nenhum número foi estimado."
              />
            )}
          </section>

          {(ga4?.dispositivos ?? []).length > 0 && (
            <section className="ape-int-secao">
              <span>ONDE AS PESSOAS ACESSAM</span>
              <h2>Celular, computador e tablet</h2>
              <Tabela colunas={["Dispositivo", "Sessões", "Participação"]}>
                {(ga4?.dispositivos ?? []).map((d) => (
                  <tr key={d.dispositivo}>
                    <td><b>{d.dispositivo}</b></td>
                    <td>{inteiro(d.sessoes)}</td>
                    <td>{totais ? pct(d.sessoes, totais.sessoes) ?? "—" : "—"}</td>
                  </tr>
                ))}
              </Tabela>
            </section>
          )}

          <section className="ape-int-secao">
            <span>CUSTO E RETORNO</span>
            <h2>Aguardando conexão das mídias</h2>
            <div className="ape-int-pendencias">
              <article className="ape-int-pendencia">
                <b>CPL e custo por negócio</b>
                <span>Conecte Google Ads e Meta Ads. Até lá o campo não é preenchido com estimativa — custo inventado viraria decisão de verba errada.</span>
              </article>
              <article className="ape-int-pendencia">
                <b>ROAS</b>
                <span>Depende de custo de mídia e de receita atribuída ao canal; hoje falta o custo e falta o vínculo canal → venda.</span>
              </article>
              <article className="ape-int-pendencia">
                <b>Canal → lead → negócio</b>
                <span>O GA4 traz o canal e o CRM traz o lead, mas nada liga os dois hoje. {tem(empresa?.fluxo?.leads) ? `Os ${inteiro(empresa?.fluxo?.leads)} leads do período aparecem sem canal.` : ""} Enquanto o vínculo não existir, nenhuma conversão por canal é exibida.</span>
              </article>
            </div>
          </section>

          <div className="ape-int-aviso">
            <b>Vocabulário.</b> Sessão não é pessoa: sem consentimento não existe identificação persistente, então esta área fala em sessões e visualizações de página, nunca em “visitantes únicos”.
            Sessão engajada é a que teve interação além de abrir a página.
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} · fonte: GA4 (propriedade configurada no servidor) + site_leads.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
