"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import gsap from "gsap";
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
  originRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** The control that opened this modal — the dialog grows out of, and
   * collapses back into, its position. Falls back to a plain fade. */
  originRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);

  /** Offset from the dialog's resting centre to the trigger's centre. */
  function originDelta(dialog: HTMLDialogElement) {
    const origin = originRef?.current?.getBoundingClientRect();
    if (!origin || origin.width === 0) return null;
    const d = dialog.getBoundingClientRect();
    return {
      x: origin.left + origin.width / 2 - (d.left + d.width / 2),
      y: origin.top + origin.height / 2 - (d.top + d.height / 2),
      scale: Math.max(0.2, Math.min(origin.width / Math.max(d.width, 1), 0.6)),
    };
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (open && !dialog.open) {
      closingRef.current = false;
      dialog.showModal();

      if (reduce) {
        gsap.set(dialog, { autoAlpha: 1, clearProps: "transform" });
        return;
      }

      const from = originDelta(dialog);
      gsap.fromTo(
        dialog,
        from
          ? { autoAlpha: 0, x: from.x, y: from.y, scale: from.scale, transformOrigin: "center center" }
          : { autoAlpha: 0, scale: 0.96 },
        {
          autoAlpha: 1, x: 0, y: 0, scale: 1,
          duration: 0.42, ease: "power3.out",
          // drop the transform so it can't become a containing block for
          // anything positioned inside the dialog
          clearProps: "transform",
        },
      );
      return;
    }

    if (!open && dialog.open && !closingRef.current) {
      closingRef.current = true;

      if (reduce) {
        dialog.close();
        closingRef.current = false;
        return;
      }

      const to = originDelta(dialog);
      gsap.to(dialog, {
        autoAlpha: 0,
        ...(to ? { x: to.x, y: to.y, scale: to.scale } : { scale: 0.96 }),
        duration: 0.24,
        ease: "power2.in",
        onComplete: () => {
          dialog.close();
          gsap.set(dialog, { clearProps: "all" });
          closingRef.current = false;
        },
      });
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Take over Escape so the close animation can run before the dialog goes.
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
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
