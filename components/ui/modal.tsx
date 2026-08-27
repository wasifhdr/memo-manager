"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/ui/icons";

const SIZES = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
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
      // `open:flex` (not plain `flex`) — a bare display:flex would beat the UA's
      // `dialog:not([open]){display:none}` and leave the dialog visible when closed.
      className={`m-auto max-h-[88vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-[var(--radius-card-lg)] border-2 border-(--color-ink) bg-(--color-paper) p-0 text-(--color-ink) shadow-offset-lg open:flex backdrop:bg-(--color-ink)/50 backdrop:backdrop-blur-[2px]`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-(--color-sand) px-5 py-4">
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
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex shrink-0 justify-end gap-3 border-t border-(--color-sand) px-5 py-4">{footer}</div>
      ) : null}
    </dialog>
  );
}
