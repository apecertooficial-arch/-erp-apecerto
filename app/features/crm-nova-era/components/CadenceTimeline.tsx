"use client";
/**
 * CadenceTimeline — trilha unificada do lead (Fase 1.2).
 * Ordem: MENSAGEM AUTOMÁTICA (não conta como tentativa humana) → tentativas
 * humanas numeradas → ações comerciais. Depois da resposta, nunca aparece
 * "Tentativa 2/3/4" — aparece a próxima AÇÃO COMERCIAL armazenada.
 */
import { montarTimeline, type LeadNova, type SugestaoTentativa, type TimelineEvento } from "../lib/rules";

const NODE_COR_TENTATIVA: Record<string, string> = {
  nao_respondeu: "#c99b3c",
  respondeu: "#3b6fe0",
  telefone_invalido: "#d13d3d",
  pediu_retorno: "#7c3aed",
  sem_interesse: "#9aa0a8",
  contato_inadequado: "#8a6a4a",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function nodeDoEvento(e: TimelineEvento): { cor: string; simbolo: string } {
  if (e.tipo === "mensagem_automatica") return { cor: "#5b6b7c", simbolo: "🤖" };
  if (e.tipo === "acao_comercial") return { cor: "#2f9e8f", simbolo: "★" };
  return { cor: NODE_COR_TENTATIVA[e.resultado ?? ""] ?? "#9aa0a8", simbolo: String(e.numero ?? "•") };
}

export function CadenceTimeline({
  lead,
  sugestao,
}: {
  lead: LeadNova;
  sugestao: SugestaoTentativa;
}) {
  const eventos = montarTimeline(lead);
  const mostraProximaTentativa = !lead.respondeu && sugestao.aplicavel;
  return (
    <div className="nova-crm-tl">
      {eventos.map((e, i) => {
        const { cor, simbolo } = nodeDoEvento(e);
        return (
          <div className="nova-crm-tl-item" key={`${e.tipo}-${i}`}>
            <div className="nova-crm-tl-rail">
              <div className="nova-crm-tl-node" style={{ background: cor, fontSize: e.tipo === "mensagem_automatica" ? 12 : undefined }}>{simbolo}</div>
              <div className="nova-crm-tl-line" />
            </div>
            <div className="nova-crm-tl-body">
              <div className="c">{e.titulo}</div>
              <div className="m">{fmt(e.em)}</div>
              {e.detalhe && <div className="o" style={{ color: "#6b7280" }}>{e.detalhe}</div>}
              {e.observacao && <div className="o">{e.observacao}</div>}
            </div>
          </div>
        );
      })}

      {mostraProximaTentativa && sugestao.canal && (
        <div className="nova-crm-tl-item nova-crm-tl-next">
          <div className="nova-crm-tl-rail">
            <div className="nova-crm-tl-node">{sugestao.numeroTentativa}</div>
          </div>
          <div className="nova-crm-tl-body">
            <div className="c">Próxima: {sugestao.rotulo}</div>
            <div className="m">{lead.proximaAcaoEm ? `Agendada p/ ${fmt(lead.proximaAcaoEm)}` : sugestao.quandoISO ? `Sugerida p/ ${fmt(sugestao.quandoISO)}` : ""}</div>
            <div className="o">Canal sugerido: {sugestao.canal === "ligacao" ? "ligação" : sugestao.canal}. Janela operacional 09:30–18:00 (Brasília).</div>
          </div>
        </div>
      )}

      {lead.respondeu && (
        <div className="nova-crm-tl-item">
          <div className="nova-crm-tl-rail"><div className="nova-crm-tl-node" style={{ background: "#22a35a" }}>✓</div></div>
          <div className="nova-crm-tl-body">
            <div className="c">Cadência encerrada — cliente respondeu</div>
            <div className="m">O lead é guiado por ação comercial (nunca volta à régua 1→4).</div>
            {lead.proximaAcaoTitulo && (
              <div className="o">Próxima ação: <b>{lead.proximaAcaoTitulo}</b>{lead.proximaAcaoEm ? ` · ${fmt(lead.proximaAcaoEm)}` : ""}</div>
            )}
          </div>
        </div>
      )}

      {!lead.respondeu && !sugestao.aplicavel && (
        <div className="nova-crm-tl-item">
          <div className="nova-crm-tl-rail"><div className="nova-crm-tl-node" style={{ background: "#3f3a36" }}>■</div></div>
          <div className="nova-crm-tl-body">
            <div className="c">Cadência esgotada</div>
            <div className="m">Decidir: nutrir formalmente ou descartar com motivo.</div>
          </div>
        </div>
      )}
    </div>
  );
}
