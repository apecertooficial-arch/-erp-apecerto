"use client";

/* INTELIGÊNCIA — Conversão e CRM.
 *
 * O que acontece depois que o lead entra: o funil comercial inteiro, tempo até o
 * primeiro atendimento e a qualidade do registro que sustenta cada taxa.
 *
 * Layout sempre completo: etapa sem dado aparece com traço, nunca sai da tela.
 * Etapas que dependem de campo inexistente (proposta, perda com motivo) ficam
 * declaradas como aguardando conexão — nunca zeradas.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Linha, Tabela } from "./CascaInteligencia";
import {
  AMOSTRA_MINIMA, SLA_META_MIN, duracao, inteiro, lerEmpresa, mediaPonderada,
  num, pct, somar, tem, useInteligencia, type Corretor, type Numero,
} from "./dados";
import "../../styles/inteligencia.css";

export function ConversaoCrm({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);
  const q = dados?.qualidadeDado ?? null;
  const fluxo = empresa?.fluxo ?? {};

  const comSla = corretores.filter((c) => num(c.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA);
  const primeiro = mediaPonderada(comSla, (c) => c.atendimento?.respostaP50Min, (c) => c.atendimento?.amostraTurnos);
  const perdas = num(q?.perdas);
  const negocios = num(fluxo.negocios);

  const kpis = [
    { rotulo: "Leads recebidos", valor: tem(fluxo.leads) ? inteiro(fluxo.leads) : null, nota: "fora do Bolsão" },
    { rotulo: "Lead → negócio", valor: pct(fluxo.negocios, fluxo.leads), nota: "negócios ÷ leads do período" },
    { rotulo: `1º atendimento · mediana`, valor: primeiro !== null ? duracao(primeiro) : null, nota: `meta ${SLA_META_MIN} min` },
    { rotulo: "Taxa de perda", valor: pct(perdas, negocios), nota: perdas > 0 ? `${inteiro(perdas)} negócio(s) perdido(s)` : "perdas registradas ÷ negócios" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  const topo = Math.max(num(fluxo.leads), num(fluxo.negocios), 1);
  /* `base` e a etapa ANTERIOR do funil, e vai direto para pct(parte, base) — que
     recebe Numero (number | string | null | undefined) justamente para distinguir
     "veio zero" de "nao veio". Tipar como unknown obrigava o TypeScript a recusar
     a passagem; todos os valores atribuidos aqui ja sao Numero. */
  const etapas: Array<{ nome: string; valor: number | null; base: Numero; aguardando?: string }> = [
    { nome: "Lead recebido", valor: tem(fluxo.leads) ? num(fluxo.leads) : null, base: fluxo.leads },
    { nome: "Negócio criado", valor: tem(fluxo.negocios) ? num(fluxo.negocios) : null, base: fluxo.leads },
    { nome: "Distribuído para corretor", valor: null, base: null, aguardando: "data de distribuição não vem na fonte" },
    { nome: "Primeiro contato", valor: tem(fluxo.conversas) ? num(fluxo.conversas) : null, base: fluxo.negocios },
    { nome: "Visita agendada", valor: tem(fluxo.visitasMarcadas) ? num(fluxo.visitasMarcadas) : null, base: fluxo.negocios },
    { nome: "Visita realizada", valor: tem(fluxo.visitasRealizadas) ? num(fluxo.visitasRealizadas) : null, base: fluxo.visitasMarcadas },
    { nome: "Proposta", valor: null, base: null, aguardando: "etapa de proposta não é devolvida pela fonte" },
    { nome: "Venda ou locação", valor: tem(empresa?.vendas) ? num(empresa?.vendas) : null, base: fluxo.visitasRealizadas },
    { nome: "Perdido", valor: tem(q?.perdas) ? perdas : null, base: fluxo.negocios },
  ];

  return (
    <CascaInteligencia
      slug="conversao" grupo="operacao" titulo="Conversão e CRM"
      apoio="O que acontece depois que o lead entra. Etapa sem dado aparece com traço — nenhuma sai da tela."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>DEPOIS QUE O LEAD ENTRA</span>
            <h2>Do primeiro contato ao fechamento</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>FUNIL COMERCIAL</span>
            <h2>As nove etapas</h2>
            <div className="ape-int-linhas">
              {etapas.map((e) => (
                <Linha
                  key={e.nome}
                  nome={e.nome}
                  valor={e.valor === null ? null : inteiro(e.valor)}
                  extra={e.aguardando ? "aguardando conexão" : pct(e.valor, e.base)}
                  largura={e.valor === null ? 0 : (100 * e.valor) / topo}
                />
              ))}
              <small>Taxa sempre sobre a etapa anterior. Distribuição e proposta seguem sem campo na fonte de dados — aparecem com traço, jamais como zero.</small>
            </div>
          </section>

          <section className="ape-int-secao">
            <span>QUALIDADE DO REGISTRO</span>
            <h2>O quanto dá para confiar nessas taxas</h2>
            <div className="ape-int-cartoes">
              <article className="ape-int-cartao">
                <b>Ligação entre as pontas</b>
                <div className="ape-int-par"><span>Vendas ligadas ao negócio</span><b>{pct(q?.vendas_vinculadas, q?.vendas_total) ?? "—"}</b></div>
                <div className="ape-int-par"><span>Leads com origem</span><b>{pct(q?.leads_com_origem, q?.leads_operacionais) ?? "—"}</b></div>
                <div className="ape-int-par"><span>Perdas com motivo</span><b>{pct(q?.perdas_com_motivo, q?.perdas) ?? "—"}</b></div>
                <div className="ape-int-par"><span>Visitas com feedback</span><b>{pct(q?.visitas_com_feedback, q?.visitas_realizadas) ?? "—"}</b></div>
                <small>Venda sem vínculo distorce toda conversão: por isso a cobertura fica ao lado das taxas, não escondida numa outra tela.</small>
              </article>
              <article className="ape-int-cartao">
                <b>Fila que trava o funil</b>
                <div className="ape-int-par"><span>Ações vencidas</span><b>{corretores.length ? inteiro(somar(corretores, (c) => c.meuDia?.acoesVencidas)) : "—"}</b></div>
                <div className="ape-int-par"><span>Sem próxima ação</span><b>{corretores.length ? inteiro(somar(corretores, (c) => c.meuDia?.semProximaAcao)) : "—"}</b></div>
                <div className="ape-int-par"><span>Visitas sem feedback</span><b>{tem(empresa?.riscos?.visitas_sem_feedback) ? inteiro(empresa?.riscos?.visitas_sem_feedback) : "—"}</b></div>
                <div className="ape-int-par"><span>Negócios sem valor</span><b>{tem(q?.negocios_com_valor) && tem(q?.negocios_operacionais) ? inteiro(num(q?.negocios_operacionais) - num(q?.negocios_com_valor)) : "—"}</b></div>
                <small>A lista de pessoas por trás de cada fila abre no Funil 2.0, respeitando permissão de dados pessoais.</small>
              </article>
            </div>
          </section>

          <section className="ape-int-secao">
            <span>POR CORRETOR</span>
            <h2>Onde a conversão acontece</h2>
            <Tabela colunas={["Corretor", "Negócios", "1º contato", "Visitas", "Vendas", "Visita → venda"]}>
              {corretores.length ? corretores.map((c) => {
                const n = num(c.atendimento?.amostraTurnos);
                return (
                  <tr key={c.corretorId}>
                    <td><span className="ape-int-pessoa"><i>{(c.nome || "?").slice(0, 1).toUpperCase()}</i><b>{c.nome}</b></span></td>
                    <td>{inteiro(c.producao?.contatosTrabalhados)}</td>
                    <td>{n >= AMOSTRA_MINIMA ? duracao(c.atendimento?.respostaP50Min) : "—"}</td>
                    <td>{inteiro(c.producao?.visitasRealizadas)}</td>
                    <td><b>{inteiro(c.producao?.vendas)}</b></td>
                    <td>{pct(c.producao?.vendas, c.producao?.visitasRealizadas) ?? "—"}</td>
                  </tr>
                );
              }) : (
                <tr><td>Nenhum corretor com atividade</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
              )}
            </Tabela>
          </section>

          <div className="ape-int-aviso">
            <b>Jornada individual.</b> A ficha completa de um lead — origem, página de entrada, imóvel de interesse e movimentações — abre no Funil 2.0, onde a permissão de dados pessoais é verificada.
            Nunca exibimos IP bruto, user agent ou identificador técnico.
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · {confirmados} de {kpis.length} indicadores confirmados.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
