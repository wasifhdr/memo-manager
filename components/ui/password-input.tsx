"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/field";
import { IconEye, IconEyeOff } from "@/components/ui/icons";

/**
 * A password field with a temporary unmask toggle.
 *
 * The toggle is a button rather than a checkbox so it never submits with the
 * form, and it is labelled for screen readers since the icon alone says
 * nothing. Revealing is deliberately transient — it resets to masked whenever
 * the component remounts.
 */
export function PasswordInput({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const hintId = useId();

  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? "text" : "password"}
        // room for the toggle, which sits inside the field
        className={`pr-11 ${className}`}
        aria-describedby={hintId}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        title={shown ? "Hide password" : "Show password"}
        // -translate-y-1/2 with top-1/2 keeps it centred whatever the field height
        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/50 transition-colors hover:bg-(--color-cream) hover:text-(--color-ink) focus-visible:outline-[3px] focus-visible:outline-(--color-ink) focus-visible:outline-offset-2"
      >
        {shown ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
      </button>
      <span id={hintId} className="sr-only">
        {shown ? "Password is visible" : "Password is hidden"}
      </span>
    </div>
  );
}
