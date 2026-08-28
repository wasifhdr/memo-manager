import { type ButtonHTMLAttributes, type AnchorHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "default" | "secondary" | "primary" | "ink" | "success" | "gold" | "danger" | "ghost" | "danger-ghost";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-bold " +
  "transition-[transform,box-shadow,background-color] duration-100 " +
  "focus-visible:outline-[3px] focus-visible:outline-(--color-ink) focus-visible:outline-offset-2 " +
  "disabled:pointer-events-none disabled:border-(--color-ink)/30 disabled:bg-(--color-sand)/40 " +
  "disabled:text-(--color-ink)/50 disabled:shadow-none cursor-pointer";

const sized: Record<Size, string> = {
  md: "px-4 py-2 text-[15px] shadow-offset border-2 border-(--color-ink) active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  sm: "px-3 py-1.5 text-sm shadow-offset-sm border-2 border-(--color-ink) active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
};

const variants: Record<Variant, string> = {
  default: "bg-(--color-paper) text-(--color-ink) hover:bg-(--color-cream)",
  secondary: "bg-(--color-paper) text-(--color-ink) hover:bg-(--color-cream)",
  primary: "bg-(--color-orange) text-white hover:bg-(--color-orange-deep)",
  success: "bg-(--color-green) text-white hover:bg-(--color-green-deep)",
  gold: "bg-(--color-gold) text-(--color-ink) hover:bg-(--color-gold)/80",
  ink: "bg-(--color-ink) text-(--color-paper) hover:bg-(--color-ink)/85",
  danger: "bg-(--color-red) text-white hover:bg-(--color-red-deep)",
  ghost: "border-transparent! shadow-none! bg-transparent text-(--color-ink)/70 hover:bg-(--color-cream) hover:text-(--color-ink) active:translate-x-0! active:translate-y-0!",
  "danger-ghost": "border-transparent! shadow-none! bg-transparent text-(--color-red-deep) hover:bg-(--color-red)/10 active:translate-x-0! active:translate-y-0!",
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
      className={`${base} ${sized[size]} ${variants[variant]} ${className}`}
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
      className={`${base} ${sized[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
