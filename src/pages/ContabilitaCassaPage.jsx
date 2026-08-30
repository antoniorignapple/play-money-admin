import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine, CalendarDays, Landmark, Plus, RefreshCw, Trash2,
  Wallet, History, MapPin, FileText, X, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageLayout, PageBody } from '../components/PageLayout'
import { useToast } from '../components/Toast'

function euro(value) {
  const amount = Math.trunc(Number(value) || 0)
  const sign = amount < 0 ? '-' : ''
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${digits} €`
}

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(`${value}T12:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('it-IT')
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ContabilitaCassaPage() {
  const toast = useToast()
  const [periods, setPeriods] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ amount: '', destination: '', transfer_date: todayISO(), note: '' })

  useEffect(() => { loadPeriods() }, [])
  useEffect(() => { if (selectedId) loadPeriod(selectedId) }, [selectedId])

  async function loadPeriods(preferId) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('conteggi_periods')
        .select('id,title,date_from,date_to,status,is_active,created_at')
        .order('date_from', { ascending: false })
      if (error) throw error
      const rows = data || []
      setPeriods(rows)
      const active = rows.find((p) => p.status === 'open' && p.is_active)
      const desired = preferId || selectedId || active?.id || rows[0]?.id || ''
      setSelectedId(desired)
    } catch (e) {
      toast.error(`Contabilità Cassa: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadPeriod(id) {
    setDetailLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_contabilita_cassa_periodo', { p_period_id: id })
      if (error) throw error
      setDetail(data || null)
    } catch (e) {
      toast.error(`Caricamento Cassa: ${e.message}`)
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const selectedPeriod = periods.find((p) => p.id === selectedId)
  const isActive = selectedPeriod?.status === 'open' && selectedPeriod?.is_active === true
  const summary = detail?.summary || {}
  const transfers = Array.isArray(detail?.transfers) ? detail.transfers : []
  const available = Number(summary.cassa_disponibile || 0)
  const daRientrare = Number(summary.da_riportare || 0) - Number(summary.recuperi || 0)
  const tone = available > 0 ? 'text-emerald-600' : available < 0 ? 'text-red-600' : 'text-[#3d2a0b]'
  const daRientrareTone = daRientrare > 0 ? 'text-yellow-500' : daRientrare < 0 ? 'text-red-600' : 'text-[#3d2a0b]'

  const closedPeriods = useMemo(() => periods.filter((p) => p.status === 'closed'), [periods])

  function openNew() {
    if (!isActive) return
    const min = selectedPeriod.date_from
    const max = selectedPeriod.date_to
    const now = todayISO()
    setForm({
      amount: '', destination: '',
      transfer_date: now < min ? min : now > max ? max : now,
      note: '',
    })
    setNewOpen(true)
  }

  async function createTransfer() {
    const amount = Number(String(form.amount).replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning('Inserisci un importo valido')
      return
    }
    if (!form.destination.trim()) {
      toast.warning('Scrivi dove sono stati portati i soldi')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('crea_trasferimento_cassa', {
        p_amount: amount,
        p_destination: form.destination.trim(),
        p_transfer_date: form.transfer_date,
        p_note: form.note.trim() || null,
      })
      if (error) throw error
      setNewOpen(false)
      setDetail((current) => current ? {
        ...current,
        summary: data?.summary || current.summary,
        transfers: data?.transfer ? [data.transfer, ...(current.transfers || [])] : current.transfers,
      } : current)
      window.dispatchEvent(new Event('cassa-totale-refresh'))
      toast.success(`Trasferimento registrato • ${euro(amount)}`)
    } catch (e) {
      toast.error(`Trasferimento: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransfer() {
    if (!deleteRow) return
    setDeleting(true)
    try {
      const { data, error } = await supabase.rpc('elimina_trasferimento_cassa', { p_transfer_id: deleteRow.id })
      if (error) throw error
      setDetail((current) => current ? {
        ...current,
        summary: data?.summary || current.summary,
        transfers: (current.transfers || []).filter((x) => x.id !== deleteRow.id),
      } : current)
      window.dispatchEvent(new Event('cassa-totale-refresh'))
      toast.success('Trasferimento eliminato definitivamente')
      setDeleteRow(null)
    } catch (e) {
      toast.error(`Eliminazione: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageLayout>
      <PageBody>
        <div className="mx-auto max-w-[1180px] space-y-5 px-3 py-4 md:px-5">
          <div className="flex items-center justify-center py-1">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#d9b45f]/35 bg-white/70 px-5 py-2.5 shadow-[0_10px_30px_-22px_rgba(95,64,11,.55)] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4e7c2] text-[#98701f]">
                <Wallet size={15}/>
              </div>
              <h1 className="text-[15px] font-black uppercase tracking-[0.20em] text-[#3d2a0b] md:text-[17px]">
                Contabilità Cassa
              </h1>
            </div>
          </div>
          <section className="overflow-hidden rounded-[28px] border border-[#d9b45f]/45 bg-[linear-gradient(145deg,#fffdf7,#fff8e7)] shadow-[0_24px_70px_-42px_rgba(125,87,15,.55)]">
            <div className="grid gap-0 lg:grid-cols-[1.35fr_.65fr]">
              <div className="p-5 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-2 sm:gap-0">
                    <div className="min-w-0 sm:border-r sm:border-[#d9b45f]/30 sm:pr-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a77e2d]">Acconti disponibili</p>
                      <p className={`mt-2 truncate text-[38px] font-black tabular-nums tracking-[-0.055em] md:text-[48px] ${tone}`}>
                        {detailLoading && !detail ? '—' : euro(available)}
                      </p>
                    </div>
                    <div className="min-w-0 border-t border-[#d9b45f]/25 pt-5 sm:border-t-0 sm:pl-6 sm:pt-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-600">Da rientrare</p>
                      <p className={`mt-2 truncate text-[38px] font-black tabular-nums tracking-[-0.055em] md:text-[48px] ${daRientrareTone}`}>
                        {detailLoading && !detail ? '—' : euro(daRientrare)}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <button onClick={openNew}
                      className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[#3d2a0b] px-5 text-[11px] font-black uppercase tracking-[0.13em] text-[#f2cf7a] shadow-lg transition hover:-translate-y-0.5">
                      <Plus size={17}/> Registra trasferimento
                    </button>
                  )}
                </div>
                <p className="mt-5 text-[12px] font-bold text-[#725c35]">
                  {selectedPeriod ? `${fmtDate(selectedPeriod.date_from)} → ${fmtDate(selectedPeriod.date_to)}` : 'Nessun periodo'}
                  {selectedPeriod?.status === 'closed' ? ' • ARCHIVIATO' : ' • PERIODO ATTUALE'}
                </p>
              </div>
              <div className="grid grid-cols-1 border-t border-[#d9b45f]/25 bg-white/55 sm:grid-cols-3 lg:grid-cols-1 lg:border-l lg:border-t-0">
                <Metric label="Acconti del periodo" value={summary.cassa_generata} icon={Wallet} action={
                  <button onClick={() => loadPeriod(selectedId)} disabled={!selectedId || detailLoading}
                    title="Aggiorna Cassa" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#d9b45f]/40 bg-white text-[#98701f] shadow-sm transition hover:bg-[#fff8e8] disabled:opacity-40">
                    <RefreshCw size={14} className={detailLoading ? 'animate-spin' : ''}/>
                  </button>
                }/>
                <Metric label="Trasferito" value={summary.trasferimenti_totale} icon={ArrowDownToLine}/>
                <Metric label="Operazioni" value={summary.trasferimenti_count || 0} icon={Landmark} count/>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <section className="rounded-[24px] border border-black/8 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-black/7 px-5 py-4">
                <div>
                  <h2 className="text-[14px] font-black uppercase tracking-[0.14em] text-[#3d2a0b]">Trasferimenti del periodo</h2>
                  <p className="mt-1 text-[11px] text-black/45">Ogni trasferimento viene sottratto dagli Acconti disponibili.</p>
                </div>
              </div>
              <div className="divide-y divide-black/6">
                {detailLoading && transfers.length === 0 ? (
                  <div className="p-8 text-center text-[12px] text-black/40">Caricamento…</div>
                ) : transfers.length === 0 ? (
                  <div className="p-10 text-center">
                    <Landmark size={28} className="mx-auto text-[#c8a655]"/>
                    <p className="mt-3 text-[13px] font-bold text-black/55">Nessun trasferimento registrato</p>
                  </div>
                ) : transfers.map((row) => (
                  <div key={row.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#f7edcf] text-[#9a7021]">
                      <ArrowDownToLine size={18}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="text-[16px] font-black tabular-nums text-red-600">− {euro(row.amount)}</p>
                        <p className="text-[11px] font-bold text-black/45">{fmtDate(row.transfer_date)}</p>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-black text-[#3d2a0b]">{row.destination}</p>
                      {row.note && <p className="mt-1 text-[11px] text-black/45">{row.note}</p>}
                    </div>
                    {isActive && (
                      <button onClick={() => setDeleteRow(row)} title="Elimina definitivamente"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-[24px] border border-black/8 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 px-1">
                <CalendarDays size={16} className="text-[#aa7f2c]"/>
                <h2 className="text-[12px] font-black uppercase tracking-[0.15em] text-[#3d2a0b]">Periodi conteggi</h2>
              </div>
              <div className="mt-3 space-y-2">
                {periods.map((p) => (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-[16px] border px-3 py-3 text-left transition ${selectedId === p.id ? 'border-[#cda94f] bg-[#fff8e5]' : 'border-black/7 bg-white hover:bg-black/[.02]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black text-[#3d2a0b]">{fmtDate(p.date_from)} → {fmtDate(p.date_to)}</p>
                      <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.1em] ${p.status === 'closed' ? 'bg-black/[.05] text-black/45' : 'bg-emerald-50 text-emerald-700'}`}>
                        {p.status === 'closed' ? 'Chiuso' : 'Attuale'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-black/35">{p.title}</p>
                  </button>
                ))}
                {!loading && periods.length === 0 && <p className="p-4 text-center text-[11px] text-black/40">Nessun periodo</p>}
              </div>
            </aside>
          </div>
        </div>
      </PageBody>

      {newOpen && (
        <Modal onClose={() => !saving && setNewOpen(false)} title="REGISTRA TRASFERIMENTO">
          <div className="space-y-4">
            <Field label="Importo (€)">
              <input autoFocus inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="h-12 w-full rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 text-[20px] font-black tabular-nums outline-none focus:border-[#c9a348]" placeholder="10.000"/>
            </Field>
            <Field label="Dove sono stati portati i soldi">
              <div className="relative"><MapPin size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35"/>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="h-11 w-full rounded-[14px] border border-black/10 bg-[#faf9f5] pl-11 pr-4 text-[13px] font-bold outline-none focus:border-[#c9a348]" placeholder="Scrivi la destinazione"/>
              </div>
            </Field>
            <Field label="Data">
              <input type="date" min={selectedPeriod?.date_from} max={selectedPeriod?.date_to} value={form.transfer_date}
                onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                className="h-11 w-full rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 text-[13px] font-bold outline-none focus:border-[#c9a348]"/>
            </Field>
            <Field label="Nota (facoltativa)">
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3}
                className="w-full resize-none rounded-[14px] border border-black/10 bg-[#faf9f5] px-4 py-3 text-[13px] outline-none focus:border-[#c9a348]" placeholder="Aggiungi una nota…"/>
            </Field>
            <button onClick={createTransfer} disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[#3d2a0b] text-[11px] font-black uppercase tracking-[0.14em] text-[#f0cc77] disabled:opacity-50">
              {saving ? <RefreshCw size={16} className="animate-spin"/> : <ArrowDownToLine size={16}/>} {saving ? 'Registrazione…' : 'Registra e sottrai dagli Acconti'}
            </button>
          </div>
        </Modal>
      )}

      {deleteRow && (
        <Modal onClose={() => !deleting && setDeleteRow(null)} title="ELIMINA TRASFERIMENTO">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={24}/></div>
            <p className="mt-4 text-[13px] font-bold text-black/60">Eliminare definitivamente questo trasferimento?</p>
            <p className="mt-2 text-[30px] font-black tabular-nums text-red-600">{euro(deleteRow.amount)}</p>
            <p className="mt-1 text-[12px] font-bold text-[#3d2a0b]">{deleteRow.destination}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setDeleteRow(null)} disabled={deleting} className="h-11 rounded-[14px] border border-black/10 text-[11px] font-black uppercase tracking-[.12em] text-black/55">Annulla</button>
              <button onClick={deleteTransfer} disabled={deleting} className="h-11 rounded-[14px] bg-red-600 text-[11px] font-black uppercase tracking-[.12em] text-white disabled:opacity-50">{deleting ? 'Elimino…' : 'Elimina'}</button>
            </div>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}

function Metric({ label, value, icon: Icon, count = false, action = null }) {
  return <div className="flex items-center gap-3 border-b border-[#d9b45f]/18 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b lg:border-r-0 lg:last:border-b-0">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#f4e7c2] text-[#98701f]"><Icon size={16}/></div>
    <div className="min-w-0 flex-1"><p className="text-[8px] font-black uppercase tracking-[.16em] text-black/35">{label}</p><p className="mt-1 text-[17px] font-black tabular-nums text-[#3d2a0b]">{count ? Number(value || 0) : euro(value)}</p></div>
    {action}
  </div>
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.15em] text-black/40">{label}</span>{children}</label>
}

function Modal({ title, children, onClose }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
    <div className="w-full max-w-[480px] overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-black/7 px-5 py-4"><h3 className="text-[12px] font-black uppercase tracking-[.15em] text-[#3d2a0b]">{title}</h3><button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 hover:bg-black/5"><X size={17}/></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
}
