"use client";

import { useCallback, useState } from "react";

/* Explicador de automações.

   Automação desenhada é clara para quem desenhou. Para quem chega depois — ou
   para o mesmo dono três meses adiante — é um monte de caixinha ligada por
   linha. Este botão traduz o desenho em história.

   A tradução NAO mora aqui: mora na função automacao_explicar, no banco. Aqui
   é só a encenação — revelar um passo por vez para o olho acompanhar. Bloco
   novo aprende a se explicar num lugar só, e esta tela nem fica sabendo.

   Sem useEffect de propósito: não há nada para carregar antes de o usuário
   abrir o painel, então a busca acontece no clique. Menos código e sem render
   em cascata. */

type Automacao = { id: number; nome: string; ativa: boolean; status: string | null; grupo: string | null };
type Passo = { ordem: number; bloco: string; ramo: string; icone: string; titulo: string; detalhe: string | null };
type Historia = { nome: string; total: number; passos: Passo[] };

const DESENHO: Record<string, string> = {
  raio: "⚡", roleta: "🎯", zap: "💬", relogio: "⏱", pergunta: "❓",
  cerebro: "🧠", seta: "➡", sino: "🔔", plug: "🔌", ponto: "●",
};

export function ExplicadorAutomacoes({ accessToken }: { accessToken: string }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Automacao[] | null>(null);
  const [historia, setHistoria] = useState<Historia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const buscar = useCallback(async (id?: number) => {
    try {
      const resposta = await fetch(`/api/automacoes-explicar${id ? `?id=${id}` : ""}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo?.error || "Não consegui carregar.");
      if (id) setHistoria(corpo as Historia); else setLista(corpo.automacoes ?? []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, [accessToken]);

  function abrir() {
    setAberto(true);
    if (lista === null) {
      setCarregando(true);
      void buscar();
    }
  }

  function abrirHistoria(id: number) {
    setCarregando(true);
    setHistoria(null);
    setErro(null);
    void buscar(id);
  }

  function fechar() {
    setAberto(false);
    setHistoria(null);
    setErro(null);
  }

  if (!aberto) {
    return (
      <button type="button" className="exp-botao" onClick={abrir}>
        <span aria-hidden="true">💡</span> Como funciona?
      </button>
    );
  }

  return (
    <>
      <button type="button" className="exp-fundo" aria-label="Fechar" onClick={fechar} />
      <aside className="exp-painel" role="dialog" aria-label="Explicador de automações">
        <header className="exp-topo">
          <div>
            <h2>{historia ? historia.nome : "Como funciona?"}</h2>
            <p>
              {historia
                ? `${historia.total} passo(s), na ordem em que acontecem.`
                : "Escolha uma automação e eu conto o que ela faz, passo a passo."}
            </p>
          </div>
          <button type="button" className="exp-fechar" onClick={fechar} aria-label="Fechar">×</button>
        </header>

        <div className="exp-corpo">
          {erro ? <div className="exp-aviso">{erro}</div> : null}

          {historia ? (
            <>
              <button type="button" className="exp-voltar" onClick={() => { setHistoria(null); setErro(null); }}>
                ← ver outra automação
              </button>
              <ol className="exp-passos">
                {historia.passos.map((p, i) => (
                  <li
                    key={p.ordem}
                    className={`exp-passo exp-passo-${p.icone}`}
                    style={{ animationDelay: `${i * 260}ms` }}
                  >
                    <span className="exp-bolha" aria-hidden="true">{DESENHO[p.icone] ?? "●"}</span>
                    <div className="exp-texto">
                      {p.ramo && p.ramo !== "principal" ? <span className="exp-ramo">{p.ramo}</span> : null}
                      <strong>{p.titulo}</strong>
                      {p.detalhe ? <p>{p.detalhe}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : carregando ? (
            <p className="exp-vazio">Lendo o desenho…</p>
          ) : lista === null || lista.length === 0 ? (
            <p className="exp-vazio">Nenhuma automação criada ainda.</p>
          ) : (
            <ul className="exp-lista">
              {lista.map((a) => (
                <li key={a.id}>
                  <button type="button" className="exp-item" onClick={() => abrirHistoria(a.id)}>
                    <strong>{a.nome}</strong>
                    <span className={`exp-selo ${a.ativa && a.status === "publicado" ? "exp-selo-on" : "exp-selo-off"}`}>
                      {a.ativa && a.status === "publicado" ? "rodando" : "desligada"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
