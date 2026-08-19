"use client";

/* Hook único de leitura das telas da Inteligência.
 *
 * Consome GET /api/inteligencia/:tela com o accessToken da sessão, preservando
 * os quatro estados do contrato: carregando / erro / vazio / ok. Também reflete
 * período e filtros na URL (persistência do recorte). O mapeamento payload ->
 * formato visual de cada tela fica na própria tela; aqui só entregamos o cru.
 *
 * O estado "carregando" é DERIVADO: a leitura resolvida guarda a chave do
 * pedido que a gerou; se a chave corrente diferir, ainda está carregando. Assim
 * nenhum setState roda de forma síncrona dentro do efeito. */

import { useEffect, useState } from "react";
import type { MetaInteligencia } from "../../lib/inteligencia/tipos";
import type { Recorte } from "./CascaInteligencia";

export type EstadoCarga = "carregando" | "ok" | "erro" | "vazio";

export type LeituraInteligencia<T> = {
  estado: EstadoCarga;
  payload: T | null;
  meta: MetaInteligencia | null;
  erro: string | null;
};

const CONSENT: Record<string, string> = {
  "somente essenciais": "essential", essenciais: "essential", essencial: "essential",
  analytics: "analytics", marketing: "marketing",
};
const DEVICE: Record<string, string> = {
  desktop: "desktop", computador: "desktop", mobile: "mobile", celular: "mobile", tablet: "tablet",
};

function extrairFiltros(chips: string[]): { consent: string | null; device: string | null } {
  let consent: string | null = null;
  let device: string | null = null;
  for (const chip of chips) {
    const partes = chip.split(":");
    const dim = (partes[0] ?? "").trim().toLowerCase();
    const valor = (partes[1] ?? "").trim().toLowerCase();
    if (!valor || valor === "todos") continue;
    if (dim.includes("consent")) consent = CONSENT[valor] ?? null;
    if (dim.includes("dispositiv")) device = DEVICE[valor] ?? null;
  }
  return { consent, device };
}

export function useDadosInteligencia<T>(tela: string, accessToken: string | null, recorte: Recorte): LeituraInteligencia<T> {
  const { consent, device } = extrairFiltros(recorte.chips);
  const periodo = recorte.periodo;
  const chaveReq = `${tela}|${periodo}|${consent ?? ""}|${device ?? ""}`;

  const [resolvido, setResolvido] = useState<{ chave: string; leitura: LeituraInteligencia<T> } | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let ativo = true;

    const params = new URLSearchParams({ periodo });
    if (consent) params.set("consent", consent);
    if (device) params.set("device", device);

    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("tela", tela);
      u.searchParams.set("periodo", periodo);
      if (consent) u.searchParams.set("consent", consent); else u.searchParams.delete("consent");
      if (device) u.searchParams.set("device", device); else u.searchParams.delete("device");
      window.history.replaceState(null, "", u.toString());
    }

    fetch(`/api/inteligencia/${tela}?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (r) => {
        const corpo = (await r.json().catch(() => null)) as { data?: T; meta?: MetaInteligencia; error?: string } | null;
        if (!ativo) return;
        if (!r.ok) {
          setResolvido({ chave: chaveReq, leitura: { estado: "erro", payload: null, meta: corpo?.meta ?? null, erro: corpo?.error ?? `erro ${r.status}` } });
          return;
        }
        const payload = (corpo?.data ?? null) as T | null;
        const total = (payload as { total_eventos?: number } | null)?.total_eventos;
        const vazio = !payload || total === 0;
        setResolvido({ chave: chaveReq, leitura: { estado: vazio ? "vazio" : "ok", payload, meta: corpo?.meta ?? null, erro: null } });
      })
      .catch((e: unknown) => {
        if (ativo) setResolvido({ chave: chaveReq, leitura: { estado: "erro", payload: null, meta: null, erro: e instanceof Error ? e.message : "falha de rede" } });
      });

    return () => { ativo = false; };
  }, [chaveReq, tela, accessToken, periodo, consent, device]);

  if (resolvido && resolvido.chave === chaveReq) return resolvido.leitura;
  return { estado: "carregando", payload: null, meta: null, erro: null };
}
