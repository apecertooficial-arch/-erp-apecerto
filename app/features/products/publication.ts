type SitePublicationInput = {
  published: boolean | null | undefined;
  draft: boolean | null | undefined;
  approval: string | null | undefined;
  status: string | null | undefined;
  availableApprovedUnits: number;
};

export function isProductPublishedOnSite(input: SitePublicationInput) {
  const approvedForPublication = Boolean(
    input.published
      && !input.draft
      && input.approval === "aprovado",
  );
  if (!approvedForPublication) return false;

  return input.status?.trim().toLowerCase() !== "pronto"
    || input.availableApprovedUnits > 0;
}
