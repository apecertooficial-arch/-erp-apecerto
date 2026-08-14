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

const POR_PAGINA = 20;

export function NotificationsWorkspace({ accessToken, onOpenLead }: {
  accessToken: string;
  onOpenLead: (negocioId: number) => void;
}) {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [faixa, setFaixa] = useState<Faixa>("agora");
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch("/api/notificacoes", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.notificacoes ?? j.itens ?? []) as Aviso[];
  }, [accessToken]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    carregar(ctrl.signal)
      .then((l) => { if (vivo) { setAvisos(l); setErro(false); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setAvisos([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const grupos = useMemo(() => agrupar(avisos ?? []), [avisos]);
  const base = grupos[faixa];
  const visiveis = useMemo(
    () => (soNaoLidas ? base.filter((a) => !a.vista_em) : base).slice(0, mostrar),
    [base, soNaoLidas, mostrar],
  );
  const pedemAcao = grupos.agora.length;

  return (
    <div className="av-wrap">
      <p className="av-sub">
        {avisos === null ? "Carregando…"
          : pedemAcao === 0 ? "Nada pedindo ação agora"
          : `${pedemAcao} ${pedemAcao === 1 ? "pede" : "pedem"} ação`}
      </p>

      <div className="av-chips" role="tablist" aria-label="Faixa dos avisos">
        {([["agora", "Agora"], ["hoje", "Hoje"], ["historico", "Histórico"]] as const).map(([c, r]) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={faixa === c}
            className={`av-chip${faixa === c ? " on" : ""}`}
            onClick={() => { setFaixa(c); setMostrar(POR_PAGINA); }}
          >
            {r}{c !== "historico" ? ` · ${grupos[c].length}` : ""}
          </button>
        ))}
      </div>

      <div className="av-filtros">
        <button
          type="button"
          aria-pressed={soNaoLidas}
          className={`av-filtro${soNaoLidas ? " on" : ""}`}
          onClick={() => setSoNaoLidas((v) => !v)}
        >
          Só não lidas
        </button>
      </div>

      {avisos === null && (
        <div className="av-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="av-erro" role="alert">
          <strong>Não foi possível carregar seus avisos.</strong>
          <button type="button" onClick={() => { setErro(false); setAvisos(null); setTentativa((n) => n + 1); }}>
            Tentar de novo
          </button>
        </div>
      )}

      {avisos !== null && !erro && visiveis.length === 0 && (
        <p className="av-vazio">
          {soNaoLidas ? "Nenhum aviso não lido nesta faixa." : "Nada por aqui."}
        </p>
      )}

      {visiveis.length > 0 && (
        <ul className="av-lista">
          {visiveis.map((a) => {
            const ic = ICONE_POR_TIPO[a.tipo] ?? ICONE_POR_TIPO.padrao;
            return (
              <li key={a.id} className="av-card">
                <span className={`av-icone ${ic.cor}`} aria-hidden="true">{ic.glifo}</span>
                <div className="av-corpo">
                  <div className="av-linha1">
                    <strong className="av-titulo">{a.titulo}</strong>
                    {/* Ponto laranja: não lido. Só isso — não é "urgente". */}
                    {!a.vista_em && <span className="av-ponto" aria-label="não lido" />}
                  </div>
                  {a.detalhe && <p className="av-detalhe">{a.detalhe}</p>}
                  <div className="av-rodape">
                    <button
                      type="button"
                      className="av-acao"
                      onClick={() => { if (a.negocio_id) onOpenLead(a.negocio_id); }}
                      disabled={!a.negocio_id}
                    >
                      {ROTULO_ACAO_AVISO[a.tipo] ?? "Abrir"} ›
                    </button>
                    <span className="av-tempo">{tempoRelativo(a.criada_em)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {base.length > visiveis.length && (
        <button type="button" className="av-mais" onClick={() => setMostrar((n) => n + POR_PAGINA)}>
          Carregar mais {Math.min(POR_PAGINA, base.length - visiveis.length)}
        </button>
      )}
    </div>
  );
}
