"use client";
/**
 * ONBOARDING do CRM Nova Era (Fase 5, Etapa H): tour inicial, ajuda contextual e
 * checklist dos primeiros atendimentos. Sem servidor: preferência de exibição
 * guardada localmente por usuário (localStorage) — não altera nenhum dado do CRM.
 */
import { useEffect, useState } from "react";

const PASSOS: Array<{ titulo: string; texto: string }> = [
  { titulo: "As 4 etapas", texto: "Novo → Tentando contato → Em atendimento → Em acompanhamento. Visita e proposta NÃO são colunas: visita vai para o Pipe de Visitas quando estiver agendada de verdade; proposta vai para a Esteira de Vendas (proposta não é venda)." },
  { titulo: "Meu dia", texto: "Sua tela principal. A fila mostra, em ordem de prioridade, o que fazer agora: cliente que respondeu, lead novo, ação vencida, promessa vencendo, cadência, sem próxima ação e acompanhamentos." },
  { titulo: "Cadência", texto: "O sistema calcula o próximo passo e o prazo (dentro do horário comercial). Você executa e registra; nada é enviado automaticamente por você." },
  { titulo: "Registrar tentativa", texto: "A cada contato, use 'Registrar tentativa' com canal e resultado. O banco calcula o próximo passo da cadência." },
  { titulo: "Próxima ação", texto: "Depois que o cliente responde, é obrigatório definir a próxima ação com prazo. Lead sem próxima ação aparece na sua fila." },
  { titulo: "Sara", texto: "A Sara observa e sugere (resumo, temperatura, risco, roteiro e mensagem sugerida). Aceitar ou rejeitar é decisão sua e fica registrado. Ela nunca envia mensagens nem move leads." },
  { titulo: "Visita e proposta", texto: "Use 'Agendar visita' só com data/horário reais (cria a visita no Pipe). Use 'Registrar proposta' quando houver proposta de fato — ela vai para a Esteira e não conta como venda." },
  { titulo: "Descarte e nutrição", texto: "Sem perfil ou sem interesse? Descarte com motivo. Sem momento de compra agora? Nutrição. Ambos saem da fila ativa e ficam auditáveis." },
];

const CHECKLIST = [
  "Abrir o Meu dia e atender primeiro quem respondeu",
  "Registrar a 1ª tentativa de um lead novo",
  "Definir próxima ação com prazo após uma resposta",
  "Pedir uma análise da Sara e aceitar/rejeitar",
  "Registrar uma visita real ou uma proposta",
];

function chave(userId: string) { return `ncrm_onboarding_v1_${userId}`; }

export function OnboardingNovaEra({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (!localStorage.getItem(chave(userId))) setAberto(true); } catch { /* sem storage */ }
  }, [userId]);

  const fechar = (concluido: boolean) => {
    try { localStorage.setItem(chave(userId), concluido ? "concluido" : "dispensado"); } catch { /* ok */ }
    setAberto(false);
  };

  if (!aberto) {
    return (
      <button className="nova-crm-btn ghost" title="Rever o tour do CRM Nova Era" onClick={() => { setPasso(0); setAberto(true); }}>?</button>
    );
  }

  const p = PASSOS[passo];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: 520, maxWidth: "92vw", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Tour do CRM Nova Era · {passo + 1}/{PASSOS.length}</div>
        <h3 style={{ margin: "6px 0" }}>{p.titulo}</h3>
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>{p.texto}</p>
        {passo === PASSOS.length - 1 && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, fontSize: 13 }}>
            <b>Checklist dos primeiros atendimentos</b>
            <ul style={{ margin: "6px 0 0 18px" }}>{CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 12 }}>
          <button className="nova-crm-btn ghost" onClick={() => fechar(false)}>Pular</button>
          <div style={{ display: "flex", gap: 8 }}>
            {passo > 0 && <button className="nova-crm-btn ghost" onClick={() => setPasso(passo - 1)}>Voltar</button>}
            {passo < PASSOS.length - 1
              ? <button className="nova-crm-btn" onClick={() => setPasso(passo + 1)}>Avançar</button>
              : <button className="nova-crm-btn" onClick={() => fechar(true)}>Começar a atender</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
