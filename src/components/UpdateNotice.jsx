import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { freezeWritesForUpdate, updateBlockReason } from '../lib/updateSafety.js';

export default function UpdateNotice() {
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const update = useRef(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    update.current = registerSW({ onNeedRefresh: () => setAvailable(true) });
  }, []);
  async function apply() {
    if (busy) return;
    if (wasEditing.current) { wasEditing.current = false; setMessage("Prima termina ciò che stai compilando."); return; }
    if (!navigator.onLine) { setMessage('Riconnettiti prima di aggiornare.'); return; }
    const reason = updateBlockReason();
    if (reason) { setMessage(reason); return; }
    let release;
    try {
      release = freezeWritesForUpdate();
      setBusy(true);
      await update.current?.(true);
    } catch { setMessage('Aggiornamento non riuscito. Riprova.'); }
    finally { release?.(); setBusy(false); }
  }
  if (!available) return null;
  return <aside role="status" style={{position:'fixed',bottom:20,right:20,zIndex:10000,maxWidth:360,padding:16,borderRadius:16,background:'#fff8e7',color:'#3d2b10',boxShadow:'0 8px 30px #0004'}}>
    <strong>Aggiornamento disponibile</strong>
    <p style={{fontSize:13,margin:'8px 0'}}>Termina e salva il lavoro prima di aggiornare.</p>
    {message && <p style={{fontSize:13}}>{message}</p>}
    <button disabled={busy} onPointerDown={e => {
      const el = document.activeElement;
      if (el?.matches('input,textarea,select,[contenteditable="true"]')) {
        wasEditing.current = true; e.preventDefault(); setMessage('Prima termina ciò che stai compilando.');
      }
    }} onClick={apply} style={{padding:'8px 14px',borderRadius:10,background:'#805817',color:'white'}}>Aggiorna ora</button>
  </aside>;
}
