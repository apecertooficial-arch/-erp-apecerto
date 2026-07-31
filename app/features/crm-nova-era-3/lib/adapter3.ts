/**
 * Leitura do estado real -> dados que o Card 3.0 e a Ficha 3.0 mostram. PURO.
 *
 * Reaproveita o adaptador que já existia (`crm-nova-era/live/adapter`) e só
 * acrescenta o que o card 3.0 passou a exibir: origem, interesse e a foto do
 * contato — todos vindos do MESMO cadastro de lead que o CRM atual usa.
 */
import { mapEstadoToLead, type EstadoRow } from "../../crm-nova-era/live/adapter.ts";
import type { LeadNova } from "../../crm-nova-era/lib/rules.ts";

export type EstadoRow3 = EstadoRow & {
  ncrm_workflow_config?: { max_tentativas?: number | null } | null;
  negocios:
    | (EstadoRow["negocios"] & {
        leads: { nome: string | null; telefone: string | null; email: string | null; origem?: string | null; extras?: unknown } | null;
      })
    | null;
};

const CHAVES_FOTO = [
  "foto", "foto_url", "foto_perfil", "avatar", "avatar_url", "profile_picture",
  "profile_pic_url", "profilePicture", "picture", "picture_url", "photo", "photo_url",
  "image", "image_url",
];

/** Mesma leitura de foto do CRM atual: aceita o campo em qualquer nível de `extras`. */
export function fotoDoLead(extras: unknown): string | null {
  if (!extras || typeof extras !== "object") return null;
  const fontes = [extras, ...Object.values(extras as Record<string, unknown>).filter((v) => v && typeof v === "object")];
  for (const fonte of fontes) {
    const reg = fonte as Record<string, unknown>;
    for (const chave of CHAVES_FOTO) {
      const v = reg[chave];
      if (typeof v === "string" && (/^https?:\/\//i.test(v) || v.startsWith("data:image/"))) return v;
    }
  }
  return null;
}

const CHAVES_INTERESSE = ["interesse", "interesse_principal", "empreendimento", "produto", "imovel", "tipo_imovel", "bairro_interesse"];

/** Interesse declarado no cadastro. Sem inventar: se não houver, devolve null. */
export function interesseDoLead(extras: unknown): string | null {
  if (!extras || typeof extras !== "object") return null;
  const fontes = [extras, ...Object.values(extras as Record<string, unknown>).filter((v) => v && typeof v === "object")];
  for (const fonte of fontes) {
    const reg = fonte as Record<string, unknown>;
    for (const chave of CHAVES_INTERESSE) {
      const v = reg[chave];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

export type LeadExibicao = {
  lead: LeadNova;
  origem: string | null;
  interesse: string | null;
  fotoUrl: string | null;
  email: string | null;
  versao: number;
  leadId: number | null;
  tentativasFeitas: number;
  /** Visita em aberto (quando o cliente está no Pipe): habilita registrar o resultado. */
  visitaId: string | null;
  /** Máximo de tentativas da régua DESTE lead (workflow versionado; leads antigos podem ter outro). */
  maxTentativas: number;
};

export function paraExibicao(row: EstadoRow3): LeadExibicao {
  const bruto = row.negocios?.leads ?? null;
  const lead = mapEstadoToLead(row);
  const origem = typeof bruto?.origem === "string" && bruto.origem.trim() ? bruto.origem.trim() : null;
  return {
    lead: { ...lead, origem: origem ?? lead.origem },
    origem,
    interesse: interesseDoLead(bruto?.extras),
    fotoUrl: fotoDoLead(bruto?.extras),
    email: bruto?.email ?? null,
    versao: row.versao,
    leadId: row.negocios?.lead_id ?? null,
    tentativasFeitas: row.tentativas_feitas ?? 0,
    visitaId: row.visita_id ?? null,
    maxTentativas: row.ncrm_workflow_config?.max_tentativas ?? 4,
  };
}

/* ---------------- Análise persistida da Sara ---------------- */

export type AnaliseSara = {
  negocio_id: number;
  proxima_acao_sugerida: string | null;
  justificativa: string | null;
  prazo_sugerido: string | null;
  confianca: number | null;
  etapa_sugerida: string | null;
  analisado_em: string | null;
};

/** Normaliza o mapa devolvido pelo board. Chave string -> número. */
export function analisesDoBoard(bruto: unknown): Record<number, AnaliseSara> {
  const saida: Record<number, AnaliseSara> = {};
  if (!bruto || typeof bruto !== "object") return saida;
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    const n = Number(k);
    if (Number.isFinite(n) && v && typeof v === "object") saida[n] = v as AnaliseSara;
  }
  return saida;
}

/**
 * A análise ficou para trás? Verdade quando não existe, ou quando o cliente
 * interagiu DEPOIS dela. É este predicado que dispara a atualização automática
 * — e só ele: analisar quem não mudou é queimar dinheiro.
 */
export function analiseDesatualizada(
  analise: AnaliseSara | undefined,
  ultimaInteracaoEm: string | null,
): boolean {
  if (!analise?.analisado_em) return true;
  if (!ultimaInteracaoEm) return false;
  return Date.parse(ultimaInteracaoEm) > Date.parse(analise.analisado_em);
}

export type ImovelBruto = { empreendimento_id: string; empreendimentos?: { id: string; nome: string | null; bairro: string | null; cidade: string | null } | null };

export function imoveisDoLead(brutos: ImovelBruto[] | null | undefined) {
  return (brutos ?? [])
    .map((b) => b.empreendimentos)
    .filter((e): e is { id: string; nome: string | null; bairro: string | null; cidade: string | null } => Boolean(e))
    .map((e) => ({ id: e.id, nome: e.nome ?? "Imóvel", bairro: e.bairro, cidade: e.cidade }));
}
