"use client";

import { ProjectsWorkspace } from "../../features/projects/ProjectsWorkspace";
import { SaraTasksMobile } from "../../features/tasks/SaraTasksMobile";
import { GuardaModulo } from "../../features/system/GuardaModulo";
import { useEhCelular } from "../../features/system/useFormato";

export default function Pagina() {
  const ehCelular = useEhCelular();
  return <GuardaModulo modulo="Projetos e Tarefas">{(t) => {
    if (ehCelular === null) return null;
    return ehCelular ? <SaraTasksMobile accessToken={t} /> : <ProjectsWorkspace accessToken={t} />;
  }}</GuardaModulo>;
}
