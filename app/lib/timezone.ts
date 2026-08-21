export const FUSO_OPERACAO = "America/Sao_Paulo";

type PartesDataHora = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

const formatadorPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_OPERACAO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partesNoFuso(data: Date): PartesDataHora | null {
  if (Number.isNaN(data.getTime())) return null;
  const partes = Object.fromEntries(
    formatadorPartes.formatToParts(data)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, Number(parte.value)]),
  );
  const resultado = {
    ano: partes.year,
    mes: partes.month,
    dia: partes.day,
    hora: partes.hour,
    minuto: partes.minute,
    segundo: partes.second,
  };
  return Object.values(resultado).every(Number.isFinite) ? resultado : null;
}

/**
 * Converte uma data/hora de parede da operação para um instante UTC.
 *
 * O cálculo usa o fuso IANA, e não um `-03:00` fixo. Assim o servidor pode
 * continuar em UTC (como recomenda o Supabase) sem interpretar 09:00 como
 * 09:00 UTC e devolver 06:00 no calendário.
 */
export function instanteSaoPaulo(data: string, hora: string): string | null {
  const dataMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const horaMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hora);
  if (!dataMatch || !horaMatch) return null;

  const desejado: PartesDataHora = {
    ano: Number(dataMatch[1]),
    mes: Number(dataMatch[2]),
    dia: Number(dataMatch[3]),
    hora: Number(horaMatch[1]),
    minuto: Number(horaMatch[2]),
    segundo: Number(horaMatch[3] ?? 0),
  };
  if (desejado.mes < 1 || desejado.mes > 12 || desejado.dia < 1 || desejado.dia > 31
      || desejado.hora > 23 || desejado.minuto > 59 || desejado.segundo > 59) return null;

  const paredeUtc = Date.UTC(
    desejado.ano, desejado.mes - 1, desejado.dia,
    desejado.hora, desejado.minuto, desejado.segundo,
  );
  let instante = paredeUtc;

  // Duas passagens cobrem inclusive uma eventual transição de horário legal.
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const exibido = partesNoFuso(new Date(instante));
    if (!exibido) return null;
    const exibidoComoUtc = Date.UTC(
      exibido.ano, exibido.mes - 1, exibido.dia,
      exibido.hora, exibido.minuto, exibido.segundo,
    );
    const proximo = instante + (paredeUtc - exibidoComoUtc);
    if (proximo === instante) break;
    instante = proximo;
  }

  const conferido = partesNoFuso(new Date(instante));
  if (!conferido || Object.keys(desejado).some((chave) =>
    conferido[chave as keyof PartesDataHora] !== desejado[chave as keyof PartesDataHora])) return null;
  return new Date(instante).toISOString();
}

/** Aceita ISO com fuso ou `datetime-local`, sempre normalizando para UTC. */
export function normalizarInstanteSaoPaulo(valor: string): string | null {
  const limpo = valor.trim();
  if (!limpo) return null;
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(limpo)) {
    const data = new Date(limpo);
    return Number.isNaN(data.getTime()) ? null : data.toISOString();
  }
  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(limpo);
  return local ? instanteSaoPaulo(local[1], local[2]) : null;
}

export function dataHoraLocalSaoPaulo(valor: string): string {
  const partes = partesNoFuso(new Date(valor));
  if (!partes) return "";
  const dois = (numero: number) => String(numero).padStart(2, "0");
  return `${partes.ano}-${dois(partes.mes)}-${dois(partes.dia)}T${dois(partes.hora)}:${dois(partes.minuto)}`;
}

export function dataIsoSaoPaulo(valor: string | Date): string {
  const partes = partesNoFuso(valor instanceof Date ? valor : new Date(valor));
  if (!partes) return "";
  return `${partes.ano}-${String(partes.mes).padStart(2, "0")}-${String(partes.dia).padStart(2, "0")}`;
}
