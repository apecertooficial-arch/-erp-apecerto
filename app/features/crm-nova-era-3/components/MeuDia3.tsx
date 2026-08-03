"use client";
/**
 * MEU DIA 3.0 — a primeira tela de quem atende.
 *
 * Abre com o tamanho do dia (quantos aguardam resposta, quantos leads novos,
 * quantos retornos) e com o próximo cliente NOMEADO — o corretor não precisa
 * ler a lista inteira para saber por onde começar.
 *
 * Depois, três seções (Atender agora · Fazer hoje · Acompanhar depois), um
 * cliente aparece uma única vez, e cada linha traz nome, corretor, motivo,
 * tempo, próxima ação e UM botão principal.
 *
 * A prioridade e a ordem continuam vindo do banco (ncrm_fila_trabalho). Esta
 * tela não reordena nada: só agrupa e traduz.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  botaoPrincipal, montarSecoes, painelDeAbertura, saudacao, totalParaAtender,
  type ItemFila3,
} from "../lib/meuDia3";
import { iniciais } from "./Card3";
import type { AcaoMenu } from "./Card3";

/** Ícone de relógio dos itens da fila (fase 1 do design). */
function Relogio() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

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

function chipDoMotivo(motivo: string): string {
  const m = (motivo || "").toLowerCase();
  if (m.includes("respondeu")) return "ncrm3-chip-motivo m-laranja";
  if (m.includes("novo")) return "ncrm3-chip-motivo m-roxo";
  if (m.includes("estourado") || m.includes("venceu") || m.includes("atras")) return "ncrm3-chip-motivo m-vermelho";
  return "ncrm3-chip-motivo";
}

/* Avatar da fila: tint pelo TIPO do chamado (laranja respondeu, roxo lead novo,
   vermelho estourado) — igual ao print. */
function avatarDoMotivo(motivo: string): string {
  const m = (motivo || "").toLowerCase();
  if (m.includes("novo")) return "av-roxo";
  if (m.includes("estourado") || m.includes("venceu") || m.includes("atras")) return "av-vermelho";
  return "av-laranja";
}

function tomDaSecao(secao: string): string {
  if (secao === "atender_agora") return "tom-vermelho";
  if (secao === "fazer_hoje") return "tom-amarelo";
  return "tom-verde";
}

/* Protótipo: a barrinha conta o TIPO do chamado, não a seção.
   Laranja = cliente respondeu · roxo = lead novo · vermelho = prazo estourado. */
function tomDoMotivo(motivo: string, secao: string): string {
  const m = (motivo || "").toLowerCase();
  if (m.includes("respondeu")) return "tom-laranja";
  if (m.includes("novo")) return "tom-roxo";
  if (m.includes("estourado") || m.includes("venceu") || m.includes("atras")) return "tom-vermelho";
  return tomDaSecao(secao);
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
  nome,
  onAbrir,
  onIrParaVisitas,
  onIrParaAba,
  acoes,
  onAcao,
}: {
  accessToken: string;
  corretorFiltro?: number | null;
  busca: string;
  /** Nome de quem está atendendo, para a saudação. */
  nome?: string;
  onAbrir: (negocioId: string) => void;
  onIrParaVisitas?: () => void;
  /** Cards de resumo clicáveis (protótipo 01): cada número leva à aba correspondente. */
  onIrParaAba?: (aba: string) => void;
  /** Menu "..." de cada item — as mesmas ações do card do Funil. */
  acoes?: AcaoMenu[];
  onAcao?: (negocioId: string, chave: string) => void;
}) {
  const [filtro, setFiltro] = useState("agora");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [limite, setLimite] = useState(20);
  const [itens, setItens] = useState<ItemFila3[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<number | null>(null);
  /* Visitas de HOJE para o quarto card (o print mostra o número). Leitura da
     rota enxuta que já existe; se falhar, o card vira só o atalho. */
  const [visitasHoje, setVisitasHoje] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    void fetch(`/api/ncrm/visitas`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { visitas?: Array<{ data: string | null }> } | null) => {
        if (!vivo || !j?.visitas) return;
        const hoje = new Date().toLocaleDateString("sv-SE");
        setVisitasHoje(j.visitas.filter((v) => v.data === hoje).length);
      })
      .catch(() => { /* o número é conveniência; o atalho continua */ });
    return () => { vivo = false; };
  }, [accessToken]);

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
  const painel = useMemo(() => painelDeAbertura(filtrados), [filtrados]);
  const vazio = !carregando && !erro && filtrados.length === 0;

  return (
    <div className="ncrm3-dia">
      <div className="ncrm3-dia-chamada">
        <h2>{saudacao(nome ?? "")}</h2>
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

      {/* O tamanho do dia, em numeros que o corretor confere sozinho. */}
      {!carregando && !erro && filtrados.length > 0 && (
        <section className="ncrm3-abertura" aria-label="Resumo do seu dia">
          <div className="ncrm3-abertura-numeros">
            <article role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => onIrParaAba?.("avisos")}><b>{painel.aguardandoResposta}</b><span>aguardando sua resposta</span></article>
            <article role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => onIrParaAba?.("funil")}><b>{painel.leadsNovos}</b><span>{painel.leadsNovos === 1 ? "lead novo" : "leads novos"}</span></article>
            <article role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => onIrParaAba?.("agenda")}><b>{painel.retornosHoje}</b><span>{painel.retornosHoje === 1 ? "retorno para hoje" : "retornos para hoje"}</span></article>
            {onIrParaVisitas && (
              <article className="link" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={onIrParaVisitas}>
                {visitasHoje != null ? (
                  <>
                    <b>{visitasHoje}</b>
                    <span>{visitasHoje === 1 ? "visita do dia" : "visitas do dia"} · ver na aba Visitas</span>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={onIrParaVisitas}>Ver visitas do dia</button>
                    <span>na aba Visitas</span>
                  </>
                )}
              </article>
            )}
          </div>

          {painel.proximo && (
            <div className="ncrm3-abertura-proximo">
              <div>
                <span className="ncrm3-abertura-rotulo">Próximo atendimento</span>
                <strong>{painel.proximo.nome}</strong>
                <em>{painel.proximo.motivo} · espera {painel.proximo.tempo} · {painel.proximo.proximaAcao.toLowerCase()}</em>
              </div>
              <button type="button" className="ncrm3-principal" onClick={() => onAbrir(String(painel.proximo!.negocioId))}>
                Atender agora
              </button>
            </div>
          )}
        </section>
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
                <article key={c.negocioId} className={`ncrm3-item ${tomDoMotivo(c.motivo, c.secao)}`}>
                  <span className={`lead-avatar ncrm3-av ${avatarDoMotivo(c.motivo)}`}>{iniciais(c.nome)}</span>
                  <div className="ncrm3-item-corpo">
                    <div className="ncrm3-item-linha">
                      <strong>{c.nome}</strong>
                      <span className="ncrm3-item-meta">{c.corretor}</span>
                      <span className={chipDoMotivo(c.motivo)}>{c.motivo}</span>
                      <span className="ncrm3-item-meta ncrm3-item-tempo"><Relogio /> {c.tempo}</span>
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
                  {acoes && onAcao && (
                    <div className="ncrm3-mais" onClick={(e) => e.stopPropagation()}>
                      <button type="button" aria-haspopup="menu" aria-expanded={menuAberto === c.negocioId} aria-label="Mais ações"
                        onClick={() => setMenuAberto((v) => (v === c.negocioId ? null : c.negocioId))}>
                        ⋯
                      </button>
                      {menuAberto === c.negocioId && (
                        <div className="ncrm3-menu" role="menu">
                          {acoes.map((a) => (
                            <button key={a.chave} type="button" role="menuitem"
                              onClick={() => { setMenuAberto(null); onAcao(String(c.negocioId), a.chave); }}>
                              {a.rotulo}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
