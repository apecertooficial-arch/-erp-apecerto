"use client";
/**
 * AVISOS — o que mudou e precisa da sua atenção, dentro do CRM.
 *
 * Reaproveita a MESMA fila do Meu Dia (ncrm_fila_trabalho, filtros "respondeu"
 * e "vencidos"). Não existe canal novo de notificação aqui: Web Push, service
 * worker e o módulo Notificações são outra frente e não são tocados.
 */
import { useCallback, useEffect, useState } from "react";
import { esperaHumana } from "../../crm-nova-era/lib/meuDia";
import type { ItemFila3 } from "../lib/meuDia3";

type Faixa = { chave: "respondeu" | "vencidos"; titulo: string; ajuda: string; tom: string };

const FAIXAS: readonly Faixa[] = Object.freeze([
  { chave: "respondeu", titulo: "Clientes que responderam", ajuda: "A conversa voltou e está esperando você.", tom: "tom-vermelho" },
  { chave: "vencidos", titulo: "Prazos estourados", ajuda: "Ações que passaram do combinado.", tom: "tom-amarelo" },
]);

export function Avisos3({ accessToken, onAbrir }: { accessToken: string; onAbrir: (negocioId: string) => void }) {
  const [dados, setDados] = useState<Record<string, ItemFila3[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const respostas = await Promise.all(
        FAIXAS.map((f) =>
          fetch(`/api/ncrm/fila?filtro=${f.chave}`, { headers: { Authorization: `Bearer ${accessToken}` } })
            .then((r) => r.json().then((j) => ({ ok: r.ok, chave: f.chave, itens: (j.itens as ItemFila3[]) ?? [] }))),
        ),
      );
      const mapa: Record<string, ItemFila3[]> = {};
      for (const r of respostas) mapa[r.chave] = r.ok ? r.itens : [];
      setDados(mapa);
    } catch {
      setErro("Não foi possível carregar os avisos.");
    } finally {
      setCarregando(false);
    }
  }, [accessToken]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void carregar(); }, [carregar]);

  const vazio = !carregando && !erro && FAIXAS.every((f) => (dados[f.chave] ?? []).length === 0);

  return (
    <div className="ncrm3-avisos">
      {erro && <div className="ncrm3-erro">{erro}</div>}
      {carregando && <div className="ncrm3-carregando">Conferindo os avisos…</div>}
      {vazio && (
        <div className="ncrm3-vazio">
          <strong>Nenhum aviso agora.</strong>
          Ninguém respondeu sem retorno e nenhum prazo estourou.
        </div>
      )}
      {!carregando && FAIXAS.map((f) => {
        const itens = dados[f.chave] ?? [];
        if (itens.length === 0) return null;
        return (
          <section key={f.chave} className="ncrm3-secao">
            <div className="ncrm3-secao-cab">
              <h3>{f.titulo}</h3>
              <b>{itens.length}</b>
            </div>
            <p className="ncrm3-secao-ajuda">{f.ajuda}</p>
            {itens.slice(0, 30).map((i) => (
              <article key={i.negocio_id} className={`ncrm3-item ${f.tom}`}>
                <div className="ncrm3-item-corpo">
                  <div className="ncrm3-item-linha">
                    <strong>{i.lead_nome ?? `Atendimento ${i.negocio_id}`}</strong>
                    <span className="ncrm3-item-meta">{i.corretor_nome ?? "Sem corretor"}</span>
                    <span className="ncrm3-item-motivo">{i.motivo}</span>
                    <span className="ncrm3-item-meta">espera {esperaHumana(i.espera_min)}</span>
                  </div>
                  <div className="ncrm3-item-acao">{i.proxima_acao_titulo ?? "Definir próxima ação"}</div>
                </div>
                <div className="ncrm3-item-botao">
                  <button type="button" className="ncrm3-principal" onClick={() => onAbrir(String(i.negocio_id))}>
                    Abrir atendimento
                  </button>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
