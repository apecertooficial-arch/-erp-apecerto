"use client";

/* INTELIGÊNCIA — Corretores.
 *
 * Lista gerencial e o perfil individual, com a regra do canvas (18a): sem ranking
 * público e sem cor de alerta para quem não tem amostra. Clicar numa pessoa abre
 * o perfil ao lado, com o que ela está fazendo bem e o que precisa melhorar —
 * derivado dos próprios números, não de opinião.
 *
 * Uso do ERP NÃO é jornada de trabalho: a coluna existe como sinal de atividade e
 * a tela diz isso, porque "tempo no sistema" é a métrica mais fácil de virar
 * injustiça.
 */

import { useMemo } from "react";

import { CascaInteligencia, Estados, Tabela, Vazio } from "./CascaInteligencia";
import {
  AMOSTRA_MINIMA, SLA_ATENCAO_MIN, SLA_META_MIN, dataCurta, decimal, dinheiro, duracao,
  inteiro, num, pct, useInteligencia, type Corretor,
} from "./dados";
import { Drawer, DrawerNumeros, DrawerPar, partes, useDrawer } from "./Drawer";
import "../../styles/inteligencia.css";

const faixa = (min: number) => (min <= SLA_META_MIN ? "bom" : min <= SLA_ATENCAO_MIN ? "atencao" : "ruim");

/* Leitura prática: dois pontos fortes e dois a melhorar, sempre com o número que
   sustenta a frase. Sem amostra, a tela não opina. */
function leitura(c: Corretor) {
  const bons: string[] = [];
  const ajustar: string[] = [];
  const nSla = num(c.atendimento?.amostraTurnos);
  const p50 = num(c.atendimento?.respostaP50Min);
  if (nSla >= AMOSTRA_MINIMA) {
    if (p50 <= SLA_META_MIN) bons.push(`responde em ${duracao(p50)} na mediana, dentro da meta`);
    else if (p50 > SLA_ATENCAO_MIN) ajustar.push(`mediana de ${duracao(p50)} no primeiro contato (meta ${SLA_META_MIN} min)`);
  }
  const nIa = num(c.atendimento?.iaAmostra);
  if (nIa >= AMOSTRA_MINIMA) {
    const nota = num(c.atendimento?.notaGeral);
    if (nota >= 4) bons.push(`nota ${decimal(nota)} em ${inteiro(nIa)} atendimentos avaliados`);
    else ajustar.push(`nota ${decimal(nota)} na conversa — base ${inteiro(nIa)} avaliações`);
  }
  if (num(c.meuDia?.acoesVencidas) > 0) ajustar.push(`${inteiro(c.meuDia?.acoesVencidas)} ação(ões) vencida(s) na carteira`);
  else if (num(c.meuDia?.carteiraAtiva) > 0) bons.push("carteira sem ação vencida");
  if (num(c.capacidadePct) > 100) ajustar.push(`carteira em ${decimal(c.capacidadePct)}% do limite`);
  if (num(c.producao?.vendas) > 0) bons.push(`${inteiro(c.producao?.vendas)} venda(s) no período`);
  return { bons: bons.slice(0, 3), ajustar: ajustar.slice(0, 3) };
}

export function Corretores({ accessToken }: { accessToken: string }) {
  const { dados, estado, periodo, trocarPeriodo, tentarNovamente } = useInteligencia(accessToken);
  const drawer = useDrawer();
  const corretores = useMemo<Corretor[]>(() => dados?.corretores ?? [], [dados]);
  const alvo = partes(drawer.alvo);
  const pessoa = alvo[0] === "corretor" ? corretores.find((c) => c.corretorId === Number(alvo[1])) ?? null : null;
  const analise = pessoa ? leitura(pessoa) : null;

  return (
    <CascaInteligencia
      slug="corretores" grupo="operacao" titulo="Corretores"
      apoio="Lista gerencial e perfil individual. Sem ranking público e sem classificar quem não tem amostra."
      periodo={periodo} onPeriodo={trocarPeriodo}
      confirmados={corretores.length ? 1 : 0} atualizadoEm={dados?.atualizadoEm}
    >
      <Estados estado={estado} temDado={!!dados} onTentar={tentarNovamente} />

      {dados && (corretores.length ? (
        <>
          <section className="ape-int-secao">
            <span>LISTA GERENCIAL</span>
            <h2>{corretores.length} pessoa(s) na mesma régua</h2>
            <Tabela colunas={["Corretor", "Carteira", "1º contato", "Visitas", "Vendas", "VGV", "Qualidade", "Vencidas", "Atividade"]} ordenaveis={[0, 1, 2, 3, 4, 5, 6, 7, 8]}>
              {corretores.map((c) => {
                const nSla = num(c.atendimento?.amostraTurnos);
                const nIa = num(c.atendimento?.iaAmostra);
                return (
                  <tr
                    key={c.corretorId} className="ape-int-linha-clicavel" tabIndex={0}
                    onClick={() => drawer.abrir(`corretor:${c.corretorId}`)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter" || evento.key === " ") {
                        evento.preventDefault();
                        drawer.abrir(`corretor:${c.corretorId}`);
                      }
                    }}
                  >
                    <td>
                      <span className="ape-int-pessoa"><i>{(c.nome || "?").slice(0, 1).toUpperCase()}</i><b>{c.nome}</b></span>
                      <small>{nSla >= AMOSTRA_MINIMA ? "amostra suficiente" : `amostra ${inteiro(nSla)} · não classificar`}</small>
                    </td>
                    <td>{inteiro(c.meuDia?.carteiraAtiva)}<small>{num(c.capacidadePct) > 100 ? `${decimal(c.capacidadePct)}% do limite` : `${decimal(c.capacidadePct)}% da capacidade`}</small></td>
                    <td>{nSla >= AMOSTRA_MINIMA ? <span className={`ape-int-chip ${faixa(num(c.atendimento?.respostaP50Min))}`}>{duracao(c.atendimento?.respostaP50Min)}</span> : <small>sem amostra</small>}</td>
                    <td>{inteiro(c.producao?.visitasRealizadas)}<small>de {inteiro(c.producao?.visitasMarcadas)} marcadas</small></td>
                    <td><b>{inteiro(c.producao?.vendas)}</b></td>
                    <td>{dinheiro(c.producao?.vgv)}</td>
                    <td>{nIa >= AMOSTRA_MINIMA ? decimal(c.atendimento?.notaGeral) : <small>sem amostra</small>}</td>
                    <td>{num(c.meuDia?.acoesVencidas) > 0 ? <span className="ape-int-chip ruim">{inteiro(c.meuDia?.acoesVencidas)}</span> : inteiro(c.meuDia?.acoesVencidas)}</td>
                    <td><small>{dataCurta(c.ultimoAcesso)}</small></td>
                  </tr>
                );
              })}
            </Tabela>
          </section>

          <div className="ape-int-aviso">
            <b>Uso do ERP não é jornada de trabalho.</b> Tempo ativo e último acesso são sinais de atividade no sistema, não controle de ponto: ausência de registro não é ausência de trabalho.
            Comissão individual não aparece aqui — vive em Financeiro, com permissão própria.
          </div>

          {pessoa && analise && (
            <Drawer
              titulo={pessoa.nome} codigo={`CORRETOR ${pessoa.corretorId}`}
              apoio="Perfil individual no período selecionado" icone="pessoa" cor="roxo"
              selo={num(pessoa.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA ? "amostra suficiente" : "sem classificar"}
              tomSelo={num(pessoa.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA ? "bom" : "atencao"}
              onFechar={drawer.fechar}
            >
              <DrawerNumeros itens={[
                { rotulo: "carteira ativa", valor: inteiro(pessoa.meuDia?.carteiraAtiva) },
                { rotulo: "vendas", valor: inteiro(pessoa.producao?.vendas) },
                { rotulo: "VGV", valor: dinheiro(pessoa.producao?.vgv) },
              ]} />
              <DrawerPar rotulo="Carteira em dia" valor={pct(pessoa.meuDia?.carteiraEmDia, pessoa.meuDia?.carteiraAtiva)} />
              <DrawerPar rotulo="1º contato · mediana" valor={num(pessoa.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA ? duracao(pessoa.atendimento?.respostaP50Min) : "sem amostra"} />
              <DrawerPar rotulo="1º contato · P90" valor={num(pessoa.atendimento?.amostraTurnos) >= AMOSTRA_MINIMA ? duracao(pessoa.atendimento?.respostaP90Min) : "sem amostra"} />
              <DrawerPar rotulo="Visitas realizadas" valor={inteiro(pessoa.producao?.visitasRealizadas)} />
              <article className="ape-int-cartao ape-int-cartao-interno">
                <b>Leitura prática</b>
                {analise.bons.length === 0 && analise.ajustar.length === 0 && <small>Sem amostra suficiente para orientar. A tela não opina sem base.</small>}
                {analise.bons.map((texto) => <div className="ape-int-par" key={texto}><span>{texto}</span><span className="ape-int-chip bom">indo bem</span></div>)}
                {analise.ajustar.map((texto) => <div className="ape-int-par" key={texto}><span>{texto}</span><span className="ape-int-chip atencao">melhorar</span></div>)}
              </article>
              <small>Tempo ativo no ERP: {duracao(pessoa.minutosErp)} em {inteiro(pessoa.diasComAcesso)} dia(s) com acesso. Esse sinal não é controle de ponto.</small>
            </Drawer>
          )}
        </>
      ) : (
        <Vazio titulo="Nenhum corretor com atividade neste período" apoio="A lista só existe com atividade confirmada; nada aqui é preenchido com estimativa." />
      ))}
    </CascaInteligencia>
  );
}
