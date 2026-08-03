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
import { ACOES_OFICIAIS, MOMENTOS_PADRAO } from "../lib/conduta3";
import { Card3, type AcaoMenu, type DadosCard } from "./Card3";

function prazoPadrao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 1440) return `${Math.round(minutos / 60)}h`;
  return `${Math.round(minutos / 1440)} ${minutos === 1440 ? "dia" : "dias"}`;
}

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
  const etapaAtiva = MOMENTOS.find((m) => m.chave === momentoAtivo) ?? MOMENTOS[0];
  const condutasDaEtapa = MOMENTOS_PADRAO.filter((m) => m.etapa === momentoAtivo);

  return (
    <>
      <section className="ncrm3-mapa" aria-label="Como o CRM organiza os clientes">
        <header>
          <div>
            <span>MAPA DA OPERAÇÃO</span>
            <h2>Etapa organiza. Momento explica. Ação e prazo movem o dia.</h2>
          </div>
          <p>O corretor não precisa interpretar: o CRM mostra o que está acontecendo, o que fazer e até quando.</p>
        </header>
        <nav className="ncrm3-momentos" aria-label="Etapas do funil">
        {MOMENTOS.map((m) => (
          <button
            key={m.chave}
            type="button"
            className={m.chave === momentoAtivo ? "on" : ""}
            aria-pressed={m.chave === momentoAtivo}
            onClick={() => onTrocarMomento(m.chave)}
          >
            <small>ETAPA {MOMENTOS.indexOf(m) + 1}</small>
            <span>{m.titulo}</span>
            <b>{porMomento[m.chave].length}</b>
          </button>
        ))}
        </nav>

        <div className="ncrm3-mapa-detalhe">
          <div className="ncrm3-mapa-intro">
            <span>VOCÊ ESTÁ VENDO</span>
            <strong>{etapaAtiva.titulo}</strong>
            <small>{etapaAtiva.ajuda}</small>
          </div>
          <div className="ncrm3-mapa-condutas">
            {condutasDaEtapa.map((conduta) => {
              const acao = ACOES_OFICIAIS.find((a) => a.codigo === conduta.acao);
              return (
                <article key={conduta.codigo}>
                  <i>{conduta.ordem}</i>
                  <div>
                    <span>MOMENTO</span>
                    <strong>{conduta.rotulo}</strong>
                    <small>{acao?.rotulo ?? conduta.objetivo}</small>
                  </div>
                  <b>até {prazoPadrao(conduta.slaMin)}</b>
                </article>
              );
            })}
          </div>
        </div>
      </section>

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
