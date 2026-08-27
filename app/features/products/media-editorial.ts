function clean(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function buildMediaAltText({
  category,
  propertyName,
  unitNumber,
  neighborhood,
}: {
  category?: string | null;
  propertyName?: string | null;
  unitNumber?: string | null;
  neighborhood?: string | null;
}) {
  const subject = clean(category) || "Ambiente do imóvel";
  const property = clean(propertyName);
  const unit = clean(unitNumber);
  const place = clean(neighborhood);
  const context = [property, unit ? `unidade ${unit}` : "", place ? `em ${place}` : ""].filter(Boolean).join(" · ");
  return `${subject}${context ? ` — ${context}` : ""}`.slice(0, 220);
}
