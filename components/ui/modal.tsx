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
      className="m-auto w-full max-w-md rounded-[var(--radius-card-lg)] border-2 border-(--color-ink) bg-(--color-paper) p-0 text-(--color-ink) shadow-offset-lg backdrop:bg-(--color-ink)/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-(--color-sand) px-5 py-4">
        <h2 className="text-h3">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/60 hover:bg-(--color-cream) hover:text-(--color-ink) focus-visible:outline-[3px] focus-visible:outline-(--color-ink) focus-visible:outline-offset-2"
        >
          <IconClose className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex justify-end gap-3 border-t border-(--color-sand) px-5 py-4">{footer}</div>
      ) : null}
    </dialog>
  );
}
