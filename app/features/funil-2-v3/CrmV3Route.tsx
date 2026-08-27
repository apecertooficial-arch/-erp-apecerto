"use client";

import { GuardaModulo } from "../system/GuardaModulo";
import { useErpSession } from "../system/ErpSession";
import { CrmV3Workspace } from "./CrmV3Workspace";

export function CrmV3Route() {
  const { profile, role } = useErpSession();
  return <GuardaModulo modulo="CRM">{() => <CrmV3Workspace realProfile={role} realName={profile?.name ?? "Corretor"} localValidation={process.env.NODE_ENV === "development"} />}</GuardaModulo>;
}
