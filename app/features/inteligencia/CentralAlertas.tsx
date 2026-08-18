"use client";

/* INTELIGÊNCIA — Central de alertas.
 *
 * Cada alerta é derivado de um número real com um limiar fixo (dados.ts), e vem
 * com a evidência do lado. Regras do canvas (21a) que estão no código:
 *
 *  - alerta que NÃO disparou também aparece, marcado como em ordem: silêncio por
 *    normalidade precisa ser distinguível de silêncio por falha;
 *  - quando a consulta falha, a contagem NÃO vira 0 — a tela diz que as regras não
 *    foram avaliadas;
 *  - regra que depende de fonte inexistente fica listada como inativa, com o
 *    motivo, em vez de desaparecer da lista.
 *
 * Os limiares são fixos nesta versão, por decisão de produto. Torná-los
 * configuráveis em Configurações é melhoria de uma fase futura.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi } from "./CascaInteligencia";
import {
  AMOSTRA_MINIMA, PARADO_DIAS, SLA_ATENCAO_MIN, SLA_META_MIN, SOBRECARGA_PCT,
  decimal, duracao, inteiro, lerEmpresa, mediaPonderada, num, somar, useInteligencia, type Corretor,
} from "./dados";
import "../../styles/inteligencia.css";

type Alerta = {
  chave: string; titulo: string; gravidade: "critico" | "atencao"; volume: number;
  evidencia: string; acao: string; dono: string; disparou: boolean;
};

export function CentralAlertas({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);
  const falhou = estado === "falhou";
  const qualidade = dados?.qualidadeDado ?? null;

  const comSla = corretores.filter((c) => num(c.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA);
  const lentos = comSla.filter((c) => num(c.atendimento?.respostaP50Min) > SLA_ATENCAO_MIN);
  const sobrecarregados = corretores.filter((c) => num(c.capacidadePct) > SOBRECARGA_PCT);
  const vencidas = somar(corretores, (c) => c.meuDia?.acoesVencidas);
  const semProxima = somar(corretores, (c) => c.meuDia?.semProximaAcao);
  const semFeedback = num(empresa?.riscos?.visitas_sem_feedback);
  const notaBaixa = corretores.filter((c) => num(c.atendimento?.iaAmostra) >= AMOSTRA_MINIMA && num(c.atendimento?.notaGeral) < 3.5);
  const vendasSemVinculo = Math.max(0, num(qualidade?.vendas_total) - num(qualidade?.vendas_vinculadas));
  const perdasSemMotivo = Math.max(0, num(qualidade?.perdas) - num(qualidade?.perdas_com_motivo));
  const leadsSemOrigem = Math.max(0, num(qualidade?.leads_operacionais) - num(qualidade?.leads_com_origem));
  const negociosSemValor = Math.max(0, num(qualidade?.negocios_operacionais) - num(qualidade?.negocios_com_valor));
  const medianaCasa = mediaPonderada(comSla, (c) => c.atendimento?.respostaP50Min, (c) => c.atendimento?.amostraTurnos);

  const alertas: Alerta[] = [
    { chave: "sla", titulo: `Primeiro contato acima de ${SLA_ATENCAO_MIN} min`, gravidade: "critico", volume: lentos.length,
      evidencia: lentos.length ? `${lentos.map((c) => `${c.nome} (${duracao(c.atendimento?.respostaP50Min)})`).join(" · ")}` : `mediana da casa: ${medianaCasa !== null ? duracao(medianaCasa) : "sem amostra"}`,
      acao: `Redistribuir plantão e cobrar resposta em ${SLA_META_MIN} min`, dono: "gerente da equipe", disparou: lentos.length > 0 },
    { chave: "vencidas", titulo: "Ações vencidas na carteira", gravidade: "critico", volume: vencidas,
      evidencia: `${inteiro(vencidas)} compromisso(s) passaram da hora combinada`, acao: "Reagendar ou concluir no Funil 2.0", dono: "corretor responsável", disparou: vencidas > 0 },
    { chave: "sem-acao", titulo: "Leads sem próxima ação", gravidade: "atencao", volume: semProxima,
      evidencia: `${inteiro(semProxima)} lead(s) na carteira sem nada agendado`, acao: "Definir próximo passo ou descartar com motivo", dono: "corretor responsável", disparou: semProxima > 0 },
    { chave: "sobrecarga", titulo: "Corretor acima do limite de carteira", gravidade: "critico", volume: sobrecarregados.length,
      evidencia: sobrecarregados.length ? sobrecarregados.map((c) => `${c.nome} (${decimal(c.capacidadePct)}%)`).join(" · ") : `limite de ${SOBRECARGA_PCT}% respeitado`,
      acao: "Redistribuir carteira em Gerentes", dono: "gerente da equipe", disparou: sobrecarregados.length > 0 },
    { chave: "feedback", titulo: "Visitas realizadas sem feedback", gravidade: "atencao", volume: semFeedback,
      evidencia: `${inteiro(semFeedback)} visita(s) sem registro do que aconteceu`, acao: "Registrar o feedback da visita", dono: "corretor responsável", disparou: semFeedback > 0 },
    { chave: "qualidade", titulo: "Qualidade abaixo de 3,5", gravidade: "atencao", volume: notaBaixa.length,
      evidencia: notaBaixa.length ? notaBaixa.map((c) => `${c.nome} (${decimal(c.atendimento?.notaGeral)})`).join(" · ") : `ninguém com amostra ≥ ${AMOSTRA_MINIMA} abaixo de 3,5`,
      acao: "Entrar no plano de desenvolvimento", dono: "gerente da equipe", disparou: notaBaixa.length > 0 },
    { chave: "venda-sem-vinculo", titulo: "Vendas sem negócio de origem", gravidade: "atencao", volume: vendasSemVinculo,
      evidencia: `${inteiro(vendasSemVinculo)} de ${inteiro(qualidade?.vendas_total)} venda(s) sem vínculo — distorcem toda taxa de conversão`, acao: "Vincular a venda ao negócio", dono: "Financeiro", disparou: vendasSemVinculo > 0 },
    { chave: "negocio-sem-valor", titulo: "Negócios sem valor informado", gravidade: "atencao", volume: negociosSemValor,
      evidencia: `${inteiro(negociosSemValor)} negócio(s) ficam fora da previsão`, acao: "Preencher o valor no Funil 2.0", dono: "corretor responsável", disparou: negociosSemValor > 0 },
    { chave: "perda-sem-motivo", titulo: "Perdas sem motivo", gravidade: "atencao", volume: perdasSemMotivo,
      evidencia: `${inteiro(perdasSemMotivo)} de ${inteiro(qualidade?.perdas)} perda(s) sem motivo registrado`, acao: "Registrar o motivo ao perder", dono: "corretor responsável", disparou: perdasSemMotivo > 0 },
    { chave: "lead-sem-origem", titulo: "Leads sem origem confiável", gravidade: "atencao", volume: leadsSemOrigem,
      evidencia: `${inteiro(leadsSemOrigem)} de ${inteiro(qualidade?.leads_operacionais)} lead(s) sem origem — volume nunca é redistribuído entre canais`, acao: "Corrigir UTM nos anúncios e links", dono: "marketing", disparou: leadsSemOrigem > 0 },
  ];

  /* Regras que dependem de fonte que ainda não existe: ficam listadas como
     inativas, com o motivo. Desaparecer daria a impressão de "tudo em ordem". */
  const inativas = [
    { titulo: `Negócio parado há ${PARADO_DIAS}+ dias`, motivo: "a fonte de performance não devolve a data da última movimentação do negócio" },
    { titulo: "Comissão com informação faltando", motivo: "depende do percentual por venda; entra com a leitura de comissões" },
    { titulo: "Falta de cobertura de horário", motivo: "depende de escala ou ponto integrado — atividade no ERP não é jornada" },
    { titulo: "Queda de qualidade na semana", motivo: "exige série histórica de nota, que a leitura atual não traz" },
  ];

  const criticos = alertas.filter((a) => a.disparou && a.gravidade === "critico");
  const atencao = alertas.filter((a) => a.disparou && a.gravidade === "atencao");
  const emOrdem = alertas.filter((a) => !a.disparou);

  const kpis = [
    { rotulo: "Críticos", valor: falhou ? null : inteiro(criticos.length), nota: "exigem ação hoje", tom: (criticos.length > 0 ? "alerta" : "bom") as "alerta" | "bom" },
    { rotulo: "Atenção", valor: falhou ? null : inteiro(atencao.length), nota: "acompanhar nesta semana" },
    { rotulo: "Em ordem", valor: falhou ? null : inteiro(emOrdem.length), nota: "regras avaliadas e sem disparo" },
    { rotulo: "Regras inativas", valor: falhou ? null : inteiro(inativas.length), nota: "aguardando fonte de dado" },
  ];
  const confirmados = falhou ? 0 : kpis.length;

  const Cartao = ({ a }: { a: Alerta }) => (
    <article className="ape-int-cartao">
      <div className="ape-int-par">
        <span style={{ fontWeight: 700 }}>{a.titulo}</span>
        <span className={a.gravidade === "critico" ? "ape-int-chip ruim" : "ape-int-chip atencao"}>{a.gravidade === "critico" ? "crítico" : "atenção"}</span>
      </div>
      <div className="ape-int-par"><span>Volume</span><b>{inteiro(a.volume)}</b></div>
      <small><b>Evidência:</b> {a.evidencia}</small>
      <div className="ape-int-par"><span>Ação recomendada</span><b style={{ fontWeight: 600 }}>{a.acao}</b></div>
      <small>Dono: {a.dono}</small>
    </article>
  );

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="alertas" grupo="governanca" titulo="Central de alertas"
      apoio="Cada alerta vem da regra, com evidência e dono. O que não disparou também aparece — silêncio por normalidade tem que ser distinguível de silêncio por falha."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={false} onTentar={tentarNovamente} />

      {falhou && (
        <div className="ape-int-pendencias">
          <article className="ape-int-pendencia">
            <b>regras não avaliadas</b>
            <span>A contagem não foi para zero: as regras simplesmente não rodaram nesta leitura. Pode haver alerta crítico não listado.</span>
          </article>
        </div>
      )}

      {dados && !falhou && (
        <>
          <section className="ape-int-secao">
            <span>O ESTADO DA OPERAÇÃO</span>
            <h2>{criticos.length === 0 ? "Nenhum alerta crítico agora" : `${criticos.length} alerta(s) crítico(s) aberto(s)`}</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} tom={k.tom} />)}
            </div>
          </section>

          {criticos.length > 0 && (
            <section className="ape-int-secao">
              <span>CRÍTICOS</span>
              <h2>Ação hoje</h2>
              <div className="ape-int-cartoes">{criticos.map((a) => <Cartao key={a.chave} a={a} />)}</div>
            </section>
          )}

          {atencao.length > 0 && (
            <section className="ape-int-secao">
              <span>ATENÇÃO</span>
              <h2>Acompanhar nesta semana</h2>
              <div className="ape-int-cartoes">{atencao.map((a) => <Cartao key={a.chave} a={a} />)}</div>
            </section>
          )}

          <section className="ape-int-secao">
            <span>AVALIADAS E SEM DISPARO</span>
            <h2>O que está em ordem</h2>
            <div className="ape-int-linhas">
              {emOrdem.map((a) => (
                <div className="ape-int-par" key={a.chave}>
                  <span>{a.titulo}</span>
                  <small style={{ color: "#9A938B", fontSize: 11 }}>{a.evidencia}</small>
                  <span className="ape-int-chip bom">em ordem</span>
                </div>
              ))}
              {emOrdem.length === 0 && <small>Todas as regras ativas dispararam neste período.</small>}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>REGRAS INATIVAS</span>
            <h2>Aguardando fonte de dado</h2>
            <div className="ape-int-pendencias">
              {inativas.map((r) => (
                <article className="ape-int-pendencia" key={r.titulo}>
                  <b>{r.titulo}</b>
                  <span>{r.motivo}</span>
                </article>
              ))}
            </div>
          </section>

          <div className="ape-int-aviso">
            <b>Limiares desta versão, fixos:</b> SLA de primeiro contato {SLA_META_MIN} min (atenção acima de {SLA_ATENCAO_MIN}), sobrecarga acima de {SOBRECARGA_PCT}% do limite de carteira,
            amostra mínima de {AMOSTRA_MINIMA} atendimentos para alertar sobre pessoa, negócio parado em {PARADO_DIAS} dias.
            Regra com amostra pequena não dispara: alerta injusto sobre pessoa é pior que alerta ausente.
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Regras avaliadas em {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · {alertas.length} regras ativas · {inativas.length} aguardando fonte.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
