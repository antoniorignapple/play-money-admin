import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDownToLine, Coins, Wallet, RotateCcw, Landmark, Pencil, Plus, RefreshCw, Trash2, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRomeISODate } from '../lib/dates.js';
import { saveFund, saveCashTransfer } from '../lib/accountingService.js';
import { euro, fmtDate, periodLabel, parseEuroInput } from '../lib/officeCash.js';
import { useOfficeCash } from '../components/OfficeCashContext';
import { AccountingModal, Field, LoadError } from '../components/AccountingUI';
import { PageLayout, PageBody } from '../components/PageLayout';
import { useToast } from '../components/Toast';

export default function ContabilitaCassaPage({ onOpenAccounting }) {
  const { data, loading, error, refresh } = useOfficeCash();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [tab, setTab] = useState('transfers');
  const [history, setHistory] = useState([]);
  const [fundEdit, setFundEdit] = useState(null);
  const [transferEdit, setTransferEdit] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const requestId = useRef(0);
  const period = data?.periods.find(p => p.id === selectedId);
  const safe = data && !error;
  const amount = key => safe ? euro(data.totals[key]) : '—';

  useEffect(() => {
    if (data && !selectedId) setSelectedId(data.activePeriod?.id || data.periods[0]?.id || '');
  }, [data, selectedId]);
  useEffect(() => { loadDetail(); return () => { requestId.current++; }; }, [selectedId, data?.loadedAt]);

  async function loadDetail() {
    const request = ++requestId.current;
    setDetailLoading(true); setDetailError(''); setDetail(null);
    try {
      const [periodResult, historyResult] = await Promise.all([
        selectedId ? supabase.rpc('get_contabilita_cassa_periodo', { p_period_id: selectedId }) : Promise.resolve({ data: null }),
        supabase.from('cassa_ufficio_fondo_storico').select('*').order('changed_at', { ascending: false }).limit(100),
      ]);
      if (periodResult.error) throw periodResult.error;
      if (historyResult.error) throw historyResult.error;
      if (request === requestId.current) { setDetail(periodResult.data); setHistory(historyResult.data || []); }
    } catch (e) { if (request === requestId.current) setDetailError(e.message); }
    finally { if (request === requestId.current) setDetailLoading(false); }
  }

  function openTransfer(row = null) {
    const today = getRomeISODate();
    setFormError('');
    setTransferEdit({ row, periodId: period.id, amount: row ? String(row.amount).replace('.', ',') : '', destination: row?.destination || '',
      date: row?.transfer_date || (today < period.date_from ? period.date_from : today > period.date_to ? period.date_to : today), note: row?.note || '' });
  }

  async function submitFund(e) {
    e.preventDefault();
    const value = parseEuroInput(fundEdit.amount);
    if (value === null || value < 0) return setFormError('Inserisci un importo valido, maggiore o uguale a zero.');
    setSaving(true); setFormError('');
    try { await saveFund(value, fundEdit.version); setFundEdit(null); toast.success('Fondo Cassa aggiornato'); }
    catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function submitTransfer(e) {
    e.preventDefault();
    const value = parseEuroInput(transferEdit.amount);
    if (value === null || value <= 0) return setFormError('Inserisci un importo maggiore di zero.');
    if (!transferEdit.destination.trim()) return setFormError('Inserisci la destinazione.');
    setSaving(true); setFormError('');
    try { await saveCashTransfer(transferEdit.periodId, transferEdit.row, { ...transferEdit, amount: value }); setTransferEdit(null); await loadDetail(); toast.success('Trasferimento salvato'); }
    catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function removeTransfer() {
    setSaving(true); setFormError('');
    try { await saveCashTransfer(period.id, deleteRow, null, true); setDeleteRow(null); await loadDetail(); toast.success('Trasferimento eliminato'); }
    catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  return <PageLayout><PageBody><div className="office-page">
    {error && <LoadError message={error} onRetry={refresh}/>}
    <section className="office-overview" aria-label="Riepilogo Cassa Ufficio" aria-busy={loading}>
      <div className="office-overview-top"><h1 className="sr-only">Cassa Ufficio</h1><span className="office-status">{loading ? 'Aggiornamento in corso' : safe ? `Aggiornata alle ${data.loadedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'Dati non disponibili'}</span><button className="office-icon" onClick={refresh} disabled={loading} aria-label="Aggiorna Cassa"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button></div>
      <div className="office-components">
        <div className="office-component"><div className="office-component-heading"><Coins size={19}/><span>Fondo Cassa</span><button className="office-icon" disabled={!safe || loading} aria-label="Modifica Fondo Cassa" onClick={() => { setFormError(''); setFundEdit({ amount: String(data.fund.amount).replace('.', ','), version: data.fund.version }); }}><Pencil size={13}/></button></div><strong>{amount('fondo')}</strong></div>
        <div className="office-component"><div className="office-component-heading"><Wallet size={19}/><span>Acconti</span></div><strong>{amount('acconti')}</strong></div>
        <div className="office-component"><div className="office-component-heading"><RotateCcw size={19}/><span>Da Rientrare</span></div><strong>{amount('daRientrare')}</strong></div>
        <div className="office-component"><div className="office-component-heading"><Landmark size={19}/><span>Residuo Azienda</span><button className="office-icon" disabled={!data?.closedPeriod} title={periodLabel(data?.closedPeriod)} aria-label="Apri contabilità ultimo periodo chiuso" onClick={() => onOpenAccounting(data.closedPeriod.id)}><ArrowUpRight size={13}/></button></div><strong>{amount('residuo')}</strong></div>
      </div>
      <div className="office-total"><div><h2>CASSA UFFICIO</h2></div><strong aria-live="polite">{amount('totale')}</strong></div>
    </section>
    <div className="office-workspace">
      <section className="office-panel"><div className="office-panel-header"><div><h2>{tab === 'transfers' ? 'I movimenti della Cassa' : 'La storia del fondo'}</h2><p>{tab === 'transfers' ? periodLabel(period) : 'Ultime 100 variazioni, dalla più recente.'}</p></div>{tab === 'transfers' && <button className="office-button primary" disabled={!period || detailLoading || !!detailError} onClick={() => openTransfer()}><Plus size={15}/> Trasferimento</button>}</div>
        <div className="office-tabs" role="tablist" aria-label="Movimenti e fondo"><button role="tab" aria-selected={tab === 'transfers'} onClick={() => setTab('transfers')}>Trasferimenti</button><button role="tab" aria-selected={tab === 'fund'} onClick={() => setTab('fund')}>Storico Fondo Cassa</button></div>
        {detailError ? <LoadError message={detailError} onRetry={loadDetail}/> : detailLoading ? <div className="office-empty">Caricamento movimenti…</div> : tab === 'transfers' ? <>
          {!(detail?.transfers?.length) ? <div className="office-empty"><ArrowDownToLine size={28}/>Nessun trasferimento in questo periodo.<p>Registra una destinazione e il relativo importo.</p></div> : detail.transfers.map(row => <div key={row.id} className="office-row"><time>{fmtDate(row.transfer_date)}</time><div><h3>{row.destination}</h3>{row.note && <p>{row.note}</p>}</div><strong>− {euro(row.amount)}</strong><div className="office-actions"><button className="office-icon" aria-label={`Modifica ${row.destination}`} onClick={() => openTransfer(row)}><Pencil size={14}/></button><button className="office-icon danger" aria-label={`Elimina ${row.destination}`} onClick={() => { setFormError(''); setDeleteRow(row); }}><Trash2 size={14}/></button></div></div>)}
          
        </> : <div className="office-fund-history">{!history.length ? <div className="office-empty"><History size={28}/>Il Fondo Cassa parte da 0 €.<p>Le prossime modifiche compariranno qui.</p></div> : history.map(row => <div className="office-row" key={row.id}><div><h3>Fondo Cassa aggiornato</h3><p>{new Date(row.changed_at).toLocaleString('it-IT')}</p></div><strong>{euro(row.previous_amount)} → {euro(row.amount)}</strong></div>)}</div>}
      </section>
      <aside className="office-panel office-aside"><h2 className="office-archive-title">ARCHIVIO PERIODI</h2><label htmlFor="cash-period" className="sr-only">Periodo dei movimenti Cassa</label><select id="cash-period" value={selectedId} onChange={e => setSelectedId(e.target.value)}>{!data?.periods.length && <option value="">Nessun periodo</option>}{data?.periods.map(p => <option key={p.id} value={p.id}>{periodLabel(p)}{p.status === 'closed' ? ' · Chiuso' : ' · Aperto'}</option>)}</select>
        <span className="office-period-badge">{period?.status === 'closed' ? 'Archivio · Modificabile' : 'Periodo attuale'}</span><dl><dt>Acconti generati</dt><dd>{detail ? euro(detail.summary?.cassa_generata || 0) : '—'}</dd><dt>Trasferimenti</dt><dd>{detail ? euro((detail.transfers || []).reduce((sum, r) => sum + Number(r.amount), 0)) : '—'}</dd><dt>Operazioni</dt><dd>{detail?.transfers?.length ?? '—'}</dd></dl>
        <button className="office-button" disabled={!period} onClick={() => onOpenAccounting(period.id)}>CONTABILITÀ CONTEGGI <ArrowUpRight size={14}/></button>
      </aside>
    </div>
    {!loading && data && !data.activePeriod && <p className="office-note">Nessun periodo attivo: Acconti e Da Rientrare valgono 0 €. Fondo Cassa e Residuo Azienda restano disponibili.</p>}
  </div></PageBody>
    {fundEdit && <AccountingModal title="Il tuo Fondo Cassa" subtitle="Imposta il nuovo valore. Sostituirà quello precedente." onClose={() => setFundEdit(null)} busy={saving}><form onSubmit={submitFund}><Field label="Nuovo Fondo Cassa (€)" hint="Esempio: 10.000 oppure 10.000,50. Puoi impostare anche 0 €."><input autoFocus required className="money" inputMode="decimal" value={fundEdit.amount} onChange={e => setFundEdit({ ...fundEdit, amount: e.target.value })}/></Field>{formError && <p role="alert" className="office-error">{formError}</p>}<div className="office-modal-footer"><button type="button" className="office-button" disabled={saving} onClick={() => setFundEdit(null)}>Annulla</button><button className="office-button primary" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva Fondo Cassa'}</button></div></form></AccountingModal>}
    {transferEdit && <AccountingModal title={transferEdit.row ? 'Modifica trasferimento' : 'Nuovo trasferimento'} subtitle={periodLabel(period)} busy={saving} onClose={() => setTransferEdit(null)}><form onSubmit={submitTransfer}><Field label="Importo (€)"><input autoFocus required className="money" inputMode="decimal" value={transferEdit.amount} onChange={e => setTransferEdit({ ...transferEdit, amount: e.target.value })}/></Field><Field label="Destinazione"><input required value={transferEdit.destination} onChange={e => setTransferEdit({ ...transferEdit, destination: e.target.value })}/></Field><Field label="Data"><input type="date" required min={period?.date_from} max={period?.date_to} value={transferEdit.date} onChange={e => setTransferEdit({ ...transferEdit, date: e.target.value })}/></Field><Field label="Nota facoltativa"><textarea rows={2} value={transferEdit.note} onChange={e => setTransferEdit({ ...transferEdit, note: e.target.value })}/></Field>{formError && <p role="alert" className="office-error">{formError}</p>}<div className="office-modal-footer"><button type="button" className="office-button" disabled={saving} onClick={() => setTransferEdit(null)}>Annulla</button><button className="office-button primary" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva trasferimento'}</button></div></form></AccountingModal>}
    {deleteRow && <AccountingModal title="Elimina trasferimento" subtitle={deleteRow.destination} busy={saving} onClose={() => setDeleteRow(null)}><p className="office-modal-message">Il trasferimento verrà rimosso dalla Cassa e dalla contabilità di questo periodo. I saldi saranno ricalcolati.</p><p className="office-modal-amount">{euro(deleteRow.amount)}</p>{formError && <p role="alert" className="office-error">{formError}</p>}<div className="office-modal-footer"><button className="office-button" disabled={saving} onClick={() => setDeleteRow(null)}>Annulla</button><button className="office-button danger" disabled={saving} onClick={removeTransfer}>{saving ? 'Eliminazione…' : 'Elimina trasferimento'}</button></div></AccountingModal>}
  </PageLayout>;
}
