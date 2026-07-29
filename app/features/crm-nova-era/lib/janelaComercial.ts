/**
 * CRM Nova Era — JANELA COMERCIAL (Fase 3 correção; puro).
 * ------------------------------------------------------------------
 * Timezone America/Sao_Paulo (offset FIXO -180; o Brasil está sem horário de
 * verão — configurável em cfg.tzOffsetMin). Feriados NÃO são tratados agora
 * (limitação documentada); dias úteis default = seg..sex. Serve para modelar
 * "próximo período comercial / manhã do dia seguinte" sem sobreposição.
 */

export interface JanelaComercialConfig {
  tzOffsetMin: number;   // America/Sao_Paulo = -180
  inicioMin: number;     // minutos desde 00:00 local (ex.: 9*60)
  fimMin: number;        // minutos desde 00:00 local (ex.: 18*60)
  diasUteis: number[];   // 0=dom .. 6=sáb
}

export const JANELA_COMERCIAL_PADRAO: JanelaComercialConfig = {
  tzOffsetMin: -180,
  inicioMin: 9 * 60,     // 09:00
  fimMin: 18 * 60,       // 18:00
  diasUteis: [1, 2, 3, 4, 5],
};

interface PartesLocais { y: number; mo: number; d: number; minDia: number; dow: number; }

function partesLocais(iso: string, cfg: JanelaComercialConfig): PartesLocais | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const local = new Date(t + cfg.tzOffsetMin * 60000);
  return {
    y: local.getUTCFullYear(), mo: local.getUTCMonth(), d: local.getUTCDate(),
    minDia: local.getUTCHours() * 60 + local.getUTCMinutes(), dow: local.getUTCDay(),
  };
}

/** ISO (UTC) correspondente a um horário LOCAL (ano/mês/dia + minutos do dia). */
function localParaISO(y: number, mo: number, d: number, minDia: number, cfg: JanelaComercialConfig): string {
  const utcMs = Date.UTC(y, mo, d, Math.floor(minDia / 60), minDia % 60) - cfg.tzOffsetMin * 60000;
  return new Date(utcMs).toISOString();
}

export function ehDiaUtil(iso: string, cfg: JanelaComercialConfig = JANELA_COMERCIAL_PADRAO): boolean {
  const p = partesLocais(iso, cfg);
  return !!p && cfg.diasUteis.includes(p.dow);
}

export function dentroDaJanelaComercial(iso: string, cfg: JanelaComercialConfig = JANELA_COMERCIAL_PADRAO): boolean {
  const p = partesLocais(iso, cfg);
  if (!p) return false;
  return cfg.diasUteis.includes(p.dow) && p.minDia >= cfg.inicioMin && p.minDia <= cfg.fimMin;
}

function inicioDoDia(y: number, mo: number, d: number, cfg: JanelaComercialConfig): string {
  return localParaISO(y, mo, d, cfg.inicioMin, cfg);
}

/** Avança N dias de calendário local a partir de (y,mo,d). */
function somaDias(y: number, mo: number, d: number, n: number): { y: number; mo: number; d: number } {
  const base = new Date(Date.UTC(y, mo, d));
  base.setUTCDate(base.getUTCDate() + n);
  return { y: base.getUTCFullYear(), mo: base.getUTCMonth(), d: base.getUTCDate() };
}

/**
 * Próximo INÍCIO de janela comercial >= iso:
 *  - dia útil e antes do início → hoje no início;
 *  - dia útil e dentro/fim → hoje (o próprio horário, ainda comercial) OU, se após o fim,
 *    o próximo dia útil no início;
 *  - dia não útil → próximo dia útil no início.
 */
export function proximaJanelaComercial(iso: string, cfg: JanelaComercialConfig = JANELA_COMERCIAL_PADRAO): string {
  const p = partesLocais(iso, cfg);
  if (!p) return iso;
  if (cfg.diasUteis.includes(p.dow)) {
    if (p.minDia < cfg.inicioMin) return inicioDoDia(p.y, p.mo, p.d, cfg);
    if (p.minDia <= cfg.fimMin) return iso; // já dentro da janela
  }
  // avança para o próximo dia útil no início
  let { y, mo, d } = p;
  for (let i = 0; i < 8; i++) {
    ({ y, mo, d } = somaDias(y, mo, d, 1));
    const dow = new Date(Date.UTC(y, mo, d)).getUTCDay();
    if (cfg.diasUteis.includes(dow)) return inicioDoDia(y, mo, d, cfg);
  }
  return inicioDoDia(y, mo, d, cfg);
}

/**
 * INÍCIO da manhã comercial do PRÓXIMO dia útil ESTRITAMENTE após o dia local de `iso`.
 * Usado por T4 ("próximo período comercial / manhã do dia seguinte").
 */
export function proximaManhaComercialSeguinte(iso: string, cfg: JanelaComercialConfig = JANELA_COMERCIAL_PADRAO): string {
  const p = partesLocais(iso, cfg);
  if (!p) return iso;
  let { y, mo, d } = p;
  for (let i = 0; i < 8; i++) {
    ({ y, mo, d } = somaDias(y, mo, d, 1));
    const dow = new Date(Date.UTC(y, mo, d)).getUTCDay();
    if (cfg.diasUteis.includes(dow)) return inicioDoDia(y, mo, d, cfg);
  }
  return inicioDoDia(y, mo, d, cfg);
}
