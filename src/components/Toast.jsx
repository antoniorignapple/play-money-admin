import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)
let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((toast) => {
    const id = ++idCounter
    const item = { id, duration: 4000, variant: 'default', ...toast }
    setToasts((t) => [...t, item])
    if (item.duration > 0) setTimeout(() => dismiss(id), item.duration)
    return id
  }, [dismiss])

  const api = {
    push, dismiss,
    success: (message, opts) => push({ variant: 'success', message, ...opts }),
    error: (message, opts) => push({ variant: 'error', message, duration: 6000, ...opts }),
    warning: (message, opts) => push({ variant: 'warning', message, ...opts }),
    info: (message, opts) => push({ variant: 'info', message, ...opts }),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  const cfg = {
    success: { Icon: CheckCircle2, ring: 'border-l-[var(--color-success)]', color: 'text-[var(--color-success)]' },
    error: { Icon: XCircle, ring: 'border-l-[var(--color-danger)]', color: 'text-[var(--color-danger)]' },
    warning: { Icon: AlertCircle, ring: 'border-l-[var(--color-warning)]', color: 'text-[var(--color-warning)]' },
    info: { Icon: Info, ring: 'border-l-[var(--color-info)]', color: 'text-[var(--color-info)]' },
    default: { Icon: Info, ring: 'border-l-[var(--color-border-strong)]', color: 'text-[var(--color-text-muted)]' },
  }[toast.variant] || { Icon: Info, ring: 'border-l-[var(--color-border-strong)]', color: 'text-[var(--color-text-muted)]' }

  const { Icon } = cfg
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border border-l-4 ${cfg.ring} border-[var(--color-border)] bg-white px-3.5 py-3 shadow-lg transition-all duration-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      <Icon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-[13px] font-medium text-[var(--color-text)]">{toast.title}</p>}
        <p className={`text-[13px] ${toast.title ? 'mt-0.5 text-[var(--color-text-secondary)]' : 'text-[var(--color-text)]'}`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="ml-1 -mt-0.5 -mr-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}
