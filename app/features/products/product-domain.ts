export type CommercialOrigin = "terceiros" | "lancamento" | "remanescente";

export type ProductQualityIssue =
  | "sem_captador"
  | "sem_proprietario"
  | "sem_foto_propria"
  | "sem_condominio_referencia"
  | "preco_invalido";

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
