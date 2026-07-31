"use client";

import { PermissionsWorkspace } from "../../features/permissions/PermissionsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Perfis e Permissões">{(t) => <PermissionsWorkspace accessToken={t} />}</GuardaModulo>;
}
