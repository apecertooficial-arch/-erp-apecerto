"use client";
/* AVISOS CANÔNICOS — mesma implementação no desktop e no celular.
 *
 * Componente novo, mesma fonte de dados de sempre: a RPC `ncrm_notificacoes`,
 * já escopada por carteira dentro do banco.
 *
 * O print manda, e está aqui:
 *   - "Avisos" e "N pedem ação" no cabeçalho;
 *   - chips Agora · n / Hoje · n / Histórico;
 *   - filtro "Só não lidas" e ordenação por prioridade;
 *   - card com ícone redondo por tipo, título, descrição, ação em laranja
 *     e o tempo à direita;
 *   - "Carregar mais".
 *
 * REGRA: tocar em "Abrir ficha" leva para o lead. Marcar como visto NÃO é
 * contato — some o ponto laranja e nada mais.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ICONE_POR_TIPO, agrupar, ROTULO_ACAO_AVISO, tempoRelativo,
  type Aviso, type Faixa,
} from "./telaAvisos.logica";
import { AppMobileOffline, AppMobileSessaoExpirada } from "../system/AppMobileSystem";

const POR_PAGINA = 20;

export function NotificationsWorkspace({ accessToken, onOpenLead }: {
  accessToken: string;
  onOpenLead: (negocioId: number) => void;
}) {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [erro, setErro] = useState(false);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [faixa, setFaixa] = useState<Faixa>("agora");
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch("/api/notificacoes", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (r.status === 401) throw new Error("sessao_expirada");
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.notificacoes ?? j.itens ?? []) as Aviso[];
  }, [accessToken]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    carregar(ctrl.signal)
      .then((l) => { if (vivo) { setAvisos(l); setErro(false); setSessaoExpirada(false); setAtualizadoEm(new Date()); } })
      .catch((e) => {
        if (!vivo || e?.name === "AbortError") return;
        if (e instanceof Error && e.message === "sessao_expirada") setSessaoExpirada(true);
        else setErro(true);
        setAvisos([]);
      });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const grupos = useMemo(() => agrupar(avisos ?? []), [avisos]);
  const base = grupos[faixa];
  const visiveis = useMemo(
    () => (soNaoLidas ? base.filter((a) => !a.vista_em) : base).slice(0, mostrar),
    [base, soNaoLidas, mostrar],
  );
  const pedemAcao = grupos.agora.length;

  const abrir = useCallback(async (aviso: Aviso) => {
    if (!aviso.negocio_id) return;
    if (!aviso.vista_em) {
      setAvisos((atuais) => (atuais ?? []).map((item) => item.id === aviso.id ? { ...item, vista_em: new Date().toISOString() } : item));
      void fetch("/api/notificacoes", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: aviso.id }),
      });
    }
    onOpenLead(aviso.negocio_id);
  }, [accessToken, onOpenLead]);

  if (sessaoExpirada) return <AppMobileSessaoExpirada />;

  return (
    <div className="av-wrap ape-avisos">
      <AppMobileOffline atualizadoEm={atualizadoEm} />
      <p className="av-sub ape-tela-sub">
        {avisos === null ? "Carregando…"
          : pedemAcao === 0 ? "Nada pedindo ação agora"
          : `${pedemAcao} ${pedemAcao === 1 ? "pede" : "pedem"} ação`}
      </p>

      <div className="av-chips ape-filtros" role="tablist" aria-label="Faixa dos avisos">
        {([["agora", "Agora"], ["hoje", "Hoje"], ["historico", "Histórico"]] as const).map(([c, r]) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={faixa === c}
            className={`av-chip ape-chip${faixa === c ? " on ativo" : ""}`}
            onClick={() => { setFaixa(c); setMostrar(POR_PAGINA); }}
          >
            {r}{c !== "historico" ? ` · ${grupos[c].length}` : ""}
          </button>
        ))}
      </div>

      <div className="av-filtros ape-aviso-filtros">
        <button
          type="button"
          aria-pressed={soNaoLidas}
          className={`av-filtro ape-aviso-filtro${soNaoLidas ? " on ativo" : ""}`}
          onClick={() => setSoNaoLidas((v) => !v)}
        >
          Só não lidas
        </button>
      </div>

      {avisos === null && (
        <div className="av-esqueleto ape-aviso-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="av-erro ape-estado ruim" role="alert">
          <strong>Não foi possível carregar seus avisos.</strong>
          <button type="button" onClick={() => { setErro(false); setAvisos(null); setTentativa((n) => n + 1); }}>
            Tentar de novo
          </button>
        </div>
      )}

      {avisos !== null && !erro && visiveis.length === 0 && (
        <div className="av-vazio ape-estado">
          <div className="ape-estado-icone" aria-hidden="true">✓</div>
          <strong>Você está em dia</strong>
          <p>{soNaoLidas ? "Nenhum aviso não lido nesta faixa." : "Nada por aqui."}</p>
        </div>
      )}

      {visiveis.length > 0 && (
        <ul className="av-lista ape-aviso-lista">
          {visiveis.map((a) => {
            const ic = ICONE_POR_TIPO[a.tipo] ?? ICONE_POR_TIPO.padrao;
            return (
              <li key={a.id} className="av-card ape-aviso-card">
                <span className={`av-icone ape-aviso-icone ${ic.cor}`} aria-hidden="true">{ic.glifo}</span>
                <div className="av-corpo ape-aviso-corpo">
                  <div className="av-linha1 ape-aviso-linha1">
                    <strong className="av-titulo ape-aviso-titulo">{a.titulo}</strong>
                    {/* Ponto laranja: não lido. Só isso — não é "urgente". */}
                    {!a.vista_em && <span className="av-ponto ape-aviso-ponto" aria-label="não lido" />}
                  </div>
                  {a.detalhe && <p className="av-detalhe ape-aviso-detalhe">{a.detalhe}</p>}
                  <div className="av-rodape ape-aviso-rodape">
                    <button
                      type="button"
                      className="av-acao ape-aviso-acao"
                      onClick={() => { void abrir(a); }}
                      disabled={!a.negocio_id}
                    >
                      {ROTULO_ACAO_AVISO[a.tipo] ?? "Abrir"} ›
                    </button>
                    <span className="av-tempo ape-aviso-tempo">{tempoRelativo(a.criada_em)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {base.length > visiveis.length && (
        <button type="button" className="av-mais ape-aviso-mais" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
          Carregar mais {Math.min(POR_PAGINA, base.length - visiveis.length)}
        </button>
      )}
    </div>
  );
}
