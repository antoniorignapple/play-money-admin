import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { APP_VERSION } from '../config/release';

export function LoginView({ externalError = '', onAttempt }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ready = password.length >= 4 && !loading;
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const previous = { html: html.style.background, body: body.style.background };
    html.style.background = '#000'; body.style.background = '#000';
    return () => { html.style.background = previous.html; body.style.background = previous.body; };
  }, []);
  async function handleSubmit(event) {
    event.preventDefault();
    if (!ready) return;
    onAttempt?.(); setError(''); setLoading(true);
    try {
      let result = await supabase.auth.signInWithPassword({ email: 'admin@playmoney.com', password });
      // Existing Admin compatibility: keep four-digit legacy PINs working.
      if (result.error && /^\d{4}$/.test(password)) {
        result = await supabase.auth.signInWithPassword({ email: 'admin@playmoney.com', password: `pm${password}` });
      }
      if (result.error) { setError('Password amministratore non corretta.'); setPassword(''); }
    } catch { setError('Accesso non riuscito. Controlla la connessione e riprova.'); }
    finally { setLoading(false); }
  }
  return (
    <div className="pm-login-screen fixed inset-0 z-[9998] min-h-[100svh] w-screen overflow-y-auto overscroll-none bg-black px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="pm-login-grain pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="pm-login-shell relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[390px] flex-col pb-[max(18px,env(safe-area-inset-bottom))]">
        <header className="pm-login-brand flex flex-col items-center text-center">
          <img src="/app-icon.png" alt="Play Money Admin" draggable="false" className="pm-login-brand-logo select-none object-contain drop-shadow-[0_15px_24px_rgba(0,0,0,.95)]" />
          <div className="pm-login-access flex items-center gap-2">
            <span className="h-px w-7 bg-[linear-gradient(90deg,transparent,#1e618a)]" />
            <p className="text-[9px] font-black uppercase tracking-[.34em] text-[#488eb9]">Accesso amministratore</p>
            <span className="h-px w-7 bg-[linear-gradient(90deg,#1e618a,transparent)]" />
          </div>
          <p className="mt-3 text-[13px] font-black tracking-[-.01em] text-white/90">Bentornato</p>
          <p className="mt-1 text-[10px] font-bold text-white/45">Accedi al tuo profilo per iniziare la giornata.</p>
        </header>
        <form onSubmit={handleSubmit} className="pm-login-form relative mt-7 space-y-4 rounded-[27px] border border-[#2c688e]/35 bg-[#080807]/92 p-4 shadow-[0_28px_80px_-38px_rgba(196,146,47,.32)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-7 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(111,187,235,.72),transparent)]" />
          <div className="relative z-30">
            <label htmlFor="pm-login-admin" className="mb-2 block text-[9px] font-black uppercase tracking-[.24em] text-[#5d9dc5]">Amministratore</label>
            <div className="relative h-[56px] overflow-hidden rounded-[18px] border border-[#3686b8]/55 bg-[#0d0f11]">
              <select id="pm-login-admin" value="admin" onChange={() => {}} disabled={loading} className="absolute inset-0 h-full w-full appearance-none border-0 bg-transparent px-4 pr-12 text-[16px] font-black text-[#eaf6fd] outline-none">
                <option value="admin" className="bg-black text-white">ADMIN</option>
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#569cc7]"><ChevronDown size={19}/></span>
            </div>
          </div>
          <div>
            <label htmlFor="pm-login-password" className="mb-2 block text-[9px] font-black uppercase tracking-[.24em] text-[#5d9dc5]">Password personale</label>
            <div className="relative">
              <input id="pm-login-password" type="text" autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError(''); onAttempt?.(); }} className="h-[56px] w-full rounded-[18px] border border-white/[.09] bg-[#0c0c0b] px-4 text-center text-[21px] font-black tracking-[.15em] text-[#eaf6fd] caret-[#50a1d3] outline-none transition placeholder:text-white/18 focus:border-[#3686b8]/60 focus:ring-2 focus:ring-[#3686b8]/10" required minLength={4} disabled={loading} aria-describedby={error || externalError ? 'pm-login-error' : undefined} />
            </div>
          </div>
          {(error || externalError) && <div id="pm-login-error" role="alert" className="rounded-[16px] border border-rose-400/20 bg-rose-500/[.09] px-3 py-2.5 text-center text-[12px] font-black text-rose-200">{error || externalError}</div>}
          <button type="submit" disabled={!ready} className={`relative flex h-[56px] w-full items-center justify-center gap-2 overflow-hidden rounded-[18px] text-[13px] font-black uppercase tracking-[.16em] transition active:scale-[.985] disabled:cursor-not-allowed ${ready || loading ? 'bg-[linear-gradient(135deg,#7cc4f0_0%,#2683bd_48%,#135279_100%)] text-[#061017] shadow-[0_18px_40px_-20px_rgba(212,167,67,.72)]' : 'bg-[#1b2124] text-white/35'}`}>
            {(ready || loading) && <span className="pm-login-button-shine pointer-events-none absolute inset-y-0 w-20 bg-white/25 blur-md" />}
            {loading ? <><Loader2 size={19} className="animate-spin"/>Accesso…</> : <><LogIn size={19}/>Accedi</>}
          </button>
        </form>
        <footer className="pm-login-footer mt-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#79c2f0]">Versione {APP_VERSION}</p>
          <p className="mt-1.5 text-[9px] font-black uppercase tracking-[.16em] text-white/70">PLAY MONEY ADMIN</p>
        </footer>
      </div>

    </div>
  );
}

