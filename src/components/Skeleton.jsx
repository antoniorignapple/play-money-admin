/* ============ SKELETON ============ */
export function Skeleton({ className = '', variant = 'rect' }) {
  const base = 'animate-pulse bg-[var(--color-surface-active)]'
  const shapes = {
    rect: 'rounded-md',
    text: 'rounded h-3',
    circle: 'rounded-full',
  }
  return <div className={`${base} ${shapes[variant]} ${className}`} />
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton variant="text" className="w-3/4" />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <Skeleton variant="text" className="w-1/3 mb-3" />
      <Skeleton className="h-6 w-1/2" />
    </div>
  )
}

export function SkeletonList({ count = 5 }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-2">
          <Skeleton variant="circle" className="h-2 w-2" />
          <Skeleton variant="text" className="flex-1 max-w-[60%]" />
        </div>
      ))}
    </div>
  )
}

/* ============ EMPTY ILLUSTRATION ============ */
export function EmptyIllustration({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="text-[var(--color-text-muted)]">
      <rect x="8" y="12" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.5" />
      <circle cx="16" cy="20" r="1.5" fill="currentColor" opacity="0.4" />
      <rect x="22" y="18" width="14" height="1.5" rx="0.75" fill="currentColor" opacity="0.3" />
      <rect x="22" y="22" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.3" />
      <rect x="12" y="28" width="24" height="1.5" rx="0.75" fill="currentColor" opacity="0.2" />
    </svg>
  )
}
