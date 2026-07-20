// Pausinhos de entrega estilo WhatsApp — compartilhado pelo chat do CRM e pelo chat ao vivo.
// lido = 2 tiques azuis · entregue/recebida = 2 tiques cinzas · enviado = 1 tique cinza
// enviando = relógio · erro = exclamação num círculo vermelho.
export type AckState = "enviando" | "enviado" | "entregue" | "lido" | "erro";

// Traduz o ack/status cru (d-api, webhook ou banco) para um dos estados de leitura.
export function ackState(status: string | number | null | undefined): AckState {
  if (status === null || status === undefined || status === "") return "enviado";
  const s = String(status).toLowerCase();
  if (["3", "4", "read", "read_ack", "lido", "played"].includes(s)) return "lido";
  if (["2", "delivered", "delivery_ack", "device", "received", "entregue"].includes(s)) return "entregue";
  if (["1", "sent", "server", "server_ack", "enviado"].includes(s)) return "enviado";
  if (["0", "-1", "pending", "pendente", "enviando", "clock"].includes(s)) return "enviando";
  if (["error", "failed", "erro", "falha", "undelivered"].some((k) => s.includes(k))) return "erro";
  return "enviado";
}

// Dois tiques (o segundo some quando é só "enviado").
function Ticks({ single }: { single?: boolean }) {
  return (
    <svg className="msg-ack-ico" viewBox="0 0 22 14" width="18" height="12" fill="none" aria-hidden="true">
      <path d="M1.5 7.6 L5 11 L11.4 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {!single && <path d="M7.6 11 L8 11.3 L14.4 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

// Exclamação num círculo vermelho (falha ao enviar).
function ErrorBadge() {
  return (
    <svg className="msg-ack-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="7.2" fill="#e03131" />
      <rect x="7.05" y="3.6" width="1.9" height="5.4" rx="0.95" fill="#fff" />
      <circle cx="8" cy="11.5" r="1.05" fill="#fff" />
    </svg>
  );
}

function Clock() {
  return (
    <svg className="msg-ack-ico" viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.6 V8 L10.4 9.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatusTick({ status, detalhe }: { status: string | number | null | undefined; detalhe?: string | null }) {
  const state = ackState(status);
  if (state === "enviando") return <i className="msg-ack pending" title="Enviando…"><Clock /></i>;
  if (state === "erro") return <i className="msg-ack erro" title={detalhe || "Falha no envio"}><ErrorBadge /></i>;
  const label = state === "lido" ? "Lido" : state === "entregue" ? "Entregue" : "Enviado";
  return <i className={`msg-ack ${state}`} title={label}><Ticks single={state === "enviado"} /></i>;
}
