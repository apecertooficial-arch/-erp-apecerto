/* Regras puras da agenda do celular.
 *
 * Em .ts porque o runner de teste usa strip-types do node, que não entende JSX.
 */

export type Compromisso = {
  id: string;
  hora: string;            // "11:30"
  tipo: string;            // "visita", "visita com gerente"
  cliente: string;
  local: string | null;
  produto: string | null;
  negocio_id: number | null;
  status: string | null;
  faltam_min: number;      // negativo = já passou
};

/**
 * O próximo compromisso é o primeiro que AINDA NÃO começou.
 *
 * Se todos já passaram, devolve null em vez do último: o cartão de destaque
 * diz "próximo", e apontar para algo que já aconteceu seria mentira na tela.
 */
export function proximo(itens: Compromisso[]): Compromisso | null {
  const futuros = itens.filter((i) => i.faltam_min >= 0).sort((a, b) => a.faltam_min - b.faltam_min);
  return futuros[0] ?? null;
}

/** "em 26 min", "em 2 h", "agora". Nunca em horário absoluto: o corretor
 *  quer saber quanto tempo tem, não que horas são. */
export function quandoComeca(faltamMin: number): string {
  const m = Math.round(faltamMin);
  if (m <= 0) return "agora";
  if (m < 60) return `em ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `em ${h} h`;
  return `em ${Math.round(h / 24)} d`;
}

/** "sexta, 31 de julho" — minúscula, como no protótipo. */
export function diaPorExtenso(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace("-feira", "")
    .toLowerCase();
}

/** Soma dias a uma data ISO sem passar por fuso — o dia é o dia. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export const hojeISO = (agora: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);

/** "4 compromissos" / "1 compromisso" / "nada marcado". */
export function resumoDoDia(total: number): string {
  if (total === 0) return "nada marcado";
  return `${total} ${total === 1 ? "compromisso" : "compromissos"}`;
}

/** Passou da hora e ninguém encerrou: o ponto da linha do tempo fica apagado. */
export const jaPassou = (c: Compromisso) => c.faltam_min < 0;
