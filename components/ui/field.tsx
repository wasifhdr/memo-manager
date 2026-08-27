import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

const fieldBase =
  "w-full rounded-[var(--radius-control)] border-2 border-(--color-ink) bg-(--color-paper) px-3.5 py-2 " +
  "text-[15px] text-(--color-ink) placeholder:text-(--color-ink)/45 transition-colors duration-100 " +
  "focus-visible:outline-[3px] focus-visible:outline-(--color-ink) focus-visible:outline-offset-2 " +
  "disabled:border-(--color-ink)/30 disabled:bg-(--color-cream) disabled:text-(--color-ink)/50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${fieldBase} h-10 ${className}`} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return <textarea ref={ref} className={`${fieldBase} min-h-24 resize-y ${className}`} {...props} />;
});

// Select now lives in ./select.tsx (a styled, accessible listbox). It is
// re-exported here so every existing `import { Select } from
// "@/components/ui/field"` keeps working untouched.
export { Select } from "@/components/ui/select";
export type { Option, SelectProps } from "@/components/ui/select";

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-label uppercase text-(--color-ink)/70">
      <span>{children}</span>
      {hint ? <span className="normal-case tracking-normal font-normal text-(--color-ink)/50">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs font-medium text-(--color-red-deep)">{children}</p>;
}
