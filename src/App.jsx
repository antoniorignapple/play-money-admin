import { useState, useEffect } from 'react'
import {
  Wallet, Users, Building2, BarChart3, Car, Trash2, ShieldCheck,
  Search, ChevronsLeft, ChevronsRight, Menu, X,
} from 'lucide-react'
import CassaPage from './pages/CassaPage'
import AgentiPage from './pages/AgentiPage'
import LocaliPage from './pages/LocaliPage'
import AnalisiPage from './pages/AnalisiPage'
import AutomezziPage from './pages/AutomezziPage'
import CestinoPage from './pages/CestinoPage'
import AdminPage from './pages/AdminPage'
import { ToastProvider } from './components/Toast'
import { CommandPalette } from './components/CommandPalette'

const NAV = [
  { id: 'cassa',      label: 'Cassa',      icon: 'Wallet',     iconCmp: Wallet,     hint: 'Movimenti cassa',           component: CassaPage,     shortcut: 'C' },
  { id: 'agenti',     label: 'Agenti',     icon: 'Users',      iconCmp: Users,      hint: 'Gestione agenti e accessi', component: AgentiPage,    shortcut: 'A' },
  { id: 'locali',     label: 'Locali',     icon: 'Building2',  iconCmp: Building2,  hint: 'Locali e change machines',  component: LocaliPage,    shortcut: 'L' },
  { id: 'analisi',    label: 'Analisi',    icon: 'BarChart3',  iconCmp: BarChart3,  hint: 'Riepilogo giornaliero',     component: AnalisiPage,   shortcut: 'N' },
  { id: 'automezzi',  label: 'Automezzi',  icon: 'Car',        iconCmp: Car,        hint: 'Km, mezzi e rifornimenti',  component: AutomezziPage, shortcut: 'M' },
  { id: 'cestino',    label: 'Cestino',    icon: 'Trash2',     iconCmp: Trash2,     hint: 'Movimenti cancellati',      component: CestinoPage,   shortcut: 'T' },
  { id: 'admin',      label: 'ADMIN',      icon: 'ShieldCheck',iconCmp: ShieldCheck,hint: 'Strumenti amministrativi',  component: AdminPage,     shortcut: 'D' },
]

export default function App() {
  const [page, setPage] = useState('cassa')
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close drawer when page changes on mobile
  useEffect(() => {
    setMobileNavOpen(false)
  }, [page])

  // Keyboard shortcuts (solo desktop)
  useEffect(() => {
    function onKey(e) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const cmd = isMac ? e.metaKey : e.ctrlKey

      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPaletteOpen(true); return
      }

      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.target?.isContentEditable) return

      if (cmd && e.key.toLowerCase() === 'b') {
        e.preventDefault(); setCollapsed((c) => !c); return
      }

      if (!cmd && !e.altKey && !e.shiftKey) {
        const k = e.key.toUpperCase()
        const target = NAV.find((n) => n.shortcut === k)
        if (target) { e.preventDefault(); setPage(target.id) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const Current = NAV.find((n) => n.id === page)?.component || CassaPage
  const currentLabel = NAV.find((n) => n.id === page)?.label || 'Play Money'

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
        {/* TOPBAR MOBILE — visibile solo < 768px */}
        <header className="fixed left-0 right-0 top-0 z-40 flex h-[calc(48px+env(safe-area-inset-top))] items-center justify-between border-b border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-bg-hover)]"
            aria-label="Apri menu"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/app-icon.png" alt="" className="h-6 w-6 rounded object-contain" draggable={false} />
            <p className="text-[14px] font-semibold text-white">{currentLabel}</p>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-bg-hover)]"
            aria-label="Cerca"
          >
            <Search size={18} strokeWidth={2} />
          </button>
        </header>

        {/* BACKDROP DRAWER */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* SIDEBAR (drawer mobile, fissa desktop) */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar
            page={page}
            setPage={setPage}
            collapsed={collapsed && !isMobile}
            setCollapsed={setCollapsed}
            openPalette={() => setPaletteOpen(true)}
            isMobile={isMobile}
            onClose={() => setMobileNavOpen(false)}
          />
        </div>

        {/* MAIN: con padding-top su mobile per topbar */}
        <main className="flex-1 overflow-hidden pt-[calc(48px+env(safe-area-inset-top))] md:pt-0">
          <Current />
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          pages={NAV.map((n) => ({ id: n.id, label: n.label, icon: n.icon, hint: n.hint }))}
          onNavigate={(item) => setPage(item.id)}
        />
      </div>
    </ToastProvider>
  )
}

function Sidebar({ page, setPage, collapsed, setCollapsed, openPalette, isMobile, onClose }) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
  const cmdKey = isMac ? '⌘' : 'Ctrl'

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-[var(--color-sidebar-bg)] pt-safe transition-[width] duration-150 ${
        collapsed ? 'w-[56px]' : 'w-[260px] md:w-[228px]'
      }`}
    >
      {/* Brand bar */}
      <div className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-[var(--color-sidebar-border)] px-3 ${collapsed ? 'justify-center' : ''}`}>
        <img src="/app-icon.png" alt="" className="h-7 w-7 shrink-0 rounded object-contain" draggable={false} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[var(--color-sidebar-text-active)]">Play Money Admin</p>
            <p className="text-[10px] leading-tight text-[var(--color-sidebar-text-muted)]">Versione 2.0</p>
          </div>
        )}
        {/* Close button mobile */}
        {isMobile && (
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--color-sidebar-text-muted)] hover:bg-[var(--color-sidebar-bg-hover)] hover:text-white"
            aria-label="Chiudi menu"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
        {!collapsed && !isMobile && (
          <button
            onClick={() => setCollapsed(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--color-sidebar-text-muted)] transition-colors hover:bg-[var(--color-sidebar-bg-hover)] hover:text-white"
            title="Comprimi (⌘B)"
          >
            <ChevronsLeft size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Search trigger - solo desktop */}
      {!isMobile && (
        <div className="px-2 py-2">
          <button
            onClick={openPalette}
            className={`group flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg-hover)]/40 px-2 text-left text-[var(--color-sidebar-text-muted)] transition-colors hover:bg-[var(--color-sidebar-bg-hover)] hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Search size={13} strokeWidth={2} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-[12px]">Cerca…</span>
                <kbd className="rounded border border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] px-1 py-0.5 font-mono text-[10px] text-[var(--color-sidebar-text-muted)]">{cmdKey}K</kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="flex flex-col gap-0.5">
          {NAV.slice(0, 6).map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={page === item.id}
              collapsed={collapsed}
              isMobile={isMobile}
              onClick={() => setPage(item.id)}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="my-2 mx-2 border-t border-[var(--color-sidebar-border)]" />

        {/* ADMIN */}
        <NavItem
          item={NAV[6]}
          active={page === 'admin'}
          collapsed={collapsed}
          isMobile={isMobile}
          onClick={() => setPage('admin')}
        />
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--color-sidebar-border)] pb-safe">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="flex h-10 w-full items-center justify-center text-[var(--color-sidebar-text-muted)] transition-colors hover:bg-[var(--color-sidebar-bg-hover)] hover:text-white"
            title="Espandi sidebar"
          >
            <ChevronsRight size={14} strokeWidth={2} />
          </button>
        ) : (
          <div className="flex flex-col gap-0.5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-sidebar-text-muted)]">Utente</p>
            <p className="truncate text-[12px] font-medium text-[var(--color-sidebar-text-active)]">Giovanni Papagni</p>
            <p className="text-[10px] text-[var(--color-sidebar-text-muted)]"></p>
          </div>
        )}
      </div>
    </aside>
  )
}

function NavItem({ item, active, collapsed, isMobile, onClick }) {
  const Icon = item.iconCmp
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : ''}
      className={`group flex h-10 items-center gap-2 rounded-md px-2 text-[14px] font-medium transition-colors md:h-8 md:text-[13px] ${
        active
          ? 'bg-[var(--color-sidebar-bg-active)] text-[var(--color-sidebar-text-active)]'
          : 'text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-bg-hover)] hover:text-white'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        className={active ? 'text-white' : 'text-[var(--color-sidebar-text-muted)] group-hover:text-white'}
      />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{item.label}</span>
          {!isMobile && (
            <kbd className={`rounded border px-1 py-0.5 font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100 ${
              active
                ? 'border-white/30 bg-white/10 text-white/80'
                : 'border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text-muted)]'
            }`}>{item.shortcut}</kbd>
          )}
        </>
      )}
    </button>
  )
}
