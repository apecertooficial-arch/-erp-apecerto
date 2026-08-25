"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AutomationsHome } from "./AutomationsHome";
import "../../styles/automation-builder.css";
import "../../styles/automation-workspace.css";

type AutomacaoLista = { id: number; arquivada?: boolean };

type OriginalAutomationBuilder = {
  mount: (host: HTMLDivElement, context: {
    authToken: string;
    supabaseUrl: string;
    publishableKey: string;
    initialAutomationId: number;
    onAutomationsLoaded: (automacoes: AutomacaoLista[]) => void;
    onAutomationOpened: (automacao: { id: number; nome?: string; grupo?: string | null }) => void;
  }) => void;
  unmount: () => void;
  isMounted: () => boolean;
  organizeHorizontal: () => boolean;
  hasUnsavedChanges: () => boolean;
};

function idDaUrl() {
  if (typeof window === "undefined") return null;
  const valor = Number(new URLSearchParams(window.location.search).get("automation"));
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

export function AutomationsWorkspaceV2({ accessToken }: { accessToken: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const [abrirId, setAbrirId] = useState<number | null>(() => idDaUrl());
  const [totalAutomacoes, setTotalAutomacoes] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<OriginalAutomationBuilder | null>(null);
  const abrirIdRef = useRef<number | null>(abrirId);
  const noConstrutor = abrirId !== null;

  useEffect(() => {
    const voltarOuAvancar = () => {
      const id = idDaUrl();
      const atual = abrirIdRef.current;
      if (id !== atual && builderRef.current?.hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Descartar essas alterações e sair deste fluxo?")) {
        window.history.pushState({}, "", atual ? `/automacoes?automation=${atual}` : "/automacoes");
        return;
      }
      abrirIdRef.current = id;
      setAbrirId(id);
    };
    window.addEventListener("popstate", voltarOuAvancar);
    return () => window.removeEventListener("popstate", voltarOuAvancar);
  }, []);

  const abrir = useCallback((id: number) => {
    abrirIdRef.current = id;
    setAbrirId(id);
    setAviso(null);
    window.history.pushState({}, "", `/automacoes?automation=${id}`);
  }, []);

  const voltarParaAutomacoes = useCallback(() => {
    if (builderRef.current?.hasUnsavedChanges() && !window.confirm("Existem alterações não salvas. Voltar para Minhas automações e descartar essas alterações?")) return;
    builderRef.current?.unmount();
    builderRef.current = null;
    abrirIdRef.current = null;
    setAbrirId(null);
    setAviso(null);
    window.history.pushState({}, "", "/automacoes");
  }, []);

  useEffect(() => {
    if (!noConstrutor) return;
    let ativo = true;
    let builder: OriginalAutomationBuilder | null = null;

    if (!supabaseUrl || !publishableKey) {
      if (hostRef.current) hostRef.current.innerHTML = '<div class="original-automation-error">Configuração pública do Supabase não encontrada.</div>';
      return;
    }

    void (async () => {
      const { default: modulo } = await import("./automationBuilderRuntime.js");
      if (!ativo || !hostRef.current || abrirIdRef.current == null) return;
      builder = modulo as OriginalAutomationBuilder;
      builderRef.current = builder;
      builder.mount(hostRef.current, {
        authToken: accessToken,
        supabaseUrl,
        publishableKey,
        initialAutomationId: abrirIdRef.current,
        onAutomationsLoaded: (automacoes) => setTotalAutomacoes(automacoes.filter((a) => !a.arquivada).length),
        onAutomationOpened: (automacao) => {
          abrirIdRef.current = automacao.id;
          setAbrirId(automacao.id);
          window.history.replaceState({}, "", `/automacoes?automation=${automacao.id}`);
        },
      });
    })().catch((e: unknown) => {
      if (!ativo || !hostRef.current) return;
      hostRef.current.innerHTML = `<div class="original-automation-error">${e instanceof Error ? e.message : "Erro ao carregar Automações."}</div>`;
    });

    return () => {
      ativo = false;
      builder?.unmount();
      if (builderRef.current === builder) builderRef.current = null;
    };
  }, [accessToken, noConstrutor, publishableKey, supabaseUrl]);

  const organizarH = useCallback(() => {
    const organizado = builderRef.current?.organizeHorizontal() ?? false;
    setAviso(organizado
      ? "Fluxo organizado no rascunho aberto. Revise e clique em Salvar para confirmar."
      : "Abra uma automação com blocos para organizar.");
  }, []);

  if (!supabaseUrl || !publishableKey) {
    return <div className="automation-feedback error">Configuração pública do Supabase não encontrada.</div>;
  }

  if (!noConstrutor) {
    return <AutomationsHome accessToken={accessToken} supabaseUrl={supabaseUrl} publishableKey={publishableKey} onOpen={abrir} />;
  }

  return (
    <section className="apn-builder-shell" aria-label="Construtor de automações">
      <header className="apn-builder-header">
        <button type="button" className="apn-back" onClick={voltarParaAutomacoes} aria-label="Voltar para automações">← <span>Minhas automações</span></button>
        <div className="apn-builder-heading"><span className="automation-eyebrow">CENTRAL DE AUTOMAÇÕES</span><h1>Construtor de fluxos</h1></div>
        <div className="apn-builder-actions">
          <span className="apn-total">{totalAutomacoes} automações</span>
          <button type="button" className="apn-organize" onClick={organizarH}>Organizar na horizontal</button>
        </div>
      </header>
      {aviso ? <div className="apn-builder-feedback" role="status">{aviso}<button type="button" aria-label="Fechar aviso" onClick={() => setAviso(null)}>×</button></div> : null}
      <div className="original-automation-host" ref={hostRef} />
    </section>
  );
}
