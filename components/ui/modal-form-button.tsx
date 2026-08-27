"use client";

import { useCallback, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ButtonProps = ComponentProps<typeof Button>;

/**
 * The standard "create" affordance: a button (usually in a PageHeader's
 * actions slot) that opens its form in a modal anchored to the button.
 *
 * `children` is a render function so the form can dismiss the modal itself
 * once its server action succeeds. Because a function child cannot cross the
 * server/client boundary, this must be used from a Client Component — pair it
 * with a small 'use client' wrapper next to the form it opens:
 *
 *   <ModalFormButton label="Add user" title="Add a user">
 *     {(close) => <NewUserForm onDone={close} />}
 *   </ModalFormButton>
 */
export function ModalFormButton({
  label,
  title,
  size = "lg",
  variant,
  buttonSize,
  children,
}: {
  label: ReactNode;
  title: string;
  size?: ComponentProps<typeof Modal>["size"];
  variant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button ref={triggerRef} type="button" variant={variant} size={buttonSize} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {/* children stay mounted while closing so the dialog isn't empty mid-animation */}
      <Modal open={open} onClose={close} title={title} size={size} originRef={triggerRef}>
        {children(close)}
      </Modal>
    </>
  );
}
