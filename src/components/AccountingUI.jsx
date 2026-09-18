import { useEffect, useRef } from 'react';
import { X, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import { useOfficeCash } from './OfficeCashContext';
import { euro } from '../lib/officeCash.js';
import './accounting.css';

export function CashSidebarCard({ onOpen, collapsed }) {
  const { data, error, loading, refresh } = useOfficeCash();
  if (collapsed) return <button className="office-mini" onClick={onOpen} title="Cassa Ufficio" aria-label="Apri Cassa Ufficio"><Wallet size={20}/></button>;
  return <section className="office-sidebar">
    <button className="office-sidebar-refresh" onClick={refresh} disabled={loading} aria-label="Aggiorna Cassa Ufficio"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/></button>
    <div className="office-sidebar-open">
      <span className="office-sidebar-title">Cassa</span>
      <span className="office-sidebar-rule"/>
      <strong className="office-sidebar-amount">{error || !data ? '—' : euro(data.totals.totale)}</strong>
      {error && <span className="office-sidebar-caption" role="status">Aggiornamento necessario</span>}
      <button type="button" className="office-sidebar-link office-liquid" onClick={onOpen}>Apri la cassa <ArrowUpRight size={14}/></button>
    </div>
  </section>;
}

export function AccountingModal({ title, subtitle, onClose, busy, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={dialog} className="office-modal" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><div><span className="office-eyebrow">Play Money · Amministrazione</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <button className="office-icon" onClick={onClose} disabled={busy} aria-label="Chiudi"><X size={20}/></button></header>
    <div className="office-modal-body">{children}</div>
  </dialog>;
}

export function Field({ label, children, hint }) {
  return <label className="office-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function LoadError({ message, onRetry }) {
  return <div className="office-error" role="alert"><div><strong>Impossibile aggiornare i dati</strong><p>{message}</p></div><button className="office-button" onClick={onRetry}>Riprova</button></div>;
}
