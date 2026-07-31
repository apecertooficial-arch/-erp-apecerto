"use client";
/**
 * LEADS 3.0 — a tabela do protótipo (prints-apecerto/crm-desktop/03-leads).
 *
 * Consulta, filtra e abre os atendimentos DO 3.0: a etapa mostrada é a do
 * funil novo (não os estágios antigos), o tempo sem interação fica vermelho
 * quando o prazo estourou, e "Abrir" abre a MESMA Ficha do funil.
 * Leitura pela MESMA rota do quadro (scope=all, paginado) — nada novo no banco.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { paraExibicao, type EstadoRow3 } from "../lib/adapter3";
import { tempoDesde, iniciais } from "./Card3";

type Etapa = "novo" | "tentando_contato" | "em_atendimento" | "em_acompanhamento";

const ETAPA_ROTULO: Record<Etapa, string> = {
  novo: "Lead novo",
  tentando_contato: "Tentando atendimento",
  em_atendimento: "Em atendimento",
  em_acompanhamento: "Em acompanhamento",
};

const PASSO = 20;

export function Leads3({
  accessToken,
  busca,
  onAbrir,
}: {
  accessToken: string;
  busca: string;
  onAbrir: (negocioId: string) => void;
}) {
  const [itens, setItens] = useState<EstadoRow3[]>([]);
  const [total, setTotal] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [etapaFiltro, setEtapaFiltro] = useState<Etapa | null>(null);
  const [soAtrasados, setSoAtrasados] = useState(false);
  /* Presença honesta: "online" = abriu o ERP nos últimos 15 minutos (registro
     de acesso que já existe). Sem dado, a coluna simplesmente não afirma nada. */
  const [online, setOnline] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let vivo = true;
    void fetch(`/api/ncrm/equipe-online`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { equipe?: Array<{ nome: string; online: boolean }> } | null) => {
        if (!vivo || !j?.equipe) return;
        const mapa: Record<string, boolean> = {};
        for (const c of j.equipe) mapa[c.nome] = c.online;
        setOnline(mapa);
      })
      .catch(() => { /* presença é informativa; a tabela funciona sem ela */ });
    return () => { vivo = false; };
  }, [accessToken]);

  const carregar = useCallback(async (offset: number) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/ncrm?scope=board&limit=${PASSO}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) { setErro((j.error as string) || "Não foi possível carregar os leads."); return; }
      const novos = (j.itens as EstadoRow3[]) ?? [];
      setItens((atuais) => (offset === 0 ? novos : [...atuais, ...novos]));
      setTotal((j.total as number) ?? novos.length);
      setTemMais(Boolean(j.temMais));
    } catch {
      setErro("Não foi possível carregar os leads.");
    } finally {
      setCarregando(false);
    }
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(0); }, [carregar]);

  /* "Agora" estável por montagem: pureza do render (o minuto exato não importa
     para pintar atraso; o refresh natural da tela atualiza). */
  const [agora] = useState(() => Date.now());
  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens
      .map(paraExibicao)
      .filter((e) => !etapaFiltro || e.lead.coluna === etapaFiltro)
      .filter((e) => !soAtrasados || (e.lead.proximaAcaoEm != null && Date.parse(e.lead.proximaAcaoEm) < agora))
      .filter((e) => !termo || e.lead.nome.toLowerCase().includes(termo) || (e.origem ?? "").toLowerCase().includes(termo));
  }, [itens, busca, etapaFiltro, soAtrasados, agora]);

  const atrasados = useMemo(
    () => itens.map(paraExibicao).filter((e) => e.lead.proximaAcaoEm != null && Date.parse(e.lead.proximaAcaoEm) < agora).length,
    [itens, agora],
  );

  return (
    <div className="ncrm3-leads">
      <div className="ncrm3-leads-topo">
        <div className="ncrm3-leads-filtros" role="group" aria-label="Filtrar por momento">
          <button type="button" className={etapaFiltro === null ? "on" : ""} onClick={() => setEtapaFiltro(null)}>Todos</button>
          {(Object.keys(ETAPA_ROTULO) as Etapa[]).map((e) => (
            <button key={e} type="button" className={etapaFiltro === e ? "on" : ""} onClick={() => setEtapaFiltro(etapaFiltro === e ? null : e)}>
              {ETAPA_ROTULO[e]}
            </button>
          ))}
          <button type="button" className={`ncrm3-leads-atrasados ${soAtrasados ? "on" : ""}`} onClick={() => setSoAtrasados((v) => !v)}>
            Leads atrasados · {atrasados}
          </button>
        </div>
        <span className="ncrm3-leads-total">{total} negócios</span>
      </div>

      {erro && <div className="ncrm3-erro">{erro}</div>}
      {carregando && itens.length === 0 && <div className="ncrm3-carregando">Carregando os leads…</div>}

      {itens.length > 0 && (
        <div className="ncrm3-tabela" role="table" aria-label="Leads da operação">
          <div className="ncrm3-tr cab" role="row">
            <span role="columnheader">Lead</span>
            <span role="columnheader">Sem interação</span>
            <span role="columnheader">Etapa</span>
            <span role="columnheader">Corretor</span>
            <span role="columnheader">Origem</span>
            <span role="columnheader">Valor</span>
            <span role="columnheader">Atualização</span>
            <span role="columnheader" aria-label="Ações" />
          </div>
          {linhas.map((e) => {
            const atrasado = e.lead.proximaAcaoEm != null && Date.parse(e.lead.proximaAcaoEm) < agora;
            return (
              <div key={e.lead.id} className={`ncrm3-tr etapa-${e.lead.coluna}`} role="row">
                <span className="ncrm3-td-lead" role="cell">
                  <span className="lead-avatar">
                    {e.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.fotoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      iniciais(e.lead.nome)
                    )}
                  </span>
                  <span className="ncrm3-td-nome">
                    <b>{e.lead.nome}</b>
                    <small>#{e.lead.id}{e.interesse ? ` · ${e.interesse}` : ""}</small>
                  </span>
                </span>
                <span role="cell" className={atrasado ? "ncrm3-td-tempo atrasado" : "ncrm3-td-tempo"}>
                  {tempoDesde(e.lead.ultimaInteracaoEm).replace("há ", "")}
                  <small>{e.lead.respostaPendenteCorretor ? "aguardando resposta" : "sem interação"}</small>
                </span>
                <span role="cell"><i className={`ncrm3-chip-etapa e-${e.lead.coluna}`}>{ETAPA_ROTULO[e.lead.coluna as Etapa] ?? e.lead.coluna}</i></span>
                <span role="cell" className={`ncrm3-td-corretor ncrm3-online ${online[e.lead.corretorNome] ? "" : "off"}`}>
                  {e.lead.corretorNome}
                  {e.lead.corretorNome in online && <small>{online[e.lead.corretorNome] ? "online" : "offline"}</small>}
                </span>
                <span role="cell" className="ncrm3-td-origem">{e.origem ?? "—"}</span>
                <span role="cell" className="ncrm3-td-origem">—</span>
                <span role="cell" className="ncrm3-td-data">{e.lead.ultimaInteracaoEm ? new Date(e.lead.ultimaInteracaoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</span>
                <span role="cell" style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="ncrm3-abrir" onClick={() => onAbrir(e.lead.id)}>Abrir</button>
                  <button type="button" className="ncrm3-secundario" style={{ minHeight: 32, padding: "0 12px", fontSize: 12 }} onClick={() => onAbrir(e.lead.id)} title="A conversa aparece na ficha — somente leitura">Chat</button>
                </span>
              </div>
            );
          })}
          <div className="ncrm3-tabela-rodape">
            <span>Mostrando {linhas.length} de {total} · carregue mais {PASSO} por vez</span>
            {temMais && (
              <button type="button" className="ncrm3-secundario" disabled={carregando} onClick={() => void carregar(itens.length)}>
                {carregando ? "Carregando…" : "Carregar mais"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
