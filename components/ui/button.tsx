import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] " +
  "font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 " +
  "cursor-pointer disabled:cursor-not-allowed";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[0.9375rem]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-(--accent) text-(--text-on-accent) shadow-[var(--shadow-sm)] " +
    "hover:bg-(--accent-hover) active:bg-(--accent-active)",
  secondary:
    "bg-(--surface) text-(--text) border border-(--border-strong) shadow-[var(--shadow-sm)] " +
    "hover:bg-(--surface-sunken)",
  ghost: "bg-transparent text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text)",
  danger:
    "bg-(--st-rejected-fg) text-white shadow-[var(--shadow-sm)] hover:brightness-110 active:brightness-95",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
};

export function LinkButton({
  className = "",
  variant = "primary",
  size = "md",
  href,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
