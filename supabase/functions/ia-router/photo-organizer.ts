export const PHOTO_ORGANIZER_ACTION = "organizar_fotos_produto";
export const PHOTO_ORGANIZER_MAX_IMAGES = 20;

export const PHOTO_CATEGORIES = [
  "Fachada",
  "Sala",
  "Cozinha",
  "Dormitório",
  "Suíte",
  "Banheiro",
  "Varanda",
  "Piscina",
  "Lazer",
  "Planta",
  "Vista",
  "Outros",
] as const;

export const PHOTO_WARNINGS = [
  "nenhum",
  "qualidade_ruim",
  "duplicada",
  "ambiente_incerto",
  "nao_representa_imovel",
] as const;

export type PhotoSuggestion = {
  token: string;
  category: typeof PHOTO_CATEGORIES[number];
  sort_order: number;
  is_cover: boolean;
  display_name: string;
  alt_text: string;
  warning: typeof PHOTO_WARNINGS[number];
  warning_detail: string;
  confidence: number;
};

export type PhotoOrganizerOutput = { suggestions: PhotoSuggestion[] };

type PhotoInput = {
  token: string;
  category: string | null;
  dataUrl: string;
};

const CATEGORY_SET = new Set<string>(PHOTO_CATEGORIES);
const WARNING_SET = new Set<string>(PHOTO_WARNINGS);
const PROPERTY_TYPES = new Map([
  ["apartamento", "apartamento"],
  ["apartamento pronto", "apartamento pronto"],
  ["studio", "studio"],
  ["cobertura", "cobertura"],
  ["casa", "casa"],
  ["sala comercial", "sala comercial"],
  ["terreno", "terreno"],
  ["lançamento", "apartamento em lançamento"],
  ["lancamento", "apartamento em lançamento"],
  ["remanescente", "apartamento remanescente"],
]);

export function sanitizeCurrentCategory(value: unknown): string | null {
  return typeof value === "string" && CATEGORY_SET.has(value) ? value : null;
}

export function normalizePropertyType(value: unknown): string {
  if (typeof value !== "string") return "imóvel residencial";
  return PROPERTY_TYPES.get(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase())
    ?? PROPERTY_TYPES.get(value.trim().toLowerCase())
    ?? "imóvel residencial";
}

export function photoOrganizerSchema(tokens: string[]) {
  return {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        minItems: tokens.length,
        maxItems: tokens.length,
        items: {
          type: "object",
          properties: {
            token: { type: "string", enum: tokens },
            category: { type: "string", enum: [...PHOTO_CATEGORIES] },
            sort_order: { type: "integer", minimum: 0, maximum: tokens.length - 1 },
            is_cover: { type: "boolean" },
            display_name: { type: "string", minLength: 3, maxLength: 120 },
            alt_text: { type: "string", minLength: 3, maxLength: 220 },
            warning: { type: "string", enum: [...PHOTO_WARNINGS] },
            warning_detail: { type: "string", maxLength: 180 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: [
            "token",
            "category",
            "sort_order",
            "is_cover",
            "display_name",
            "alt_text",
            "warning",
            "warning_detail",
            "confidence",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["suggestions"],
    additionalProperties: false,
  } as const;
}

export function buildPhotoOrganizerRequest(input: {
  model: string;
  propertyType: string;
  photos: PhotoInput[];
}) {
  const tokens = input.photos.map((photo) => photo.token);
  const content: Array<Record<string, unknown>> = [{
    type: "input_text",
    text: [
      "Organize somente as imagens recebidas para uma galeria imobiliária.",
      `Tipo genérico do imóvel: ${input.propertyType || "imóvel residencial"}.`,
      "Para cada token, sugira categoria, ordem comercial, uma única capa, nome semântico e texto alternativo objetivo.",
      "Sinalize foto ruim, duplicada, incerta ou que não represente claramente o imóvel.",
      "Não invente cômodos, características, localização, endereço, preço, proprietário ou conteúdo de SEO.",
      "Use somente o que estiver visualmente evidente.",
    ].join("\n"),
  }];
  for (const photo of input.photos) {
    content.push({
      type: "input_text",
      text: `Imagem ${photo.token}. Categoria atual: ${photo.category || "não classificada"}.`,
    });
    content.push({ type: "input_image", image_url: photo.dataUrl, detail: "low" });
  }
  return {
    model: input.model,
    store: false,
    background: false,
    max_output_tokens: Math.min(6000, 500 + input.photos.length * 260),
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "apecerto_photo_organization",
        strict: true,
        schema: photoOrganizerSchema(tokens),
      },
    },
  };
}

export function validatePhotoOrganizerOutput(
  value: unknown,
  tokens: string[],
): PhotoOrganizerOutput | null {
  if (!value || typeof value !== "object") return null;
  const suggestions = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions) || suggestions.length !== tokens.length) return null;
  const allowedTokens = new Set(tokens);
  const seenTokens = new Set<string>();
  const seenOrders = new Set<number>();
  let covers = 0;
  const normalized: PhotoSuggestion[] = [];
  for (const raw of suggestions) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.token !== "string" || !allowedTokens.has(item.token) || seenTokens.has(item.token)) return null;
    if (typeof item.category !== "string" || !CATEGORY_SET.has(item.category)) return null;
    if (!Number.isInteger(item.sort_order) || (item.sort_order as number) < 0 || (item.sort_order as number) >= tokens.length || seenOrders.has(item.sort_order as number)) return null;
    if (typeof item.is_cover !== "boolean") return null;
    if (typeof item.display_name !== "string" || item.display_name.trim().length < 3 || item.display_name.trim().length > 120) return null;
    if (typeof item.alt_text !== "string" || item.alt_text.trim().length < 3 || item.alt_text.trim().length > 220) return null;
    if (typeof item.warning !== "string" || !WARNING_SET.has(item.warning)) return null;
    if (typeof item.warning_detail !== "string" || item.warning_detail.length > 180) return null;
    if (typeof item.confidence !== "number" || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) return null;
    seenTokens.add(item.token);
    seenOrders.add(item.sort_order as number);
    if (item.is_cover) covers += 1;
    normalized.push({
      token: item.token,
      category: item.category as PhotoSuggestion["category"],
      sort_order: item.sort_order as number,
      is_cover: item.is_cover,
      display_name: item.display_name.trim(),
      alt_text: item.alt_text.trim(),
      warning: item.warning as PhotoSuggestion["warning"],
      warning_detail: item.warning_detail.trim(),
      confidence: item.confidence,
    });
  }
  if (covers !== 1) return null;
  return { suggestions: normalized.sort((a, b) => a.sort_order - b.sort_order) };
}

export function extractResponseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block && typeof block === "object" && (block as { type?: unknown }).type === "output_text" && typeof (block as { text?: unknown }).text === "string") {
        return (block as { text: string }).text;
      }
    }
  }
  return "";
}
