"use client";

/* INÍCIO DO GESTOR no celular — resumo da operação.
 *
 * Fonte: /api/performance. Três cartões, um por pergunta que o gestor faz ao
 * pegar o telefone: quanto entrou (Finanças), quantos leads e o que está
 * largado (Leads), e como a equipe está trabalhando (Trabalho).
 *
 * PERÍODO: os cinco períodos são os que a API já sabe calcular — 7 dias, mês,
 * trimestre, ano e tudo. Nenhuma opção inventada: chip que o servidor não
 * entende volta silenciosamente como "mês" e o gestor leria um número errado
 * achando que é outro recorte. A janela real vem na resposta e aparece embaixo
 * dos chips, para o número nunca ficar sem data.
 *
 * REGRA DE DADO REAL: linha cujo número não existe no banco NÃO aparece — nem
 * zerada, nem com traço. "Comissão prevista" e "corretores online" estavam no
 * desenho aprovado e ficaram de fora por isso.
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
type Linha = { k: string; v: string; alerta?: boolean };

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

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

const dataCurta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");

/** "1 de ago a 17 de ago". O `fim` da API é exclusivo (hoje + 1), então exibimos
 *  um dia antes — dizer que o período termina amanhã confunde quem lê hoje. */
function janelaPorExtenso(periodo: { inicio: string; fim: string } | null | undefined): string {
  if (!periodo?.inicio || !periodo?.fim) return "";
  const fim = new Date(`${periodo.fim}T12:00:00`);
  if (Number.isNaN(fim.getTime())) return "";
  fim.setUTCDate(fim.getUTCDate() - 1);
  return `${dataCurta(periodo.inicio)} a ${dataCurta(fim.toISOString().slice(0, 10))}`;
}

export function ManagerPanelMobile({ accessToken }: { accessToken: string }) {
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
    if (!resposta.ok || json.error) throw new Error(json.error || "Não foi possível carregar o painel.");
    setDados(json); setErro(""); setSessaoExpirada(false); setAtualizadoEm(new Date());
  }, [accessToken, periodo]);

  useEffect(() => {
    const controle = new AbortController();
    // A chamada só altera estado depois da resposta externa; não há atualização
    // síncrona no corpo do efeito apesar do falso positivo da regra do React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar(controle.signal).catch((falha) => {
      if (falha?.name === "AbortError") return;
      if (falha instanceof Error && falha.message === "sessao_expirada") setSessaoExpirada(true);
      else setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o painel.");
      setDados({ empresa: null, corretores: [] });
    });
    return () => controle.abort();
  }, [carregar, tentativa]);

  const empresa = dados?.empresa ?? null;
  const corretores = useMemo(() => dados?.corretores ?? [], [dados?.corretores]);
  const respostaMediana = useMemo(() => {
    const comAmostra = corretores.filter((c) => n(c.slaAmostra) > 0 && c.medianaRespostaMin !== null);
    const amostra = comAmostra.reduce((total, c) => total + n(c.slaAmostra), 0);
    return amostra ? comAmostra.reduce((total, c) => total + n(c.medianaRespostaMin) * n(c.slaAmostra), 0) / amostra : null;
  }, [corretores]);

  /* Os três cartões. Cada linha entra na lista só se o campo existir. */
  const blocos = useMemo(() => {
    if (!empresa) return [];
    const financas: Linha[] = [];
    if (tem(empresa.vgv)) financas.push({ k: "VGV assinado", v: dinheiro(empresa.vgv) });
    if (tem(empresa.vendas)) financas.push({ k: "Vendas assinadas", v: inteiro(empresa.vendas) });

    const leads: Linha[] = [];
    if (tem(empresa.fluxo?.leads)) leads.push({ k: "Leads no período", v: inteiro(empresa.fluxo.leads) });
    if (tem(empresa.riscos?.acoes_vencidas)) leads.push({ k: "Ações vencidas", v: inteiro(empresa.riscos.acoes_vencidas), alerta: n(empresa.riscos.acoes_vencidas) > 0 });
    if (tem(empresa.riscos?.carteira_ativa)) leads.push({ k: "Na carteira da equipe", v: inteiro(empresa.riscos.carteira_ativa) });

    const trabalho: Linha[] = [];
    trabalho.push({ k: "Resposta mediana", v: respostaMediana === null ? "Sem amostra" : `${Math.round(respostaMediana)} min` });
    if (tem(empresa.fluxo?.visitasRealizadas) && tem(empresa.fluxo?.visitasMarcadas)) {
      trabalho.push({ k: "Visitas realizadas", v: `${inteiro(empresa.fluxo.visitasRealizadas)} de ${inteiro(empresa.fluxo.visitasMarcadas)}` });
    } else if (tem(empresa.fluxo?.visitasRealizadas)) {
      trabalho.push({ k: "Visitas realizadas", v: inteiro(empresa.fluxo.visitasRealizadas) });
    }
    if (tem(empresa.riscos?.corretores_sobrecarregados)) {
      trabalho.push({ k: "Corretores sobrecarregados", v: inteiro(empresa.riscos.corretores_sobrecarregados), alerta: n(empresa.riscos.corretores_sobrecarregados) > 0 });
    }

    return [
      { chave: "financas", titulo: "Finanças", linhas: financas },
      { chave: "leads", titulo: "Leads", linhas: leads },
      { chave: "trabalho", titulo: "Trabalho", linhas: trabalho },
    ].filter((bloco) => bloco.linhas.length > 0);
  }, [empresa, respostaMediana]);

  const janela = janelaPorExtenso(dados?.periodo);

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;
  return <main className="ape-painel">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <header className="ape-painel-abertura"><span className="ape-sobrancelha">Visão de gestão</span><h1>A operação hoje</h1></header>

    <nav className="ape-filtros ape-painel-filtros" role="tablist" aria-label="Período">
      {PERIODOS.map((item) => <button
        type="button" key={item.id} role="tab" aria-selected={periodo === item.id}
        className={periodo === item.id ? "ativo" : ""}
        onClick={() => { setPeriodo(item.id); setErro(""); }}
      >{item.rotulo}</button>)}
    </nav>
    {janela && <p className="ape-painel-janela">{janela}</p>}

    {dados === null && <div className="ape-resumo" aria-hidden="true">{[0, 1, 2].map((i) => <div className="ape-painel-skeleton" key={i} />)}</div>}
    {erro && <div className="ape-estado ruim" role="alert"><strong>Não foi possível carregar o painel.</strong><p>{erro}</p><button type="button" onClick={() => { setDados(null); setTentativa((nAtual) => nAtual + 1); }}>Tentar novamente</button></div>}
    {dados !== null && !erro && !empresa && <div className="ape-estado"><div className="ape-estado-icone" aria-hidden="true">✓</div><strong>Sem dados neste período</strong><p>Escolha um período maior ou espere a equipe trabalhar.</p></div>}
    {empresa && <>
      <section className="ape-resumo">
        {blocos.map((bloco) => (
          <article className={`ape-resumo-card ${bloco.chave}`} key={bloco.chave}>
            <span className="ape-resumo-titulo">{bloco.titulo}</span>
            <dl>
              {bloco.linhas.map((linha) => (
                <div key={linha.k}>
                  <dt>{linha.k}</dt>
                  <dd className={linha.alerta ? "alerta" : ""}>{linha.v}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>
      {n(empresa.riscos.acoes_vencidas) > 0 && <section className="ape-painel-alerta"><span aria-hidden="true">!</span><div><strong>{inteiro(empresa.riscos.acoes_vencidas)} ações estão vencidas</strong><p>Revise capacidade e carteira antes de distribuir novos leads.</p></div></section>}
      <h2 className="ape-painel-secao">Quem está trabalhando</h2>
      <section className="ape-painel-time">
        {corretores.map((corretor) => {
          const sla = Math.max(0, Math.min(100, n(corretor.sla15Pct)));
          return <article key={corretor.corretorId}><div><span className="ape-painel-avatar">{iniciais(corretor.nome)}</span><strong>{corretor.nome}</strong><em>{n(corretor.slaAmostra) ? `${Math.round(sla)}% no prazo` : "Sem amostra"}</em></div><i><span className={sla >= 85 ? "ok" : sla >= 70 ? "atencao" : "perigo"} style={{ width: `${sla}%` }} /></i><small>{inteiro(corretor.mensagens)} mensagens · {inteiro(corretor.visitasRealizadas)} visitas · {inteiro(corretor.vendas)} vendas</small></article>;
        })}
        {corretores.length === 0 && <p>Nenhum corretor no escopo deste gestor.</p>}
      </section>
    </>}
  </main>;
}
