"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { IconCheckCircle, IconXCircle, IconClose } from "@/components/ui/icons";

type ToastKind = "info" | "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq;
    setItems((cur) => [...cur, { id, kind, message }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismiss = (id: number) => setItems((cur) => cur.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[var(--radius-md)] border border-(--border) bg-(--surface-raised) px-4 py-3 text-sm text-(--text) shadow-[var(--shadow-lg)]"
          >
            {t.kind === "success" ? (
              <IconCheckCircle className="mt-0.5 size-4 shrink-0 text-(--st-approved-fg)" />
            ) : t.kind === "error" ? (
              <IconXCircle className="mt-0.5 size-4 shrink-0 text-(--st-rejected-fg)" />
            ) : null}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-(--text-faint) hover:text-(--text)"
            >
              <IconClose className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return useMemo(
    () => ({
      info: (message: string) => push?.("info", message),
      success: (message: string) => push?.("success", message),
      error: (message: string) => push?.("error", message),
    }),
    [push],
  );
}
