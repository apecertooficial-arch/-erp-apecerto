// Abertura do WhatsApp oficial do celular do corretor.
//
// O ERP nao envia mensagem. Este modulo so prepara o telefone e a URL que abre
// o aplicativo. Clicar aqui e INTENCAO, nunca prova de envio: a atuacao so e
// confirmada quando o outbound correspondente volta pelo webhook do D-API.

// Lista canonica de DDDs em uso no Brasil (Plano Nacional de Numeracao).
//
// A versao anterior aceitava qualquer numero de 11 a 99 e, quando recusava,
// dizia "DDD nao existe" — afirmacao que ela nao tinha como sustentar, porque
// 20, 23, 25, 26, 29, 36, 39, 40, 50, 52, 56-60, 70, 72, 76, 78, 80 e 90 caem
// nessa faixa e nao existem. Agora ou o DDD esta nesta lista, ou nao existe.
//
// Fonte: PNN/Anatel. Se a Anatel abrir um DDD novo, basta acrescentar aqui.
export const DDDS_VALIDOS: readonly number[] = Object.freeze([
  // Sao Paulo
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  // Rio de Janeiro / Espirito Santo
  21, 22, 24, 27, 28,
  // Minas Gerais
  31, 32, 33, 34, 35, 37, 38,
  // Parana / Santa Catarina
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  // Rio Grande do Sul
  51, 53, 54, 55,
  // Centro-Oeste e Norte
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  // Bahia / Sergipe
  71, 73, 74, 75, 77, 79,
  // Nordeste
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  // Norte
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const CONJUNTO = new Set<number>(DDDS_VALIDOS);

export function dddExiste(ddd: number | string): boolean {
  const n = typeof ddd === "number" ? ddd : Number(String(ddd).trim());
  return Number.isInteger(n) && CONJUNTO.has(n);
}

export type TelefoneOk = { ok: true; e164: string; exibicao: string };
export type MotivoTelefoneInvalido =
  | "vazio" | "curto_demais" | "longo_demais"
  | "ddd_invalido" | "celular_sem_nove" | "pais_nao_suportado";
export type TelefoneErro = { ok: false; motivo: MotivoTelefoneInvalido; explicacao: string };
export type ResultadoTelefone = TelefoneOk | TelefoneErro;

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
  if (!dddExiste(ddd)) {
    return { ok: false, motivo: "ddd_invalido", explicacao: `DDD ${ddd} nao existe no Brasil. Confira o cadastro.` };
  }
  if (numero.length === 9 && !numero.startsWith("9")) {
    return { ok: false, motivo: "celular_sem_nove", explicacao: "Numero de 9 digitos precisa comecar com 9." };
  }

  return { ok: true, e164: `55${ddd}${numero}`, exibicao: formatarExibicao(ddd, numero) };
}

/* A OUTRA FORMA DO MESMO NUMERO.
 *
 * O nono digito virou obrigatorio em celular brasileiro em 2012, mas quem se
 * cadastrou no WhatsApp antes disso pode continuar registrado na forma antiga
 * -- e o contrario tambem acontece: base velha que ganhou o 9 na importacao,
 * quando a conta real nunca teve. Nos dois casos o numero EXISTE, so nao na
 * forma que esta gravada.
 *
 * O enviador do ERP (dapi-enviar) sempre soube disso: ele tenta as duas formas
 * antes de desistir. O botao que o corretor usa nao tentava -- abria uma forma
 * so, o WhatsApp dizia "numero nao existe", e o lead era descartado como
 * contato invalido sem nunca ter sido testado por inteiro. Foi assim que a
 * operacao perdeu leads bons em 11/08.
 *
 * Devolve null quando nao ha outra forma plausivel (fixo, por exemplo). */
export function outraFormaDoNumero(e164: string): string | null {
  const m = /^55(\d{2})(\d+)$/.exec(e164 || "");
  if (!m) return null;
  const [, ddd, numero] = m;
  if (numero.length === 9 && numero.startsWith("9")) return `55${ddd}${numero.slice(1)}`;
  if (numero.length === 8 && /^[6-9]/.test(numero)) return `55${ddd}9${numero}`;
  return null;
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
  | { ok: true; e164: string; exibicao: string; app: string; web: string;
      alt: { e164: string; exibicao: string; app: string; web: string; rotulo: string } | null }
  | TelefoneErro {
  const r = normalizarTelefone(bruto);
  if (!r.ok) return r;
  const outro = outraFormaDoNumero(r.e164);
  const alt = outro
    ? {
        e164: outro,
        exibicao: formatarExibicao(outro.slice(2, 4), outro.slice(4)),
        app: urlWhatsAppApp(outro),
        web: urlWhatsAppWeb(outro),
        /* O rotulo diz o que muda, nao "tentar de novo": o corretor precisa
           entender que e outro numero de verdade, senao repete o mesmo clique. */
        rotulo: outro.length < r.e164.length ? "sem o 9º dígito" : "com o 9º dígito",
      }
    : null;
  return { ok: true, e164: r.e164, exibicao: r.exibicao, app: urlWhatsAppApp(r.e164), web: urlWhatsAppWeb(r.e164), alt };
}
