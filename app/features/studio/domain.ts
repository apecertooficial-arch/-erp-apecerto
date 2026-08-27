export const STUDIO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
export const STUDIO_TIMEZONE = "America/Sao_Paulo";

export type StudioFormat = "feed" | "carousel" | "story" | "reel";
export type StudioTab = "visao" | "campanhas" | "workspace" | "calendario" | "configuracoes";

export type StudioCampaign = {
  id: string;
  nome: string;
  objetivo: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  produto_codigo: string | null;
  produto_alterado_em: string | null;
  produto_alterado_motivo: string | null;
  snapshot_atual_id: string | null;
  budget_usd: number;
  gasto_usd: number;
  atualizado_em: string;
};

export type StudioSnapshot = {
  id: string;
  campaign_id: string;
  versao: number;
  produto_codigo: string;
  fatos: Record<string, unknown>;
  midias: Array<Record<string, unknown>>;
  checksum: string;
  criado_em: string;
  change_scope?: string | null;
  parent_version_id?: string | null;
};

export type StudioPiece = {
  id: string;
  campaign_id: string;
  formato: StudioFormat;
  titulo: string;
  status: string;
  current_version_id: string | null;
  atualizado_em: string;
};

export type StudioPieceVersion = {
  id: string;
  piece_id: string;
  versao: number;
  snapshot_id: string;
  template_version_id: string | null;
  conteudo: Record<string, unknown>;
  output_manifest: Record<string, unknown>;
  checksum: string;
  criado_em: string;
};

export type StudioSchedule = {
  id: string;
  piece_version_id: string;
  canal: "instagram";
  agendado_para: string;
  timezone: typeof STUDIO_TIMEZONE;
  status: string;
  conflito: boolean;
};

export type StudioIntegration = {
  provider: "figma" | "openai" | "instagram" | "renderer";
  status: "nao_configurada" | "configurada" | "degradada" | "expirada" | "desativada";
  config_publica: Record<string, unknown>;
  verificado_em: string | null;
};

export type StudioJob = {
  id: string;
  campaign_id: string | null;
  piece_id: string | null;
  tipo: string;
  status: string;
  progresso: number;
  tentativas: number;
  max_tentativas: number;
  erro_mensagem: string | null;
  criado_em: string;
};

export type StudioData = {
  organizationId: string;
  timezone: typeof STUDIO_TIMEZONE;
  campaigns: StudioCampaign[];
  snapshots: StudioSnapshot[];
  pieces: StudioPiece[];
  versions: StudioPieceVersion[];
  schedules: StudioSchedule[];
  jobs: StudioJob[];
  integrations: StudioIntegration[];
  budgets: Array<{ provider: string; limite_usd: number; consumido_usd: number }>;
  briefs: StudioBrief[];
  templates: StudioTemplate[];
  setupRequired?: boolean;
};

export type StudioBrief = {
  id: string;
  campaign_id: string;
  versao: number;
  publico: Record<string, unknown>;
  tom: string;
  canais: string[];
  restricoes_factuais: string[];
  conteudo: Record<string, unknown>;
  criado_em: string;
};

export type StudioTemplate = {
  id: string;
  slug: string;
  nome: string;
  formato: StudioFormat;
  ativo: boolean;
  versao_publicada?: number;
  origem?: string;
  manifesto?: Record<string, unknown>;
};

export type GeneratedPiece = {
  formato: StudioFormat;
  titulo: string;
  headline: string;
  legenda: string;
  cta: string;
  slides?: Array<{ titulo: string; texto: string; media_index?: number }>;
  stories?: Array<{ titulo: string; texto: string; media_index?: number }>;
  cenas?: Array<{ duracao_segundos: number; texto_tela: string; media_index?: number; locucao?: string }>;
  alertas_factuais: string[];
};

export type GeneratedPackage = {
  estrategia: {
    objetivo: string;
    publico: string;
    etapa_funil: string;
    angulo_editorial: string;
    pilares: string[];
  };
  pecas: GeneratedPiece[];
  alertas_factuais: string[];
};

const formats = new Set<StudioFormat>(["feed", "carousel", "story", "reel"]);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const shortText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function validateGeneratedPackage(value: unknown): GeneratedPackage {
  if (!object(value) || !object(value.estrategia) || !Array.isArray(value.pecas)) {
    throw new Error("A IA devolveu uma estrutura inválida.");
  }
  const pieces = value.pecas.slice(0, 16).map((entry) => {
    if (!object(entry) || !formats.has(entry.formato as StudioFormat)) throw new Error("A IA devolveu uma peça com formato inválido.");
    const titulo = shortText(entry.titulo, 160);
    const headline = shortText(entry.headline, 120);
    const legenda = shortText(entry.legenda, 2200);
    const cta = shortText(entry.cta, 80);
    if (!titulo || !headline || !legenda || !cta) throw new Error("A IA deixou campos obrigatórios vazios.");
    const rows = (key: "slides" | "stories" | "cenas") => Array.isArray(entry[key])
      ? entry[key].slice(0, 20).filter(object).map((row) => ({
        titulo: shortText(row.titulo, 100),
        texto: shortText(row.texto, 500),
        texto_tela: shortText(row.texto_tela, 180),
        locucao: shortText(row.locucao, 600) || undefined,
        duracao_segundos: Math.max(1, Math.min(15, Number(row.duracao_segundos) || 3)),
        media_index: Number.isInteger(Number(row.media_index)) ? Number(row.media_index) : undefined,
      })) : undefined;
    return {
      formato: entry.formato as StudioFormat,
      titulo,
      headline,
      legenda,
      cta,
      slides: rows("slides")?.map(({ titulo: t, texto, media_index }) => ({ titulo: t, texto, media_index })),
      stories: rows("stories")?.map(({ titulo: t, texto, media_index }) => ({ titulo: t, texto, media_index })),
      cenas: rows("cenas")?.map(({ texto_tela, locucao, duracao_segundos, media_index }) => ({ texto_tela, locucao, duracao_segundos, media_index })),
      alertas_factuais: Array.isArray(entry.alertas_factuais) ? entry.alertas_factuais.map((item) => shortText(item, 300)).filter(Boolean).slice(0, 20) : [],
    } satisfies GeneratedPiece;
  });
  const present = new Set(pieces.map((piece) => piece.formato));
  for (const format of formats) if (!present.has(format)) throw new Error(`A IA não devolveu o formato obrigatório: ${format}.`);
  const strategy = value.estrategia;
  return {
    estrategia: {
      objetivo: shortText(strategy.objetivo, 500),
      publico: shortText(strategy.publico, 500),
      etapa_funil: shortText(strategy.etapa_funil, 100),
      angulo_editorial: shortText(strategy.angulo_editorial, 500),
      pilares: Array.isArray(strategy.pilares) ? strategy.pilares.map((item) => shortText(item, 160)).filter(Boolean).slice(0, 8) : [],
    },
    pecas: pieces,
    alertas_factuais: Array.isArray(value.alertas_factuais) ? value.alertas_factuais.map((item) => shortText(item, 300)).filter(Boolean).slice(0, 30) : [],
  };
}

export type TemplateManifest = {
  schema_version: 1;
  slug: string;
  nome: string;
  formato: StudioFormat;
  width: number;
  height: number;
  source: { type: "figma" | "design_system"; file_key?: string; node_id?: string };
  fonts: string[];
  assets: Array<{ key: string; uri: string; checksum?: string }>;
  slots: Array<{ key: string; type: "texto" | "imagem" | "video" | "logo" | "grafismo"; required: boolean; limits?: Record<string, unknown>; rules?: Record<string, unknown> }>;
};

export function validateTemplateManifest(value: unknown): TemplateManifest {
  if (!object(value) || value.schema_version !== 1 || !formats.has(value.formato as StudioFormat) || !object(value.source) || !Array.isArray(value.slots)) {
    throw new Error("Manifesto inválido ou incompatível.");
  }
  const slug = shortText(value.slug, 80).toLowerCase();
  const name = shortText(value.nome, 160);
  const width = Number(value.width), height = Number(value.height);
  const expectedHeight = value.formato === "story" || value.formato === "reel" ? 1920 : 1350;
  if (!/^[a-z0-9-]{2,80}$/.test(slug) || !name || width !== 1080 || height !== expectedHeight) {
    throw new Error("Slug, nome ou dimensões do manifesto são inválidos.");
  }
  const fileKey = shortText(value.source.file_key, 160), nodeId = shortText(value.source.node_id, 160);
  if (value.source.type === "figma" && (!fileKey || !nodeId)) throw new Error("Manifesto Figma sem arquivo ou node de origem.");
  const fonts = Array.isArray(value.fonts) && value.fonts.length ? value.fonts.map((font) => shortText(font, 80)).filter(Boolean) : ["Quicksand"];
  if (fonts.some((font) => font.toLowerCase() !== "quicksand")) throw new Error("O template usa uma fonte fora do Design System oficial.");
  const assets = Array.isArray(value.assets) ? value.assets.slice(0, 30).map((entry) => {
    if (!object(entry)) throw new Error("Asset de template inválido.");
    const key = shortText(entry.key, 80), uri = shortText(entry.uri, 500), checksum = shortText(entry.checksum, 64);
    if (!/^[a-z][a-z0-9_]{1,80}$/.test(key) || !uri || (checksum && !/^[a-f0-9]{64}$/.test(checksum))) throw new Error(`Asset inválido: ${key || "sem chave"}.`);
    return { key, uri, checksum: checksum || undefined };
  }) : [];
  const allowedSlot = new Set(["texto", "imagem", "video", "logo", "grafismo"]);
  const seen = new Set<string>();
  const slots = value.slots.map((entry) => {
    if (!object(entry)) throw new Error("Slot inválido.");
    const key = shortText(entry.key, 80);
    const type = shortText(entry.type, 20) as TemplateManifest["slots"][number]["type"];
    if (!/^[a-z][a-z0-9_]{1,80}$/.test(key) || seen.has(key) || !allowedSlot.has(type)) throw new Error(`Slot inválido ou duplicado: ${key || "sem chave"}.`);
    seen.add(key);
    return { key, type, required: entry.required !== false, limits: object(entry.limits) ? entry.limits : {}, rules: object(entry.rules) ? entry.rules : {} };
  });
  if (!slots.length) throw new Error("O template precisa ter pelo menos um slot.");
  const requiredKeys = new Set(slots.map((slot) => slot.key));
  for (const required of ["imagem_principal", "headline", "cta", "logo"]) if (!requiredKeys.has(required)) throw new Error(`O template não possui o slot obrigatório: ${required}.`);
  return {
    schema_version: 1,
    slug,
    nome: name,
    formato: value.formato as StudioFormat,
    width,
    height,
    source: {
      type: value.source.type === "figma" ? "figma" : "design_system",
      file_key: fileKey || undefined,
      node_id: nodeId || undefined,
    },
    fonts,
    assets,
    slots,
  };
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
