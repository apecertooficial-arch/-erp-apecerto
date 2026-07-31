"use client";

import { AuditWorkspace } from "../../features/audit/AuditWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Auditoria">{() => <AuditWorkspace />}</GuardaModulo>;
}
