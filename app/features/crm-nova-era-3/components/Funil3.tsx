"use client";
/**
 * FUNIL 3.0 — quatro momentos, nem um a mais.
 *
 * Novo · Tentando contato · Em atendimento · Em acompanhamento.
 * Visita e proposta NÃO são colunas: são saídas para o Pipe de Visitas e para
 * a Esteira de Vendas, e por isso o lead some daqui quando chega lá.
 *
 * No celular as abas de momento comandam qual coluna aparece (uma por vez),
 * sem rolagem horizontal.
 */
import { MOMENTOS, type Momento } from "../lib/momentos";
import { Card3, type AcaoMenu, type DadosCard } from "./Card3";

export function Funil3({
  porMomento,
  momentoAtivo,
  selecionadoId,
  acoes,
  onTrocarMomento,
  onAbrir,
  onChat,
  onAcao,
}: {
  porMomento: Record<Momento, DadosCard[]>;
  momentoAtivo: Momento;
  selecionadoId: string | null;
  acoes: AcaoMenu[];
  onTrocarMomento: (m: Momento) => void;
  onAbrir: (negocioId: string) => void;
  onChat: (negocioId: string) => void;
  onAcao: (negocioId: string, chave: string) => void;
}) {
  const total = MOMENTOS.reduce((n, m) => n + porMomento[m.chave].length, 0);

  return (
    <>
      <nav className="ncrm3-momentos" aria-label="Momentos do funil">
        {MOMENTOS.map((m) => (
          <button
            key={m.chave}
            type="button"
            className={m.chave === momentoAtivo ? "on" : ""}
            aria-pressed={m.chave === momentoAtivo}
            onClick={() => onTrocarMomento(m.chave)}
          >
            {m.titulo} <b>{porMomento[m.chave].length}</b>
          </button>
        ))}
      </nav>

      {total === 0 && (
        <div className="ncrm3-vazio">
          <strong>Nenhum cliente no funil agora.</strong>
          Quem tem visita marcada está em Visitas; quem tem proposta está na Esteira de Vendas.
        </div>
      )}

      <div className="ncrm3-quadro" data-momento={momentoAtivo}>
        {MOMENTOS.map((m) => (
          <section key={m.chave} className="ncrm3-coluna" data-momento={m.chave}>
            <header className="ncrm3-coluna-cab">
              <strong>{m.titulo} <b>{porMomento[m.chave].length}</b></strong>
              <small>{m.ajuda}</small>
            </header>
            {porMomento[m.chave].length === 0 && <p className="ncrm3-nota">Nenhum cliente aqui.</p>}
            {porMomento[m.chave].map((d) => (
              <Card3
                key={d.lead.id}
                dados={d}
                selecionado={selecionadoId === d.lead.id}
                rotuloPrincipal={m.chave === "novo" ? "Atender agora" : "Abrir atendimento"}
                acoes={acoes}
                onAbrir={() => onAbrir(d.lead.id)}
                onChat={() => onChat(d.lead.id)}
                onAcao={(chave) => onAcao(d.lead.id, chave)}
              />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
