"use client";

import { PerformanceWorkspace } from "../../features/team/PerformanceWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useErpSession } from "../../features/system/ErpSession";

export default function Pagina() {
  const { role } = useErpSession();
  return <GuardaModulo modulo="Performance">{(t) => <PerformanceWorkspace accessToken={t} sessionRole={role} />}</GuardaModulo>;
}
