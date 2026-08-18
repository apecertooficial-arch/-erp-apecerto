"use client";

import { useState } from "react";
import { parseLocalizedNumber } from "./quality";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function MoneyInput({ value, onChange, label = "Valor", compact = false, defaultMode = "milhares" }: {
  value: string | number | null;
  onChange: (fullValue: number | null) => void;
  label?: string;
  compact?: boolean;
  defaultMode?: "milhares" | "reais";
}) {
  const [modeChoice, setModeChoice] = useState<{ source: "milhares" | "reais"; value: "milhares" | "reais" }>({ source: defaultMode, value: defaultMode });
  const mode = modeChoice.source === defaultMode ? modeChoice.value : defaultMode;
  const numeric = parseLocalizedNumber(value);
  const shown = numeric === null ? "" : mode === "milhares" ? String(numeric / 1_000).replace(".", ",") : String(numeric).replace(".", ",");

  return <div className={compact ? "money-input compact" : "money-input"}>
    <div className="money-input-head">
      {!compact && <span>{label}</span>}
      <span className="money-mode" role="group" aria-label={`Unidade de ${label}`}>
        <button type="button" className={mode === "milhares" ? "active" : ""} onClick={() => setModeChoice({ source: defaultMode, value: "milhares" })}>Em milhares</button>
        <button type="button" className={mode === "reais" ? "active" : ""} onClick={() => setModeChoice({ source: defaultMode, value: "reais" })}>Valor cheio</button>
      </span>
    </div>
    <div className="money-input-field"><span>R$</span><input inputMode="decimal" aria-label={label} value={shown} onChange={(event) => {
      const parsed = parseLocalizedNumber(event.target.value);
      onChange(parsed === null ? null : mode === "milhares" ? Math.round(parsed * 1_000) : Math.round(parsed));
    }} placeholder={mode === "milhares" ? "Ex.: 710" : "Ex.: 710000"} /></div>
    {!compact && <small>{numeric === null
      ? mode === "milhares" ? "Digite 710 para cadastrar R$ 710.000" : "Digite o valor completo em reais"
      : `O imóvel será salvo por ${money.format(numeric)}`}</small>}
  </div>;
}
