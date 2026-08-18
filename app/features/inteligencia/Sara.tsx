"use client";

/* INTELIGÊNCIA — Sara (assistente de imóveis).
 *
 * O funil da Sara depende de eventos próprios (sara_open, sara_search,
 * sara_results, sara_error) que ainda NÃO chegam ao ERP. Por decisão do Romulo a
 * tela vai ao ar com o LAYOUT COMPLETO: as sete etapas e todos os indicadores
 * aprovados, cada um com traço e "aguardando conexão" — nada some, nada é
 * inventado. Quando o evento chegar, o valor entra no lugar do traço sem mexer no
 * desenho.
 *
 * Regra de privacidade que já está escrita aqui: texto digitado pela pessoa nunca
 * aparece. Só categoria, quantidade e agregado.
 */

import { CascaInteligencia, Estados, Kpi, Linha } from "./CascaInteligencia";
import { useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

const ETAPAS = [
  "Sara aberta", "Busca enviada", "Resultados apresentados", "Imóvel aberto",
  "Ação de intenção", "Lead gerado", "Negócio criado",
];

const INDICADORES = [
  { rotulo: "Aberturas", nota: "evento sara_open" },
  { rotulo: "Buscas enviadas", nota: "evento sara_search" },
  { rotulo: "Busca concluída", nota: "buscas com resultado ÷ buscas" },
  { rotulo: "Média de resultados", nota: "resultados por busca" },
];

export function Sara({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="sara" grupo="digital" titulo="Sara"
      apoio="A Sara facilita a descoberta de imóvel e gera oportunidade? A tela está pronta; os eventos da Sara ainda não chegam ao ERP."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={0} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      <section className="ape-int-secao">
        <span>O USO DA SARA</span>
        <h2>Quanto ela está sendo usada</h2>
        <div className="ape-int-kpis">
          {INDICADORES.map((i) => <Kpi key={i.rotulo} rotulo={i.rotulo} valor={null} nota={i.nota} aguardando />)}
        </div>
      </section>

      <section className="ape-int-secao">
        <span>FUNIL DA SARA</span>
        <h2>Da abertura ao negócio</h2>
        <div className="ape-int-linhas">
          {ETAPAS.map((e) => <Linha key={e} nome={e} valor={null} extra="aguardando conexão" largura={0} />)}
          <small>As sete etapas do desenho aprovado ficam na tela desde já: quando o evento chegar, o número entra no lugar do traço sem mudar o layout.</small>
        </div>
      </section>

      <section className="ape-int-secao">
        <span>O QUE AS PESSOAS PROCURAM</span>
        <h2>Categorias, nunca o texto digitado</h2>
        <div className="ape-int-cartoes">
          <article className="ape-int-cartao">
            <b>Procura agregada</b>
            <div className="ape-int-par"><span>Bairros mais buscados</span><b>—</b></div>
            <div className="ape-int-par"><span>Finalidade (venda/locação)</span><b>—</b></div>
            <div className="ape-int-par"><span>Faixa de preço procurada</span><b>—</b></div>
            <div className="ape-int-par"><span>Buscas sem resultado</span><b>—</b></div>
            <small>aguardando conexão — só categoria e contagem entram aqui. Texto privado digitado pela pessoa nunca é exibido.</small>
          </article>
          <article className="ape-int-cartao">
            <b>Resultado comercial</b>
            <div className="ape-int-par"><span>Resultados mais clicados</span><b>—</b></div>
            <div className="ape-int-par"><span>Leads originados da Sara</span><b>—</b></div>
            <div className="ape-int-par"><span>Negócios originados da Sara</span><b>—</b></div>
            <div className="ape-int-par"><span>Celular x computador</span><b>—</b></div>
            <small>aguardando conexão — exige o evento da Sara carregar a origem até o lead.</small>
          </article>
          <article className="ape-int-cartao">
            <b>Saúde da Sara</b>
            <div className="ape-int-par"><span>Erros (sara_error)</span><b>—</b></div>
            <div className="ape-int-par"><span>Maior queda entre etapas</span><b>—</b></div>
            <div className="ape-int-par"><span>Tempo até o primeiro resultado</span><b>—</b></div>
            <small>aguardando conexão — erro da Sara é o primeiro indicador a ligar quando os eventos chegarem.</small>
          </article>
        </div>
      </section>

      <div className="ape-int-pendencias">
        <article className="ape-int-pendencia">
          <b>eventos da Sara</b>
          <span>sara_open, sara_search, sara_results e sara_error precisam ser gravados no ERP (ou expostos no GA4 como eventos) para esta tela ligar. A estrutura já está pronta e não depende de novo desenho.</span>
        </article>
        <article className="ape-int-pendencia">
          <b>origem até o lead</b>
          <span>Para dizer “a Sara gerou este negócio”, o lead precisa carregar a marca de origem. Sem isso, nenhum lead é atribuído à Sara por estimativa.</span>
        </article>
      </div>

      <div className="ape-int-aviso">
        <b>Privacidade da conversa.</b> Esta tela nunca exibe o texto que a pessoa digitou na Sara. Trabalha com categoria, tamanho da consulta e agregado — exatamente como aprovado no canvas.
      </div>

      {dados?.periodo && (
        <small className="ape-int-rodape">
          Período selecionado: {dados.periodo.inicio} até {dados.periodo.fim} · nenhum indicador desta tela tem fonte conectada ainda.
        </small>
      )}
    </CascaInteligencia>
  );
}
