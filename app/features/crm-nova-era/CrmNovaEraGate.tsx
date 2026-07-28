"use client";
/**
 * CrmNovaEraGate — SELETOR de acesso entre o CRM atual e o CRM Nova Era (Experimental).
 * ------------------------------------------------------------------
 * - Default SEMPRE "Funil atual": renderiza o CRM vigente (recebido em `current`)
 *   sem alterar seu comportamento. Só troca quando o usuário escolhe "Nova Era".
 * - Sem persistência em banco: a escolha vive em estado local + query string (?crm=nova-era).
 * - Injeta o CSS isolado (nova-crm-*) via <style>, sem tocar globals.css/layout.
 *
 * Integração: ProductCatalog envolve o branch "CRM" com este Gate (mudança cirúrgica).
 */
import { useState, type ReactNode } from "react";
import { NOVA_CRM_CSS } from "./styles";
import { CrmNovaEraWorkspace } from "./CrmNovaEraWorkspace";

type Variante = "atual" | "nova-era";

function varianteInicial(): Variante {
  if (typeof window === "undefined") return "atual";
  try {
    const p = new URLSearchParams(window.location.search).get("crm");
    return p === "nova-era" ? "nova-era" : "atual";
  } catch {
    return "atual";
  }
}

function refletirNaUrl(v: Variante) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (v === "nova-era") url.searchParams.set("crm", "nova-era");
    else url.searchParams.delete("crm");
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* no-op: query string é só conveniência, nunca crítico */
  }
}

export function CrmNovaEraGate({ current }: { current: ReactNode }) {
  const [variante, setVariante] = useState<Variante>(varianteInicial);

  function escolher(v: Variante) {
    setVariante(v);
    refletirNaUrl(v);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{NOVA_CRM_CSS}</style>

      <div className="nova-crm-topbar" style={{ borderBottom: "1px solid var(--nc-line)" }}>
        <div className="nova-crm-seg" role="tablist" aria-label="Selecionar experiência de CRM">
          <button
            className={variante === "atual" ? "on" : ""}
            onClick={() => escolher("atual")}
            role="tab"
            aria-selected={variante === "atual"}
          >
            Funil atual
          </button>
          <button
            className={variante === "nova-era" ? "on" : ""}
            onClick={() => escolher("nova-era")}
            role="tab"
            aria-selected={variante === "nova-era"}
          >
            CRM Nova Era <span className="nova-crm-badge-exp" style={{ marginLeft: 6 }}>Experimental</span>
          </button>
        </div>
        <span className="nova-crm-seghint">
          {variante === "atual"
            ? "Você está no CRM de produção (inalterado)."
            : "Protótipo de avaliação — dados fictícios, sem gravação."}
        </span>
      </div>

      {variante === "nova-era" && (
        <div className="nova-crm-notice">
          ⚠️ <b>Ambiente de demonstração.</b> Leads e ações abaixo são fictícios e existem apenas nesta sessão do navegador. Nada é salvo, enviado ou integrado à produção.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {variante === "atual" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{current}</div>
        ) : (
          <CrmNovaEraWorkspace />
        )}
      </div>
    </div>
  );
}
