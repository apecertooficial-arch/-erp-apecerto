"use client";
/**
 * FUNIL 3.0 — quatro ETAPAS, nem uma a mais.
 *
 * Novo · Tentando contato · Em atendimento · Pós-visita.
 * As dez situações operacionais são MOMENTOS dentro dessas etapas. Uma visita
 * agendada aparece também em Visitas, mas continua no atendimento; proposta é
 * a única passagem para a Esteira de Vendas.
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
      <nav className="ncrm3-momentos" aria-label="Etapas do funil">
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
          Visitas marcadas aparecem também na aba Visitas; propostas seguem para a Esteira de Vendas.
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
