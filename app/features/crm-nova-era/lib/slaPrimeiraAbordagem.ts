// SLA de cinco minutos da primeira abordagem.
//
// O relogio comeca na distribuicao valida e para quando o D-API confirma o
// outbound do corretor. Abrir o WhatsApp NAO para o relogio: e so intencao.

export type EstadoSla =
  | "chame_agora"
  | "prazo_terminando"
  | "atrasado"
  | "aguardando_confirmacao"
  | "confirmado"
  | "nao_se_aplica";

export type MotivoNaoSeAplica =
  | "telefone_invalido" | "negocio_cancelado" | "corretor_substituido"
  | "falha_distribuicao" | "canal_indisponivel" | "fora_da_janela";

export type EntradaSla = {
  distribuidoEm: string | Date | null;
  confirmadoEm?: string | Date | null;
  whatsappAbertoEm?: string | Date | null;
  agora?: Date;
  motivoNaoSeAplica?: MotivoNaoSeAplica | null;
};

export type SaidaSla = {
  estado: EstadoSla;
  minutos: number;
  rotulo: string;
  urgencia: 0 | 1 | 2 | 3;
};

export const LIMITE_LEMBRETE_MIN = 3;
export const LIMITE_ATRASO_MIN = 5;

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Diferenca em minutos, nunca negativa. */
export function minutosEntre(inicio: Date, fim: Date): number {
  return Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 60000));
}

function rotuloDuracao(min: number): string {
  if (min <= 0) return "agora";
  if (min === 1) return "1 minuto";
  if (min < 60) return `${min} minutos`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

const ROTULO_NAO_SE_APLICA: Record<MotivoNaoSeAplica, string> = {
  telefone_invalido: "Telefone invalido — corrija o cadastro",
  negocio_cancelado: "Negocio cancelado",
  corretor_substituido: "Corretor foi trocado",
  falha_distribuicao: "Falha na distribuicao",
  canal_indisponivel: "WhatsApp indisponivel",
  fora_da_janela: "Fora do horario comercial",
};

/** Puro: recebe 'agora' para ser testavel. */
export function calcularSla(e: EntradaSla): SaidaSla {
  const agora = e.agora ?? new Date();
  const distribuido = paraData(e.distribuidoEm);
  const confirmado = paraData(e.confirmadoEm);
  const aberto = paraData(e.whatsappAbertoEm);

  if (e.motivoNaoSeAplica) {
    return { estado: "nao_se_aplica", minutos: 0, rotulo: ROTULO_NAO_SE_APLICA[e.motivoNaoSeAplica], urgencia: 0 };
  }
  if (!distribuido) {
    return { estado: "nao_se_aplica", minutos: 0, rotulo: "Sem data de distribuicao", urgencia: 0 };
  }
  if (confirmado) {
    const min = minutosEntre(distribuido, confirmado);
    return { estado: "confirmado", minutos: min, rotulo: `Abordado em ${rotuloDuracao(min)}`, urgencia: 0 };
  }

  const min = minutosEntre(distribuido, agora);

  if (aberto) {
    return {
      estado: "aguardando_confirmacao", minutos: min,
      rotulo: "Aguardando confirmacao do WhatsApp",
      urgencia: min > LIMITE_ATRASO_MIN ? 2 : 1,
    };
  }
  if (min > LIMITE_ATRASO_MIN) {
    return { estado: "atrasado", minutos: min, rotulo: `Atrasado ha ${rotuloDuracao(min - LIMITE_ATRASO_MIN)}`, urgencia: 3 };
  }
  if (min >= LIMITE_LEMBRETE_MIN) {
    return { estado: "prazo_terminando", minutos: min, rotulo: "Prazo terminando", urgencia: 2 };
  }
  return { estado: "chame_agora", minutos: min, rotulo: "Chame agora", urgencia: 1 };
}
