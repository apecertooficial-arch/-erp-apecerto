"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoWhatsApp } from "../funil-2/BotaoWhatsApp";
import { acaoVisivel, leadFunil2EssencialValido, leadOperacionalNoMeuDia, prazoDaAcao, semPrazo, type LeadFunil2 } from "../funil-2/modelo";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

type Faixa = "atrasadas" | "agora" | "hoje" | "futuras";
type Payload = { leads?: LeadFunil2[]; error?: string };
type Tarefa = { lead: LeadFunil2; faixa: Faixa };

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

function mesmoDia(a: Date, b: Date) {
  return a.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === b.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function faixaDaTarefa(lead: LeadFunil2, agora: Date): Faixa {
  const prazo = new Date(lead.proxima_acao_em);
  if (prazo.getTime() < agora.getTime()) return "atrasadas";
  if (prazo.getTime() <= agora.getTime() + 2 * 60 * 60 * 1000) return "agora";
  if (mesmoDia(prazo, agora)) return "hoje";
  return "futuras";
}

function rotuloFaixa(faixa: Tarefa["faixa"]) {
  return faixa === "atrasadas" ? "Atrasada" : faixa === "agora" ? "Agora" : faixa === "hoje" ? "Hoje" : "Futura";
}

function prazoCurto(lead: LeadFunil2) {
  const prazo = prazoDaAcao(lead);
  return { texto: prazo.rotulo, classe: prazo.classe };
}

export function SaraTasksMobile({ accessToken }: { accessToken: string }) {
  const [dados, setDados] = useState<Payload | null>(null);
  const [faixa, setFaixa] = useState<Faixa>("atrasadas");
  const [limite, setLimite] = useState(25);
  const [erro, setErro] = useState("");
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(relogio);
  }, []);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch("/api/funil2", { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal });
    if (resposta.status === 401) throw new Error("sessao_expirada");
    const json = await resposta.json().catch(() => ({})) as { leads?: unknown; error?: string };
    if (!resposta.ok) throw new Error(json.error || "Não foi possível carregar suas tarefas.");
    const leads = json.leads;
    if (!Array.isArray(leads) || !leads.every(leadFunil2EssencialValido)) throw new Error("Não foi possível confirmar as tarefas recebidas.");
    setDados({ leads }); setErro(""); setSessaoExpirada(false); setAtualizadoEm(new Date());
  }, [accessToken]);

  useEffect(() => {
    const controle = new AbortController();
    // A chamada só altera estado depois da resposta externa; não há atualização
    // síncrona no corpo do efeito apesar do falso positivo da regra do React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar(controle.signal).catch((falha) => {
      if (falha?.name === "AbortError") return;
      if (falha instanceof Error && falha.message === "sessao_expirada") setSessaoExpirada(true);
      else setErro(falha instanceof Error ? falha.message : "Não foi possível carregar suas tarefas.");
      setDados({ leads: [] });
    });
    return () => controle.abort();
  }, [carregar, tentativa]);

  const estrutura = useMemo(() => {
    const instante = new Date(agora);
    const tarefas: Tarefa[] = [];
    for (const lead of dados?.leads ?? []) {
      if (!leadOperacionalNoMeuDia(lead) || lead.etapa === "pescado" || semPrazo(lead.proxima_acao_em)) continue;
      tarefas.push({ lead, faixa: faixaDaTarefa(lead, instante) });
    }
    tarefas.sort((a, b) => new Date(a.lead.proxima_acao_em).getTime() - new Date(b.lead.proxima_acao_em).getTime());
    return tarefas;
  }, [dados, agora]);

  const contagens = useMemo(() => ({
    atrasadas: estrutura.filter((t) => t.faixa === "atrasadas").length,
    agora: estrutura.filter((t) => t.faixa === "agora").length,
    hoje: estrutura.filter((t) => t.faixa === "hoje").length,
    futuras: estrutura.filter((t) => t.faixa === "futuras").length,
  }), [estrutura]);

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;
  const visiveis = estrutura.filter((tarefa) => tarefa.faixa === faixa);

  return <section className="ape-tarefas" aria-label="Tarefas da Sara">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <nav className="ape-filtros ape-tarefas-filtros" aria-label="Filtrar tarefas">
      {(["atrasadas", "agora", "hoje", "futuras"] as const).map((chave) => <button
        type="button" key={chave} className={faixa === chave ? "ativo" : ""} onClick={() => { setFaixa(chave); setLimite(25); }}
      >{chave === "atrasadas" ? "Atrasadas" : chave === "agora" ? "Agora" : chave === "hoje" ? "Hoje" : "Futuras"}{contagens[chave] ? ` · ${contagens[chave]}` : ""}</button>)}
    </nav>

    {dados === null && <><span className="sr-only" role="status">Carregando tarefas…</span><div className="ape-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i}><div className="ape-barra curta" /><div className="ape-barra media" /><div className="ape-barra alta" /></div>)}</div></>}
    {erro && <div className="ape-estado ruim" role="alert"><strong>Não foi possível carregar suas tarefas.</strong><p>{erro}</p><button type="button" onClick={() => { setDados(null); setTentativa((n) => n + 1); }}>Tentar novamente</button></div>}

    {dados !== null && !erro && visiveis.length === 0 && <div className="ape-estado">
      <div className="ape-estado-icone" aria-hidden="true">✓</div><strong>Fila zerada</strong><p>Nenhuma tarefa nesta faixa. Veja as próximas ou volte ao seu dia.</p>
    </div>}

    {visiveis.length > 0 && <section className="ape-tarefas-lista">
      {visiveis.slice(0, limite).map(({ lead, faixa: faixaTarefa }) => {
        const prazo = prazoCurto(lead);
        return <article className="ape-tarefa-card" key={lead.id}>
          <header><span className={`ape-tarefa-tag ${faixaTarefa}`}>{rotuloFaixa(faixaTarefa)}</span><span className={`ape-tarefa-prazo ${prazo.classe}`}>{prazo.texto}</span></header>
          <h2>{acaoVisivel(lead)}</h2>
          <div className="ape-tarefa-lead"><span>{iniciais(lead.nome)}</span><strong>{lead.nome}</strong></div>
          {lead.ultima_reavaliacao_resumo && <p className="ape-tarefa-sara"><b>Sara:</b> {lead.ultima_reavaliacao_resumo}</p>}
          {lead.qualidade_atendimento_nota != null && <p className="ape-tarefa-sara"><b>Nota do atendimento:</b> {Number(lead.qualidade_atendimento_nota).toFixed(1)}/10{lead.qualidade_atendimento_resumo ? ` · ${lead.qualidade_atendimento_resumo}` : ""}</p>}
          <div className="ape-tarefa-whatsapp"><BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} compacto /></div>
        </article>;
      })}
      {visiveis.length > limite && <button type="button" className="ape-tarefas-mais" onClick={() => setLimite((atual) => atual + 25)}>Mostrar mais</button>}
    </section>}

    <p className="ape-tarefas-nota">Concluir uma tarefa não significa que o contato aconteceu — somente a sincronização oficial confirma.</p>
  </section>;
}
