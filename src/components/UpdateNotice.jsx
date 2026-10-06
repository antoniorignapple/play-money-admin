/* global __APP_BUILD_ID__ */
import { updateBlockReason, freezeWritesForUpdate } from '../lib/updateSafety.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, DownloadCloud, RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { APP_VERSION, RELEASE } from '../config/release.js';

// Durante l'uso continuo una nuova versione viene rilevata entro circa 5 minuti.
const UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_CHECK_THROTTLE_MS = 30 * 1000;
const UPDATED_FLAG = 'pm_admin_pwa_update_completed_v1';
const BUILD_STORAGE_KEY = 'pm_admin_last_opened_build_v1';
const ACCEPTED_BUILD_KEY = 'pm_admin_pwa_accepted_build_v1';

const CURRENT_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined'
    ? __APP_BUILD_ID__
    : 'development';

const isEditableElement = (element) => {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
};

const ReleaseNotes = ({ release = RELEASE, compact = false }) => (
  <div className={`rounded-[16px] border border-[#c4ddeb] bg-[#f3faff] ${compact ? 'p-3' : 'p-3.5'}`}>
    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#246c99]">
      {release.TITLE}
    </p>
    <ul className="mt-2 space-y-1.5 text-[11px] font-bold leading-relaxed text-[#16384d]">
      {release.ITEMS.map((item) => <li key={item} className="flex gap-2"><span className="text-[#246c99]">•</span><span>{item}</span></li>)}
    </ul>
  </div>
);

export default function UpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [updatedToast, setUpdatedToast] = useState(() => {
    try {
      const previousBuild = localStorage.getItem(BUILD_STORAGE_KEY);
      return sessionStorage.getItem(UPDATED_FLAG) === '1' ||
        (Boolean(previousBuild) && previousBuild !== CURRENT_BUILD_ID);
    } catch { return false; }
  });
  const [availableRelease, setAvailableRelease] = useState(RELEASE);

  const registrationRef = useRef(null);
  const updateSWRef = useRef(null);
  const lastCheckRef = useRef(0);
  const applyingRef = useRef(false);
  const wasEditingOnPressRef = useRef(false);

  const loadPublishedRelease = useCallback(async () => {
    try {
      const url = new URL(`release.json?update=${Date.now()}`, document.baseURI);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return;
      const next = await response.json();
      if (next?.VERSION && next?.TITLE && Array.isArray(next?.ITEMS) && next.ITEMS.length) {
        setAvailableRelease(next);
      }
    } catch {
      // Se la rete è instabile, il prompt conserva le note incorporate.
    }
  }, []);

  const checkForUpdate = useCallback(async ({ force = false } = {}) => {
    const registration = registrationRef.current;
    if (!registration || !navigator.onLine || applyingRef.current) return;

    const now = Date.now();
    if (!force && now - lastCheckRef.current < UPDATE_CHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      await registration.update();
    } catch (error) {
      // Il controllo aggiornamenti non deve mai bloccare il lavoro offline.
      console.warn('[PWA] Controllo aggiornamenti non riuscito:', error);
    }
  }, []);

  useEffect(() => {
    try {
  sessionStorage.removeItem(UPDATED_FLAG);
  localStorage.setItem(BUILD_STORAGE_KEY, CURRENT_BUILD_ID);
  if (localStorage.getItem(ACCEPTED_BUILD_KEY) && localStorage.getItem(ACCEPTED_BUILD_KEY) !== CURRENT_BUILD_ID) {
    localStorage.removeItem(ACCEPTED_BUILD_KEY);
  }

} catch { /* Storage may be unavailable; keep the update flow usable. */ }

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Non riproporre durante la stessa sessione un build già accettato.
        // Il flag viene scritto prima del reload e resta valido finché non cambia build.
        try {
          if (localStorage.getItem(ACCEPTED_BUILD_KEY) === CURRENT_BUILD_ID) return;
        } catch { /* Storage may be unavailable; keep the update flow usable. */ }
        setUpdateAvailable(true);
        loadPublishedRelease();
        // Se l'operaio sta scrivendo, non copriamo il modulo: mostriamo
        // soltanto il richiamo discreto sopra la barra inferiore.
        setDeferred(isEditableElement(document.activeElement));
        setMessage('');
      },
      onOfflineReady() {
        // Nessun popup: l'app continua semplicemente a essere disponibile offline.
      },
      onRegisteredSW(_swUrl, registration) {
        registrationRef.current = registration || null;
        checkForUpdate({ force: true });
      },
      onRegisterError(error) {
        console.warn('[PWA] Registrazione aggiornamenti non riuscita:', error);
      },
    });
    updateSWRef.current = updateSW;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    const onOnline = () => checkForUpdate({ force: true });
    const pollTimer = window.setInterval(checkForUpdate, UPDATE_POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    return () => {
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [checkForUpdate, loadPublishedRelease]);

  const rememberEditingState = () => {
    wasEditingOnPressRef.current = isEditableElement(document.activeElement);
  };

  const applyUpdate = async () => {
  if (applyingRef.current) return;

  if (!navigator.onLine) {
    setMessage(
      'Internet non disponibile. Riprova quando torna la connessione.'
    );
    return;
  }

  if (
    wasEditingOnPressRef.current ||
    isEditableElement(document.activeElement)
  ) {
    setMessage(
      'Prima termina o salva ciò che stai compilando, poi aggiorna.'
    );
    wasEditingOnPressRef.current = false;
    return;
  }

  try {
    const reason = updateBlockReason({ storage: localStorage });
    if (reason) { setMessage(reason); return; }
  } catch {
    setMessage('Impossibile verificare i sospesi: aggiornamento rimandato.');
    return;
  }

let registration;
try { registration = registrationRef.current || await navigator.serviceWorker.getRegistration(); }
catch { setMessage('Impossibile controllare l’aggiornamento. Riprova.'); return; }

registrationRef.current = registration || null;

const waitingWorker = registration?.waiting;

  if (!registration || !waitingWorker) {
    setMessage(
      'La nuova versione non è ancora pronta. Chiudi e riapri Play Money Admin tra qualche secondo.'
    );
    checkForUpdate({ force: true });
    return;
  }

  let releaseWrites;
  try { releaseWrites = freezeWritesForUpdate(); }
  catch { setMessage('Attendi il completamento delle operazioni in corso.'); return; }
  applyingRef.current = true;
  setApplying(true);
  setMessage('');

  try {
    const activated = await new Promise((resolve) => {
      let completed = false;

      const finish = (result) => {
        if (completed) return;
        completed = true;

        window.clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          handleControllerChange
        );

        resolve(result);
      };

      const handleControllerChange = () => {
        finish(true);
      };

      const timeout = window.setTimeout(() => {
        finish(false);
      }, 10000);

      navigator.serviceWorker.addEventListener(
        'controllerchange',
        handleControllerChange
      );

      waitingWorker.postMessage({
        type: 'SKIP_WAITING',
      });
    });

    if (!activated) {
      releaseWrites?.();
      applyingRef.current = false;
      setApplying(false);
      setMessage(
        'L’iPhone ha rimandato l’aggiornamento. Chiudi completamente Play Money Admin e riaprila.'
      );
      return;
    }

    // Il successo viene memorizzato soltanto dopo che il nuovo
    // Service Worker ha realmente preso il controllo.
    sessionStorage.setItem(UPDATED_FLAG, '1');
    try { localStorage.setItem(ACCEPTED_BUILD_KEY, CURRENT_BUILD_ID); } catch { /* Storage may be unavailable; keep the update flow usable. */ }
    window.location.reload();
  } catch (error) {
    releaseWrites?.();
    applyingRef.current = false;
    setApplying(false);
    setMessage(
      'Non sono riuscito ad aggiornare. Puoi continuare a lavorare e riprovare più tardi.'
    );
    console.warn(
      '[PWA] Applicazione aggiornamento non riuscita:',
      error
    );
  }
};

if (updatedToast) {
  const buildDate = new Date(CURRENT_BUILD_ID);

  const buildLabel = Number.isNaN(buildDate.getTime())
    ? CURRENT_BUILD_ID
    : buildDate.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

  return (
    <div className="pm-system-modal fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-admin-updated-title"
        className="w-full max-w-[370px] overflow-hidden rounded-[28px] border border-emerald-300/55 bg-[#f8fff9] shadow-[0_28px_80px_-30px_rgba(5,80,45,.85)]"
      >
        <div className="bg-[linear-gradient(145deg,#effff5,#ccefd9)] px-5 pb-5 pt-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/70 bg-white/80 shadow-sm">
            <CheckCircle2
              size={29}
              className="text-emerald-600"
              strokeWidth={2.6}
            />
          </div>

          <h2
            id="pm-admin-updated-title"
            className="mt-4 text-[20px] font-black text-emerald-950"
          >
            Play Money Admin aggiornata
          </h2>

          <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-emerald-900/75">
            La nuova versione è stata installata correttamente ed è pronta per essere utilizzata.
          </p>
        </div>

        <div className="space-y-3 px-5 py-5">
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Versione installata
            </p>
            <p className="mt-0.5 text-[12px] font-black text-emerald-950">
              v{APP_VERSION} • {buildLabel}
            </p>
          </div>

          <ReleaseNotes release={RELEASE} />

          <button
            type="button"
            onClick={() => setUpdatedToast(false)}
            className="flex h-12 w-full items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#168451,#075d3b)] text-[13px] font-black uppercase tracking-wide text-white shadow-[0_14px_24px_-16px_rgba(5,100,60,.9)] active:scale-[.99]"
          >
            Continua
          </button>
        </div>
      </div>
    </div>
  );
}

if (!updateAvailable) return null;

if (deferred) {
    return (
      <button
        type="button"
        onClick={() => setDeferred(false)}
        className="fixed left-1/2 z-[9998] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#92bad2]/55 bg-[#f3faff]/95 px-4 py-2.5 text-[11px] font-black text-[#175880] shadow-[0_14px_34px_-20px_rgba(122,87,27,.75)] backdrop-blur-xl active:scale-[.98]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 82px)' }}
      >
        <DownloadCloud size={15} strokeWidth={2.6} />
        Aggiornamento disponibile
      </button>
    );
  }

  return (
    <div className="pm-system-modal fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/45 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-admin-update-title"
        className="w-full max-w-[370px] overflow-hidden rounded-[28px] border border-[#a6cde4]/65 bg-[#f8fcff] shadow-[0_28px_80px_-30px_rgba(30,20,5,.9)]"
      >
        <div className="relative bg-[linear-gradient(145deg,#f0f9ff,#d7edfb)] px-5 pb-4 pt-5">
          {!applying && (
            <button
              type="button"
              onClick={() => setDeferred(true)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#a6cde4]/60 bg-white/60 text-[#175880] active:scale-95"
              aria-label="Aggiorna più tardi"
            >
              <X size={18} />
            </button>
          )}

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#92bad2]/55 bg-white/75 shadow-sm">
            {applying
              ? <RefreshCw size={27} className="animate-spin text-[#246c99]" />
              : <DownloadCloud size={27} className="text-[#246c99]" />}
          </div>

          <h2 id="pm-admin-update-title" className="mt-4 text-[20px] font-black text-[#16384d]">
            {applying ? 'Aggiornamento in corso' : 'Aggiornamento disponibile'}
          </h2>
          {!applying && <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-[#246c99]">Nuova versione {availableRelease.VERSION}</p>}
          <p className="mt-1.5 pr-5 text-[12px] font-semibold leading-relaxed text-[#607786]">
            {applying
              ? 'Non chiudere Play Money Admin. La nuova versione si aprirà tra pochi secondi.'
              : 'È pronta una nuova versione di Play Money Admin. Prima di aggiornare, termina o salva ciò che stai compilando.'}
          </p>
        </div>

        <div className="space-y-2.5 px-5 py-5">
          {!applying && <ReleaseNotes release={availableRelease} compact />}

          {!applying && (
            <p className="flex items-center justify-center gap-1.5 text-center text-[10px] font-bold text-[#607786]">
              <CheckCircle2 size={14} className="text-emerald-600" /> Aggiorna dopo aver sincronizzato i sospesi
            </p>
          )}
          {message && (
            <p role="status" className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-[11px] font-bold leading-relaxed text-amber-900">
              {message}
            </p>
          )}

          <button
            type="button"
            disabled={applying}
            onPointerDown={rememberEditingState}
            onClick={applyUpdate}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[linear-gradient(135deg,#327ba6,#175880)] text-[13px] font-black uppercase tracking-wide text-white shadow-[0_14px_24px_-16px_rgba(122,87,27,.9)] disabled:opacity-70 active:scale-[.99]"
          >
            {applying ? <RefreshCw size={18} className="animate-spin" /> : <DownloadCloud size={18} />}
            {applying ? 'Attendi…' : 'Aggiorna ora'}
          </button>

          {!applying && (
            <button
              type="button"
              onClick={() => setDeferred(true)}
              className="h-11 w-full rounded-[15px] border border-[#c4ddeb] bg-white text-[12px] font-black uppercase tracking-wide text-[#175880] active:scale-[.99]"
            >
              Più tardi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
