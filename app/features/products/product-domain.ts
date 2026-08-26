export type CommercialOrigin = "terceiros" | "lancamento" | "remanescente";

export type ProductQualityIssue =
  | "sem_captador"
  | "sem_proprietario"
  | "sem_foto_propria"
  | "sem_condominio_referencia"
  | "preco_invalido";

export type QualityRepairAction = "view" | "edit" | "media";

export type InventorySummaryInput = {
  totalUnits: number;
  approvedAvailable: number;
  catalogUnits: number;
  publishedUnits: number;
  qualityBlocked: number;
  unavailableUnits: number;
};

export type InventorySummary = InventorySummaryInput & {
  catalogOffline: number;
  outsideCommercialCatalog: number;
};

const qualityIssueLabels: Record<ProductQualityIssue, string> = {
  sem_captador: "Captador não identificado",
  sem_proprietario: "Proprietário incompleto",
  sem_foto_propria: "Sem foto própria",
  sem_condominio_referencia: "Condomínio não vinculado",
  preco_invalido: "Preço inválido",
};

export function resolveCommercialOrigin(input: {
  explicit?: string | null;
  thirdParty?: boolean | null;
  buildingStatus?: string | null;
}): CommercialOrigin {
  if (input.explicit === "terceiros" || input.explicit === "lancamento" || input.explicit === "remanescente") {
    return input.explicit;
  }
  if (input.thirdParty) return "terceiros";
  return /pronto/i.test(input.buildingStatus ?? "") ? "remanescente" : "lancamento";
}

export function canViewUnitOwner(input: {
  viewerBrokerId?: number | null;
  captorBrokerId?: number | null;
}): boolean {
  return input.viewerBrokerId != null
    && input.captorBrokerId != null
    && input.viewerBrokerId === input.captorBrokerId;
}

export function summarizeQualityIssues(issues: readonly string[]): string[] {
  return issues
    .map((issue) => qualityIssueLabels[issue as ProductQualityIssue])
    .filter((label): label is string => Boolean(label));
}

export function summarizeInventory(input: InventorySummaryInput): InventorySummary {
  return {
    ...input,
    catalogOffline: Math.max(0, input.catalogUnits - input.publishedUnits),
    outsideCommercialCatalog: Math.max(0, input.approvedAvailable - input.catalogUnits),
  };
}

export function qualityRepairAction(issues: readonly string[]): QualityRepairAction {
  if (issues.includes("sem_foto_propria")) return "media";
  if (issues.includes("preco_invalido") || issues.includes("sem_condominio_referencia")) return "edit";
  return "view";
}

export function filterQualityQueue<T extends {
  codigo?: string | null;
  numero?: string | null;
  productName: string;
  segment: string;
  issues: string[];
}>(items: readonly T[], query: string, issue: string): T[] {
  const queryKey = String(query ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return items.filter((item) => {
    if (issue !== "todos" && !item.issues.includes(issue)) return false;
    if (!queryKey) return true;
    return [item.codigo, item.numero, item.productName, item.segment, ...summarizeQualityIssues(item.issues)]
      .some((value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(queryKey));
  });
}
