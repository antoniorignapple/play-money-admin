import { useEffect, useState, useMemo, useRef } from 'react'
import { Search, ArrowRight, Building2, Users, Wallet, BarChart3, Car, Trash2, Hash, ShieldCheck } from 'lucide-react'

const ICONS = { Building2, Users, Wallet, BarChart3, Car, Trash2, Hash, ShieldCheck }

export function CommandPalette({ open, onClose, onNavigate, pages = [] }) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery(''); setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = pages.map((p) => ({
      kind: 'page', id: p.id, label: p.label,
      hint: p.hint || 'Vai a ' + p.label, icon: p.icon,
    }))
    if (!q) return all
    return all.filter((i) => i.label.toLowerCase().includes(q) || (i.hint || '').toLowerCase().includes(q))
  }, [pages, query])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIdx]
        if (item) { onNavigate(item); onClose() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, activeIdx, onClose, onNavigate])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-3.5 py-3">
          <Search size={15} className="text-[var(--color-text-muted)]" strokeWidth={2} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Vai a… cerca pagine, azioni"
            className="flex-1 bg-transparent text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
          />
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">ESC</kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-1.5">
          {items.length === 0 && (
            <div className="px-3 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
              Nessun risultato per "{query}"
            </div>
          )}
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] || Hash
            const active = i === activeIdx
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item); onClose() }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                  active ? 'bg-[var(--color-accent-soft)]' : ''
                }`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-white ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                  <Icon size={13} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{item.label}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{item.hint}</p>
                </div>
                {active && <ArrowRight size={13} className="text-[var(--color-accent)]" strokeWidth={2} />}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[11px] text-[var(--color-text-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-border)] bg-white px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
              naviga
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--color-border)] bg-white px-1 py-0.5 font-mono text-[10px]">↵</kbd>
              apri
            </span>
          </div>
          <span>Play Money Admin</span>
        </div>
      </div>
    </div>
  )
}
