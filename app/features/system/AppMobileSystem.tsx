"use client";

import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const atualizar = () => setOnline(window.navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);
  return online;
}

function hora(valor: Date | null) {
  return valor ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(valor) : "—";
}

export function AppMobileOffline({ atualizadoEm }: { atualizadoEm: Date | null }) {
  const online = useOnline();
  if (online) return null;
  return <div className="ape-offline" role="status">Sem conexão · dados atualizados às {hora(atualizadoEm)}</div>;
}

export function AppMobileSessaoExpirada() {
  return <section className="ape-sessao-expirada" role="alert">
    <div className="ape-estado-icone" aria-hidden="true">!</div>
    <strong>Sua sessão terminou</strong>
    <p>Entre novamente para continuar. Nenhuma tarefa foi perdida.</p>
    <a href="/login">Entrar novamente</a>
  </section>;
}
