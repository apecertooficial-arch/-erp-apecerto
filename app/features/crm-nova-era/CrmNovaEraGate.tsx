"use client";
/**
 * CrmNovaEraGate — SELETOR entre o CRM atual e o CRM Nova Era 3.0.
 * ------------------------------------------------------------------
 * - Gate real: só exibe a opção "CRM Nova Era" quando `crmNovaEraLiberado`
 *   (flag do ambiente ligada E (admin OU allowlist)). Corretor sem permissão
 *   vê APENAS o CRM antigo. Acesso direto por ?crm=nova-era é bloqueado quando
 *   não liberado (cai no CRM antigo e limpa a query).
 * - A flag controla só a VISIBILIDADE; a autorização de dados é sempre do banco
 *   (RLS + RPC fail-closed). Nenhum segredo/serviço aqui.
 * - Persiste a última escolha por usuário (localStorage), sem afetar os demais.
 * - Default: "Funil atual" (CRM de produção inalterado).
 */
import { useEffect, useState, type ReactNode } from "react";
import { NOVA_CRM_CSS } from "./styles";
import { crmNovaEraLiberado } from "./featureFlag";
import { Crm3Workspace } from "../crm-nova-era-3/Crm3Workspace";

type Variante = "atual" | "nova-era";
type Profile = { userId: string | null; role: string | null; name: string | null };

function chave(userId: string | null) {
  return `ncrm:variante:${userId ?? "anon"}`;
}

function escolhaSalva(userId: string | null): Variante {
  if (typeof window === "undefined") return "atual";
  try {
    if (new URLSearchParams(window.location.search).get("crm") === "nova-era") return "nova-era";
    return window.localStorage.getItem(chave(userId)) === "nova-era" ? "nova-era" : "atual";
  } catch {
    return "atual";
  }
}

function refletirUrl(v: Variante, userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (v === "nova-era") url.searchParams.set("crm", "nova-era");
    else url.searchParams.delete("crm");
    window.history.replaceState(null, "", url.toString());
    window.localStorage.setItem(chave(userId), v);
  } catch {
    /* no-op */
  }
}

export function CrmNovaEraGate({
  current,
  accessToken,
  profile,
}: {
  current: ReactNode;
  accessToken?: string | null;
  profile?: Profile;
}) {
  const liberado = crmNovaEraLiberado(profile?.userId ?? null, { role: profile?.role ?? null });
  // Escolha inicial já considerando o gate (sem setState em efeito).
  const [variante, setVariante] = useState<Variante>(() => (liberado ? escolhaSalva(profile?.userId ?? null) : "atual"));

  // Se não liberado, apenas limpa ?crm=nova-era da URL (sync com sistema externo — sem setState).
  useEffect(() => {
    if (!liberado) refletirUrl("atual", profile?.userId ?? null);
  }, [liberado, profile?.userId]);

  // Não liberado: nada de Nova Era, nem seletor — CRM antigo puro.
  if (!liberado) return <>{current}</>;

  function escolher(v: Variante) {
    setVariante(v);
    refletirUrl(v, profile?.userId ?? null);
  }

  const podeLive = !!accessToken && !!profile?.userId;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{NOVA_CRM_CSS}</style>

      <div className="nova-crm-topbar" style={{ borderBottom: "1px solid var(--nc-line)" }}>
        <div className="nova-crm-seg" role="tablist" aria-label="Selecionar experiência de CRM">
          <button className={variante === "atual" ? "on" : ""} onClick={() => escolher("atual")} role="tab" aria-selected={variante === "atual"}>
            Funil atual
          </button>
          <button className={variante === "nova-era" ? "on" : ""} onClick={() => escolher("nova-era")} role="tab" aria-selected={variante === "nova-era"}>
            CRM Nova Era <span className="nova-crm-badge-exp" style={{ marginLeft: 6 }}>3.0</span>
          </button>
        </div>
        <span className="nova-crm-seghint">
          {variante === "atual" ? "Você está no CRM de produção (inalterado)." : "Piloto funcional — dados reais, escrita só por RPC autorizada."}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {variante === "atual" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{current}</div>
        ) : podeLive ? (
          <Crm3Workspace
            accessToken={accessToken as string}
            profile={{ userId: profile!.userId as string, role: profile?.role ?? "corretor", name: profile?.name ?? "Corretor" }}
          />
        ) : (
          <div className="nova-crm-empty">Sessão necessária para carregar o CRM Nova Era.</div>
        )}
      </div>
    </div>
  );
}
