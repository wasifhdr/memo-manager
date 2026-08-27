export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--color-cream) bg-dotgrid px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-(--color-ink) font-display text-lg font-extrabold text-(--color-paper)">
          M
        </span>
        <span className="font-display text-[0.9375rem] font-bold text-(--color-ink)">Memo Manager</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
