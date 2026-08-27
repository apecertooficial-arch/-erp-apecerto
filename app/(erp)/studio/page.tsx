"use client";

import { StudioModule } from "../../features/studio/StudioModule";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function PaginaStudio() {
  return <GuardaModulo modulo="apêcerto Studio">{(accessToken) => <StudioModule accessToken={accessToken} />}</GuardaModulo>;
}
