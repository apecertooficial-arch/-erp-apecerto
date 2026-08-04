"use client";

import { useEffect, useMemo, useState } from "react";

type LeadApp = {
  etapa: string;
  proxima_acao_em: string;
};

type VisitaApp = {
  inicio_em: string;
  status: string;
};

type ResumoApp = {
  leads?: LeadApp[];
  visitas?: VisitaApp[];
};

function mesmoDia(valor: string, hoje: Date) {
  const data = new Date(valor);
  return data.getFullYear() === hoje.getFullYear()
    && data.getMonth() === hoje.getMonth()
    && data.getDate() === hoje.getDate();
}

export function InicioApp({ accessToken, nome, onIr }: {
  accessToken: string;
  nome: string;
  onIr: (destino: string) => void;
}) {
  const [dados, setDados] = useState<ResumoApp | null>(null);
  const [erro, setErro] = useState(false);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    let ativo = true;
    void fetch("/api/funil2", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("falha");
        return resposta.json() as Promise<ResumoApp>;
      })
      .then((json) => { if (ativo) { setDados(json); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [accessToken]);

  const resumo = useMemo(() => {
    const leads = dados?.leads ?? [];
    const fimHoje = new Date(agora);
    fimHoje.setHours(23, 59, 59, 999);
    return {
      agora: leads.filter((lead) => +new Date(lead.proxima_acao_em) <= agora).length,
      hoje: leads.filter((lead) => +new Date(lead.proxima_acao_em) > agora && +new Date(lead.proxima_acao_em) <= +fimHoje).length,
      novos: leads.filter((lead) => lead.etapa === "novo").length,
      visitas: (dados?.visitas ?? []).filter((visita) => mesmoDia(visita.inicio_em, fimHoje) && !["cancelada", "nao_compareceu"].includes(visita.status)).length,
    };
  }, [agora, dados]);

  const primeiroNome = nome.trim().split(/\s+/)[0] || "corretor";
  const data = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(agora));

  return <main className="inicio-app" aria-label="Meu Dia do aplicativo ApêCerto">
    <section className="inicio-app-boas-vindas">
      <span className="inicio-app-marca" aria-hidden="true"><i /><b>✓</b></span>
      <div><small>{data}</small><h1>Meu Dia, {primeiroNome}.</h1><p>Somente as obrigações do Funil 2.0.</p></div>
    </section>

    <section className="inicio-app-resumo" aria-label="Resumo de hoje">
      <header><div><span>HOJE</span><h2>Sua operação</h2></div><button type="button" onClick={() => onIr("/notificacoes")} aria-label="Abrir avisos">🔔 Avisos</button></header>
      {erro ? <p className="inicio-app-erro">Não foi possível atualizar os números agora. O CRM continua disponível.</p> : <div className="inicio-app-numeros">
        <article className="urgente"><b>{dados ? resumo.agora : "—"}</b><span>ações agora</span></article>
        <article><b>{dados ? resumo.hoje : "—"}</b><span>para hoje</span></article>
        <article><b>{dados ? resumo.novos : "—"}</b><span>leads novos</span></article>
        <article className="visita"><b>{dados ? resumo.visitas : "—"}</b><span>visitas hoje</span></article>
      </div>}
    </section>

    <section className="inicio-app-acoes" aria-label="Ações principais">
      <button type="button" className="principal" onClick={() => onIr("/crm?crm=funil-2")}>Abrir CRM <span>→</span></button>
      <button type="button" onClick={() => onIr("/agenda")}>Ver agenda <span>→</span></button>
    </section>

    <section className="inicio-app-explicacao">
      <b>Como trabalhar</b>
      <ol><li>Abra o CRM.</li><li>Siga a primeira ação.</li><li>Conclua e atualize o momento.</li></ol>
    </section>
  </main>;
}
