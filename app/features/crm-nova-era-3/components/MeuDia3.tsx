"use client";
/**
 * MEU DIA 3.0 — a primeira tela de quem atende.
 *
 * Três seções (Atender agora · Fazer hoje · Acompanhar depois), um cliente
 * aparece uma única vez, e cada linha traz nome, corretor, motivo, tempo,
 * próxima ação, SLA e UM botão principal.
 *
 * A prioridade e a ordem continuam vindo do banco (ncrm_fila_trabalho). Esta
 * tela não reordena nada: só agrupa e traduz.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  botaoPrincipal, montarSecoes, totalParaAtender,
  type ItemFila3,
} from "../lib/meuDia3";

type Json = Record<string, unknown>;

const FILTROS: ReadonlyArray<{ chave: string; rotulo: string }> = Object.freeze([
  { chave: "agora", rotulo: "Agora" },
  { chave: "vencidos", rotulo: "Vencidos" },
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "proximos", rotulo: "Próximos" },
  { chave: "respondeu", rotulo: "Respondeu" },
  { chave: "sem_resposta", rotulo: "Sem resposta" },
  { chave: "risco", rotulo: "Risco" },
  { chave: "quente", rotulo: "Quente" },
]);

function tomDaSecao(secao: string): string {
  if (secao === "atender_agora") return "tom-vermelho";
  if (secao === "fazer_hoje") return "tom-amarelo";
  return "tom-verde";
}

function prazoCurto(iso: string | null): string {
  if (!iso) return "sem prazo";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sem prazo";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function MeuDia3({
  accessToken,
  corretorFiltro,
  busca,
  onAbrir,
}: {
  accessToken: string;
  corretorFiltro?: number | null;
  busca: string;
  onAbrir: (negocioId: string) => void;
}) {
  const [filtro, setFiltro] = useState("agora");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [limite, setLimite] = useState(20);
  const [itens, setItens] = useState<ItemFila3[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams({ filtro });
    if (corretorFiltro != null) params.set("corretor", String(corretorFiltro));
    const r = await fetch(`/api/ncrm/fila?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json().catch(() => ({}))) as Json;
    setCarregando(false);
    if (!r.ok) {
      setErro((j.error as string) || "Não foi possível carregar a sua fila.");
      return;
    }
    setItens((j.itens as ItemFila3[]) ?? []);
  }, [accessToken, filtro, corretorFiltro]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return itens;
    return itens.filter((i) => (i.lead_nome ?? "").toLowerCase().includes(t));
  }, [itens, busca]);

  const visiveis = useMemo(() => filtrados.slice(0, limite), [filtrados, limite]);
  const restantes = Math.max(0, filtrados.length - visiveis.length);
  const secoes = useMemo(() => montarSecoes(visiveis), [visiveis]);
  const urgentes = useMemo(() => totalParaAtender(filtrados), [filtrados]);
  const vazio = !carregando && !erro && filtrados.length === 0;

  return (
    <div className="ncrm3-dia">
      <div className="ncrm3-dia-chamada">
        <h2>Meu Dia</h2>
        <span>
          {urgentes > 0
            ? `${urgentes} ${urgentes === 1 ? "cliente precisa" : "clientes precisam"} de você agora`
            : "Nada urgente agora"}
        </span>
        <button
          type="button"
          className="ncrm3-secundario"
          style={{ marginLeft: "auto" }}
          onClick={() => setFiltrosAbertos((v) => !v)}
        >
          {filtrosAbertos ? "Ocultar filtros" : "Filtros"}
        </button>
        <button type="button" className="ncrm3-secundario" onClick={() => void carregar()} disabled={carregando}>
          ↻ Atualizar
        </button>
      </div>

      {filtrosAbertos && (
        <div className="ncrm3-momentos">
          {FILTROS.map((f) => (
            <button key={f.chave} type="button" className={filtro === f.chave ? "on" : ""} onClick={() => { setFiltro(f.chave); setLimite(20); }}>
              {f.rotulo}
            </button>
          ))}
        </div>
      )}

      {erro && <div className="ncrm3-erro">{erro}</div>}
      {carregando && <div className="ncrm3-carregando">Carregando a sua fila…</div>}

      {vazio && (
        <div className="ncrm3-vazio">
          <strong>Nada pendente neste filtro.</strong>
          Confira &quot;Próximos&quot; para se antecipar ao dia de amanhã.
        </div>
      )}

      {!carregando && !erro && secoes.map((bloco) => (
        bloco.cartoes.length === 0 ? null : (
          <section key={bloco.secao} className="ncrm3-secao">
            <div className="ncrm3-secao-cab">
              <h3>{bloco.titulo}</h3>
              <b>{bloco.cartoes.length}</b>
            </div>
            <p className="ncrm3-secao-ajuda">{bloco.ajuda}</p>
            {bloco.cartoes.map((c) => {
              const botao = botaoPrincipal(c);
              return (
                <article key={c.negocioId} className={`ncrm3-item ${tomDaSecao(c.secao)}`}>
                  <div className="ncrm3-item-corpo">
                    <div className="ncrm3-item-linha">
                      <strong>{c.nome}</strong>
                      <span className="ncrm3-item-meta">{c.corretor}</span>
                      <span className="ncrm3-item-motivo">{c.motivo}</span>
                      <span className="ncrm3-item-meta">espera {c.tempo}</span>
                      {c.outrosAtendimentos > 0 && (
                        <span className="ncrm3-item-meta">
                          +{c.outrosAtendimentos} {c.outrosAtendimentos === 1 ? "atendimento" : "atendimentos"} deste cliente
                        </span>
                      )}
                    </div>
                    <div className="ncrm3-item-acao">
                      {c.proximaAcao} · {prazoCurto(c.proximaAcaoEm)}
                    </div>
                  </div>
                  <div className="ncrm3-item-botao">
                    <button type="button" className="ncrm3-principal" onClick={() => onAbrir(String(c.negocioId))}>
                      {botao.rotulo}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )
      ))}

      {!carregando && !erro && restantes > 0 && (
        <button type="button" className="ncrm3-secundario" onClick={() => setLimite((n) => n + 20)}>
          Carregar mais ({restantes} restantes)
        </button>
      )}
    </div>
  );
}
