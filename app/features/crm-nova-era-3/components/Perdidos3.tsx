"use client";
/**
 * PERDIDOS — quem saiu do funil por descarte, e POR QUÊ.
 *
 * Antes, o descartado simplesmente sumia do quadro e o motivo só existia
 * dentro da ficha. Perda invisível não ensina nada: esta faixa mostra os
 * últimos descartes com o motivo na cara, e um clique reabre a ficha
 * (de onde dá para reativar).
 *
 * Leitura da MESMA rota do quadro (scope=saidas) — nenhuma tabela nova.
 */
import { useEffect, useState } from "react";

type Saida = {
  negocio_id: number;
  saida: string | null;
  saida_em: string | null;
  descarte_motivo: string | null;
  negocios: { leads: { nome: string | null } | null } | null;
};

const MOTIVO_ROTULO: Record<string, string> = {
  sem_interesse: "Sem interesse",
  sem_perfil_financeiro: "Sem perfil financeiro",
  numero_invalido: "Número inválido",
  ja_comprou_concorrente: "Comprou com concorrente",
  duplicado: "Duplicado",
  outro: "Outro",
  sem_resposta: "Sem resposta",
  fora_da_regiao: "Fora da região",
  desistiu: "Desistiu",
  nao_quer_contato: "Não quer contato",
  produto_incompativel: "Produto incompatível",
};

export function Perdidos3({ accessToken, onAbrir }: { accessToken: string; onAbrir: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Saida[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || itens) return;
    let vivo = true;
    void fetch(`/api/ncrm?scope=saidas&limit=60`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (!ok) { setErro("Não foi possível carregar os perdidos."); return; }
        const todos = (j.itens as Saida[]) ?? [];
        setItens(todos.filter((s) => s.saida === "descartado"));
      })
      .catch(() => { if (vivo) setErro("Não foi possível carregar os perdidos."); });
    return () => { vivo = false; };
  }, [aberto, itens, accessToken]);

  return (
    <section style={{ marginTop: 18 }}>
      <button type="button" className="ncrm3-secundario" onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar perdidos" : "Ver perdidos e motivos"}
      </button>
      {aberto && (
        <div className="ncrm3-linhas" style={{ marginTop: 10, maxWidth: 720 }}>
          {erro && <p className="ncrm3-nota">{erro}</p>}
          {!erro && !itens && <p className="ncrm3-nota">Carregando…</p>}
          {itens && itens.length === 0 && <p className="ncrm3-nota">Nenhum cliente descartado.</p>}
          {itens?.map((s) => (
            <button
              key={s.negocio_id}
              type="button"
              className="ncrm3-item tom-vermelho"
              style={{ cursor: "pointer", textAlign: "left", font: "inherit" }}
              onClick={() => onAbrir(String(s.negocio_id))}
            >
              <div className="ncrm3-item-corpo">
                <div className="ncrm3-item-linha">
                  <strong>{s.negocios?.leads?.nome ?? `Atendimento ${s.negocio_id}`}</strong>
                  <span className="ncrm3-item-motivo">
                    {MOTIVO_ROTULO[s.descarte_motivo ?? ""] ?? s.descarte_motivo ?? "sem motivo registrado"}
                  </span>
                  {s.saida_em && (
                    <span className="ncrm3-item-meta">
                      {new Date(s.saida_em).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                <div className="ncrm3-item-acao">Abrir a ficha para rever ou reativar</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
