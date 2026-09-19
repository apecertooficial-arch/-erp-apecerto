import { hojeOperacao } from "../../lib/timezone.ts";

export const STATUS_RESULTADO_VISITA = ["realizada", "cancelada", "nao_compareceu"] as const;

export type StatusResultadoVisita = (typeof STATUS_RESULTADO_VISITA)[number];

export const ROTULO_STATUS_RESULTADO: Record<StatusResultadoVisita, string> = {
  realizada: "Visita realizada",
  cancelada: "Visita cancelada",
  nao_compareceu: "Cliente não compareceu",
};

export const RESULTADOS_VISITA: Record<StatusResultadoVisita, ReadonlyArray<{ codigo: string; rotulo: string }>> = {
  realizada: [
    { codigo: "fara_proposta", rotulo: "Vai receber proposta" },
    { codigo: "interessado", rotulo: "Gostou e seguirá em atendimento" },
    { codigo: "quer_outra_opcao", rotulo: "Quer conhecer outra opção" },
    { codigo: "precisa_conversar", rotulo: "Precisa conversar ou pensar" },
    { codigo: "nao_gostou", rotulo: "Não gostou do imóvel" },
  ],
  cancelada: [
    { codigo: "remarcar", rotulo: "Será remarcada" },
    { codigo: "cliente_cancelou", rotulo: "Cliente cancelou" },
    { codigo: "corretor_cancelou", rotulo: "Corretor cancelou" },
    { codigo: "produto_indisponivel", rotulo: "Imóvel ficou indisponível" },
    { codigo: "conflito_agenda", rotulo: "Conflito de agenda" },
    { codigo: "sem_confirmacao", rotulo: "Cliente não confirmou" },
    { codigo: "outro", rotulo: "Outro motivo" },
  ],
  nao_compareceu: [
    { codigo: "nao_compareceu", rotulo: "Cliente não compareceu" },
  ],
};

export const MIN_JUSTIFICATIVA_VISITA = 10;

export function resultadoPermitido(status: string, codigo: string) {
  if (!STATUS_RESULTADO_VISITA.includes(status as StatusResultadoVisita)) return false;
  return RESULTADOS_VISITA[status as StatusResultadoVisita].some((item) => item.codigo === codigo);
}

export function validarResultadoVisita(status: string, codigo: string, justificativa: string) {
  if (!resultadoPermitido(status, codigo)) return "Escolha o resultado da visita.";
  if (justificativa.trim().length < MIN_JUSTIFICATIVA_VISITA) {
    return `Explique o que aconteceu em pelo menos ${MIN_JUSTIFICATIVA_VISITA} caracteres.`;
  }
  return null;
}

function diaUtc(data: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!partes) return null;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const valor = Date.UTC(ano, mes - 1, dia);
  const conferido = new Date(valor);
  return conferido.getUTCFullYear() === ano
    && conferido.getUTCMonth() === mes - 1
    && conferido.getUTCDate() === dia ? valor : null;
}

/** Idade operacional da pendência, sem depender do fuso do navegador. */
export function diasAguardandoResultado(data: string, referencia = hojeOperacao()): number | null {
  const inicio = diaUtc(data);
  const fim = diaUtc(referencia);
  if (inicio == null || fim == null) return null;
  return Math.max(0, Math.floor((fim - inicio) / 86_400_000));
}

export function rotuloAtrasoResultado(data: string, referencia = hojeOperacao()): string {
  const dias = diasAguardandoResultado(data, referencia);
  if (dias == null) return "data não confirmada";
  if (dias === 0) return "hoje";
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export type ResumoCobrancasGerenciais = {
  total: number;
  responsaveis: number;
  haDoisDiasOuMais: number;
  maisAntigaDias: number | null;
  semResponsavel: number;
};

export type ResumoCobrancaPorCorretor = {
  chave: string;
  corretorId: number | null;
  corretor: string;
  total: number;
  haDoisDiasOuMais: number;
  maisAntigaDias: number | null;
};

/** Consolida apenas fatos presentes na fila; não projeta conversão, qualidade
 * ou produtividade sem evidência persistida. */
export function resumirCobrancasGerenciais(
  itens: ReadonlyArray<{ data: string; corretor?: string | null }>,
  referencia = hojeOperacao(),
): ResumoCobrancasGerenciais {
  const responsaveis = new Set<string>();
  let haDoisDiasOuMais = 0;
  let maisAntigaDias: number | null = null;
  let semResponsavel = 0;
  for (const item of itens) {
    const corretor = item.corretor?.trim() ?? "";
    if (corretor) responsaveis.add(corretor.toLocaleLowerCase("pt-BR"));
    else semResponsavel += 1;
    const dias = diasAguardandoResultado(item.data, referencia);
    if (dias == null) continue;
    if (dias >= 2) haDoisDiasOuMais += 1;
    maisAntigaDias = maisAntigaDias == null ? dias : Math.max(maisAntigaDias, dias);
  }
  return {
    total: itens.length,
    responsaveis: responsaveis.size,
    haDoisDiasOuMais,
    maisAntigaDias,
    semResponsavel,
  };
}

/** Ordena a fila de gestão por risco operacional. A função só usa pendências
 * que a RPC já autorizou; não calcula conversão ou nota de qualidade. */
export function resumirCobrancasPorCorretor(
  itens: ReadonlyArray<{ data: string; corretor?: string | null; corretor_id?: number | null }>,
  referencia = hojeOperacao(),
): ResumoCobrancaPorCorretor[] {
  const grupos = new Map<string, ResumoCobrancaPorCorretor>();
  for (const item of itens) {
    const corretorId = Number.isSafeInteger(item.corretor_id) && Number(item.corretor_id) > 0
      ? Number(item.corretor_id)
      : null;
    const corretor = item.corretor?.trim() || "Sem responsável";
    const chave = corretorId == null ? `nome:${corretor.toLocaleLowerCase("pt-BR")}` : `id:${corretorId}`;
    const atual = grupos.get(chave) ?? {
      chave, corretorId, corretor, total: 0, haDoisDiasOuMais: 0, maisAntigaDias: null,
    };
    const dias = diasAguardandoResultado(item.data, referencia);
    atual.total += 1;
    if (dias != null) {
      if (dias >= 2) atual.haDoisDiasOuMais += 1;
      atual.maisAntigaDias = atual.maisAntigaDias == null ? dias : Math.max(atual.maisAntigaDias, dias);
    }
    grupos.set(chave, atual);
  }
  return [...grupos.values()].sort((a, b) =>
    b.haDoisDiasOuMais - a.haDoisDiasOuMais
    || (b.maisAntigaDias ?? -1) - (a.maisAntigaDias ?? -1)
    || b.total - a.total
    || a.corretor.localeCompare(b.corretor, "pt-BR"));
}
