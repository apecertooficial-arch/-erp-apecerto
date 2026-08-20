"use client";

import { WatermarkRemoverWorkspace } from "../../features/tools/WatermarkRemoverWorkspace";
import { GuardaModulo } from "../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Marca d'Água">
      {() => <WatermarkRemoverWorkspace />}
    </GuardaModulo>
  );
}
