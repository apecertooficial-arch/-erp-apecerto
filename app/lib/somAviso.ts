/* SONS DO APÊCERTO — identidade sonora do aviso.
 *
 * Quatro são sintetizados na hora com Web Audio (nada para hospedar, toca
 * instantâneo) e um é ARQUIVO: o "Som Padrão Apê" que o Rômulo trouxe. Ele custa um
 * download de 18 KB e um cache a mais; em troca, é um som que sintetizador
 * nenhum imita. Por isso a lista aceita os dois tipos em vez de escolher um.
 *
 * DOIS PAPÉIS, NÃO UM. Lead novo é 70% do volume de avisos (718 em 7 dias); o
 * resto é ação vencida, retorno e cliente que respondeu. Um som só para tudo
 * não diz NADA sobre o que chegou. Então há duas preferências: o som de lead
 * novo e o som dos demais avisos. O corretor aprende a diferença de ouvido e
 * decide se vale largar o que está fazendo antes mesmo de olhar a tela.
 *
 * POR QUE ISSO EXISTE
 * Notificação de push NAO permite escolher o som — a API do navegador só tem
 * `silent: true/false`. Com o aplicativo aberto (basta a ABA existir, mesmo
 * atrás de outras janelas) o service worker avisa a página e ela toca o que
 * quisermos. É assim que painel de call center faz barulho próprio.
 */

export type NomeSom = "fahh" | "sino" | "chamada" | "alerta" | "pulso";

/* `arquivo` presente = toca o áudio; ausente = sintetiza pela receita. */
export const SONS: { id: NomeSom; nome: string; descricao: string; arquivo?: string }[] = [
  { id: "fahh",    nome: "Som Padrão Apê", descricao: "Queda curta e inconfundível. Não se parece com nada do celular.",
                                          arquivo: "/sons/lead-novo.mp3" },
  { id: "sino",    nome: "Sino ApêCerto", descricao: "Duas notas claras, subindo. Assinatura da casa." },
  { id: "chamada", nome: "Chamada",       descricao: "Três toques seguidos. Difícil de ignorar." },
  { id: "alerta",  nome: "Alerta",        descricao: "Sirene curta e grave. Para o que não pode esperar." },
  { id: "pulso",   nome: "Pulso",         descricao: "Batida dupla e seca. Discreto, mas presente." },
];

const ARQUIVOS = new Map(SONS.filter((s) => s.arquivo).map((s) => [s.id, s.arquivo as string]));

const CHAVE = "apecerto:som-aviso";          // som dos avisos em geral
const CHAVE_LEAD = "apecerto:som-lead-novo";  // som exclusivo de lead novo
const CHAVE_VOL = "apecerto:som-volume";

/* Padrao dos avisos em geral: Alerta -- corta o barulho da sala e nao se
   confunde com WhatsApp nem com aviso do sistema.
   Padrao de LEAD NOVO: Som Padrao Ape, por decisao do Romulo. Quem preferir troca em
   Configuracoes; a escolha fica no aparelho, nao na conta. */
export const SOM_PADRAO: NomeSom = "alerta";
export const SOM_PADRAO_LEAD: NomeSom = "fahh";

/* Tipos de notificacao que contam como "lead novo". Vem do banco em
   ncrm_notificacao.tipo; se aparecer tipo novo, ele cai no som geral -- que e o
   comportamento seguro: um aviso desconhecido nao deve soar como lead. */
const TIPOS_LEAD_NOVO = ["primeira_abordagem_pendente", "lead_novo", "lead_distribuido"];
export function ehLeadNovo(tipo?: string | null): boolean {
  return !!tipo && TIPOS_LEAD_NOVO.includes(tipo);
}

function valido(v: string | null, padrao: NomeSom): NomeSom {
  return v && SONS.some((s) => s.id === v) ? (v as NomeSom) : padrao;
}

export function somEscolhido(): NomeSom {
  if (typeof window === "undefined") return SOM_PADRAO;
  return valido(window.localStorage.getItem(CHAVE), SOM_PADRAO);
}
export function escolherSom(id: NomeSom) {
  if (typeof window !== "undefined") window.localStorage.setItem(CHAVE, id);
  avisar();
}
export function somLeadEscolhido(): NomeSom {
  if (typeof window === "undefined") return SOM_PADRAO_LEAD;
  return valido(window.localStorage.getItem(CHAVE_LEAD), SOM_PADRAO_LEAD);
}
export function escolherSomLead(id: NomeSom) {
  if (typeof window !== "undefined") window.localStorage.setItem(CHAVE_LEAD, id);
  avisar();
}

/** O som certo para um aviso, pelo tipo dele. */
export function somDoAviso(tipo?: string | null): NomeSom {
  return ehLeadNovo(tipo) ? somLeadEscolhido() : somEscolhido();
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

type Preferencia = { som: NomeSom; somLead: NomeSom; volume: number };
let cache: Preferencia = { som: SOM_PADRAO, somLead: SOM_PADRAO_LEAD, volume: 0.9 };
export function preferenciaAtual() {
  if (typeof window === "undefined") return cache;
  const som = somEscolhido(); const somLead = somLeadEscolhido(); const volume = volumeEscolhido();
  if (som !== cache.som || somLead !== cache.somLead || volume !== cache.volume) {
    cache = { som, somLead, volume };
  }
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

/* Conta os pedidos REAIS de reprodução. O destravamento mudo é assíncrono: ele
   dá play, e só quando a promessa resolve é que pausa. Se um play de verdade
   entrar nesse meio-tempo, o pause do destravamento mata o som que o usuário
   acabou de pedir -- e o sintoma é exatamente "cliquei e não saiu nada".
   Guardando o número do pedido antes e comparando depois, o destravamento
   desiste de pausar quando percebe que perdeu a vez. */
let pedidoReal = 0;

/* Uma tentativa de destravamento por som, não uma a cada gesto: depois que o
   elemento tocou uma vez ele fica destravado, e insistir só cria mais corrida
   com o play de verdade. */
const destravados = new Set<NomeSom>();

/* O navegador só libera áudio depois de um gesto do usuário, e o contexto pode
   voltar a "suspended" sozinho (troca de aba, sistema em economia). Por isso
   isto NAO pode rodar uma vez só: tem de ser tentado a cada gesto ate o
   contexto estar "running". Foi essa a causa de o aviso chegar mudo mesmo com
   o service worker certo -- AudioContext ficava suspenso e ninguem retomava. */
export function liberarAudio() {
  const c = contexto();
  if (c && c.state !== "running") void c.resume();

  /* Arquivo tem bloqueio próprio, separado do AudioContext: um play mudo num
     gesto do usuário destrava o elemento para os avisos seguintes. Sem isto o
     primeiro lead do dia chegaria calado em quem usa o som de arquivo. */
  for (const id of ARQUIVOS.keys()) {
    if (destravados.has(id)) continue;
    const a = tocador(id);
    if (!a || !a.paused) continue;
    destravados.add(id);
    const marca = pedidoReal;
    const vol = a.volume;
    a.volume = 0;
    void a.play()
      .then(() => {
        if (pedidoReal !== marca) return;  // entrou um play de verdade: sai de fininho
        a.pause(); a.currentTime = 0; a.volume = vol;
      })
      .catch(() => { destravados.delete(id); a.volume = vol; });
  }
}

/** Diz se o navegador ja liberou o audio. Util para avisar na tela. */
export function audioLiberado(): boolean {
  const c = contexto();
  return !!c && c.state === "running";
}

type Nota = { f: number; em: number; dur: number; tipo?: OscillatorType; vol?: number };

/* Parcial de proposito: quem tem `arquivo` nao tem receita. */
const RECEITAS: Partial<Record<NomeSom, Nota[]>> = {
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

/* ÁUDIO DE ARQUIVO.
   Um HTMLAudioElement por som, criado na primeira vez e reaproveitado: criar um
   novo a cada aviso vaza memória e ainda perde o pré-carregamento. `currentTime
   = 0` antes do play garante que dois avisos seguidos toquem duas vezes, em vez
   de o segundo ser engolido pelo primeiro ainda em execução. */
const tocadores = new Map<NomeSom, HTMLAudioElement>();
function tocador(id: NomeSom): HTMLAudioElement | null {
  const src = ARQUIVOS.get(id);
  if (!src || typeof window === "undefined") return null;
  let a = tocadores.get(id);
  if (!a) { a = new Audio(src); a.preload = "auto"; tocadores.set(id, a); }
  return a;
}

/** Toca o som escolhido. Devolve false quando o navegador ainda não liberou áudio. */
export function tocarSom(id: NomeSom = somEscolhido(), volume = volumeEscolhido()): boolean {
  const a = tocador(id);
  if (a) {
    pedidoReal += 1;
    a.muted = false;
    a.volume = Math.max(0, Math.min(1, volume));
    a.currentTime = 0;
    /* O bloqueio de autoplay rejeita a promessa antes de qualquer gesto. Não é
       erro para o usuário: liberarAudio() roda a cada clique/tecla e a próxima
       chamada passa. Engolir aqui evita "Unhandled promise rejection". */
    void a.play().catch(() => { /* ainda sem gesto do usuário */ });
    return true;
  }
  const c = contexto();
  if (!c) return false;
  /* Suspenso: retoma e toca DEPOIS que o contexto voltar. Agendar as notas num
     contexto suspenso faz elas nascerem e morrerem sem som. */
  if (c.state !== "running") {
    void c.resume().then(() => { if (c.state === "running") emitir(c, id, volume); });
    return false;
  }
  emitir(c, id, volume);
  return true;
}

function emitir(c: AudioContext, id: NomeSom, volume: number) {
  const mestre = c.createGain();
  mestre.gain.value = Math.max(0, Math.min(1, volume));
  mestre.connect(c.destination);

  const agora = c.currentTime + 0.02;
  for (const n of RECEITAS[id] ?? RECEITAS[SOM_PADRAO] ?? []) {
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
}
