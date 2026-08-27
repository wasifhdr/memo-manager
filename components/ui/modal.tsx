"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/ui/icons";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-full max-w-md rounded-[var(--radius-lg)] border border-(--border) bg-(--surface-raised) p-0 text-(--text) shadow-[var(--shadow-lg)] backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
        <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text)"
        >
          <IconClose className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex justify-end gap-2 border-t border-(--border) px-5 py-4">{footer}</div>
      ) : null}
    </dialog>
  );
}
