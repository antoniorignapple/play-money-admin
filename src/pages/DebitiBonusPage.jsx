import { getRomeISODate } from '../lib/dates.js';
import { useEffect, useMemo, useState, useRef, createContext, useContext } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Building2,
  Gift,
  Wallet,
  Banknote,
  Landmark,
  CheckCircle2,
  MinusCircle,
  Pause,
  Play,
  StickyNote,
  Infinity as InfinityIcon,
  Pencil,
  FileText, Search, ArrowUpRight, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  Button,
  IconButton,
  Input,
  Select,
  Badge,
  EmptyState,
  Field,
  Textarea,
} from "../components/ui";
import { PageLayout, PageBody } from "../components/PageLayout";
import { useToast } from "../components/Toast";
import { venueSortFn } from "../lib/helpers";
import { DIPENDENTI_SAFE_FIELDS } from "../lib/dipendentiFields";

import { debtTotals, debtLedger, euro as fmtEuro, validAmount } from '../lib/debtLedger.js';
import { fetchAllRows } from '../lib/fetchAllRows.js';
import { buildDebitoPdf } from '../lib/generateDebitoPdf.js';
import { createPdfPreviewWindow, openPdfPreview, closePdfPreviewWindow } from '../lib/pdfPreview.js';
import '../styles/debitiBonus.css';
const SavingContext = createContext(false);
const todayKey = () => getRomeISODate();
const formatITDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
const PERIODICITA_LABEL = {
  ogni_conteggio: "Ogni conteggio",
  ogni_fine_mese: "Ogni fine mese",
};

function Modal({ open, onClose, title, width = "md", footer, children }) {
  const busy = useContext(SavingContext);
  if (!open) return null;
  const close = () => { if (!busy) onClose?.(); };
  const maxWidth =
    width === "lg"
      ? "max-w-[760px]"
      : width === "sm"
        ? "max-w-[440px]"
        : "max-w-[600px]";
  return (
    <div
      className="finance-theme fixed inset-0 z-[10001] flex items-center justify-center bg-[#120d05]/70 p-3 backdrop-blur-md"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog" aria-modal="true" aria-label={title}
        className={`finance-modal flex max-h-[94vh] w-full ${maxWidth} flex-col overflow-hidden rounded-[30px] border border-[#d5b66c] bg-[#fffdf9] shadow-[0_40px_100px_-30px_rgba(0,0,0,.9)]`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="finance-modal-title shrink-0">
          <p className="finance-eyebrow">Play Money / Gestione locali</p>
          <h2>{title}</h2>
          <button type="button" disabled={busy} onClick={close} aria-label="Chiudi popup" className="absolute right-5 top-5 rounded-xl border border-white/20 p-2 text-white/80 hover:bg-white/10"><X size={19} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5"><fieldset disabled={busy} className="min-w-0">{children}</fieldset></div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#e5d7bb] bg-[#faf2e2] p-3">
            <fieldset disabled={busy} className="flex flex-wrap items-center justify-end gap-2">{busy && <span className="text-xs text-amber-800">Salvataggio…</span>}{footer}</fieldset>
          </div>
        )}
      </section>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = "CONFERMA",
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[13px] border border-[#d8c8a8] bg-white px-5 text-[10px] font-black text-slate-500"
          >
            ANNULLA
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-[13px] bg-[linear-gradient(135deg,#b42323,#711010)] px-5 text-[10px] font-black tracking-[.08em] text-white shadow-lg"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-[12px] font-bold leading-relaxed text-red-900">
        {message}
      </div>
    </Modal>
  );
}

export default function DebitiBonusPage() {
  const toast = useToast();
  const [tab, setTab] = useState("debiti");
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [loadError, setLoadError] = useState('');
  const [manualDate, setManualDate] = useState(todayKey());
  const [opening, setOpening] = useState(false);
  async function saveAction(action) {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true);
    try { await action(); } catch (error) { toast.error(error.message || 'Salvataggio non riuscito'); }
    finally { saveLock.current = false; setSaving(false); }
  }
  function debtError(error) {
    if (error.code === 'PGRST202' || error.code === '42P01' || error.code === 'PGRST205') return 'Installa prima l’aggiornamento SQL Admin 13.0 incluso nel pacchetto.';
    return error.message || 'Operazione non riuscita';
  }

  const [venues, setVenues] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [debiti, setDebiti] = useState([]);
  const [bonus, setBonus] = useState([]);
  const [note, setNote] = useState([]);
  const [movByDebito, setMovByDebito] = useState({});
  const [loading, setLoading] = useState(false);

  const [showNewDebito, setShowNewDebito] = useState(false);
  const [showNewBonus, setShowNewBonus] = useState(false);
  const [showNewNota, setShowNewNota] = useState(false);
  const [detailDebito, setDetailDebito] = useState(null);
  const [manualDeduct, setManualDeduct] = useState(null); // debito su cui registrare decurtazione
  const [manualAmount, setManualAmount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind, row }
  const [editItem, setEditItem] = useState(null); // { kind, row }

  const venueById = useMemo(() => {
    const map = {};
    venues.forEach((v) => {
      map[String(v.id)] = v;
    });
    return map;
  }, [venues]);

  function venueLabel(venueId) {
    const v = venueById[String(venueId)];
    if (!v) return venueId || "—";
    const id = String(v.id || "").trim();
    const name = String(v.name || "").trim();
    if (name.toLowerCase().startsWith(id.toLowerCase())) return name;
    return `${id} ${name}`;
  }

  async function loadAll() {
    setLoading(true);
    try {
      setLoadError('');
      const [venuesData, dipData, debitiData, bonusData, noteData] = await Promise.all([
        fetchAllRows(() => supabase.from('venues').select('*').order('id')),
        fetchAllRows(() => supabase.from('dipendenti').select(DIPENDENTI_SAFE_FIELDS).order('id')),
        fetchAllRows(() => supabase.from('debiti').select('*').order('created_at', { ascending: true }).order('id')),
        fetchAllRows(() => supabase.from('bonus').select('*').order('created_at', { ascending: true }).order('id')),
        fetchAllRows(() => supabase.from('note_generiche').select('*').order('created_at', { ascending: true }).order('id')),
      ]);
      setVenues([...(venuesData || [])].sort(venueSortFn));
      setDipendenti(dipData || []);
      setDebiti(debitiData || []);
      setBonus(bonusData || []);
      setNote(noteData || []);
    } catch (e) {
      setLoadError(e.message);
      toast.error(`Errore: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial fetch; later refreshes are explicit user actions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getDebtSnapshot(id) {
    const { data: debt, error } = await supabase.from('debiti').select('*').eq('id', id).single();
    if (error) throw error;
    const [repayments, disbursements] = await Promise.all([
      fetchAllRows(() => supabase.from('debiti_movimenti').select('*').eq('debito_id', id).order('data').order('created_at').order('id')),
      fetchAllRows(() => supabase.from('debiti_erogazioni').select('*').eq('debito_id', id).order('data').order('created_at').order('id')),
    ]);
    const { data: latest, error: lastError } = await supabase.from('debiti').select('*').eq('id', id).single();
    if (lastError) throw lastError;
    if (JSON.stringify(debt) !== JSON.stringify(latest)) throw new Error('Il saldo è appena cambiato. Riprova per leggere lo storico aggiornato.');
    return { debt, repayments, disbursements };
  }
  async function openDebt(d, edit = false) {
    if (opening) return;
    setOpening(true);
    try {
      const snapshot = await getDebtSnapshot(d.id);
      setMovByDebito(prev => ({ ...prev, [d.id]: snapshot }));
      if (edit) setEditItem({ kind: 'debito', row: snapshot.debt });
      else setDetailDebito(snapshot.debt);
    } catch (e) { toast.error(debtError(e)); }
    finally { setOpening(false); }
  }
  async function startDeduct(d, full = false) {
    try {
      const { data: latest, error } = await supabase.from('debiti').select('*').eq('id', d.id).single();
      if (error) throw error;
      setManualDeduct(latest); setManualAmount(full ? String(latest.residuo) : ''); setManualDate(todayKey());
    } catch (e) { toast.error(debtError(e)); }
  }
  async function exportDebt(d) {
    let target;
    try {
      target = createPdfPreviewWindow();
      const snapshot = await getDebtSnapshot(d.id);
      const doc = buildDebitoPdf({ ...snapshot, venue: venueLabel(snapshot.debt.venue_id) });
      openPdfPreview(doc, target);
    } catch (e) { closePdfPreviewWindow(target); toast.error(debtError(e)); }
  }
  function debtPatch(form) {
    if (!form.venue_id) throw new Error('Seleziona un locale');
    if (form.modalita === 'contanti' && form.rata_tipo === 'fisso' && !validAmount(form.rata_importo)) throw new Error('Inserisci una rata valida in euro interi');
    return { venue_id: form.venue_id, modalita: form.modalita,
      periodicita: form.modalita === 'contanti' ? form.periodicita : null,
      rata_tipo: form.modalita === 'contanti' ? form.rata_tipo : null,
      rata_importo: form.modalita === 'contanti' && form.rata_tipo === 'fisso' ? Number(form.rata_importo) : null,
      note: form.note?.trim() || null };
  }
  async function createDebito(form) {
    if (!validAmount(form.importo_iniziale)) return toast.warning('Inserisci un importo valido in euro interi');
    const { error } = await supabase.rpc('admin_v13_save_debito', {
      p_id: form.id, p_expected: null, p_patch: { ...debtPatch(form), importo_iniziale: Number(form.importo_iniziale) }, p_erogazione: 0, p_data: form.data,
    });
    if (error) throw new Error(debtError(error));
    setShowNewDebito(false); toast.success('Debito creato'); await loadAll();
  }
  async function applyManualDeduct() {
    const d = manualDeduct;
    if (!d) return;
    if (!validAmount(manualAmount) || Number(manualAmount) > Number(d.residuo)) return toast.warning('Il rimborso deve essere positivo e non superiore al residuo');
    const { error } = await supabase.rpc('admin_v13_rimborso_debito', { p_id: d.id, p_expected: d, p_importo: Number(manualAmount), p_data: manualDate });
    if (error) throw new Error(debtError(error));
    setManualDeduct(null); setDetailDebito(null); setManualAmount('');
    toast.success('Rimborso registrato e saldo aggiornato'); await loadAll();
  }

  async function createBonus(form) {
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const importo = Math.trunc(Number(form.importo) || 0);
    if (importo <= 0) return toast.warning("Inserisci un importo valido");
    if (!form.periodicita) return toast.warning("Scegli la periodicità");
    if (
      bonus.some(
        (b) =>
          b.status === "attivo" && String(b.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già un bonus attivo");

    const dip = dipendenti.find(
      (x) => String(x.auth_user_id) === String(form.agent_id),
    );
    const { error } = await supabase.from("bonus").insert({
      venue_id: form.venue_id,
      agent_id: form.agent_id || null,
      agent_name: dip?.full_name || null,
      importo,
      periodicita: form.periodicita,
      status: "attivo",
      note: form.note?.trim() || null,
    });
    if (error) return toast.error(error.message);
    setShowNewBonus(false);
    toast.success("Bonus creato");
    loadAll();
  }

  async function toggleBonus(b) {
    const next = b.status === "attivo" ? "sospeso" : "attivo";
    if (
      next === "attivo" &&
      bonus.some(
        (x) =>
          x.id !== b.id &&
          x.status === "attivo" &&
          String(x.venue_id) === String(b.venue_id),
      )
    )
      return toast.error("Questo locale ha già un altro bonus attivo");
    const { error } = await supabase
      .from("bonus")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success(next === "attivo" ? "Bonus riattivato" : "Bonus sospeso");
    loadAll();
  }

  // ─── NOTE GENERICHE ─────────────────────────────────────────────
  async function createNota(form) {
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const testo = (form.testo || "").trim();
    if (!testo) return toast.warning("Scrivi il testo della nota");

    let conteggiTotali = null;
    let conteggiRimasti = null;
    if (!form.sempre) {
      conteggiTotali = Math.trunc(Number(form.conteggi_totali) || 0);
      if (conteggiTotali <= 0)
        return toast.warning("Indica per quanti conteggi (almeno 1)");
      conteggiRimasti = conteggiTotali;
    }

    if (
      note.some(
        (n) =>
          n.status === "attiva" && String(n.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già una nota attiva");

    const { error } = await supabase.from("note_generiche").insert({
      venue_id: form.venue_id,
      testo,
      conteggi_totali: conteggiTotali,
      conteggi_rimasti: conteggiRimasti,
      status: "attiva",
    });
    if (error) return toast.error(error.message);
    setShowNewNota(false);
    toast.success("Nota creata");
    loadAll();
  }

  async function setNotaStatus(n, status) {
    const { error } = await supabase
      .from("note_generiche")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", n.id);
    if (error) return toast.error(error.message);
    toast.success(status === "attiva" ? "Nota riattivata" : "Nota chiusa");
    loadAll();
  }

  // ─── MODIFICA DEBITO / BONUS / NOTA ───────────────────────────
  async function updateDebito(row, form) {
    const added = form.nuova_erogazione === '' ? 0 : Number(form.nuova_erogazione);
    if (!validAmount(added, true)) return toast.warning('Inserisci una nuova erogazione valida in euro interi');
    const { error } = await supabase.rpc('admin_v13_save_debito', { p_id: row.id, p_expected: row,
      p_patch: debtPatch(form), p_erogazione: added, p_data: added > 0 ? form.data : null });
    if (error) throw new Error(debtError(error));
    setEditItem(null); setDetailDebito(null);
    toast.success(added > 0 ? 'Nuova erogazione registrata' : 'Condizioni aggiornate'); await loadAll();
  }

  async function updateBonus(row, form) {
    if (!row) return;
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const importo = Math.trunc(Number(form.importo) || 0);
    if (importo <= 0) return toast.warning("Inserisci un importo valido");
    if (!form.periodicita) return toast.warning("Scegli la periodicità");
    if (
      row.status === "attivo" &&
      bonus.some(
        (b) =>
          b.id !== row.id &&
          b.status === "attivo" &&
          String(b.venue_id) === String(form.venue_id),
      )
    )
      return toast.error("Questo locale ha già un altro bonus attivo");

    const dip = dipendenti.find(
      (x) => String(x.auth_user_id) === String(form.agent_id),
    );
    const { error } = await supabase
      .from("bonus")
      .update({
        venue_id: form.venue_id,
        agent_id: form.agent_id || null,
        agent_name: dip?.full_name || null,
        importo,
        periodicita: form.periodicita,
        note: form.note?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    setEditItem(null);
    toast.success("Bonus modificato");
    loadAll();
  }

  async function updateNota(row, form) {
    if (!row) return;
    if (!form.venue_id) return toast.warning("Seleziona un locale");
    const testo = (form.testo || "").trim();
    if (!testo) return toast.warning("Scrivi il testo della nota");

    let conteggiTotali = null;
    let conteggiRimasti = null;
    if (!form.sempre) {
      conteggiTotali = Math.trunc(Number(form.conteggi_totali) || 0);
      if (conteggiTotali <= 0)
        return toast.warning("Indica per quanti conteggi (almeno 1)");
      const vecchiTotali = Math.trunc(Number(row.conteggi_totali) || 0);
      const vecchiRimasti = Math.trunc(Number(row.conteggi_rimasti) || 0);
      const giaConsumati =
        vecchiTotali > 0 ? Math.max(0, vecchiTotali - vecchiRimasti) : 0;
      conteggiRimasti = Math.max(0, conteggiTotali - giaConsumati);
    }

    const { error } = await supabase
      .from("note_generiche")
      .update({
        venue_id: form.venue_id,
        testo,
        conteggi_totali: conteggiTotali,
        conteggi_rimasti: conteggiRimasti,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    setEditItem(null);
    toast.success("Nota modificata");
    loadAll();
  }

  // ─── DELETE ─────────────────────────────────────────────────────
  async function doDelete() {
    const c = confirmDelete;
    if (!c) return;
    const table =
      c.kind === "debito"
        ? "debiti"
        : c.kind === "bonus"
          ? "bonus"
          : "note_generiche";
    const { error } = await supabase.from(table).delete().eq("id", c.row.id);
    if (error) return toast.error(error.message);
    setConfirmDelete(null);
    if (c.kind === "debito" && detailDebito?.id === c.row.id)
      setDetailDebito(null);
    toast.success("Eliminato");
    loadAll();
  }

  const debitiAttivi = debiti.filter((d) => d.status === "attivo");
  const debitiChiusi = debiti.filter((d) => d.status !== "attivo");
  const debitoResiduoTotale = debitiAttivi.reduce(
    (sum, d) => sum + Math.trunc(Number(d.residuo) || 0),
    0,
  );
  const bonusAttivi = bonus.filter((b) => b.status === "attivo");
  const noteAttive = note.filter((n) => n.status === "attiva");

  const matchesSearch = r => venueLabel(r.venue_id).toLocaleLowerCase().includes(search.toLocaleLowerCase().trim());

  return (
    <SavingContext.Provider value={saving}><div className="finance-theme h-full min-h-0"><PageLayout>
      <PageBody>
        <div className="finance-shell">
          <section className="finance-hero">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
              <div><p className="finance-eyebrow">Play Money / Gestione finanziaria</p><h1>Debiti e Bonus<span className="text-[#b38e48]">.</span></h1><p className="finance-subtitle">Ogni erogazione, ogni rimborso. Tutto sotto controllo.</p></div>
              <div className="flex gap-2"><button type="button" aria-label="Aggiorna" title="Aggiorna" disabled={loading} onClick={loadAll} className="rounded-xl border border-[#dbc89f] bg-white/70 p-3 text-[#8a682f]"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button><Button variant="primary" icon={Plus} onClick={() => tab === 'debiti' ? setShowNewDebito(true) : tab === 'bonus' ? setShowNewBonus(true) : setShowNewNota(true)}>Nuovo {tab === 'debiti' ? 'debito' : tab === 'bonus' ? 'bonus' : 'promemoria'}</Button></div>
            </div>
          </section>
          <div className="finance-stats">
            <div className="finance-stat"><p className="finance-eyebrow">Residuo da rimborsare</p><strong>{fmtEuro(debitoResiduoTotale)}</strong><small>{debitiAttivi.length} posizioni attive</small></div>
            <div className="finance-stat"><p className="finance-eyebrow">Bonus attivi</p><strong>{bonusAttivi.length}</strong><small>Incentivi ai locali</small></div>
            <div className="finance-stat"><p className="finance-eyebrow">Note attive</p><strong>{noteAttive.length}</strong><small>Promemoria per i conteggi</small></div>
          </div>
          <div className="finance-toolbar">
            <nav className="finance-tabs" role="tablist" aria-label="Gestione locali">
              {[['debiti', 'Debiti', debitiAttivi.length], ['bonus', 'Bonus', bonusAttivi.length], ['note', 'Note', noteAttive.length]].map(([id, label, count]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}<span>{count}</span></button>)}
            </nav>
            <div className="w-full sm:w-[260px]"><Input leftIcon={Search} aria-label="Cerca locale" placeholder="Cerca un locale…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
          {loadError && <div role="alert" className="debt-ledger-note mb-4">Dati non aggiornati: {loadError}. Premi Aggiorna per riprovare.</div>}
          {(loading || opening) && <p role="status" className="mb-3 text-xs text-[#8a795a]">{opening ? 'Caricamento dello storico…' : 'Aggiornamento dati…'}</p>}
          {search && !(tab === 'debiti' ? debiti : tab === 'bonus' ? bonus : note).some(matchesSearch) && <EmptyState icon={Search} title="Nessun locale trovato" description="Prova a cambiare il nome o il codice cercato." />}
            {tab === "debiti" && (
              <div className="space-y-3">
                {debitiAttivi.length === 0 && debitiChiusi.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="Nessun debito"
                    description="Crea un nuovo debito per un locale."
                  />
                ) : (
                  <>
                    {debitiAttivi.filter(matchesSearch).map((d) => (
                      <DebitoCard
                        key={d.id}
                        d={d}
                        venueLabel={venueLabel}
                        onOpen={() => openDebt(d)}
                        onPdf={() => exportDebt(d)}
                        onDeduct={() => startDeduct(d)}
                        onEdit={() => openDebt(d, true)}
                        onDelete={() =>
                          setConfirmDelete({ kind: "debito", row: d })
                        }
                      />
                    ))}
                    {debitiChiusi.length > 0 && (
                      <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Estinti / annullati
                      </p>
                    )}
                    {debitiChiusi.filter(matchesSearch).map((d) => (
                      <DebitoCard
                        key={d.id}
                        d={d}
                        venueLabel={venueLabel}
                        closed
                        onDeduct={Number(d.residuo) > 0 && d.status !== "annullato" ? () => startDeduct(d) : undefined}
                        onOpen={() => openDebt(d)}
                        onPdf={() => exportDebt(d)}
                        onEdit={() => openDebt(d, true)}
                        onDelete={() =>
                          setConfirmDelete({ kind: "debito", row: d })
                        }
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {tab === "bonus" && (
              <div className="space-y-3">
                {bonus.length === 0 ? (
                  <EmptyState
                    icon={Gift}
                    title="Nessun bonus"
                    description="Crea un nuovo bonus per un locale."
                  />
                ) : (
                  bonus.filter(matchesSearch).map((b) => (
                    <BonusCard
                      key={b.id}
                      b={b}
                      venueLabel={venueLabel}
                      onToggle={() => saveAction(() => toggleBonus(b))}
                      onEdit={() => setEditItem({ kind: "bonus", row: b })}
                      onDelete={() =>
                        setConfirmDelete({ kind: "bonus", row: b })
                      }
                    />
                  ))
                )}
              </div>
            )}

            {tab === "note" && (
              <div className="space-y-3">
                {note.length === 0 ? (
                  <EmptyState
                    icon={StickyNote}
                    title="Nessuna nota"
                    description="Crea una nota generica da mostrare sul conteggio di un locale."
                  />
                ) : (
                  note.filter(matchesSearch).map((n) => (
                    <NotaCard
                      key={n.id}
                      n={n}
                      venueLabel={venueLabel}
                      onToggle={() =>
                        setNotaStatus(
                          n,
                          n.status === "attiva" ? "chiusa" : "attiva",
                        )
                      }
                      onEdit={() => setEditItem({ kind: "nota", row: n })}
                      onDelete={() =>
                        setConfirmDelete({ kind: "nota", row: n })
                      }
                    />
                  ))
                )}
              </div>
            )}
        </div>
      </PageBody>

      {/* NUOVO DEBITO */}
      {showNewDebito && <NewDebitoModal
        open={showNewDebito}
        onClose={() => setShowNewDebito(false)}
        venues={venues}
        onCreate={form => saveAction(() => createDebito(form))}
      />}

      {/* NUOVO BONUS */}
      {showNewBonus && <NewBonusModal
        open={showNewBonus}
        onClose={() => setShowNewBonus(false)}
        venues={venues}
        dipendenti={dipendenti}
        onCreate={form => saveAction(() => createBonus(form))}
      />}

      {/* NUOVA NOTA */}
      {showNewNota && <NewNotaModal
        open={showNewNota}
        onClose={() => setShowNewNota(false)}
        venues={venues}
        onCreate={form => saveAction(() => createNota(form))}
      />}

      {/* DETTAGLIO DEBITO */}
      <Modal
        open={!!detailDebito}
        onClose={() => setDetailDebito(null)}
        title="Dettaglio debito"
        width="lg"
      >
        {detailDebito && <div>
          <p className="mb-4 text-lg font-semibold">{venueLabel(detailDebito.venue_id)}</p>
          <DebtSummary debt={detailDebito} />
          <div className="debt-actions my-4">
            <button onClick={() => exportDebt(detailDebito)}><FileText size={15} /> Apri PDF</button>
            {Number(detailDebito.residuo) > 0 && detailDebito.status !== 'annullato' && <><button onClick={() => startDeduct(detailDebito)}><MinusCircle size={15} /> Aggiungi decurtazione</button><button onClick={() => startDeduct(detailDebito, true)}><CheckCircle2 size={15} /> Rimborsa tutto</button></>}
          </div>
          <div className="finance-section-label">Storico movimenti <span className="normal-case tracking-normal font-normal">Dal più vecchio</span></div>
          <DebtLedgerTable debt={detailDebito} snapshot={movByDebito[detailDebito.id]} />
        </div>}
      </Modal>

      {/* DECURTAZIONE MANUALE */}
      <Modal
        open={!!manualDeduct}
        onClose={() => setManualDeduct(null)}
        title="Registra decurtazione"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManualDeduct(null)}>
              Annulla
            </Button>
            <Button variant="primary" onClick={() => saveAction(applyManualDeduct)}>
              Registra
            </Button>
          </>
        }
      >
        {manualDeduct && (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {venueLabel(manualDeduct.venue_id)} · residuo attuale{" "}
              <strong>{fmtEuro(manualDeduct.residuo)}</strong>
            </p>
            <Field label="Data rimborso"><Input type="date" value={manualDate} min={manualDeduct.data_erogazione || undefined} max={todayKey()} onChange={e => setManualDate(e.target.value)} /></Field>
            <Field label="Importo da scalare (€)">
              <Input
                type="number"
                inputMode="numeric"
                value={manualAmount}
                min="1" step="1" max={manualDeduct.residuo}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="es. 250"
                autoFocus
              />
            </Field>
            <div className="debt-balance-panel"><small>Residuo dopo il rimborso</small><strong>{fmtEuro(Number(manualDeduct.residuo) - (Number(manualAmount) || 0))}</strong></div>
          </div>
        )}
      </Modal>

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        venues={venues}
        dipendenti={dipendenti}
        snapshots={movByDebito}
        onSaveDebito={(row, form) => saveAction(() => updateDebito(row, form))}
        onSaveBonus={(row, form) => saveAction(() => updateBonus(row, form))}
        onSaveNota={(row, form) => saveAction(() => updateNota(row, form))}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={
          confirmDelete?.kind === "debito"
            ? "Elimina debito"
            : confirmDelete?.kind === "bonus"
              ? "Elimina bonus"
              : "Elimina nota"
        }
        message="L'operazione eliminerà anche lo storico collegato e non è reversibile. Procedere?"
        confirmLabel="Elimina"
        onConfirm={() => saveAction(doDelete)}
      />
    </PageLayout></div></SavingContext.Provider>
  );
}

// ════════════════════════════════════════════════════════════════
// SOTTO-COMPONENTI
// ════════════════════════════════════════════════════════════════

function DebtSummary({ debt }) {
  const t = debtTotals(debt);
  return <div className="debt-amounts"><div><small>Residuo da rimborsare</small><strong>{fmtEuro(t.remaining)}</strong></div><div><small>Totale erogato</small><strong>{fmtEuro(t.total)}</strong></div><div><small>Già rimborsato</small><strong>{fmtEuro(t.repaid)}</strong></div></div>;
}
function DebtLedgerTable({ debt, snapshot }) {
  if (!snapshot) return <p role="status">Caricamento movimenti…</p>;
  const l = debtLedger(debt, snapshot.repayments, snapshot.disbursements);
  return <div className="debt-ledger"><table aria-label="Erogazioni e rimborsi"><thead><tr><th scope="col">Data</th><th scope="col">Erogato</th><th scope="col">Rimborsato</th></tr></thead><tbody>{l.rows.map(r => <tr key={r.id}><td>{formatITDate(r.date)}<small>{r.label}</small></td><td className="font-semibold text-[#94702e]">{r.paid ? fmtEuro(r.paid) : '—'}</td><td className="font-semibold">{r.repaid ? fmtEuro(r.repaid) : '—'}</td></tr>)}</tbody><tfoot><tr><td>Totali</td><td>{fmtEuro(l.paid)}</td><td>{fmtEuro(l.repaid)}</td></tr></tfoot></table>{l.difference !== 0 && <div className="debt-ledger-note">Storico pregresso da verificare: il saldo dei movimenti differisce dal residuo registrato di {fmtEuro(l.difference)}. Nessun rimborso è stato aggiunto automaticamente.</div>}</div>;
}
function DebitoCard({ d, venueLabel, onOpen, onDeduct, onEdit, onDelete, onPdf, closed = false }) {
  const t = debtTotals(d);
  const terms = d.modalita === 'bonifico' ? 'Bonifico' : `${d.rata_tipo === 'tutto_aggio' ? 'Tutto aggio' : `Rata ${fmtEuro(d.rata_importo)}`} · ${PERIODICITA_LABEL[d.periodicita] || 'Contanti'}`;
  return <article className="debt-card">
    <div className="debt-card-head"><button className="debt-venue" onClick={onOpen}><span className="debt-venue-icon"><Building2 size={20} /></span><span><strong>{venueLabel(d.venue_id)}</strong><small>{terms}</small></span></button><span className={`debt-status ${closed ? d.status === 'estinto' ? 'closed' : 'cancelled' : ''}`}>{d.status === 'attivo' ? 'In rimborso' : d.status === 'estinto' ? 'Estinto' : 'Annullato'}</span></div>
    <DebtSummary debt={d} />
    {d.status === 'estinto' && t.remaining > 0 && <p className="debt-ledger-note mb-3">Questa posizione risulta estinta ma ha ancora un residuo. Verifica i rimborsi.</p>}
    <div className="debt-track" role="progressbar" aria-label="Quota rimborsata" aria-valuenow={t.percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${t.percent}%` }} /></div>
    <div className="flex justify-between gap-3 text-[10px] text-[#978669]"><span>{t.percent}% rimborsato</span><span>Iniziale {fmtEuro(t.initial)}{t.added > 0 ? ` + ${fmtEuro(t.added)} erogati` : ''}</span></div>
    <div className="debt-card-foot"><button onClick={onOpen} className="flex items-center gap-1 text-[11px] font-semibold text-[#8b6d37]">Vedi movimenti <ArrowUpRight size={14} /></button><div className="debt-actions"><button onClick={onEdit} title="Modifica debito"><Pencil size={14} /><span>Modifica</span></button>{onDeduct && <button onClick={onDeduct}><MinusCircle size={14} /><span>Decurtazione</span></button>}<button onClick={onPdf}><FileText size={14} /><span>PDF</span></button><button className="danger" onClick={onDelete} aria-label={`Elimina debito ${venueLabel(d.venue_id)}`} title="Elimina debito"><Trash2 size={14} /></button></div></div>
  </article>;
}

function BonusCard({ b, venueLabel, onToggle, onEdit, onDelete }) {
  const attivo = b.status === "attivo";
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#e5dccb] bg-[#fffdf9] shadow-[0_18px_38px_-32px_rgba(89,66,28,.5)] transition hover:-translate-y-0.5">
      <div
        className={`flex items-center justify-between gap-3 p-3 md:p-4 ${attivo ? "" : "opacity-70"}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gift
              size={14}
              className="shrink-0 text-[var(--color-text-muted)]"
            />
            <p className="truncate text-[14px] font-semibold">
              {venueLabel(b.venue_id)}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {PERIODICITA_LABEL[b.periodicita]}
            {b.agent_name ? ` · ${b.agent_name}` : ""}
          </p>
          <p className="mt-1 text-[20px] font-extrabold tabular-nums text-[#916b28]">
            {fmtEuro(b.importo)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={attivo ? "success" : "default"} size="sm">
            {attivo ? "Attivo" : "Sospeso"}
          </Badge>
          <IconButton
            icon={attivo ? Pause : Play}
            variant="accent"
            onClick={onToggle}
            title={attivo ? "Sospendi" : "Riattiva"}
          />
          <IconButton
            icon={Pencil}
            variant="accent"
            onClick={onEdit}
            title="Modifica"
          />
          <IconButton
            icon={Trash2}
            variant="danger"
            onClick={onDelete}
            title="Elimina"
          />
        </div>
      </div>
    </article>
  );
}

function NotaCard({ n, venueLabel, onToggle, onEdit, onDelete }) {
  const attiva = n.status === "attiva";
  const sempre = n.conteggi_totali == null;
  return (
    <article className="overflow-hidden rounded-[22px] border border-amber-200 bg-[#fffdf9] shadow-[0_18px_38px_-32px_rgba(120,77,8,.6)] transition hover:-translate-y-0.5">
      <div className={`p-3 md:p-4 ${attiva ? "" : "opacity-70"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StickyNote
                size={14}
                className="shrink-0 text-[var(--color-text-muted)]"
              />
              <p className="truncate text-[14px] font-semibold">
                {venueLabel(n.venue_id)}
              </p>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-[var(--color-text)]">
              {n.testo}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={attiva ? "warning" : "default"} size="sm">
              {attiva ? "Attiva" : "Chiusa"}
            </Badge>
            <IconButton
              icon={attiva ? Pause : Play}
              variant="accent"
              onClick={onToggle}
              title={attiva ? "Chiudi" : "Riattiva"}
            />
            <IconButton
              icon={Pencil}
              variant="accent"
              onClick={onEdit}
              title="Modifica"
            />
            <IconButton
              icon={Trash2}
              variant="danger"
              onClick={onDelete}
              title="Elimina"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          {sempre ? (
            <>
              <InfinityIcon size={13} /> Sempre attiva
            </>
          ) : (
            <>
              Compare per {n.conteggi_rimasti}/{n.conteggi_totali} conteggi
              rimanenti
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function NewDebitoModal({ open, onClose, venues, onCreate }) {
  const [form, setForm] = useState({
    id: crypto.randomUUID(), data: todayKey(),
    venue_id: "",
    importo_iniziale: "",
    modalita: "contanti",
    periodicita: "ogni_conteggio",
    rata_tipo: "fisso",
    rata_importo: "",
    note: "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isContanti = form.modalita === "contanti";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo debito"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Crea debito
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Data erogazione" required><Input type="date" value={form.data} max={todayKey()} onChange={e => set("data", e.target.value)} /></Field>
        <Field label="Importo iniziale (€)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo_iniziale}
            onChange={(e) => set("importo_iniziale", e.target.value)}
            placeholder="es. 10000"
          />
        </Field>

        <Field label="Modalità di rimborso" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={isContanti}
              onClick={() => set("modalita", "contanti")}
              icon={Banknote}
              label="Contanti"
            />
            <ChoiceChip
              active={!isContanti}
              onClick={() => set("modalita", "bonifico")}
              icon={Landmark}
              label="Bonifico"
            />
          </div>
        </Field>

        {isContanti && (
          <>
            <Field label="Periodicità" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.periodicita === "ogni_conteggio"}
                  onClick={() => set("periodicita", "ogni_conteggio")}
                  label="Ogni conteggio"
                />
                <ChoiceChip
                  active={form.periodicita === "ogni_fine_mese"}
                  onClick={() => set("periodicita", "ogni_fine_mese")}
                  label="Ogni fine mese"
                />
              </div>
            </Field>

            <Field label="Importo da scalare" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.rata_tipo === "fisso"}
                  onClick={() => set("rata_tipo", "fisso")}
                  label="Importo rata"
                />
                <ChoiceChip
                  active={form.rata_tipo === "tutto_aggio"}
                  onClick={() => set("rata_tipo", "tutto_aggio")}
                  label="Tutto aggio"
                />
              </div>
            </Field>

            {form.rata_tipo === "fisso" && (
              <Field label="Importo rata (€)" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.rata_importo}
                  onChange={(e) => set("rata_importo", e.target.value)}
                  placeholder="es. 250"
                />
              </Field>
            )}
            {form.rata_tipo === "tutto_aggio" && (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                {"L'operatore scalerà nel conteggio "}
                <strong>{"tutto l'aggio"}</strong>
                {" guadagnato dall'esercente."}
              </p>
            )}
          </>
        )}

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function NewBonusModal({ open, onClose, venues, dipendenti, onCreate }) {
  const [form, setForm] = useState({
    venue_id: "",
    agent_id: "",
    importo: "",
    periodicita: "ogni_conteggio",
    note: "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo bonus"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Crea bonus
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Agente (opzionale)">
          <Select
            value={form.agent_id}
            onChange={(e) => set("agent_id", e.target.value)}
          >
            <option value="">—</option>
            {dipendenti.map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id || ""}>
                {d.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Importo bonus (€)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo}
            onChange={(e) => set("importo", e.target.value)}
            placeholder="es. 250"
          />
        </Field>

        <Field label="Periodicità" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={form.periodicita === "ogni_conteggio"}
              onClick={() => set("periodicita", "ogni_conteggio")}
              label="Ogni conteggio"
            />
            <ChoiceChip
              active={form.periodicita === "ogni_fine_mese"}
              onClick={() => set("periodicita", "ogni_fine_mese")}
              label="Ogni fine mese"
            />
          </div>
        </Field>

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function NewNotaModal({ open, onClose, venues, onCreate }) {
  const [form, setForm] = useState({
    venue_id: "",
    testo: "",
    sempre: false,
    conteggi_totali: "1",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuova nota"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onCreate(form)}>
            Crea nota
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Testo della nota" required>
          <Textarea
            rows={3}
            value={form.testo}
            onChange={(e) => set("testo", e.target.value)}
            placeholder="es. Ricordare di ritirare le chiavi di scorta"
          />
        </Field>

        <Field label="Per quanti conteggi deve comparire?" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={!form.sempre}
              onClick={() => set("sempre", false)}
              label="N° conteggi"
            />
            <ChoiceChip
              active={form.sempre}
              onClick={() => set("sempre", true)}
              icon={InfinityIcon}
              label="Sempre"
            />
          </div>
        </Field>

        {!form.sempre && (
          <Field
            label="Numero di conteggi"
            required
            hint="La nota sparirà da sola dopo questo numero di conteggi salvati per il locale."
          >
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={form.conteggi_totali}
              onChange={(e) => set("conteggi_totali", e.target.value)}
              placeholder="es. 3"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function SearchableVenueSelect({ venues, value, onChange }) {
  const selectedVenue = venues.find((v) => String(v.id) === String(value));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedLabel = selectedVenue ? (String(selectedVenue.name || '').startsWith(String(selectedVenue.id)) ? selectedVenue.name : `${selectedVenue.id} ${selectedVenue.name}`) : '';
  const normalizedQuery = query.trim().toLowerCase();

  const filteredVenues = useMemo(() => {
    if (!normalizedQuery) return venues.slice(0, 30);

    return venues
      .filter((v) => {
        const id = String(v.id || "").toLowerCase();
        const name = String(v.name || "").toLowerCase();
        const label = `${id} ${name}`;
        return (
          id.includes(normalizedQuery) ||
          name.includes(normalizedQuery) ||
          label.includes(normalizedQuery)
        );
      })
      .slice(0, 30);
  }, [venues, normalizedQuery]);

  const pickVenue = (venue) => {
    const label = String(venue.name || "").startsWith(String(venue.id))
      ? venue.name
      : `${venue.id} ${venue.name}`;

    onChange(venue.id);
    setQuery(label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={open ? query : selectedLabel}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setOpen(true);
        }}
        placeholder="Cerca e seleziona locale..."
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white shadow-xl">
          {filteredVenues.length > 0 ? (
            filteredVenues.map((v) => {
              return (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickVenue(v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50"
                >
                  <span className="font-semibold text-slate-900">{v.id}</span>
                  <span className="truncate text-slate-700">{v.name}</span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              Nessun locale trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditItemModal({
  item,
  onClose,
  venues,
  dipendenti,
  onSaveDebito,
  snapshots,
  onSaveBonus,
  onSaveNota,
}) {
  if (!item) return null;
  if (item.kind === "debito") {
    return (
      <EditDebitoModal
        open={!!item}
        onClose={onClose}
        row={item.row}
        venues={venues}
        onSave={onSaveDebito}
        snapshot={snapshots?.[item.row.id]}
      />
    );
  }
  if (item.kind === "bonus") {
    return (
      <EditBonusModal
        open={!!item}
        onClose={onClose}
        row={item.row}
        venues={venues}
        dipendenti={dipendenti}
        onSave={onSaveBonus}
      />
    );
  }
  return (
    <EditNotaModal
      open={!!item}
      onClose={onClose}
      row={item.row}
      venues={venues}
      onSave={onSaveNota}
    />
  );
}

function EditDebitoModal({ open, onClose, row, venues, onSave, snapshot }) {
  const [form, setForm] = useState(() => ({
        venue_id: row.venue_id || "",
        nuova_erogazione: "", data: todayKey(),
        modalita: row.modalita || "contanti",
        periodicita: row.periodicita || "ogni_conteggio",
        rata_tipo: row.rata_tipo || "fisso",
        rata_importo:
          row.rata_importo != null
            ? String(Math.trunc(Number(row.rata_importo) || 0))
            : "",
        note: row.note || "",
      }));
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isContanti = form.modalita === "contanti";
  const totals = debtTotals(row || {});
  const added = Number(form.nuova_erogazione) || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifica debito"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSave(row, form)}>
            Salva modifiche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div><p className="finance-eyebrow">Locale</p><p className="mt-1 text-base font-semibold">{(() => { const v = venues.find(v => String(v.id) === String(row?.venue_id)); return v ? (v.name.toLowerCase().startsWith(String(v.id).toLowerCase()) ? v.name : `${v.id} ${v.name}`) : row?.venue_id; })()}</p></div>
        <div className="debt-editor-summary my-2">
          <div className="debt-balance-panel"><small>Importo iniziale</small><strong>{fmtEuro(totals.initial)}</strong><div className="mt-4 border-t border-[#dfcfaa] pt-3"><small>Residuo attuale</small><strong className="text-[#946b26]">{fmtEuro(totals.remaining)}</strong></div><p className="mt-2 text-[11px] text-[#8b7752]">Totale erogato {fmtEuro(totals.total)}</p></div>
          <div className="debt-add-panel"><p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#896225]"><Plus size={16} /> Nuova erogazione</p><Field label="Importo da aggiungere (€)"><Input type="number" min="1" step="1" inputMode="numeric" placeholder="Nessuna aggiunta" value={form.nuova_erogazione} disabled={row?.status === 'annullato'} onChange={e => set('nuova_erogazione', e.target.value)} /></Field><div className="mt-3"><Field label="Data erogazione"><Input type="date" value={form.data} min={row?.data_erogazione || undefined} max={todayKey()} disabled={!added} onChange={e => set('data', e.target.value)} /></Field></div></div>
        </div>
        {added > 0 && <div className="flex flex-wrap justify-between gap-3 rounded-xl bg-[#f2e6c8] p-3 text-[12px] text-[#765522]"><span>Dopo il salvataggio · Totale erogato <strong>{fmtEuro(totals.total + added)}</strong></span><span>Nuovo residuo <strong>{fmtEuro(totals.remaining + added)}</strong></span></div>}
        <div className="finance-section-label">Condizioni di rimborso</div>
        <Field label="Modalità di rimborso" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={isContanti}
              onClick={() => set("modalita", "contanti")}
              icon={Banknote}
              label="Contanti"
            />
            <ChoiceChip
              active={!isContanti}
              onClick={() => set("modalita", "bonifico")}
              icon={Landmark}
              label="Bonifico"
            />
          </div>
        </Field>

        {isContanti && (
          <>
            <Field label="Periodicità" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.periodicita === "ogni_conteggio"}
                  onClick={() => set("periodicita", "ogni_conteggio")}
                  label="Ogni conteggio"
                />
                <ChoiceChip
                  active={form.periodicita === "ogni_fine_mese"}
                  onClick={() => set("periodicita", "ogni_fine_mese")}
                  label="Ogni fine mese"
                />
              </div>
            </Field>

            <Field label="Importo da scalare" required>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceChip
                  active={form.rata_tipo === "fisso"}
                  onClick={() => set("rata_tipo", "fisso")}
                  label="Importo rata"
                />
                <ChoiceChip
                  active={form.rata_tipo === "tutto_aggio"}
                  onClick={() => set("rata_tipo", "tutto_aggio")}
                  label="Tutto aggio"
                />
              </div>
            </Field>

            {form.rata_tipo === "fisso" && (
              <Field label="Importo rata (€)" required>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.rata_importo}
                  onChange={(e) => set("rata_importo", e.target.value)}
                  placeholder="es. 250"
                />
              </Field>
            )}
          </>
        )}

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
        <div className="finance-section-label">Erogazioni e rimborsi <span className="normal-case tracking-normal font-normal">Dal più vecchio</span></div>
        <DebtLedgerTable debt={row} snapshot={snapshot} />
      </div>
    </Modal>
  );
}

function EditBonusModal({ open, onClose, row, venues, dipendenti, onSave }) {
  const [form, setForm] = useState(() => ({
        venue_id: row.venue_id || "",
        agent_id: row.agent_id || "",
        importo: String(Math.trunc(Number(row.importo) || 0) || ""),
        periodicita: row.periodicita || "ogni_conteggio",
        note: row.note || "",
      }));
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifica bonus"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSave(row, form)}>
            Salva modifiche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Agente (opzionale)">
          <Select
            value={form.agent_id}
            onChange={(e) => set("agent_id", e.target.value)}
          >
            <option value="">—</option>
            {dipendenti.map((d) => (
              <option key={d.id || d.auth_user_id} value={d.auth_user_id || ""}>
                {d.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Importo bonus (€)" required>
          <Input
            type="number"
            inputMode="numeric"
            value={form.importo}
            onChange={(e) => set("importo", e.target.value)}
            placeholder="es. 250"
          />
        </Field>

        <Field label="Periodicità" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={form.periodicita === "ogni_conteggio"}
              onClick={() => set("periodicita", "ogni_conteggio")}
              label="Ogni conteggio"
            />
            <ChoiceChip
              active={form.periodicita === "ogni_fine_mese"}
              onClick={() => set("periodicita", "ogni_fine_mese")}
              label="Ogni fine mese"
            />
          </div>
        </Field>

        <Field label="Note (opzionale)">
          <Textarea
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditNotaModal({ open, onClose, row, venues, onSave }) {
  const [form, setForm] = useState(() => ({
        venue_id: row.venue_id || "",
        testo: row.testo || "",
        sempre: row.conteggi_totali == null,
        conteggi_totali:
          row.conteggi_totali != null
            ? String(Math.trunc(Number(row.conteggi_totali) || 1))
            : "1",
      }));
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const vecchiTotali = Math.trunc(Number(row?.conteggi_totali) || 0);
  const vecchiRimasti = Math.trunc(Number(row?.conteggi_rimasti) || 0);
  const giaConsumati =
    vecchiTotali > 0 ? Math.max(0, vecchiTotali - vecchiRimasti) : 0;
  const nuoviTotali = form.sempre
    ? null
    : Math.trunc(Number(form.conteggi_totali) || 0);
  const nuoviRimasti = form.sempre
    ? null
    : Math.max(0, nuoviTotali - giaConsumati);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifica nota"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSave(row, form)}>
            Salva modifiche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Locale" required>
          <SearchableVenueSelect
            venues={venues}
            value={form.venue_id}
            onChange={(value) => set("venue_id", value)}
          />
        </Field>

        <Field label="Testo della nota" required>
          <Textarea
            rows={3}
            value={form.testo}
            onChange={(e) => set("testo", e.target.value)}
          />
        </Field>

        <Field label="Per quanti conteggi deve comparire?" required>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceChip
              active={!form.sempre}
              onClick={() => set("sempre", false)}
              label="N° conteggi"
            />
            <ChoiceChip
              active={form.sempre}
              onClick={() => set("sempre", true)}
              icon={InfinityIcon}
              label="Sempre"
            />
          </div>
        </Field>

        {!form.sempre && (
          <Field
            label="Numero di conteggi"
            required
            hint={`Già consumati: ${giaConsumati} · nuovi rimanenti: ${nuoviRimasti}`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={form.conteggi_totali}
              onChange={(e) => set("conteggi_totali", e.target.value)}
              placeholder="es. 3"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function ChoiceChip({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-[14px] border text-[11px] font-black uppercase tracking-[.06em] transition ${
        active
          ? "border-[#a87318] bg-[linear-gradient(135deg,#fff0c7,#e8c874)] text-[#68440c] shadow-sm"
          : "border-[#ded0b3] bg-white text-slate-500 hover:border-[#c8a65c] hover:bg-[#fff8e9]"
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {label}
    </button>
  );
}
