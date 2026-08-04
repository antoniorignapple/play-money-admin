import { useState, useEffect, useCallback } from 'react'
import {
  Wallet, Users, Building2, BarChart3, Car, Trash2, ShieldCheck, Calculator,
  Receipt, ClipboardCheck, Search, ChevronsLeft, ChevronsRight, Menu, X,
  LockKeyhole, Mail, Eye, EyeOff, LogOut, Loader2, RefreshCw,
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
import { ToastProvider } from './components/Toast'
import { CommandPalette } from './components/CommandPalette'
import { supabase } from './lib/supabase'

const NAV = [
  { id: 'cassa',       label: 'CASSA',               icon: 'Wallet',         iconCmp: Wallet,         hint: 'Movimenti cassa',           component: CassaPage,       shortcut: 'C' },
  { id: 'analisi',     label: 'ANALISI GIORNALIERA', icon: 'BarChart3',      iconCmp: BarChart3,      hint: 'Riepilogo giornaliero',     component: AnalisiPage,     shortcut: 'N' },
  { id: 'conteggi',    label: 'CONTEGGI',            icon: 'Calculator',     iconCmp: Calculator,     hint: 'Conteggi per periodo',      component: ConteggiPage,    shortcut: 'G' },
  { id: 'debiti',      label: 'DEBITI E BONUS',      icon: 'Receipt',        iconCmp: Receipt,        hint: 'Debiti e bonus per locale', component: DebitiBonusPage, shortcut: 'B' },
  { id: 'simulazioni', label: 'SIMULAZIONI',         icon: 'ClipboardCheck', iconCmp: ClipboardCheck, hint: 'Simulazioni e richieste',    component: SimulazioniPage,shortcut: 'S' },
  { id: 'agenti',      label: 'AGENTI',               icon: 'Users',          iconCmp: Users,          hint: 'Gestione agenti e accessi', component: AgentiPage,      shortcut: 'A' },
  { id: 'locali',      label: 'LOCALI',               icon: 'Building2',      iconCmp: Building2,      hint: 'Locali e change machines',  component: LocaliPage,      shortcut: 'L' },
  { id: 'automezzi',   label: 'AUTOMEZZI',            icon: 'Car',            iconCmp: Car,            hint: 'Km, mezzi e rifornimenti',  component: AutomezziPage,   shortcut: 'M' },
  { id: 'cestino',     label: 'CESTINO',              icon: 'Trash2',         iconCmp: Trash2,         hint: 'Movimenti cancellati',      component: CestinoPage,     shortcut: 'T' },
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
                <p className="text-[10px] text-slate-400">Versione 6.5</p>
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
  const groups = [
    { label: 'OPERATIVITÀ', ids: ['cassa', 'analisi', 'conteggi', 'debiti', 'simulazioni'] },
    { label: 'CONTROLLO', ids: ['agenti', 'locali', 'automezzi', 'cestino'] },
  ]
  const [cassaTotale, setCassaTotale] = useState(0)
  const [cassaUpdatedAt, setCassaUpdatedAt] = useState(null)
  const [cassaLoading, setCassaLoading] = useState(false)

  const refreshCassaTotale = useCallback(async () => {
    setCassaLoading(true)
    const { data, error } = await supabase
      .from('movements_cassa')
      .select('acconto, recupero, da_riportare')
      .is('deleted_at', null)

    if (!error) {
      const totale = (data || []).reduce(
        (sum, row) => sum + Number(row.acconto || 0) + Number(row.recupero || 0) - Number(row.da_riportare || 0),
        0,
      )
      setCassaTotale(totale)
      setCassaUpdatedAt(new Date())
    }
    setCassaLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(refreshCassaTotale)
    window.addEventListener('cassa-totale-refresh', refreshCassaTotale)
    return () => window.removeEventListener('cassa-totale-refresh', refreshCassaTotale)
  }, [refreshCassaTotale])

  const cassaTone = cassaTotale > 0 ? 'text-emerald-300' : cassaTotale < 0 ? 'text-red-300' : 'text-white'
  const cassaFormatted = new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cassaTotale)
  const updatedLabel = cassaUpdatedAt
    ? cassaUpdatedAt.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' })
    : 'In attesa di aggiornamento'

  return (
    <aside className={`relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[#2f291f] bg-[linear-gradient(180deg,#11151d_0%,#17130d_52%,#0c1017_100%)] pt-safe text-white shadow-[18px_0_50px_-28px_rgba(0,0,0,.8)] transition-[width] duration-300 ${collapsed ? 'w-[72px]' : 'w-[292px] md:w-[272px]'}`}>
      <div className="pointer-events-none absolute -left-16 top-12 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-64 w-64 rounded-full bg-yellow-300/5 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,transparent,#d9aa4c66,transparent)]" />

      <div className={`relative flex min-h-[86px] shrink-0 items-center gap-3 border-b border-white/8 px-4 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[17px] border border-[#d8b764]/40 bg-[linear-gradient(145deg,#fff8df,#c99432)] shadow-[0_16px_30px_-16px_rgba(215,171,75,.75)]">
          <img src="/app-icon.png" alt="" className="relative z-10 h-10 w-10 object-contain" draggable={false} />
          <div className="absolute inset-0 bg-white/10" />
        </div>
        {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-black tracking-[0.04em] text-white">PLAY MONEY</p><div className="mt-1 flex items-center gap-2"><span className="rounded-full border border-[#e1bb68]/40 bg-[#d5a441]/15 px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#f0cc7b]">ADMIN</span><span className="text-[10px] font-bold text-white/100">Ver. 6.5</span></div></div>}
        {isMobile && <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-white/70 active:scale-95" aria-label="Chiudi menu"><X size={18}/></button>}
        {!collapsed && !isMobile && <button onClick={() => setCollapsed(true)} className="flex h-9 w-9 items-center justify-center rounded-[13px] border border-white/8 bg-white/[0.035] text-white/45 transition hover:border-[#d7ad55]/30 hover:text-[#efc872]" title="Comprimi"><ChevronsLeft size={16}/></button>}
      </div>

      {!isMobile && <div className="relative px-3 py-3"><button onClick={openPalette} className={`flex h-11 w-full items-center gap-3 rounded-[15px] border border-white/8 bg-white/[0.035] px-3 text-left text-white/45 transition hover:border-[#d5aa51]/25 hover:bg-white/[0.06] hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}><Search size={16}/>{!collapsed && <><span className="flex-1 text-[12px] font-bold">Cerca nell'app</span><kbd className="rounded-lg border border-white/10 bg-black/20 px-1.5 py-1 font-mono text-[9px] text-white/35">{cmdKey}K</kbd></>}</button></div>}

      <nav className="relative flex-1 overflow-y-auto px-3 pb-3 no-scrollbar">
        {groups.map((group, gi) => <div key={group.label} className={gi ? 'mt-5' : ''}>
          {!collapsed && <p className="mb-2 px-2 text-[9px] font-black tracking-[0.24em] text-[#d8b35f]/55">{group.label}</p>}
          <div className="space-y-1.5">{group.ids.map(id => { const item=NAV.find(n=>n.id===id); return <NavItem key={id} item={item} active={page===id} collapsed={collapsed} isMobile={isMobile} onClick={()=>setPage(id)}/> })}</div>
        </div>)}
        {!collapsed && (
          <section className="mt-5 overflow-hidden rounded-[22px] border border-[#d9b45f]/30 bg-[linear-gradient(145deg,rgba(217,180,95,.16),rgba(255,255,255,.035))] p-4 shadow-[0_18px_42px_-24px_rgba(215,171,75,.65)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black tracking-[0.24em] text-[#e9c873]/65">CASSA TOTALE</p>
                <p className={`mt-2 truncate text-[27px] font-black tabular-nums tracking-[-0.04em] ${cassaTone}`}>
                  {cassaLoading && !cassaUpdatedAt ? '—' : cassaFormatted}
                </p>
              </div>
              <button type="button" onClick={refreshCassaTotale} disabled={cassaLoading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-[#e4c676]/25 bg-black/20 text-[#f0cc7b] transition hover:border-[#e4c676]/50 hover:bg-[#d5a441]/15 disabled:opacity-50" aria-label="Aggiorna Cassa Totale" title="Aggiorna Cassa Totale">
                <RefreshCw size={15} className={cassaLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="mt-3 border-t border-white/8 pt-3">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/35">Aggiornato alle</p>
              <p className="mt-1 text-[10px] font-bold tabular-nums text-white/60">{updatedLabel}</p>
            </div>
          </section>
        )}
      </nav>

      <div className="relative shrink-0 border-t border-white/8 p-3 pb-safe">
        {collapsed ? <button onClick={() => setCollapsed(false)} className="flex h-11 w-full items-center justify-center rounded-[15px] border border-white/8 bg-white/[0.035] text-white/45 hover:text-[#efc872]" title="Espandi"><ChevronsRight size={17}/></button> : <div className="overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.035] p-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#d3aa55]/25 bg-[#d3aa55]/10 text-[12px] font-black text-[#efca77]">AD</div><div className="min-w-0 flex-1"><p className="text-[9px] font-black tracking-[0.18em] text-white/35">AMMINISTRATORE</p><p className="mt-0.5 truncate text-[11px] font-bold text-white/80">{session?.user?.email || 'Admin'}</p></div></div><button onClick={onLogout} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[12px] border border-white/8 bg-black/15 text-[11px] font-black tracking-[0.08em] text-white/55 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-200"><LogOut size={14}/>ESCI</button></div>}
      </div>
    </aside>
  )
}

function NavItem({ item, active, collapsed, isMobile, onClick }) {
  const Icon = item.iconCmp
  return (
    <button onClick={onClick} title={collapsed ? item.label : ''} className={`group relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-[16px] px-3 text-[13px] font-black transition-all duration-200 ${active ? 'border border-[#e1bd6b]/45 bg-[linear-gradient(135deg,#f7e4ad_0%,#c7902d_100%)] text-[#281b08] shadow-[0_14px_28px_-17px_rgba(207,157,61,.78)]' : 'border border-transparent text-white/58 hover:border-white/8 hover:bg-white/[0.045] hover:text-white'} ${collapsed ? 'justify-center px-0' : ''}`}>
      {active && <><div className="absolute inset-0 bg-white/10"/><div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/80"/></>}
      <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${active ? 'bg-white/35 text-[#5d3b09]' : 'bg-white/[0.045] text-white/38 group-hover:text-[#edc66e]'}`}><Icon size={17} strokeWidth={2}/></div>
      {!collapsed && <><span className="relative flex-1 text-left tracking-[0.025em]">{item.label}</span>{!isMobile && <span className={`relative text-[9px] ${active ? 'text-[#5a3a0c]/45' : 'text-white/18'}`}>{item.shortcut}</span>}</>}
    </button>
  )
}
