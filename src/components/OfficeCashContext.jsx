import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadOfficeCash } from '../lib/accountingService.js';

const OfficeCashContext = createContext(null);
export function OfficeCashProvider({ children }) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setState(old => ({ ...old, loading: true }));
    try {
      const data = await loadOfficeCash();
      if (request === sequence.current) setState({ data, loading: false, error: '' });
    } catch (error) {
      if (request === sequence.current) setState(old => ({ ...old, loading: false, error: error.message || 'Impossibile aggiornare Cassa' }));
    }
  }, []);
  useEffect(() => {
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener('cassa-totale-refresh', refresh);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, 30000);
    return () => { sequence.current++; clearInterval(timer); window.removeEventListener('cassa-totale-refresh', refresh); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  return <OfficeCashContext.Provider value={{ ...state, refresh }}>{children}</OfficeCashContext.Provider>;
}
export const useOfficeCash = () => useContext(OfficeCashContext);
