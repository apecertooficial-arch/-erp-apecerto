/**
 * SLA REAL DA PRIMEIRA ABORDAGEM, na visão do card e da ficha 3.0 — PURO.
 *
 * O cálculo é o canônico (`crm-nova-era/lib/slaPrimeiraAbordagem`). Aqui só
 * decidimos, a partir do estado do lead, quais datas alimentam aquele cálculo:
 *
 *   lead entra -> distribuição define corretor -> card nasce em "Novo"
 *   -> corretor abre o WhatsApp do próprio celular (INTENÇÃO, não para o relógio)
 *   -> D-API confirma o outbound -> SLA encerra -> "Novo" vira "Tentando contato".
 *
 * Regras que este módulo prende:
 *  - abrir o WhatsApp NÃO encerra o SLA (vira "aguardando confirmação");
 *  - o SLA só vale enquanto o lead está em "Novo";
 *  - telefone inválido não gera cobrança de SLA, gera correção de cadastro.
 */
import { calcularSla, type SaidaSla } from "../../crm-nova-era/lib/slaPrimeiraAbordagem.ts";
import { normalizarTelefone } from "../../crm-nova-era/lib/whatsappNativo.ts";

export type LeadParaSla = {
  /** Momento atual. Fora de "novo" o SLA da primeira abordagem já terminou. */
  momento: string;
  /** Nascimento do card (distribuição válida). */
  criadoEm: string | null;
  /** Última interação confirmada pelo D-API. */
  ultimaInteracaoEm: string | null;
  /** Quantas abordagens humanas o banco já confirmou. */
  tentativasFeitas: number;
  telefone: string | null;
};

export function slaDoLead(
  lead: LeadParaSla,
  whatsappAbertoEm: Date | null,
  agora: Date = new Date(),
): SaidaSla {
  const fone = normalizarTelefone(lead.telefone ?? "");
  if (!fone.ok) {
    return calcularSla({ distribuidoEm: lead.criadoEm, agora, motivoNaoSeAplica: "telefone_invalido" });
  }

  // Saiu de "Novo" ou já existe outbound confirmado => primeira abordagem feita.
  const jaAbordado = lead.momento !== "novo" || lead.tentativasFeitas > 0;
  if (jaAbordado) {
    return calcularSla({
      distribuidoEm: lead.criadoEm,
      confirmadoEm: lead.ultimaInteracaoEm ?? lead.criadoEm,
      agora,
    });
  }

  return calcularSla({
    distribuidoEm: lead.criadoEm,
    whatsappAbertoEm: whatsappAbertoEm ? whatsappAbertoEm.toISOString() : null,
    agora,
  });
}

/** Classe visual do marcador, na paleta do CRM atual. */
export function tomDoSla(sla: SaidaSla): "verde" | "amarelo" | "vermelho" | "preto" | "neutro" {
  if (sla.estado === "nao_se_aplica") return "neutro";
  if (sla.estado === "confirmado") return "verde";
  if (sla.urgencia >= 3) return "vermelho";
  if (sla.urgencia === 2) return "amarelo";
  return "verde";
}

/** Texto curto do card. Nunca promete envio: o ERP não envia. */
export function rotuloCurtoSla(sla: SaidaSla): string {
  if (sla.estado === "confirmado") return sla.rotulo;
  if (sla.estado === "aguardando_confirmacao") return "WhatsApp aberto — aguardando confirmação";
  return sla.rotulo;
}
