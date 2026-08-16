"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

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
type Painel = { empresa?: Empresa | null; corretores?: Corretor[]; error?: string };

const n = (valor: unknown) => Number(valor) || 0;
const inteiro = (valor: unknown) => n(valor).toLocaleString("pt-BR");
const dinheiro = (valor: unknown) => n(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

export function ManagerPanelMobile({ accessToken }: { accessToken: string }) {
  const [dados, setDados] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch("/api/performance?periodo=mes", { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal });
    if (resposta.status === 401) throw new Error("sessao_expirada");
    const json = await resposta.json().catch(() => ({})) as Painel;
    if (!resposta.ok || json.error) throw new Error(json.error || "Não foi possível carregar o painel.");
    setDados(json); setErro(""); setSessaoExpirada(false); setAtualizadoEm(new Date());
  }, [accessToken]);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal).catch((falha) => {
      if (falha?.name === "AbortError") return;
      if (falha instanceof Error && falha.message === "sessao_expirada") setSessaoExpirada(true);
      else setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o painel.");
      setDados({ empresa: null, corretores: [] });
    });
    return () => controle.abort();
  }, [carregar, tentativa]);

  const empresa = dados?.empresa ?? null;
  const corretores = dados?.corretores ?? [];
  const respostaMediana = useMemo(() => {
    const comAmostra = corretores.filter((c) => n(c.slaAmostra) > 0 && c.medianaRespostaMin !== null);
    const amostra = comAmostra.reduce((total, c) => total + n(c.slaAmostra), 0);
    return amostra ? comAmostra.reduce((total, c) => total + n(c.medianaRespostaMin) * n(c.slaAmostra), 0) / amostra : null;
  }, [corretores]);

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;
  return <main className="ape-painel">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <header className="ape-painel-abertura"><span className="ape-sobrancelha">Visão de gestão</span><h1>A equipe neste mês</h1></header>
    {dados === null && <div className="ape-painel-kpis" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div className="ape-painel-skeleton" key={i} />)}</div>}
    {erro && <div className="ape-estado ruim" role="alert"><strong>Não foi possível carregar o painel.</strong><p>{erro}</p><button type="button" onClick={() => { setDados(null); setTentativa((nAtual) => nAtual + 1); }}>Tentar novamente</button></div>}
    {dados !== null && !erro && !empresa && <div className="ape-estado"><div className="ape-estado-icone" aria-hidden="true">✓</div><strong>Sem dados neste período</strong><p>Assim que a equipe trabalhar, os indicadores aparecerão aqui.</p></div>}
    {empresa && <>
      <section className="ape-painel-kpis">
        <article><strong className={n(empresa.riscos.acoes_vencidas) ? "perigo" : ""}>{inteiro(empresa.riscos.acoes_vencidas)}</strong><span>ações vencidas</span></article>
        <article><strong>{respostaMediana === null ? "Sem amostra" : `${Math.round(respostaMediana)} min`}</strong><span>resposta mediana</span></article>
        <article><strong>{inteiro(empresa.fluxo.visitasRealizadas)}</strong><span>visitas realizadas</span></article>
        <article><strong className="roxo">{dinheiro(empresa.vgv)}</strong><span>VGV fechado</span></article>
      </section>
      {n(empresa.riscos.acoes_vencidas) > 0 && <section className="ape-painel-alerta"><span aria-hidden="true">!</span><div><strong>{inteiro(empresa.riscos.acoes_vencidas)} ações estão vencidas</strong><p>Revise capacidade e carteira antes de distribuir novos leads.</p></div></section>}
      <h2 className="ape-painel-secao">Corretores</h2>
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
