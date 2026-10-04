import { useEffect, useMemo, useState } from 'react'
import {
  Calendar, User, Building2, Plus, RefreshCw,
  RotateCcw, Pencil, Trash2, Search,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Button, IconButton, Input, Select, Badge, EmptyState, Field, Modal,
} from '../components/ui'
import { PageLayout, PageBody } from '../components/PageLayout'
import { ConfirmDialog } from '../components/FormDialog'
import { SkeletonRow } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import {
  todayISO, toIT, formatDateTime, formatEuro0,
  dipendenteName, dipendenteId, normNumber,
} from '../lib/helpers'
import { closePdfPreviewWindow, createPdfPreviewWindow, openPdfPreview } from '../lib/pdfPreview'
import { DIPENDENTI_SAFE_FIELDS } from '../lib/dipendentiFields'

/* ============ PDF EXPORT ============ */
async function toDataUrl(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function exportMovementsToPdf({ dateLabel, operatorName, fondo, movements, totals, targetWindow }) {
  const mod = await import('jspdf')
  const jsPDF = mod.jsPDF || mod.default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  let logoDataUrl = null
try {
  logoDataUrl = await toDataUrl(`${import.meta.env.BASE_URL}logo512.png.png`)
} catch (e) {
  console.warn('Logo PDF non caricato:', e)
}

  const pageW = doc.internal.pageSize.getWidth()
  const M = 34
  let y = M

  const C = {
    navy: [6, 16, 31], navy2: [8, 47, 73], cyan: [8, 145, 178],
    white: [255, 255, 255], text: [15, 23, 42], muted: [100, 116, 139],
    line: [226, 232, 240], soft: [248, 250, 252],
    blue: [14, 116, 144], orange: [234, 88, 12], green: [21, 128, 61],
  }

  const value = (n) => formatEuro0(Number(n) || 0)
  const label = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : String(v).trim())

  const headerH = 72
  doc.setFillColor(...C.navy)
  doc.roundedRect(M, y, pageW - M * 2, headerH, 18, 18, 'F')
  doc.setFillColor(...C.navy2)
  doc.roundedRect(M + 210, y, pageW - M * 2 - 210, headerH, 18, 18, 'F')

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', M + 16, y + 16, 38, 38) } catch {}
  }

  doc.setTextColor(180, 240, 250); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('PLAY MONEY', M + 66, y + 22)
  doc.setTextColor(...C.white); doc.setFontSize(11)
  doc.text(`Data: ${dateLabel}`, M + 66, y + 38)
  doc.text(`Operatore: ${operatorName || '—'}`, M + 66, y + 52)

  const fondoX = pageW - M - 255
  doc.setTextColor(180, 240, 250); doc.setFontSize(9)
  doc.text('FONDO CASSA', fondoX, y + 20)
  doc.setTextColor(...C.white); doc.setFontSize(9)
  doc.text(`Mezzo: ${label(fondo?.mezzo)}`, fondoX, y + 38)
  doc.text(`KM: ${label(fondo?.km)}`, fondoX + 116, y + 38)
  doc.text(`Monete: ${value(fondo?.monete)}`, fondoX, y + 56)
  doc.text(`Rif.: ${value(fondo?.rifornimento)}`, fondoX + 116, y + 56)

  y += headerH + 10

  const colHead = ['Locale', 'Ora', 'Acconto', 'Recupero', 'Da riportare']
  const colW = [(pageW - M * 2) * 0.34, 60, 100, 100, 110]
  const colX = []
  let cx = M
  colW.forEach((w) => { colX.push(cx); cx += w })

  doc.setFillColor(...C.soft); doc.rect(M, y, pageW - M * 2, 24, 'F')
  doc.setTextColor(...C.muted); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  colHead.forEach((h, i) => {
    const tx = i >= 2 ? colX[i] + colW[i] - 8 : colX[i] + 8
    doc.text(h, tx, y + 16, { align: i >= 2 ? 'right' : 'left' })
  })
  y += 24

  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text); doc.setFontSize(10)
  movements.forEach((m, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252); doc.rect(M, y, pageW - M * 2, 22, 'F')
    }
    doc.text(String(m.venueName || ''), colX[0] + 8, y + 15, { maxWidth: colW[0] - 16 })
    doc.text(String(m.operatorLabel || ''), colX[1] + 8, y + 15)
    doc.setTextColor(...C.blue); doc.text(value(m.acconto), colX[2] + colW[2] - 8, y + 15, { align: 'right' })
    doc.setTextColor(...C.orange); doc.text(value(m.recupero), colX[3] + colW[3] - 8, y + 15, { align: 'right' })
    doc.setTextColor(...C.green); doc.text(value(m.da_riportare), colX[4] + colW[4] - 8, y + 15, { align: 'right' })
    doc.setTextColor(...C.text)
    y += 22
  })

  y += 6
  doc.setDrawColor(...C.line); doc.line(M, y, pageW - M, y); y += 16

  doc.setFillColor(...C.navy); doc.roundedRect(M, y, pageW - M * 2, 120, 18, 18, 'F')
  doc.setTextColor(180, 240, 250); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('TOTALI', M + 18, y + 22)

  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.white); doc.setFontSize(11)
  doc.text(`Acconti: ${value(totals.accontiRaw)}`, M + 18, y + 44)
  doc.text(`Recuperi: ${value(totals.recuperiRaw)}`, M + 18, y + 60)
  doc.text(`Da riportare: ${value(totals.da_riportareRaw)}`, M + 18, y + 76)
  doc.text(`Monete: ${value(totals.moneteRaw)}`, M + 18, y + 92)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(180, 240, 250)
  doc.text('CASSA GENERALE', pageW - M - 18, y + 70, { align: 'right' })
  doc.setFontSize(24); doc.setTextColor(103, 232, 249)
  doc.text(value(totals.cassaGeneraleRaw), pageW - M - 18, y + 103, { align: 'right' })

  openPdfPreview(doc, targetWindow)
}

function PremiumField({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#1d608a]">
        {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-[10px] border border-[#8fc3e4] bg-[#eaf6fd] text-[#186fa5]"><Icon size={13}/></span>}
        {label}
      </span>
      {children}
    </label>
  )
}

function MovementMoneyRow({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-[19px] border border-[#c9dae4] bg-white px-4 shadow-[0_8px_22px_rgba(39,27,5,.04)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[#88bfe1] bg-[#e7f5fd] text-[#136ba2]"><Icon size={17}/></span>
      <span className="flex-1 text-[14px] font-black text-[#7b8799]">{label}</span>
      <div className="relative w-[132px]">
        <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
          className="h-11 w-full rounded-[13px] border border-[#aacbe0] bg-[#f9fcfe] px-3 pr-8 text-right text-[16px] font-black tabular-nums text-[#0c2a3c] outline-none focus:border-[#2d8dc9] focus:ring-2 focus:ring-[#50a4d9]/20" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-black text-[#1e72a6]">€</span>
      </div>
    </div>
  )
}

function SearchableVenueSelect({ venues, value, onChange, venueLabel }) {
  const selectedVenue = venues.find((v) => String(v.id) === String(value))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selectedVenue && !open) setQuery(venueLabel(selectedVenue.id))
    if (!value && !open) setQuery('')
  }, [selectedVenue, value, open, venueLabel])

  const filteredVenues = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return venues.slice(0, 40)

    return venues.filter((v) => {
      const id = String(v.id || '').toLowerCase()
      const name = String(v.name || '').toLowerCase()
      const label = venueLabel(v.id).toLowerCase()
      return id.includes(q) || name.includes(q) || label.includes(q)
    }).slice(0, 40)
  }, [venues, query, venueLabel])

  const pickVenue = (venue) => {
    onChange(venue.id)
    setQuery(venueLabel(venue.id))
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange('')
          setOpen(true)
        }}
        placeholder="Cerca locale per codice o nome..."
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white shadow-xl">
          {filteredVenues.length > 0 ? (
            filteredVenues.map((v) => (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickVenue(v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="font-semibold text-slate-900">{v.id}</span>
                <span className="truncate text-slate-700">{v.name}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              Nessun locale trovato
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============ PAGE ============ */
export default function CassaPage() {
  const toast = useToast()

  const [movements, setMovements] = useState([])
  const [venues, setVenues] = useState([])
  const [dipendenti, setDipendenti] = useState([])
  const [fondi, setFondi] = useState([])
  const [loading, setLoading] = useState(true)

  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [draftDateFrom, setDraftDateFrom] = useState(todayISO)
  const [draftDateTo, setDraftDateTo] = useState(todayISO)
  const [cognome, setCognome] = useState('')
  const [nomeLocale, setNomeLocale] = useState('')

  const [showGeneric, setShowGeneric] = useState(false)
  const [pendingDeletes, setPendingDeletes] = useState(new Set())
  const [confirmSave, setConfirmSave] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [pdfDate, setPdfDate] = useState(todayISO())
  const [pdfEmployee, setPdfEmployee] = useState('all')

  const [newRow, setNewRow] = useState({
    work_date: todayISO(), venue_id: '', created_by: '',
    acconto: '', recupero: '', da_riportare: '', note: '',
  })
  const [editOpen, setEditOpen] = useState(false)
const [editingRow, setEditingRow] = useState(null)
const [editRow, setEditRow] = useState({
  work_date: '', venue_id: '', created_by: '',
  acconto: '', recupero: '', da_riportare: '', note: '',
})
const [confirmDeleteOne, setConfirmDeleteOne] = useState(null)

  useEffect(() => {
    loadDefaultDateRange()
    loadData()
  }, [])

  async function loadDefaultDateRange() {
    const today = todayISO()
    const { data: period, error } = await supabase
      .from('conteggi_periods')
      .select('date_from,date_to')
      .eq('status', 'open')
      .eq('is_active', true)
      .order('date_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      toast.error(`Errore periodo Cassa: ${error.message}`)
      return
    }

    const defaultFrom = period?.date_from && period.date_from <= today
      ? period.date_from
      : today
    const defaultTo = period?.date_to || today

    setDateFrom(defaultFrom)
    setDateTo(defaultTo)
    setDraftDateFrom(defaultFrom)
    setDraftDateTo(defaultTo)
  }

  function updateDateRange() {
    if (!draftDateFrom || !draftDateTo) {
      toast.warning('Inserisci entrambe le date')
      return
    }
    if (draftDateFrom > draftDateTo) {
      toast.warning('La data iniziale non può superare quella finale')
      return
    }
    setDateFrom(draftDateFrom)
    setDateTo(draftDateTo)
    toast.success('Intervallo aggiornato')
  }

  async function loadData() {
    setLoading(true)
    const { data: activePeriod, error: activePeriodError } = await supabase
      .from('active_conteggi_period')
      .select('id,date_from,date_to,status')
      .maybeSingle()
    if (activePeriodError) toast.error(`Errore periodo Cassa: ${activePeriodError.message}`)

    let movementsQuery = supabase.from('movements_cassa').select('*').is('deleted_at', null)
    let fondoQuery = supabase.from('fondo_cassa_giornaliero').select('*')
    if (activePeriod?.date_from) {
      movementsQuery = movementsQuery.gte('work_date', activePeriod.date_from)
      fondoQuery = fondoQuery.gte('work_date', activePeriod.date_from)
    }
    if (activePeriod?.date_to) {
      movementsQuery = movementsQuery.lte('work_date', activePeriod.date_to)
      fondoQuery = fondoQuery.lte('work_date', activePeriod.date_to)
    }

    const [movRes, venRes, dipRes, fondoRes] = await Promise.all([
      movementsQuery.order('created_at', { ascending: false }),
      supabase.from('venues').select('*'),
      supabase.from('dipendenti').select(DIPENDENTI_SAFE_FIELDS),
      fondoQuery,
    ])
    if (movRes.error) toast.error(`Errore movimenti: ${movRes.error.message}`)
    setMovements(movRes.data || [])
    setVenues(venRes.data || [])
    setDipendenti(dipRes.data || [])
    setFondi(fondoRes.data || [])
    setPendingDeletes(new Set())
    setLoading(false)
    window.dispatchEvent(new Event('cassa-totale-refresh'))
  }

  function venueLabel(id) {
    const v = venues.find((x) => String(x.id) === String(id))
    if (!v) return id || '—'
    const name = String(v.name || '').trim()
    if (name.toLowerCase().startsWith(String(v.id).toLowerCase())) return name
    return `${v.id} ${name}`
  }

  function operatorById(id) {
    return dipendenti.find((d) => String(dipendenteId(d)) === String(id))
  }

  function isGenericMovement(row) {
    return !row?.venue_id || (
      Number(row?.acconto || 0) === 0 &&
      Number(row?.recupero || 0) === 0 &&
      Number(row?.da_riportare || 0) === 0
    )
  }

  const rows = useMemo(() => {
    const cog_q = cognome.trim().toLowerCase()
    const loc_q = nomeLocale.trim().toLowerCase()
    return movements.filter((r) => {
      if (!showGeneric && !r.venue_id) return false
      if (dateFrom && r.work_date < dateFrom) return false
      if (dateTo && r.work_date > dateTo) return false
      const dip = operatorById(r.created_by)
      const fullName = dipendenteName(dip).toLowerCase()
      if (cog_q && !fullName.includes(cog_q)) return false
      const venueText = venueLabel(r.venue_id).toLowerCase()
      if (loc_q && !venueText.includes(loc_q)) return false
      return true
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }, [movements, dateFrom, dateTo, cognome, nomeLocale, showGeneric, venues, dipendenti])

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.acconto += Number(r.acconto || 0)
    acc.recupero += Number(r.recupero || 0)
    acc.da_riportare += Number(r.da_riportare || 0)
    return acc
  }, { acconto: 0, recupero: 0, da_riportare: 0 }), [rows])

  function toggleRow(id) {
    setPendingDeletes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    if (pendingDeletes.size === rows.length) setPendingDeletes(new Set())
    else setPendingDeletes(new Set(rows.map((r) => r.id)))
  }

  function cancelPending() {
    setPendingDeletes(new Set())
  }

  async function confirmDeletePending() {
    const ids = Array.from(pendingDeletes)
    const { error } = await supabase
      .from('movements_cassa').update({ deleted_at: new Date().toISOString() }).in('id', ids)
    if (error) throw new Error(error.message)
    setMovements((prev) => prev.filter((x) => !pendingDeletes.has(x.id)))
    setPendingDeletes(new Set())
    setConfirmSave(false)
    toast.success(`${ids.length} movimenti cancellati`)
  }

  async function createMovement() {
    if (!newRow.work_date || !newRow.venue_id || !newRow.created_by) {
      toast.warning('Data, locale e agente sono obbligatori'); return
    }
    const { error } = await supabase.from('movements_cassa').insert({
      client_id: crypto?.randomUUID?.() || String(Date.now()),
      work_date: newRow.work_date,
origine: 'admin_cassa', venue_id: newRow.venue_id, created_by: newRow.created_by,
      acconto: normNumber(newRow.acconto), recupero: normNumber(newRow.recupero),
      da_riportare: normNumber(newRow.da_riportare), note: newRow.note || null,
    })
    if (error) { toast.error(`Errore: ${error.message}`); return }
    setNewOpen(false)
    setNewRow({ work_date: todayISO(), venue_id: '', created_by: '', acconto: '', recupero: '', da_riportare: '', note: '' })
    toast.success('Movimento creato')
    await loadData()
  }
function openEditMovement(row) {
  setEditingRow(row)
  setEditRow({
    work_date: row.work_date || todayISO(),
    venue_id: row.venue_id || '',
    created_by: row.created_by || '',
    acconto: row.acconto ?? '',
    recupero: row.recupero ?? '',
    da_riportare: row.da_riportare ?? '',
    note: row.note || '',
  })
  setEditOpen(true)
}

async function updateMovement() {
  if (!editingRow?.id) return

  const payload = {
    work_date: editRow.work_date,
    venue_id: editRow.venue_id || null,
    created_by: editRow.created_by || null,
    acconto: normNumber(editRow.acconto),
    recupero: normNumber(editRow.recupero),
    da_riportare: normNumber(editRow.da_riportare),
    note: editRow.note || null,
  }

  if (editingRow.origine === 'chiusura_conteggio' &&
      ['work_date', 'venue_id', 'created_by', 'acconto', 'recupero', 'da_riportare'].some(key =>
        String(payload[key] ?? '') !== String(editingRow[key] ?? ''))) {
    toast.warning('Questo riporto deriva da un conteggio finalizzato. Correggi il conteggio originale nella sezione Conteggi.');
    return
  }

  const { error } = await supabase
    .from('movements_cassa')
    .update(payload)
    .eq('id', editingRow.id)
    .select('id')
    .single()

  if (error) {
    toast.error(`Errore modifica: ${error.message}`)
    return
  }

  setEditOpen(false)
  setEditingRow(null)
  toast.success('Movimento modificato')
  await loadData()
}

async function deleteMovement(row) {
  if (!row?.id) return

  const { error } = await supabase
    .from('movements_cassa')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', row.id)

  if (error) {
    toast.error(`Errore cancellazione: ${error.message}`)
    return
  }

  setConfirmDeleteOne(null)
  toast.success('Movimento cancellato')
  await loadData()
}

  async function generatePdf() {
    const pdfRows = movements.filter((r) => {
      if (r.work_date !== pdfDate) return false
      if (pdfEmployee !== 'all' && String(r.created_by) !== String(pdfEmployee)) return false
      return true
    })
    if (pdfRows.length === 0) { toast.warning('Nessun movimento per questo PDF'); return }
    const employee = pdfEmployee === 'all' ? 'TUTTI' : dipendenteName(operatorById(pdfEmployee))
    const fondo = fondi.find((f) => {
      if (String(f.work_date) !== String(pdfDate)) return false
      if (pdfEmployee === 'all') return true
      return String(f.created_by) === String(pdfEmployee)
    }) || {}
    const sum = (key) => pdfRows.reduce((acc, r) => acc + Number(r[key] || 0), 0)
    const moneteRaw = Number(fondo?.monete || 0)

    let previewWindow = null
    try {
      previewWindow = createPdfPreviewWindow()
      await exportMovementsToPdf({
        dateLabel: toIT(pdfDate), operatorName: employee, fondo,
        movements: pdfRows.map((r) => ({
          venueName: venueLabel(r.venue_id),
          operatorLabel: new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          acconto: Number(r.acconto || 0), recupero: Number(r.recupero || 0), da_riportare: Number(r.da_riportare || 0),
        })),
        totals: {
          accontiRaw: sum('acconto'), recuperiRaw: sum('recupero'), da_riportareRaw: sum('da_riportare'),
          moneteRaw, cassaGeneraleRaw: moneteRaw + sum('acconto') + sum('recupero') - sum('da_riportare'),
        },
        targetWindow: previewWindow,
      })
      setPdfOpen(false)
      toast.success('PDF aperto in anteprima')
    } catch (error) {
      closePdfPreviewWindow(previewWindow)
      toast.error(error.message || 'Impossibile generare il PDF')
    }
  }

  const hasPending = pendingDeletes.size > 0
  const allChecked = rows.length > 0 && pendingDeletes.size === rows.length
  // Filtri premium: stessa gerarchia visiva della sezione Conteggi.
  const filterBanners = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <section className="rounded-[22px] border border-[#a8c9de] bg-[#f9fdff] p-4 shadow-[0_18px_38px_-32px_rgba(68,43,5,.72)]">
        <div className="mb-3 flex items-center justify-center gap-2 text-[#186494]">
          <Calendar size={15} />
          <p className="text-[11px] font-black tracking-[0.18em]">DATA</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
          <Input type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} />
        </div>
        <button type="button" onClick={updateDateRange} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-[12px] border border-[#8fbdd9] bg-[#e8f4fb] text-[9px] font-black tracking-[0.1em] text-[#165176] transition active:scale-[.98]">
          <RefreshCw size={13} />AGGIORNA INTERVALLO
        </button>
      </section>

      <section className="rounded-[22px] border border-[#a8c9de] bg-[#f9fdff] p-4 shadow-[0_18px_38px_-32px_rgba(68,43,5,.72)]">
        <div className="mb-3 flex items-center justify-center gap-2 text-[#186494]">
          <User size={15} />
          <p className="text-[11px] font-black tracking-[0.18em]">UTENTE</p>
        </div>
        <Input value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Cerca per cognome" />
      </section>

      <section className="rounded-[22px] border border-[#a8c9de] bg-[#f9fdff] p-4 shadow-[0_18px_38px_-32px_rgba(68,43,5,.72)]">
        <div className="mb-3 flex items-center justify-center gap-2 text-[#186494]">
          <Building2 size={15} />
          <p className="text-[11px] font-black tracking-[0.18em]">LOCALE</p>
        </div>
        <Input value={nomeLocale} onChange={(e) => setNomeLocale(e.target.value)} placeholder="Cerca locale" />
        <div className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="show-generic"
            checked={showGeneric}
            onChange={(e) => setShowGeneric(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
          />
          <label htmlFor="show-generic" className="cursor-pointer text-[12px] text-[var(--color-text-secondary)]">
            MOSTRA OPERAZIONI GENERICHE
          </label>
        </div>
      </section>

      <button type="button" onClick={() => setNewOpen(true)} className="group relative min-h-[146px] overflow-hidden rounded-[22px] border border-[#2d86bd] bg-[linear-gradient(135deg,#d4edfc_0%,#6eb7e4_100%)] p-4 text-[#0d4365] shadow-[0_20px_42px_-30px_rgba(97,61,6,.7)] transition hover:-translate-y-0.5 hover:brightness-102 active:scale-[.985]">
        <span className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/40 blur-2xl" />
        <span className="relative flex h-full flex-col items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[#4b97c7] bg-white/65 shadow-[0_12px_22px_-16px_rgba(91,55,5,.6)]"><Plus size={24} strokeWidth={2.8} /></span>
          <span className="text-[12px] font-black tracking-[0.17em]">NUOVO MOVIMENTO</span>
        </span>
      </button>
    </div>
  )

  useEffect(() => {
    const refresh = () => { loadData() };
    window.addEventListener('admin-page-refresh', refresh);
    return () => window.removeEventListener('admin-page-refresh', refresh);
  });

  return (
    <PageLayout>
      <PageBody>
        <div className="min-h-full bg-[radial-gradient(circle_at_15%_0%,rgba(99,177,226,.16),transparent_28%),linear-gradient(180deg,#e8f1f7_0%,#e8eff4_100%)] px-3 py-3 md:px-6 md:py-5">
          <div className="mx-auto max-w-[1720px] space-y-4">
          <section className="pm-cassa-page-heading relative overflow-hidden rounded-[30px] border border-[#8fc0df] bg-[linear-gradient(135deg,#f9fcfe_0%,#bfe0f4_100%)] px-4 py-5 shadow-[0_24px_60px_-38px_rgba(80,55,15,.62)] md:px-7">
            <div className="pointer-events-none absolute -left-16 -top-24 h-60 w-60 rounded-full bg-white/75 blur-3xl" />
            <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative min-h-[58px]">
              <div className="mx-auto flex max-w-[900px] items-center justify-center px-14 text-center">
                <h1 className="text-[29px] font-black tracking-[0.13em] text-[#0b2a3d] md:text-[35px]">SEZIONE CASSA</h1>
              </div>
              <button type="button" onClick={loadData} disabled={loading} className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-[16px] border border-[#6cafd8] bg-[linear-gradient(145deg,#f1f9fe,#8fc8ec)] text-[#195275] shadow-[0_13px_24px_-17px_rgba(116,79,17,.48)] transition hover:-translate-y-[55%] hover:brightness-102 active:scale-95 disabled:opacity-60" aria-label="Aggiorna cassa" title="Aggiorna">
                <RefreshCw size={19} strokeWidth={2.8} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </section>

          <div className="pm-cassa-mobile-toolbar md:hidden">
            <button type="button" onClick={() => setFiltersOpen(true)}><Search size={20}/> Filtri{(cognome || nomeLocale || showGeneric) && ' · attivi'}</button>
            <button type="button" onClick={() => setNewOpen(true)}><Plus size={20}/> Nuovo movimento</button>
          </div>
          <div className="hidden md:block">{filterBanners}</div>

          <section className="overflow-hidden rounded-[28px] border border-[#aacbdf] bg-[#f9fdff] shadow-[0_24px_55px_-38px_rgba(65,43,8,.68)]">
            <div className="relative flex min-h-[68px] flex-col items-center justify-center gap-2 border-b border-[#cadeea] px-4 py-4 text-center md:flex-row">
              <h2 className="text-[21px] font-black tracking-[0.18em] text-[#186494] md:text-[26px]">LISTA MOVIMENTI</h2>
              {!loading && <span className="rounded-full border border-[#8dbcd9] bg-[#e8f4fb] px-2.5 py-1 text-[9px] font-black tracking-[0.1em] text-[#165176]">{rows.length} MOVIMENTI</span>}
              {hasPending && (
                <div className="flex items-center gap-2 md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2">
                  <Badge variant="danger" size="sm">{pendingDeletes.size} da cancellare</Badge>
                  <Button size="sm" icon={RotateCcw} variant="ghost" onClick={cancelPending} className="flex-1 md:flex-initial">Annulla</Button>
                  <Button size="sm" icon={Trash2} variant="danger" onClick={() => setConfirmSave(true)} className="flex-1 font-black tracking-[0.06em] md:flex-initial">CONFERMA CANCELLAZIONE</Button>
                </div>
              )}
            </div>

{/* TABELLA DESKTOP */}
<div className="hidden md:block">
  <div className="max-h-[calc(100vh-340px)] overflow-y-auto overflow-x-auto">
<table className="w-full min-w-[1050px] text-[13px]">
  <colgroup>
    <col className="w-[40px]" />
    <col className="w-[27%]" />
    <col className="w-[13%]" />
    <col className="w-[20%]" />
    <col className="w-[12%]" />
    <col className="w-[10%]" />
    <col className="w-[12%]" />
    <col className="w-[6%]" />
  </colgroup>

  <thead className="sticky top-0 z-10 bg-[#d3e8f5]">
                  <tr className="border-b border-[#aacbdf]">
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox" checked={allChecked} onChange={selectAllVisible}
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-danger)]"
                      />
                    </th>
                    <Th>Locale</Th>
                    <Th>Utente</Th>
                    <Th>Data e ora</Th>
                    <Th className="text-right">Acconto</Th>
                    <Th className="text-right">Recupero</Th>
                    <Th className="text-right">da Riportare</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}

                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={8}>
                      <EmptyState title="Nessun movimento" description="Modifica i filtri o crea un nuovo movimento." />
                    </td></tr>
                  )}

                  {!loading && rows.map((r) => {
                    const pending = pendingDeletes.has(r.id)
                    return (
                      <tr
                        key={r.id}
                        className={`group border-b border-[var(--color-border)] last:border-0 transition-colors ${
                          pending ? 'bg-[var(--color-danger-soft)]' : 'hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox" checked={pending} onChange={() => toggleRow(r.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-danger)]"
                          />
                        </td>
                        <Td className={`font-medium ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
                          {r.venue_id ? venueLabel(r.venue_id) : <span className="italic text-[var(--color-text-muted)]">— generico —</span>}
                        </Td>
                        <Td className={pending ? 'line-through text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}>
                          {dipendenteName(operatorById(r.created_by))}
                        </Td>
                        <Td className={`tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-slate-500'}`}>
                          {r.origine === 'chiusura_conteggio' || r.origine === 'admin_cassa' ? `${toIT(r.work_date)} 00:00` : formatDateTime(r.created_at)}
                        </Td>
                        {isGenericMovement(r) ? (
                          <td
                            colSpan={3}
                            className={`px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.16em] ${
                              pending ? 'line-through text-[var(--color-danger)]' : 'text-[#186494]'
                            }`}
                          >
                            Operazione generica
                          </td>
                        ) : (
                          <>
                            <Td className={`text-right font-black tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[#0b2a3d]'}`}>
                              {formatEuro0(r.acconto)}
                            </Td>
                            <Td className={`text-right font-black tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-[#165176]'}`}>
                              {formatEuro0(r.recupero)}
                            </Td>
                            <Td className={`text-right font-black tabular-nums ${pending ? 'line-through text-[var(--color-danger)]' : 'text-slate-700'}`}>
                              {formatEuro0(r.da_riportare)}
                            </Td>
                          </>
                        )}
                       <Td>
  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
    <IconButton
      icon={Pencil}
      size="sm"
      variant="secondary"
      onClick={() => openEditMovement(r)}
      title="Modifica movimento"
    />
    <IconButton
      icon={Trash2}
      size="sm"
      variant="danger"
      onClick={() => setConfirmDeleteOne(r)}
      title="Elimina movimento"
    />
  </div>
</Td>
                      </tr>
                    )
                  })}
                </tbody>
</table>
  </div>
</div>

            {/* LISTA CARD MOBILE */}
            <div className="pm-cassa-mobile-list md:hidden">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-surface-active)]" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[var(--color-surface-active)]" />
                </div>
              ))}

              {!loading && rows.length === 0 && (
                <div className="py-8">
                  <EmptyState title="Nessun movimento" description="Modifica i filtri o crea un nuovo movimento." />
                </div>
              )}

              {!loading && rows.map((r) => {
                const pending = pendingDeletes.has(r.id)
                return (
                  <article key={r.id} className={`pm-cassa-movement ${pending ? 'pending' : ''}`}>
                    <div className="pm-cassa-movement-heading">
                      <button type="button" className="pm-cassa-open" aria-label={`Apri movimento ${r.venue_id ? venueLabel(r.venue_id) : 'generico'}`} onClick={() => openEditMovement(r)}>
                        <span>
                          <strong>{r.venue_id ? venueLabel(r.venue_id) : 'Operazione generica'}</strong>
                          <small>{dipendenteName(operatorById(r.created_by))}</small>
                          <small>{r.origine === 'chiusura_conteggio' || r.origine === 'admin_cassa' ? `${toIT(r.work_date)} 00:00` : formatDateTime(r.created_at)}</small>
                        </span>
                        <Pencil size={20} className="shrink-0 text-[#186494]" />
                      </button>
                      <label className="pm-cassa-select" title="Seleziona per cancellare">
                        <input type="checkbox" checked={pending} onChange={() => toggleRow(r.id)} aria-label={`Seleziona movimento ${r.venue_id ? venueLabel(r.venue_id) : 'generico'} per cancellare`} />
                      </label>
                    </div>
                    {!isGenericMovement(r) && <div className="pm-cassa-values">
                      <div><small>Acconto</small><strong className="text-[#0b2a3d]">{formatEuro0(r.acconto)}</strong></div>
                      <div><small>Recupero</small><strong className="text-[#165176]">{formatEuro0(r.recupero)}</strong></div>
                      <div><small>Da riportare</small><strong className="text-slate-700">{formatEuro0(r.da_riportare)}</strong></div>
                    </div>}
                    {isGenericMovement(r) && <p className="px-3 pb-3 text-sm text-[#186494]">Operazione generica</p>}
                  </article>
                )
              })}
            </div>
          </section>
          </div>
        </div>
      </PageBody>

      {!loading && rows.length > 0 && (
        <div className="relative z-30 shrink-0 border-t border-[#6fadd4] bg-[linear-gradient(135deg,#f9fcfe_0%,#b9dcf2_100%)] px-3 py-2.5 shadow-[0_-14px_34px_-24px_rgba(72,45,5,.72)] md:px-6">
<div className="mx-auto grid max-w-[1720px] grid-cols-3 items-center md:grid-cols-[40px_27fr_13fr_20fr_12fr_10fr_12fr_6fr]">
  <p className="hidden pr-4 text-right text-[11px] font-black tracking-[0.2em] text-[#186494] md:col-start-4 md:block">
    TOTALI
  </p>

  <div className="text-center md:col-start-5 md:pr-4 md:text-right">
    <p className="text-[9px] font-black tracking-[0.1em] text-[#186494]">
      ACCONTO
    </p>
    <p className="text-[17px] font-black tabular-nums text-[#0b2a3d] md:text-[20px]">
      {formatEuro0(totals.acconto)}
    </p>
  </div>

  <div className="border-x border-[#a8c9dd] text-center md:col-start-6 md:border-0 md:pr-4 md:text-right">
    <p className="text-[9px] font-black tracking-[0.1em] text-[#186494]">
      RECUPERO
    </p>
    <p className="text-[17px] font-black tabular-nums text-[#165176] md:text-[20px]">
      {formatEuro0(totals.recupero)}
    </p>
  </div>

  <div className="text-center md:col-start-7 md:pr-4 md:text-right">
    <p className="text-[9px] font-black tracking-[0.1em] text-[#186494]">
      DA RIPORTARE
    </p>
    <p className="text-[17px] font-black tabular-nums text-slate-700 md:text-[20px]">
      {formatEuro0(totals.da_riportare)}
    </p>
  </div>
</div>
        </div>
      )}

      {/* Nuovo movimento — stile Play Money Dipendenti */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="NUOVO MOVIMENTO"
        width="md"
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        <div className="space-y-4 rounded-[24px] bg-[#f1f7fb] p-1">
          <div className="rounded-[22px] border border-[#91c4e3] bg-[linear-gradient(135deg,#f9fcfe,#cfe8f8)] p-4 shadow-[0_12px_30px_rgba(111,76,14,.08)]">
            <div className="space-y-3">
              <PremiumField icon={Calendar} label="DATA">
                <Input className="h-12 rounded-[15px] border-[#8fbedb] bg-white px-4 font-bold" type="date" value={newRow.work_date} onChange={(e) => setNewRow((p) => ({ ...p, work_date: e.target.value }))} />
              </PremiumField>
              <PremiumField icon={User} label="DIPENDENTE">
                <Select className="h-12 rounded-[15px] border-[#8fbedb] bg-white px-4 font-bold" value={newRow.created_by} onChange={(e) => setNewRow((p) => ({ ...p, created_by: e.target.value }))}>
                  <option value="">Seleziona dipendente…</option>
                  {dipendenti.map((d) => (<option key={dipendenteId(d)} value={dipendenteId(d)}>{dipendenteName(d)}</option>))}
                </Select>
              </PremiumField>
              <PremiumField icon={Building2} label="LOCALE">
                <SearchableVenueSelect venues={venues} value={newRow.venue_id} venueLabel={venueLabel} onChange={(venueId) => setNewRow((p) => ({ ...p, venue_id: venueId }))} />
              </PremiumField>
            </div>
          </div>

          <div className="space-y-3">
            <MovementMoneyRow label="Acconto" icon={Plus} value={newRow.acconto} onChange={(v) => setNewRow((p) => ({ ...p, acconto: v }))} />
            <MovementMoneyRow label="Recupero" icon={RotateCcw} value={newRow.recupero} onChange={(v) => setNewRow((p) => ({ ...p, recupero: v }))} />
            <MovementMoneyRow label="Da riportare" icon={RefreshCw} value={newRow.da_riportare} onChange={(v) => setNewRow((p) => ({ ...p, da_riportare: v }))} />
          </div>

          <PremiumField label="NOTE FACOLTATIVE">
            <Input className="h-12 rounded-[15px] border-[#8fbedb] bg-white px-4" value={newRow.note} onChange={(e) => setNewRow((p) => ({ ...p, note: e.target.value }))} placeholder="Aggiungi una nota…" />
          </PremiumField>

          <button onClick={createMovement} className="h-13 w-full rounded-[18px] bg-[linear-gradient(135deg,#2691d4,#167ab8)] py-4 text-[12px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_26px_rgba(181,128,22,.25)] transition hover:-translate-y-0.5">
            CREA MOVIMENTO
          </button>
        </div>
      </Modal>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="FILTRI CASSA" footer={<Button variant="primary" onClick={() => { updateDateRange(); setFiltersOpen(false); }}>Mostra movimenti</Button>}>
        <div className="pm-cassa-filter-panel">{filterBanners}</div>
        <Button className="mt-4 w-full" onClick={() => { setCognome(''); setNomeLocale(''); setShowGeneric(false); setDraftDateFrom(todayISO()); setDraftDateTo(todayISO()); }}>Ripristina filtri di oggi</Button>
      </Modal>

      {/* Modifica movimento — stile Play Money Dipendenti */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="MODIFICA MOVIMENTO"
        width="md"
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        <div className="space-y-4 rounded-[24px] bg-[#f1f7fb] p-1">
          <div className="rounded-[22px] border border-[#91c4e3] bg-[linear-gradient(135deg,#f9fcfe,#cfe8f8)] p-4 shadow-[0_12px_30px_rgba(111,76,14,.08)]">
            <div className="space-y-3">
              <PremiumField icon={Calendar} label="DATA">
                <Input className="h-12 rounded-[15px] border-[#8fbedb] bg-white px-4 font-bold" type="date" value={editRow.work_date} onChange={(e) => setEditRow((p) => ({ ...p, work_date: e.target.value }))} />
              </PremiumField>
              <PremiumField icon={User} label="DIPENDENTE">
                <Select className="h-12 rounded-[15px] border-[#8fbedb] bg-white px-4 font-bold" value={editRow.created_by} onChange={(e) => setEditRow((p) => ({ ...p, created_by: e.target.value }))}>
                  <option value="">Seleziona dipendente…</option>
                  {dipendenti.map((d) => (<option key={dipendenteId(d)} value={dipendenteId(d)}>{dipendenteName(d)}</option>))}
                </Select>
              </PremiumField>
              <PremiumField icon={Building2} label="LOCALE">
                <SearchableVenueSelect venues={venues} value={editRow.venue_id} venueLabel={venueLabel} onChange={(venueId) => setEditRow((p) => ({ ...p, venue_id: venueId }))} />
              </PremiumField>
            </div>
          </div>

          <div className="space-y-3">
            <MovementMoneyRow label="Acconto" icon={Plus} value={editRow.acconto} onChange={(v) => setEditRow((p) => ({ ...p, acconto: v }))} />
            <MovementMoneyRow label="Recupero" icon={RotateCcw} value={editRow.recupero} onChange={(v) => setEditRow((p) => ({ ...p, recupero: v }))} />
            <MovementMoneyRow label="Da riportare" icon={RefreshCw} value={editRow.da_riportare} onChange={(v) => setEditRow((p) => ({ ...p, da_riportare: v }))} />
          </div>

          <PremiumField label="NOTE FACOLTATIVE">
            <Input className="h-12 rounded-[15px] border-[#8fbedb] bg-white px-4" value={editRow.note} onChange={(e) => setEditRow((p) => ({ ...p, note: e.target.value }))} placeholder="Aggiungi una nota…" />
          </PremiumField>

          <button onClick={updateMovement} className="h-13 w-full rounded-[18px] bg-[linear-gradient(135deg,#2691d4,#167ab8)] py-4 text-[12px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_26px_rgba(181,128,22,.25)] transition hover:-translate-y-0.5">
            SALVA MODIFICHE
          </button>
        </div>
      </Modal>

<ConfirmDialog
  open={!!confirmDeleteOne}
  onClose={() => setConfirmDeleteOne(null)}
  title="Elimina movimento"
  message="Confermi di voler eliminare questo movimento? Andrà nel Cestino."
  confirmLabel="Sì, elimina"
  variant="danger"
  onConfirm={() => deleteMovement(confirmDeleteOne)}
/>
      <ConfirmDialog
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        title="Conferma cancellazione"
        message={`Confermi la cancellazione di ${pendingDeletes.size} movimenti? Andranno nel Cestino e potrai ripristinarli.`}
        confirmLabel="Sì, cancella"
        variant="danger"
        onConfirm={confirmDeletePending}
      />
    </PageLayout>
  )

}

function Th({ children, className = '' }) {
  return <th className={`px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] ${className}`}>{children}</th>
}
function Td({ children, className = '' }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}
