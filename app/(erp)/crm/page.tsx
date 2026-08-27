import { CrmEntry, type CrmExperience } from "../../features/funil-2/CrmEntry";

export default function Pagina() {
  /* Rollback operacional: definir CRM_V3_EXPERIENCE=legacy no servidor e
     republicar. Sem query, cookie ou storage controlado pelo cliente. */
  const experience: CrmExperience = process.env.CRM_V3_EXPERIENCE === "legacy" ? "legacy" : "v3";
  return <CrmEntry experience={experience} />;
}
