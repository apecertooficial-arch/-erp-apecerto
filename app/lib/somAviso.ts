/* SONS DO APÊCERTO — identidade sonora do aviso.
 *
 * Sintetizados na hora com Web Audio, sem arquivo de áudio: nada para hospedar,
 * nada para baixar, toca instantâneo e nunca perde a assinatura por cache.
 *
 * POR QUE ISSO EXISTE
 * Notificação de push NAO permite escolher o som — a API do navegador só tem
 * `silent: true/false`. Com o aplicativo aberto (basta a ABA existir, mesmo
 * atrás de outras janelas) o service worker avisa a página e ela toca o que
 * quisermos. É assim que painel de call center faz barulho próprio.
 */

export type NomeSom = "sino" | "chamada" | "alerta" | "pulso";

export const SONS: { id: NomeSom; nome: string; descricao: string }[] = [
  { id: "sino",    nome: "Sino ApêCerto", descricao: "Duas notas claras, subindo. Assinatura da casa." },
  { id: "chamada", nome: "Chamada",       descricao: "Três toques seguidos. Difícil de ignorar." },
  { id: "alerta",  nome: "Alerta",        descricao: "Sirene curta e grave. Para o que não pode esperar." },
  { id: "pulso",   nome: "Pulso",         descricao: "Batida dupla e seca. Discreto, mas presente." },
];

const CHAVE = "apecerto:som-aviso";
const CHAVE_VOL = "apecerto:som-volume";

export function somEscolhido(): NomeSom {
  if (typeof window === "undefined") return "sino";
  const v = window.localStorage.getItem(CHAVE) as NomeSom | null;
  return v && SONS.some((s) => s.id === v) ? v : "sino";
}
export function escolherSom(id: NomeSom) {
  if (typeof window !== "undefined") window.localStorage.setItem(CHAVE, id);
  avisar();
}
export function volumeEscolhido(): number {
  if (typeof window === "undefined") return 0.9;
  const v = Number(window.localStorage.getItem(CHAVE_VOL));
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.9;
}
export function escolherVolume(v: number) {
  if (typeof window !== "undefined") window.localStorage.setItem(CHAVE_VOL, String(v));
  avisar();
}

/* Store minimo para o React ler a preferencia com useSyncExternalStore, em vez
   de setState dentro de efeito -- que dispara render em cascata e o lint barra.
   O snapshot precisa ser estavel: memorizamos e so trocamos quando muda. */
const ouvintes = new Set<() => void>();
function avisar() { for (const o of ouvintes) o(); }
export function assinarPreferencia(cb: () => void) {
  ouvintes.add(cb);
  return () => { ouvintes.delete(cb); };
}

let cache = { som: "sino" as NomeSom, volume: 0.9 };
export function preferenciaAtual() {
  if (typeof window === "undefined") return cache;
  const som = somEscolhido(); const volume = volumeEscolhido();
  if (som !== cache.som || volume !== cache.volume) cache = { som, volume };
  return cache;
}
export function preferenciaPadrao() { return cache; }

let ctx: AudioContext | null = null;
function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/* O navegador só libera áudio depois de um gesto do usuário. Chamamos isto no
   primeiro clique da sessão para que o aviso seguinte já saia sem tropeço. */
export function liberarAudio() {
  const c = contexto();
  if (c && c.state === "suspended") void c.resume();
}

type Nota = { f: number; em: number; dur: number; tipo?: OscillatorType; vol?: number };

const RECEITAS: Record<NomeSom, Nota[]> = {
  // Quinta ascendente com brilho: soa "positivo", vira marca depois de dois dias.
  sino: [
    { f: 880,  em: 0,    dur: 0.42, vol: 1 },
    { f: 1318, em: 0.13, dur: 0.55, vol: 0.95 },
    { f: 1760, em: 0.26, dur: 0.60, vol: 0.5 },
  ],
  // Três toques iguais: o cérebro conta e reconhece de longe.
  chamada: [
    { f: 1046, em: 0,    dur: 0.16, vol: 1 },
    { f: 1046, em: 0.22, dur: 0.16, vol: 1 },
    { f: 1046, em: 0.44, dur: 0.30, vol: 1 },
  ],
  // Grave que sobe e desce, tipo sirene curta. Urgência sem ser estridente.
  alerta: [
    { f: 440, em: 0,    dur: 0.20, tipo: "sawtooth", vol: 0.85 },
    { f: 660, em: 0.18, dur: 0.20, tipo: "sawtooth", vol: 0.9 },
    { f: 440, em: 0.36, dur: 0.20, tipo: "sawtooth", vol: 0.85 },
    { f: 660, em: 0.54, dur: 0.34, tipo: "sawtooth", vol: 0.95 },
  ],
  // Batida dupla curta: presença sem interromper conversa.
  pulso: [
    { f: 320, em: 0,    dur: 0.12, tipo: "triangle", vol: 1 },
    { f: 320, em: 0.16, dur: 0.20, tipo: "triangle", vol: 0.9 },
  ],
};

/** Toca o som escolhido. Devolve false quando o navegador ainda não liberou áudio. */
export function tocarSom(id: NomeSom = somEscolhido(), volume = volumeEscolhido()): boolean {
  const c = contexto();
  if (!c) return false;
  if (c.state === "suspended") { void c.resume(); }

  const mestre = c.createGain();
  mestre.gain.value = Math.max(0, Math.min(1, volume));
  mestre.connect(c.destination);

  const agora = c.currentTime + 0.02;
  for (const n of RECEITAS[id] ?? RECEITAS.sino) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.tipo ?? "sine";
    osc.frequency.setValueAtTime(n.f, agora + n.em);
    // Envelope: ataque rápido e cauda curta. Sem isso estala no início e no fim.
    const pico = (n.vol ?? 1) * 0.9;
    g.gain.setValueAtTime(0.0001, agora + n.em);
    g.gain.exponentialRampToValueAtTime(pico, agora + n.em + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, agora + n.em + n.dur);
    osc.connect(g); g.connect(mestre);
    osc.start(agora + n.em);
    osc.stop(agora + n.em + n.dur + 0.02);
  }
  return true;
}
