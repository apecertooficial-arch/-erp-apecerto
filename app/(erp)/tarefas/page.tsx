"use client";

import { ProjectsWorkspace } from "../../features/projects/ProjectsWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return <GuardaModulo modulo="Projetos e Tarefas">{(t) => <ProjectsWorkspace accessToken={t} />}</GuardaModulo>;
}
