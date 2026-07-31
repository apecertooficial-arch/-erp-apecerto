"use client";

/* INICIO DO CELULAR — tela operacional, nao painel gerencial.
 *
 * O Inicio do desktop responde "como vai a imobiliaria". No celular a pergunta
 * e outra: "o que eu preciso fazer agora?". Por isso esta tela nao e o
 * dashboard espremido -- e uma lista de trabalho.
 *
 * DE ONDE VEM O DADO (nada aqui e inventado):
 *  - /api/ncrm/fila  8 KB, prioridade calculada no banco (ncrm_fila_trabalho),
 *                    ja escopada por carteira e papel. Da os tres grupos de
 *                    lead e os compromissos de hoje.
 *  - /api/projects   222 KB, so as tarefas vencidas. Vem em SEGUNDA ONDA,
 *                    depois da primeira pintura, porque nao e o que a pessoa
 *                    abre o app para ver.
 *
 * O que NAO buscamos: /api/crm, que devolve 1,8 MB. O Inicio antigo baixava
 * isso a cada abertura. No 4G do corretor isso e a diferenca entre abrir e
 * desistir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { montarGrupos, type ItemFila, type Tarefa } from "./seuDia.logica";

const ATALHOS = [
  { rotulo: "Meu Dia", destino: "/crm?vista=meu-dia" },
  { rotulo: "Agenda", destino: "/agenda" },
  { rotulo: "Produtos", destino: "/produtos" },
  { rotulo: "Notificações", destino: "/notificacoes" },
];

export function SeuDia({ accessToken, onAbrirLead, onIr }: {
  accessToken: string;
  onAbrirLead: (negocioId: string) => void;
  onIr: (destino: string) => void;
}) {
  const [fila, setFila] = useState<ItemFila[] | null>(null);
  const [hoje, setHoje] = useState<ItemFila[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const buscar = useCallback(async (caminho: string, sinal: AbortSignal) => {
    const r = await fetch(caminho, { headers: { Authorization: `Bearer ${accessToken}` }, signal: sinal });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }, [accessToken]);

  // Primeira onda: so a fila. 8 KB, pinta rapido.
  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    Promise.all([buscar("/api/ncrm/fila?filtro=agora", ctrl.signal), buscar("/api/ncrm/fila?filtro=hoje", ctrl.signal)])
      .then(([a, b]) => { if (!vivo) return; setFila((a.itens as ItemFila[]) ?? []); setHoje((b.itens as ItemFila[]) ?? []); setErro(false); })
      .catch((e) => { if (vivo && e?.name !== "AbortError") { setErro(true); setFila([]); } });
    return () => { vivo = false; ctrl.abort(); };
  }, [buscar, tentativa]);

  // Segunda onda: tarefas (222 KB). Nao segura a primeira pintura.
  useEffect(() => {
    if (fila === null) return;
    const ctrl = new AbortController();
    let vivo = true;
    buscar("/api/projects", ctrl.signal)
      .then((j) => { if (vivo) setTarefas((j.tarefas as Tarefa[]) ?? []); })
      .catch(() => { /* tarefa e complemento: falhar aqui nao derruba a tela */ });
    return () => { vivo = false; ctrl.abort(); };
  }, [buscar, fila, tentativa]);

  const grupos = useMemo(() => montarGrupos(fila ?? [], hoje, tarefas), [fila, hoje, tarefas]);
  const nada = fila !== null && grupos.every((g) => g.total === 0);

  return (
    <div className="sd-wrap">
      <nav className="sd-atalhos" aria-label="Atalhos">
        {ATALHOS.map((a) => (
          <button key={a.rotulo} type="button" onClick={() => onIr(a.destino)}>{a.rotulo}</button>
        ))}
      </nav>

      <h2 className="sd-titulo">Seu dia</h2>

      {fila === null && (
        <div className="sd-esqueleto" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="sd-esq-bloco"><span /><span /><span /></div>)}
        </div>
      )}

      {erro && (
        <div className="sd-erro" role="alert">
          <strong>Não foi possível carregar seu dia agora.</strong>
          <button type="button" onClick={() => { setErro(false); setFila(null); setTentativa((n) => n + 1); }}>Tentar novamente</button>
        </div>
      )}

      {nada && !erro && (
        <p className="sd-vazio">Nada pendente agora. Quando um cliente responder ou uma ação vencer, aparece aqui.</p>
      )}

      {fila !== null && grupos.filter((g) => g.total > 0).map((g) => (
        <section key={g.chave} className="sd-grupo" aria-labelledby={`sd-${g.chave}`}>
          <header>
            <h3 id={`sd-${g.chave}`}>{g.titulo}</h3>
            <span className="sd-contador">{g.total}</span>
          </header>
          <ul>
            {g.itens.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => (g.chave === "tarefas" ? onIr("/tarefas") : onAbrirLead(i.id))}
                >
                  <span className="sd-nome">{i.nome}</span>
                  <span className="sd-motivo">{i.motivo}</span>
                  <span className="sd-tempo">{i.tempo}</span>
                </button>
              </li>
            ))}
          </ul>
          {g.total > g.itens.length && (
            <button type="button" className="sd-ver-todos" onClick={() => onIr(g.verTodos)}>
              Ver todos ({g.total})
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
