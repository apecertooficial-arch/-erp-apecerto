"use client";

/* INTELIGÊNCIA — Privacidade e qualidade do tracking.
 *
 * A tela que responde "posso confiar nos números que acabei de ver?". Ela mede a
 * cobertura do próprio dado: quanto do volume tem origem, valor, motivo de perda,
 * vínculo de venda e feedback de visita. Cada furo aqui explica um "aguardando
 * dado" nas outras telas.
 *
 * O que depende de acesso externo (GA4, Google e Meta Ads, Clarity) aparece como
 * aguardando conexão — nunca como zero, nunca como estimativa. E as regras de
 * privacidade são exibidas em texto, porque quem abre esta tela precisa saber o
 * que é coletado sem ler documentação técnica.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Pendencias } from "./CascaInteligencia";
import { dataCurta, horaSp, inteiro, num, pct, tem, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

export function PrivacidadeTracking({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const q = useMemo(() => dados?.qualidadeDado ?? null, [dados]);
  const digital = dados?.digital ?? null;
  const proprietarios = dados?.proprietarios ?? null;

  const coberturas = [
    { nome: "Leads com origem", parte: q?.leads_com_origem, base: q?.leads_operacionais, nota: "sem origem, o lead fica em “não atribuído” — nunca redistribuído entre canais" },
    { nome: "Negócios com valor", parte: q?.negocios_com_valor, base: q?.negocios_operacionais, nota: "sem valor, o negócio fica fora da previsão" },
    { nome: "Vendas ligadas ao negócio", parte: q?.vendas_vinculadas, base: q?.vendas_total, nota: "venda sem vínculo distorce toda taxa de conversão" },
    { nome: "Visitas com feedback", parte: q?.visitas_com_feedback, base: q?.visitas_realizadas, nota: "visita sem feedback não entra na análise de qualidade" },
    { nome: "Perdas com motivo", parte: q?.perdas_com_motivo, base: q?.perdas, nota: "sem motivo não existe análise de perda" },
  ];

  const kpis = [
    { rotulo: "Coleta própria do site", valor: digital ? "ativa" : null, nota: digital?.ultimoEm ? `último lead em ${dataCurta(digital.ultimoEm)}` : "nenhum lead recebido no período" },
    { rotulo: "Captações do site", valor: proprietarios ? "ativa" : null, nota: proprietarios?.ultimaEm ? `última em ${dataCurta(proprietarios.ultimaEm)}` : "nenhuma captação no período" },
    { rotulo: "Google Analytics 4", valor: null, nota: "aguardando acesso de Leitor" },
    { rotulo: "Microsoft Clarity", valor: null, nota: "aguardando conexão" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  return (
    <CascaInteligencia
      slug="privacidade" grupo="governanca" titulo="Privacidade e qualidade do tracking"
      apoio="Os dados são confiáveis? Cada furo de cobertura aqui explica um “aguardando dado” nas outras telas."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>ESTÁ CHEGANDO DADO?</span>
            <h2>As fontes desta área</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>COBERTURA DO DADO</span>
            <h2>Quanto do volume está completo</h2>
            <div className="ape-int-linhas">
              {coberturas.map((c) => {
                const taxa = pct(c.parte, c.base);
                const largura = tem(c.parte) && tem(c.base) && num(c.base) > 0 ? Math.min(100, (100 * num(c.parte)) / num(c.base)) : 0;
                return (
                  <div className="ape-int-linha" key={c.nome}>
                    <span>{c.nome}</span>
                    <span className="ape-int-barra roxa"><i style={{ width: `${largura}%` }} /></span>
                    <b>{tem(c.base) && num(c.base) > 0 ? `${inteiro(c.parte)}/${inteiro(c.base)}` : "—"}</b>
                    <em>{taxa ?? "sem base"}</em>
                  </div>
                );
              })}
              <small>Base = registros operacionais do período. Quando a base é zero a linha diz “sem base”, em vez de 0% — que leria como falha.</small>
            </div>
          </section>

          <section className="ape-int-secao">
            <span>O QUE CADA FURO CAUSA</span>
            <h2>Consequência prática</h2>
            <div className="ape-int-cartoes">
              {coberturas.map((c) => (
                <article className="ape-int-cartao" key={c.nome}>
                  <b>{c.nome} · {pct(c.parte, c.base) ?? "sem base"}</b>
                  <small>{c.nota}</small>
                </article>
              ))}
            </div>
          </section>

          <Pendencias lista={dados.pendencias ?? []} />

          <section className="ape-int-secao">
            <span>REGRAS QUE VALEM HOJE</span>
            <h2>O que é coletado, em português</h2>
            <div className="ape-int-cartoes">
              <article className="ape-int-cartao">
                <b>Nesta área</b>
                <small>
                  Toda leitura passa por endpoint autenticado do servidor; sem sessão válida a resposta é 401.
                  Nenhuma chave de serviço existe no navegador, e o escopo por perfil é resolvido no banco — não na tela.
                </small>
              </article>
              <article className="ape-int-cartao">
                <b>Dados de pessoa</b>
                <small>
                  Contagem é agregada no servidor: contato de proprietário não chega a esta área.
                  IP bruto, user agent bruto e identificador técnico não são exibidos em nenhuma tela; drill-down com dado pessoal exige permissão superior.
                </small>
              </article>
              <article className="ape-int-cartao">
                <b>Telemetria do site</b>
                <small>
                  A coleta própria é essencial e sem identificador persistente. Google e Clarity ficam condicionados ao nível de consentimento — e, como ainda não estão conectados aqui, esta área não mostra sessão, página nem gravação.
                </small>
              </article>
              <article className="ape-int-cartao">
                <b>Limites conhecidos</b>
                <small>
                  Conversa fora do ERP não é medida nem avaliada. Uso do sistema não é jornada de trabalho.
                  Revisão jurídica final da política de privacidade é do responsável da empresa — esta tela documenta o comportamento, não o substitui.
                </small>
              </article>
            </div>
          </section>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Verificado às {horaSp(dados.atualizadoEm)} · período {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · fuso America/Sao_Paulo.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
