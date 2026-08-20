"use client";

import { WatermarkRemover } from "../../../features/tools/WatermarkRemover";
import { GuardaModulo } from "../../../features/system/GuardaModulo";

export default function Pagina() {
  return (
    <GuardaModulo modulo="Remover Marca d'Água">
      {() => <WatermarkRemover />}
    </GuardaModulo>
  );
}
