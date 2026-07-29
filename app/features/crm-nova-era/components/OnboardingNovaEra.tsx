"use client";
/**
 * ONBOARDING do CRM Nova Era (Fase 5, Etapa H): tour inicial, ajuda contextual e
 * checklist dos primeiros atendimentos. Sem servidor: preferência de exibição
 * guardada localmente por usuário (localStorage) — não altera nenhum dado do CRM.
 */
import { useEffect, useState } from "react";

const PASSOS: Array<{ titulo: string; texto: string }> = [
  { titulo: "1. Encontre o próximo cliente", texto: "Abra 'Meu dia'. A lista já vem na ordem certa, em 4 blocos: Atenda agora, Faça hoje, Agendados e Aguardando cliente. O primeiro item do topo é sempre o mais urgente." },
  { titulo: "2. Abra o chat", texto: "Clique em 'Abrir chat' direto no item da fila, no card do quadro ou no topo da ficha. É a mesma conversa do CRM de sempre — mesmo contato, mesmo histórico, mesmo número. Abrir não envia nada." },
  { titulo: "3. Registre o resultado", texto: "Depois de falar com o cliente, use 'Registrar resultado'. Diga o que aconteceu (respondeu, não respondeu, pediu retorno). É isso que mantém o seu dia organizado." },
  { titulo: "4. Defina a próxima ação", texto: "Sempre deixe combinado o próximo passo e o prazo. Atendimento sem próxima ação volta para a sua fila como pendência." },
  { titulo: "5. Consulte a Sara", texto: "Em 'Ver sugestão da Sara' você recebe resumo da conversa, o que o cliente procura, objeções, risco e uma sugestão de abordagem. Ela só sugere: nada é enviado nem alterado sem você confirmar." },
  { titulo: "6. Agende a visita", texto: "Em 'Mais ações' → 'Agendar visita', com data e horário reais. A visita passa a existir no Pipe de Visitas — use apenas quando estiver combinada de verdade." },
  { titulo: "7. Registre a proposta", texto: "Em 'Mais ações' → 'Registrar proposta'. Ela segue para a Esteira de Vendas. Atenção: proposta não é venda — a venda continua sendo fechada na Esteira." },
  { titulo: "As 4 etapas", texto: "Novo → Tentando contato → Em atendimento → Em acompanhamento. Visita e proposta não são colunas: são saídas para o Pipe de Visitas e para a Esteira." },
];


const CHECKLIST = [
  "Abrir o Meu dia e atender o primeiro de 'Atenda agora'",
  "Abrir o chat desse cliente e responder",
  "Registrar o resultado do contato",
  "Definir a próxima ação com prazo",
  "Ver a sugestão da Sara e decidir",
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
          <button className="nova-crm-btn ghost" onClick={() => fechar(false)}>Pular e atender agora</button>
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
