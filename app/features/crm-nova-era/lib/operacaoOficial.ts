/**
 * CRM Nova Era — REGRAS OFICIAIS de operação (Fase 3).
 * ------------------------------------------------------------------
 * Módulo 100% PURO (sem React, sem rede, sem banco, sem Date.now interno:
 * o "agora" é sempre parâmetro). Complementa lib/rules.ts SEM substituí-lo:
 * aqui ficam a CADÊNCIA OFICIAL, o SLA VISUAL oficial e a PRIORIDADE DA FILA
 * oficiais (Regras 3 e 4). Nada aqui move lead, escreve banco ou envia mensagem.
 *
 * Princípios:
 *  - Cadência NÃO é coluna (Regra 2): as 4 colunas continuam simples; a cadência
 *    vive em próxima ação + prazo + estado do atendimento.
 *  - Sem dupla contagem (Regra 4): cada negócio ocupa APENAS sua prioridade mais alta.
 */

import type { LeadNova, ProximaAcaoTipo } from "./rules";

/* Helpers puros inlined (mantém o módulo autossuficiente para node --test). */
function minutosEntre(aISO: string, bISO: string): number {
  const a = Date.parse(aISO), b = Date.parse(bISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((a - b) / 60000);
}
function somaHoras(iso: string, horas: number): string {
  return new Date(Date.parse(iso) + horas * 3600000).toISOString();
}
/** Saída do lead (mesma regra de rules.ts): descarte > proposta > visita > nutrição. */
function saidaDoLead(lead: Pick<LeadNova, "descartadoMotivo" | "proposta" | "visitaAgendadaEm" | "nutricao">):
  "esteira_vendas" | "pipeline_visitas" | "descartado" | "nutricao" | null {
  if (lead.descartadoMotivo) return "descartado";
  if (lead.proposta) return "esteira_vendas";
  if (lead.visitaAgendadaEm) return "pipeline_visitas";
  if (lead.nutricao) return "nutricao";
  return null;
}

/* ============================ Cadência oficial ============================ */

export type CanalCadencia = "whatsapp" | "ligacao" | "audio" | "livre";

export interface PassoCadenciaOficial {
  numero: number;
  rotulo: string;
  canalPreferido: CanalCadencia;
  /** Janela alvo (minutos) a partir da MENSAGEM AUTOMÁTICA (âncora do disparo). */
  minMin: number;
  maxMin: number;
  nota: string;
}

const H = 60;
const D = 24 * 60;

/**
 * Cadência intensiva oficial (T1..T5) ancorada no envio da mensagem automática,
 * seguida de acompanhamento espaçado (D3/D7/D14/D30). A 1ª mensagem já é enviada
 * em tempo real pela automação existente — o corretor NÃO dispara outra
 * apresentação imediatamente; ele lê o contexto e assume.
 */
export const PLANO_CADENCIA_OFICIAL: {
  intensiva: PassoCadenciaOficial[];
  acompanhamentoDias: number[];
} = {
  intensiva: [
    { numero: 1, rotulo: "Assumir atendimento", canalPreferido: "livre", minMin: 0, maxMin: 5, nota: "Até 5 min após a mensagem automática: ler o contexto e assumir. Se respondeu, ir para Em atendimento." },
    { numero: 2, rotulo: "2ª tentativa", canalPreferido: "whatsapp", minMin: 30, maxMin: 60, nota: "WhatsApp curto e contextual — não repetir a mesma mensagem." },
    { numero: 3, rotulo: "3ª tentativa", canalPreferido: "ligacao", minMin: 3 * H, maxMin: 4 * H, nota: "Abordagem diferente: ligação ou áudio curto quando apropriado." },
    { numero: 4, rotulo: "4ª tentativa", canalPreferido: "whatsapp", minMin: 1 * D, maxMin: 1 * D, nota: "Próximo período comercial ou manhã do dia seguinte: nova abordagem com produto/oportunidade/pergunta objetiva." },
    { numero: 5, rotulo: "5ª tentativa (última intensiva)", canalPreferido: "livre", minMin: 1 * D, maxMin: 2 * D, nota: "24–48h. Sem resposta, entra em acompanhamento espaçado." },
  ],
  acompanhamentoDias: [3, 7, 14, 30],
};

export const MAX_TENTATIVAS_OFICIAL = PLANO_CADENCIA_OFICIAL.intensiva.length; // 5

export interface EtapaCadenciaOficial {
  fase: "intensiva" | "acompanhamento" | "encerrada";
  numero: number;            // nº da tentativa intensiva (1..5) ou dia do acompanhamento
  rotulo: string;
  canalPreferido: CanalCadencia | null;
  janelaAlvoISO: { de: string; ate: string } | null;
  nota: string;
}

/**
 * Descreve a PRÓXIMA etapa da cadência oficial para um lead SEM resposta.
 * Não se aplica após resposta efetiva (aí o controle é por próxima ação comercial).
 */
export function proximaEtapaCadenciaOficial(
  lead: Pick<LeadNova, "respondeu" | "tentativas" | "mensagemAutomaticaEnviadaEm" | "criadoEm">,
): EtapaCadenciaOficial {
  if (lead.respondeu) {
    return { fase: "encerrada", numero: 0, rotulo: "Cadência encerrada — cliente respondeu", canalPreferido: null, janelaAlvoISO: null, nota: "Controle passa a ser por próxima ação comercial." };
  }
  const feitas = lead.tentativas.length;
  const ancora = lead.mensagemAutomaticaEnviadaEm ?? lead.criadoEm;
  if (feitas < PLANO_CADENCIA_OFICIAL.intensiva.length) {
    const p = PLANO_CADENCIA_OFICIAL.intensiva[feitas];
    return {
      fase: "intensiva",
      numero: p.numero,
      rotulo: `Tentativa ${p.numero} de ${MAX_TENTATIVAS_OFICIAL} — ${p.rotulo}`,
      canalPreferido: p.canalPreferido,
      janelaAlvoISO: { de: somaHoras(ancora, p.minMin / 60), ate: somaHoras(ancora, p.maxMin / 60) },
      nota: p.nota,
    };
  }
  // acompanhamento espaçado
  const idxAcomp = feitas - PLANO_CADENCIA_OFICIAL.intensiva.length;
  const dias = PLANO_CADENCIA_OFICIAL.acompanhamentoDias;
  if (idxAcomp < dias.length) {
    const dia = dias[idxAcomp];
    return {
      fase: "acompanhamento",
      numero: dia,
      rotulo: `Acompanhamento — Dia ${dia}`,
      canalPreferido: "whatsapp",
      janelaAlvoISO: { de: somaHoras(ancora, dia * 24), ate: somaHoras(ancora, dia * 24) },
      nota: "Acompanhamento espaçado sem resposta. Após o Dia 30, reavaliar para nutrição, perdido ou nova oportunidade.",
    };
  }
  return { fase: "encerrada", numero: 0, rotulo: "Acompanhamento esgotado — reavaliar (nutrição/perdido/oportunidade)", canalPreferido: null, janelaAlvoISO: null, nota: "Após Dia 30 sem resposta." };
}

/* ============================ SLA visual oficial ============================ */

export type SLAOficial =
  | "chegaram_agora"   // lead recebido, ainda sem atuação humana
  | "nova_mensagem"    // cliente enviou mensagem não tratada
  | "verde"            // próxima ação futura ou atraso < 24h
  | "amarelo"          // atraso 24–48h
  | "vermelho"         // atraso 48–72h
  | "preto";           // atraso > 72h

export const SLA_OFICIAL_LIMITES = { amareloH: 24, vermelhoH: 48, pretoH: 72 };

export const SLA_OFICIAL_ROTULO: Record<SLAOficial, string> = {
  chegaram_agora: "Chegaram agora",
  nova_mensagem: "Nova mensagem do cliente",
  verde: "No prazo",
  amarelo: "Atrasado 24–48h",
  vermelho: "Atrasado 48–72h",
  preto: "Crítico +72h",
};

/**
 * Classificação de SLA oficial. Estados especiais (chegaram agora / nova mensagem)
 * têm precedência sobre a régua de atraso. Atraso é medido pela próxima ação
 * armazenada (proximaAcaoEm) frente ao "agora".
 */
export function classificarSLAOficial(
  lead: Pick<LeadNova, "respondeu" | "tentativas" | "respostaPendenteCorretor" | "proximaAcaoEm">,
  agoraISO: string,
): SLAOficial {
  if (lead.respostaPendenteCorretor) return "nova_mensagem";
  if (!lead.respondeu && lead.tentativas.length === 0) return "chegaram_agora";
  if (!lead.proximaAcaoEm) return "verde"; // sem prazo agendado = sem atraso
  const atrasoMin = minutosEntre(agoraISO, lead.proximaAcaoEm);
  if (Number.isNaN(atrasoMin) || atrasoMin <= 0) return "verde"; // futuro ou agora
  const h = atrasoMin / 60;
  if (h > SLA_OFICIAL_LIMITES.pretoH) return "preto";
  if (h >= SLA_OFICIAL_LIMITES.vermelhoH) return "vermelho";
  if (h >= SLA_OFICIAL_LIMITES.amareloH) return "amarelo";
  return "verde";
}

/* ============================ Prioridade da fila oficial ============================ */

export type PrioridadeOficial = 1 | 2 | 3 | 4 | 5 | 6;

export const PRIORIDADE_OFICIAL_ROTULO: Record<PrioridadeOficial, string> = {
  1: "Cliente respondeu e aguarda atendimento",
  2: "Lead novo sem atuação humana",
  3: "Retorno combinado vencido",
  4: "Visita ou proposta com pendência",
  5: "Próxima ação vencida",
  6: "Acompanhamento preventivo",
};

const TIPOS_VISITA_PROPOSTA: ProximaAcaoTipo[] = ["agendar_visita", "preparar_proposta"];

function vencida(lead: Pick<LeadNova, "proximaAcaoEm">, agoraISO: string): boolean {
  if (!lead.proximaAcaoEm) return false;
  const m = minutosEntre(agoraISO, lead.proximaAcaoEm);
  return !Number.isNaN(m) && m > 0;
}

/**
 * Prioridade OFICIAL (Regra 4): cada negócio recebe UMA categoria — a mais alta
 * aplicável (sem dupla contagem). Ordem:
 *  1 respondeu e aguarda → 2 novo sem atuação → 3 retorno combinado vencido →
 *  4 visita/proposta com pendência → 5 próxima ação vencida → 6 acompanhamento preventivo.
 */
export function prioridadeFilaOficial(
  lead: Pick<LeadNova, "respondeu" | "tentativas" | "respostaPendenteCorretor" | "proximaAcaoTipo" | "proximaAcaoEm">,
  agoraISO: string,
): PrioridadeOficial {
  if (lead.respostaPendenteCorretor) return 1;
  if (!lead.respondeu && lead.tentativas.length === 0) return 2;
  if (lead.proximaAcaoTipo === "retornar_contato" && vencida(lead, agoraISO)) return 3;
  if (lead.proximaAcaoTipo && TIPOS_VISITA_PROPOSTA.includes(lead.proximaAcaoTipo)) return 4;
  if (vencida(lead, agoraISO)) return 5;
  return 6;
}

export interface ItemFilaOficial {
  lead: LeadNova;
  prioridade: PrioridadeOficial;
  sla: SLAOficial;
}

/**
 * Ordena a fila oficial: leads em saída (visita/proposta/descarte) ficam FORA;
 * cada lead ocupa só sua prioridade mais alta; empate por prazo e depois id.
 */
export function ordenarFilaOficial(leads: LeadNova[], agoraISO: string): ItemFilaOficial[] {
  const itens = leads
    .filter((l) => saidaDoLead(l) === null)
    .map((lead) => ({
      lead,
      prioridade: prioridadeFilaOficial(lead, agoraISO),
      sla: classificarSLAOficial(lead, agoraISO),
    }));
  itens.sort((x, y) => {
    if (x.prioridade !== y.prioridade) return x.prioridade - y.prioridade;
    const tx = Date.parse(x.lead.proximaAcaoEm ?? x.lead.criadoEm);
    const ty = Date.parse(y.lead.proximaAcaoEm ?? y.lead.criadoEm);
    if (tx !== ty) return tx - ty;
    return x.lead.id < y.lead.id ? -1 : x.lead.id > y.lead.id ? 1 : 0;
  });
  return itens;
}

/** Contagem por prioridade (sem dupla contagem — soma = tamanho da fila). */
export function contarPorPrioridade(leads: LeadNova[], agoraISO: string): Record<PrioridadeOficial, number> {
  const base: Record<PrioridadeOficial, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const it of ordenarFilaOficial(leads, agoraISO)) base[it.prioridade] += 1;
  return base;
}

/** Contagem por faixa de SLA (cada lead conta uma vez). */
export function contarPorSLA(leads: LeadNova[], agoraISO: string): Record<SLAOficial, number> {
  const base: Record<SLAOficial, number> = { chegaram_agora: 0, nova_mensagem: 0, verde: 0, amarelo: 0, vermelho: 0, preto: 0 };
  for (const it of ordenarFilaOficial(leads, agoraISO)) base[it.sla] += 1;
  return base;
}

/**
 * Regra do "retorno combinado" (cliente pediu retorno): a data/hora é obrigatória
 * e uma cadência genérica NÃO pode substituir o compromisso informado. Aqui só
 * validamos a coerência do compromisso (puro).
 */
export function retornoCombinadoValido(lead: Pick<LeadNova, "proximaAcaoTipo" | "proximaAcaoEm">): boolean {
  if (lead.proximaAcaoTipo !== "retornar_contato") return true; // não é retorno combinado
  return !!lead.proximaAcaoEm && !Number.isNaN(Date.parse(lead.proximaAcaoEm));
}
