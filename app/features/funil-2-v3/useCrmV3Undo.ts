"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const CRM_V3_UNDO_ACTIVE_MS = 12_000;

type UndoEntry<Snapshot> = { snapshot: Snapshot; message: string; remainingMs: number };

export function useCrmV3Undo<Snapshot>(onRestore: (snapshot: Snapshot) => void) {
  const [entry, setEntry] = useState<UndoEntry<Snapshot> | null>(null);
  const [paused, setPaused] = useState(false);
  const lastTick = useRef<number | null>(null);
  const active = entry !== null;

  useEffect(() => {
    if (!active || paused) { lastTick.current = null; return; }
    let frame = 0;
    let interval = 0;
    frame = window.requestAnimationFrame(() => {
      lastTick.current = performance.now();
      interval = window.setInterval(() => {
        const now = performance.now();
        const elapsed = lastTick.current == null ? 0 : now - lastTick.current;
        lastTick.current = now;
        setEntry((current) => {
          if (!current) return null;
          const remainingMs = current.remainingMs - elapsed;
          return remainingMs <= 0 ? null : { ...current, remainingMs };
        });
      }, 100);
    });
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(interval); };
  }, [active, paused]);

  const arm = useCallback((snapshot: Snapshot, message: string) => {
    setPaused(false);
    lastTick.current = null;
    setEntry({ snapshot, message, remainingMs: CRM_V3_UNDO_ACTIVE_MS });
  }, []);

  const undo = useCallback(() => {
    if (!entry) return;
    onRestore(entry.snapshot);
    setEntry(null);
    setPaused(false);
  }, [entry, onRestore]);

  const clear = useCallback(() => {
    setEntry(null);
    setPaused(false);
    lastTick.current = null;
  }, []);

  return { entry, arm, undo, clear, pause: () => setPaused(true), resume: () => setPaused(false) };
}
