import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

const fieldBase =
  "w-full rounded-[var(--radius-sm)] border border-(--border-strong) bg-(--surface) px-3 py-2 " +
  "text-sm text-(--text) placeholder:text-(--text-faint) transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-(--surface-sunken)";

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

type Option = { value: string; label: string };

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }
>(function Select({ className = "", options, placeholder, defaultValue, value, ...props }, ref) {
  // With a placeholder and no value supplied by the caller, default to the
  // disabled placeholder option instead of letting the browser silently
  // select the first real option.
  const uncontrolledDefault = placeholder && value === undefined && defaultValue === undefined ? "" : defaultValue;
  return (
    <select
      ref={ref}
      defaultValue={value === undefined ? uncontrolledDefault : undefined}
      value={value}
      className={`${fieldBase} h-10 appearance-none bg-[image:var(--select-caret)] bg-[length:0.875rem] bg-[right_0.75rem_center] bg-no-repeat pr-8 ${className}`}
      style={
        {
          "--select-caret":
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23868d99' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        } as React.CSSProperties
      }
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});

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
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-[0.8125rem] font-medium text-(--text)">
      <span>{children}</span>
      {hint ? <span className="font-normal text-(--text-faint)">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[0.8125rem] text-(--st-rejected-fg)">{children}</p>;
}
