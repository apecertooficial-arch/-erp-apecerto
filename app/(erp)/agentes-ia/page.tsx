"use client";

import { AgentTrainingWorkspace } from "../../features/agents/AgentTrainingWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Agentes de IA">{(t) => <AgentTrainingWorkspace accessToken={t} />}</GuardaModulo>;
}
