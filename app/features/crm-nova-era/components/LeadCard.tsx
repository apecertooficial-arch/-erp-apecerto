"use client";
/**
 * LeadCard — card compacto do lead (Fase 1.1).
 * A linha de maior destaque responde: "O que eu preciso fazer agora?"
 * — sempre a PRÓXIMA AÇÃO ARMAZENADA no lead (nunca um recálculo).
 * Progresso da cadência (bolinhas) só aparece enquanto o cliente NÃO respondeu.
 */
import type { AtrasoInfo, LeadNova, Tentativa } from "../lib/rules";

const NIVEL_ROTULO: Record<AtrasoInfo["nivel"], string> = {
  no_prazo: "No prazo",
  atencao: "Atenção",
  atrasado: "Atrasado",
  critico: "Crítico",
};

const MOMENTO_ROTULO: Record<LeadNova["momento"], string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  negociando: "Negociando",
};

function fmtCurto(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function DotsCadencia({ tentativas, max }: { tentativas: Tentativa[]; max: number }) {
  const dots = [];
  for (let i = 0; i < max; i++) {
    const t = tentativas[i];
    dots.push(
      <span
        key={i}
        className={`nova-crm-dot ${t ? `r-${t.resultado}` : "pend"}`}
        title={t ? `Tentativa ${t.numero}: ${t.resultado}` : `Tentativa ${i + 1}: pendente`}
      />,
    );
  }
  return <div className="nova-crm-dots" aria-label="Progresso da cadência (antes da resposta)">{dots}</div>;
}

export function LeadCard({
  lead,
  atraso,
  maxTentativas,
  selected,
  onOpen,
}: {
  lead: LeadNova;
  atraso: AtrasoInfo;
  maxTentativas: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const atrasoTxt =
    atraso.temPrazo && atraso.atrasadoMin > 0
      ? atraso.atrasadoMin < 60
        ? ` · ${atraso.atrasadoMin}min atrás`
        : ` · ${Math.floor(atraso.atrasadoMin / 60)}h atrás`
      : "";
  return (
    <div
      className={`nova-crm-card lv-${atraso.nivel} ${selected ? "sel" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
    >
      <div className="nova-crm-card-top">
        <strong>{lead.nome}</strong>
        <span className={`nova-crm-chip lv-${atraso.nivel}`}>{NIVEL_ROTULO[atraso.nivel]}</span>
      </div>
      <div className="nova-crm-card-origin">
        {lead.origem} · {lead.corretorNome} · <span className="nova-crm-mom">{MOMENTO_ROTULO[lead.momento]}</span>
      </div>
      {lead.respostaPendenteCorretor && (
        <div className="nova-crm-resp-badge">💬 Resposta aguardando você</div>
      )}
      {lead.aguardandoRespostaAutomacao && !lead.respondeu && lead.tentativas.length === 0 && lead.mensagemAutomaticaEnviadaEm && (
        <div className="nova-crm-auto-badge">🤖 Automação enviou {fmtCurto(lead.mensagemAutomaticaEnviadaEm)} — aguardando resposta</div>
      )}
      <div className="nova-crm-card-next">
        <b>{lead.proximaAcaoTitulo ?? "Definir próxima ação"}</b>
        <span> · {fmtCurto(lead.proximaAcaoEm)}{atrasoTxt}</span>
      </div>
      <div className="nova-crm-card-foot">
        <span>Última interação: {fmtCurto(lead.ultimaInteracaoEm)}</span>
        {!lead.respondeu && <DotsCadencia tentativas={lead.tentativas} max={maxTentativas} />}
      </div>
    </div>
  );
}
