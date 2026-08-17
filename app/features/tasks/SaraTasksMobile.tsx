"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BotaoWhatsApp } from "../funil-2/BotaoWhatsApp";
import { acaoVisivel, prazoDaAcao, semPrazo, type LeadFunil2 } from "../funil-2/modelo";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

type Faixa = "atrasadas" | "agora" | "hoje" | "futuras" | "concluidas";
type Analise = {
  id: number; funil_lead_id: string; status: string; momento_sugerido: string | null;
  acao_sugerida: string | null; resumo: string; confianca: number | null; analisado_em: string;
};
type Decisao = {
  id: number; analise_id: number; funil_lead_id: string; decisao: "aceita" | "recusada";
  motivo: string | null; decidido_em: string;
};
type Payload = { leads?: LeadFunil2[]; analisesSara?: Analise[]; decisoesSara?: Decisao[]; error?: string };
type Tarefa = { lead: LeadFunil2; analise: Analise | null; decisao: Decisao | null; faixa: Exclude<Faixa, "concluidas"> };

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "?";
}

function mesmoDia(a: Date, b: Date) {
  return a.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === b.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function faixaDaTarefa(lead: LeadFunil2, agora: Date): Exclude<Faixa, "concluidas"> {
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
  const [faixa, setFaixa] = useState<Faixa>("agora");
  const [erro, setErro] = useState("");
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [decidindo, setDecidindo] = useState<number | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    const resposta = await fetch("/api/funil2", { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal });
    if (resposta.status === 401) throw new Error("sessao_expirada");
    const json = await resposta.json().catch(() => ({})) as Payload;
    if (!resposta.ok) throw new Error(json.error || "Não foi possível carregar suas tarefas.");
    setDados(json); setErro(""); setSessaoExpirada(false); setAtualizadoEm(new Date());
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
      setDados({ leads: [], analisesSara: [], decisoesSara: [] });
    });
    return () => controle.abort();
  }, [carregar, tentativa]);

  const estrutura = useMemo(() => {
    const agora = new Date();
    const analises = dados?.analisesSara ?? [];
    const decisoes = dados?.decisoesSara ?? [];
    const analisePorLead = new Map<string, Analise>();
    const analisePorId = new Map<number, Analise>();
    for (const analise of analises) {
      analisePorId.set(analise.id, analise);
      if (!analisePorLead.has(analise.funil_lead_id)) analisePorLead.set(analise.funil_lead_id, analise);
    }
    const decisaoPorAnalise = new Map(decisoes.map((decisao) => [decisao.analise_id, decisao]));
    const leadPorId = new Map((dados?.leads ?? []).map((lead) => [lead.id, lead]));
    const tarefas: Tarefa[] = [];
    for (const lead of dados?.leads ?? []) {
      if (semPrazo(lead.proxima_acao_em)) continue;
      const analise = analisePorLead.get(lead.id) ?? null;
      const decisao = analise ? decisaoPorAnalise.get(analise.id) ?? null : null;
      if (decisao?.decisao === "recusada") continue;
      tarefas.push({ lead, analise, decisao, faixa: faixaDaTarefa(lead, agora) });
    }
    tarefas.sort((a, b) => new Date(a.lead.proxima_acao_em).getTime() - new Date(b.lead.proxima_acao_em).getTime());
    return { tarefas, decisoes, analisePorId, leadPorId };
  }, [dados]);

  const contagens = useMemo(() => ({
    atrasadas: estrutura.tarefas.filter((t) => t.faixa === "atrasadas").length,
    agora: estrutura.tarefas.filter((t) => t.faixa === "agora").length,
    hoje: estrutura.tarefas.filter((t) => t.faixa === "hoje").length,
    futuras: estrutura.tarefas.filter((t) => t.faixa === "futuras").length,
    concluidas: estrutura.decisoes.length,
  }), [estrutura]);

  const decidir = useCallback(async (analise: Analise, decisao: "aceita" | "recusada") => {
    const motivo = decisao === "recusada" ? window.prompt("Por que esta sugestão não serve? (opcional)", "") : "";
    if (decisao === "recusada" && motivo === null) return;
    setDecidindo(analise.id); setErro("");
    try {
      const resposta = await fetch("/api/funil2", {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decidirSugestao", analiseId: analise.id, decisao, motivo }),
      });
      const json = await resposta.json().catch(() => ({})) as { error?: string };
      if (resposta.status === 401) { setSessaoExpirada(true); return; }
      if (!resposta.ok) throw new Error(json.error || "Não foi possível registrar sua decisão.");
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível registrar sua decisão.");
    } finally { setDecidindo(null); }
  }, [accessToken, carregar]);

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;
  const visiveis = faixa === "concluidas" ? [] : estrutura.tarefas.filter((tarefa) => tarefa.faixa === faixa);

  return <main className="ape-tarefas">
    <AppMobileOffline atualizadoEm={atualizadoEm} />
    <nav className="ape-filtros ape-tarefas-filtros" aria-label="Filtrar tarefas">
      {(["atrasadas", "agora", "hoje", "futuras", "concluidas"] as const).map((chave) => <button
        type="button" key={chave} className={faixa === chave ? "ativo" : ""} onClick={() => setFaixa(chave)}
      >{chave === "atrasadas" ? "Atrasadas" : chave === "agora" ? "Agora" : chave === "hoje" ? "Hoje" : chave === "futuras" ? "Futuras" : "Concluídas"}{contagens[chave] ? ` · ${contagens[chave]}` : ""}</button>)}
    </nav>

    {dados === null && <div className="ape-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i}><div className="ape-barra curta" /><div className="ape-barra media" /><div className="ape-barra alta" /></div>)}</div>}
    {erro && <div className="ape-estado ruim" role="alert"><strong>Não foi possível carregar suas tarefas.</strong><p>{erro}</p><button type="button" onClick={() => { setDados(null); setTentativa((n) => n + 1); }}>Tentar novamente</button></div>}

    {faixa !== "concluidas" && dados !== null && !erro && visiveis.length === 0 && <div className="ape-estado">
      <div className="ape-estado-icone" aria-hidden="true">✓</div><strong>Fila zerada</strong><p>Nenhuma tarefa nesta faixa. Veja as próximas ou volte ao seu dia.</p>
    </div>}

    {faixa !== "concluidas" && visiveis.length > 0 && <section className="ape-tarefas-lista">
      {visiveis.map(({ lead, analise, decisao, faixa: faixaTarefa }) => {
        const sugestao = Boolean(analise?.acao_sugerida && analise.status === "revisao_humana" && !decisao);
        const prazo = prazoCurto(lead);
        return <article className="ape-tarefa-card" key={lead.id}>
          <header><span className={`ape-tarefa-tag ${sugestao ? "sara" : faixaTarefa}`}>{sugestao ? "Sugestão da Sara" : rotuloFaixa(faixaTarefa)}</span><span className={`ape-tarefa-prazo ${prazo.classe}`}>{prazo.texto}</span></header>
          <h2>{sugestao ? analise?.acao_sugerida : acaoVisivel(lead)}</h2>
          <div className="ape-tarefa-lead"><span>{iniciais(lead.nome)}</span><strong>{lead.nome}</strong></div>
          {(analise?.resumo || lead.ultima_reavaliacao_resumo) && <p className="ape-tarefa-sara"><b>Sara:</b> {analise?.resumo || lead.ultima_reavaliacao_resumo}</p>}
          {sugestao && analise ? <div className="ape-tarefa-decidir"><button type="button" disabled={decidindo === analise.id} onClick={() => void decidir(analise, "aceita")}>Aceitar sugestão</button><button type="button" disabled={decidindo === analise.id} onClick={() => void decidir(analise, "recusada")}>Recusar</button></div>
            : <div className="ape-tarefa-whatsapp"><BotaoWhatsApp telefone={lead.telefone} negocioId={lead.origem_negocio_id} compacto /></div>}
        </article>;
      })}
    </section>}

    {faixa === "concluidas" && <section className="ape-tarefas-lista">
      {estrutura.decisoes.map((decisao) => {
        const analise = estrutura.analisePorId.get(decisao.analise_id);
        const lead = estrutura.leadPorId.get(decisao.funil_lead_id);
        if (!analise) return null;
        return <article className="ape-tarefa-card concluida" key={decisao.id}>
          <header><span className="ape-tarefa-tag concluida">{decisao.decisao === "aceita" ? "Sugestão aceita" : "Sugestão recusada"}</span><span className="ape-tarefa-prazo">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(decisao.decidido_em))}</span></header>
          <h2>{analise.acao_sugerida || analise.resumo}</h2>
          {lead && <div className="ape-tarefa-lead"><span>{iniciais(lead.nome)}</span><strong>{lead.nome}</strong></div>}
          {decisao.motivo && <p className="ape-tarefa-sara">Motivo informado: {decisao.motivo}</p>}
        </article>;
      })}
      {dados !== null && !erro && estrutura.decisoes.length === 0 && <div className="ape-estado"><div className="ape-estado-icone" aria-hidden="true">✓</div><strong>Nenhuma decisão ainda</strong><p>As sugestões aceitas ou recusadas aparecerão aqui.</p></div>}
    </section>}

    <p className="ape-tarefas-nota">Concluir uma tarefa não significa que o contato aconteceu — somente a sincronização oficial confirma.</p>
  </main>;
}
