export function PageLayout({ children }) {
  return <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">{children}</div>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border)] bg-white px-3 py-2.5 md:h-14 md:flex-row md:items-center md:justify-between md:gap-4 md:px-5 md:py-0">
      <div className="min-w-0">
        <h1 className="text-[16px] font-semibold leading-tight tracking-tight text-[var(--color-text)] md:text-[18px]">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-[11px] leading-tight text-[var(--color-text-muted)] md:text-[12px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}

export function PageBody({ children, className = '' }) {
  return <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
}
