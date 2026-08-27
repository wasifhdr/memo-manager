export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--bg) px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-(--accent) font-serif-heading text-lg font-semibold text-(--text-on-accent)">
          M
        </span>
        <span className="text-[0.9375rem] font-semibold text-(--text)">Memo Manager</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
