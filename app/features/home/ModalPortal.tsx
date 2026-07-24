"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Renderiza o conteúdo (modal de gráfico) direto no <body>, fora da árvore
// .home-v2. Isso é necessário porque a animação de entrada aplicada em
// `.home-v2 > .hv2-inner > *` cria um containing block que quebra o
// position:fixed do modal — fazendo ele abrir fora da tela quando a página
// está rolada. Portalando pro body, o modal fica sempre fixo ao viewport.
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
