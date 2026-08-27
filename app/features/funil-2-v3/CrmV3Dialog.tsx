"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CrmV3Icon } from "./CrmV3Icon";

export function CrmV3Dialog({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []);
    focusables()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); before?.focus(); };
  }, []);

  return <div className="crm-v3-dialog-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className={`crm-v3-dialog${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><div><span>Validação local</span><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="crm-v3-icon-btn" onClick={onClose} aria-label={`Fechar ${title}`}><CrmV3Icon name="close" /></button></header>
      <div className="crm-v3-dialog-body">{children}</div>
    </div>
  </div>;
}
