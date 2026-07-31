"use client";
/* AGENDA NO CELULAR — desenho do print 05.
 *
 * Fonte: /api/ncrm/agenda (RPC ncrm_agenda_corretor), já escopada por carteira
 * dentro do banco.
 *
 * O print manda, e está aqui:
 *   - cartão laranja do PRÓXIMO COMPROMISSO com hora, tipo, cliente, endereço
 *     e dois botões: "Abrir no mapa" e "Ver ficha";
 *   - chips Dia / Semana;
 *   - "SEXTA, 31 DE JULHO · 4 COMPROMISSOS";
 *   - linha do tempo: coluna de horário à esquerda, ponto na linha, cartão à
 *     direita com o tipo em laranja, o cliente e o endereço.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  diaPorExtenso, hojeISO, jaPassou, proximo, quandoComeca, resumoDoDia, somarDias,
  type Compromisso,
} from "./telaAgenda.logica";

export function TelaAgendaMobile({ accessToken, onAbrirLead }: {
  accessToken: string;
  onAbrirLead: (negocioId: number) => void;
}) {
  const [dia, setDia] = useState<string>(() => hojeISO());
  const [itens, setItens] = useState<Compromisso[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(async (sinal: AbortSignal) => {
    const r = await fetch(`/api/ncrm/agenda?data=${dia}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal,
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    return (j.itens as Compromisso[]) ?? [];
  }, [accessToken, dia]);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    setItens(null);
    carregar(ctrl.signal)
      .then((l) => { if (vivo) { setItens(l); setErro(false); } })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setItens([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [carregar, tentativa]);

  const lista = itens ?? [];
  const prox = useMemo(() => proximo(lista), [lista]);

  return (
    <div className="ag-wrap">
      {/* ---------------- Próximo compromisso ---------------- */}
      {prox && (
        <section className="ag-proximo" aria-label="Próximo compromisso">
          <p className="ag-eyebrow">
            Próximo compromisso <span className="ag-quando">{quandoComeca(prox.faltam_min)}</span>
          </p>
          <p className="ag-prox-hora">{prox.hora} · {prox.tipo}</p>
          <p className="ag-prox-cliente">{prox.cliente}</p>
          {prox.local && <p className="ag-prox-local">📍 {prox.local}</p>}
          <div className="ag-prox-acoes">
            {/* Abre o app de mapas do aparelho. Sem chave de API, sem mapa
                embutido: o corretor já tem o navegador dele configurado e
                confia nele mais do que confiaria no nosso. */}
            {prox.local ? (
              <a
                className="ag-btn-cheio"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prox.local)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no mapa
              </a>
            ) : (
              <span className="ag-sem-local">Sem endereço cadastrado</span>
            )}
            <button
              type="button"
              className="ag-btn-vazado"
              onClick={() => { if (prox.negocio_id) onAbrirLead(prox.negocio_id); }}
              disabled={!prox.negocio_id}
            >
              Ver ficha
            </button>
          </div>
        </section>
      )}

      {/* ---------------- Navegação do dia ---------------- */}
      <div className="ag-barra">
        <div className="ag-chips">
          <button type="button" className="ag-chip on">Dia</button>
          {/* Semana ainda não existe; leva para a agenda completa em vez de
              mostrar uma versão pela metade. */}
          <button type="button" className="ag-chip" onClick={() => setDia(hojeISO())}>Hoje</button>
        </div>
        <div className="ag-navega">
          <button type="button" aria-label="Dia anterior" onClick={() => setDia((d) => somarDias(d, -1))}>‹</button>
          <button type="button" aria-label="Próximo dia" onClick={() => setDia((d) => somarDias(d, 1))}>›</button>
        </div>
      </div>

      <p className="ag-dia">
        {diaPorExtenso(dia)} · {itens === null ? "carregando…" : resumoDoDia(lista.length)}
      </p>

      {itens === null && (
        <div className="ag-esqueleto" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} />)}</div>
      )}

      {erro && (
        <div className="ag-erro" role="alert">
          <strong>Não foi possível carregar sua agenda.</strong>
          <button type="button" onClick={() => { setErro(false); setTentativa((n) => n + 1); }}>
            Tentar de novo
          </button>
        </div>
      )}

      {itens !== null && !erro && lista.length === 0 && (
        <p className="ag-vazio">Nada marcado para este dia.</p>
      )}

      {/* ---------------- Linha do tempo ----------------
          A coluna de horário e o ponto ficam FORA do cartão: é o que faz a
          lista virar linha do tempo em vez de pilha de cartões. */}
      {lista.length > 0 && (
        <ol className="ag-linha">
          {[...lista].sort((a, b) => a.hora.localeCompare(b.hora)).map((c) => (
            <li key={c.id} className={`ag-item${jaPassou(c) ? " passou" : ""}`}>
              <span className="ag-hora">{c.hora}</span>
              <span className="ag-ponto" aria-hidden="true" />
              <button
                type="button"
                className="ag-cartao"
                onClick={() => { if (c.negocio_id) onAbrirLead(c.negocio_id); }}
              >
                <span className="ag-tipo">{c.tipo}</span>
                <span className="ag-cliente">{c.cliente}</span>
                {(c.local || c.produto) && (
                  <span className="ag-local">{c.local ?? c.produto}</span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
