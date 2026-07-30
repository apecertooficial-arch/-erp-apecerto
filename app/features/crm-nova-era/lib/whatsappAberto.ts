// Registro local de "abri o WhatsApp deste cliente".
//
// Isto e INTENCAO, nao envio. Serve para a tela mostrar "Aguardando confirmacao
// do WhatsApp" enquanto o outbound nao volta pelo D-API. Nao vira evento de
// atendimento e nao move etapa: so o outbound canonico faz isso.
//
// Fica no sessionStorage de proposito: e um estado do aparelho, some ao fechar a
// aba e nunca contradiz o servidor, que continua sendo a fonte da verdade.

const CHAVE = "ncrm:wa-aberto";

type Registro = Record<string, number>;

function ler(): Registro {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Registro) : {};
  } catch { return {}; }
}

export function marcarWhatsappAberto(negocioId: string | number, agora = Date.now()): void {
  try {
    const r = ler();
    r[String(negocioId)] = agora;
    sessionStorage.setItem(CHAVE, JSON.stringify(r));
  } catch { /* sem sessionStorage o fluxo continua; so nao ha o aviso local */ }
}

/** Instante em que o corretor abriu o WhatsApp, ou null. */
export function whatsappAbertoEm(negocioId: string | number): Date | null {
  const t = ler()[String(negocioId)];
  return typeof t === "number" ? new Date(t) : null;
}

/** Chamado quando o D-API confirma: o aviso local deixa de fazer sentido. */
export function limparWhatsappAberto(negocioId: string | number): void {
  try {
    const r = ler();
    delete r[String(negocioId)];
    sessionStorage.setItem(CHAVE, JSON.stringify(r));
  } catch { /* idem */ }
}

export function limparTodosWhatsappAberto(): void {
  try { sessionStorage.removeItem(CHAVE); } catch { /* idem */ }
}
