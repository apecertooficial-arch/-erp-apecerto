"use client";

import { Tracking360Workspace } from "../../features/tracking/Tracking360Workspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Tracking 360">
      {(accessToken) => <Tracking360Workspace accessToken={accessToken} />}
    </GuardaModulo>
  );
}
