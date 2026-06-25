import { useState, useEffect } from 'react'
import {
  Wallet, Users, Building2, BarChart3, Car, Trash2, ShieldCheck, Calculator,
  Receipt, ClipboardCheck, Search, ChevronsLeft, ChevronsRight, Menu, X,
  LockKeyhole, Mail, Eye, EyeOff, LogOut, Loader2,
} from 'lucide-react'
import CassaPage from './pages/CassaPage'
import ConteggiPage from './pages/ConteggiPage'
import DebitiBonusPage from './pages/DebitiBonusPage'
import SimulazioniPage from './pages/SimulazioniPage'
import AgentiPage from './pages/AgentiPage'
import LocaliPage from './pages/LocaliPage'
import AnalisiPage from './pages/AnalisiPage'
import AutomezziPage from './pages/AutomezziPage'
import CestinoPage from './pages/CestinoPage'
import AdminPage from './pages/AdminPage'
import { ToastProvider } from './components/Toast'
import { CommandPalette } from './components/CommandPalette'
import { supabase } from './lib/supabase'

const NAV = [
  { id: 'cassa',      label: 'Cassa',      icon: 'Wallet',     iconCmp: Wallet,     hint: 'Movimenti cassa',           component: CassaPage,     shortcut: 'C' },
  { id: 'agenti',     label: 'Agenti',     icon: 'Users',      iconCmp: Users,      hint: 'Gestione agenti e accessi', component: AgentiPage,    shortcut: 'A' },
  { id: 'locali',     label: 'Locali',     icon: 'Building2',  iconCmp: Building2,  hint: 'Locali e change machines',  component: LocaliPage,    shortcut: 'L' },
  { id: 'analisi',    label: 'Analisi',    icon: 'BarChart3',  iconCmp: BarChart3,  hint: 'Riepilogo giornaliero',     component: AnalisiPage,   shortcut: 'N' },
  { id: 'conteggi',   label: 'Conteggi',   icon: 'Calculator', iconCmp: Calculator, hint: 'Conteggi per periodo',      component: ConteggiPage,  shortcut: 'G' },
  { id: 'debiti',     label: 'Debiti & Bonus', icon: 'Receipt', iconCmp: Receipt,   hint: 'Debiti e bonus per locale', component: DebitiBonusPage, shortcut: 'B' },
  { id: 'simulazioni', label: 'Simulazioni', icon: 'ClipboardCheck', iconCmp: ClipboardCheck, hint: 'Simulazioni e richieste', component: SimulazioniPage, shortcut: 'S' },
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
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session || null)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
      setAuthLoading(false)
    })

    return () => {
      active = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setPage('cassa')
    setPaletteOpen(false)
    setMobileNavOpen(false)
  }

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

  if (authLoading) {
    return <AuthLoadingScreen />
  }

  if (!session) {
    return (
      <ToastProvider>
        <LoginScreen />
      </ToastProvider>
    )
  }

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
            session={session}
            onLogout={handleLogout}
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

function AuthLoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <Loader2 size={18} className="animate-spin text-blue-600" />
        <span className="text-sm font-semibold text-slate-700">Caricamento Play Money Admin…</span>
      </div>
    </div>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    if (!cleanEmail || !password) {
      setError('Inserisci email e password.')
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    })
    setLoading(false)

    if (authError) {
      setError('Accesso non riuscito. Controlla email e password.')
    }
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-[#e8f5f8] text-slate-950">
      {/* Sfondo: anteprima app admin sfocata */}
      <div className="pointer-events-none absolute inset-0 opacity-55 blur-[3px] scale-[1.02]">
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
          <aside className="hidden h-full w-[228px] shrink-0 bg-[var(--color-sidebar-bg)] md:flex md:flex-col">
            <div className="flex h-14 items-center gap-2.5 border-b border-[var(--color-sidebar-border)] px-3">
              <img src="/app-icon.png" alt="" className="h-7 w-7 rounded object-contain" draggable={false} />
              <div>
                <p className="text-[13px] font-semibold text-white">Play Money Admin</p>
                <p className="text-[10px] text-slate-400">Versione 3.0</p>
              </div>
            </div>
            <div className="px-2 py-3">
              <div className="h-8 rounded-md border border-white/10 bg-white/5" />
            </div>
            <div className="flex flex-col gap-1 px-2">
              {NAV.slice(0, 9).map((item, idx) => {
                const Icon = item.iconCmp
                return (
                  <div
                    key={item.id}
                    className={`flex h-9 items-center gap-2 rounded-md px-2 ${idx === 0 ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
                  >
                    <Icon size={14} />
                    <span className="text-[12px] font-medium">{item.label}</span>
                  </div>
                )
              })}
              <div className="mx-2 my-2 border-t border-white/10" />
              <div className="flex h-9 items-center gap-2 rounded-md px-2 text-slate-300">
                <ShieldCheck size={14} />
                <span className="text-[12px] font-medium">ADMIN</span>
              </div>
            </div>
          </aside>

          <main className="flex-1 overflow-hidden p-5 md:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="h-7 w-28 rounded-lg bg-slate-900/15" />
                <div className="mt-2 h-4 w-52 rounded-lg bg-slate-900/10" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-28 rounded-lg bg-white/80 shadow-sm" />
                <div className="h-9 w-44 rounded-lg bg-white/80 shadow-sm" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="mb-4 h-12 rounded-xl bg-slate-100" />
              <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-cyan-100" />
                      <div>
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-44 rounded bg-slate-100" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
                      {[0, 1, 2, 3, 4, 5].map((card) => (
                        <div key={card} className="h-20 rounded-xl border border-slate-200 bg-slate-50" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#eaf7fa]/80 via-[#e6f4f7]/70 to-[#dbeafe]/80" />
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-190px] right-[-120px] h-[440px] w-[440px] rounded-full bg-blue-600/15 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[390px] rounded-[34px] border border-white/80 bg-white/88 p-4 shadow-[0_30px_90px_rgba(8,47,73,0.22)] backdrop-blur-2xl sm:p-5"
        >
          <div className="mb-5 overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-slate-950 via-cyan-950 to-cyan-600 px-5 py-7 text-center text-white shadow-[0_24px_55px_rgba(8,145,178,0.28)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/20 bg-white/10 shadow-[inset_0_1px_20px_rgba(255,255,255,0.10)]">
              <img src="/app-icon.png" alt="Play Money Admin" className="h-11 w-11 rounded-xl object-contain" draggable={false} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.48em] text-cyan-100">Play Money</p>
            <h1 className="mt-1 text-[36px] font-black uppercase leading-none tracking-[0.18em] drop-shadow-sm">Admin</h1>
            <p className="mt-3 text-[12px] font-bold text-cyan-50/85">Accesso riservato al pannello amministrativo</p>
          </div>

          <div className="space-y-4 px-1">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Email</span>
              <div className="flex h-[58px] items-center gap-3 rounded-[22px] border border-cyan-900/10 bg-slate-50/90 px-4 shadow-[inset_0_2px_10px_rgba(15,23,42,0.05)] focus-within:border-cyan-600/45 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-500/10">
                <Mail size={18} className="shrink-0 text-cyan-700" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  placeholder="admin@playmoney.com"
                  className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-black text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Password</span>
              <div className="flex h-[58px] items-center gap-3 rounded-[22px] border border-cyan-900/10 bg-slate-50/90 px-4 shadow-[inset_0_2px_10px_rgba(15,23,42,0.05)] focus-within:border-cyan-600/45 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-500/10">
                <LockKeyhole size={18} className="shrink-0 text-cyan-700" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-black text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-cyan-100 hover:text-cyan-800"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <div className="mx-1 mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-slate-950 via-cyan-950 to-cyan-600 text-[14px] font-black uppercase tracking-[0.24em] text-white shadow-[0_18px_34px_rgba(8,145,178,0.28)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={17} />}
            Entra
          </button>
        </form>
      </div>
    </div>
  )
}

function Sidebar({ page, setPage, collapsed, setCollapsed, openPalette, isMobile, onClose, session, onLogout }) {
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
            <p className="text-[10px] leading-tight text-[var(--color-sidebar-text-muted)]">Versione 3.0</p>
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
          {NAV.slice(0, 9).map((item) => (
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
          item={NAV[9]}
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
          <div className="flex flex-col gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-sidebar-text-muted)]">Utente</p>
              <p className="truncate text-[12px] font-medium text-[var(--color-sidebar-text-active)]">{session?.user?.email || 'Admin'}</p>
            </div>
            <button
              onClick={onLogout}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg-hover)]/40 px-2 text-[12px] font-semibold text-[var(--color-sidebar-text)] transition-colors hover:bg-red-500/15 hover:text-red-100"
            >
              <LogOut size={13} strokeWidth={2} />
              Esci
            </button>
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
