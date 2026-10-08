import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  Wallet,
  Users,
  Building2,
  BarChart3,
  Car,
  Trash2,
  Calculator,
  Receipt,
  ClipboardCheck,
  Search,
  ChevronsLeft,
  ChevronsRight,
  X,
  LogOut,
  CalendarDays,
  Route,
} from "lucide-react";
import CassaPage from "./pages/CassaPage";
import ContabilitaCassaPage from "./pages/ContabilitaCassaPage";
import ContabilitaConteggiPage from "./pages/PeriodAccountingPage";
import { OfficeCashProvider } from "./components/OfficeCashContext";
import { CashSidebarCard } from "./components/AccountingUI";
import ConteggiPage from "./pages/ConteggiPage";
import DebitiBonusPage from "./pages/DebitiBonusPage";
import CalendarioConteggiPage from "./pages/CalendarioConteggiPage";
import SimulazioniPage from "./pages/SimulazioniPage";
import AgentiPage from "./pages/AgentiPage";
import LocaliPage from "./pages/LocaliPage";
import AnalisiPage from "./pages/AnalisiPage";
import AutomezziPage from "./pages/AutomezziPage";
import CestinoPage from "./pages/CestinoPage";
import GiriPage from "./pages/GiriPage";
import { ToastProvider } from "./components/Toast";
import { CommandPalette } from "./components/CommandPalette";
import { supabase } from "./lib/supabase";
import { MobileNavigation } from "./components/MobileNavigation";
import { LoginView } from "./components/LoginView";
import { SplashLogo } from "./components/SplashLogo";
import { APP_VERSION } from "./config/release";

const NAV = [
  {
    id: "analisi",
    label: "ANALISI GIORNALIERA",
    icon: "BarChart3",
    iconCmp: BarChart3,
    hint: "Riepilogo giornaliero",
    component: AnalisiPage,
    shortcut: "N",
  },
  {
    id: "cassa",
    label: "CASSA",
    icon: "Wallet",
    iconCmp: Wallet,
    hint: "Movimenti cassa",
    component: CassaPage,
    shortcut: "C",
  },
  {
    id: "contabilita-cassa",
    label: "CASSA UFFICIO",
    icon: "Landmark",
    iconCmp: Wallet,
    hint: "Fondo, acconti, rientri e residuo azienda",
    component: ContabilitaCassaPage,
  },
  {
    id: "contabilita-conteggi",
    label: "CONTABILITÀ CONTEGGI",
    icon: "Calculator",
    iconCmp: Calculator,
    hint: "Contabilità del periodo conteggi",
    component: ContabilitaConteggiPage,
  },
  {
    id: "conteggi",
    label: "CONTEGGI",
    icon: "Calculator",
    iconCmp: Calculator,
    hint: "Conteggi per periodo",
    component: ConteggiPage,
    shortcut: "G",
  },
  {
    id: "calendario",
    label: "CALENDARIO",
    icon: "CalendarDays",
    iconCmp: CalendarDays,
    hint: "Programma i giorni di conteggio",
    component: CalendarioConteggiPage,
    shortcut: "D",
  },
  {
    id: "debiti",
    label: "DEBITI E BONUS",
    icon: "Receipt",
    iconCmp: Receipt,
    hint: "Debiti e bonus per locale",
    component: DebitiBonusPage,
    shortcut: "B",
  },
  {
    id: "simulazioni",
    label: "SIMULAZIONI",
    icon: "ClipboardCheck",
    iconCmp: ClipboardCheck,
    hint: "Simulazioni e richieste",
    component: SimulazioniPage,
    shortcut: "S",
  },
  {
    id: "agenti",
    label: "AGENTI",
    icon: "Users",
    iconCmp: Users,
    hint: "Gestione agenti e accessi",
    component: AgentiPage,
    shortcut: "A",
  },
  {
    id: "locali",
    label: "LOCALI",
    icon: "Building2",
    iconCmp: Building2,
    hint: "Locali e change machines",
    component: LocaliPage,
    shortcut: "L",
  },
  {
    id: "giri",
    label: "GIRI",
    icon: "Route",
    iconCmp: Route,
    hint: "Assegnazione locali ai giri",
    component: GiriPage,
    shortcut: "R",
  },
  {
    id: "automezzi",
    label: "AUTOMEZZI",
    icon: "Car",
    iconCmp: Car,
    hint: "Km, mezzi e rifornimenti",
    component: AutomezziPage,
    shortcut: "M",
  },
  {
    id: "cestino",
    label: "CESTINO",
    icon: "Trash2",
    iconCmp: Trash2,
    hint: "Movimenti cancellati",
    component: CestinoPage,
    shortcut: "T",
  },
];

export default function App() {
  const [page, setPage] = useState("analisi");
  const [accountingPeriodId, setAccountingPeriodId] = useState("");
  const [returnPeriodId, setReturnPeriodId] = useState("");
  function openAccounting(periodId) { setAccountingPeriodId(periodId); setPage("contabilita-conteggi"); }
  function backToConteggi(periodId) { setReturnPeriodId(periodId); setPage("conteggi"); }
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [splashReady, setSplashReady] = useState(false);
  const authorizedUserIdRef = useRef(null);
  const splashAuthenticated = Boolean(session);

  // iOS PWA: durante splash/login colora anche la safe-area inferiore
  // (quella dell'Home Indicator), che altrimenti può restare bianca.
  useLayoutEffect(() => {
    const authSurface = authLoading || !splashReady || !session;
    const html = document.documentElement;
    const body = document.body;
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    html.classList.toggle("pwa-auth-light", authSurface);
    body.classList.toggle("pwa-auth-light", authSurface);

    if (themeMeta) {
      themeMeta.setAttribute("content", authSurface ? "#f5faff" : "#e8f1f7");
    }

    return () => {
      html.classList.remove("pwa-auth-light");
      body.classList.remove("pwa-auth-light");
    };
  }, [authLoading, splashReady, session]);

  useEffect(() => {
    if (authLoading) return;
    const timer = window.setTimeout(() => setSplashReady(true), splashAuthenticated ? 1250 : 1450);
    return () => window.clearTimeout(timer);
  }, [authLoading, splashAuthenticated]);

  useEffect(() => {
    let active = true;
    let validationId = 0;

    const rejectSession = (message) => {
      authorizedUserIdRef.current = null;
      setSession(null);
      setAuthError(message);
      setAuthLoading(false);
      void supabase.auth.signOut({ scope: "local" });
    };

    const validateAdminSession = async (candidateSession) => {
      const currentValidationId = ++validationId;

      if (!candidateSession) {
        if (!active || currentValidationId !== validationId) return;
        authorizedUserIdRef.current = null;
        setSession(null);
        setAuthLoading(false);
        return;
      }

      const isAlreadyAuthorized =
        authorizedUserIdRef.current === candidateSession.user?.id;
      if (!isAlreadyAuthorized) {
        setSession(null);
        setSplashReady(false);
        setAuthLoading(true);
      }

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser(candidateSession.access_token);

        if (!active || currentValidationId !== validationId) return;
        if (userError || !userData?.user) {
          rejectSession("Sessione non valida o scaduta. Accedi nuovamente.");
          return;
        }

        const { data: isAdmin, error: roleError } = await supabase.rpc(
          "is_play_money_admin_secure",
        );

        if (!active || currentValidationId !== validationId) return;
        if (roleError) {
          rejectSession(
            "Impossibile verificare l'autorizzazione Admin. Riprova tra poco.",
          );
          return;
        }
        if (isAdmin !== true) {
          rejectSession("Questo account non è autorizzato ad aprire Play Money Admin.");
          return;
        }

        authorizedUserIdRef.current = userData.user.id;
        setAuthError("");
        setSession(candidateSession);
        setAuthLoading(false);
      } catch {
        if (!active || currentValidationId !== validationId) return;
        rejectSession(
          "Verifica di sicurezza non riuscita. Controlla la connessione e riprova.",
        );
      }
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        rejectSession("Impossibile verificare la sessione. Accedi nuovamente.");
        return;
      }
      void validateAdminSession(data.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        queueMicrotask(() => {
          if (active) void validateAdminSession(nextSession || null);
        });
      },
    );

    return () => {
      active = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPage("analisi");
    setPaletteOpen(false);
    setMobileNavOpen(false);
  };

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close drawer when page changes on mobile
  useEffect(() => {
    setMobileNavOpen(false);
  }, [page]);

  // Keyboard shortcuts (solo desktop)
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented) return;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmd = isMac ? e.metaKey : e.ctrlKey;

      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.target?.isContentEditable) return;

      if (cmd && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
        return;
      }

      if (!cmd && !e.altKey && !e.shiftKey) {
        const k = e.key.toUpperCase();
        const target = NAV.find((n) => n.shortcut === k);
        if (target) {
          e.preventDefault();
          setPage(target.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Current = NAV.find((n) => n.id === page)?.component || AnalisiPage;

  if (authLoading || !splashReady) {
    return <SplashLogo loginDestination={!authLoading && !session} appDestination={!authLoading && Boolean(session)} />;
  }

  if (!session) {
    return (
      <ToastProvider>
        <LoginView
          externalError={authError}
          onAttempt={() => setAuthError("")}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <OfficeCashProvider>
      <div className="pm-admin-shell flex h-[100dvh] min-h-0 w-screen overflow-hidden bg-[var(--app-page-background)] text-[var(--color-text)]">
        {isMobile ? (
          <MobileNavigation page={page} pages={NAV} onNavigate={setPage}
            open={mobileNavOpen} onOpenChange={setMobileNavOpen}
            onSearch={() => setPaletteOpen(true)} onLogout={handleLogout} />
        ) : (
          <Sidebar page={page} setPage={setPage} collapsed={collapsed}
            setCollapsed={setCollapsed} openPalette={() => setPaletteOpen(true)}
            isMobile={false} session={session} onLogout={handleLogout} />
        )}

        {/* MAIN: con padding-top su mobile per topbar */}
        <main className="pm-admin-main min-h-0 min-w-0 flex-1 overflow-hidden" data-page={page}>
          <Current initialPeriodId={page === "contabilita-conteggi" ? accountingPeriodId : returnPeriodId} onOpenAccounting={openAccounting} onBack={backToConteggi} />
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          pages={NAV.filter(n => n.id !== "contabilita-conteggi").map((n) => ({
            id: n.id,
            label: n.label,
            icon: n.icon,
            hint: n.hint,
          }))}
          onNavigate={(item) => setPage(item.id)}
        />
      </div>
      </OfficeCashProvider>
    </ToastProvider>
  );
}

function Sidebar({
  page,
  setPage,
  collapsed,
  setCollapsed,
  openPalette,
  isMobile,
  onClose,
  session,
  onLogout,
}) {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().includes("MAC");
  const cmdKey = isMac ? "⌘" : "Ctrl";
  const groups = [
    {
      label: "OPERATIVITÀ",
      ids: [
        "analisi",
        "cassa",
        "conteggi",
        "calendario",
        "debiti",
        "simulazioni",
      ],
    },
    {
      label: "CONTROLLO",
      ids: ["agenti", "locali", "giri", "automezzi", "cestino"],
    },
  ];

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[#20313b]/70 bg-[radial-gradient(circle_at_12%_5%,rgba(82,164,215,.14),transparent_23%),linear-gradient(180deg,#0d1118_0%,#0e1215_48%,#0a0d12_100%)] pt-safe text-white shadow-[24px_0_70px_-34px_rgba(0,0,0,.95)] transition-[width] duration-300 ${collapsed ? "w-[74px]" : "w-[310px] md:w-[296px]"}`}
    >
      <div className="pointer-events-none absolute -left-16 top-12 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-64 w-64 rounded-full bg-sky-300/5 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,transparent,#d9aa4c66,transparent)]" />

      <div
        className={`relative flex min-h-[94px] shrink-0 items-center px-4 ${collapsed ? "justify-center px-2" : ""}`}
      >
        <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(101,180,229,.38),transparent)]" />
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-[16px] border border-[#68b3e2]/25 bg-[linear-gradient(145deg,rgba(91,174,225,.18),rgba(255,255,255,.015))] shadow-[0_14px_30px_-18px_rgba(224,182,85,.85)]" />
          <img
            src="/app-icon.png"
            alt="Play Money"
            className="relative z-10 h-9 w-9 rounded-[11px] object-cover"
            draggable={false}
          />
        </div>

                {!collapsed && (
          <div className="ml-3 min-w-0 flex-1">
            <p
              className="truncate text-[18px] font-extrabold tracking-[-0.02em] text-[#f1f9fe]"
              style={{ fontFamily: '"Avenir Next", "Segoe UI", Inter, system-ui, sans-serif' }}
            >
              PLAY MONEY
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p
                className="text-[14px] font-extrabold tracking-[0.04em] text-[#d0e8f7]"
                style={{ fontFamily: '"Avenir Next", "Segoe UI", Inter, system-ui, sans-serif' }}
              >
                ADMIN
              </p>
              <span className="text-[14px] font-black tracking-[-0.01em] text-[#75bce8]">
                {APP_VERSION}
              </span>
            </div>
          </div>
        )}

        {isMobile && (
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/8 bg-white/[.035] text-[#6db9e8] transition active:scale-95"
            aria-label="Chiudi menu"
          >
            <X size={17} />
          </button>
        )}

        {!collapsed && !isMobile && (
          <button
            onClick={() => setCollapsed(true)}
            className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[11px] border border-[#4e98c6]/30 bg-black/20 text-[#68b2e0]/70 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:border-[#69b4e2]/60 hover:bg-[#50a3d7]/10 hover:text-[#84c8f3]"
            title="Comprimi"
          >
            <ChevronsLeft size={14} />
          </button>
        )}
      </div>

      {!isMobile && (
        <div className="relative px-3 py-2.5">
          <button
            onClick={openPalette}
            className={`flex h-10 w-full items-center gap-3 rounded-[14px] border border-white/[.07] bg-white/[0.028] px-3 text-left text-white/42 transition hover:border-[#51a2d5]/28 hover:bg-white/[0.055] hover:text-white ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Search size={16} />
            {!collapsed && (
              <>
                <span className="flex-1 text-[12px] font-bold">
                  Cerca nell'app
                </span>
                <kbd className="rounded-lg border border-white/10 bg-black/20 px-1.5 py-1 font-mono text-[9px] text-white/35">
                  {cmdKey}K
                </kbd>
              </>
            )}
          </button>
        </div>
      )}

      <nav className="relative flex flex-1 flex-col overflow-y-auto px-3 pb-3 pt-0.5 no-scrollbar">
        {groups.map((group, gi) => (
          <div key={group.label} className={gi ? "mt-5" : ""}>
            {!collapsed && (
              <p className="mb-2 px-2 text-[9px] font-black tracking-[0.24em] text-[#5faad8]/55">
                {group.label}
              </p>
            )}
            <div className="space-y-1.5">
              {group.ids.map((id) => {
                const item = NAV.find((n) => n.id === id);
                return (
                  <NavItem
                    key={id}
                    item={item}
                    active={page === id}
                    collapsed={collapsed}
                    isMobile={isMobile}
                    onClick={() => setPage(id)}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <CashSidebarCard collapsed={collapsed} onOpen={() => setPage("contabilita-cassa")} />
      </nav>

      <div className="relative shrink-0 border-t border-white/8 p-3 pb-safe">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="flex h-11 w-full items-center justify-center rounded-[15px] border border-white/8 bg-white/[0.035] text-white/45 hover:text-[#72bfef]"
            title="Espandi"
          >
            <ChevronsRight size={17} />
          </button>
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.035] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#55a3d3]/25 bg-[#55a3d3]/10 text-[12px] font-black text-[#77c1ef]">
                AD
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black tracking-[0.18em] text-white/35">
                  AMMINISTRATORE
                </p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-white/80">
                  {session?.user?.email || "Admin"}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[12px] border border-white/8 bg-black/15 text-[11px] font-black tracking-[0.08em] text-white/55 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut size={14} />
              ESCI
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({ item, active, collapsed, isMobile, onClick }) {
  const Icon = item.iconCmp;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : ""}
      className={`group relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-[16px] px-3 text-[13px] font-black transition-all duration-200 ${active ? "border border-[#6bb4e1]/45 bg-[linear-gradient(135deg,#addbf7_0%,#2d8cc7_100%)] text-[#081c28] shadow-[0_14px_28px_-17px_rgba(207,157,61,.78)]" : "border border-transparent text-white/58 hover:border-white/8 hover:bg-white/[0.045] hover:text-white"} ${collapsed ? "justify-center px-0" : ""}`}
    >
      {active && (
        <>
          <div className="absolute inset-0 bg-white/10" />
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/80" />
        </>
      )}
      <div
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${active ? "bg-white/35 text-[#093d5d]" : "bg-white/[0.045] text-white/38 group-hover:text-[#6ebced]"}`}
      >
        <Icon size={17} strokeWidth={2} />
      </div>
      {!collapsed && (
        <>
          <span className="relative flex-1 text-left tracking-[0.025em]">
            {item.label}
          </span>
          {!isMobile && (
            <span
              className={`relative text-[9px] ${active ? "text-[#0c3c5a]/45" : "text-white/18"}`}
            >
              {item.shortcut}
            </span>
          )}
        </>
      )}
    </button>
  );
}
