"use client";

/* INTELIGÊNCIA — Gerentes.
 *
 * A tela do canvas (17a) compara equipes. A leitura por equipe depende de uma
 * hierarquia (corretor -> gerente) que a fonte canônica ainda NÃO devolve: a RPC
 * entrega pessoas, não equipes. Então esta tela não inventa agrupamento nem
 * distribui gente em equipe fictícia.
 *
 * O que ela entrega hoje, com dado real, é exatamente o que um gerente age em cima:
 * carga por pessoa, quem passou do limite da carteira, onde há ação vencida e qual
 * redistribuição equilibra a casa. O corte por equipe aparece declarado como
 * pendência — vem junto com o cadastro de hierarquia, não antes.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Kpi, Tabela, Vazio } from "./CascaInteligencia";
import {
  SOBRECARGA_PCT, decimal, inteiro, lerEmpresa, num, pct, somar, useInteligencia, type Corretor,
} from "./dados";
import { Drawer, DrawerNumeros, DrawerPar, partes, useDrawer } from "./Drawer";
import "../../styles/inteligencia.css";

export function Gerentes({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const drawer = useDrawer();
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);
  const alvo = partes(drawer.alvo);
  const pessoa = alvo[0] === "gerencia" ? corretores.find((c) => c.corretorId === Number(alvo[1])) ?? null : null;
  const empresa = useMemo(() => lerEmpresa(dados?.empresa), [dados]);

  const carteira = somar(corretores, (c) => c.meuDia?.carteiraAtiva);
  const limite = somar(corretores, (c) => c.limiteCarteira);
  const sobrecarregados = corretores.filter((c) => num(c.capacidadePct) > SOBRECARGA_PCT);
  const folgados = corretores
    .filter((c) => num(c.limiteCarteira) > 0 && num(c.capacidadePct) < 70)
    .sort((a, b) => num(a.capacidadePct) - num(b.capacidadePct));
  const vencidas = somar(corretores, (c) => c.meuDia?.acoesVencidas);

  /* Quantos leads sairiam de quem passou do limite para trazer todos a 100%. */
  const excedente = sobrecarregados.reduce((total, c) => {
    const teto = num(c.limiteCarteira);
    return total + (teto > 0 ? Math.max(0, num(c.meuDia?.carteiraAtiva) - teto) : 0);
  }, 0);
  const folga = folgados.reduce((total, c) => total + Math.max(0, num(c.limiteCarteira) - num(c.meuDia?.carteiraAtiva)), 0);

  const kpis = [
    { rotulo: "Pessoas na operação", valor: corretores.length ? inteiro(corretores.length) : null, nota: "com atividade confirmada no período" },
    { rotulo: "Ocupação da casa", valor: limite > 0 ? `${decimal((100 * carteira) / limite)}%` : null, nota: limite > 0 ? `${inteiro(carteira)} de ${inteiro(limite)} vagas de carteira` : "limite de carteira não cadastrado" },
    { rotulo: "Acima do limite", valor: corretores.length ? inteiro(sobrecarregados.length) : null, nota: `acima de ${SOBRECARGA_PCT}% da carteira`, tom: (sobrecarregados.length > 0 ? "alerta" : "bom") as "alerta" | "bom" },
    { rotulo: "Ações vencidas", valor: corretores.length ? inteiro(vencidas) : null, nota: "o que exige intervenção do gerente", tom: (vencidas > 0 ? "alerta" : "bom") as "alerta" | "bom" },
  ];
  const confirmados = kpis.filter((k) => k.valor !== null).length;

  return (
    <CascaInteligencia
      slug="gerentes" grupo="operacao" titulo="Gerentes"
      apoio="Carga, limite de carteira e intervenções. O corte por equipe depende do cadastro de hierarquia — e está declarado como pendência."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={confirmados} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (
        <>
          <section className="ape-int-secao">
            <span>A CASA INTEIRA</span>
            <h2>Como a carga está distribuída</h2>
            <div className="ape-int-kpis">
              {kpis.map((k) => <Kpi key={k.rotulo} rotulo={k.rotulo} valor={k.valor} nota={k.nota} tom={k.tom} origem="performance_sala_comando" />)}
            </div>
          </section>

          <div className="ape-int-pendencias">
            <article className="ape-int-pendencia">
              <b>equipes</b>
              <span>A hierarquia corretor → gerente ainda não vem na fonte de performance. Enquanto não vier, esta tela mostra a casa inteira e a carga por pessoa — sem inventar equipe.</span>
            </article>
          </div>

          {corretores.length ? (
            <>
              <section className="ape-int-secao">
                <span>CARGA POR PESSOA</span>
                <h2>Quem passou do limite e quem tem folga</h2>
                <Tabela colunas={["Corretor", "Carteira", "Limite", "Ocupação", "Em dia", "Vencidas", "Situação"]}>
                  {corretores
                    .slice()
                    .sort((a, b) => num(b.capacidadePct) - num(a.capacidadePct))
                    .map((c) => {
                      const ocupacao = num(c.capacidadePct);
                      const acima = ocupacao > SOBRECARGA_PCT;
                      return (
                        <tr
                          key={c.corretorId} className="ape-int-linha-clicavel" tabIndex={0}
                          onClick={() => drawer.abrir(`gerencia:${c.corretorId}`)}
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter" || evento.key === " ") {
                              evento.preventDefault();
                              drawer.abrir(`gerencia:${c.corretorId}`);
                            }
                          }}
                        >
                          <td><span className="ape-int-pessoa"><i>{(c.nome || "?").slice(0, 1).toUpperCase()}</i><b>{c.nome}</b></span></td>
                          <td>{inteiro(c.meuDia?.carteiraAtiva)}</td>
                          <td>{num(c.limiteCarteira) > 0 ? inteiro(c.limiteCarteira) : <small>não cadastrado</small>}</td>
                          <td>{num(c.limiteCarteira) > 0 ? <span className={acima ? "ape-int-chip ruim" : ocupacao > 85 ? "ape-int-chip atencao" : "ape-int-chip bom"}>{decimal(ocupacao)}%</span> : "—"}</td>
                          <td>{pct(c.meuDia?.carteiraEmDia, c.meuDia?.carteiraAtiva) ?? "—"}</td>
                          <td>{num(c.meuDia?.acoesVencidas) > 0 ? <span className="ape-int-chip ruim">{inteiro(c.meuDia?.acoesVencidas)}</span> : inteiro(c.meuDia?.acoesVencidas)}</td>
                          <td>{acima ? <small>reduzir carteira</small> : ocupacao < 70 && num(c.limiteCarteira) > 0 ? <small>pode receber</small> : <small>equilibrada</small>}</td>
                        </tr>
                      );
                    })}
                </Tabela>
              </section>

              <section className="ape-int-secao">
                <span>INTERVENÇÃO SUGERIDA</span>
                <h2>O que reequilibra a casa hoje</h2>
                <div className="ape-int-cartoes">
                  <article className="ape-int-cartao">
                    <b>Redistribuição de carteira</b>
                    <div className="ape-int-par"><span>Excedente de quem passou do limite</span><b>{inteiro(excedente)} lead(s)</b></div>
                    <div className="ape-int-par"><span>Folga disponível na casa</span><b>{inteiro(folga)} vaga(s)</b></div>
                    <div className="ape-int-par"><span>Cabe redistribuir agora</span><b>{inteiro(Math.min(excedente, folga))} lead(s)</b></div>
                    <small>{excedente === 0 ? "Ninguém acima do limite: nada a redistribuir." : folga === 0 ? "Sem folga na casa — redistribuir só resolve com limite revisado ou gente nova." : "Cálculo por regra, sobre o limite cadastrado. A decisão é do gerente."}</small>
                  </article>
                  <article className="ape-int-cartao">
                    <b>Quem pode receber</b>
                    {folgados.slice(0, 5).map((c) => (
                      <div className="ape-int-par" key={c.corretorId}>
                        <span>{c.nome}</span>
                        <b>{inteiro(Math.max(0, num(c.limiteCarteira) - num(c.meuDia?.carteiraAtiva)))} vaga(s)</b>
                        <span className="ape-int-chip bom">{decimal(c.capacidadePct)}%</span>
                      </div>
                    ))}
                    {folgados.length === 0 && <small>Ninguém com folga relevante — ou o limite de carteira não está cadastrado.</small>}
                  </article>
                </div>
              </section>
            </>
          ) : (
            <Vazio titulo="Nenhuma pessoa com atividade neste período" apoio="Sem atividade confirmada não há carga para distribuir — e nada aqui é estimado." />
          )}

          <div className="ape-int-aviso">
            <b>Como ler.</b> Ocupação é carteira ativa sobre o limite cadastrado do próprio corretor; sem limite cadastrado não existe percentual, e a linha diz isso em vez de assumir um teto.
            {num(empresa?.riscos?.corretores_sobrecarregados) > 0 && ` A fonte canônica também marca ${inteiro(empresa?.riscos?.corretores_sobrecarregados)} pessoa(s) sobrecarregada(s).`}
          </div>

          {pessoa && (
            <Drawer
              titulo={pessoa.nome} codigo={`GESTÃO · ${pessoa.corretorId}`}
              apoio="Decisão de capacidade baseada na carteira cadastrada" icone="pessoa" cor="roxo"
              selo={num(pessoa.capacidadePct) > SOBRECARGA_PCT ? "intervenção" : "acompanhar"}
              tomSelo={num(pessoa.capacidadePct) > SOBRECARGA_PCT ? "ruim" : "bom"}
              onFechar={drawer.fechar}
            >
              <DrawerNumeros itens={[
                { rotulo: "carteira", valor: inteiro(pessoa.meuDia?.carteiraAtiva) },
                { rotulo: "limite", valor: num(pessoa.limiteCarteira) > 0 ? inteiro(pessoa.limiteCarteira) : "—" },
                { rotulo: "ocupação", valor: num(pessoa.limiteCarteira) > 0 ? `${decimal(pessoa.capacidadePct)}%` : "—" },
              ]} />
              <DrawerPar rotulo="Carteira em dia" valor={pct(pessoa.meuDia?.carteiraEmDia, pessoa.meuDia?.carteiraAtiva)} />
              <DrawerPar rotulo="Ações vencidas" valor={inteiro(pessoa.meuDia?.acoesVencidas)} />
              <DrawerPar rotulo="Sem próxima ação" valor={inteiro(pessoa.meuDia?.semProximaAcao)} />
              <article className="ape-int-cartao ape-int-cartao-interno">
                <b>Decisão sugerida</b>
                <small>
                  {num(pessoa.capacidadePct) > SOBRECARGA_PCT
                    ? `Reduzir a carteira em ${inteiro(Math.max(0, num(pessoa.meuDia?.carteiraAtiva) - num(pessoa.limiteCarteira)))} lead(s) para voltar ao limite cadastrado.`
                    : num(pessoa.limiteCarteira) > 0 && num(pessoa.capacidadePct) < 70
                      ? `Pode receber até ${inteiro(Math.max(0, num(pessoa.limiteCarteira) - num(pessoa.meuDia?.carteiraAtiva)))} lead(s), sujeito à decisão do gerente.`
                      : "Carga equilibrada; priorize as ações vencidas antes de redistribuir."}
                </small>
              </article>
              <a className="ape-int-acao" href="/crm">Abrir carteira no CRM</a>
            </Drawer>
          )}
        </>
      )}
    </CascaInteligencia>
  );
}
