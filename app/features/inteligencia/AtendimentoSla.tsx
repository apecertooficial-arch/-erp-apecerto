"use client";

/* INTELIGÊNCIA — Atendimento e SLA.
 *
 * A tela operacional da área: quem está esperando resposta e há quanto tempo.
 * Tudo vem do bloco `corretores` do endpoint (RPC canônica). Duas escolhas que
 * vêm do canvas (15a) e não mudam:
 *
 *  - média nunca aparece sozinha: mediana e P90 juntos, porque média esconde a
 *    cauda de atendimentos muito atrasados;
 *  - toda velocidade vem com a amostra do lado. Sem amostra a pessoa aparece
 *    como "sem amostra", nunca como zero.
 *
 * O SLA da casa é 5 min (limiar em dados.ts). A faixa: verde até 5, âmbar até 15,
 * vermelho acima de 15.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Tabela, Vazio } from "./CascaInteligencia";
import {
  AMOSTRA_MINIMA, SLA_ATENCAO_MIN, SLA_META_MIN, dataCurta, decimal, duracao, inteiro,
  lerEmpresa, mediaPonderada, num, pct, somar, tem, useInteligencia, type Corretor,
} from "./dados";
import { Drawer, DrawerBloqueado, DrawerNumeros, DrawerPar, partes, useDrawer } from "./Drawer";
import "../../styles/inteligencia.css";

const faixa = (min: number) => (min <= SLA_META_MIN ? "bom" : min <= SLA_ATENCAO_MIN ? "atencao" : "ruim");

export function AtendimentoSla({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const drawer = useDrawer();
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);

  const amostra = somar(corretores, (c) => c.atendimento?.amostraTurnos);
  const comAmostra = corretores.filter((c) => num(c.atendimento?.amostraTurnos) > 0);
  const mediana = mediaPonderada(comAmostra, (c) => c.atendimento?.respostaP50Min, (c) => c.atendimento?.amostraTurnos);
  const p90 = mediaPonderada(comAmostra, (c) => c.atendimento?.respostaP90Min, (c) => c.atendimento?.amostraTurnos);
  const noSla = mediaPonderada(comAmostra, (c) => c.atendimento?.sla5Pct, (c) => c.atendimento?.amostraTurnos);
  const vencidas = somar(corretores, (c) => c.meuDia?.acoesVencidas);
  const semProxima = somar(corretores, (c) => c.meuDia?.semProximaAcao);
  const semFeedback = num(empresa?.riscos?.visitas_sem_feedback);
  const carteira = somar(corretores, (c) => c.meuDia?.carteiraAtiva);

  const kpis = [
    { rotulo: `1º contato · mediana`, valor: amostra > 0 && mediana !== null ? duracao(mediana) : null, nota: `meta ${SLA_META_MIN} min · base ${inteiro(amostra)} respostas`, tom: (mediana !== null && mediana > SLA_ATENCAO_MIN ? "alerta" : "bom") as "alerta" | "bom" },
    { rotulo: "1º contato · P90", valor: amostra > 0 && p90 !== null ? duracao(p90) : null, nota: "a cauda lenta, que a média esconde" },
    { rotulo: `% dentro de ${SLA_META_MIN} min`, valor: amostra > 0 && noSla !== null ? `${decimal(noSla)}%` : null, nota: `base ${inteiro(amostra)} respostas medidas` },
    { rotulo: "Ações vencidas", valor: corretores.length ? inteiro(vencidas) : null, nota: `de ${inteiro(carteira)} leads na carteira`, tom: (vencidas > 0 ? "alerta" : "bom") as "alerta" | "bom" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  const filas = [
    { nome: "Ações vencidas", volume: vencidas, apoio: "compromisso combinado que passou da hora", grave: vencidas > 0 },
    { nome: "Leads sem próxima ação", volume: semProxima, apoio: "na carteira, sem nada agendado", grave: semProxima > 0 },
    { nome: "Visitas sem feedback", volume: semFeedback, apoio: "realizadas e não documentadas", grave: semFeedback > 0 },
    { nome: "Corretores sobrecarregados", volume: num(empresa?.riscos?.corretores_sobrecarregados), apoio: "acima do limite da carteira", grave: num(empresa?.riscos?.corretores_sobrecarregados) > 0 },
  ];
  const alvo = partes(drawer.alvo);
  const filaAberta = alvo[0] === "fila-sla" ? filas[Number(alvo[1])] ?? null : null;

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="atendimento" grupo="operacao" titulo="Atendimento e SLA"
      apoio="Quem está esperando resposta agora, e há quanto tempo. Velocidade sempre com a amostra do lado."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>VELOCIDADE DA CASA</span>
            <h2>O cliente está sendo respondido a tempo?</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} {...k} origem="performance_sala_comando" />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>FILAS DE AÇÃO</span>
            <h2>O que precisa de alguém agora</h2>
            {corretores.length ? (
              <div className="ape-int-linhas">
                {filas.map((f, indice) => (
                  <button type="button" className="ape-int-par ape-int-fila" key={f.nome} onClick={() => drawer.abrir(`fila-sla:${indice}`)}>
                    <span>{f.nome}</span>
                    <small>{f.apoio}</small>
                    <b>{inteiro(f.volume)}</b>
                    <span className={f.grave ? "ape-int-chip ruim" : "ape-int-chip bom"}>{f.grave ? "exige ação" : "em ordem"}</span>
                  </button>
                ))}
                <small>A lista de pessoas por trás de cada fila abre no Funil 2.0, onde a ação acontece, e respeita a permissão de dados pessoais.</small>
              </div>
            ) : (
              <Vazio titulo="Nenhum corretor com atividade neste período" apoio="Sem atividade confirmada não há fila para montar — e nada aqui é preenchido com estimativa." />
            )}
          </section>

          <section className="ape-int-secao">
            <span>POR PESSOA</span>
            <h2>Quem está dentro e quem está fora da meta</h2>
            {corretores.length ? (
              <Tabela colunas={["Corretor", "Mediana", "P90", `Até ${SLA_META_MIN} min`, `Até ${SLA_ATENCAO_MIN} min`, "Carteira", "Vencidas", "Último acesso"]}>
                {corretores.map((c) => {
                  const n = num(c.atendimento?.amostraTurnos);
                  const p50 = num(c.atendimento?.respostaP50Min);
                  return (
                    <tr key={c.corretorId}>
                      <td>
                        <span className="ape-int-pessoa"><i>{(c.nome || "?").slice(0, 1).toUpperCase()}</i><b>{c.nome}</b></span>
                        <small>{n >= AMOSTRA_MINIMA ? `${inteiro(n)} respostas medidas` : `amostra ${inteiro(n)} · não classificar`}</small>
                      </td>
                      <td>{n ? <span className={`ape-int-chip ${faixa(p50)}`}>{duracao(p50)}</span> : <small>sem amostra</small>}</td>
                      <td>{n ? duracao(c.atendimento?.respostaP90Min) : "—"}</td>
                      <td>{n ? `${decimal(c.atendimento?.sla5Pct)}%` : "—"}</td>
                      <td>{n ? `${decimal(c.atendimento?.sla15Pct)}%` : "—"}</td>
                      <td>{inteiro(c.meuDia?.carteiraAtiva)}<small>{pct(c.meuDia?.carteiraEmDia, c.meuDia?.carteiraAtiva) ?? "—"} em dia</small></td>
                      <td>{num(c.meuDia?.acoesVencidas) > 0 ? <span className="ape-int-chip ruim">{inteiro(c.meuDia?.acoesVencidas)}</span> : inteiro(c.meuDia?.acoesVencidas)}</td>
                      <td><small>{dataCurta(c.ultimoAcesso)}</small></td>
                    </tr>
                  );
                })}
              </Tabela>
            ) : null}
          </section>

          <div className="ape-int-aviso">
            <b>Como ler.</b> Mediana é o caso típico; P90 mostra os 10% mais lentos — os dois juntos, sempre, porque a média sozinha esconde atendimento muito atrasado.
            Abaixo de {AMOSTRA_MINIMA} respostas medidas a pessoa não é classificada. Ausência de amostra nunca vira nota zero.
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · fuso America/Sao_Paulo · {tem(amostra) ? `${inteiro(amostra)} respostas na base` : "sem amostra no período"}.
            </small>
          )}

          {filaAberta && (
            <Drawer
              titulo={filaAberta.nome} codigo="FILA OPERACIONAL" apoio={filaAberta.apoio}
              icone={filaAberta.grave ? "alerta" : "ok"} cor={filaAberta.grave ? "vermelho" : "verde"}
              selo={filaAberta.grave ? "exige ação" : "em ordem"} tomSelo={filaAberta.grave ? "ruim" : "bom"}
              onFechar={drawer.fechar}
            >
              <DrawerNumeros itens={[
                { rotulo: "itens na fila", valor: inteiro(filaAberta.volume) },
                { rotulo: "carteira ativa", valor: inteiro(carteira) },
                { rotulo: "pessoas identificadas", valor: null },
              ]} />
              <DrawerPar rotulo="Período" valor={dados.periodo ? `${dados.periodo.inicio} a ${dados.periodo.fim}` : null} />
              <DrawerBloqueado texto="A lista nominal e a ação sobre cada lead abrem no Funil 2.0, que aplica a permissão de dados pessoais. Este painel mantém apenas o volume agregado." />
              <a className="ape-int-acao" href="/crm">Abrir Funil 2.0</a>
            </Drawer>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
