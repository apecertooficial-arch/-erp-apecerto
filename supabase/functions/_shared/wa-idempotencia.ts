// ============================================================================
// WA-IDEMPOTENCIA — decisões puras do envio de WhatsApp (dapi-enviar).
//
// Sem Deno, sem rede, sem banco: roda igual no Edge Runtime e no `node --test`
// (tests/wa-idempotencia.test.mjs). A Edge Function faz o I/O; tudo o que é
// DECISÃO (chave, classificação da resposta da D-API, próximo passo, resposta
// HTTP para uma chave já reservada) mora aqui.
//
// Regras que este módulo garante:
//   1. Toda tentativa de envio tem uma chave de idempotência. Se o chamador não
//      manda uma, ela é derivada de forma determinística de
//      instância + telefone normalizado + tipo + conteúdo + janela de 2 min.
//   2. Timeout / erro de rede / 5xx NÃO é falha: é resultado INCERTO. O provedor
//      pode ter entregue. Incerto nunca dispara reenvio nem a variante do 9º dígito.
//   3. A variante do 9º dígito só é tentada quando a D-API responde, de forma
//      definitiva, que o número não existe no WhatsApp. Formato real (tabela
//      motor_mensagem_partes, produção):
//        HTTP 400 {"success":false,"error":"Failed to send message",
//                  "message":"failed to resolve phone number: phone number 5511... is not on WhatsApp"}
//      (às vezes com o sufixo " (cached)"), e para mídia:
//        HTTP 400 {..., "message":"failed to send video: ... no LID found for 9...@s.whatsapp.net from server"}
// ============================================================================

export const JANELA_DERIVADA_MS = 2 * 60 * 1000;

export type TipoCanonico = "text" | "audio" | "image" | "video" | "document";

export type ConteudoEnvio = {
  text?: string | null;
  audio?: string | null;
  image?: string | null;
  video?: string | null;
  document?: string | null;
  caption?: string | null;
  fileName?: string | null;
  ptt?: boolean | null;
};

export type Classificacao =
  | { tipo: "sucesso"; messageId: string | null }
  | { tipo: "numero_inexistente"; motivo: string }
  | { tipo: "falhou"; motivo: string }
  | { tipo: "incerto"; motivo: string };

export type StatusEnvio = "reservado" | "enviado" | "falhou" | "incerto";

const digits = (t: unknown) => String(t ?? "").replace(/\D/g, "");

export function normalizarTelefoneBR(t: unknown): string {
  const d = digits(t);
  return d.length === 10 || d.length === 11 ? "55" + d : d;
}

/** Formas do mesmo número BR com e sem o 9º dígito. A primeira é sempre a original. */
export function variantesNonoDigito(to: string): string[] {
  if (/^55\d{11}$/.test(to) && to[4] === "9") return [to, to.slice(0, 4) + to.slice(5)];
  if (/^55\d{10}$/.test(to)) return [to, to.slice(0, 4) + "9" + to.slice(4)];
  return [to];
}

export function tipoCanonico(tipo: unknown): TipoCanonico | null {
  const t = String(tipo ?? "text").toLowerCase();
  if (t === "text" || t === "texto") return "text";
  if (t === "audio") return "audio";
  if (t === "image" || t === "imagem") return "image";
  if (t === "video") return "video";
  if (t === "document" || t === "documento") return "document";
  return null;
}

/** Texto canônico do conteúdo: mesma mensagem => mesma string, independente da ordem das chaves. */
export function conteudoCanonico(tipo: TipoCanonico, c: ConteudoEnvio): string {
  const campos: Array<[string, unknown]> = [
    ["tipo", tipo],
    ["text", c.text ?? null],
    ["audio", c.audio ?? null],
    ["image", c.image ?? null],
    ["video", c.video ?? null],
    ["document", c.document ?? null],
    ["caption", c.caption ?? null],
    ["fileName", c.fileName ?? null],
    ["ptt", tipo === "audio" ? c.ptt !== false : null],
  ];
  return JSON.stringify(campos);
}

export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashConteudo(tipo: TipoCanonico, c: ConteudoEnvio): Promise<string> {
  return sha256Hex(conteudoCanonico(tipo, c));
}

export function janelaDerivada(agoraMs: number): number {
  return Math.floor(agoraMs / JANELA_DERIVADA_MS);
}

/**
 * Chave derivada: hash(instância + telefone normalizado + tipo + hash do conteúdo + janela de 2 min).
 * A janela fixa sozinha deixaria passar duas chamadas iguais em 1:59 e 2:01; por isso a
 * reserva no banco (wa_envio_reservar) também procura, para chaves derivadas, um envio igual
 * nos últimos 120 s — a janela efetiva é deslizante.
 */
export async function derivarChave(p: { instancia: string; telefone: string; tipo: TipoCanonico; conteudoHash: string; agoraMs: number }): Promise<string> {
  const base = [p.instancia, normalizarTelefoneBR(p.telefone), p.tipo, p.conteudoHash, String(janelaDerivada(p.agoraMs))].join("|");
  return "auto:" + (await sha256Hex(base));
}

const CHAVE_VALIDA = /^[A-Za-z0-9:_.\-]{8,160}$/;

/**
 * Chave informada pelo chamador. Fica no espaço de quem chama: uma pessoa não consegue
 * reaproveitar (nem descobrir o resultado de) uma chave de serviço ou de outra pessoa.
 * Retorna null se ausente; lança se presente e inválida.
 */
export function chaveInformada(bruta: unknown, quem: { modo: "maquina" } | { modo: "pessoa"; userId: string }): string | null {
  if (bruta === undefined || bruta === null || bruta === "") return null;
  const k = String(bruta).trim();
  if (!CHAVE_VALIDA.test(k)) throw new Error("idempotency_key_invalida");
  return quem.modo === "maquina" ? `svc:${k}` : `usr:${quem.userId}:${k}`;
}

const NUMERO_INEXISTENTE = [
  "is not on whatsapp",
  "not on whatsapp",
  "failed to resolve phone number",
  "resolve phone",
  "no lid found",
  "no account",
  "not_registered",
  "not registered",
  "invalid number",
  "não existe",
  "nao existe",
];

const DESCONECTADA = [
  "disconnected", "not connected", "session not found", "session closed",
  "session_not_connected", "scan qr", "reconnect", "unauthorized",
];

/**
 * Classifica o resultado de UMA chamada à D-API.
 * httpStatus 0 = a chamada não completou (timeout, abort, DNS, conexão caída).
 */
export function classificarResposta(httpStatus: number, corpo: unknown): Classificacao {
  const t = (typeof corpo === "string" ? corpo : JSON.stringify(corpo ?? "")).toLowerCase();
  const obj = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : null;

  if (httpStatus === 0) {
    return { tipo: "incerto", motivo: "O WhatsApp não respondeu a tempo — a mensagem pode ter sido entregue. Confira a conversa antes de reenviar." };
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    if (obj?.success === false) {
      if (NUMERO_INEXISTENTE.some((s) => t.includes(s))) return { tipo: "numero_inexistente", motivo: "Este número não foi encontrado no WhatsApp (verifique o 9º dígito e o DDD)." };
      return { tipo: "falhou", motivo: "Não foi possível enviar esta mensagem agora — tente novamente em instantes." };
    }
    const mid = obj?.messageId ?? obj?.message_id ?? obj?.id ?? null;
    return { tipo: "sucesso", messageId: mid == null || mid === "" ? null : String(mid) };
  }
  // Recusa explícita de número: definitiva, e só ela libera a variante do 9º dígito.
  if (httpStatus >= 400 && httpStatus < 500 && NUMERO_INEXISTENTE.some((s) => t.includes(s))) {
    return { tipo: "numero_inexistente", motivo: "Este número não foi encontrado no WhatsApp (verifique o 9º dígito e o DDD)." };
  }
  if (httpStatus === 401 || httpStatus === 403 || DESCONECTADA.some((s) => t.includes(s))) {
    return { tipo: "falhou", motivo: "Instância desconectada — reconecte o WhatsApp pelo QR." };
  }
  // 408 e 5xx: o provedor pode ter processado a mensagem antes de falhar a resposta.
  if (httpStatus === 408 || httpStatus >= 500) {
    return { tipo: "incerto", motivo: "O WhatsApp respondeu com erro temporário — a mensagem pode ter sido entregue. Confira a conversa antes de reenviar." };
  }
  return { tipo: "falhou", motivo: "Não foi possível enviar esta mensagem agora — tente novamente em instantes." };
}

export type Passo =
  | { acao: "concluir"; status: "enviado"; destino: string; messageId: string | null }
  | { acao: "tentar_variante"; destino: string }
  | { acao: "concluir"; status: "falhou" | "incerto"; motivo: string };

/** Depois da tentativa `indice` (0-based) em `variantes`, o que fazer. */
export function proximoPasso(variantes: string[], indice: number, c: Classificacao): Passo {
  if (c.tipo === "sucesso") return { acao: "concluir", status: "enviado", destino: variantes[indice], messageId: c.messageId };
  if (c.tipo === "numero_inexistente" && indice + 1 < variantes.length) return { acao: "tentar_variante", destino: variantes[indice + 1] };
  if (c.tipo === "incerto") return { acao: "concluir", status: "incerto", motivo: c.motivo };
  return { acao: "concluir", status: "falhou", motivo: c.motivo };
}

export type Reserva = {
  acao: "enviar" | "devolver" | "em_andamento" | "incerto" | "conflito";
  registro?: {
    idempotency_key?: string;
    status?: StatusEnvio;
    provider_message_id?: string | null;
    destino?: string | null;
    instancia?: string | null;
    tipo?: string | null;
    erro?: string | null;
    tentativas?: number;
  } | null;
};

/**
 * Resposta HTTP quando a reserva NÃO autoriza uma nova chamada ao provedor.
 * `null` significa: pode enviar.
 */
export function respostaDaReserva(r: Reserva, contexto: { tipoPedido: string; sessionId: string }): { status: number; body: Record<string, unknown> } | null {
  const reg = r.registro ?? {};
  const chave = reg.idempotency_key ?? null;
  switch (r.acao) {
    case "enviar":
      return null;
    case "devolver":
      // Mesmo formato do sucesso original: chamadores antigos não percebem diferença.
      return { status: 200, body: { ok: true, sessionId: reg.instancia ?? contexto.sessionId, tipo: contexto.tipoPedido, to: reg.destino ?? null, messageId: reg.provider_message_id ?? null, idempotente: true, idempotency_key: chave } };
    case "em_andamento":
      return { status: 409, body: { error: "envio_em_andamento", motivo: "Esta mesma mensagem já está sendo enviada — aguarde alguns segundos.", idempotency_key: chave } };
    case "incerto":
      return { status: 409, body: { error: "envio_incerto", motivo: "Uma tentativa anterior desta mesma mensagem ficou sem confirmação do WhatsApp e pode ter sido entregue. Confira a conversa antes de enviar de novo.", idempotency_key: chave } };
    case "conflito":
      return { status: 422, body: { error: "idempotency_key_conflito", motivo: "A chave de idempotência já foi usada para outro conteúdo ou destino.", idempotency_key: chave } };
    default:
      return { status: 503, body: { error: "reserva_invalida" } };
  }
}

/** Resposta HTTP de um envio que acabou de ser concluído por esta chamada. */
export function respostaDoEnvio(p: { status: "enviado" | "falhou" | "incerto"; sessionId: string; tipoPedido: string; destino?: string; messageId?: string | null; motivo?: string; chave: string; tentativas: unknown[]; ultimoHttp?: number }): { status: number; body: Record<string, unknown> } {
  if (p.status === "enviado") {
    return { status: 200, body: { ok: true, sessionId: p.sessionId, tipo: p.tipoPedido, to: p.destino ?? null, messageId: p.messageId ?? null, idempotency_key: p.chave } };
  }
  if (p.status === "incerto") {
    // 504: não é 2xx (processar_agendadas não marca "enviado") e não é o 502 de falha definitiva.
    return { status: 504, body: { error: "resultado_incerto", motivo: p.motivo, status: p.ultimoHttp ?? 0, idempotency_key: p.chave, detalhe: p.tentativas } };
  }
  return { status: 502, body: { error: "dapi_erro", motivo: p.motivo, status: p.ultimoHttp ?? 0, idempotency_key: p.chave, detalhe: p.tentativas } };
}
