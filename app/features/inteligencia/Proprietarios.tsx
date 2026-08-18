"use client";

/* INTELIGÊNCIA — Captação de proprietários.
 *
 * Único funil do site com dado próprio hoje: `captacoes_portal` guarda o que o
 * proprietário enviou. As etapas anteriores (página de captação acessada, clique
 * em anunciar, formulário iniciado) dependem de telemetria e entram como
 * aguardando conexão — o funil começa onde o dado começa.
 *
 * A agregação acontece no servidor: esta tela recebe contagem, nunca nome,
 * telefone ou e-mail de proprietário.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Vazio } from "./CascaInteligencia";
import { dataCurta, inteiro, num, pct, useInteligencia } from "./dados";
import "../../styles/inteligencia.css";

/* Status que representam captação resolvida, para a taxa de aproveitamento. O
   casamento é por prefixo porque o campo é texto livre no banco. */
const PUBLICADA = ["publicad", "aprovad", "ativo", "ativa"];
const RECUSADA = ["recusad", "reprovad", "cancelad", "descartad"];
const classificar = (chave: string) => {
  const k = chave.toLowerCase();
  if (PUBLICADA.some((p) => k.startsWith(p))) return "bom";
  if (RECUSADA.some((p) => k.startsWith(p))) return "ruim";
  return "atencao";
};

export function Proprietarios({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const bloco = useMemo(() => dados?.proprietarios ?? null, [dados]);

  const recebidas = num(bloco?.recebidas);
  const porStatus = bloco?.porStatus ?? [];
  const publicadas = porStatus.filter((s) => classificar(s.chave) === "bom").reduce((t, s) => t + num(s.total), 0);
  const emAndamento = porStatus.filter((s) => classificar(s.chave) === "atencao").reduce((t, s) => t + num(s.total), 0);

  const kpis = [
    { rotulo: "Captações recebidas", valor: bloco ? inteiro(recebidas) : null, nota: bloco?.ultimaEm ? `última em ${dataCurta(bloco.ultimaEm)}` : "enviadas pelo site", origem: "captacoes_portal" },
    { rotulo: "Publicadas", valor: bloco ? inteiro(publicadas) : null, nota: pct(publicadas, recebidas) ? `${pct(publicadas, recebidas)} das recebidas` : "sem captação no período", origem: "captacoes_portal.status" },
    { rotulo: "Em andamento", valor: bloco ? inteiro(emAndamento) : null, nota: "aguardando contato ou avaliação", tom: (emAndamento > 0 ? "alerta" : "bom") as "alerta" | "bom", origem: "captacoes_portal.status" },
    { rotulo: "Com preço informado", valor: bloco ? inteiro(bloco.comPreco) : null, nota: pct(bloco?.comPreco, recebidas) ? `${pct(bloco?.comPreco, recebidas)} trouxeram valor` : "nenhum valor informado", origem: "captacoes_portal" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  return (
    <CascaInteligencia accessToken={accessToken}
      slug="proprietarios" grupo="empresa" titulo="Captação de proprietários"
      apoio="O site está ajudando a captar imóvel? O funil começa onde o dado começa: na captação enviada."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>O QUE CHEGOU PELO SITE</span>
            <h2>Captações do período</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} {...k} />)}
            </div>
          </section>

          {bloco && recebidas > 0 ? (
            <>
              <section className="ape-int-secao">
                <span>ONDE CADA CAPTAÇÃO ESTÁ</span>
                <h2>Situação das {inteiro(recebidas)} captações</h2>
                <div className="ape-int-linhas">
                  {porStatus.map((s) => (
                    <div className="ape-int-linha" key={s.chave}>
                      <span>{s.chave}</span>
                      <span className="ape-int-barra"><i style={{ width: `${Math.min(100, (100 * num(s.total)) / recebidas)}%` }} /></span>
                      <b>{inteiro(s.total)}</b>
                      <em>{pct(s.total, recebidas) ?? "—"}</em>
                    </div>
                  ))}
                  <small>Status vem do próprio cadastro da captação. Captação sem status aparece como “não informado” — volume sem classificação é informação, não sujeira.</small>
                </div>
              </section>

              <section className="ape-int-secao">
                <span>O QUE ESTÃO OFERECENDO</span>
                <h2>Bairro e finalidade</h2>
                <div className="ape-int-cartoes">
                  <article className="ape-int-cartao">
                    <b>Bairros mais ofertados</b>
                    {(bloco.porBairro ?? []).map((b) => (
                      <div className="ape-int-par" key={b.chave}><span>{b.chave}</span><b>{inteiro(b.total)}</b><span className="ape-int-chip">{pct(b.total, recebidas) ?? "—"}</span></div>
                    ))}
                    {(bloco.porBairro ?? []).length === 0 && <small>Nenhum bairro informado nas captações do período.</small>}
                  </article>
                  <article className="ape-int-cartao">
                    <b>Finalidade</b>
                    {(bloco.porFinalidade ?? []).map((f) => (
                      <div className="ape-int-par" key={f.chave}><span>{f.chave}</span><b>{inteiro(f.total)}</b><span className="ape-int-chip">{pct(f.total, recebidas) ?? "—"}</span></div>
                    ))}
                    <small>Venda e locação separadas: são duas operações diferentes e não se somam numa média.</small>
                  </article>
                </div>
              </section>
            </>
          ) : (
            <Vazio
              titulo="Nenhuma captação recebida neste período"
              apoio={`Nada foi enviado pelo formulário do site entre ${dados.periodo?.inicio} e ${dados.periodo?.fim}. Zero aqui é resultado confirmado, não falta de dado.`}
            />
          )}

          <section className="ape-int-secao">
            <span>AS ETAPAS ANTERIORES</span>
            <h2>Aguardando conexão</h2>
            <div className="ape-int-pendencias">
              <article className="ape-int-pendencia">
                <b>página de captação</b>
                <span>Quantas pessoas viram a página, clicaram em anunciar e começaram o formulário depende de telemetria do site — entra com o GA4 e a coleta própria.</span>
              </article>
              <article className="ape-int-pendencia">
                <b>tempo até contato</b>
                <span>Exige a data do primeiro contato com o proprietário; hoje a captação guarda apenas o status atual.</span>
              </article>
              <article className="ape-int-pendencia">
                <b>captação por corretor</b>
                <span>Depende de vínculo entre captação e responsável; sem esse campo não atribuímos mérito a ninguém.</span>
              </article>
            </div>
          </section>

          <div className="ape-int-aviso">
            <b>Privacidade.</b> A contagem é feita no servidor: nome, telefone e e-mail do proprietário nunca chegam a esta tela.
            Quem precisa falar com a pessoa abre a captação no cadastro, onde a permissão é verificada.
          </div>

          {dados.periodo && (
            <small className="ape-int-rodape">
              Período: {dados.periodo.inicio} até {dados.periodo.fim} (fim exclusivo) · fonte: captações enviadas pelo site.
            </small>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
