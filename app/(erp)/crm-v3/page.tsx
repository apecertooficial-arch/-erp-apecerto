import { notFound } from "next/navigation";
import { CrmV3Route } from "../../features/funil-2-v3/CrmV3Route";

/**
 * Rota interna e reversível. Em builds compartilhados ela responde 404 por
 * padrão; a validação local abre automaticamente e um preview isolado precisa
 * declarar CRM_V3_LOCAL_VALIDATION=1 de forma explícita.
 */
export default function PaginaCrmV3() {
  const enabled = process.env.NODE_ENV === "development" || process.env.CRM_V3_LOCAL_VALIDATION === "1";
  if (!enabled) notFound();
  return <CrmV3Route />;
}

