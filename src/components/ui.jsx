import { useEffect, useRef, forwardRef } from 'react'
import { X } from 'lucide-react'
import { EmptyIllustration } from './Skeleton'

/* ============ BUTTON ============ */
export function Button({
  children, onClick, type = 'button', disabled = false,
  variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight,
  className = '', title,
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none'
  // Touch su mobile: h-9 invece di h-8, h-10 invece di h-9 ecc
  const sizes = {
    sm: 'h-8 px-2.5 text-[12px] md:h-7',
    md: 'h-9 px-3 text-[13px] md:h-8',
    lg: 'h-10 px-3.5 text-[14px] md:h-9',
  }
  const variants = {
    primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm',
    secondary: 'bg-white text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]',
    ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-[#DC2626] shadow-sm',
    success: 'bg-[var(--color-success)] text-white hover:bg-[#059669] shadow-sm',
    warning: 'bg-[var(--color-warning)] text-white hover:bg-[#D97706] shadow-sm',
    info: 'bg-[var(--color-info)] text-white hover:bg-[#2563EB] shadow-sm',
  }
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={iconSize} strokeWidth={2} />}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={2} />}
    </button>
  )
}

/* ============ ICON BUTTON ============ */
export function IconButton({
  icon: Icon, onClick, disabled = false, title,
  variant = 'default', size = 'md', className = '',
}) {
  // Touch su mobile
  const sizes = {
    sm: 'h-8 w-8 md:h-7 md:w-7',
    md: 'h-9 w-9 md:h-8 md:w-8',
  }
  const variants = {
    default: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
    danger: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]',
    accent: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]',
  }
  const iconSize = size === 'sm' ? 13 : 14
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </button>
  )
}

/* ============ INPUT ============ */
export const Input = forwardRef(function Input({ className = '', leftIcon: LeftIcon, ...props }, ref) {
  if (LeftIcon) {
    return (
      <div className="relative">
        <LeftIcon
          size={14} strokeWidth={2}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
        />
        <input
          ref={ref}
          className={`h-9 w-full rounded-md border border-[var(--color-border)] bg-white pl-8 pr-2.5 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 disabled:bg-[var(--color-surface)] disabled:opacity-60 md:h-8 ${className}`}
          {...props}
        />
      </div>
    )
  }
  return (
    <input
      ref={ref}
      className={`h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2.5 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 disabled:bg-[var(--color-surface)] disabled:opacity-60 md:h-8 ${className}`}
      {...props}
    />
  )
})

/* ============ TEXTAREA ============ */
export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-md border border-[var(--color-border)] bg-white px-2.5 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 disabled:bg-[var(--color-surface)] disabled:opacity-60 ${className}`}
      {...props}
    />
  )
}

/* ============ SELECT ============ */
export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 pr-7 text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 disabled:bg-[var(--color-surface)] disabled:opacity-60 md:h-8 ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '12px',
        appearance: 'none',
      }}
      {...props}
    >
      {children}
    </select>
  )
}

/* ============ FIELD ============ */
export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">
          {label}{required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="text-[11px] text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}

/* ============ FILTER BANNER ============ */
export function FilterBanner({ tone, icon: Icon, label, children }) {
  const tones = {
    info: { bar: 'bg-[var(--color-info)]', icon: 'text-[var(--color-info)]', soft: 'bg-[var(--color-info-soft)]' },
    warning: { bar: 'bg-[var(--color-warning)]', icon: 'text-[var(--color-warning)]', soft: 'bg-[var(--color-warning-soft)]' },
    success: { bar: 'bg-[var(--color-success)]', icon: 'text-[var(--color-success)]', soft: 'bg-[var(--color-success-soft)]' },
    danger: { bar: 'bg-[var(--color-danger)]', icon: 'text-[var(--color-danger)]', soft: 'bg-[var(--color-danger-soft)]' },
  }
  const t = tones[tone] || tones.info
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-1 ${t.bar}`} />
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 pl-4">
        {Icon && (
          <div className={`flex h-6 w-6 items-center justify-center rounded ${t.soft}`}>
            <Icon size={12} strokeWidth={2.25} className={t.icon} />
          </div>
        )}
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p>
      </div>
      <div className="flex flex-col gap-2 p-3 pl-4">{children}</div>
    </div>
  )
}

/* ============ CARD ============ */
export function Card({ children, className = '', padding = false }) {
  return (
    <div className={`rounded-lg border border-[var(--color-border)] bg-white shadow-sm ${padding ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  )
}

/* ============ BADGE ============ */
export function Badge({ children, variant = 'default', size = 'md', className = '' }) {
  const sizes = { sm: 'h-5 px-1.5 text-[10px]', md: 'h-6 px-2 text-[11px]' }
  const variants = {
    default: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-border)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success-border)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning-border)]',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger-border)]',
    info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border border-[var(--color-info-border)]',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium tabular-nums ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

/* ============ STAT ============ */
export function Stat({ label, value, hint, trend, tone = 'default', icon: Icon, className = '' }) {
  const tones = {
    default: { value: 'text-[var(--color-text)]', accent: '' },
    success: { value: 'text-[var(--color-success)]', accent: 'border-l-2 border-l-[var(--color-success)]' },
    danger: { value: 'text-[var(--color-danger)]', accent: 'border-l-2 border-l-[var(--color-danger)]' },
    warning: { value: 'text-[var(--color-warning)]', accent: 'border-l-2 border-l-[var(--color-warning)]' },
    accent: { value: 'text-[var(--color-accent)]', accent: 'border-l-2 border-l-[var(--color-accent)]' },
    info: { value: 'text-[var(--color-info)]', accent: 'border-l-2 border-l-[var(--color-info)]' },
  }
  const t = tones[tone] || tones.default
  return (
    <div className={`rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-sm md:p-4 ${t.accent} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] md:text-[11px]">{label}</p>
        {Icon && <Icon size={13} className="text-[var(--color-text-muted)]" strokeWidth={2} />}
      </div>
      <p className={`mt-1 text-[18px] font-semibold tracking-tight tabular-nums md:text-[22px] ${t.value}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] md:text-[12px]">{hint}</p>}
      {trend != null && (
        <p className={`mt-0.5 text-[12px] font-medium tabular-nums ${trend > 0 ? 'text-[var(--color-success)]' : trend < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
          {trend > 0 ? '+' : ''}{trend}
        </p>
      )}
    </div>
  )
}

/* ============ EMPTY STATE ============ */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          <Icon size={18} strokeWidth={1.75} />
        </div>
      ) : (
        <div className="mb-3"><EmptyIllustration size={56} /></div>
      )}
      <p className="text-[14px] font-medium text-[var(--color-text)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-[var(--color-text-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ============ KBD ============ */
export function Kbd({ children, className = '' }) {
  return (
    <kbd className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--color-border)] bg-white px-1 font-mono text-[10px] font-medium text-[var(--color-text-muted)] ${className}`}>
      {children}
    </kbd>
  )
}

/* ============ SEGMENTED ============ */
export function Segmented({ value, onChange, options = [], size = 'md' }) {
  const sizes = { sm: 'h-7 text-[12px]', md: 'h-8 text-[13px]' }
  return (
    <div className={`inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 ${sizes[size]}`}>
      {options.map((o) => {
        const active = String(value) === String(o.value)
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-full items-center gap-1.5 rounded px-2.5 font-medium transition-colors ${
              active
                ? 'bg-white text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {o.icon && <o.icon size={12} strokeWidth={2} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ============ MODAL (fullscreen mobile) ============ */
export function Modal({ open, onClose, title, children, footer, width = 'md' }) {
  const inputRef = useRef(null)

  // Focus automatico SOLO all'apertura (dipende solo da `open`).
  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus?.(), 50)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Listener Escape separato (può dipendere da onClose senza refocus).
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'md:max-w-md', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 backdrop-blur-sm md:items-center md:px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`flex w-full ${widths[width]} flex-col overflow-hidden border-[var(--color-border)] bg-white shadow-xl md:max-h-[88vh] md:rounded-xl md:border`}>
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3">
          <h3 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h3>
          <IconButton icon={X} onClick={onClose} title="Chiudi" size="sm" />
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <div ref={inputRef} tabIndex={-1} className="outline-none">{children}</div>
        </div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 pb-safe">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ============ TABS ============ */
export function Tabs({ value, onChange, options = [] }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] overflow-x-auto">
      {options.map((o) => {
        const active = String(value) === String(o.value)
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors ${
              active
                ? 'text-[var(--color-text)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {o.icon && <o.icon size={13} strokeWidth={2} />}
            {o.label}
            {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--color-accent)]" />}
          </button>
        )
      })}
    </div>
  )
}

/* ============ SPINNER ============ */
export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'h-3 w-3 border-2', md: 'h-4 w-4 border-2', lg: 'h-6 w-6 border-[2.5px]' }
  return (
    <span
      className={`inline-block animate-spin rounded-full border-[var(--color-border)] border-t-[var(--color-accent)] ${sizes[size]}`}
    />
  )
}
