/* Inscricao do aparelho no Web Push.
 *
 * Separado do componente para poder ser testado no node: a UI depende de React
 * e de window, estas regras nao.
 *
 * CONTRATO. Nada aqui envia mensagem para cliente nenhum. O push so acorda o
 * corretor e abre o aplicativo na tela certa. O que ele faz depois continua
 * sendo decisao dele, pelo botao verde de sempre.
 */

/** Estado da permissao, na linguagem que a tela precisa mostrar. */
export type EstadoPush =
  | "nao_suportado"    // navegador sem service worker ou sem PushManager
  | "ios_sem_instalar" // iPhone so entrega push se o app estiver na tela inicial
  | "pode_pedir"       // ainda nao perguntamos
  | "negado"           // usuario recusou; so ele reverte, nas configuracoes
  | "ligado";          // inscrito e funcionando

/**
 * A chave publica VAPID chega como base64url e o navegador exige bytes.
 * Sem isto, subscribe() estoura InvalidCharacterError.
 */
export function chaveParaBytes(base64url: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

/** ArrayBuffer da subscription -> base64url, que e o formato que o banco guarda. */
export function bufferParaBase64url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * iOS so entrega Web Push para aplicativo instalado na tela inicial (iOS 16.4+).
 * No Safari comum a permissao ate aparece, mas nada chega -- pior do que nao
 * oferecer. Detectamos para poder explicar em vez de prometer errado.
 */
export function ehIosSemInstalar(ua: string, standalone: boolean): boolean {
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  return ios && !standalone;
}

/** Le o estado sem pedir nada ao usuario. Chamado na montagem da tela. */
export function lerEstado(params: {
  temServiceWorker: boolean;
  temPushManager: boolean;
  permissao: NotificationPermission | null;
  jaInscrito: boolean;
  ua: string;
  standalone: boolean;
}): EstadoPush {
  if (!params.temServiceWorker || !params.temPushManager) return "nao_suportado";
  if (ehIosSemInstalar(params.ua, params.standalone)) return "ios_sem_instalar";
  if (params.permissao === "denied") return "negado";
  if (params.permissao === "granted" && params.jaInscrito) return "ligado";
  return "pode_pedir";
}

export type DadosInscricao = { endpoint: string; p256dh: string; auth: string; userAgent: string };

/** Extrai o que o banco precisa. Inscricao sem as duas chaves e inutil. */
export function extrairInscricao(sub: PushSubscription, userAgent: string): DadosInscricao | null {
  const p256dh = bufferParaBase64url(sub.getKey("p256dh"));
  const auth = bufferParaBase64url(sub.getKey("auth"));
  if (!sub.endpoint || !p256dh || !auth) return null;
  return { endpoint: sub.endpoint, p256dh, auth, userAgent: userAgent.slice(0, 200) };
}
