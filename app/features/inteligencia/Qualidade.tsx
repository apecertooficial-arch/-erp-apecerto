"use client";

/* INTELIGÊNCIA — Qualidade e desenvolvimento.
 *
 * Os oito critérios da avaliação, cada um com a amostra que o sustenta, e o plano
 * de desenvolvimento derivado do critério mais fraco. Regras do canvas (19a) que
 * estão no código:
 *
 *  - nota só aparece com amostra >= 8; abaixo disso a pessoa é listada como "sem
 *    amostra", nunca como nota baixa;
 *  - a média da casa é ponderada pela amostra de cada pessoa, para quem foi
 *    avaliado 40 vezes não pesar igual a quem foi avaliado 8;
 *  - nenhum score único opaco: a nota geral vem sempre acompanhada dos critérios.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Tabela, Vazio } from "./CascaInteligencia";
import {
  AMOSTRA_MINIMA, decimal, inteiro, mediaPonderada, num, somar, useInteligencia, type Corretor,
} from "./dados";
import "../../styles/inteligencia.css";

const CRITERIOS: Array<{ chave: string; nome: string }> = [
  { chave: "clareza", nome: "Clareza" },
  { chave: "cordialidade", nome: "Cordialidade" },
  { chave: "personalizacao", nome: "Personalização" },
  { chave: "qualificacao", nome: "Qualificação" },
  { chave: "conducao", nome: "Condução" },
  { chave: "objecoes", nome: "Objecões" },
  { chave: "escrita", nome: "Escrita" },
  { chave: "notaGeral", nome: "Nota geral" },
];

export function Qualidade({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);

  const comNota = corretores.filter((c) => num(c.atendimento?.iaAmostra) >= AMOSTRA_MINIMA);
  const semNota = corretores.filter((c) => num(c.atendimento?.iaAmostra) < AMOSTRA_MINIMA);
  const amostra = somar(corretores, (c) => c.atendimento?.iaAmostra);
  const avaliadas = somar(corretores, (c) => c.atendimento?.iaMensagensAvaliadas);

  const notas = CRITERIOS.map((crit) => ({
    ...crit,
    valor: mediaPonderada(comNota, (c) => c.atendimento?.[crit.chave], (c) => c.atendimento?.iaAmostra),
  }));
  const geral = notas.find((n) => n.chave === "notaGeral")?.valor ?? null;
  const detalhados = notas.filter((n) => n.chave !== "notaGeral" && n.valor !== null);
  const maisFraco = detalhados.length ? detalhados.reduce((pior, n) => ((n.valor as number) < (pior.valor as number) ? n : pior)) : null;
  const maisForte = detalhados.length ? detalhados.reduce((melhor, n) => ((n.valor as number) > (melhor.valor as number) ? n : melhor)) : null;

  const kpis = [
    { rotulo: "Nota geral", valor: geral !== null ? decimal(geral) : null, nota: comNota.length ? `média ponderada · n=${inteiro(amostra)} atendimentos` : `amostra mínima de ${AMOSTRA_MINIMA} não alcançada` },
    { rotulo: "Critério mais fraco", valor: maisFraco ? `${decimal(maisFraco.valor)}` : null, nota: maisFraco ? maisFraco.nome.toLowerCase() : "sem critério com amostra" },
    { rotulo: "Critério mais forte", valor: maisForte ? `${decimal(maisForte.valor)}` : null, nota: maisForte ? maisForte.nome.toLowerCase() : "sem critério com amostra" },
    { rotulo: "Pessoas classificáveis", valor: corretores.length ? `${comNota.length} de ${corretores.length}` : null, nota: `mínimo de ${AMOSTRA_MINIMA} atendimentos avaliados` },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;
  const escala = (v: number | null) => (v === null ? 0 : Math.max(0, Math.min(100, v * 20)));

  return (
    <CascaInteligencia
      slug="qualidade" grupo="operacao" titulo="Qualidade e desenvolvimento"
      apoio="Oito critérios, amostra declarada e plano derivado do critério mais fraco. Nunca um score único."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>A CONVERSA COM O CLIENTE</span>
            <h2>Como a casa está atendendo</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} />)}
            </div>
          </section>

          <section className="ape-int-secao">
            <span>OS OITO CRITÉRIOS</span>
            <h2>Onde a conversa perde força</h2>
            {comNota.length ? (
              <div className="ape-int-linhas">
                {notas.map((n) => (
                  <div className="ape-int-linha" key={n.chave}>
                    <span>{n.nome}</span>
                    <span className="ape-int-barra roxa"><i style={{ width: `${escala(n.valor)}%` }} /></span>
                    <b>{n.valor === null ? "—" : decimal(n.valor)}</b>
                    <em>n={inteiro(amostra)}</em>
                  </div>
                ))}
                <small>Escala de 0 a 5, média ponderada pela amostra de cada pessoa. Avaliação é interna: não depende do consentimento do visitante.</small>
              </div>
            ) : (
              <Vazio
                titulo="Nenhuma avaliação com amostra suficiente"
                apoio={`Há ${inteiro(amostra)} atendimento(s) avaliado(s) no período; o mínimo para exibir nota é ${AMOSTRA_MINIMA} por pessoa.`}
              />
            )}
          </section>

          {maisFraco && (
            <section className="ape-int-secao">
              <span>PLANO DE DESENVOLVIMENTO</span>
              <h2>O que treinar primeiro</h2>
              <div className="ape-int-cartoes">
                <article className="ape-int-cartao">
                  <b>Prioridade da casa: {maisFraco.nome.toLowerCase()}</b>
                  <div className="ape-int-par"><span>Nota atual</span><b>{decimal(maisFraco.valor)}</b></div>
                  <div className="ape-int-par"><span>Base</span><b>{inteiro(amostra)} atendimentos</b></div>
                  <div className="ape-int-par"><span>Pessoas abaixo de 3,5</span><b>{inteiro(comNota.filter((c) => num(c.atendimento?.[maisFraco.chave]) < 3.5).length)}</b></div>
                  <small>A prioridade sai do critério com a menor nota ponderada — muda sozinha quando o número muda.</small>
                </article>
                <article className="ape-int-cartao">
                  <b>Quem entra no plano</b>
                  {comNota
                    .filter((c) => num(c.atendimento?.[maisFraco.chave]) < 3.5)
                    .map((c) => (
                      <div className="ape-int-par" key={c.corretorId}>
                        <span>{c.nome}</span>
                        <b>{decimal(c.atendimento?.[maisFraco.chave])}</b>
                        <span className="ape-int-chip roxo">n={inteiro(c.atendimento?.iaAmostra)}</span>
                      </div>
                    ))}
                  {comNota.filter((c) => num(c.atendimento?.[maisFraco.chave]) < 3.5).length === 0 && (
                    <small>Ninguém com amostra suficiente está abaixo de 3,5 neste critério.</small>
                  )}
                </article>
              </div>
            </section>
          )}

          {corretores.length > 0 && (
            <section className="ape-int-secao">
              <span>POR PESSOA</span>
              <h2>Nota só com amostra</h2>
              <Tabela colunas={["Corretor", "Amostra", "Nota geral", "Clareza", "Qualificação", "Objecões", "Condução"]}>
                {corretores.map((c) => {
                  const n = num(c.atendimento?.iaAmostra);
                  const classificavel = n >= AMOSTRA_MINIMA;
                  return (
                    <tr key={c.corretorId}>
                      <td><span className="ape-int-pessoa"><i>{(c.nome || "?").slice(0, 1).toUpperCase()}</i><b>{c.nome}</b></span></td>
                      <td>{classificavel ? `n=${inteiro(n)}` : <span className="ape-int-chip">n={inteiro(n)} · não classificar</span>}</td>
                      <td>{classificavel ? <b>{decimal(c.atendimento?.notaGeral)}</b> : "—"}</td>
                      <td>{classificavel ? decimal(c.atendimento?.clareza) : "—"}</td>
                      <td>{classificavel ? decimal(c.atendimento?.qualificacao) : "—"}</td>
                      <td>{classificavel ? decimal(c.atendimento?.objecoes) : "—"}</td>
                      <td>{classificavel ? decimal(c.atendimento?.conducao) : "—"}</td>
                    </tr>
                  );
                })}
              </Tabela>
            </section>
          )}

          <div className="ape-int-aviso">
            <b>Regra de justiça.</b> A IA orienta coaching e nunca substitui auditoria humana; a avaliação é revisável.
            {semNota.length > 0 && ` Fora da classificação por amostra: ${semNota.map((c) => c.nome).join(" · ")}.`}
            {avaliadas > 0 && ` Base técnica: ${inteiro(avaliadas)} mensagens analisadas.`} Conversa fora do ERP não é avaliada — o buraco é declarado, não preenchido.
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · {inteiro(amostra)} atendimento(s) avaliado(s) · {comNota.length} pessoa(s) classificável(is).
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
