"use client";

import { CampaignWorkspace } from "../../features/campaigns/CampaignWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Disparos">{(t) => <CampaignWorkspace accessToken={t} />}</GuardaModulo>;
}
