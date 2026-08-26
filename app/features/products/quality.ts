export const PRODUCT_PRICE_MIN = 100_000;
export const PRODUCT_PRICE_MAX = 100_000_000;
export const RENT_PRICE_MIN = 500;
export const RENT_PRICE_MAX = 500_000;
export const PRODUCT_PRICE_PER_M2_MIN = 3_000;
export const PRODUCT_PRICE_PER_M2_MAX = 100_000;
export const RENT_PRICE_PER_M2_MIN = 10;
export const RENT_PRICE_PER_M2_MAX = 2_000;

export type QualityLevel = "excelente" | "bom" | "atencao" | "critico";

export type QualityDimension = {
  score: number;
  max: number;
};

export type ProductQuality = {
  score: number;
  level: QualityLevel;
  label: string;
  readyForSite: boolean;
  blocking: string[];
  warnings: string[];
  dimensions: {
    cadastro: QualityDimension;
    apresentacao: QualityDimension;
    comercial: QualityDimension;
    site: QualityDimension;
  };
};

export type ProductQualityInput = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  purpose?: unknown;
  slogan?: unknown;
  price?: number | null;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  address?: unknown;
  number?: unknown;
  neighborhood?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  condominiumFee?: number | null;
  propertyTax?: number | null;
  otherCosts?: number | null;
  photos?: number;
  videos?: number;
  hasCover?: boolean;
  mediaCategories?: string[];
  tourUrl?: unknown;
  units?: number;
  availableUnits?: number;
  unitsWithValidPrice?: number;
  amenities?: unknown[] | null;
  differentiators?: unknown[] | null;
};

export type ProductPricePerSquareMeterValidation = {
  value: number | null;
  min: number;
  max: number;
  plausible: boolean | null;
  direction: "below" | "above" | null;
  error: string | null;
};

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const textLength = (value: unknown) => (typeof value === "string" ? value.trim().length : 0);
const isKnownNumber = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value);
const isPositive = (value: number | null | undefined) => isKnownNumber(value) && Number(value) > 0;
function isRentalPurpose(purpose: unknown) {
  return normalizedKey(purpose) === "aluguel";
}

export function productPriceBounds(purpose?: unknown) {
  return isRentalPurpose(purpose)
    ? { min: RENT_PRICE_MIN, max: RENT_PRICE_MAX, rental: true }
    : { min: PRODUCT_PRICE_MIN, max: PRODUCT_PRICE_MAX, rental: false };
}

export function productPricePerSquareMeterBounds(purpose?: unknown) {
  return isRentalPurpose(purpose)
    ? { min: RENT_PRICE_PER_M2_MIN, max: RENT_PRICE_PER_M2_MAX, rental: true }
    : { min: PRODUCT_PRICE_PER_M2_MIN, max: PRODUCT_PRICE_PER_M2_MAX, rental: false };
}

export function isPlausibleProductPrice(value: number | null | undefined, purpose?: unknown) {
  const bounds = productPriceBounds(purpose);
  return isKnownNumber(value) && Number(value) >= bounds.min && Number(value) <= bounds.max;
}

function formatPricePerSquareMeter(value: number) {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}/m²`;
}

/**
 * Cruza preço total e área útil usando a faixa comercial já adotada pela nota.
 * Retorna `plausible: null` quando preço ou área já são inválidos por si só;
 * nesses casos a checagem básica produz uma orientação mais precisa.
 */
export function validateProductPricePerSquareMeter(
  price: number | null | undefined,
  area: number | null | undefined,
  field = "Imóvel",
  purpose?: unknown,
): ProductPricePerSquareMeterValidation {
  const bounds = productPricePerSquareMeterBounds(purpose);
  if (!isPlausibleProductPrice(price, purpose) || !isPositive(area)) {
    return { value: null, min: bounds.min, max: bounds.max, plausible: null, direction: null, error: null };
  }

  const value = Number(price) / Number(area);
  const direction = value < bounds.min ? "below" : value > bounds.max ? "above" : null;
  if (!direction) {
    return { value, min: bounds.min, max: bounds.max, plausible: true, direction: null, error: null };
  }

  const position = direction === "below" ? "abaixo" : "acima";
  const operation = bounds.rental ? "aluguel" : "venda";
  return {
    value,
    min: bounds.min,
    max: bounds.max,
    plausible: false,
    direction,
    error: `${field}: ${formatPricePerSquareMeter(value)} está ${position} da faixa plausível para ${operation} (${formatPricePerSquareMeter(bounds.min)} a ${formatPricePerSquareMeter(bounds.max)}). Revise o preço total e a área útil.`,
  };
}

export function assessProductQuality(input: ProductQualityInput): ProductQuality {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const descriptionLength = textLength(input.description);
  const photos = Math.max(0, Number(input.photos || 0));
  const videos = Math.max(0, Number(input.videos || 0));
  const units = Math.max(0, Number(input.units || 0));
  const availableUnits = Math.max(0, Number(input.availableUnits || 0));
  const validUnitPrices = Math.max(0, Number(input.unitsWithValidPrice || 0));
  const categories = new Set((input.mediaCategories || []).filter(Boolean).map((item) => item.toLowerCase()));
  const hasAmenities = Boolean(input.amenities?.length);
  const hasDifferentiators = Boolean(input.differentiators?.length);
  const priceBounds = productPriceBounds(input.purpose);
  const plausiblePrice = isPlausibleProductPrice(input.price, input.purpose);
  const pricePerSquareMeterCheck = validateProductPricePerSquareMeter(input.price, input.area, "Imóvel", input.purpose);

  let cadastro = 0;
  if (hasText(input.name)) cadastro += 5;
  if (descriptionLength >= 120) cadastro += 8;
  else if (descriptionLength >= 80) cadastro += 5;
  else if (descriptionLength > 0) cadastro += 2;
  if (hasText(input.address)) cadastro += 3;
  if (hasText(input.neighborhood)) cadastro += 2;
  if (hasText(input.city)) cadastro += 2;
  if (hasText(input.state)) cadastro += 1;
  if (hasText(input.number) || hasText(input.zip)) cadastro += 2;
  if (isPositive(input.area)) cadastro += 4;
  if (isKnownNumber(input.bedrooms)) cadastro += 1;
  if (isKnownNumber(input.bathrooms)) cadastro += 2;
  if (isKnownNumber(input.parking)) cadastro += 1;
  if (hasText(input.purpose)) cadastro += 4;
  cadastro = Math.min(35, cadastro);

  let apresentacao = photos >= 10 ? 12 : photos >= 6 ? 8 : photos > 0 ? 3 : 0;
  if (input.hasCover) apresentacao += 6;
  if (categories.size >= 5) apresentacao += 5;
  else if (categories.size >= 3) apresentacao += 3;
  if (videos > 0 || hasText(input.tourUrl)) apresentacao += 4;
  if (hasAmenities || hasDifferentiators) apresentacao += 3;
  apresentacao = Math.min(30, apresentacao);

  let comercial = 0;
  if (plausiblePrice) comercial += 8;
  if (pricePerSquareMeterCheck.plausible) comercial += 4;
  if (isKnownNumber(input.condominiumFee)) comercial += 2;
  if (isKnownNumber(input.propertyTax)) comercial += 1;
  if (isKnownNumber(input.otherCosts)) comercial += 1;
  if (availableUnits > 0 && (validUnitPrices > 0 || plausiblePrice)) comercial += 4;
  comercial = Math.min(20, comercial);

  let site = 0;
  if (hasText(input.title)) site += 4;
  if (hasText(input.slogan)) site += 3;
  if (descriptionLength >= 120) site += 3;
  if (hasText(input.purpose)) site += 2;
  if (hasText(input.zip)) site += 1;
  if (hasDifferentiators) site += 2;
  site = Math.min(15, site);

  if (!plausiblePrice) blocking.push(priceBounds.rental
    ? "Corrigir o aluguel mensal (use o valor total em reais)"
    : "Corrigir o preço (use o valor total em reais)");
  if (!isPositive(input.area)) blocking.push("Informar a área útil");
  if (pricePerSquareMeterCheck.error) blocking.push(pricePerSquareMeterCheck.error);
  if (!hasText(input.address) || !hasText(input.neighborhood) || !hasText(input.city)) blocking.push("Completar a localização");
  if (descriptionLength < 80) blocking.push("Escrever uma descrição com pelo menos 80 caracteres");
  if (photos < 6) blocking.push("Adicionar pelo menos 6 fotos");
  if (!input.hasCover) blocking.push("Definir a foto de capa");
  if (!hasText(input.purpose)) blocking.push("Informar a finalidade do imóvel");
  if (units === 0 || availableUnits === 0) blocking.push("Cadastrar ao menos uma unidade disponível");
  if (availableUnits > 0 && validUnitPrices === 0 && !plausiblePrice) blocking.push("Corrigir o preço da unidade disponível");

  if (!hasText(input.title)) warnings.push("Criar um título comercial para o site");
  if (!hasText(input.slogan)) warnings.push("Adicionar uma chamada curta para o site");
  if (photos < 10) warnings.push("Chegar a 10 fotos aumenta a força do anúncio");
  if (categories.size < 3) warnings.push("Classificar fotos por ambiente");
  if (videos === 0 && !hasText(input.tourUrl)) warnings.push("Adicionar vídeo ou tour virtual");
  if (!hasAmenities) warnings.push("Informar lazer e áreas comuns");
  if (!hasDifferentiators) warnings.push("Informar os diferenciais do imóvel");
  if (!isKnownNumber(input.condominiumFee) || !isKnownNumber(input.propertyTax)) warnings.push("Completar condomínio e IPTU, mesmo quando o valor for zero");

  const score = Math.max(0, Math.min(100, cadastro + apresentacao + comercial + site));
  const level: QualityLevel = score >= 90 ? "excelente" : score >= 75 ? "bom" : score >= 60 ? "atencao" : "critico";
  const label = level === "excelente" ? "Excelente" : level === "bom" ? "Bom" : level === "atencao" ? "Atenção" : "Crítico";

  return {
    score,
    level,
    label,
    readyForSite: blocking.length === 0 && score >= 80,
    blocking,
    warnings,
    dimensions: {
      cadastro: { score: cadastro, max: 35 },
      apresentacao: { score: apresentacao, max: 30 },
      comercial: { score: comercial, max: 20 },
      site: { score: site, max: 15 },
    },
  };
}

export function parseLocalizedNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateProductPrice(value: unknown, field = "Preço", purpose?: unknown) {
  const price = parseLocalizedNumber(value);
  if (price === null) return { value: null, error: `${field} inválido.` };
  const bounds = productPriceBounds(purpose);
  if (price < bounds.min) {
    return { value: price, error: bounds.rental
      ? `${field} muito baixo para um aluguel mensal.`
      : `${field} muito baixo. Se digitou em milhares, 710 deve representar R$ 710.000.` };
  }
  if (price > bounds.max) return { value: price, error: bounds.rental
    ? `${field} acima do limite de R$ 500 mil por mês.`
    : `${field} acima do limite de R$ 100 milhões.` };
  return { value: price, error: null };
}

export function normalizeProductText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function normalizedKey(value: unknown) {
  return normalizeProductText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
