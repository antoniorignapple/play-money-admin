import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import {
  Wallet,
  Users,
  Building2,
  BarChart3,
  Car,
  Trash2,
  ShieldCheck,
  Calculator,
  Receipt,
  ClipboardCheck,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  Loader2,
  RefreshCw,
  CalendarDays,
  Route,
} from "lucide-react";
import CassaPage from "./pages/CassaPage";
import ContabilitaCassaPage from "./pages/ContabilitaCassaPage";
import ContabilitaConteggiPage from "./pages/ContabilitaConteggiPage";
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
    label: "CONTABILITÀ CASSA",
    icon: "Landmark",
    iconCmp: Wallet,
    hint: "Trasferimenti e storico Cassa",
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
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [splashReady, setSplashReady] = useState(false);
  const authorizedUserIdRef = useRef(null);

  // iOS PWA: durante splash/login colora anche la safe-area inferiore
  // (quella dell'Home Indicator), che altrimenti può restare bianca.
  useLayoutEffect(() => {
    const authSurface = authLoading || !splashReady || !session;
    const html = document.documentElement;
    const body = document.body;
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    html.classList.toggle("pwa-auth-dark", authSurface);
    body.classList.toggle("pwa-auth-dark", authSurface);

    if (themeMeta) {
      themeMeta.setAttribute("content", authSurface ? "#080704" : "#A87318");
    }

    return () => {
      html.classList.remove("pwa-auth-dark");
      body.classList.remove("pwa-auth-dark");
    };
  }, [authLoading, splashReady, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashReady(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

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
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmd = isMac ? e.metaKey : e.ctrlKey;

      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

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
  const currentLabel = NAV.find((n) => n.id === page)?.label || "Play Money";

  if (authLoading || !splashReady) {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return (
      <ToastProvider>
        <LoginScreen
          externalError={authError}
          onAttempt={() => setAuthError("")}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] min-h-0 w-screen overflow-hidden bg-[var(--app-page-background)] text-[var(--color-text)]">
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
            <img
              src="/app-icon.png"
              alt=""
              className="h-6 w-6 rounded object-contain"
              draggable={false}
            />
            <p className="text-[14px] font-semibold text-white">
              {currentLabel}
            </p>
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
            mobileNavOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
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
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden pt-[calc(48px+env(safe-area-inset-top))] md:pt-0">
          <Current />
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          pages={NAV.map((n) => ({
            id: n.id,
            label: n.label,
            icon: n.icon,
            hint: n.hint,
          }))}
          onNavigate={(item) => setPage(item.id)}
        />
      </div>
    </ToastProvider>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] grid h-[100dvh] min-h-[100dvh] place-items-center overflow-hidden bg-[#080704]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(217,170,70,.20),transparent_30%),radial-gradient(circle_at_50%_110%,rgba(121,77,8,.18),transparent_38%)]" />
      <div className="relative flex flex-col items-center">
        <div className="relative grid h-36 w-36 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full border border-amber-300/20 [animation-duration:2s]" />
          <span className="absolute inset-3 rounded-full bg-amber-400/15 blur-2xl" />
          <div className="relative grid h-28 w-28 place-items-center rounded-full border border-amber-300/20 shadow-[0_28px_70px_-25px_rgba(222,174,72,.8)]">
            <img
              src="/app-icon.png"
              alt="Play Money Admin"
              className="h-20 w-20 rounded-full object-cover"
              draggable={false}
            />
          </div>
        </div>
        <p className="mt-6 text-[10px] font-black tracking-[.34em] text-amber-200/70">
          PLAY MONEY
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-[.22em] text-white">
          ADMIN
        </h1>
        <div className="mt-7 h-[2px] w-44 overflow-hidden rounded-full bg-white/5">
          <span className="block h-full w-1/3 animate-[adminLoad_1.25s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        </div>
      </div>
      <style>{`@keyframes adminLoad{from{transform:translateX(-130%)}to{transform:translateX(400%)}}`}</style>
    </div>
  );
}

function LoginScreen({ externalError = "", onAttempt }) {
  const ADMIN_EMAIL = "admin@playmoney.com";
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const visibleError = error || externalError;

  const handleSubmit = async (event) => {
    event.preventDefault();
    onAttempt?.();
    setError("");
    if (password.length < 4) {
      setError("Inserisci la password amministratore.");
      return;
    }
    setLoading(true);
    let { error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });
    // Compatibilità temporanea con il vecchio PIN durante la migrazione.
    if (authError && /^\d{4}$/.test(password)) {
      const fallback = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: `pm${password}`,
      });
      authError = fallback.error;
    }
    setLoading(false);
    if (authError) {
      setPassword("");
      setError("Password amministratore non corretta.");
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#090805] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(216,168,64,.16),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(129,83,11,.18),transparent_34%),linear-gradient(135deg,#080704,#151006_55%,#080704)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[.035] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:42px_42px]" />

      <main className="relative mx-auto grid min-h-[100dvh] w-full max-w-[1380px] items-center px-4 py-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))] md:grid-cols-[1.15fr_.85fr] md:gap-12 md:px-10 md:pb-7 lg:gap-20 lg:px-16">
        <section className="hidden md:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[.07] px-4 py-2 text-[9px] font-black tracking-[.22em] text-amber-200">
            <ShieldCheck size={14} /> ACCESSO AMMINISTRATIVO PROTETTO
          </div>
          <div className="mt-9 flex items-center gap-6">
            <div className="relative grid h-28 w-28 shrink-0 place-items-center">
              <span className="absolute inset-0 rounded-full border border-amber-300/20" />
              <span className="absolute inset-3 rounded-full bg-amber-300/20 blur-2xl" />
              <span className="absolute inset-2 rounded-full border border-amber-200/10" />
              <img
                src="/app-icon.png"
                alt=""
                className="relative h-[82px] w-[82px] rounded-full object-cover shadow-[0_22px_55px_-18px_rgba(221,171,65,.85)]"
                draggable={false}
              />
            </div>
            <div>
              <p className="text-[12px] font-black tracking-[.38em] text-amber-300">
                PLAY MONEY
              </p>
              <h1 className="mt-1 text-5xl font-black tracking-[.12em] text-white lg:text-6xl">
                ADMIN
              </h1>
            </div>
          </div>
          <p className="mt-8 max-w-xl text-xl font-bold leading-relaxed text-white/80 lg:text-2xl">
            Tutto il controllo operativo,
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-[#e4b951] to-amber-500 bg-clip-text text-transparent">
              in un unico spazio.
            </span>
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {["DATI PROTETTI", "CONTROLLO COMPLETO", "ACCESSO RAPIDO"].map(
              (label, index) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/8 bg-white/[.035] px-4 py-4 backdrop-blur"
                >
                  <p className="text-[9px] font-black tracking-[.12em] text-amber-300/75">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-[10px] font-black leading-relaxed tracking-[.08em] text-white/70">
                    {label}
                  </p>
                </div>
              ),
            )}
          </div>
          <p className="mt-10 text-[9px] font-bold tracking-[.18em] text-white/25">
            PLAY MONEY ADMIN · VERSIONE {APP_VERSION}
          </p>
        </section>

        <section className="mx-auto w-full max-w-[430px]">
          <div className="overflow-hidden rounded-[32px] border border-amber-200/20 bg-white/[.07] shadow-[0_40px_110px_-35px_rgba(0,0,0,.95)] backdrop-blur-2xl">
            <div className="border-b border-white/8 bg-gradient-to-br from-white/[.08] to-amber-300/[.04] px-5 py-6 text-center sm:px-7">
              <div className="relative mx-auto grid h-24 w-24 place-items-center md:hidden">
                <span className="absolute inset-1 rounded-full border border-amber-300/20" />
                <span className="absolute inset-3 rounded-full bg-amber-300/20 blur-xl" />
                <img
                  src="/app-icon.png"
                  alt="Play Money Admin"
                  className="relative h-[70px] w-[70px] rounded-full object-cover shadow-[0_20px_45px_-18px_rgba(221,171,65,.9)]"
                  draggable={false}
                />
              </div>
              <p className="mt-4 text-[9px] font-black tracking-[.3em] text-amber-300 md:mt-0">
                BENTORNATO
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[.1em] text-white">
                ACCESSO ADMIN
              </h2>
              <p className="mt-2 text-xs font-semibold text-white/40">
                Inserisci la password per aprire il pannello.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
              <div>
                <p className="mb-2 text-[9px] font-black tracking-[.2em] text-amber-200/70">
                  UTENTE SELEZIONATO
                </p>
                <div className="flex h-[62px] items-center gap-3 rounded-[20px] border border-amber-300/20 bg-black/25 px-4 shadow-inner">
                  <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#e4b74f] to-[#79500e] text-white">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black tracking-[.12em] text-white">
                      ADMIN
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold tracking-[.1em] text-amber-200/45">
                      AMMINISTRATORE PRINCIPALE
                    </p>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,.1)]" />
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-[9px] font-black tracking-[.2em] text-amber-200/70">
                  PASSWORD AMMINISTRATORE
                </span>
                <div className="relative">
                  <input
                    autoFocus
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      onAttempt?.();
                      setPassword(String(event.target.value || ""));
                      setError("");
                    }}
                    placeholder="Inserisci la password"
                    disabled={loading}
                    className="h-[66px] w-full rounded-[20px] border border-amber-300/15 bg-black/25 px-5 pr-14 text-base font-black text-white outline-none shadow-inner transition placeholder:text-white/20 focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:opacity-60"
                  />
                  <button type="button" aria-label={passwordVisible ? "Nascondi password" : "Mostra password"} onClick={() => setPasswordVisible((value) => !value)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-amber-200/65 hover:bg-white/5">
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] font-semibold text-white/35">
                  Accesso riservato · credenziale personale
                </p>
              </label>

              {visibleError && (
                <div className="rounded-[18px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-xs font-black text-red-200">
                  {visibleError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || password.length < 4}
                className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#f2d477] via-[#d5a33c] to-[#a56d12] text-xs font-black tracking-[.18em] text-[#241704] shadow-[0_22px_48px_-20px_rgba(224,175,65,.75)] transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : (
                  <LockKeyhole size={18} />
                )}
                {loading ? "ACCESSO…" : "ENTRA NEL PANNELLO"}
              </button>
            </form>
          </div>
          <p className="mt-6 text-center text-[9px] font-bold tracking-[.18em] text-white/25 md:hidden">
            PLAY MONEY ADMIN · VERSIONE {APP_VERSION}
          </p>
        </section>
      </main>
    </div>
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
  const [cassaTotale, setCassaTotale] = useState(0);
  const [daRientrare, setDaRientrare] = useState(0);
  const [cassaUpdatedAt, setCassaUpdatedAt] = useState(null);
  const [cassaLoading, setCassaLoading] = useState(false);

  const refreshCassaTotale = useCallback(async () => {
    setCassaLoading(true);
    const { data, error } = await supabase.rpc("get_cassa_totale_attiva");

    if (!error) {
      setCassaTotale(Number(data?.cassa_disponibile || 0));
      setDaRientrare(
        Number(data?.da_riportare || 0) - Number(data?.recuperi || 0),
      );
      setCassaUpdatedAt(new Date());
    }
    setCassaLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(refreshCassaTotale);
    window.addEventListener("cassa-totale-refresh", refreshCassaTotale);
    return () =>
      window.removeEventListener("cassa-totale-refresh", refreshCassaTotale);
  }, [refreshCassaTotale]);

  const cassaTone =
    cassaTotale > 0
      ? "text-emerald-300"
      : cassaTotale < 0
        ? "text-red-300"
        : "text-white";
  const formatSidebarEuro = (value) => {
    const amount = Math.trunc(Number(value) || 0);
    const sign = amount < 0 ? "-" : "";
    const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${sign}${digits} €`;
  };
  const cassaFormatted = formatSidebarEuro(cassaTotale);
  const daRientrareTone =
    daRientrare > 0
      ? "text-yellow-300"
      : daRientrare < 0
        ? "text-red-300"
        : "text-white";
  const daRientrareFormatted = formatSidebarEuro(daRientrare);
  const updatedLabel = cassaUpdatedAt
    ? cassaUpdatedAt.toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "medium",
      })
    : "In attesa di aggiornamento";

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[#3b3020]/70 bg-[radial-gradient(circle_at_12%_5%,rgba(215,174,82,.14),transparent_23%),linear-gradient(180deg,#0d1118_0%,#15130e_48%,#0a0d12_100%)] pt-safe text-white shadow-[24px_0_70px_-34px_rgba(0,0,0,.95)] transition-[width] duration-300 ${collapsed ? "w-[74px]" : "w-[310px] md:w-[296px]"}`}
    >
      <div className="pointer-events-none absolute -left-16 top-12 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-20 h-64 w-64 rounded-full bg-yellow-300/5 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,transparent,#d9aa4c66,transparent)]" />

      <div
        className={`relative flex min-h-[94px] shrink-0 items-center px-4 ${collapsed ? "justify-center px-2" : ""}`}
      >
        <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(229,190,101,.38),transparent)]" />
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-[16px] border border-[#e2bc68]/25 bg-[linear-gradient(145deg,rgba(225,184,91,.18),rgba(255,255,255,.015))] shadow-[0_14px_30px_-18px_rgba(224,182,85,.85)]" />
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
              className="truncate text-[18px] font-extrabold tracking-[-0.02em] text-[#fffaf0]"
              style={{ fontFamily: '"Avenir Next", "Segoe UI", Inter, system-ui, sans-serif' }}
            >
              PLAY MONEY
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p
                className="text-[14px] font-extrabold tracking-[0.04em] text-[#f7ead0]"
                style={{ fontFamily: '"Avenir Next", "Segoe UI", Inter, system-ui, sans-serif' }}
              >
                ADMIN
              </p>
              <span className="text-[14px] font-black tracking-[-0.01em] text-[#e8c775]">
                {APP_VERSION}
              </span>
            </div>
          </div>
        )}

        {isMobile && (
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/8 bg-white/[.035] text-[#e8c36d] transition active:scale-95"
            aria-label="Chiudi menu"
          >
            <X size={17} />
          </button>
        )}

        {!collapsed && !isMobile && (
          <button
            onClick={() => setCollapsed(true)}
            className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[11px] border border-[#c69d4e]/30 bg-black/20 text-[#e0bb68]/70 shadow-[0_8px_20px_rgba(0,0,0,.35)] transition hover:border-[#e2bd69]/60 hover:bg-[#d7aa50]/10 hover:text-[#f3d184]"
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
            className={`flex h-10 w-full items-center gap-3 rounded-[14px] border border-white/[.07] bg-white/[0.028] px-3 text-left text-white/42 transition hover:border-[#d5aa51]/28 hover:bg-white/[0.055] hover:text-white ${collapsed ? "justify-center px-0" : ""}`}
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
              <p className="mb-2 px-2 text-[9px] font-black tracking-[0.24em] text-[#d8b35f]/55">
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
        {!collapsed && (
          <section className="order-first mb-4 shrink-0 overflow-visible rounded-[24px] border border-[#d9b45f]/28 bg-[radial-gradient(circle_at_88%_0%,rgba(239,196,99,.16),transparent_34%),linear-gradient(150deg,rgba(223,184,96,.13),rgba(255,255,255,.025)_48%,rgba(0,0,0,.10))] p-3.5 shadow-[0_20px_48px_-30px_rgba(217,173,77,.9)] backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black tracking-[0.25em] text-[#e8c66e]/60">
                  RIEPILOGO
                </p>
                <p className="mt-0.5 text-[12px] font-extrabold tracking-[0.02em] text-[#fff6dd]">
                  Cassa
                </p>
              </div>
              <button
                type="button"
                onClick={refreshCassaTotale}
                disabled={cassaLoading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border border-[#e4c676]/22 bg-black/20 text-[#f0cc7b] shadow-inner transition hover:border-[#e4c676]/48 hover:bg-[#d5a441]/14 disabled:opacity-50"
                aria-label="Aggiorna Cassa Totale"
                title="Aggiorna Cassa Totale"
              >
                <RefreshCw size={13} className={cassaLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-[16px] border border-white/[.065] bg-black/15 px-3 py-3">
                <p className="text-[7px] font-black uppercase tracking-[0.18em] text-emerald-300/65">
                  Acconti
                </p>
                <p className={`mt-1 truncate text-[19px] font-black tabular-nums tracking-[-0.045em] ${cassaTone}`}>
                  {cassaLoading && !cassaUpdatedAt ? "—" : cassaFormatted}
                </p>
              </div>

              <div className="min-w-0 rounded-[16px] border border-white/[.065] bg-black/15 px-3 py-3">
                <p className={`text-[7px] font-black uppercase tracking-[0.14em] ${daRientrare < 0 ? "text-red-300/70" : "text-yellow-300/70"}`}>
                  Da rientrare
                </p>
                <p className={`mt-1 truncate text-[19px] font-black tabular-nums tracking-[-0.045em] ${daRientrareTone}`}>
                  {cassaLoading && !cassaUpdatedAt ? "—" : daRientrareFormatted}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
              <p className="truncate text-[7px] font-bold uppercase tracking-[0.13em] text-white/28">
                Aggiornato {updatedLabel}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPage("contabilita-cassa")}
                className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[13px] border border-[#e4c676]/22 bg-[#d5a441]/9 px-2 text-[7px] font-black uppercase tracking-[0.09em] text-[#efcc79] transition hover:border-[#e4c676]/48 hover:bg-[#d5a441]/17"
              >
                <Wallet size={12} />
                <span className="truncate">Cont. Cassa</span>
              </button>
              <button
                type="button"
                onClick={() => setPage("contabilita-conteggi")}
                className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[13px] border border-[#e4c676]/22 bg-[#d5a441]/9 px-2 text-[7px] font-black uppercase tracking-[0.08em] text-[#efcc79] transition hover:border-[#e4c676]/48 hover:bg-[#d5a441]/17"
              >
                <Calculator size={12} />
                <span className="truncate">Cont. Conteggi</span>
              </button>
            </div>
          </section>
        )}
      </nav>

      <div className="relative shrink-0 border-t border-white/8 p-3 pb-safe">
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="flex h-11 w-full items-center justify-center rounded-[15px] border border-white/8 bg-white/[0.035] text-white/45 hover:text-[#efc872]"
            title="Espandi"
          >
            <ChevronsRight size={17} />
          </button>
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.035] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#d3aa55]/25 bg-[#d3aa55]/10 text-[12px] font-black text-[#efca77]">
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
      className={`group relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-[16px] px-3 text-[13px] font-black transition-all duration-200 ${active ? "border border-[#e1bd6b]/45 bg-[linear-gradient(135deg,#f7e4ad_0%,#c7902d_100%)] text-[#281b08] shadow-[0_14px_28px_-17px_rgba(207,157,61,.78)]" : "border border-transparent text-white/58 hover:border-white/8 hover:bg-white/[0.045] hover:text-white"} ${collapsed ? "justify-center px-0" : ""}`}
    >
      {active && (
        <>
          <div className="absolute inset-0 bg-white/10" />
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/80" />
        </>
      )}
      <div
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${active ? "bg-white/35 text-[#5d3b09]" : "bg-white/[0.045] text-white/38 group-hover:text-[#edc66e]"}`}
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
              className={`relative text-[9px] ${active ? "text-[#5a3a0c]/45" : "text-white/18"}`}
            >
              {item.shortcut}
            </span>
          )}
        </>
      )}
    </button>
  );
}
