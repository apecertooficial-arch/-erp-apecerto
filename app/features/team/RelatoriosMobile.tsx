"use client";

/* RELATORIOS NO CELULAR.
 *
 * Fonte: /api/performance?periodo=... -- o mesmo endpoint do Inicio do gestor.
 * Quatro cartoes, um por pergunta que um gestor faz sobre o mes: a equipe
 * trabalhou, atendeu no prazo, o funil andou, e quanto entrou.
 *
 * SEM VARIACAO CONTRA O PERIODO ANTERIOR. O desenho aprovado mostrava "+18% vs
 * julho", mas a API devolve uma janela por vez e nao expoe a anterior: inventar
 * a comparacao seria pior do que nao mostra-la. Quando o endpoint devolver os
 * dois periodos, cada cartao ganha a linha da variacao.
 *
 * Cada numero so aparece se o campo existir. Nada de zero decorativo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

type Periodo = "7d" | "mes" | "trimestre" | "ano" | "todo";

type Corretor = {
  corretorId: number; nome: string; mensagens: number | null; minutosErp: number | null;
  visitasMarcadas: number | null; visitasRealizadas: number | null; vendas: number | null; vgv: number | null;
  carteiraAtiva: number | null; acoesVencidas: number | null; capacidadePct: number | null;
  slaAmostra: number | null; sla15Pct: number | null; medianaRespostaMin: number | null;
};
type Empresa = {
  vendas: number | null; vgv: number | null;
  fluxo: { leads: number | null; visitasMarcadas: number | null; visitasRealizadas: number | null };
  riscos: { carteira_ativa: number | null; acoes_vencidas: number | null; corretores_sobrecarregados: number | null; visitas_sem_feedback: number | null };
};
type Painel = {
  periodo?: { inicio: string; fim: string } | null;
  empresa?: Empresa | null; corretores?: Corretor[]; error?: string;
};
type Cartao = { chave: string; titulo: string; numero: string; legenda: string; linhas: string[] };

const PERIODOS: Array<{ id: Periodo; rotulo: string }> = [
  { id: "7d", rotulo: "7 dias" },
  { id: "mes", rotulo: "Mês" },
  { id: "trimestre", rotulo: "Trimestre" },
  { id: "ano", rotulo: "Ano" },
  { id: "todo", rotulo: "Tudo" },
];

const n = (valor: unknown) => Number(valor) || 0;
const tem = (valor: unknown) => valor !== null && valor !== undefined;
const inteiro = (valor: unknown) => n(valor).toLocaleString("pt-BR");
const dinheiro = (valor: unknown) => n(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const dataCurta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");

/** O `fim` da API e exclusivo (hoje + 1): exibimos um dia antes. */
function janelaPorExtenso(periodo: { inicio: string; fim: string } | null | undefined): string {
  if (!periodo?.inicio || !periodo?.fim) return "";
  const fim = new Date(`${periodo.fim}T12:00:00`);
  if (Number.isNaN(fim.getTime())) return "";
  fim.setUTCDate(fim.getUTCDate() - 1);
  return `${dataCurta(periodo.inicio)} a ${dataCurta(fim.toISOString().slice(0, 10))}`;
}

export function RelatoriosMobile({ accessToken }: { accessToken: string }) {
  const [dados, setDados] = useState<Painel | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [erro, setErro] = useState("");
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch(`/api/performance?periodo=${periodo}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal });
    if (resposta.status === 401) throw new Error("sessao_expirada");
    const json = await resposta.json().catch(() => ({})) as Painel;
    if (!resposta.ok || json.error) throw new Error(json.error || "Não foi possível carregar os relatórios.");
    setDados(json); setErro(""); setSessaoExpirada(false); setAtualizadoEm(new Date());
  }, [accessToken, periodo]);

  useEffect(() => {
    const controle = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar(controle.signal).catch((falha) => {
      if (falha?.name === "AbortError") return;
      if (falha instanceof Error && falha.message === "sessao_expirada") setSessaoExpirada(true);
      else setErro(falha instanceof Error ? falha.message : "Não foi possível carregar os relatórios.");
      setDados({ empresa: null, corretores: [] });
    });
    return () => controle.abort();
  }, [carregar, tentativa]);

  const empresa = dados?.empresa ?? null;
  const corretores = useMemo(() => dados?.corretores ?? [], [dados?.corretores]);

  /* Mediana e SLA da empresa: media ponderada pela amostra de cada corretor --
     somar porcentagem de quem atendeu 3 leads com quem atendeu 300 mentiria. */
  const atendimento = useMemo(() => {
    const comAmostra = corretores.filter((c) => n(c.slaAmostra) > 0);
    const amostra = comAmostra.reduce((total, c) => total + n(c.slaAmostra), 0);
    if (!amostra) return { mediana: null as number | null, noPrazo: null as number | null, amostra: 0 };
    return {
      mediana: comAmostra.reduce((t, c) => t + n(c.medianaRespostaMin) * n(c.slaAmostra), 0) / amostra,
      noPrazo: comAmostra.reduce((t, c) => t + n(c.sla15Pct) * n(c.slaAmostra), 0) / amostra,
      amostra,
    };
  }, [corretores]);

  const cartoes = useMemo<Cartao[]>(() => {
    if (!empresa) return [];
    const lista: Cartao[] = [];

    /* TRABALHO: quantos corretores de fato trabalharam no periodo. "Dentro da
       meta" nao existe na API -- o que existe e atividade registrada. */
    if (corretores.length) {
      const ativos = corretores.filter((c) => n(c.mensagens) > 0 || n(c.minutosErp) > 0).length;
      const linhas = [`${inteiro(corretores.reduce((t, c) => t + n(c.mensagens), 0))} mensagens no período`];
      if (tem(empresa.riscos?.corretores_sobrecarregados) && n(empresa.riscos.corretores_sobrecarregados) > 0) {
        linhas.push(`${inteiro(empresa.riscos.corretores_sobrecarregados)} acima da capacidade`);
      }
      lista.push({
        chave: "trabalho", titulo: "Trabalho",
        numero: `${ativos} de ${corretores.length}`,
        legenda: "corretores com atividade registrada", linhas,
      });
    }

    /* ATENDIMENTO: resposta mediana e o que foi respondido no prazo. */
    lista.push({
      chave: "atendimento", titulo: "Atendimento",
      numero: atendimento.mediana === null ? "Sem amostra" : `${Math.round(atendimento.mediana)} min`,
      legenda: "resposta mediana ao lead novo",
      linhas: atendimento.noPrazo === null
        ? ["Nenhum primeiro contato medido neste período"]
        : [`${Math.round(atendimento.noPrazo)}% respondidos no prazo`, `${inteiro(atendimento.amostra)} primeiros contatos medidos`],
    });

    /* FUNIL: do lead ate a visita realizada. Sem lead no periodo, o cartao nao
       inventa porcentagem. */
    if (tem(empresa.fluxo?.leads)) {
      const leads = n(empresa.fluxo.leads);
      const realizadas = n(empresa.fluxo?.visitasRealizadas);
      const linhas = [`${inteiro(leads)} leads no período`];
      if (tem(empresa.fluxo?.visitasMarcadas)) {
        linhas.push(`${inteiro(empresa.fluxo.visitasMarcadas)} visitas marcadas · ${inteiro(realizadas)} realizadas`);
      }
      lista.push({
        chave: "funil", titulo: "Funil",
        numero: leads > 0 ? `${Math.round((realizadas / leads) * 100)}%` : "—",
        legenda: "lead que virou visita realizada", linhas,
      });
    }

    /* RECEITA. */
    if (tem(empresa.vgv) || tem(empresa.vendas)) {
      const linhas: string[] = [];
      if (tem(empresa.vendas)) linhas.push(`${inteiro(empresa.vendas)} vendas assinadas`);
      const vendas = n(empresa.vendas);
      if (vendas > 0 && tem(empresa.vgv)) linhas.push(`ticket médio de ${dinheiro(n(empresa.vgv) / vendas)}`);
      lista.push({
        chave: "receita", titulo: "Receita",
        numero: dinheiro(empresa.vgv), legenda: "VGV assinado no período", linhas,
      });
    }

    return lista;
  }, [atendimento, corretores, empresa]);

  const janela = janelaPorExtenso(dados?.periodo);

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;
  return <main className="ape-painel">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <header className="ape-painel-abertura">
      <span className="ape-sobrancelha">Visão de gestão</span>
      <h1>Relatórios</h1>
    </header>

    <nav className="ape-filtros ape-painel-filtros" role="tablist" aria-label="Período">
      {PERIODOS.map((item) => <button
        type="button" key={item.id} role="tab" aria-selected={periodo === item.id}
        className={periodo === item.id ? "ativo" : ""}
        onClick={() => { setPeriodo(item.id); setErro(""); }}
      >{item.rotulo}</button>)}
    </nav>
    {janela && <p className="ape-painel-janela">{janela}</p>}

    {dados === null && <div className="ape-resumo" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div className="ape-painel-skeleton" key={i} />)}</div>}

    {erro && <div className="ape-estado ruim" role="alert">
      <strong>Não foi possível carregar os relatórios.</strong>
      <p>{erro}</p>
      <button type="button" onClick={() => { setDados(null); setTentativa((atual) => atual + 1); }}>Tentar novamente</button>
    </div>}

    {dados !== null && !erro && cartoes.length === 0 && <div className="ape-estado">
      <div className="ape-estado-icone" aria-hidden="true">✓</div>
      <strong>Sem dados neste período</strong>
      <p>Escolha um período maior ou espere a equipe trabalhar.</p>
    </div>}

    {cartoes.length > 0 && <section className="ape-relatorios">
      {cartoes.map((cartao) => (
        <article className={`ape-relatorio-card ${cartao.chave}`} key={cartao.chave}>
          <span className="ape-relatorio-titulo">{cartao.titulo}</span>
          <strong>{cartao.numero}</strong>
          <span className="ape-relatorio-legenda">{cartao.legenda}</span>
          <ul>{cartao.linhas.map((linha) => <li key={linha}>{linha}</li>)}</ul>
        </article>
      ))}
    </section>}

    <p className="ape-gestao-nota">O relatório completo, com corretor a corretor e origem do lead, continua no ERP do computador.</p>
  </main>;
}
