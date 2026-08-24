import type { ProductQuality } from "./quality";

export type Product = {
  id?: string;
  name: string;
  title?: string | null;
  slug?: string | null;
  purpose?: string | null;
  address?: string | null;
  price: string;
  neighborhood: string;
  city: string;
  status?: string;
  developer?: string | null;
  area: number;
  bedrooms: number;
  parking: number;
  available: number;
  leads: number;
  priceM2: string;
  units?: number;
  media?: number;
  unitMedia?: number;
  referenceMedia?: number;
  coverUrl?: string | null;
  draft?: boolean;
  origin?: string;
  standalone?: boolean;
  numericPrice?: number | null;
  favorite?: boolean;
  approval?: string;
  rejectionReason?: string | null;
  mine?: boolean;
  capturedBy?: string | null;
  capturedByScore?: number | null;
  codigo?: string | null;
  unitId?: string | null;
  segment?: "terceiros" | "lancamento" | "remanescente" | null;
  condominiumLinked?: boolean;
  quality?: ProductQuality;
  published?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  topIssue?: string | null;
};

function siteSlug(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sitePropertyUrl(input: Pick<Product, "id" | "slug" | "unitId" | "codigo">): string {
  const base = siteSlug(input.slug) || (input.unitId ? "imovel" : siteSlug(input.id)) || siteSlug(input.codigo) || "catalogo";
  const code = siteSlug(input.codigo);
  const slug = input.unitId
    ? `${base}-un-${code ? `${code}-` : ""}${input.unitId}`
    : base;
  return `https://apecerto.com/imovel/${slug}/`;
}

export const products: Product[] = [
  { name: "AP Moema", price: "R$ 403.350", neighborhood: "Moema", city: "São Paulo", area: 30, bedrooms: 1, parking: 2, available: 21, leads: 36, priceM2: "R$ 13.445/m²" },
  { name: "Bem Moema", price: "R$ 655.180", neighborhood: "Moema", city: "São Paulo", area: 28, bedrooms: 1, parking: 0, available: 1, leads: 6, priceM2: "R$ 23.399/m²" },
  { name: "Bios", price: "Preço sob consulta", neighborhood: "Santo Amaro", city: "São Paulo", area: 0, bedrooms: 1, parking: 0, available: 0, leads: 4, priceM2: "—" },
  { name: "Botanic Cyrela", price: "R$ 510.000", neighborhood: "Campo Belo", city: "São Paulo", area: 35, bedrooms: 2, parking: 0, available: 6, leads: 13, priceM2: "R$ 14.571/m²" },
  { name: "Chanés Street", price: "R$ 573.000", neighborhood: "Moema", city: "São Paulo", area: 42, bedrooms: 2, parking: 0, available: 4, leads: 10, priceM2: "R$ 13.643/m²" },
  { name: "Claris", price: "R$ 510.809", neighborhood: "Moema", city: "São Paulo", area: 46, bedrooms: 2, parking: 1, available: 24, leads: 40, priceM2: "R$ 11.104/m²" },
  { name: "Composite", price: "R$ 431.280", neighborhood: "Moema", city: "São Paulo", area: 47, bedrooms: 2, parking: 0, available: 7, leads: 15, priceM2: "R$ 9.176/m²" },
  { name: "Key Moema", price: "R$ 1.250.000", neighborhood: "Moema", city: "São Paulo", area: 64, bedrooms: 2, parking: 1, available: 1, leads: 6, priceM2: "R$ 19.531/m²" },
];
