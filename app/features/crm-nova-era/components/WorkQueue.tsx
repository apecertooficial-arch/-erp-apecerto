"use client";
/**
 * WorkQueue — "Minha fila de hoje" (Fase 1.1).
 * Ordem obrigatória com cabeçalhos por categoria:
 * 1 críticas → 2 responderam/aguardam → 3 previstas p/ agora → 4 novos sem
 * atuação → 5 demais do dia → 6 futuras.
 * A ação exibida é sempre a ARMAZENADA no lead.
 */
import { CATEGORIA_ROTULO, type ItemFila } from "../lib/rules";

const NIVEL_ROTULO: Record<string, string> = {
  no_prazo: "No prazo",
  atencao: "Atenção",
  atrasado: "Atrasado",
  critico: "Crítico",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function humano(min: number): string {
  if (min <= 0) return "no prazo";
  if (min < 60) return `${min} min de atraso`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60 ? ` ${min % 60}m` : ""} de atraso`;
}

export function WorkQueue({
  itens,
  selectedId,
  onOpenAction,
}: {
  itens: ItemFila[];
  selectedId: string | null;
  onOpenAction: (id: string) => void;
}) {
  if (itens.length === 0) {
    return <div className="nova-crm-empty">Nada pendente na fila de hoje com os filtros atuais.</div>;
  }
  const linhas: { it: ItemFila; rank: number; mostraHeader: boolean }[] = itens.map((it, i) => ({
    it,
    rank: i + 1,
    mostraHeader: i === 0 || itens[i - 1].categoria !== it.categoria,
  }));
  return (
    <div className="nova-crm-queue">
      {linhas.map(({ it, rank, mostraHeader }) => {
        return (
          <div key={it.lead.id}>
            {mostraHeader && (
              <div className="nova-crm-queue-cat">
                {it.categoria}. {CATEGORIA_ROTULO[it.categoria]}
              </div>
            )}
            <div
              className={`nova-crm-queue-item lv-${it.atraso.nivel} ${selectedId === it.lead.id ? "sel" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onOpenAction(it.lead.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenAction(it.lead.id); } }}
            >
              <div className="nova-crm-queue-rank">{rank}</div>
              <div className="nova-crm-queue-main">
                <strong>
                  {it.lead.nome}
                  {it.lead.respostaPendenteCorretor && <span className="nova-crm-resp-badge" style={{ marginLeft: 8 }}>💬 aguardando você</span>}
                </strong>
                <div className="m">
                  <b>{it.lead.proximaAcaoTitulo ?? "Definir próxima ação"}</b>
                  {" · "}{fmt(it.lead.proximaAcaoEm)}
                  {it.atraso.temPrazo ? ` · ${humano(it.atraso.atrasadoMin)}` : ""}
                </div>
              </div>
              <span className={`nova-crm-chip lv-${it.atraso.nivel}`}>{NIVEL_ROTULO[it.atraso.nivel]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
