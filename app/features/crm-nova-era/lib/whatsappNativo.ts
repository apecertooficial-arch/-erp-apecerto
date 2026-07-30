// Abertura do WhatsApp OFICIAL do celular do corretor.
//
// O ERP nao envia mensagem. Este modulo so prepara o telefone e a URL que abre
// o aplicativo. Clicar aqui e INTENCAO, nunca prova de envio: a atuacao so e
// confirmada quando o outbound correspondente volta pelo webhook do D-API.

export type TelefoneOk = { ok: true; e164: string; exibicao: string };
export type MotivoTelefoneInvalido =
  | "vazio" | "curto_demais" | "longo_demais"
  | "ddd_invalido" | "celular_sem_nove" | "pais_nao_suportado";
export type TelefoneErro = { ok: false; motivo: MotivoTelefoneInvalido; explicacao: string };
export type ResultadoTelefone = TelefoneOk | TelefoneErro;

const DDD_MIN = 11;
const DDD_MAX = 99;

function somenteDigitos(bruto: string): string {
  return (bruto || "").replace(/\D+/g, "");
}

function formatarExibicao(ddd: string, numero: string): string {
  if (numero.length === 9) return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
}

/**
 * Normaliza um telefone brasileiro para E.164 (55DDDNUMERO).
 * Fail-closed: qualquer duvida vira erro com explicacao que o corretor entende.
 */
export function normalizarTelefone(bruto: string | null | undefined): ResultadoTelefone {
  const d = somenteDigitos(bruto ?? "");
  if (!d) return { ok: false, motivo: "vazio", explicacao: "Este cliente ainda nao tem telefone cadastrado." };

  let corpo = d;
  if (d.length > 11) {
    if (!d.startsWith("55")) {
      return { ok: false, motivo: "pais_nao_suportado", explicacao: "O numero parece ser de outro pais. Confira o cadastro." };
    }
    corpo = d.slice(2);
  }

  if (corpo.length < 10) return { ok: false, motivo: "curto_demais", explicacao: "O telefone esta incompleto. Faltam digitos." };
  if (corpo.length > 11) return { ok: false, motivo: "longo_demais", explicacao: "O telefone tem digitos a mais. Confira o cadastro." };

  const ddd = corpo.slice(0, 2);
  const numero = corpo.slice(2);
  const dddNum = Number(ddd);
  if (!Number.isFinite(dddNum) || dddNum < DDD_MIN || dddNum > DDD_MAX) {
    return { ok: false, motivo: "ddd_invalido", explicacao: `DDD ${ddd} nao existe. Confira o cadastro.` };
  }
  if (numero.length === 9 && !numero.startsWith("9")) {
    return { ok: false, motivo: "celular_sem_nove", explicacao: "Numero de 9 digitos precisa comecar com 9." };
  }

  return { ok: true, e164: `55${ddd}${numero}`, exibicao: formatarExibicao(ddd, numero) };
}

/** Esquema que abre o aplicativo instalado. Preferido no celular. */
export function urlWhatsAppApp(e164: string): string {
  return `whatsapp://send?phone=${e164}`;
}

/** URL oficial. Serve no desktop e como fallback quando o app nao abre. */
export function urlWhatsAppWeb(e164: string): string {
  return `https://wa.me/${e164}`;
}

/**
 * Prepara a abertura. Nunca inclui texto pre-preenchido: o corretor escreve no
 * proprio WhatsApp, e nada sai do ERP.
 */
export function prepararAberturaWhatsApp(bruto: string | null | undefined):
  | { ok: true; e164: string; exibicao: string; app: string; web: string }
  | TelefoneErro {
  const r = normalizarTelefone(bruto);
  if (!r.ok) return r;
  return { ok: true, e164: r.e164, exibicao: r.exibicao, app: urlWhatsAppApp(r.e164), web: urlWhatsAppWeb(r.e164) };
}
