import type { HTMLAttributes } from "react";

type CardVariant = "standard" | "quiet" | "feature";

const variants: Record<CardVariant, string> = {
  standard: "border-2 border-(--color-ink) bg-(--color-paper) shadow-offset",
  quiet: "border border-(--color-sand) bg-(--color-paper)",
  feature: "border-2 border-(--color-ink) bg-(--color-paper) shadow-offset-lg",
};

export function Card({
  className = "",
  variant = "standard",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-(--color-sand) px-5 py-4 ${className}`}
      {...props}
    />
  );
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 py-4 ${className}`} {...props} />;
}
