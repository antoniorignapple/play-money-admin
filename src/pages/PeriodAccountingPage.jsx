import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Plus, Pencil, Trash2, RefreshCw, ReceiptText, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { getRomeISODate } from '../lib/dates.js';
import { fetchAllRows } from '../lib/fetchAllRows.js';
import { loadAccounting, loadPeriods, notifyAccountingChanged, saveCashTransfer } from '../lib/accountingService.js';
import { euro, fmtDate, periodLabel, parseEuroInput } from '../lib/officeCash.js';
import { createPdfPreviewWindow, openPdfPreview, closePdfPreviewWindow } from '../lib/pdfPreview';
import { AccountingModal, Field, LoadError } from '../components/AccountingUI';
import { PageLayout, PageBody } from '../components/PageLayout';
import { useToast } from '../components/Toast';

export default function PeriodAccountingPage({ initialPeriodId, onBack }) {
  const toast = useToast();
  const [periods, setPeriods] = useState([]);
  const [selectedId, setSelectedId] = useState(initialPeriodId || '');
  const [data, setData] = useState(null);
  const [venues, setVenues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [debtsOpen, setDebtsOpen] = useState(false);
  const [debtSearch, setDebtSearch] = useState('');
  const sequence = useRef(0);
  const period = periods.find(p => p.id === selectedId) || data?.detail?.period;
  const ready = data && !loading && !error;
  const totals = data?.totals;
  const metric = key => ready ? euro(totals[key]) : '—';

  useEffect(() => {
    let active = true;
    Promise.all([loadPeriods(), fetchAllRows(() => supabase.from('venues').select('id,name').order('id'))]).then(([items, places]) => {
      if (!active) return;
      setPeriods(items); setVenues(Object.fromEntries(places.map(v => [String(v.id), v.name])));
      setSelectedId(current => current || items.find(p => p.status === 'open' && p.is_active)?.id || items[0]?.id || '');
      if (!items.length) setLoading(false);
    }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; sequence.current++; };
  }, []);
  useEffect(() => { if (selectedId) refresh(); return () => { sequence.current++; }; }, [selectedId]);

  async function refresh() {
    const request = ++sequence.current;
    setLoading(true); setError(''); setData(null);
    try { const result = await loadAccounting(selectedId); if (request === sequence.current) setData(result); }
    catch (e) { if (request === sequence.current) setError(e.message); }
    finally { if (request === sequence.current) setLoading(false); }
  }

  function openEdit(row = null) {
    const today = getRomeISODate();
    setFormError('');
    setEdit({ row, amount: row ? String(row.amount).replace('.', ',') : '', destination: row?.destination || row?.description || '', note: row?.note || '',
      date: row?.workDate || (today < period.date_from ? period.date_from : today > period.date_to ? period.date_to : today) });
  }

  async function saveMovement(e) {
    e.preventDefault();
    const amount = parseEuroInput(edit.amount);
    if (amount === null || amount === 0 || (edit.row?.source === 'cassa' && amount < 0)) return setFormError('Inserisci un importo valido e diverso da zero.');
    if (!edit.destination.trim()) return setFormError('Inserisci una descrizione.');
    setSaving(true); setFormError('');
    try {
      if (edit.row?.source === 'cassa') await saveCashTransfer(selectedId, edit.row, { ...edit, amount });
      else {
        const payload = { period_id: selectedId, work_date: edit.date, description: edit.destination.trim(), amount, note: edit.note.trim() || null, updated_at: new Date().toISOString() };
        const query = edit.row ? supabase.from('contabilita_conteggi_righe').update(payload).eq('id', edit.row.id).eq('period_id', selectedId).eq('updated_at', edit.row.updated_at)
          : supabase.from('contabilita_conteggi_righe').insert(payload);
        const result = await query.select('id').maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error('Movimento modificato da un altro dispositivo. Aggiorna e riprova.');
        notifyAccountingChanged();
      }
      setEdit(null); await refresh(); toast.success('Movimento salvato');
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function removeMovement() {
    setSaving(true); setFormError('');
    try {
      if (deleteRow.source === 'cassa') await saveCashTransfer(selectedId, deleteRow, null, true);
      else {
        const result = await supabase.from('contabilita_conteggi_righe').delete().eq('id', deleteRow.id).eq('period_id', selectedId).eq('updated_at', deleteRow.updated_at).select('id').maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) throw new Error('Movimento già modificato o eliminato. Aggiorna la pagina.');
        notifyAccountingChanged();
      }
      setDeleteRow(null); await refresh(); toast.success('Movimento eliminato');
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  }

  async function toggleDebt(row) {
    if (saving) return;
    setSaving(true);
    try {
      const selected = data.selectedIds.includes(String(row.id));
      const result = selected ? await supabase.from('contabilita_conteggi_debiti_selezionati').delete().eq('period_id', selectedId).eq('conteggio_id', row.id)
        : await supabase.from('contabilita_conteggi_debiti_selezionati').insert({ period_id: selectedId, conteggio_id: row.id });
      if (result.error) throw result.error;
      notifyAccountingChanged(); await refresh();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  function generatePdf() {
    if (!ready) return;
    let preview;
    try {
      preview = createPdfPreviewWindow();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297, H = 210, M = 14;
      doc.setTextColor(55, 39, 13); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('PLAY MONEY · CONTABILITA CONTEGGI', M, 18);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(`Periodo ${fmtDate(period.date_from)} - ${fmtDate(period.date_to)}`, M, 25);
      [['TOTALE ESATTORE CONTEGGI', totals.esattore], ['TOTALE RECUPERI ACCONTO AGGIO', totals.recuperi], ['TOTALE GLOBALE', totals.globale]].forEach(([label, value], i) => {
        const x = M + i * 91; doc.setDrawColor(205, 166, 64); doc.roundedRect(x, 34, 84, 22, 3, 3);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text(label, x + 4, 41); doc.setFontSize(15); doc.text(euro(value), x + 80, 50, { align: 'right' });
      });
      let y = 69;
      const headings = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('DATA', M, y); doc.text('DESCRIZIONE', M + 30, y); doc.text('NOTA', M + 120, y); doc.text('IMPORTO', W - M, y, { align: 'right' }); y += 7; };
      headings();
      for (const row of data.movements) {
        if (y > H - 28) { doc.addPage(); y = 18; headings(); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(fmtDate(row.workDate), M, y);
        doc.text(String(row.destination || '').slice(0, 48), M + 30, y); doc.text(String(row.note || '').slice(0, 55), M + 120, y);
        doc.setFont('helvetica', 'bold'); doc.text(euro(row.amount), W - M, y, { align: 'right' }); y += 7;
      }
      if (y > H - 40) { doc.addPage(); y = 20; }
      y = Math.max(y + 10, H - 25); doc.setDrawColor(184, 137, 34); doc.line(M, y - 5, W - M, y - 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('SALDO AZIENDA', M, y + 3); doc.setFontSize(20); doc.text(euro(totals.saldo), W - M, y + 3, { align: 'right' });
      openPdfPreview(doc, preview);
    } catch (e) { closePdfPreviewWindow(preview); toast.error(`PDF: ${e.message}`); }
  }

  return <PageLayout><PageBody><div className="office-page">
    <button className="office-back" onClick={() => onBack(selectedId)}><ArrowLeft size={15}/> Torna ai Conteggi del periodo</button>
    <header className="office-header"><div><h1 className="office-accounting-title">CONTABILITÀ CONTEGGI</h1><p>{periodLabel(period)}</p></div><div className="office-actions"><button className="office-button" disabled={!ready} onClick={generatePdf}><FileText size={16}/> Apri PDF</button><button className="office-icon" disabled={loading || !selectedId} onClick={refresh} aria-label="Aggiorna contabilità"><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button></div></header>
    <div className="office-actions"><select className="office-period-select" aria-label="Periodo contabilità" disabled={saving} value={selectedId} onChange={e => setSelectedId(e.target.value)}>{periods.map(p => <option key={p.id} value={p.id}>{periodLabel(p)}{p.status === 'closed' ? ' · Chiuso' : ' · Aperto'}</option>)}</select><span className="office-period-badge"><Check size={12}/>{period?.status === 'closed' ? 'Periodo chiuso' : 'Periodo aperto'}</span></div>
    {error && <LoadError message={error} onRetry={refresh}/>}
    <section className="office-ledger-summary" aria-busy={loading}>
      <div><span className="office-eyebrow">Esattore Conteggi</span><strong>{metric('esattore')}</strong><p>Rettifiche dei giri incluse.</p></div>
      <div><span className="office-eyebrow">Recuperi acconto aggio</span><strong>{metric('recuperi')}</strong><button className="office-text-link" disabled={!ready} onClick={() => setDebtsOpen(true)}>Seleziona debiti <Pencil size={12}/></button></div>
      <div><span className="office-eyebrow">Totale globale</span><strong>{metric('globale')}</strong></div>
    </section>
    <section className="office-panel"><div className="office-panel-header"><div><h2>Movimenti del periodo</h2></div><button className="office-button primary" disabled={!ready} onClick={() => openEdit()}><Plus size={15}/> Aggiungi movimento</button></div>
      {loading ? <div className="office-empty">Caricamento contabilità…</div> : !data?.movements.length ? <div className="office-empty"><ReceiptText size={28}/>{error ? 'Dati non disponibili.' : 'Nessun movimento registrato.'}</div> : data.movements.map(row => <div className="office-row" key={`${row.source}-${row.id}`}><time>{fmtDate(row.workDate)}</time><div><h3>{row.destination || row.description}</h3>{row.note && <p>{row.note}</p>}</div><strong>{euro(row.amount)}</strong><div className="office-actions"><button className="office-icon" aria-label={`Modifica ${row.destination}`} onClick={() => openEdit(row)}><Pencil size={14}/></button><button className="office-icon danger" aria-label={`Elimina ${row.destination}`} onClick={() => { setFormError(''); setDeleteRow(row); }}><Trash2 size={14}/></button></div></div>)}
      <p className="office-note">Totale movimenti: <strong>{metric('movimenti')}</strong></p>
    </section>
    <section className="office-total office-ledger-total"><div><h2>SALDO AZIENDA</h2></div><strong>{metric('saldo')}</strong></section>
  </div></PageBody>
    {edit && <AccountingModal title={edit.row ? 'Modifica movimento' : 'Nuovo movimento'} subtitle={periodLabel(period)} busy={saving} onClose={() => setEdit(null)}><form onSubmit={saveMovement}><Field label="Importo (€)" hint={edit.row?.source === 'cassa' ? 'Trasferimento Cassa: importo maggiore di zero.' : 'Positivo: riduce il saldo. Negativo: aumenta il saldo.'}><input className="money" autoFocus required inputMode="decimal" value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value })}/></Field><Field label="Descrizione"><input required value={edit.destination} onChange={e => setEdit({ ...edit, destination: e.target.value })}/></Field><Field label="Data"><input required type="date" min={period.date_from} max={period.date_to} value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })}/></Field><Field label="Nota facoltativa"><textarea rows={2} value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })}/></Field>{formError && <p role="alert" className="office-error">{formError}</p>}<div className="office-modal-footer"><button className="office-button" type="button" disabled={saving} onClick={() => setEdit(null)}>Annulla</button><button className="office-button primary" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva movimento'}</button></div></form></AccountingModal>}
    {deleteRow && <AccountingModal title="Elimina movimento" subtitle={deleteRow.destination} busy={saving} onClose={() => setDeleteRow(null)}><p className="office-modal-message">Il movimento verrà eliminato e il saldo ricalcolato.{deleteRow.source === 'cassa' && ' Essendo un trasferimento, la rimozione aggiorna anche la Cassa del periodo.'}</p><p className="office-modal-amount">{euro(deleteRow.amount)}</p>{formError && <p role="alert" className="office-error">{formError}</p>}<div className="office-modal-footer"><button className="office-button" disabled={saving} onClick={() => setDeleteRow(null)}>Annulla</button><button className="office-button danger" disabled={saving} onClick={removeMovement}>{saving ? 'Eliminazione…' : 'Elimina movimento'}</button></div></AccountingModal>}
    {debtsOpen && <AccountingModal title="Recuperi acconto aggio" subtitle="Seleziona i debiti da includere nella contabilità." busy={saving} onClose={() => setDebtsOpen(false)}><input className="office-search" aria-label="Cerca debito" placeholder="Cerca locale o dipendente…" value={debtSearch} onChange={e => setDebtSearch(e.target.value)}/>{data?.archivedOnly && <p className="office-modal-message">Le righe di questo archivio sono conservate nello storico. I movimenti contabili restano modificabili; i debiti senza conteggio originale non possono essere selezionati.</p>}<div className="office-history-scroll">{data?.rows.filter(r => Number(r.debito) > 0 && `${venues[String(r.venue_id)] || ''} ${r.venue_id} ${r.operator_name || r.executor_name_snapshot || ''}`.toLowerCase().includes(debtSearch.toLowerCase())).map(row => <label className="office-debt-choice" key={row.id}><input type="checkbox" disabled={saving || loading || data.archivedOnly} checked={data.selectedIds.includes(String(row.id))} onChange={() => toggleDebt(row)}/><span>{venues[String(row.venue_id)] || row.venue_id}<small>{fmtDate(row.conteggio_date)} · {row.operator_name || row.executor_name_snapshot || '—'}</small></span><strong>{euro(row.debito)}</strong></label>)}</div><div className="office-modal-footer"><button className="office-button primary" disabled={saving} onClick={() => setDebtsOpen(false)}>Fatto</button></div></AccountingModal>}
  </PageLayout>;
}
